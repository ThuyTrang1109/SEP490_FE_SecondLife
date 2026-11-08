import test, { afterEach, beforeEach, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_TOKEN_KEY, ApiError, clearAuthTokens, request, requestGet,
} from '../services/apiClient';
import { createInFlightRequests } from '../utils/inFlightRequests';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const response = (data: unknown, status = 200) => new Response(JSON.stringify({
  success: status < 400, message: status < 400 ? 'OK' : 'Temporary server failure', data,
}), { status, headers: { 'Content-Type': 'application/json' } });

function interceptFetch(t: TestContext) {
  const calls: Array<{
    url: string; options: RequestInit; result: ReturnType<typeof deferred<Response>>;
  }> = [];
  t.mock.method(globalThis, 'fetch', (input: unknown, options: RequestInit = {}) => {
    const result = deferred<Response>();
    calls.push({ url: String(input), options, result });
    options.signal?.addEventListener('abort', () => {
      result.reject(new DOMException('Cancelled by the caller', 'AbortError'));
    }, { once: true });
    return result.promise;
  });
  return calls;
}

const originalStorage = new Map<string, PropertyDescriptor | undefined>();
beforeEach(() => {
  for (const name of ['sessionStorage', 'localStorage']) {
    originalStorage.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value: memoryStorage() });
  }
  clearAuthTokens();
  // Deliberately synthetic values; these tests never call a real backend.
  sessionStorage.setItem(ACCESS_TOKEN_KEY, 'test-session-a');
});
afterEach(() => {
  clearAuthTokens();
  for (const [name, descriptor] of originalStorage) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  originalStorage.clear();
});

test('concurrent reads of equivalent API URLs issue one HTTP request', async (t) => {
  const calls = interceptFetch(t);
  const first = requestGet<{ id: string }>('/users/me');
  const second = requestGet<{ id: string }>('/api/v1/users/me');
  assert.equal(first, second);
  await tick();
  assert.equal(calls.length, 1);
  calls[0].result.resolve(response({ id: 'user-a' }));
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map((item) => item.data.id), ['user-a', 'user-a']);
});

test('a completed read is fetched again instead of returning a cached value', async (t) => {
  const calls = interceptFetch(t);
  const first = requestGet<number>('/wallets/me');
  await tick();
  calls[0].result.resolve(response(10));
  assert.equal((await first).data, 10);
  const second = requestGet<number>('/wallets/me');
  await tick();
  assert.equal(calls.length, 2);
  calls[1].result.resolve(response(25));
  assert.equal((await second).data, 25);
});

test('a failed shared read releases its key so the user can retry', async (t) => {
  const calls = interceptFetch(t);
  const first = requestGet('/users/me');
  const duplicate = requestGet('/users/me');
  const failure = Promise.allSettled([first, duplicate]);
  await tick();
  assert.equal(calls.length, 1);
  calls[0].result.resolve(response(null, 500));
  const results = await failure;
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') {
      assert.ok(result.reason instanceof ApiError);
      assert.equal(result.reason.status, 500);
    }
  }
  const retry = requestGet('/users/me');
  await tick();
  assert.equal(calls.length, 2);
  calls[1].result.resolve(response({ id: 'user-a' }));
  assert.equal((await retry).success, true);
});

test('pending requests from different sessions never share a response', async (t) => {
  const calls = interceptFetch(t);
  const accountA = requestGet<{ owner: string }>('/users/me');
  await tick();
  sessionStorage.setItem(ACCESS_TOKEN_KEY, 'test-session-b');
  const accountB = requestGet<{ owner: string }>('/users/me');
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[0].options.headers).get('Authorization'), 'Bearer test-session-a');
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'), 'Bearer test-session-b');
  calls[1].result.resolve(response({ owner: 'B' }));
  calls[0].result.resolve(response({ owner: 'A' }));
  assert.equal((await accountA).data.owner, 'A');
  assert.equal((await accountB).data.owner, 'B');
});

test('query parameters and custom headers keep different reads independent', async (t) => {
  const calls = interceptFetch(t);
  const reads = [
    requestGet('/inspector-center/orders?page=0'),
    requestGet('/inspector-center/orders?page=1'),
    requestGet('/inspector-center/orders?page=0', { headers: { 'X-View': 'dispatch' } }),
  ];
  await tick();
  assert.equal(calls.length, 3);
  calls.forEach((call, index) => call.result.resolve(response(index)));
  assert.deepEqual((await Promise.all(reads)).map((item) => item.data), [0, 1, 2]);
});

test('writes invalidate pending reads at both start and completion', async (t) => {
  const calls = interceptFetch(t);
  const oldRead = requestGet('/users/me');
  await tick();
  const write = request('/users/me', { method: 'PATCH', body: JSON.stringify({ fullName: 'Updated' }) });
  await tick();
  const duringWrite = requestGet('/users/me');
  await tick();
  assert.equal(calls.length, 3, 'starting a write invalidates the earlier read');
  calls[1].result.resolve(response({ updated: true }));
  await write;
  const afterWrite = requestGet<{ version: string }>('/users/me');
  await tick();
  assert.equal(calls.length, 4, 'a read started before the write completed cannot satisfy its refresh');

  calls[0].result.resolve(response({ version: 'old' }));
  calls[2].result.resolve(response({ version: 'during-write' }));
  await Promise.all([oldRead, duringWrite]);
  const duplicateRefresh = requestGet('/users/me');
  await tick();
  assert.equal(calls.length, 4, 'older completions must not delete the newer pending read');
  assert.equal(afterWrite, duplicateRefresh);
  calls[3].result.resolve(response({ version: 'updated' }));
  assert.equal((await afterWrite).data.version, 'updated');
  await duplicateRefresh;
});

test('clearing a session discards pending reads even if the next login uses the same token', async (t) => {
  const calls = interceptFetch(t);
  const beforeLogout = requestGet('/users/me');
  await tick();
  clearAuthTokens();
  sessionStorage.setItem(ACCESS_TOKEN_KEY, 'test-session-a');
  const afterLogin = requestGet<{ login: string }>('/users/me');
  await tick();
  assert.equal(calls.length, 2);
  calls[0].result.resolve(response({ login: 'old' }));
  calls[1].result.resolve(response({ login: 'new' }));
  await beforeLogout;
  assert.equal((await afterLogin).data.login, 'new');
});

test('aborting one owned read cannot abort an equivalent read owned by another caller', async (t) => {
  const calls = interceptFetch(t);
  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const first = requestGet('/wallets/me', { signal: controllerA.signal });
  const second = requestGet<{ balance: number }>('/wallets/me', { signal: controllerB.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await tick();
  assert.equal(calls.length, 2);
  controllerA.abort();
  await rejected;
  assert.equal(controllerB.signal.aborted, false);
  calls[1].result.resolve(response({ balance: 50 }));
  assert.equal((await second).data.balance, 50);
});

test('a synchronous loader failure releases the in-flight key for a later attempt', async () => {
  const reads = createInFlightRequests();
  const failure = reads.run('key', () => { throw new Error('loader failed'); });
  const duplicate = reads.run('key', () => Promise.resolve('unexpected'));
  assert.equal(failure, duplicate);
  await assert.rejects(failure, /loader failed/);
  assert.equal(await reads.run('key', () => Promise.resolve('recovered')), 'recovered');
});

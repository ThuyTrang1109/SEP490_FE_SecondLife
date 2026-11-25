import test, { afterEach, beforeEach, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_TOKEN_KEY, ApiError, clearAuthTokens, request, requestGet,
} from '../services/apiClient';
import { inspectorService } from '../services/inspectorService';
import { mediaService } from '../services/mediaService';
import { getInspectionPhotoUploadError, getInspectionBatchPhotoError } from '../utils/inspectionEvidencePhotos';
import { postService } from '../services/postService';
import { shippingService } from '../services/shippingService';
import { getSellerPreListingInspections, hasPreListingInspectionResult } from '../services/orderFeedService';
import { createInFlightRequests } from '../utils/inFlightRequests';
import { getListingPhotoUploadIssues } from '../utils/listingPhotoUploadErrors';
import { getLalamoveInterruption, isLalamoveShipmentTerminal, shouldSyncLalamoveShipment } from '../utils/lalamoveTracking';

test('a listing without a valuation resolves to no AI price range', async (t) => {
  const calls = interceptFetch(t);
  const result = postService.getLatestPriceEstimate('listing-without-estimate');
  await tick();
  assert.equal(calls.length, 1);
  calls[0].result.resolve(response(undefined));
  assert.equal(await result, null);
});

test('listing valuation returns the real price range and keeps compatibility with the previous API', async (t) => {
  const calls = interceptFetch(t);
  const result = postService.getLatestPriceEstimate('listing-with-estimate');
  await tick();
  const estimate = { fairPriceMin: 310000, fairPriceMax: 425000, suggestedPrice: 380000 };
  calls[0].result.resolve(response(estimate));
  assert.deepEqual(await result, estimate);

  const empty = postService.getLatestPriceEstimate('legacy-unvalued-listing');
  await tick();
  calls[1].result.resolve(response(null, 404));
  assert.equal(await empty, null);
});

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

test('listing init preserves validation details and identifies the rejected submitted photo', async (t) => {
  const calls = interceptFetch(t);
  const previews = ['blob:front', 'blob:side', 'blob:serial', 'blob:accessories'];
  const images = previews.map((preview, index) => new File([preview], `${index + 1}.jpg`, { type: 'image/jpeg' }));
  const result = postService.initPost({ categoryId: 'category-a', images, mode: 'manual' });
  const message = 'Ảnh có kích thước 5464 × 5639 px. Tối đa 16000 px/cạnh và 25000000 pixel.';
  const rejection = assert.rejects(result, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.deepEqual(getListingPhotoUploadIssues(error.errors, previews, error.status), [
      { previewUrl: 'blob:accessories', message },
    ]);
    return true;
  });

  await tick();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/v1/posts/init'));
  assert.ok(calls[0].options.body instanceof FormData);
  assert.deepEqual(calls[0].options.body.getAll('images').map((file) => (file as File).name), images.map((file) => file.name));
  calls[0].result.resolve(new Response(JSON.stringify({
    success: false,
    message: 'Ảnh tải lên chưa hợp lệ',
    errors: [{ field: 'images[3]', message }],
  }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
  await rejection;
});

test('inspection photo upload endpoints preserve the API reason for the rejected file', async (t) => {
  const file = new File(['proof'], 'inspection.jpg', { type: 'image/jpeg' });
  const reason = 'Ảnh có kích thước 7273 × 4854 px. Tối đa 16000 px/cạnh và 25000000 pixel.';
  const folder = 'secondlife/inspections/proofs';
  t.mock.method(console, 'error', () => {});
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string) => Response.json({
    message: 'Ảnh tải lên chưa hợp lệ',
    errors: [{ field: url.includes('upload-multiple') ? 'files[1]' : 'file', message: reason }],
  }, { status: 400 }));

  await assert.rejects(mediaService.uploadImage(file, folder), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(getInspectionPhotoUploadError(error), reason);
    return true;
  });
  await assert.rejects(mediaService.uploadMultipleImages([file, file], folder), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(getInspectionBatchPhotoError(error, 1), reason);
    assert.equal(getInspectionBatchPhotoError(error, 0), undefined);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('photo upload errors without a matching or invalid photo are shown at section level', () => {
  const fields = [
    { field: 'images', message: 'Reduce file size.' },
    { field: 'images[8]', message: 'Photo could not be read.' },
    { field: 'categoryId', message: 'Invalid category.' },
  ];
  assert.deepEqual(getListingPhotoUploadIssues(fields, ['blob:first'], 413), [
    { previewUrl: undefined, message: 'Reduce file size.' },
    { previewUrl: undefined, message: 'Photo could not be read.' },
  ]);
  assert.deepEqual(getListingPhotoUploadIssues([
    { field: 'images[0]', message: 'Try again later.' },
  ], ['blob:first'], 503), [{ previewUrl: undefined, message: 'Try again later.', serviceError: true }]);
});

test('seller Hub shipment reads can bypass cache updates and their refresh events', async (t) => {
  const calls = interceptFetch(t);
  const dispatchEvent = t.mock.fn();
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent, location: { protocol: 'http:', hostname: 'localhost' } },
  });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const cacheKey = 'sl_insp_shipments_inspection-a';
  const stale = { shipmentId: 'old', leg: 'SELLER_TO_CENTER', status: 'FAILED' };
  const current = { shipmentId: 'new', leg: 'SELLER_TO_CENTER', status: 'READY_TO_PICK' };
  localStorage.setItem(cacheKey, JSON.stringify([stale]));
  const result = shippingService.getInspectionShipments('inspection-a', { updateCache: false, isBackground: true });
  await tick();
  assert.equal(calls.length, 1);
  calls[0].result.resolve(response([stale, current]));
  assert.deepEqual(await result, [stale, current]);
  assert.equal(localStorage.getItem(cacheKey), JSON.stringify([stale]));
  assert.equal(dispatchEvent.mock.callCount(), 0);

  const standardRead = shippingService.getInspectionShipments('inspection-a');
  await tick();
  calls[1].result.resolve(response([stale, current]));
  await standardRead;
  assert.equal(localStorage.getItem(cacheKey), JSON.stringify([stale, current]));
  assert.equal(dispatchEvent.mock.callCount(), 1);
});

test('Lalamove sync detects a rejected trip and stops automatic sync attempts for that shipment', async (t) => {
  const calls = interceptFetch(t);
  const pending = { shipmentId: 'shipment-a', orderCode: '123', status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER', driverId: 'previous-driver' };
  assert.equal(getLalamoveInterruption(pending), null);
  assert.equal(shouldSyncLalamoveShipment(pending, undefined, 0), true);
  assert.equal(shouldSyncLalamoveShipment(pending, 0, 12_000), false);
  assert.equal(shouldSyncLalamoveShipment(pending, 0, 60_000), true);

  const sync = shippingService.syncShipment(pending.shipmentId);
  await tick();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/v1/shipments/shipment-a/sync'));
  assert.equal(calls[0].options.method, 'POST');
  calls[0].result.resolve(response({ ...pending, status: 'FAILED', providerStatus: 'REJECTED' }));

  const result = await sync;
  assert.equal(getLalamoveInterruption(result), 'REJECTED');
  assert.equal(isLalamoveShipmentTerminal(result), true);
  assert.equal(shouldSyncLalamoveShipment(result, 0, 120_000), false);
  assert.equal(getLalamoveInterruption({ status: 'CANCELLED', providerStatus: 'ASSIGNING_DRIVER' }), 'CANCELLED');
  assert.equal(isLalamoveShipmentTerminal({ status: 'READY_TO_PICK', providerStatus: 'EXPIRED' }), true);
  assert.equal(shouldSyncLalamoveShipment({ ...pending, orderCode: null }, undefined, 0), false);
});

test('inspection center staff reads switch to the signed-in center and preserve an empty roster', async (t) => {
  const calls = interceptFetch(t);
  const inspector = { id: 'inspector-a', email: 'inspector@example.com', fullName: 'Inspector A', accountStatus: 'LOCKED' };
  localStorage.setItem('center_registered_staff', JSON.stringify([inspector]));

  const firstCenter = inspectorService.getStaff();
  await tick();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/v1/inspector-center/staff'));
  assert.equal(new Headers(calls[0].options.headers).get('Authorization'), 'Bearer test-session-a');
  calls[0].result.resolve(response([inspector]));
  assert.deepEqual(await firstCenter, [inspector]);

  sessionStorage.setItem(ACCESS_TOKEN_KEY, 'test-session-b');
  const secondCenter = inspectorService.getStaff();
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'), 'Bearer test-session-b');
  calls[1].result.resolve(response([]));
  assert.deepEqual(await secondCenter, []);
});

test('inspection center staff reports failed requests instead of returning a fallback roster', async (t) => {
  const calls = interceptFetch(t);
  const staff = inspectorService.getStaff();
  const assertion = assert.rejects(staff, (error) => error instanceof ApiError && error.status === 500);
  await tick();
  calls[0].result.resolve(response(null, 500));
  await assertion;
});

test('inspection detail shares reads during mount and reloads after a status notification', async (t) => {
  const calls = interceptFetch(t);
  const orderId = 'c40415c2-a72b-47e2-864e-e54762fbe347';
  const first = inspectorService.getOrder(orderId, { isBackground: false });
  const remount = inspectorService.getOrder(orderId, { isBackground: false });
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal, undefined);
  calls[0].result.resolve(response({ id: orderId, status: 'WAITING_SELLER_APPROVAL' }));
  assert.equal((await first).status, 'WAITING_SELLER_APPROVAL');
  assert.equal((await remount).status, 'WAITING_SELLER_APPROVAL');

  const refresh = inspectorService.getOrder(orderId, { isBackground: true });
  await tick();
  assert.equal(calls.length, 2);
  calls[1].result.resolve(response({ id: orderId, status: 'WAITING_FEE_PAYMENT' }));
  assert.equal((await refresh).status, 'WAITING_FEE_PAYMENT');
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

test('seller listing pages derive available actions from older BE responses', async (t) => {
  const rows = [
    { id: 'draft', status: 'DRAFT', listingCreditCharged: false },
    { id: 'rejected', status: 'REJECTED', listingCreditCharged: false },
    { id: 'charged', status: 'REJECTED', listingCreditCharged: true },
    { id: 'unknown-credit', status: 'DRAFT' },
    { id: 'active', status: 'ACTIVE', listingCreditCharged: true },
    { id: 'reserved', status: 'RESERVED', listingCreditCharged: true },
    { id: 'sold', status: 'SOLD', listingCreditCharged: true },
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ items: rows, totalElements: 7 }));

  const page = await postService.getMyPosts();
  assert.ok(!Array.isArray(page));
  assert.equal(page.totalElements, 7);
  assert.deepEqual(page.items?.filter((row) => row.sellerActions?.editContent).map((row) => row.id), ['draft', 'rejected']);
  assert.deepEqual(page.items?.filter((row) => row.sellerActions?.updateShippingPackage).map((row) => row.id), ['active']);
  assert.ok(page.items?.every((row) => row.sellerActions?.reclassifyItem === false));
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('seller listing details use older BE fields and preserve explicit BE action decisions', async (t) => {
  const lockedActions = { editContent: false, updateShippingPackage: false, reclassifyItem: false };
  const listing = { id: 'listing', status: 'DRAFT', listingCreditCharged: false };
  let body: unknown = listing;
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));

  assert.deepEqual((await postService.getMyPostDetail(listing.id)).sellerActions, { ...lockedActions, editContent: true });
  body = { ...listing, status: 'ACTIVE', listingCreditCharged: true };
  assert.deepEqual((await postService.getMyPostDetail(listing.id)).sellerActions, { ...lockedActions, updateShippingPackage: true });

  body = { data: { ...listing, sellerActions: lockedActions } };
  assert.deepEqual((await postService.getMyPostDetail(listing.id)).sellerActions, lockedActions);
  body = { data: { content: [{ ...listing, status: 'ACTIVE', sellerActions: { ...lockedActions, reclassifyItem: true } }] } };
  const page = await postService.getMyPosts();
  assert.ok(!Array.isArray(page));
  assert.deepEqual(page.content?.[0].sellerActions, { ...lockedActions, reclassifyItem: true });
});

test('seller listings use the newest pre-listing inspection across feed pages', async (t) => {
  const calls = interceptFetch(t);
  const pending = getSellerPreListingInspections(new AbortController().signal);
  const row = (id: string, postId: string, status: string, inspectionScope = 'PRE_LISTING') => ({
    order: null, inspection: { id, postId, status, inspectionScope },
  });

  await tick();
  const firstUrl = new URL(calls[0].url, 'http://localhost');
  assert.equal(firstUrl.searchParams.get('perspective'), 'seller');
  assert.equal(firstUrl.searchParams.get('filter'), 'pre_listing');
  calls[0].result.resolve(response({ counts: {}, page: 0, totalPages: 2, items: [
    row('newer-attempt', 'reinspecting', 'INSPECTING'),
    row('done', 'published', 'COMPLETED'),
    row('purchase', 'transaction', 'PASSED', 'BUYER_REQUEST'),
  ] }));

  await tick();
  assert.equal(new URL(calls[1].url, 'http://localhost').searchParams.get('page'), '1');
  calls[1].result.resolve(response({ counts: {}, page: 1, totalPages: 2, items: [
    row('older-attempt', 'reinspecting', 'FAILED'),
    row('failed', 'rejected', 'FAILED'),
    row('passed', 'awaiting-publication', 'PASSED'),
    row('cancelled', 'cancelled', 'CANCELLED'),
  ] }));

  const byPost = await pending;
  assert.equal(byPost.get('reinspecting')?.id, 'newer-attempt');
  assert.equal(byPost.has('transaction'), false);
  assert.deepEqual([...byPost].filter(([, order]) => hasPreListingInspectionResult(order)).map(([postId]) => postId), [
    'published', 'rejected', 'awaiting-publication',
  ]);
  assert.equal(hasPreListingInspectionResult({ id: 'reject', postId: 'post', status: 'REJECTED', inspectionScope: 'PRE_LISTING' }), true);
});

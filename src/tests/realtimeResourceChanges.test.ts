import { strict as assert } from 'node:assert';
import test from 'node:test';
import { observeResourceChanges } from '../services/observeResourceChanges';

test('active order view reconciles matching bursts and missed updates without duplicate listeners', async () => {
  const browser = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  let calls = 0;
  const stop = observeResourceChanges(['ORDER'], () => { calls++; });
  const change = (resourceType: string) => browser.dispatchEvent(new CustomEvent('secondlife_resource_changed', {detail: {resourceType}}));
  const wait = () => new Promise(resolve => setTimeout(resolve, 230));
  try {
    change('WALLET');
    await wait();
    assert.equal(calls, 0);
    change('ORDER'); change('ORDER');
    await wait();
    assert.equal(calls, 1);
    doc.hidden = true;
    change('ORDER');
    await wait();
    assert.equal(calls, 1);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    browser.dispatchEvent(new Event('secondlife_reconcile'));
    await wait();
    assert.equal(calls, 2);
    change('ORDER');
    stop();
    await wait();
    assert.equal(calls, 2);
  } finally {
    stop();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

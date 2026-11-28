import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSystemMessage } from '../services/chatService';
import { canBuyChatOffer } from '../utils/chatProduct';

const acceptedOffer = { status: 'ACCEPTED', price: 1340000, negotiationId: 'negotiation-id' } as const;

test('a paid negotiation stays in chat history and cannot reopen checkout', () => {
  const payload = { ...acceptedOffer, type: 'OFFER', status: 'COMPLETED' };
  const offer = parseSystemMessage(`SYSTEM: ${JSON.stringify(payload)}`).offer;

  assert.equal(offer?.status, 'COMPLETED');
  assert.equal(offer?.price, 1340000);
  assert.equal(canBuyChatOffer('ACTIVE', offer!), false);
});

test('a stale accepted card cannot open checkout for a sold or payment-pending post', () => {
  assert.equal(canBuyChatOffer('SOLD', acceptedOffer), false);
  assert.equal(canBuyChatOffer('PAYMENT_PENDING', acceptedOffer), false);
});

test('an accepted offer remains usable while the item is available or reserved for the deal', () => {
  assert.equal(canBuyChatOffer('ACTIVE', acceptedOffer), true);
  assert.equal(canBuyChatOffer('RESERVED', acceptedOffer), true);
  assert.equal(canBuyChatOffer('ACTIVE', { ...acceptedOffer, status: 'EXPIRED' }), false);
});

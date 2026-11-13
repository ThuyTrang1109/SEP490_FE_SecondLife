import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionProposalCard } from '../components/chat/InspectionProposalCard';
import type { InspectionOrderDto } from '../services/inspectorService';
import { buildChatProductListing } from '../utils/chatProduct';
import { createChatInspectionReader, getChatInspectionFees, getChatInspectionOrderId, getCurrentChatInspection, matchesChatInspection } from '../utils/chatInspection';

const room = { id: 'room', postId: 'post', buyerId: 'buyer', sellerId: 'seller' };
const passed: InspectionOrderDto = { ...room, id: '17e67687-13fd-411c-8c70-be3e02b69ea9', status: 'PASSED', orderType: 'AT_CENTER' };

test('only inspection references with a backend order UUID are loaded', () => {
  assert.equal(getChatInspectionOrderId(passed.id.toUpperCase()), passed.id);
  assert.equal(getChatInspectionOrderId('temp-proposal-1'), undefined);
  assert.equal(getChatInspectionOrderId({ id: passed.id }), undefined);
  assert.equal(matchesChatInspection(passed, room), true);
  assert.equal(matchesChatInspection({ ...passed, buyerId: 'another-buyer' }, room), false);
  assert.equal(matchesChatInspection({ ...passed, postId: 'another-post' }, room), false);
});

test('a late read for the same order cannot overwrite the successful mutation', async () => {
  let resolveRead!: (order: InspectionOrderDto) => void;
  const response = new Promise<InspectionOrderDto>((resolve) => { resolveRead = resolve; });
  const confirmed = new Map<string, InspectionOrderDto | null>();
  let reads = 0;
  const reader = createChatInspectionReader(() => { reads += 1; return response; }, (id, order) => confirmed.set(id, order));
  const pending = reader.ensure(passed.id);
  assert.equal(reader.ensure(passed.id.toUpperCase()), pending);
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(confirmed.has(passed.id), false);
  reader.accept(passed);
  resolveRead({ ...passed, status: 'CONFIRMED_PENDING_DISPATCH' });
  await pending;
  assert.equal(confirmed.get(passed.id)?.status, 'PASSED');
});

test('each proposal keeps its own API result and a failed detail read has no fabricated order', async () => {
  const closed = { ...passed, id: 'old', status: 'CANCELLED', createdAt: '2026-11-10T10:00:00Z' };
  const confirmed = new Map<string, InspectionOrderDto | null>();
  const reader = createChatInspectionReader(async (id) => {
    if (id === passed.id) return passed;
    if (id === closed.id) return closed;
    throw new Error('Unavailable');
  }, (id, order) => confirmed.set(id, order));
  await Promise.all([reader.read(passed.id), reader.read(closed.id), reader.read('missing')]);
  assert.equal(confirmed.get(passed.id)?.status, 'PASSED');
  assert.equal(confirmed.get(closed.id)?.status, 'CANCELLED');
  assert.equal(confirmed.get('missing'), null);
  assert.equal(getCurrentChatInspection(confirmed.values())?.id, passed.id);
});

test('the card uses the API verdict and amounts, with zero preserved and missing values left empty', () => {
  assert.equal(getChatInspectionFees(passed).total, undefined);
  const order = { ...passed, inspectionFee: 200000, shippingFee: 340000, returnShippingReserveFee: 408000,
    buyerFeeShare: 0, sellerFeeShare: 948000, postPrice: 500000 };
  const renderCard = (data: InspectionOrderDto) => renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: data, listing: { ...buildChatProductListing(room), priceVnd: 500000 }, isSeller: false, isBuyer: true,
    currentRole: 'buyer', lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
  }));
  const card = renderCard(order);
  assert.match(card, /Kiểm định đạt chuẩn/);
  assert.match(card, /948\.000/);
  assert.match(card, /Buyer nộp trước 0/);
  assert.doesNotMatch(card, /Đã thu đủ phí kiểm định/);
  assert.doesNotMatch(renderCard(passed), /166\.000|340\.000|391\.000|Thành phố Hồ Chí Minh|Đã đồng ý mở máy/);
});

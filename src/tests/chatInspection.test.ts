import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionProposalCard } from '../components/chat/InspectionProposalCard';
import type { InspectionOrderDto } from '../services/inspectorService';
import type { ShipmentBackend } from '../types';
import { buildChatProductListing } from '../utils/chatProduct';
import { createChatInspectionReader, getChatInspectionFees, getChatInspectionOrderId, getCurrentChatInspection, matchesChatInspection } from '../utils/chatInspection';
import { feePercentOptions } from '../utils/inspectionFeePercent';

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

test('the proposal card shows one current inspection status for both participants', () => {
  const paidOrder = { ...passed, status: 'CONFIRMED_PENDING_DISPATCH' };
  for (const currentRole of ['buyer', 'seller'] as const) {
    const renderCard = (order: InspectionOrderDto) => renderToStaticMarkup(createElement(InspectionProposalCard, {
      order, listing: buildChatProductListing(room), isSeller: currentRole === 'seller', isBuyer: currentRole === 'buyer',
      currentRole, lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
    }));
    const inspecting = renderCard({ ...paidOrder, customerStatus: 'INSPECTING' });
    assert.match(inspecting, />Đang kiểm định<\/span>/);
    assert.doesNotMatch(inspecting, /Đã thu đủ phí|Chờ điều phối vận chuyển/);

    const dispatched = renderCard({ ...paidOrder, status: 'DISPATCHED', customerStatus: 'INSPECTING' });
    assert.match(dispatched, />Đang kiểm định<\/span>/);
    assert.doesNotMatch(dispatched, /Đã thu đủ phí/);

    const awaitingDispatch = renderCard(paidOrder);
    assert.match(awaitingDispatch, />Đã thu đủ phí<\/span>/);
    assert.doesNotMatch(awaitingDispatch, /Đang kiểm định/);
  }
});

test('at-home and at-center proposal cards translate DISPATCHED status to Vietnamese instead of raw English', () => {
  // 1. At-home order with DISPATCHED status and no appointment yet
  const atHomeOrder: InspectionOrderDto = {
    ...passed,
    id: '1cda53db-0000-0000-0000-000000000000',
    orderType: 'AT_HOME',
    status: 'DISPATCHED',
    customerStatus: undefined,
    inspectorId: undefined,
  };

  const buyerAtHomeHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: atHomeOrder,
    listing: buildChatProductListing(room),
    isSeller: false,
    isBuyer: true,
    currentRole: 'buyer',
    lang: 'vi',
    onOrderUpdated: () => {},
    onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(buyerAtHomeHtml, />DISPATCHED<\/span>/);
  assert.match(buyerAtHomeHtml, />Chờ người bán hẹn lịch đón KTV<\/span>/);

  const sellerAtHomeHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: atHomeOrder,
    listing: buildChatProductListing(room),
    isSeller: true,
    isBuyer: false,
    currentRole: 'seller',
    lang: 'vi',
    onOrderUpdated: () => {},
    onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(sellerAtHomeHtml, />DISPATCHED<\/span>/);
  assert.match(sellerAtHomeHtml, />Chờ bạn hẹn lịch đón KTV<\/span>/);

  // 2. At-home order with DISPATCHED status and inspector assigned
  const atHomeAssignedOrder: InspectionOrderDto = {
    ...atHomeOrder,
    inspectorId: 'ktv-braun-01',
    inspectorName: 'KTV Braun',
    appointmentScheduledAt: '2026-11-28T09:00:00.000Z',
    appointmentStatus: 'CONFIRMED',
  };

  const buyerAssignedHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: atHomeAssignedOrder,
    listing: buildChatProductListing(room),
    isSeller: false,
    isBuyer: true,
    currentRole: 'buyer',
    lang: 'vi',
    onOrderUpdated: () => {},
    onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(buyerAssignedHtml, />DISPATCHED<\/span>/);
  // When inspectorId is present and status is DISPATCHED, getCustomerInspectionStatus returns INSPECTING -> Đang kiểm định
  assert.match(buyerAssignedHtml, />Đang kiểm định<\/span>/);

  // 3. At-center order with DISPATCHED status
  const atCenterOrder: InspectionOrderDto = {
    ...passed,
    orderType: 'AT_CENTER',
    status: 'DISPATCHED',
    customerStatus: undefined,
    inspectorId: undefined,
  };
  const atCenterHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: atCenterOrder,
    listing: buildChatProductListing(room),
    isSeller: false,
    isBuyer: true,
    currentRole: 'buyer',
    lang: 'vi',
    onOrderUpdated: () => {},
    onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(atCenterHtml, />DISPATCHED<\/span>/);
  assert.match(atCenterHtml, />Đã điều phối vận chuyển<\/span>/);
});

test('passed inspection card displays appropriate message for seller vs buyer', () => {
  const passedOrder: InspectionOrderDto = { ...room, id: 'order-pass-123', status: 'PASSED', orderType: 'AT_CENTER' };

  // Seller perspective
  const sellerHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: passedOrder, listing: buildChatProductListing(room), isSeller: true, isBuyer: false,
    currentRole: 'seller', lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
  }));
  assert.match(sellerHtml, /Sản phẩm đã kiểm định ĐẠT CHUẨN\. Đang chờ người mua xác nhận mua hàng\./);
  assert.doesNotMatch(sellerHtml, /Bạn có thể mua tiếp/);
  assert.doesNotMatch(sellerHtml, /Đang giao hàng đến người mua/);
  assert.doesNotMatch(sellerHtml, /Kiện hàng đã được bàn giao cho tài xế Lalamove/);
  assert.match(sellerHtml, /Kiểm định ĐẠT • Chờ người mua quyết định/);

  // Buyer perspective
  const buyerHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: passedOrder, listing: buildChatProductListing(room), isSeller: false, isBuyer: true,
    currentRole: 'buyer', lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
  }));
  assert.match(buyerHtml, /Sản phẩm đã kiểm định ĐẠT CHUẨN\. Bạn có thể mua tiếp\./);
  assert.doesNotMatch(buyerHtml, /Đang chờ người mua xác nhận/);
});

test('the chat hides the Hub pickup notice while purchase is confirmed for both participants', (t) => {
  const cache = new Map<string, string>();
  const localStorage = { getItem: (key: string) => cache.get(key) ?? null };
  for (const [name, value] of Object.entries({ window: { localStorage }, localStorage })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }

  const order: InspectionOrderDto = {
    ...passed, status: 'DELIVERING_TO_BUYER', finalPaymentPaidAt: '2026-11-24T05:47:38Z',
    linkedOrderId: 'purchase',
  };
  const shipment: ShipmentBackend = {
    shipmentId: 'shipment', orderId: 'purchase', leg: 'CENTER_TO_BUYER', orderCode: 'carrier-reference',
    status: 'FAILED', providerStatus: 'REJECTED', expectedDeliveryTime: null, deliveredAt: null,
  };
  const saveShipment = (value: ShipmentBackend) =>
    cache.set(`sl_order_shipments_${order.id}`, JSON.stringify([value]));

  for (const currentRole of ['buyer', 'seller'] as const) {
    const isSeller = currentRole === 'seller';
    const renderCard = (data = order) => renderToStaticMarkup(createElement(InspectionProposalCard, {
      order: data, listing: buildChatProductListing(room), isSeller, isBuyer: !isSeller, currentRole,
      lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
    }));
    const ready = { ...shipment, status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER' };

    for (const hubShipment of [shipment, ready]) {
      saveShipment(hubShipment);
      const pending = renderCard();
      assert.match(pending, isSeller
        ? /Người mua đã xác nhận mua hàng\./
        : /Bạn đã xác nhận mua hàng thành công\./);
      assert.doesNotMatch(pending, /Chờ tài xế lấy hàng|carrier-reference|đã tạo vận đơn Lalamove thành công/i);
    }

    saveShipment({ ...ready, leg: 'SELLER_TO_BUYER' });
    assert.match(renderCard({ ...order, orderType: 'AT_HOME' }), /Chờ tài xế lấy hàng/);

    saveShipment({ ...shipment, status: 'PICKED_UP', providerStatus: 'PICKED_UP' });
    assert.match(renderCard(), /Đang giao hàng .* • Lalamove/);
  }
});

test('at-home inspection card after purchase accepted shows awaiting shipment before carrier pickup', () => {
  const purchaseAcceptedOrder: InspectionOrderDto = {
    ...room,
    id: 'order-athome-123',
    status: 'DELIVERING_TO_BUYER',
    orderType: 'AT_HOME',
    finalPaymentPaidAt: '2026-11-18T10:00:00Z',
  };

  // Seller perspective
  const sellerHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: purchaseAcceptedOrder, listing: buildChatProductListing(room), isSeller: true, isBuyer: false,
    currentRole: 'seller', lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(sellerHtml, /Đã Xác Nhận Mua • Chờ bạn gửi hàng/);
  assert.doesNotMatch(sellerHtml, /Đang giao hàng đến người mua • Lalamove/);
  assert.doesNotMatch(sellerHtml, /Kiện hàng đã được bàn giao cho tài xế Lalamove/);

  // Buyer perspective
  const buyerHtml = renderToStaticMarkup(createElement(InspectionProposalCard, {
    order: purchaseAcceptedOrder, listing: buildChatProductListing(room), isSeller: false, isBuyer: true,
    currentRole: 'buyer', lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
  }));
  assert.doesNotMatch(buyerHtml, /Đã Duyệt Mua • Chờ người bán gửi hàng/);
  assert.doesNotMatch(buyerHtml, /Đang giao hàng tới bạn • Lalamove/);
  assert.doesNotMatch(buyerHtml, /Kiện hàng đã được bàn giao cho tài xế Lalamove/);
});

test('delivered inspection card shows only the detailed review notice for both participants', () => {
  const delivered = {
    ...passed,
    status: 'DELIVERING_TO_BUYER',
    orderType: 'AT_HOME' as const,
    shippingDeliveredAt: '2026-11-18T11:00:00Z',
  };
  for (const currentRole of ['buyer', 'seller'] as const) {
    const isSeller = currentRole === 'seller';
    const card = renderToStaticMarkup(createElement(InspectionProposalCard, {
      order: delivered, listing: buildChatProductListing(room), isSeller, isBuyer: !isSeller,
      currentRole, lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
    }));
    const title = isSeller ? /Đã giao hàng • Chờ đối soát \(48h\)/g : /Đã nhận hàng • 48h kiểm tra đối soát/g;
    assert.equal([...card.matchAll(title)].length, 1);
    assert.doesNotMatch(card, /Đã giao hàng thành công • Chờ đối soát/);
    assert.match(card, isSeller ? /giải ngân vào ví của bạn/ : /giải ngân cho người bán/);
  }
});

test('completed Hub inspection card shows only the detailed settlement notice for both participants', () => {
  for (const currentRole of ['buyer', 'seller'] as const) {
    const isSeller = currentRole === 'seller';
    const renderCard = (orderType: 'AT_CENTER' | 'AT_HOME') => renderToStaticMarkup(createElement(InspectionProposalCard, {
      order: { ...passed, status: 'COMPLETED', orderType }, listing: buildChatProductListing(room),
      isSeller, isBuyer: !isSeller, currentRole, lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
    }));
    const summary = isSeller
      ? /Giao dịch hoàn tất • Tiền hàng đã chuyển về ví/
      : /Giao dịch hoàn tất • Đã nhận hàng thành công/;
    const hubCard = renderCard('AT_CENTER');
    assert.doesNotMatch(hubCard, summary);
    assert.match(hubCard, isSeller
      ? /Hoàn tất giao dịch • Đã nhận tiền vào ví/
      : /Giao dịch hoàn tất • Đã giải ngân/);
    assert.match(renderCard('AT_HOME'), summary);
  }
});

test('the proposal card keeps accept and reject available when there are no intermediate percentages', () => {
  assert.deepEqual(feePercentOptions(20, 30), [25]);
  assert.deepEqual(feePercentOptions(30, 20), [25]);
  assert.equal(feePercentOptions(20, null).length, 20);

  for (const currentRole of ['buyer', 'seller'] as const) {
    const isBuyer = currentRole === 'buyer';
    const renderCard = (previousBuyerFeePercent: number) => renderToStaticMarkup(createElement(InspectionProposalCard, {
      order: {
        ...passed,
        status: isBuyer ? 'WAITING_BUYER_APPROVAL' : 'WAITING_SELLER_APPROVAL',
        buyerFeePercent: 20,
        previousBuyerFeePercent,
      },
      listing: buildChatProductListing(room), isBuyer, isSeller: !isBuyer, currentRole,
      lang: 'vi', onOrderUpdated: () => {}, onRefreshOrder: async () => {},
    }));
    assert.match(renderCard(30), />Đề xuất lại<\/span>/);

    const finalProposal = renderCard(25);
    assert.doesNotMatch(finalProposal, />Đề xuất lại<\/span>/);
    assert.match(finalProposal, />Đồng ý\s*<\/span>/);
    assert.match(finalProposal, />Từ chối<\/span>/);
  }
});


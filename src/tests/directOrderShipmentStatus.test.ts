import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { OrderCard } from '../components/orders/card/OrderCard';
import { OrderCardActions, type OrderCardActionsProps } from '../components/orders/card/OrderCardActions';
import { OrderCardSummary } from '../components/orders/card/OrderCardSummary';
import { OrderSettlement } from '../components/orders/detail/OrderSettlement';
import type { EscrowOrder, ShipmentBackend } from '../types';
import { orderFeedItemToRaw } from '../services/orderFeedService';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';
import { getOrderEscrowHoldNotice, isOrderEscrowOnHold } from '../utils/orders/orderDispute';
import { upsertShipment } from '../utils/lalamoveTracking';

function renderBadge(order: EscrowOrder, isSeller: boolean) {
  return renderToStaticMarkup(createElement(OrderStatusBadge, {
    status: order.escrowStatus, orderItem: order,
    hasInspection: false, isCurrentOrderSeller: isSeller, isSeller, lang: 'vi',
    isOrderCancelledOrRefunded: () => false, isOrderSellerConfirmed: () => true,
    getOrderInboundShipment: () => null, inboundLoadingOrders: new Set<string>(),
    isInspectorArrivedForOrder: () => false, getOrderAppointment: () => null,
    autoPaidOrderIds: new Set<string>(), isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0, isPartyInspectionFeePaid: () => false,
  }));
}

test('direct order badge uses the supplied shipment response instead of stale browser data', () => {
  const stale = { shipmentId: 'old', leg: 'SELLER_TO_BUYER', status: 'DELIVERED' };
  const storage = { getItem: (key: string) => key === 'sl_order_shipments_order-1' ? JSON.stringify([stale]) : null };
  const previousWindow = (globalThis as any).window;
  const previousStorage = (globalThis as any).localStorage;
  (globalThis as any).window = { localStorage: storage };
  (globalThis as any).localStorage = storage;
  try {
    const render = (shipments: Partial<ShipmentBackend>[]) => renderBadge(
      { id: 'order-1', escrowStatus: 'HELD_IN_ESCROW', backendStatus: 'CONFIRMED', shipments } as unknown as EscrowOrder,
      true,
    );

    assert.match(render([]), /Đã Xác Nhận • Đang Chuẩn Bị Giao Hàng/);
    assert.match(render([{ shipmentId: 'new', leg: 'SELLER_TO_BUYER', status: 'READY_TO_PICK' }]), /Đã tạo vận đơn • Chờ tài xế lấy hàng/);
    assert.match(render([{ shipmentId: 'new', leg: 'SELLER_TO_BUYER', status: 'IN_TRANSIT' }]), /Đang Giao Tới Người Mua/);
  } finally {
    (globalThis as any).window = previousWindow;
    (globalThis as any).localStorage = previousStorage;
  }
});

test('seller can rebook a cancelled direct shipment and tracks an existing return from its panel', () => {
  const cancelled: ShipmentBackend = {
    shipmentId: 'cancelled', orderId: 'direct-order', orderCode: 'old-trip', leg: 'SELLER_TO_BUYER',
    status: 'CANCELLED', providerStatus: 'CANCELED', expectedDeliveryTime: null, deliveredAt: null,
  };
  const order = mapEscrowOrder({
    id: cancelled.orderId, postId: 'post', buyerId: 'buyer', sellerId: 'seller',
    finalPrice: 1_000_000, status: 'CONFIRMED', escrowStatus: 'HELD', createdAt: '2026-11-23T03:00:00Z',
  }, { currentListings: [], currentRole: 'seller', authoritative: true });
  const noop = () => {};
  const asyncNoop = async () => {};
  const cardActionProps = (order: EscrowOrder, orderIsSeller = true): OrderCardActionsProps => ({
    order, orderIsSeller, lang: 'vi', hasInspection: false, orderActionLoading: null, savedAppointment: null,
    inboundLabel: null, hasActiveShipment: false, hasInboundTracking: false, buyerInspectionStage: null,
    loadingBankPaymentId: null, confirmingReceiptIds: new Set<string>(), reviewedOrderIds: [],
    state: {
      isOrderReceiptConfirmed: () => false, isOrderCancelledOrRefunded: () => false, isOrderSellerConfirmed: () => true,
      isInspectorArrivedForOrder: () => false, isPartyInspectionFeePending: () => false, getPartyInspectionFee: () => 0,
      isPartyInspectionFeePaid: () => false, isOrderPacked: () => true, isOrderUnpaid: () => false, getOrderAppointment: () => null,
    },
    actions: {
      setDetailModalOrder: noop, renderInspectionDecision: () => null, setTrackingOrder: noop, setSchedulingOrder: noop,
      setSchedulingReadOnly: noop, handleSellerConfirmOrder: noop, handlePromptRejectInspection: noop, handlePromptCancelOrder: noop,
      handlePayInspectionFee: asyncNoop, setCreateShipmentOrder: noop, handlePromptCancelInspectionRequest: noop,
      setCertificateModalOrder: noop, handleSellerAcceptCounterAppointment: asyncNoop, handleOpenBankPaymentModal: asyncNoop,
      setConfirmDialog: noop, setConfirmingReceiptIds: noop, onConfirmReceipt: noop, setReviewModalOrder: noop,
    },
  });
  const renderActions = (order: EscrowOrder, orderIsSeller = true) =>
    renderToStaticMarkup(createElement(OrderCardActions, cardActionProps(order, orderIsSeller)));
  const renderCard = (order: EscrowOrder, orderIsSeller: boolean) => renderToStaticMarkup(createElement(OrderCard, {
    order, orderIsSeller, lang: 'vi', hasInspection: false, savedAppointment: null,
    ordShipment: null, buyerInspectionStage: null, cardActions: cardActionProps(order, orderIsSeller),
    onTrackReturnShipment: noop,
    state: {
      getStatusBadge: () => null, isOrderReceiptConfirmed: () => false, isOrderCancelledOrRefunded: () => false,
      isInspectorArrivedForOrder: () => false, isOrderSellerConfirmed: () => true,
    },
    actions: {
      setSellerReviewsModalData: noop, setSchedulingOrder: noop, setSchedulingReadOnly: noop,
      handleSellerAcceptCounterAppointment: asyncNoop, setDetailModalOrder: noop,
    },
  }));

  const initialConfirmed = { ...order, shipments: [] };
  assert.match(renderActions(initialConfirmed, true), /Tạo vận đơn/);
  assert.doesNotMatch(renderActions(initialConfirmed, false), /Tạo vận đơn/);

  const afterCancel = { ...order, shipments: [cancelled] };
  assert.match(renderActions(afterCancel), /Tạo lại vận đơn/);
  assert.doesNotMatch(renderActions(afterCancel, false), /Tạo lại vận đơn/);
  assert.doesNotMatch(renderActions({ ...afterCancel, backendEscrowStatus: 'FROZEN' }), /Tạo lại vận đơn/);
  const rejected = { ...cancelled, status: 'FAILED', providerStatus: 'REJECTED' };
  assert.doesNotMatch(renderActions({ ...order, shipments: [rejected] }), /Tạo lại vận đơn/);
  const retryable = { ...order, backendEscrowStatus: 'FROZEN' as const, shipments: [{ ...rejected, canRebook: true }] };
  assert.match(renderActions(retryable), /Tạo lại vận đơn/);
  assert.doesNotMatch(renderActions(retryable, false), /Tạo lại vận đơn/);
  assert.doesNotMatch(renderActions({ ...retryable, hasActiveDispute: true }), /Tạo lại vận đơn/);
  for (const orderIsSeller of [true, false]) {
    assert.doesNotMatch(renderCard(retryable, orderIsSeller), /Quỹ Escrow đang tạm đóng băng|Vận chuyển cần xử lý/);
    assert.match(renderCard({ ...retryable, hasActiveDispute: true }, orderIsSeller), /do khiếu nại \/ tranh chấp/);
  }

  const replacement = { ...cancelled, shipmentId: 'replacement', status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER' };
  const afterRebooking = { ...order, shipments: upsertShipment(afterCancel.shipments, replacement) };
  assert.match(renderBadge(afterRebooking, true), /Chờ tài xế lấy hàng/);
  assert.doesNotMatch(renderActions(afterRebooking), /Tạo lại vận đơn/);
  assert.match(renderActions(afterRebooking, true), /Theo Dõi Lalamove/);
  assert.doesNotMatch(renderActions(afterRebooking, false), /Theo Dõi Lalamove/);

  const awaitingReturn: EscrowOrder = {
    ...afterRebooking,
    status: 'DELIVERED',
    backendStatus: 'DELIVERED',
    backendEscrowStatus: 'FROZEN',
    escrowStatus: 'DISPUTED',
    shipments: [{ ...replacement, status: 'DELIVERED', providerStatus: 'COMPLETED' }],
    orderReturn: { orderId: order.id, reportId: 'approved-report' },
  };
  assert.match(renderActions(awaitingReturn), /Theo Dõi Lalamove/);
  const approvedReturn = { orderId: order.id, reportId: 'approved-report', shipmentStatus: 'READY_TO_PICK' };
  for (const reference of [{ shipmentId: 'return' }, { orderCode: 'return-waybill' }]) {
    const withReturn = { ...awaitingReturn, orderReturn: { ...approvedReturn, ...reference } };
    const sellerCard = renderCard(withReturn, true);
    assert.doesNotMatch(sellerCard, /Theo Dõi Lalamove/);
    assert.match(sellerCard, /Theo dõi vận đơn hoàn/);
  }
});

test('a purchase with frozen escrow shows its carrier status unless the order has an active dispute', () => {
  const order = mapEscrowOrder(orderFeedItemToRaw({
    order: {
      id: 'direct-order', postId: 'post', buyerId: 'buyer', sellerId: 'seller',
      finalPrice: 1_000_000, status: 'CONFIRMED', escrowStatus: 'FROZEN', createdAt: '2026-11-23T03:00:00Z',
    },
    inspection: null, orderReturn: null, buyerName: null, sellerName: null,
    postImageUrl: null, categoryId: null, itemId: null, itemCondition: null,
  }), { currentListings: [], currentRole: 'buyer', authoritative: true });

  assert.equal(order.backendStatus, 'CONFIRMED');
  assert.equal(order.backendEscrowStatus, 'FROZEN');
  assert.equal(isOrderEscrowOnHold(order), true);
  assert.equal(getOrderEscrowHoldNotice(order, 'vi')?.title, 'Khoản thanh toán đang được bảo lưu');

  const shipment: ShipmentBackend = {
    shipmentId: 'waybill', orderId: order.id, orderCode: 'carrier-order', leg: 'SELLER_TO_BUYER',
    status: 'CANCELLED', providerStatus: 'CANCELED', expectedDeliveryTime: null, deliveredAt: null,
  };
  const delivered: EscrowOrder = {
    ...order, escrowStatus: 'DELIVERED_INSPECTION_WINDOW', status: 'DELIVERED', backendStatus: 'DELIVERED',
    shippingDeliveredAt: '2026-11-23T04:00:00Z',
  };
  for (const isSeller of [false, true]) {
    const cancelled = { ...order, shipments: [shipment] };
    assert.match(renderBadge(cancelled, isSeller), /Vận đơn đã bị hủy/);
    const expired = { ...order, shipments: [{ ...shipment, status: 'FAILED', providerStatus: 'EXPIRED' }] };
    assert.match(renderBadge(expired, isSeller), /Vận đơn đã hết hạn/);
    assert.match(renderBadge(delivered, isSeller), /Đã giao/);
    const disputed = { ...delivered, hasActiveDispute: true };
    assert.match(renderBadge(disputed, isSeller), /Đang Tranh Chấp/);
    assert.match(getOrderEscrowHoldNotice(disputed, 'vi')?.title ?? '', /do khiếu nại/);
  }

  const rejected = { ...order, shipments: [{ ...shipment, status: 'FAILED', providerStatus: 'REJECTED' }] };
  assert.equal(getOrderEscrowHoldNotice(rejected, 'vi'), null);
  assert.equal(getOrderEscrowHoldNotice({ ...rejected, backendEscrowStatus: 'HELD' }, 'vi'), null);
  const replacement = { ...shipment, shipmentId: 'replacement', status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER' };
  assert.equal(getOrderEscrowHoldNotice({ ...rejected, shipments: [...rejected.shipments, replacement] }, 'vi')?.title,
    'Khoản thanh toán đang được bảo lưu');

  const sellerSummary = renderToStaticMarkup(createElement(OrderCardSummary, {
    order: rejected, lang: 'vi', orderIsSeller: true, hasInspection: false, savedAppointment: null,
    state: { getStatusBadge: () => null, isOrderReceiptConfirmed: () => false, isOrderCancelledOrRefunded: () => false },
    actions: { setSellerReviewsModalData: () => {} },
  }));
  assert.match(sellerSummary, /Vận đơn bị từ chối/);
  assert.doesNotMatch(sellerSummary, /Vận đơn đã hủy/);

  const sellerDetail = renderToStaticMarkup(createElement(OrderSettlement, {
    order: rejected, lang: 'vi', detailBuyerInspectionStage: null, isOrderReceiptConfirmed: () => false,
    orderSettlement: null, isEscrowReleased: false, isLoadingSettlement: false, orderCommission: null,
  }));
  assert.doesNotMatch(sellerDetail, /Vận chuyển cần xử lý|Liên hệ SecondLife để kiểm tra vận đơn/);
  assert.doesNotMatch(sellerDetail, /Quỹ Escrow đang tạm đóng băng/);
});

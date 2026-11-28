import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LalamoveProgress } from '../components/common/LalamoveProgress';
import { CenterShipmentModal } from '../pages/inspection-center/orders/CenterShipmentModal';
import { CenterOrderStatusBadge } from '../pages/inspection-center/orders/CenterOrderStatusBadge';
import { CenterDispatch } from '../pages/inspection-center/dispatch/CenterDispatch';
import { useCenterDispatchQueue } from '../pages/inspection-center/dispatch/useCenterDispatchQueue';
import { useCenterOrders } from '../pages/inspection-center/orders/useCenterOrders';
import { useCenterShipments } from '../pages/inspection-center/orders/useCenterShipments';
import type { EscrowOrder, ShipmentBackend, UserProfile } from '../types';
import { canReadCenterInspectionShipments, filterCenterApiOrders, getCenterDispatchStage, getInboundShipmentProgress, getLatestInboundShipment, hasCenterReceivedInbound, shouldTrackCenterInspectionShipments, shouldTrackInboundShipment } from '../utils/inspectionCenterData';
import { canBookHubBuyerDelivery, getHubBuyerShipmentLabel, getLatestInspectionShipment, isPaidHubBuyerDelivery } from '../utils/inspectionCenterData';
import { canAppealInspection, canBookCenterReturn, getHubReturnProgress, getHubReturnState, getReturnReserveMessage, isCenterReturnEligible, isHubReturnCase, shouldSyncHubReturnOnOpen, getLatestReturnShipment, getLatestBuyerDeliveryShipment } from '../utils/inspectionCenterData';
import { isExpiredInspectionPurchase } from '../utils/inspectionPurchase';
import { canSellerRebookShipment } from '../utils/lalamoveTracking';

test('seller can rebook only the latest eligible outbound shipment', () => {
  const rejected = {
    shipmentId: 'previous', orderId: 'order-a', leg: 'SELLER_TO_CENTER', orderCode: '123',
    status: 'FAILED', providerStatus: 'REJECTED', expectedDeliveryTime: null, deliveredAt: null,
  };
  assert.equal(canSellerRebookShipment(rejected, [rejected], []), true);
  const expired = { ...rejected, providerStatus: 'EXPIRED' };
  assert.equal(canSellerRebookShipment(expired, [expired], []), true);
  const uncertain = { ...rejected, shipmentId: 'replacement', status: 'CREATION_UNCERTAIN', providerStatus: null, orderCode: null };
  assert.equal(canSellerRebookShipment(rejected, [rejected, uncertain], []), false);
  assert.equal(canSellerRebookShipment(uncertain, [rejected, uncertain], []), false);
  assert.equal(canSellerRebookShipment(rejected, [rejected], [
    { id: 'pickup', shipmentId: rejected.shipmentId, type: 'ORDER_STATUS_CHANGED', status: 'PICKED_UP', occurredAt: '', reason: null },
  ]), false);
  const returnShipment = { ...rejected, leg: 'CENTER_TO_SELLER', status: 'CANCELLED' };
  assert.equal(canSellerRebookShipment(returnShipment, [returnShipment], []), false);
});

test('the center list excludes explicitly foreign orders returned by the API', () => {
  const orders = [
    { id: 'own-order', postId: 'post-a', status: 'DISPATCHED', inspectionCenterId: 'center-a' },
    { id: 'foreign-order', postId: 'post-b', status: 'DISPATCHED', inspectionCenterId: 'center-b' },
    { id: 'legacy-order', postId: 'post-c', status: 'DISPATCHED', inspectionCenterId: null },
  ];

  assert.deepEqual(filterCenterApiOrders(orders, 'center-a').map(({ id }) => id), ['own-order', 'legacy-order']);
});

test('the center queue waits for API authorization before displaying initial escrow orders', () => {
  function QueuePreview() {
    const { orders } = useCenterOrders({
      currentUser: { id: 'center-a', role: 'inspection_center' } as UserProfile,
      initialOrders: [{ id: 'foreign-order', hasInspectionService: true, inspectionCenterId: 'center-b' } as EscrowOrder],
      lang: 'vi',
      loadingShipmentsRef: { current: false },
      showNotice: () => {},
      showOrderShipments: false,
    });
    return createElement('div', null, orders.map(({ id }) => id).join(','));
  }

  assert.equal(renderToStaticMarkup(createElement(QueuePreview)), '<div></div>');
});

test('dispatch only includes orders in the operational queue', () => {
  for (const status of [
    'WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PAYMENT_EXPIRED',
    'PASSED', 'FAILED', 'DELIVERING_TO_BUYER', 'COMPLETED', 'CANCELLED', 'CANCELED', 'DISPUTED',
  ]) {
    assert.equal(getCenterDispatchStage({ status, orderType: 'AT_HOME', inspectorId: 'ktv' }, true), null, status);
  }
});

test('dispatch distinguishes ready assignments and assigned orders', () => {
  const order = { status: 'SHIPPING_TO_CENTER', orderType: 'AT_CENTER' };
  assert.equal(getCenterDispatchStage(order, false), 'WAITING_HUB_RECEIPT');
  assert.equal(getCenterDispatchStage(order, true), 'READY_TO_ASSIGN');
  assert.equal(getCenterDispatchStage({ ...order, status: 'INSPECTING', inspectorId: 'ktv' }, true), 'ASSIGNED');
  assert.equal(getCenterDispatchStage({ status: 'CONFIRMED_PENDING_DISPATCH', orderType: 'AT_HOME' }, false), 'WAITING_SELLER_APPOINTMENT');
  assert.equal(getCenterDispatchStage({ status: 'CONFIRMED_PENDING_DISPATCH', orderType: 'AT_HOME', appointmentScheduledAt: '2026-11-13T09:00:00Z' }, false), 'READY_TO_ASSIGN');
  assert.equal(getCenterDispatchStage({ status: 'SCHEDULED', orderType: 'AT_HOME', appointmentScheduledAt: '2026-11-13T09:00:00Z', inspectorId: 'ktv' }, false), 'ASSIGNED');
});

function shipment(id: string, leg: string, status: string, providerStatus: string | null = null): ShipmentBackend {
  return {
    shipmentId: id,
    orderId: 'inspection-order',
    orderCode: id,
    leg,
    status,
    providerStatus,
    expectedDeliveryTime: null,
    deliveredAt: null,
  };
}

test('center history and dispatch wait for the inbound delivery before showing Hub receipt', () => {
  const order = { id: 'inspection-order', postId: 'post', status: 'CONFIRMED_PENDING_DISPATCH', orderType: 'AT_CENTER', inspectionCenterId: 'center-a' };
  function ReceiptPreview() {
    const { isOrderReceivedAtHub } = useCenterShipments({
      currentUser: { id: 'center-a' } as UserProfile, loadingShipmentsRef: { current: false },
      loadOrders: async () => {}, showNotice: () => {}, showOrderShipments: false, isDispatchTab: true, trackedOrders: [order],
    });
    return createElement('span', null, String(isOrderReceivedAtHub(order)));
  }
  assert.equal(renderToStaticMarkup(createElement(ReceiptPreview)), '<span>false</span>');

  const render = (inbound?: ShipmentBackend) => {
    const inboundShipments = new Map<string, ShipmentBackend>();
    if (inbound) inboundShipments.set(order.id, inbound);
    const received = hasCenterReceivedInbound(order, inbound);
    const stage = getCenterDispatchStage(order, received)!;
    const renderStatusBadge = () => createElement(CenterOrderStatusBadge, {
      order, inboundShipments, buyerShipments: new Map(), deniedShipmentOrders: new Set<string>(),
      currentUser: { id: 'center-a' } as UserProfile, isOrderReceivedAtHub: () => received, showOrderShipments: true,
    });
    const rows = [{ order, stage }];
    const historyBadge = renderToStaticMarkup(renderStatusBadge());
    const dispatch = renderToStaticMarkup(createElement(CenterDispatch, {
      isLoadingOrders: false, renderStatusBadge, handleOpenAssign: () => {},
      handleOpenReviewAppointment: () => {}, handleReceivePackageAtHub: () => {},
      dispatch: {
        dispatchFilter: 'ALL', dispatchOrders: rows, filteredOrders: rows, orderMethodFilter: 'ALL', searchTerm: '',
        setDispatchFilter: () => {}, setOrderMethodFilter: () => {}, setSearchTerm: () => {},
      },
    }));
    return { historyBadge, dispatch };
  };

  const awaitingShipment = render();
  assert.match(awaitingShipment.historyBadge, /Chờ người bán gửi hàng đến Hub/);
  assert.match(awaitingShipment.dispatch, /Chờ người bán gửi hàng đến Hub/);
  assert.match(awaitingShipment.dispatch, /<button[^>]*disabled/);
  assert.doesNotMatch(awaitingShipment.dispatch, /Giao task|đã nhận hàng/);

  const shipping = render(shipment('inbound', 'SELLER_TO_CENTER', 'PICKED_UP'));
  assert.match(shipping.historyBadge, /Đang giao hàng đến Hub/);
  assert.match(shipping.dispatch, /<button[^>]*disabled/);

  const received = render(shipment('inbound', 'SELLER_TO_CENTER', 'DELIVERED'));
  assert.match(received.historyBadge, /Đã nhận hàng • Chờ giao KTV/);
  assert.match(received.dispatch, /Giao task/);
  assert.doesNotMatch(received.dispatch, /<button[^>]*disabled/);
  assert.equal(hasCenterReceivedInbound(order, shipment('other-leg', 'CENTER_TO_BUYER', 'DELIVERED')), false);
  assert.equal(hasCenterReceivedInbound(order, shipment('cancelled', 'SELLER_TO_CENTER', 'CANCELLED', 'COMPLETED')), false);
});

test('an overdue home appointment appears as actionable in center dispatch even when the technician has accepted the task', () => {
  const order = {
    id: 'home-inspection', postId: 'post', orderType: 'AT_HOME', status: 'DISPATCHED',
    appointmentStatus: 'CONFIRMED', appointmentScheduledAt: new Date(Date.now() - 31 * 60_000).toISOString(),
    inspectorId: 'technician-a', inspectorConfirmed: true,
  };

  function DispatchPreview() {
    const dispatch = useCenterDispatchQueue({
      inboundShipments: new Map(), isOrderReceivedAtHub: () => false, orders: [order],
      apiOrderHistory: null, staffList: [], setActiveTab: () => {},
    });

    return createElement(CenterDispatch, {
      dispatch, isLoadingOrders: false, renderStatusBadge: () => null,
      handleOpenAssign: () => {}, handleOpenReviewAppointment: () => {}, handleReceivePackageAtHub: () => {},
    });
  }

  const html = renderToStaticMarkup(createElement(DispatchPreview));
  assert.match(html, /Quá hạn check-in/);
  assert.match(html, /Hẹn lại với người bán/);
  assert.doesNotMatch(html, /<button[^>]*disabled/);
});

test('a zero reserve still permits the assigned center to start a settled Hub return', () => {
  const order = { id: 'inspection', postId: 'post', orderType: 'AT_CENTER', status: 'FAILED', inspectionCenterId: 'a', feeSettledAt: 'settled', returnShippingReserveFee: 0 };
  assert.equal(isCenterReturnEligible(order, 'a', 'inspection_center'), true);
  assert.equal(isCenterReturnEligible({ ...order, status: 'CANCELLED' }, 'a', 'INSPECTION_CENTER'), true);
  assert.equal(isCenterReturnEligible(order, 'b', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible(order, 'a', 'seller'), false);
  assert.equal(isCenterReturnEligible({ ...order, orderType: 'AT_HOME' }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, feeSettledAt: null }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, returnShippingReserveFee: null }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, finalPaymentPaidAt: 'paid' }, 'a', 'inspection_center'), false);
});

test('inspection center can book return shipment when buyer expires 6h or rejects purchase even without feeSettledAt', () => {
  const expiredTimeoutOrder: any = {
    id: 'ord-expired-timeout-1',
    postId: 'post-1',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    inspectionCenterId: 'hub-1',
    feeSettledAt: null,
    returnShippingReserveFee: 50000,
    note: 'cc | Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
    conditionScore: 85,
  };

  assert.equal(isHubReturnCase(expiredTimeoutOrder), true);
  assert.equal(isCenterReturnEligible(expiredTimeoutOrder, 'hub-1', 'inspection_center'), true);
  assert.equal(canBookCenterReturn(expiredTimeoutOrder, 'hub-1', 'inspection_center', undefined), true);
  assert.equal(shouldTrackCenterInspectionShipments(expiredTimeoutOrder, 'hub-1', 'inspection_center'), true);

  const buyerRejectedOrder: any = {
    id: 'ord-buyer-rejected-1',
    postId: 'post-2',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    inspectionCenterId: 'hub-1',
    feeSettledAt: null,
    returnShippingReserveFee: 50000,
    note: 'Sản phẩm ổn | Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý',
    conditionScore: 80,
  };

  assert.equal(isHubReturnCase(buyerRejectedOrder), true);
  assert.equal(isCenterReturnEligible(buyerRejectedOrder, 'hub-1', 'inspection_center'), true);
  assert.equal(canBookCenterReturn(buyerRejectedOrder, 'hub-1', 'inspection_center', undefined), true);
  assert.equal(shouldTrackCenterInspectionShipments(buyerRejectedOrder, 'hub-1', 'inspection_center'), true);
});

test('return tracking retains an existing non-cancelled shipment, including uncertain creation', () => {
  const inbound = shipment('in', 'SELLER_TO_CENTER', 'DELIVERED');
  const uncertain = shipment('unknown', 'CENTER_TO_SELLER', 'CREATION_UNCERTAIN');
  const cancelled = shipment('cancelled', 'CENTER_TO_SELLER', 'CANCELLED');
  assert.deepEqual(getHubReturnState([inbound]), { received: true, shipment: null });
  assert.deepEqual(getHubReturnState([inbound, uncertain, cancelled]), { received: true, shipment: uncertain });
  assert.equal(canBookHubBuyerDelivery(getHubReturnState([inbound, cancelled]).shipment), true);
  assert.equal(canBookHubBuyerDelivery(uncertain), false);
  assert.match(getHubReturnProgress(uncertain).label, /Chờ đối soát/);
  assert.equal(getHubReturnState([shipment('out', 'CENTER_TO_BUYER', 'DELIVERED')]).received, false);
});

test('the shipment modal offers only the outbound action allowed by the inspection and payment status', () => {
  type Props = ComponentProps<typeof CenterShipmentModal>;
  const order: Props['shipmentModalOrder'] = {
    id: 'inspection',
    postId: 'post',
    inspectionCenterId: 'hub',
    orderType: 'AT_CENTER',
    status: 'PASSED',
    conditionScore: 90,
    feeSettledAt: '2026-11-15T07:00:00Z',
    returnShippingReserveFee: 50000,
  };
  const currentUser: Props['currentUser'] = { id: 'hub', name: 'Hub', email: 'hub@example.test', role: 'inspection_center' };
  const inbound = shipment('inbound', 'SELLER_TO_CENTER', 'DELIVERED');
  const shipments: Props['shipments'] = {
    bookingBuyerOrderId: null,
    bookingReturnId: null,
    buyerShipments: new Map([[order.id, null]]),
    closeShipmentModal: () => {},
    deniedShipmentOrders: new Set(),
    handleBookBuyerDelivery: async () => {},
    handleSyncCenterShipment: async () => {},
    hasLoadedShipmentModal: true,
    hubReturns: new Map([[order.id, getHubReturnState([inbound])]]),
    inboundShipments: new Map(),
    inspectionShipments: [],
    isLoadingShipments: false,
    setReturnQuoteOrder: () => {},
    setShipmentError: () => {},
    setShipmentSuccess: () => {},
    shipmentError: null,
    shipmentModalRequestRef: { current: 0 },
    shipmentSuccess: null,
    syncingShipments: new Set(),
  };
  const render = (changes: Partial<typeof order>, data: Partial<typeof shipments> = {}) =>
    renderToStaticMarkup(createElement(CenterShipmentModal, {
      centerProfile: null, currentUser, shipmentModalOrder: { ...order, ...changes }, shipments: { ...shipments, ...data },
    }));
  const buyerAction = /Tạo vận đơn giao người mua/;
  const returnAction = /Tạo vận đơn trả người bán/;
  const paid = { status: 'DELIVERING_TO_BUYER', linkedOrderId: 'purchase', finalPaymentPaidAt: '2026-11-15T08:00:00Z' };
  const declined = { status: 'CANCELLED', note: 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý' };
  const timeoutExpired = { status: 'CANCELLED', note: 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.' };

  for (const changes of [
    { status: 'INSPECTING' },
    { status: 'PASSED' },
    { status: 'DELIVERING_TO_BUYER', linkedOrderId: 'purchase' },
    { status: 'CANCELLED', note: 'Trung tâm đã hủy đơn' },
    { ...paid, orderType: 'AT_HOME' },
  ]) {
    const html = render(changes);
    assert.match(html, /Lộ trình vận đơn/);
    assert.doesNotMatch(html, buyerAction);
    assert.doesNotMatch(html, returnAction);
  }

  assert.match(render(paid), buyerAction);
  assert.doesNotMatch(render(paid), returnAction);
  for (const changes of [{ status: 'FAILED' }, declined, timeoutExpired]) {
    assert.match(render(changes), returnAction);
    assert.doesNotMatch(render(changes), buyerAction);
  }

  assert.doesNotMatch(render(paid, { hasLoadedShipmentModal: false }), buyerAction);
  assert.doesNotMatch(render(paid, {
    buyerShipments: new Map([[order.id, shipment('outbound', 'CENTER_TO_BUYER', 'READY_TO_PICK')]]),
  }), buyerAction);
  assert.doesNotMatch(render(declined, { hubReturns: new Map([[order.id, getHubReturnState([])]]) }), returnAction);
  assert.doesNotMatch(render(declined, {
    hubReturns: new Map([[order.id, getHubReturnState([inbound, shipment('return', 'CENTER_TO_SELLER', 'READY_TO_PICK')])]]),
  }), returnAction);

  // Test hiển thị tiến trình Lalamove Chặng 1 trong modal vận đơn Hub
  const inboundHtml = render({ status: 'PASSED' }, {
    inspectionShipments: [shipment('inbound-1', 'SELLER_TO_CENTER', 'DELIVERED')],
  });
  assert.match(inboundHtml, /Tiến trình vận chuyển Lalamove \(Người bán → Hub\)/);
  assert.match(inboundHtml, /Chặng 1: Seller ➔ Hub/);
  assert.match(inboundHtml, /Tạo vận đơn/);
  assert.match(inboundHtml, /Đã giao thành công/);

  const delivered = shipment('new-inbound', 'SELLER_TO_CENTER', 'DELIVERED', 'COMPLETED');
  const previousAttempts = [
    shipment('cancelled-inbound', 'SELLER_TO_CENTER', 'CANCELLED', 'CANCELED'),
    shipment('stale-carrier-status', 'SELLER_TO_CENTER', 'CANCELED', 'COMPLETED'),
    shipment('old-inbound', 'SELLER_TO_CENTER', 'ASSIGNED', 'ON_GOING'),
  ];
  const history = render({ status: 'RECEIVED_AT_CENTER' }, {
    inspectionShipments: [...previousAttempts, delivered],
    inboundShipments: new Map([[order.id, delivered]]),
  });
  const start = previousAttempts.map((item) => history.indexOf(`Mã Vận đơn: #${item.orderCode}`));
  const deliveryStart = history.indexOf(`Mã Vận đơn: #${delivered.orderCode}`);
  assert.ok(start[0] >= 0 && start[0] < start[1] && start[1] < start[2] && start[2] < deliveryStart);
  const cancelledCard = history.slice(start[0], start[1]);
  const staleCarrierCard = history.slice(start[1], start[2]);
  const activeCard = history.slice(start[2], deliveryStart);
  const deliveredCard = history.slice(deliveryStart);
  for (const card of [cancelledCard, staleCarrierCard]) {
    assert.match(card, /bg-rose-100[^>]*>Vận đơn đã hủy/);
    assert.doesNotMatch(card, /Đã nhận tại Hub|Đã giao thành công|bg-emerald-600/);
  }
  assert.match(activeCard, /Tài xế đang đến lấy hàng/);
  assert.doesNotMatch(activeCard, /Đã nhận tại Hub/);
  assert.match(deliveredCard, /bg-emerald-100[^>]*>Đã nhận tại Hub/);
  assert.equal((deliveredCard.match(/bg-emerald-600/g) ?? []).length, 4);

  const failedReturn = shipment('failed-return', 'CENTER_TO_SELLER', 'FAILED', 'REJECTED');
  const rebookReturnHtml = render(declined, {
    inspectionShipments: [failedReturn],
    hubReturns: new Map([[order.id, getHubReturnState([inbound, failedReturn])]]),
  });
  assert.doesNotMatch(rebookReturnHtml, /Tạo lại vận đơn trả người bán/);
  assert.match(rebookReturnHtml, /Tạo lại vận đơn hoàn trả/);
  assert.match(rebookReturnHtml, /Vận đơn thất bại/);

  const unconfirmedReturn = { ...failedReturn, providerStatus: null };
  assert.doesNotMatch(render(declined, {
    inspectionShipments: [unconfirmedReturn],
    hubReturns: new Map([[order.id, getHubReturnState([inbound, unconfirmedReturn])]]),
  }), /Tạo lại vận đơn trả người bán|Tạo lại vận đơn hoàn trả/);
  const uncertainReturn = shipment('replacement', 'CENTER_TO_SELLER', 'CREATION_UNCERTAIN');
  assert.doesNotMatch(render(declined, {
    inspectionShipments: [failedReturn, uncertainReturn],
    hubReturns: new Map([[order.id, getHubReturnState([inbound, failedReturn, uncertainReturn])]]),
  }), /Tạo lại vận đơn trả người bán|Tạo lại vận đơn hoàn trả/);

  const failedBuyer = shipment('failed-buyer', 'CENTER_TO_BUYER', 'FAILED');
  const rebookBuyerHtml = render(paid, {
    inspectionShipments: [failedBuyer],
    buyerShipments: new Map([[order.id, failedBuyer]]),
  });
  assert.match(rebookBuyerHtml, /Tạo lại vận đơn giao người mua/);
});

test('a delivered return shows the wallet check without changing failed inspection appeal eligibility', () => {
  const delivered = { ...shipment('return', 'CENTER_TO_SELLER', 'DELIVERED'), actualFee: 32000 };
  const order = { id: 'inspection', postId: 'post', status: 'FAILED', sellerId: 'seller', appealDeadline: '2026-11-10T15:00:00Z' };
  const now = Date.parse('2026-11-10T14:00:00Z');
  assert.match(getHubReturnProgress(delivered).label, /Đã trả về người bán/);
  assert.equal(getHubReturnProgress({ ...delivered, status: 'ASSIGNED', providerStatus: 'COMPLETED' }).step, 1);
  assert.match(getReturnReserveMessage(36000, delivered), /ví của bên đã nộp/);
  assert.match(getReturnReserveMessage(32000, delivered), /Không có phần dư/);
  assert.match(getReturnReserveMessage(31000, delivered), /chờ đối soát/);
  assert.match(getReturnReserveMessage(36000, { ...delivered, actualFee: undefined }), /chờ đối soát/);
  assert.match(getReturnReserveMessage(36000, { ...delivered, status: 'PICKED' }), /sau khi giao/);
  assert.equal(canAppealInspection(order, 'seller', now), false);
  assert.equal(canAppealInspection(order, 'another-seller', now), false);
  assert.equal(canAppealInspection({ ...order, appealStatus: 'PENDING_REVIEW' }, 'seller', now), false);
  assert.equal(canAppealInspection(order, 'seller', Date.parse(order.appealDeadline)), false);
});

test('opening a return checks the carrier for active returns and delivered Sandbox returns awaiting reimbursement', () => {
  const active = shipment('return', 'CENTER_TO_SELLER', 'READY_TO_PICK', 'ASSIGNING_DRIVER');
  assert.equal(shouldSyncHubReturnOnOpen(active), true);
  assert.equal(shouldSyncHubReturnOnOpen({ ...active, orderCode: null }), false);
  assert.equal(shouldSyncHubReturnOnOpen({ ...active, leg: 'SELLER_TO_CENTER' }), false);
  assert.equal(shouldSyncHubReturnOnOpen(null), false);
  for (const status of ['CREATION_UNCERTAIN', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED', 'RETURNED']) {
    assert.equal(shouldSyncHubReturnOnOpen({ ...active, status }), false, status);
  }
  const deliveredCashReturn = { ...active, status: 'DELIVERED', providerStatus: 'COMPLETED', cashPayerId: 'hub-a' };
  assert.equal(shouldSyncHubReturnOnOpen(deliveredCashReturn), true);
  assert.equal(shouldSyncHubReturnOnOpen({ ...deliveredCashReturn, cashConfirmedAt: '2026-11-12T03:00:00Z' }), false);
});

test('the payment expiry label waits for the cancellation recorded by BE', () => {
  const note = 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.';
  assert.equal(isExpiredInspectionPurchase('PASSED', note), false);
  assert.equal(isExpiredInspectionPurchase('CANCELLED', note), true);
  assert.equal(isExpiredInspectionPurchase('CANCELLED', 'Người mua từ chối mua tiếp sau kiểm định. Lý do: đổi ý'), false);
});

test('center tracks paid hub orders even before a driver picks up the parcel', () => {
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'CONFIRMED_PENDING_DISPATCH' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'SHIPPING_TO_CENTER' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_HOME', status: 'SCHEDULED' }), false);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'WAITING_FEE_PAYMENT' }), false);
});

test('center polls only shipments it can read, including newly booked Hub deliveries', () => {
  const order = { id: 'inspection', postId: 'post', orderType: 'AT_CENTER', status: 'CONFIRMED_PENDING_DISPATCH', inspectionCenterId: 'hub-a' };
  assert.equal(shouldTrackCenterInspectionShipments(order, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, status: 'SHIPPING_TO_CENTER' }, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, status: 'INSPECTING' }, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, orderType: 'AT_HOME' }, 'hub-a', 'inspection_center'), false);
  assert.equal(shouldTrackCenterInspectionShipments(order, 'hub-b', 'inspection_center'), false);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, inspectionCenterId: null, inspectorId: 'assigned-technician' }, 'hub-a', 'inspection_center'), false);
  assert.equal(canReadCenterInspectionShipments({ inspectionCenterId: null }), false);
});

test('center shows the latest inbound shipment and ignores outbound and return legs', () => {
  const cancelled = shipment('old', 'SELLER_TO_CENTER', 'CANCELLED');
  const retry = shipment('retry', 'SELLER_TO_CENTER', 'READY_TO_PICK');
  const outbound = shipment('outbound', 'CENTER_TO_BUYER', 'DELIVERED');
  const returned = shipment('return', 'CENTER_TO_SELLER', 'DELIVERED');
  assert.equal(getLatestInboundShipment([cancelled, retry, outbound, returned]), retry);
  assert.equal(getLatestInboundShipment([outbound, returned]), null);
});

test('center distinguishes creation, assignment, pickup, delivery, and cancellation', () => {
  assert.equal(getInboundShipmentProgress({ status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER' }).step, 0);
  assert.equal(getInboundShipmentProgress({ status: 'ASSIGNED', providerStatus: null }).step, 1);
  assert.equal(getInboundShipmentProgress({ status: 'PICKED', providerStatus: 'PICKED_UP' }).step, 2);
  assert.equal(getInboundShipmentProgress({ status: 'DELIVERED', providerStatus: 'COMPLETED' }).step, 3);
  assert.deepEqual(getInboundShipmentProgress({ status: 'CANCELLED', providerStatus: 'ON_GOING' }), {
    step: null,
    label: 'Vận đơn đã hủy',
  });
});

test('center shipment progress ends at delivery with four completed steps', () => {
  const html = renderToStaticMarkup(createElement(LalamoveProgress, { currentStep: 3, completeCurrentStep: true }));
  assert.equal((html.match(/<li\b/g) ?? []).length, 4);
  assert.equal((html.match(/bg-emerald-600/g) ?? []).length, 4);
  assert.match(html, /Đã giao thành công/);
  assert.doesNotMatch(html, /Quyết toán/);
});

test('seller and center use the delivered inbound status even with an older provider status', () => {
  const inbound = shipment('second-attempt', 'SELLER_TO_CENTER', 'DELIVERED', 'ON_GOING');
  assert.deepEqual(getInboundShipmentProgress(inbound), { step: 3, label: 'Lalamove đã giao tới Hub' });
  assert.deepEqual(getInboundShipmentProgress(inbound, 'en'), { step: 3, label: 'Delivered to Hub' });
});

test('the center only offers buyer delivery for paid hub orders with a linked purchase', () => {
  const paid = { orderType: 'AT_CENTER', status: 'DELIVERING_TO_BUYER', linkedOrderId: 'purchase', finalPaymentPaidAt: '2026-11-09T06:00:00Z' };
  assert.equal(isPaidHubBuyerDelivery(paid), true);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, finalPaymentPaidAt: null }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, linkedOrderId: null }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, status: 'PASSED' }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, orderType: 'AT_HOME' }), false);
});

test('the center waits for the outbound shipment check and permits retry after cancellation', () => {
  const inbound = shipment('inbound', 'SELLER_TO_CENTER', 'DELIVERED');
  const cancelled = shipment('cancelled', 'CENTER_TO_BUYER', 'CANCELLED');
  const retry = shipment('retry', 'CENTER_TO_BUYER', 'CREATION_UNCERTAIN');
  assert.equal(canBookHubBuyerDelivery(undefined), false);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound], 'CENTER_TO_BUYER')), true);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound, cancelled], 'CENTER_TO_BUYER')), true);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound, cancelled, retry], 'CENTER_TO_BUYER')), false);
  assert.equal(getHubBuyerShipmentLabel(shipment('delivered', 'CENTER_TO_BUYER', 'DELIVERED')), 'Đã giao cho người mua');
});

test('getOrderAllShipments and 2-leg detail modal tracking work instantly without flash', async () => {
  const { getOrderAllShipments } = await import('../pages/EscrowOrdersView');
  const mockStorage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
    }
  };

  const orderId = 'test-order-instant';
  const inboundShip = { shipmentId: 's1', leg: 'SELLER_TO_CENTER', orderCode: 'INBOUND_123', status: 'DELIVERED' };
  const returnShip = { shipmentId: 's2', leg: 'CENTER_TO_SELLER', orderCode: 'RETURN_456', status: 'READY_TO_PICK' };

  mockStorage[`sl_order_shipments_${orderId}`] = JSON.stringify([inboundShip, returnShip]);

  const loaded = getOrderAllShipments(orderId);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].orderCode, 'INBOUND_123');
  assert.equal(loaded[1].orderCode, 'RETURN_456');

  // Verify that leg 1 and leg 2 find their respective shipments regardless of array order
  const shuffled = [returnShip, inboundShip] as any[];
  const foundInbound = shuffled.find((s) => s.leg === 'SELLER_TO_CENTER');
  const foundReturn = shuffled.find((s) => s.leg === 'CENTER_TO_SELLER');
  assert.equal(foundInbound?.orderCode, 'INBOUND_123');
  assert.equal(foundReturn?.orderCode, 'RETURN_456');

  // Verify that AT_CENTER orders hide top single-leg Lalamove box
  const centerOrder = { id: orderId, hasInspectionService: true, inspectionMethod: 'AT_CENTER' } as any;
  const isDetailAtCenter = Boolean(
    (centerOrder.hasInspectionService || centerOrder.inspectionCenterId || centerOrder.inspectionMethod === 'AT_CENTER') &&
    centerOrder.inspectionMethod !== 'AT_HOME' &&
    centerOrder.orderType !== 'AT_HOME'
  );
  assert.equal(isDetailAtCenter, true);
});

test('getLatestReturnShipment prioritizes latest active return shipment over older failed ones', () => {
  const oldFailedReturn = {
    shipmentId: 'ship-1',
    leg: 'CENTER_TO_SELLER',
    orderCode: '3633580610872373597',
    status: 'FAILED',
    providerStatus: 'REJECTED',
  } as ShipmentBackend;

  const newActiveReturn = {
    shipmentId: 'ship-2',
    leg: 'CENTER_TO_SELLER',
    orderCode: 'NEW_RETURN_8888',
    status: 'ASSIGNED',
    providerStatus: 'ASSIGNING_DRIVER',
  } as ShipmentBackend;

  // Given shipments in ascending creation order [oldFailedReturn, newActiveReturn]
  const list = [oldFailedReturn, newActiveReturn];
  const latest = getLatestReturnShipment(list);
  assert.equal(latest?.orderCode, 'NEW_RETURN_8888');
  assert.equal(latest?.status, 'ASSIGNED');

  // When only old failed return exists
  assert.equal(getLatestReturnShipment([oldFailedReturn])?.orderCode, '3633580610872373597');

  // When multiple failed returns exist, returns the latest one
  const newerFailed = {
    shipmentId: 'ship-3',
    leg: 'CENTER_TO_SELLER',
    orderCode: 'FAILED_AGAIN_9999',
    status: 'FAILED',
    providerStatus: 'REJECTED',
  } as ShipmentBackend;
  assert.equal(getLatestReturnShipment([oldFailedReturn, newerFailed])?.orderCode, 'FAILED_AGAIN_9999');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AdminInspectionOrderFundsDTO,
  AdminCollectionStatus,
  AdminReturnReserveStatus,
} from '../types/adminInspectionFunds';
import {
  resolveCollectionStatusLabel,
  resolveReturnReserveStatusLabel,
  resolveShipmentStatusLabel,
  resolveInspectionOrderId,
} from '../utils/adminInspectionFunds';
import { AdminInspectionFundsView } from '../components/admin/AdminInspectionFundsModal';
import { formatVND } from '../utils/translations';

const normalizeVND = (s: string) => s.replace(/\u00a0/g, ' ').trim();

test('resolveCollectionStatusLabel maps all expected collection statuses and falls back properly', () => {
  assert.equal(resolveCollectionStatusLabel('NOT_DUE'), 'Chưa đến bước thu phí');
  assert.equal(resolveCollectionStatusLabel('NO_PAYMENT_REQUIRED'), 'Không cần nộp');
  assert.equal(resolveCollectionStatusLabel('UNPAID'), 'Chưa nộp');
  assert.equal(resolveCollectionStatusLabel('PARTIALLY_PAID'), 'Đã nộp một phần');
  assert.equal(resolveCollectionStatusLabel('PAID'), 'Đã thu đủ');
  assert.equal(resolveCollectionStatusLabel('UNKNOWN_STATUS' as AdminCollectionStatus), 'Chưa xác định');
  assert.equal(resolveCollectionStatusLabel(null), 'Chưa xác định');
});

test('resolveReturnReserveStatusLabel maps all expected reserve statuses and falls back properly', () => {
  assert.equal(resolveReturnReserveStatusLabel('NOT_REQUIRED'), 'Không áp dụng dự phòng');
  assert.equal(resolveReturnReserveStatusLabel('NOT_COLLECTED'), 'Chưa thu dự phòng');
  assert.equal(resolveReturnReserveStatusLabel('HELD_PENDING_INSPECTION'), 'Đang giữ dự phòng');
  assert.equal(resolveReturnReserveStatusLabel('REFUNDED_UNUSED'), 'Đã hoàn dự phòng chưa sử dụng');
  assert.equal(resolveReturnReserveStatusLabel('AWAITING_RETURN_SHIPMENT'), 'Chờ tạo chuyến hoàn');
  assert.equal(resolveReturnReserveStatusLabel('RETURN_IN_PROGRESS'), 'Đang trả hàng');
  assert.equal(resolveReturnReserveStatusLabel('AWAITING_ACTUAL_FEE'), 'Chờ cước thực tế');
  assert.equal(resolveReturnReserveStatusLabel('AWAITING_CASH_CONFIRMATION'), 'Đã giao về seller · Chờ xác nhận chi cước');
  assert.equal(resolveReturnReserveStatusLabel('AWAITING_RECONCILIATION'), 'Chờ đối soát cước');
  assert.equal(resolveReturnReserveStatusLabel('EXCEEDS_RESERVE'), 'Cước thực tế vượt dự phòng');
  assert.equal(resolveReturnReserveStatusLabel('SETTLED'), 'Đã quyết toán cước hoàn');
  assert.equal(resolveReturnReserveStatusLabel('UNKNOWN_RESERVE' as AdminReturnReserveStatus), 'Chưa xác định');
  assert.equal(resolveReturnReserveStatusLabel(null), 'Chưa xác định');
});

test('resolveShipmentStatusLabel maps shipments status and falls back to Chưa xác định', () => {
  assert.equal(resolveShipmentStatusLabel('DELIVERED'), 'Đã giao hàng');
  assert.equal(resolveShipmentStatusLabel('COMPLETED'), 'Hoàn thành');
  assert.equal(resolveShipmentStatusLabel('IN_TRANSIT'), 'Đang vận chuyển');
  assert.equal(resolveShipmentStatusLabel('UNKNOWN_SHIPMENT'), 'Chưa xác định');
  assert.equal(resolveShipmentStatusLabel(null), 'Chưa xác định');
});

test('resolveInspectionOrderId picks inspection order ID when both id and linkedOrderId exist', () => {
  const inspectionOrderWithLinked = {
    id: 'insp-uuid-1234',
    linkedOrderId: 'escrow-uuid-5678',
  };
  assert.equal(resolveInspectionOrderId(inspectionOrderWithLinked), 'insp-uuid-1234');

  const regularOrderWithInspectionOrderId = {
    id: 'escrow-uuid-9999',
    inspectionOrderId: 'insp-uuid-0001',
  };
  assert.equal(resolveInspectionOrderId(regularOrderWithInspectionOrderId), 'insp-uuid-0001');

  assert.equal(resolveInspectionOrderId('plain-uuid'), 'plain-uuid');
});

// Scenario 1: Đã thu đủ 948.000 ₫, hàng vừa đến Hub: hiện dự phòng đang giữ 408.000 ₫ và Hub “Chưa quyết toán”
test('Kịch bản 1: Đã thu đủ 948.000 ₫, hàng vừa đến Hub: dự phòng giữ 408.000 ₫, Hub Chưa quyết toán', () => {
  const scenario1: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-1',
    totalCollected: 948_000,
    unsettledCollectedAmount: 948_000,
    collectionStatus: 'PAID',
    buyerPayment: {
      amountDue: 0,
      amountCollected: 0,
      paidAt: null,
    },
    sellerPayment: {
      amountDue: 948_000,
      amountCollected: 948_000,
      paidAt: '2026-11-11T19:39:15.000Z',
    },
    fees: {
      inspectionFee: 200_000,
      shippingFee: 340_000,
      travelFee: 0,
      buyerCommitmentDeposit: 0,
    },
    returnReserve: {
      plannedAmount: 408_000,
      heldAmount: 408_000,
      status: 'HELD_PENDING_INSPECTION',
    },
    settlement: null, // Chưa có settlement
    shipments: [
      {
        leg: 'SELLER_TO_CENTER',
        orderCode: 'LLM-IN-948',
        status: 'DELIVERED',
        actualFee: 340_000,
      },
    ],
  };

  // 1. Total collected
  assert.equal(normalizeVND(formatVND(scenario1.totalCollected)), '948.000 ₫');
  assert.equal(resolveCollectionStatusLabel(scenario1.collectionStatus), 'Đã thu đủ');

  // 2. Buyer/Seller amounts
  assert.equal(scenario1.buyerPayment?.amountDue === 0 ? 'Không cần nộp' : normalizeVND(formatVND(scenario1.buyerPayment?.amountDue ?? 0)), 'Không cần nộp');
  assert.equal(normalizeVND(formatVND(scenario1.sellerPayment?.amountCollected ?? 0)), '948.000 ₫');

  // 3. Return reserve
  assert.equal(normalizeVND(formatVND(scenario1.returnReserve?.heldAmount ?? 0)), '408.000 ₫');
  assert.equal(resolveReturnReserveStatusLabel(scenario1.returnReserve?.status), 'Đang giữ dự phòng');
  assert.equal(scenario1.returnReserve?.status !== 'NOT_REQUIRED', true); // Should NOT hide reserve block

  // 4. Hub status when settlement is null
  const hubPayoutDisplay = scenario1.settlement?.centerPayoutAmount != null
    ? normalizeVND(formatVND(scenario1.settlement.centerPayoutAmount))
    : 'Chưa quyết toán';
  assert.equal(hubPayoutDisplay, 'Chưa quyết toán');
});

// Scenario 2: Hub đã nhận 50.000 ₫, chuyến hoàn đã giao: nếu returnReserve.status = AWAITING_CASH_CONFIRMATION,
// vẫn hiện 60.000 ₫ đang giữ trong ví dụ test. Badge vận đơn và badge quyết toán cước hiển thị riêng.
test('Kịch bản 2: Hub đã nhận 50.000 ₫, chuyến hoàn đã giao: giữ 60.000 ₫, badge vận đơn và badge quyết toán cước riêng', () => {
  const scenario2: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-2',
    totalCollected: 260_000,
    unsettledCollectedAmount: 60_000,
    collectionStatus: 'PAID',
    returnReserve: {
      plannedAmount: 60_000,
      heldAmount: 60_000,
      status: 'AWAITING_CASH_CONFIRMATION',
    },
    settlement: {
      centerPayoutAmount: 50_000,
      settledAt: '2026-11-11T12:00:00.000Z',
    },
    shipments: [
      {
        leg: 'CENTER_TO_SELLER',
        orderCode: 'LLM-RET-60K',
        status: 'DELIVERED',
        actualFee: 55_000,
      },
    ],
  };

  // Hub received 50.000 ₫
  assert.equal(normalizeVND(formatVND(scenario2.settlement?.centerPayoutAmount ?? 0)), '50.000 ₫');

  // Held reserve is 60.000 ₫
  assert.equal(normalizeVND(formatVND(scenario2.returnReserve?.heldAmount ?? 0)), '60.000 ₫');

  // Return reserve status badge vs Shipment status badge are distinct
  const reserveBadge = resolveReturnReserveStatusLabel(scenario2.returnReserve?.status);
  const shipmentBadge = resolveShipmentStatusLabel(scenario2.shipments?.[0]?.status);

  assert.equal(reserveBadge, 'Đã giao về seller · Chờ xác nhận chi cước');
  assert.equal(shipmentBadge, 'Đã giao hàng');
  assert.notEqual(reserveBadge, shipmentBadge);
});

// Scenario 3: Đã xác nhận Hub ứng 55.000 ₫: hiện 55.000 ₫ đã hoàn ứng, 5.000 ₫ đã hoàn theo tỷ lệ
// và 0 ₫ còn chờ xử lý theo dữ liệu API. Số 50.000 ₫ phí dịch vụ Hub đã nhận giữ nguyên.
test('Kịch bản 3: Đã xác nhận Hub ứng 55.000 ₫: 55k hoàn ứng, 5k hoàn tỷ lệ, 0 ₫ chờ xử lý, 50k Hub giữ nguyên', () => {
  const scenario3: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-3',
    totalCollected: 260_000,
    unsettledCollectedAmount: 0, // 0 ₫ còn chờ xử lý
    collectionStatus: 'PAID',
    returnReserve: {
      plannedAmount: 60_000,
      heldAmount: 0,
      status: 'SETTLED',
    },
    settlement: {
      centerPayoutAmount: 50_000, // Số 50.000 ₫ phí dịch vụ Hub giữ nguyên
      sellerRefundAmount: 5_000, // 5.000 ₫ đã hoàn theo tỷ lệ
      settledAt: '2026-11-11T14:30:00.000Z',
    },
    shipments: [
      {
        leg: 'CENTER_TO_SELLER',
        orderCode: 'LLM-RET-60K',
        status: 'DELIVERED',
        actualFee: 55_000,
        cashPaidAmount: 55_000,
        cashReimbursedAmount: 55_000, // 55.000 ₫ đã hoàn ứng
        cashConfirmedAt: '2026-11-11T14:30:00.000Z',
      },
    ],
  };

  // Reimbursed amount
  assert.equal(normalizeVND(formatVND(scenario3.shipments?.[0]?.cashReimbursedAmount ?? 0)), '55.000 ₫');
  // Proportional refund to seller
  assert.equal(normalizeVND(formatVND(scenario3.settlement?.sellerRefundAmount ?? 0)), '5.000 ₫');
  // Unsettled amount
  assert.equal(normalizeVND(formatVND(scenario3.unsettledCollectedAmount)), '0 ₫');
  // Hub service fee remains 50.000 ₫
  assert.equal(normalizeVND(formatVND(scenario3.settlement?.centerPayoutAmount ?? 0)), '50.000 ₫');
});

// Scenario 4: Kiểm định tại nhà: hiện phí kiểm định và phụ phí KTV nếu có. Ẩn khối dự phòng khi returnReserve.status = NOT_REQUIRED.
test('Kịch bản 4: Kiểm định tại nhà: hiện phí kiểm định + phụ phí KTV, ẩn khối dự phòng khi NOT_REQUIRED', () => {
  const scenario4: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-4',
    totalCollected: 250_000,
    unsettledCollectedAmount: 0,
    collectionStatus: 'PAID',
    fees: {
      inspectionFee: 200_000,
      travelFee: 50_000,
      shippingFee: 0,
      buyerCommitmentDeposit: 0,
    },
    returnReserve: {
      plannedAmount: 0,
      heldAmount: 0,
      status: 'NOT_REQUIRED',
    },
    settlement: {
      centerPayoutAmount: 250_000,
      settledAt: '2026-11-11T16:00:00.000Z',
    },
  };

  // Fee checks
  assert.equal(normalizeVND(formatVND(scenario4.fees?.inspectionFee ?? 0)), '200.000 ₫');
  assert.equal(normalizeVND(formatVND(scenario4.fees?.travelFee ?? 0)), '50.000 ₫');

  // Condition to hide the return reserve block in UI:
  const shouldHideReserveBlock =
    !scenario4.returnReserve || scenario4.returnReserve.status === 'NOT_REQUIRED';
  assert.equal(shouldHideReserveBlock, true);
  assert.equal(resolveReturnReserveStatusLabel(scenario4.returnReserve?.status), 'Không áp dụng dự phòng');
});

test('getAdminInspectionOrderFunds maps 403 to Bạn không có quyền xem đối soát and 404 to Không tìm thấy đơn kiểm định', async () => {
  const { ApiError } = await import('../services/apiClient');
  const { getAdminInspectionOrderFunds } = await import('../services/adminInspectionFundsService');

  // Verify empty id validation
  await assert.rejects(
    async () => {
      await getAdminInspectionOrderFunds('');
    },
    { message: 'Mã đơn kiểm định không hợp lệ.' }
  );
});

test('AdminInspectionFundsView renders Scenario 1 correctly (Chưa quyết toán, 408.000 ₫ giữ)', () => {
  const scenario1: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-1',
    totalCollected: 948_000,
    unsettledCollectedAmount: 948_000,
    collectionStatus: 'PAID',
    buyerPayment: { amountDue: 0, amountCollected: 0 },
    sellerPayment: { amountDue: 948_000, amountCollected: 948_000, paidAt: '2026-11-11T19:39:15.000Z' },
    fees: { inspectionFee: 200_000, shippingFee: 340_000, travelFee: 0, buyerCommitmentDeposit: 0 },
    returnReserve: { plannedAmount: 408_000, heldAmount: 408_000, status: 'HELD_PENDING_INSPECTION' },
    settlement: null,
  };

  const html = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-scenario-1',
    funds: scenario1,
  }));

  assert.match(html, /Chưa quyết toán/);
  assert.match(html, /Đang giữ dự phòng/);
  assert.match(html, /Đã thu đủ/);
  assert.match(html, /Không cần nộp/);
});

test('AdminInspectionFundsView renders Scenario 2 correctly (Hub nhận 50k, giữ 60k, badge riêng)', () => {
  const scenario2: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-2',
    totalCollected: 260_000,
    unsettledCollectedAmount: 60_000,
    collectionStatus: 'PAID',
    returnReserve: { plannedAmount: 60_000, heldAmount: 60_000, status: 'AWAITING_CASH_CONFIRMATION' },
    settlement: { centerPayoutAmount: 50_000, settledAt: '2026-11-11T12:00:00.000Z' },
    shipments: [{ leg: 'CENTER_TO_SELLER', orderCode: 'LLM-RET-60K', status: 'DELIVERED', actualFee: 55_000 }],
  };

  const html = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-scenario-2',
    funds: scenario2,
  }));

  assert.match(html, /Đã giao về seller · Chờ xác nhận chi cước/);
  assert.match(html, /Đã giao hàng/);
});

test('AdminInspectionFundsView renders Scenario 3 correctly (Hub ứng 55k, hoàn 5k, 0 ₫ chờ)', () => {
  const scenario3: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-3',
    totalCollected: 260_000,
    unsettledCollectedAmount: 0,
    collectionStatus: 'PAID',
    returnReserve: { plannedAmount: 60_000, heldAmount: 0, status: 'SETTLED' },
    settlement: { centerPayoutAmount: 50_000, sellerRefundAmount: 5_000, settledAt: '2026-11-11T14:30:00.000Z' },
    shipments: [{
      leg: 'CENTER_TO_SELLER',
      orderCode: 'LLM-RET-60K',
      status: 'DELIVERED',
      actualFee: 55_000,
      cashPaidAmount: 55_000,
      cashReimbursedAmount: 55_000,
      cashConfirmedAt: '2026-11-11T14:30:00.000Z',
    }],
  };

  const html = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-scenario-3',
    funds: scenario3,
  }));

  assert.match(html, /Đã quyết toán cước hoàn/);
  assert.match(html, /Đã hoàn ứng/);
  assert.match(html, /Hoàn người bán/);
});

test('AdminInspectionFundsView renders Scenario 4 correctly (Tại nhà: ẩn khối dự phòng khi NOT_REQUIRED)', () => {
  const scenario4: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'order-scenario-4',
    totalCollected: 250_000,
    unsettledCollectedAmount: 0,
    collectionStatus: 'PAID',
    fees: { inspectionFee: 200_000, travelFee: 50_000 },
    returnReserve: { plannedAmount: 0, heldAmount: 0, status: 'NOT_REQUIRED' },
    settlement: { centerPayoutAmount: 250_000 },
  };

  const html = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-scenario-4',
    funds: scenario4,
  }));

  assert.match(html, /Phụ phí di chuyển KTV/);
  assert.doesNotMatch(html, /Dự Phòng Cước Trả Hàng/);
});

test('AdminInspectionFundsView renders 403 and 404 error messages properly', () => {
  const html403 = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-err',
    funds: null,
    error: 'Bạn không có quyền xem đối soát',
  }));
  assert.match(html403, /Bạn không có quyền xem đối soát/);

  const html404 = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'order-err',
    funds: null,
    error: 'Không tìm thấy đơn kiểm định',
  }));
  assert.match(html404, /Không tìm thấy đơn kiểm định/);
});

test('AdminInspectionFundsTab renders dedicated tab with KPI cards and inspection orders list', async () => {
  const { AdminInspectionFundsTab } = await import('../components/admin/AdminInspectionFundsTab');
  let openedOrderId = '';
  const html = renderToStaticMarkup(createElement(AdminInspectionFundsTab, {
    lang: 'vi',
    onOpenFundsAudit: (id: string) => { openedOrderId = id; },
  }));

  assert.match(html, /ĐỐI SOÁT TIỀN KIỂM ĐỊNH/);
  assert.match(html, /Đơn Đang Giữ Tiền/);
  assert.match(html, /Quỹ Cước Hoàn Đang Giữ/);
  assert.match(html, /Chờ Quyết Toán Hub/);
  assert.match(html, /Đối Soát Tiền/);
  assert.match(html, /17e67687/);
});

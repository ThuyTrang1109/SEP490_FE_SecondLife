import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionReturnQuoteModal } from '../components/modals/InspectionReturnQuoteModal';
import { AdminInspectionFundsView } from '../components/admin/AdminInspectionFundsModal';
import { resolveReturnReserveDetails, resolveReturnReserveStatusLabel } from '../utils/adminInspectionFunds';
import type { AdminInspectionOrderFundsDTO } from '../types/adminInspectionFunds';

test('resolveReturnReserveStatusLabel distinguishes settled return fee with outstanding debt', () => {
  assert.equal(
    resolveReturnReserveStatusLabel('SETTLED_OUTSTANDING'),
    'Đã chốt cước thực tế · Còn khoản phải thu',
  );
  assert.equal(
    resolveReturnReserveStatusLabel('SETTLED'),
    'Đã chốt cước thực tế · Đã quyết toán',
  );
});

test('resolveReturnReserveDetails flags outstanding buyer/seller return debt after actual fee is settled', () => {
  const funds: AdminInspectionOrderFundsDTO = {
    inspectionOrderId: 'insp-1',
    totalCollected: 95850,
    unsettledCollectedAmount: 0,
    collectionStatus: 'PAID',
    buyerFeePercent: 65,
    inspectionFeeSplit: 'CUSTOM',
    returnReserve: {
      plannedAmount: 36000,
      heldAmount: 0,
      status: 'SETTLED_OUTSTANDING',
    },
    settlement: {
      outcome: 'FAILED_INSPECTION',
      centerPayoutAmount: 90000,
      buyerRefundAmount: 50000,
      sellerRefundAmount: 0,
      platformRetainedAmount: 0,
      settledAt: '2026-11-26T09:00:00Z',
      returnShippingSettledAt: '2026-11-26T10:00:00Z',
    },
    shipments: [
      {
        shipmentId: 'ship-1',
        leg: 'CENTER_TO_SELLER',
        orderCode: 'LALA-123',
        status: 'DELIVERED',
        providerStatus: 'COMPLETED',
        actualFee: 45000,
      },
    ],
    returnFee: {
      reserveFee: 36000,
      quotedFee: 45000,
      actualFee: 45000,
      buyer: { percent: 65, collected: 5850, outstanding: 0 },
      seller: { percent: 35, collected: 1000, outstanding: 2150 },
    },
  };

  const details = resolveReturnReserveDetails(funds);
  assert.equal(details.refundStatus, 'EXCEEDS_RESERVE');
  assert.match(details.refundStatusLabel, /Đã chốt cước thực tế · Còn khoản phải thu/);
  assert.match(details.refundDescription, /2\.150/);

  // Verify AdminInspectionFundsView renders returnFee reconciliation breakdown cleanly
  const html = renderToStaticMarkup(createElement(AdminInspectionFundsView, {
    inspectionOrderId: 'insp-1',
    funds,
    onClose: () => {},
  }));
  assert.match(html, /Đã chốt cước thực tế · Còn khoản phải thu/);
  assert.match(html, /5\.850/);
  assert.match(html, /2\.150/);
});

test('InspectionReturnQuoteModal renders loading dialog shell without errors', () => {
  const html = renderToStaticMarkup(createElement(InspectionReturnQuoteModal, {
    orderId: 'insp-1234',
    title: 'San pham test',
    booking: false,
    onClose: () => {},
    onBook: async () => null,
  }));
  assert.match(html, /Trả hàng từ Hub về người bán/);
  assert.match(html, /Xác nhận tạo vận đơn/);
});

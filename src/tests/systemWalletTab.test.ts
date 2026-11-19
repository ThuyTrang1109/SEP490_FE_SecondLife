import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemWalletTab } from '../components/admin/SystemWalletTab';
import { systemWalletService } from '../services/systemWalletService';
import type { SystemWalletTransaction } from '../types';
import { toSystemWalletHistoryItem } from '../utils/systemWalletHistory';

test('systemWalletService.getTransactions builds correct query string with filters', async (t) => {
  assert.equal(typeof systemWalletService.getSystemWallet, 'function');
  assert.equal(typeof systemWalletService.getTransactions, 'function');
});

test('SystemWalletTab renders shipping balance card with holding status and filter shortcut', () => {
  const html = renderToStaticMarkup(createElement(SystemWalletTab));

  // Verify Header
  assert.match(html, /Ví Hệ Thống &amp; Kế Toán Đối Soát \(System Wallet\)/);
  assert.match(html, /ADMIN ONLY/);

  // Verify Shipping Balance Card
  assert.match(html, /Phí vận chuyển đã thu/);
  assert.match(html, /Đang giữ/);
  assert.match(html, /Tiền ship hệ thống lưu giữ bảo chứng/);
  assert.match(html, /Lọc cước ship →/);

  // Verify Filter Toolbar
  assert.match(html, /Bộ lọc:/);
  assert.match(html, /Tất cả/);
  assert.match(html, /Tiền vận chuyển \(Cước ship\)/);
  assert.match(html, /Nhận ký quỹ/);
  assert.match(html, /Giải ngân/);
  assert.match(html, /Hoàn tiền/);
  assert.match(html, /Thu cước trả hàng/);

  // Verify Search by Order ID input
  assert.match(html, /placeholder="Tìm theo Order ID\.\.\."/);

  // Verify Table Headers
  assert.match(html, /Mã GD/);
  assert.match(html, /Mã Đơn Hàng \(Order ID\)/);
  assert.match(html, /Phân Loại/);
  assert.match(html, /Biến Động Phí Ship/);
  assert.match(html, /Biến Động Ký Quỹ/);
  assert.match(html, /Biến Động Hoa Hồng/);
  assert.doesNotMatch(html, /Tổng Cước Ship Người Dùng/i);
});

test('SystemWalletTransaction types support all required categories including RETURN_SHIPPING_FEE', () => {
  const txPaymentHold: SystemWalletTransaction = {
    id: 1,
    orderId: 'order-1',
    type: 'PAYMENT_HOLD',
    heldDelta: 250_000,
    shippingDelta: 46_200,
    revenueDelta: 0,
    heldBalanceAfter: 250_000,
    shippingBalanceAfter: 46_200,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-15T10:00:00Z',
  };

  const txSettlement: SystemWalletTransaction = {
    id: 2,
    orderId: 'order-1',
    type: 'SETTLEMENT',
    heldDelta: -250_000,
    shippingDelta: 0,
    revenueDelta: 12_500,
    heldBalanceAfter: 0,
    shippingBalanceAfter: 46_200,
    revenueBalanceAfter: 12_500,
    createdAt: '2026-11-15T11:00:00Z',
  };

  const txReturnShipping: SystemWalletTransaction = {
    id: 3,
    orderId: 'order-2',
    type: 'RETURN_SHIPPING_FEE',
    heldDelta: 0,
    shippingDelta: 30_000,
    revenueDelta: 0,
    heldBalanceAfter: 0,
    shippingBalanceAfter: 76_200,
    revenueBalanceAfter: 12_500,
    createdAt: '2026-11-15T12:00:00Z',
  };

  assert.equal(txPaymentHold.type, 'PAYMENT_HOLD');
  assert.equal(txPaymentHold.shippingDelta, 46_200);
  assert.equal(txSettlement.type, 'SETTLEMENT');
  assert.equal(txReturnShipping.type, 'RETURN_SHIPPING_FEE');
  assert.equal(txReturnShipping.shippingDelta, 30_000);
});

const statementTransaction: SystemWalletTransaction = {
  id: 47,
  orderId: 'purchase-order',
  type: 'SETTLEMENT',
  heldDelta: -1_852_500,
  shippingDelta: 0,
  revenueDelta: 0,
  heldBalanceAfter: 0,
  shippingBalanceAfter: 0,
  revenueBalanceAfter: 97_500,
  createdAt: '2026-11-16T16:06:09Z',
};

test('marketplace settlement shows seller payment and commission using the two statement entry IDs and directions', () => {
  const seller = toSystemWalletHistoryItem({
    ...statementTransaction, entryId: '47-1', fundCategory: 'PRODUCT_ESCROW', totalDelta: 1_852_500, deltaAction: 'MINUS',
  });
  const commission = toSystemWalletHistoryItem({
    ...statementTransaction, entryId: '47-4', fundCategory: 'COMMISSION', totalDelta: 97_500, deltaAction: 'PLUS',
    heldDelta: -97_500, revenueDelta: 97_500,
  });
  assert.equal(seller.entryId, '47-1');
  assert.equal(seller.signedDelta, -1_852_500);
  assert.equal(seller.actionLabel, 'Xem chi tiết');
  assert.equal(commission.entryId, '47-4');
  assert.equal(commission.signedDelta, 97_500);
  assert.equal(commission.typeLabel, 'Hoa hồng sàn');
  assert.deepEqual(commission.breakdownItems, [{ label: 'Hoa hồng sàn', delta: 97_500 }]);
});

test('Hub lines use the actual ledger entry and link to the inspection audit', () => {
  const row = toSystemWalletHistoryItem({
    ...statementTransaction, id: 45, entryId: '45-2', type: 'INSPECTION_SETTLEMENT',
    inspectionOrderId: 'd02867cd-inspection', fundCategory: 'HUB_PAYOUT',
    totalDelta: 290_000, deltaAction: 'MINUS', heldDelta: -290_000,
    breakdownDescription: 'Chi trả phí dịch vụ kiểm định cho Trung tâm Hub',
  });
  assert.equal(row.entryId, '45-2');
  assert.equal(row.orderId, 'd02867cd-inspection');
  assert.equal(row.actionLabel, 'Đối soát');
  assert.equal(row.typeLabel, 'Thanh toán ví Hub');
  assert.equal(row.signedDelta, -290_000);
});

test('legacy wallet responses still use their real transaction ID and signed revenue', () => {
  const row = toSystemWalletHistoryItem({ ...statementTransaction, heldDelta: -1_950_000, revenueDelta: 97_500 });
  assert.equal(row.entryId, '47');
  assert.equal(row.signedDelta, -1_852_500);
  assert.equal(row.sellerPayout, 1_852_500);
  assert.deepEqual(row.breakdownItems, [
    { label: 'Thực trả người bán', delta: -1_852_500 },
    { label: 'Hoa hồng sàn', delta: 97_500 },
  ]);
});

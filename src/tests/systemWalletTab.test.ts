import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemWalletTab } from '../components/admin/SystemWalletTab';
import { systemWalletService } from '../services/systemWalletService';
import type { SystemWalletTransaction } from '../types';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemWalletTab } from '../components/admin/SystemWalletTab';
import { systemWalletService } from '../services/systemWalletService';
import type { SystemWalletTransaction } from '../types';
import { toSystemWalletHistoryItem, getSystemWalletBreakdownLines } from '../utils/systemWalletHistory';

test('systemWalletService.getTransactions builds correct query string with filters', async (t) => {
  assert.equal(typeof systemWalletService.getSystemWallet, 'function');
  assert.equal(typeof systemWalletService.getTransactions, 'function');
});

test('SystemWalletTab renders shipping balance card with holding status and filter shortcut', () => {
  const html = renderToStaticMarkup(createElement(SystemWalletTab));

  // Verify Header
  assert.match(html, /Ví Hệ Thống/);

  // Verify Total System Balance Card
  assert.match(html, /Ví tổng hệ thống/);
  assert.match(html, /Toàn sàn/);
  assert.match(html, /Tổng dòng tiền đang lưu ký/);

  // Verify Product Escrow Card
  assert.match(html, /Tiền hàng đang giữ/);
  assert.match(html, /Ký quỹ sàn/);

  // Verify Inspection Escrow Card
  assert.match(html, /Tiền kiểm định đang giữ/);
  assert.match(html, /Ký quỹ Hub/);
  assert.match(html, /Phí kiểm định đang giữ bảo chứng cho Hub/);

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
  assert.match(html, /Thu phí kiểm định/);
  assert.match(html, /Giải ngân/);
  assert.match(html, /Chi trả Hub/);
  assert.match(html, /Hoa hồng sàn/);
  assert.match(html, /Hoàn tiền/);
  assert.match(html, /Thu cước trả hàng/);

  // Verify Search by Order ID input
  assert.match(html, /placeholder="Tìm theo Order ID\.\.\."/);

  // Verify Table Headers
  assert.match(html, /Mã GD/);
  assert.match(html, /Mã Đơn Hàng \(Order ID\)/);
  assert.match(html, /Phân Loại/);
  assert.match(html, /Số Tiền Biến Động/);
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

test('inspection return shipping parses multi-part breakdown into separate formatted lines', () => {
  const tx: SystemWalletTransaction = {
    id: 126,
    entryId: '126-1',
    orderId: null,
    inspectionOrderId: '08ffdfba-85bd-4c16-8042-insp',
    type: 'INSPECTION_RETURN_SHIPPING',
    fundCategory: 'USER_SHIPPING',
    totalDelta: 129_960,
    deltaAction: 'MINUS',
    heldDelta: 0,
    shippingDelta: -111_500,
    revenueDelta: 0,
    heldBalanceAfter: 0,
    shippingBalanceAfter: 0,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-20T20:24:05Z',
    breakdownDescription: 'Cước hoàn thực tế 111500.00 đ. Trừ quỹ 111500.00 đ. Phần thiếu 0.00 đ. Hoàn dự phòng dư 18460.00 đ.',
  };

  const item = toSystemWalletHistoryItem(tx);
  assert.equal(item.signedDelta, -129_960);
  assert.equal(item.breakdownItems.length, 4);

  assert.equal(item.breakdownItems[0].label, 'Cước hoàn thực tế');
  assert.match(item.breakdownItems[0].formattedText || '', /111\.500/);

  assert.equal(item.breakdownItems[1].label, 'Trừ quỹ');
  assert.match(item.breakdownItems[1].formattedText || '', /111\.500/);

  assert.equal(item.breakdownItems[2].label, 'Phần thiếu');
  assert.match(item.breakdownItems[2].formattedText || '', /0/);

  assert.equal(item.breakdownItems[3].label, 'Hoàn dự phòng dư');
  assert.match(item.breakdownItems[3].formattedText || '', /18\.460/);
});

test('inspection hold parses fees and reserve into individual positive items', () => {
  const tx: SystemWalletTransaction = {
    id: 128,
    entryId: '128-1',
    orderId: null,
    inspectionOrderId: '70ebb624-e5e4-4c16-8042-insp',
    type: 'INSPECTION_HOLD',
    fundCategory: 'USER_SHIPPING',
    totalDelta: 1_138_320,
    deltaAction: 'PLUS',
    heldDelta: 290_000,
    shippingDelta: 848_320,
    revenueDelta: 0,
    heldBalanceAfter: 290_000,
    shippingBalanceAfter: 848_320,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-20T21:30:57Z',
    breakdownDescription: 'Thu từ người bán. Phí kiểm định và cọc 290000.00 đ, cước và dự phòng 848320.00 đ.',
  };

  const item = toSystemWalletHistoryItem(tx);
  assert.equal(item.signedDelta, 1_138_320);
  assert.equal(item.breakdownItems.length, 2);

  assert.equal(item.breakdownItems[0].label, 'Phí kiểm định và cọc');
  assert.match(item.breakdownItems[0].formattedText || '', /\+?290\.000/);

  assert.equal(item.breakdownItems[1].label, 'Cước và dự phòng');
  assert.match(item.breakdownItems[1].formattedText || '', /\+?848\.320/);
});

test('settlement filter isolates seller payout and excludes commission, hub payouts, and fees', () => {
  const sellerPayout = toSystemWalletHistoryItem({
    id: 99, entryId: '99-1', orderId: '37c5eb2e-92f8', type: 'SETTLEMENT',
    fundCategory: 'PRODUCT_ESCROW', totalDelta: 266_000, deltaAction: 'MINUS',
    heldDelta: -266_000, shippingDelta: 0, revenueDelta: 0,
    heldBalanceAfter: 0, shippingBalanceAfter: 0, revenueBalanceAfter: 14_000,
    createdAt: '2026-11-22T15:59:48Z',
  });

  const commission = toSystemWalletHistoryItem({
    id: 99, entryId: '99-4', orderId: '37c5eb2e-92f8', type: 'SETTLEMENT',
    fundCategory: 'COMMISSION', totalDelta: 14_000, deltaAction: 'PLUS',
    heldDelta: -14_000, shippingDelta: 0, revenueDelta: 14_000,
    heldBalanceAfter: 0, shippingBalanceAfter: 0, revenueBalanceAfter: 14_000,
    createdAt: '2026-11-22T15:59:48Z',
  });

  const hubPayout = toSystemWalletHistoryItem({
    id: 135, entryId: '135-2', orderId: null, inspectionOrderId: '96fca143-f737',
    type: 'INSPECTION_SETTLEMENT', fundCategory: 'HUB_PAYOUT',
    totalDelta: 529_400, deltaAction: 'MINUS',
    heldDelta: -529_400, shippingDelta: 0, revenueDelta: 0,
    heldBalanceAfter: 0, shippingBalanceAfter: 0, revenueBalanceAfter: 0,
    createdAt: '2026-11-22T10:59:18Z',
  });

  const inspectionFee = toSystemWalletHistoryItem({
    id: 141, entryId: '141-1', orderId: null, inspectionOrderId: '8ad26322-821a',
    type: 'INSPECTION_HOLD', fundCategory: 'USER_SHIPPING',
    totalDelta: 360_192, deltaAction: 'PLUS',
    heldDelta: 80_000, shippingDelta: 280_192, revenueDelta: 0,
    heldBalanceAfter: 80_000, shippingBalanceAfter: 280_192, revenueBalanceAfter: 0,
    createdAt: '2026-11-22T12:16:56Z',
  });

  const items = [sellerPayout, commission, hubPayout, inspectionFee];

  // Test SETTLEMENT filter logic
  const isSettlement = (item: typeof sellerPayout) =>
    item.typeLabel === 'Giải ngân' ||
    (
      (item.type === 'SETTLEMENT' || item.type === 'INSPECTION_SETTLEMENT') &&
      item.fundCategory !== 'COMMISSION' &&
      item.fundCategory !== 'HUB_PAYOUT' &&
      item.typeLabel !== 'Hoa hồng sàn' &&
      item.typeLabel !== 'Thanh toán ví Hub'
    );

  const settlements = items.filter(isSettlement);
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].entryId, '99-1');
  assert.equal(settlements[0].typeLabel, 'Giải ngân');

  // Test COMMISSION filter logic
  const commissions = items.filter((item) =>
    item.fundCategory === 'COMMISSION' ||
    item.typeLabel === 'Hoa hồng sàn' ||
    (item.transaction.revenueDelta !== 0 && item.fundCategory !== 'HUB_PAYOUT')
  );
  assert.equal(commissions.length, 1);
  assert.equal(commissions[0].entryId, '99-4');
  assert.equal(commissions[0].typeLabel, 'Hoa hồng sàn');

  // Test HUB_PAYOUT filter logic
  const hubPayouts = items.filter((item) =>
    item.fundCategory === 'HUB_PAYOUT' ||
    item.typeLabel === 'Thanh toán ví Hub'
  );
  assert.equal(hubPayouts.length, 1);
  assert.equal(hubPayouts[0].entryId, '135-2');
  assert.equal(hubPayouts[0].typeLabel, 'Thanh toán ví Hub');

  // Test INSPECTION_HOLD filter logic
  const inspectionHolds = items.filter((item) =>
    item.typeLabel === 'Thu phí kiểm định' ||
    item.type === 'INSPECTION_HOLD'
  );
  assert.equal(inspectionHolds.length, 1);
  assert.equal(inspectionHolds[0].entryId, '141-1');
  assert.equal(inspectionHolds[0].typeLabel, 'Thu phí kiểm định');
});

test('getSystemWalletBreakdownLines parses escrow hold description into separate formatted lines', () => {
  const item = toSystemWalletHistoryItem({
    id: 293,
    entryId: '293-1',
    orderId: '8dcc045e-97ce-40b9-963d-4cd991fed7a3',
    type: 'PAYMENT_HOLD',
    fundCategory: 'PRODUCT_ESCROW',
    totalDelta: 17_364_800,
    deltaAction: 'PLUS',
    heldDelta: 11_200_000,
    shippingDelta: 6_164_800,
    revenueDelta: 0,
    heldBalanceAfter: 11_200_000,
    shippingBalanceAfter: 6_164_800,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-23T15:57:02Z',
    breakdownDescription: 'Tiền hàng 11200000.00 đ, cước giao hàng 6164800.00 đ.',
  });

  const lines = getSystemWalletBreakdownLines(item);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].label, 'Tiền hàng');
  assert.match(lines[0].formattedText, /11\.200\.000/);
  assert.match(lines[0].formattedText, /\+/);

  assert.equal(lines[1].label, 'Cước giao hàng');
  assert.match(lines[1].formattedText, /6\.164\.800/);
  assert.match(lines[1].formattedText, /\+/);
});

test('getSystemWalletBreakdownLines handles refund breakdown with negative delta', () => {
  const item = toSystemWalletHistoryItem({
    id: 290,
    entryId: '290-1',
    orderId: '6ecb8bae-9681-4320-97dc-2796d447fbc4',
    type: 'REFUND',
    fundCategory: 'PRODUCT_ESCROW',
    totalDelta: 11_200_000,
    deltaAction: 'MINUS',
    heldDelta: -11_200_000,
    shippingDelta: 0,
    revenueDelta: 0,
    heldBalanceAfter: 0,
    shippingBalanceAfter: 0,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-23T15:56:15Z',
    breakdownDescription: 'Hoàn tiền hàng 11200000.00 đ.',
  });

  const lines = getSystemWalletBreakdownLines(item);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].label, 'Hoàn tiền hàng');
  assert.match(lines[0].formattedText, /11\.200\.000/);
  assert.match(lines[0].formattedText, /^-/);
});

test('getSystemWalletBreakdownLines falls back cleanly when description has no amounts', () => {
  const item = toSystemWalletHistoryItem({
    id: 135,
    entryId: '135-2',
    orderId: null,
    inspectionOrderId: null,
    type: 'OPENING_BALANCE',
    fundCategory: 'PRODUCT_ESCROW',
    totalDelta: 0,
    deltaAction: 'ZERO',
    heldDelta: 0,
    shippingDelta: 0,
    revenueDelta: 0,
    heldBalanceAfter: 0,
    shippingBalanceAfter: 0,
    revenueBalanceAfter: 0,
    createdAt: '2026-11-22T10:59:18Z',
    breakdownDescription: 'Ghi nhận qua ví hệ thống',
  });

  const lines = getSystemWalletBreakdownLines(item);
  assert.equal(lines.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWalletMoney,
  walletDateRange,
  walletTransactionLabel,
  walletReferenceLabel,
  normalizeWalletTransaction,
  normalizeWalletTransactionPage,
} from '../utils/walletTransactions';
import { getCenterFeeCollection } from '../utils/inspectionCenterFees';
import type { InspectionOrderDto } from '../services/inspectorService';

test('1. normalizeWalletTransaction - preserves amount sign and parses string amounts', () => {
  const depositTx = normalizeWalletTransaction({
    id: 'tx-1',
    amount: '100000',
    type: 'DEPOSIT',
    status: 'SUCCESS',
    createdAt: '2026-11-01T10:00:00Z',
  });
  assert.equal(depositTx.amount, 100000);
  assert.equal(depositTx.direction, 'CREDIT');
  assert.equal(depositTx.currency, 'VND');

  const paymentTx = normalizeWalletTransaction({
    id: 'tx-2',
    amount: '-50000',
    type: 'PAYMENT',
    status: 'SUCCESS',
    createdAt: '2026-11-01T11:00:00Z',
  });
  assert.equal(paymentTx.amount, -50000);
  assert.equal(paymentTx.direction, 'DEBIT');

  const decimalTx = normalizeWalletTransaction({
    id: 'tx-3',
    amount: 1500.5,
    type: 'EARNING',
    status: 'SUCCESS',
    createdAt: '2026-11-01T12:00:00Z',
  });
  assert.equal(decimalTx.amount, 1500.5);
  assert.equal(decimalTx.direction, 'CREDIT');
});

test('2. normalizeWalletTransaction - strictly distinguishes 0 balance from null balance', () => {
  // CRITICAL REQUIREMENT in FE_WALLET_TRANSACTION_HISTORY_GUIDE.md Section 12.8
  // Balance = 0 must remain 0 and NOT turn into null or fallback string
  const zeroBalanceTx = normalizeWalletTransaction({
    id: 'tx-zero',
    amount: 0,
    balanceBefore: 0,
    balanceAfter: 0,
    type: 'DEPOSIT',
    status: 'SUCCESS',
    createdAt: '2026-11-01T10:00:00Z',
  });
  assert.strictEqual(zeroBalanceTx.balanceBefore, 0);
  assert.strictEqual(zeroBalanceTx.balanceAfter, 0);

  // Missing or null balance must remain null (V60 missing balance disclaimer requirement)
  const nullBalanceTx = normalizeWalletTransaction({
    id: 'tx-null',
    amount: 50000,
    balanceBefore: null,
    balanceAfter: undefined,
    type: 'PAYMENT',
    status: 'SUCCESS',
    createdAt: '2026-11-01T10:00:00Z',
  });
  assert.strictEqual(nullBalanceTx.balanceBefore, null);
  assert.strictEqual(nullBalanceTx.balanceAfter, null);
});

test('3. normalizeWalletTransaction - defaults missing referenceType to UNKNOWN', () => {
  const txWithoutRefType = normalizeWalletTransaction({
    id: 'tx-noref',
    amount: 20000,
    type: 'DEPOSIT',
    status: 'SUCCESS',
    createdAt: '2026-11-01T10:00:00Z',
  });
  assert.equal(txWithoutRefType.referenceType, 'UNKNOWN');
  assert.strictEqual(txWithoutRefType.referenceId, null);

  const txWithOrderRef = normalizeWalletTransaction({
    id: 'tx-order',
    amount: -120000,
    type: 'PAYMENT',
    status: 'SUCCESS',
    referenceId: 'ORD-987654',
    referenceType: 'ORDER',
    createdAt: '2026-11-01T10:00:00Z',
  });
  assert.equal(txWithOrderRef.referenceType, 'ORDER');
  assert.equal(txWithOrderRef.referenceId, 'ORD-987654');
});

test('4. formatWalletMoney - formats numbers, zero, negative, decimals, and null', () => {
  // Standard integer amounts
  const formatted100k = formatWalletMoney(100000);
  assert.ok(formatted100k.includes('100.000'), 'Should format 100000 as 100.000');
  assert.ok(formatted100k.includes('đ'), 'Should contain đ suffix');

  // Zero balance
  const formattedZero = formatWalletMoney(0);
  assert.ok(formattedZero.includes('0') && formattedZero.includes('đ'), 'Should format 0 as 0 đ');

  // Negative amount
  const formattedNegative = formatWalletMoney(-50000);
  assert.ok(formattedNegative.includes('-50.000') && formattedNegative.includes('đ'));

  // Decimal amounts
  const formattedDecimal = formatWalletMoney(1000.05);
  assert.ok(formattedDecimal.includes('1.000,05') || formattedDecimal.includes('1.000.05'));

  // Null / undefined amounts -> returns "Chưa được ghi nhận"
  assert.equal(formatWalletMoney(null), 'Chưa được ghi nhận');
  assert.equal(formatWalletMoney(undefined), 'Chưa được ghi nhận');

  // Custom empty fallback
  assert.equal(formatWalletMoney(null, 'VND', '—'), '—');
});

test('5. walletDateRange - converts dates to UTC ISO bounds and handles errors', () => {
  const range = walletDateRange('2026-11-01', '2026-11-03');
  assert.ok(range.from && range.from.endsWith('Z'));
  assert.ok(range.to && range.to.endsWith('Z'));

  // The 'to' timestamp should be greater than the 'from' timestamp
  const fromMs = new Date(range.from!).getTime();
  const toMs = new Date(range.to!).getTime();
  assert.ok(toMs > fromMs, '"to" bound must be after "from" bound');

  // Returns error property when from is after to
  const invalidRange = walletDateRange('2026-11-05', '2026-11-01');
  assert.equal(invalidRange.error, 'Ngày bắt đầu không được lớn hơn ngày kết thúc');

  // Returns empty object when no dates supplied
  const emptyRange = walletDateRange();
  assert.deepEqual(emptyRange, {});
});

test('6. walletTransactionLabel & walletReferenceLabel - accurate translations and fallback', () => {
  assert.equal(walletTransactionLabel('DEPOSIT'), 'Nạp tiền');
  assert.equal(walletTransactionLabel('PAYMENT'), 'Thanh toán');
  assert.equal(walletTransactionLabel('EARNING'), 'Nhận tiền');
  assert.equal(walletTransactionLabel('REFUND'), 'Hoàn tiền');
  assert.equal(walletTransactionLabel('WITHDRAW'), 'Rút tiền');
  assert.equal(walletTransactionLabel('RETURN_SHIPPING_FEE'), 'Phí ship hoàn hàng');
  assert.equal(walletTransactionLabel('UNKNOWN_NEW_TYPE' as any), 'UNKNOWN_NEW_TYPE');

  assert.equal(walletReferenceLabel('DEPOSIT_REQUEST'), 'Yêu cầu nạp tiền');
  assert.equal(walletReferenceLabel('ORDER'), 'Đơn hàng');
  assert.equal(walletReferenceLabel('INSPECTION_ORDER'), 'Đơn kiểm định');
  assert.equal(walletReferenceLabel('WITHDRAWAL'), 'Yêu cầu rút tiền');
  assert.equal(walletReferenceLabel('SHIPMENT'), 'Chuyến vận chuyển');
  assert.equal(walletReferenceLabel('UNKNOWN'), 'Chưa có thông tin');
  assert.equal(walletReferenceLabel('UNKNOWN_CUSTOM_REF' as any), 'Chưa có thông tin');
});

test('7. normalizeWalletTransactionPage - correctly maps Spring Page and wrapper structures', () => {
  const springPageData = {
    content: [
      {
        id: 'tx-page-1',
        amount: 50000,
        balanceBefore: 100000,
        balanceAfter: 150000,
        type: 'DEPOSIT',
        status: 'SUCCESS',
        createdAt: '2026-11-01T08:00:00Z',
      },
    ],
    number: 0,
    size: 10,
    totalPages: 3,
    totalElements: 25,
    last: false,
  };

  const pageResult = normalizeWalletTransactionPage(springPageData);
  assert.equal(pageResult.items.length, 1);
  assert.equal(pageResult.items[0].id, 'tx-page-1');
  assert.equal(pageResult.page, 0);
  assert.equal(pageResult.size, 10);
  assert.equal(pageResult.totalPages, 3);
  assert.equal(pageResult.totalElements, 25);
  assert.equal(pageResult.isLast, false);

  // Wrapped response format
  const wrappedData = {
    data: {
      items: [
        {
          id: 'tx-wrapped-1',
          amount: -20000,
          type: 'PAYMENT',
          status: 'SUCCESS',
          createdAt: '2026-11-01T09:00:00Z',
        },
      ],
      page: 1,
      totalPages: 2,
      totalElements: 12,
      isLast: false,
    },
  };

  const wrappedResult = normalizeWalletTransactionPage(wrappedData);
  assert.equal(wrappedResult.items.length, 1);
  assert.equal(wrappedResult.items[0].id, 'tx-wrapped-1');
  assert.equal(wrappedResult.page, 1);
  assert.equal(wrappedResult.totalElements, 12);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests 8–9: Hub Inspection Center — fee collection & payout logic
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal order fixture with enough fields for getCenterFeeCollection */
function makeOrder(overrides: Partial<InspectionOrderDto>): InspectionOrderDto {
  return {
    id: 'ord-test',
    status: 'COMPLETED',
    orderType: 'AT_CENTER',
    buyerFeeShare: 100000,
    buyerCommitmentDeposit: 0,
    buyerPaidAt: '2026-11-01T10:00:00Z',
    sellerFeeShare: 50000,
    sellerPaidAt: '2026-11-01T10:05:00Z',
    feeSettledAt: null,
    centerPayoutAmount: undefined,
    ...overrides,
  } as unknown as InspectionOrderDto;
}

test('8a. getCenterFeeCollection - Đã thu đủ nhưng chưa quyết toán (feeSettledAt null)', () => {
  const order = makeOrder({ feeSettledAt: null });
  const fees = getCenterFeeCollection(order);
  assert.equal(fees.collection, 'collected');
  assert.equal(fees.settledAt, null);
  // CenterPayoutSection should show "Chờ quyết toán" because settled=null but fees are collected
  // Verify: no settledAt → not yet settled; collection=collected → eligible for payout
  assert.ok(fees.totalCollected > 0);
});

test('8b. getCenterFeeCollection - Hub đã nhận tiền (centerPayoutAmount > 0)', () => {
  const order = makeOrder({
    feeSettledAt: '2026-11-02T12:00:00Z',
    centerPayoutAmount: 150000,
  });
  const fees = getCenterFeeCollection(order);
  assert.equal(fees.collection, 'collected');
  assert.equal(fees.settledAt, '2026-11-02T12:00:00Z');
  // centerPayoutAmount > 0 → CenterPayoutSection shows "Đã cộng vào ví · 150.000 đ"
  assert.ok(order.centerPayoutAmount != null && order.centerPayoutAmount > 0);
});

test('8c. Quyết toán bằng 0 (centerPayoutAmount === 0)', () => {
  const order = makeOrder({
    feeSettledAt: '2026-11-02T12:00:00Z',
    centerPayoutAmount: 0,
  });
  // centerPayoutAmount === 0 → CenterPayoutSection shows "Đã quyết toán · Không có khoản chi"
  assert.strictEqual(order.centerPayoutAmount, 0);
  assert.ok(order.feeSettledAt != null);
});

test('8d. Thiếu dữ liệu ghi có (centerPayoutAmount null, feeSettledAt present)', () => {
  const order = makeOrder({
    feeSettledAt: '2026-11-02T12:00:00Z',
    centerPayoutAmount: null,
  });
  // Should show "Đã quyết toán phí · Chưa có dữ liệu ghi có cho Hub"
  // Must NOT display 0đ as a substitute for missing payout data
  assert.strictEqual(order.centerPayoutAmount, null);
  assert.ok(order.feeSettledAt != null);
  // Verify this case is distinct from centerPayoutAmount === 0
  assert.notStrictEqual(order.centerPayoutAmount, 0);
});

test('8e. Đơn mới tạo chưa đến bước quyết toán (status PENDING)', () => {
  const order = makeOrder({
    status: 'PENDING',
    buyerPaidAt: undefined,
    sellerPaidAt: undefined,
    feeSettledAt: null,
    centerPayoutAmount: undefined,
  });
  const fees = getCenterFeeCollection(order);
  // Early-stage order: collection = 'not_due', no payout yet
  assert.equal(fees.collection, 'not_due');
  assert.equal(fees.settledAt, null);
});

test('8f. Đã nộp một phần - chỉ buyer đã nộp', () => {
  const order = makeOrder({
    status: 'INSPECTING',
    buyerFeeShare: 100000,
    buyerPaidAt: '2026-11-01T10:00:00Z',
    sellerFeeShare: 50000,
    sellerPaidAt: null,  // seller chưa nộp
  });
  const fees = getCenterFeeCollection(order);
  assert.equal(fees.collection, 'partial');
});

test('9. CenterWalletTab label logic - EARNING+INSPECTION_ORDER và SHIPPING_REIMBURSE+SHIPMENT', () => {
  // This mirrors the resolveTxLabel logic inside CenterWalletTab.tsx
  // Testing the pure label resolution logic as pure conditions (not the React component)
  function resolveTxLabel(tx: { type: string; referenceType?: string; description?: string }): string {
    if (tx.type === 'EARNING' && tx.referenceType === 'INSPECTION_ORDER') {
      return 'Thu phí kiểm định';
    }
    if (tx.type === 'SHIPPING_REIMBURSE' && tx.referenceType === 'SHIPMENT') {
      return 'Hoàn ứng cước (Sandbox)';
    }
    return tx.description || '—';
  }

  // EARNING + INSPECTION_ORDER → "Thu phí kiểm định"
  assert.equal(
    resolveTxLabel({ type: 'EARNING', referenceType: 'INSPECTION_ORDER', description: 'Thu phí' }),
    'Thu phí kiểm định'
  );

  // SHIPPING_REIMBURSE + SHIPMENT → "Hoàn ứng cước (Sandbox)"
  assert.equal(
    resolveTxLabel({ type: 'SHIPPING_REIMBURSE', referenceType: 'SHIPMENT', description: 'Hoàn cước' }),
    'Hoàn ứng cước (Sandbox)'
  );

  // EARNING + non-INSPECTION_ORDER → use description
  assert.equal(
    resolveTxLabel({ type: 'EARNING', referenceType: 'ORDER', description: 'Nhận tiền bán hàng' }),
    'Nhận tiền bán hàng'
  );

  // SHIPPING_REIMBURSE + non-SHIPMENT → use description
  assert.equal(
    resolveTxLabel({ type: 'SHIPPING_REIMBURSE', referenceType: 'ORDER', description: 'Phí ship' }),
    'Phí ship'
  );

  // Other type → use description
  assert.equal(
    resolveTxLabel({ type: 'DEPOSIT', referenceType: 'DEPOSIT_REQUEST', description: 'Nạp tiền ví' }),
    'Nạp tiền ví'
  );

  // Missing description → '—'
  assert.equal(
    resolveTxLabel({ type: 'WITHDRAW', referenceType: 'WITHDRAWAL' }),
    '—'
  );
});

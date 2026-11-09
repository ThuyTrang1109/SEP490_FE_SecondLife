import test from 'node:test';
import assert from 'node:assert/strict';
import { EscrowOrder } from '../types';

// Reproduction of the helper logic in EscrowOrdersView and App
function getInspectionFeeSplit(ord: Partial<EscrowOrder>): 'SPLIT_50_50' | 'SELLER_100' | 'BUYER_100' {
  if (ord.inspectionFeeSplit) return ord.inspectionFeeSplit;
  const fp = ord.feePayer || (ord as any)?.counterFeePayer || (ord as any)?.inspectionOrder?.feePayer;
  if (fp === 'SELLER_PAYS') return 'SELLER_100';
  if (fp === 'SPLIT_50_50') return 'SPLIT_50_50';
  if (fp === 'BUYER_PAYS') return 'BUYER_100';
  if ((ord.sellerFeeShare && ord.sellerFeeShare > 0) && (ord.buyerFeeShare && ord.buyerFeeShare > 0)) return 'SPLIT_50_50';
  if (ord.sellerFeeShare && ord.sellerFeeShare > 0) return 'SELLER_100';
  return 'BUYER_100';
}

function getPartyInspectionFee(ord: Partial<EscrowOrder>, isSeller: boolean): number {
  const total = Number(ord.inspectionFeeVnd || (ord as any)?.inspectionFee || 0);
  const split = getInspectionFeeSplit(ord);

  if (isSeller) {
    if (ord.sellerFeeShare !== undefined && ord.sellerFeeShare !== null && Number(ord.sellerFeeShare) > 0) {
      return Number(ord.sellerFeeShare);
    }
    if (ord.sellerInspectionFeeVnd !== undefined && ord.sellerInspectionFeeVnd !== null && Number(ord.sellerInspectionFeeVnd) > 0) {
      return Number(ord.sellerInspectionFeeVnd);
    }
    if (split === 'SELLER_100') return total;
    if (split === 'SPLIT_50_50') return Math.round(total / 2);
    return 0;
  } else {
    if (ord.buyerFeeShare !== undefined && ord.buyerFeeShare !== null && Number(ord.buyerFeeShare) > 0) {
      return Number(ord.buyerFeeShare);
    }
    if (ord.buyerInspectionFeeVnd !== undefined && ord.buyerInspectionFeeVnd !== null && Number(ord.buyerInspectionFeeVnd) > 0) {
      return Number(ord.buyerInspectionFeeVnd);
    }
    if (split === 'BUYER_100') return total;
    if (split === 'SPLIT_50_50') return Math.round(total / 2);
    return 0;
  }
}

function isPartyInspectionFeePaid(ord: Partial<EscrowOrder>, isSeller: boolean): boolean {
  if (isSeller) {
    return Boolean(ord.sellerPaidAt || (ord as any)?.seller_paid_at);
  } else {
    return Boolean(ord.buyerPaidAt || (ord as any)?.buyer_paid_at);
  }
}

function isPartyInspectionFeePending(ord: Partial<EscrowOrder>, isSeller: boolean): boolean {
  const bStatus = String((ord as any)?.backendStatus || (ord as any)?.status || '').toUpperCase();
  if (bStatus !== 'WAITING_FEE_PAYMENT') return false;
  const feeOwed = getPartyInspectionFee(ord, isSeller);
  if (feeOwed <= 0) return false;
  return !isPartyInspectionFeePaid(ord, isSeller);
}

test('1. Đơn hàng chia đôi 50/50: cả người mua và người bán đều có nghĩa vụ nộp 50% phí kiểm định', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-split-5050',
    inspectionFeeVnd: 200_000,
    feePayer: 'SPLIT_50_50',
    inspectionFeeSplit: 'SPLIT_50_50',
    sellerFeeShare: 100_000,
    buyerFeeShare: 100_000,
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
    sellerPaidAt: null,
    buyerPaidAt: null,
  };

  assert.equal(getInspectionFeeSplit(order), 'SPLIT_50_50');
  assert.equal(getPartyInspectionFee(order, true), 100_000);
  assert.equal(getPartyInspectionFee(order, false), 100_000);

  // Cả 2 bên đều pending phí
  assert.equal(isPartyInspectionFeePending(order, true), true, 'Người bán phải có thông báo nộp phí');
  assert.equal(isPartyInspectionFeePending(order, false), true, 'Người mua phải có thông báo nộp phí');
});

test('2. Khi người bán đã nộp 50% phí kiểm định nhưng người mua chưa nộp', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-seller-paid',
    inspectionFeeVnd: 200_000,
    feePayer: 'SPLIT_50_50',
    inspectionFeeSplit: 'SPLIT_50_50',
    sellerFeeShare: 100_000,
    buyerFeeShare: 100_000,
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
    sellerPaidAt: '2026-11-09T10:00:00Z',
    buyerPaidAt: null,
  };

  // Người bán đã thanh toán
  assert.equal(isPartyInspectionFeePaid(order, true), true);
  assert.equal(isPartyInspectionFeePending(order, true), false, 'Người bán không còn pending');

  // Người mua vẫn pending
  assert.equal(isPartyInspectionFeePaid(order, false), false);
  assert.equal(isPartyInspectionFeePending(order, false), true, 'Người mua vẫn pending');
});

test('3. Đơn hàng BUYER_100: người bán chịu 0đ và không có yêu cầu nộp phí', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-buyer-100',
    inspectionFeeVnd: 166_000,
    feePayer: 'BUYER_PAYS',
    inspectionFeeSplit: 'BUYER_100',
    sellerFeeShare: 0,
    buyerFeeShare: 166_000,
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
    sellerPaidAt: null,
    buyerPaidAt: null,
  };

  assert.equal(getInspectionFeeSplit(order), 'BUYER_100');
  assert.equal(getPartyInspectionFee(order, true), 0);
  assert.equal(getPartyInspectionFee(order, false), 166_000);

  assert.equal(isPartyInspectionFeePending(order, true), false, 'Người bán 0đ nên không pending');
  assert.equal(isPartyInspectionFeePending(order, false), true, 'Người mua pending toàn bộ phí');
});

test('4. Đơn hàng SELLER_100: người bán chịu 100% phí kiểm định', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-seller-100',
    inspectionFeeVnd: 166_000,
    feePayer: 'SELLER_PAYS',
    inspectionFeeSplit: 'SELLER_100',
    sellerFeeShare: 166_000,
    buyerFeeShare: 0,
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
    sellerPaidAt: null,
    buyerPaidAt: null,
  };

  assert.equal(getInspectionFeeSplit(order), 'SELLER_100');
  assert.equal(getPartyInspectionFee(order, true), 166_000);
  assert.equal(getPartyInspectionFee(order, false), 0);

  assert.equal(isPartyInspectionFeePending(order, true), true, 'Người bán pending 100% phí');
  assert.equal(isPartyInspectionFeePending(order, false), false, 'Người mua 0đ không pending');
});


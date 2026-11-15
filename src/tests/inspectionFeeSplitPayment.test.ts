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

test('5. Đơn hàng SELLER_100 trong WAITING_FEE_PAYMENT: Người mua không hiện mã QR, trạng thái là chờ người bán nộp', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-seller-100-status',
    inspectionFeeVnd: 200_000,
    feePayer: 'SELLER_PAYS',
    inspectionFeeSplit: 'SELLER_100',
    sellerFeeShare: 200_000,
    buyerFeeShare: 0,
    escrowStatus: 'AWAITING_INSPECTION',
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
    sellerPaidAt: null,
    buyerPaidAt: '2026-11-15T10:00:00Z', // Dù có timestamp cũ từ checkout
  };

  const buyerFee = getPartyInspectionFee(order, false);
  const isSeller100 = order.inspectionFeeSplit === 'SELLER_100' || buyerFee <= 0;

  // 1. Phí người mua phải bằng 0
  assert.equal(buyerFee, 0);
  assert.equal(isSeller100, true);

  // 2. Trạng thái góc nhìn Buyer: KHÔNG được hiện 'Đã nộp phí • Chờ người bán nộp phí'
  let buyerStatusText = '';
  if (isSeller100) {
    buyerStatusText = 'Chờ người bán nộp phí';
  } else if (isPartyInspectionFeePaid(order, false)) {
    buyerStatusText = 'Đã nộp phí • Chờ người bán nộp phí';
  }
  assert.equal(buyerStatusText, 'Chờ người bán nộp phí');

  // 3. Nút VietQR Ký Quỹ: Khi là WAITING_FEE_PAYMENT hoặc SELLER_100 thì KHÔNG hiển thị QR
  const isOrderUnpaid = (ord: Partial<EscrowOrder>): boolean => {
    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String(ord.backendStatus || '').toUpperCase();
    return (escrow === 'AWAITING_PAYMENT' || backend === 'PENDING_PAYMENT' || backend === 'AWAITING_PAYMENT') && backend !== 'WAITING_FEE_PAYMENT';
  };
  const shouldShowQrButton = isOrderUnpaid(order) && String(order.backendStatus).toUpperCase() !== 'WAITING_FEE_PAYMENT' && order.inspectionFeeSplit !== 'SELLER_100';
  assert.equal(shouldShowQrButton, false, 'Không bao giờ hiện nút QR khi Người bán trả 100%');

  // 4. Badge chân thẻ (footer action bar): Khi ở WAITING_FEE_PAYMENT thì không lặp lại badge ở dưới
  const isBottomBadgeExcluded = ['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'PENDING', 'WAITING_FEE_PAYMENT'].includes(String(order.backendStatus).toUpperCase());
  assert.equal(isBottomBadgeExcluded, true, 'Badge ở chân thẻ không hiển thị để chỉ hiển thị bên trên');
});

test('6. Đơn hàng SELLER_100 trong Modal Chi Tiết: Không hiện banner Chờ người bán thanh toán ở chân modal', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-seller-100-modal',
    inspectionFeeVnd: 200_000,
    feePayer: 'SELLER_PAYS',
    inspectionFeeSplit: 'SELLER_100',
    sellerFeeShare: 200_000,
    buyerFeeShare: 0,
    backendStatus: 'WAITING_FEE_PAYMENT' as any,
  };

  const buyerFee = getPartyInspectionFee(order, false);
  const isSeller100 = order.inspectionFeeSplit === 'SELLER_100' || buyerFee <= 0;

  // Mô phỏng logic render banner chân modal chi tiết
  const shouldRenderModalFooterFeeStatus = (ord: Partial<EscrowOrder>): boolean => {
    const bFee = getPartyInspectionFee(ord, false);
    const seller100 = ord.inspectionFeeSplit === 'SELLER_100' || bFee <= 0;
    if (seller100 || isPartyInspectionFeePaid(ord, false)) return false;
    return bFee > 0;
  };

  assert.equal(isSeller100, true);
  assert.equal(shouldRenderModalFooterFeeStatus(order), false, 'Không render banner trạng thái ở chân modal');
});

test('7. Đơn hàng SELLER_100 đã xác nhận: Không hiện trạng thái "Người bán đã đồng ý" ở chân thẻ hay tiêu đề', () => {
  const order: Partial<EscrowOrder> = {
    id: 'ord-seller-100-confirmed',
    inspectionFeeVnd: 200_000,
    feePayer: 'SELLER_PAYS',
    inspectionFeeSplit: 'SELLER_100',
    sellerFeeShare: 200_000,
    buyerFeeShare: 0,
    sellerConfirmedAt: '2026-11-15T10:00:00Z',
    escrowStatus: 'AWAITING_INSPECTION',
    backendStatus: 'CONFIRMED_PENDING_DISPATCH' as any,
  };

  const buyerFee = getPartyInspectionFee(order, false);
  const isSeller100 = order.inspectionFeeSplit === 'SELLER_100' || buyerFee <= 0;

  // 1. Chân thẻ không render badge "Người bán đã đồng ý"
  const canShowBuyerBottomInspectionBadge = (ord: Partial<EscrowOrder>): boolean => {
    const isSellerPaysAll = ord.inspectionFeeSplit === 'SELLER_100' || getPartyInspectionFee(ord, false) <= 0;
    if (isSellerPaysAll) return false;
    const bStatus = String(ord.backendStatus || '').toUpperCase();
    if (['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'PENDING', 'WAITING_FEE_PAYMENT', 'CONFIRMED_PENDING_DISPATCH'].includes(bStatus)) return false;
    return true;
  };
  assert.equal(canShowBuyerBottomInspectionBadge(order), false, 'Không hiển thị badge ở chân thẻ khi seller 100%');

  // 2. Tiêu đề hiển thị "Chờ người bán gửi hàng đến Hub" thay vì "Người Bán Đã Đồng Ý • Đang Điều Phối Hub"
  const resolveBuyerInspectionHeaderStatus = (ord: Partial<EscrowOrder>): string => {
    const isSellerPaysAll = ord.inspectionFeeSplit === 'SELLER_100' || getPartyInspectionFee(ord, false) <= 0;
    if (isSellerPaysAll) return 'Chờ người bán gửi hàng đến Hub';
    return 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub';
  };
  assert.equal(resolveBuyerInspectionHeaderStatus(order), 'Chờ người bán gửi hàng đến Hub');
});


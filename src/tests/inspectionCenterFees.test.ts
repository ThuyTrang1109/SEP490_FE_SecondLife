import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CenterInspectionFees, CenterInspectionFeeStatus } from '../components/inspection/CenterInspectionFees';
import type { InspectionOrderDto } from '../services/inspectorService';
import { getCenterFeeCollection, isCenterFeeCollectionClosed, matchesCenterFeeFilter } from '../utils/inspectionCenterFees';

const paidAt = '2026-11-11T12:30:00Z';
const centerOrder: InspectionOrderDto = {
  id: 'inspection-order',
  postId: 'post',
  status: 'WAITING_FEE_PAYMENT',
  orderType: 'AT_CENTER',
  feePayer: 'SELLER_PAYS',
  buyerFeeShare: 0,
  sellerFeeShare: 608000,
  inspectionFee: 200000,
  shippingFee: 340000,
  returnShippingReserveFee: 408000,
  cashShippingSimulation: true,
};

test('approval and a zero share do not count as a payment', () => {
  const approval = getCenterFeeCollection({ ...centerOrder, status: 'WAITING_SELLER_APPROVAL', buyerPaidAt: paidAt });
  assert.equal(approval.collection, 'not_due');
  assert.equal(approval.buyer.paid, false);
  assert.equal(approval.totalCollected, 0);

  const waiting = getCenterFeeCollection({ ...centerOrder, buyerPaidAt: paidAt });
  assert.equal(waiting.collection, 'waiting');
  assert.equal(waiting.seller.amount, 608000);
  assert.equal(matchesCenterFeeFilter(waiting, 'waiting', false), true);
  assert.equal(matchesCenterFeeFilter(waiting, 'waiting', isCenterFeeCollectionClosed('CANCELLED')), false);
});

test('collection uses backend shares for either shipping payment mode and settlement needs its own timestamp', () => {
  const paid = getCenterFeeCollection({ ...centerOrder, sellerPaidAt: paidAt, status: 'CONFIRMED_PENDING_DISPATCH' });
  assert.equal(paid.collection, 'collected');
  assert.equal(paid.totalCollected, 608000);
  assert.equal(matchesCenterFeeFilter(paid, 'settled', false), false);

  const settled = getCenterFeeCollection({ ...centerOrder, sellerPaidAt: paidAt, feeSettledAt: paidAt,
    status: 'FAILED', cashShippingSimulation: false, sellerFeeShare: 948000 });
  assert.equal(settled.totalCollected, 948000);
  assert.equal(matchesCenterFeeFilter(settled, 'settled', true), true);
});

test('partial collection includes only confirmed payments and adds any buyer commitment amount', () => {
  const partial = getCenterFeeCollection({ ...centerOrder, feePayer: 'SPLIT_50_50', buyerFeeShare: 200000,
    sellerFeeShare: 100000, buyerCommitmentDeposit: 25000, buyerPaidAt: paidAt });
  assert.equal(partial.collection, 'partial');
  assert.equal(partial.totalCollected, 225000);
  assert.equal(partial.seller.paid, false);
  assert.equal(matchesCenterFeeFilter(partial, 'partial', false), true);
});

test('a missing share remains unknown even when a payment timestamp or operational status exists', () => {
  const unknown = getCenterFeeCollection({ ...centerOrder, status: 'INSPECTING', sellerFeeShare: undefined, sellerPaidAt: paidAt });
  assert.equal(unknown.collection, 'unknown');
  assert.equal(unknown.hasAmounts, false);
  assert.equal(matchesCenterFeeFilter(unknown, 'collected', false), false);
});

test('center fee details show base fee and center payout correctly', () => {
  const order = { ...centerOrder, status: 'PASSED', sellerPaidAt: paidAt };
  const fees = getCenterFeeCollection(order);
  const status = renderToStaticMarkup(createElement(CenterInspectionFeeStatus, {
    fees, collectionClosed: false, isReturning: false, hasResult: true,
  }));
  assert.match(status, /Chờ quyết toán/);
  assert.doesNotMatch(status, /Đã thu đủ/);

  const details = renderToStaticMarkup(createElement(CenterInspectionFees, { order, fees, collectionClosed: false }));
  assert.match(details, /Phí kiểm định cơ sở/);
  assert.match(details, /Quyết toán cho trung tâm/);
  assert.match(details, /Chờ quyết toán/);
});

test('center payout cases: Hub received payout, zero payout, missing payout data', () => {
  // 1. Hub đã nhận tiền (centerPayoutAmount > 0)
  const receivedOrder: InspectionOrderDto = {
    ...centerOrder,
    status: 'COMPLETED',
    feeSettledAt: '2026-11-11T14:00:00Z',
    centerPayoutAmount: 180000,
  };
  const receivedFees = getCenterFeeCollection(receivedOrder);
  const receivedHtml = renderToStaticMarkup(createElement(CenterInspectionFees, {
    order: receivedOrder,
    fees: receivedFees,
    collectionClosed: false,
  }));
  assert.match(receivedHtml, /Đã cộng vào ví · 180\.000/);

  // 2. Khoản quyết toán bằng 0 (centerPayoutAmount === 0)
  const zeroOrder: InspectionOrderDto = {
    ...centerOrder,
    status: 'COMPLETED',
    feeSettledAt: '2026-11-11T14:00:00Z',
    centerPayoutAmount: 0,
  };
  const zeroFees = getCenterFeeCollection(zeroOrder);
  const zeroHtml = renderToStaticMarkup(createElement(CenterInspectionFees, {
    order: zeroOrder,
    fees: zeroFees,
    collectionClosed: false,
  }));
  assert.match(zeroHtml, /Đã quyết toán · Không có khoản chi/);

  // 3. Thiếu dữ liệu quyết toán (centerPayoutAmount null, feeSettledAt present)
  const missingOrder: InspectionOrderDto = {
    ...centerOrder,
    status: 'COMPLETED',
    feeSettledAt: '2026-11-11T14:00:00Z',
    centerPayoutAmount: null,
  };
  const missingFees = getCenterFeeCollection(missingOrder);
  const missingHtml = renderToStaticMarkup(createElement(CenterInspectionFees, {
    order: missingOrder,
    fees: missingFees,
    collectionClosed: false,
  }));
  assert.match(missingHtml, /Đã quyết toán phí · Chưa có dữ liệu ghi có cho Hub/);
  // Tuyệt đối không hiển thị 0 đ thay cho dữ liệu thiếu
  assert.doesNotMatch(missingHtml, /Đã cộng vào ví · 0/);

  // 4. Đơn mới tạo chưa đến bước quyết toán
  const earlyOrder: InspectionOrderDto = {
    ...centerOrder,
    status: 'PENDING',
    buyerPaidAt: null,
    sellerPaidAt: null,
    feeSettledAt: null,
    centerPayoutAmount: null,
  };
  const earlyFees = getCenterFeeCollection(earlyOrder);
  const earlyHtml = renderToStaticMarkup(createElement(CenterInspectionFees, {
    order: earlyOrder,
    fees: earlyFees,
    collectionClosed: false,
  }));
  assert.match(earlyHtml, /Chưa đến bước quyết toán/);
});

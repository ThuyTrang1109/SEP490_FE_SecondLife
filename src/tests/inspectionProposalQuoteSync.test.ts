import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspectionQuoteResponse } from '../services/inspectorService';

// Helper matching logic in InspectionProposalModal
function computeProposalFigures(
  quote: InspectionQuoteResponse | null,
  method: 'AT_CENTER' | 'AT_HOME',
  feePayer: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50',
) {
  const isAtHome = method === 'AT_HOME';

  // AT_HOME package fees
  const atHomeBaseFee = quote?.baseInspectionFee ?? (quote as any)?.baseFee ?? 0;
  const atHomeTravelFee = quote?.atHomePackage?.travelFeeRoundTrip ?? quote?.travelFeeRoundTrip ?? 0;
  const atHomeTravelDistance = quote?.atHomePackage?.distanceKm ?? quote?.travelDistanceKm ?? 0;
  const atHomeQuotedTotal = quote?.atHomePackage?.totalFee ?? quote?.atHomeTotalFee ?? (atHomeBaseFee > 0 ? atHomeBaseFee + atHomeTravelFee : undefined);
  const atHomeTotalFee = atHomeQuotedTotal ?? 0;

  // AT_CENTER package fees
  const atCenterBaseFee = quote?.baseInspectionFee ?? (quote as any)?.baseFee ?? atHomeBaseFee;
  const atCenterOutboundFee = quote?.shippingQuote?.outbound?.shippingFee ?? quote?.shippingToCenterFee ?? quote?.atCenterPackage?.shippingToCenterFee ?? 0;
  const atCenterReturnFee = quote?.shippingQuote?.returnReserve?.shippingFee ?? quote?.returnShippingReserveFee ?? quote?.atCenterPackage?.returnReserveFee ?? 0;
  const atCenterQuotedTotal = quote?.atCenterPackage?.totalFee ?? quote?.atCenterTotalFee ?? (quote?.shippingQuote ? atCenterBaseFee + atCenterOutboundFee + atCenterReturnFee : undefined);
  const atCenterTotalFee = atCenterQuotedTotal ?? 0;

  const activeTotalFee = isAtHome ? atHomeTotalFee : atCenterTotalFee;
  const splitOptions = isAtHome ? quote?.atHomeSplitOptions : quote?.atCenterSplitOptions;
  const halfFee = splitOptions?.SPLIT_50_50 ?? Math.round(activeTotalFee / 2);

  let buyerShare = 0;
  let sellerShare = 0;
  if (feePayer === 'BUYER_PAYS') {
    buyerShare = activeTotalFee;
    sellerShare = 0;
  } else if (feePayer === 'SELLER_PAYS') {
    buyerShare = 0;
    sellerShare = activeTotalFee;
  } else {
    buyerShare = halfFee;
    sellerShare = activeTotalFee - buyerShare;
  }

  return {
    isAtHome,
    atCenterQuotedTotal,
    atHomeQuotedTotal,
    atCenterBaseFee,
    atCenterOutboundFee,
    atCenterReturnFee,
    atCenterTotalFee,
    atHomeBaseFee,
    atHomeTravelFee,
    atHomeTravelDistance,
    atHomeTotalFee,
    activeTotalFee,
    buyerShare,
    sellerShare,
    halfFee,
  };
}

const mockQuoteResponse: InspectionQuoteResponse = {
  postId: 'post-123',
  baseInspectionFee: 166_000,
  travelDistanceKm: 2.5,
  travelFeeRoundTrip: 22_150,
  atHomeTotalFee: 188_150,
  atHomePackage: {
    distanceKm: 2.5,
    travelFeeRoundTrip: 22_150,
    totalFee: 188_150,
    suggestedSplit50: 94_075,
  },
  atHomeSplitOptions: {
    BUYER_PAYS: 188_150,
    SELLER_PAYS: 188_150,
    SPLIT_50_50: 94_075,
  },
  shippingToCenterFee: 21_000,
  returnShippingReserveFee: 25_200,
  atCenterTotalFee: 212_200,
  atCenterPackage: {
    shippingToCenterFee: 21_000,
    returnReserveFee: 25_200,
    totalFee: 212_200,
    suggestedSplit50: 106_100,
  },
  atCenterSplitOptions: {
    BUYER_PAYS: 212_200,
    SELLER_PAYS: 212_200,
    SPLIT_50_50: 106_100,
  },
  shippingQuote: {
    id: 'quote-456',
    inspectionCenterId: 'center-1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    outbound: {
      leg: 'SELLER_TO_CENTER',
      provider: 'LALAMOVE',
      shippingFee: 21_000,
      serviceType: 'MOTORCYCLE',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
    returnReserve: {
      leg: 'CENTER_TO_SELLER',
      provider: 'LALAMOVE',
      shippingFee: 25_200,
      serviceType: 'MOTORCYCLE',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
  },
};

test('Mục 2 và Mục 3 đồng bộ tuyệt đối khi chọn Đưa đến trung tâm (AT_CENTER)', () => {
  const figures = computeProposalFigures(mockQuoteResponse, 'AT_CENTER', 'BUYER_PAYS');

  // Mục 2 card fees:
  assert.equal(figures.atCenterQuotedTotal, 212_200);
  assert.equal(figures.atHomeQuotedTotal, 188_150);

  // Mục 3 breakdown for AT_CENTER:
  assert.equal(figures.atCenterBaseFee, 166_000);
  assert.equal(figures.atCenterOutboundFee, 21_000);
  assert.equal(figures.atCenterReturnFee, 25_200);
  assert.equal(figures.atCenterTotalFee, 212_200);

  // Verification: Mục 3 breakdown sum matches Mục 2 Card 1 total fee
  assert.equal(figures.atCenterBaseFee + figures.atCenterOutboundFee + figures.atCenterReturnFee, figures.atCenterQuotedTotal);
  assert.equal(figures.activeTotalFee, figures.atCenterQuotedTotal);
});

test('Mục 2 và Mục 3 đồng bộ tuyệt đối khi chọn Cử người đến nhà (AT_HOME)', () => {
  const figures = computeProposalFigures(mockQuoteResponse, 'AT_HOME', 'BUYER_PAYS');

  // Mục 2 card fees:
  assert.equal(figures.atCenterQuotedTotal, 212_200);
  assert.equal(figures.atHomeQuotedTotal, 188_150);

  // Mục 3 breakdown for AT_HOME:
  assert.equal(figures.atHomeBaseFee, 166_000);
  assert.equal(figures.atHomeTravelFee, 22_150);
  assert.equal(figures.atHomeTravelDistance, 2.5);
  assert.equal(figures.atHomeTotalFee, 188_150);

  // Verification: Mục 3 breakdown sum matches Mục 2 Card 2 total fee
  assert.equal(figures.atHomeBaseFee + figures.atHomeTravelFee, figures.atHomeQuotedTotal);
  assert.equal(figures.activeTotalFee, figures.atHomeQuotedTotal);
});

test('Mục 4 phân chia chi phí kiểm định tính đúng theo từng phương thức đã chọn', () => {
  // 1. Khi AT_CENTER (212.200 đ)
  const centerSplit = computeProposalFigures(mockQuoteResponse, 'AT_CENTER', 'SPLIT_50_50');
  assert.equal(centerSplit.activeTotalFee, 212_200);
  assert.equal(centerSplit.halfFee, 106_100);
  assert.equal(centerSplit.buyerShare, 106_100);
  assert.equal(centerSplit.sellerShare, 106_100);

  // 2. Khi AT_HOME (188.150 đ)
  const homeSplit = computeProposalFigures(mockQuoteResponse, 'AT_HOME', 'SPLIT_50_50');
  assert.equal(homeSplit.activeTotalFee, 188_150);
  assert.equal(homeSplit.halfFee, 94_075);
  assert.equal(homeSplit.buyerShare, 94_075);
  assert.equal(homeSplit.sellerShare, 94_075);
});


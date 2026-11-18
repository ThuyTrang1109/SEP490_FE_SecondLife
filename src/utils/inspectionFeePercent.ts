const feePercentages = Array.from({ length: 21 }, (_, index) => index * 5);

export function buyerFeePercentFor(payer?: string | null): number | undefined {
  if (payer === 'BUYER_PAYS' || payer === 'BUYER_100') return 100;
  if (payer === 'SELLER_PAYS' || payer === 'SELLER_100') return 0;
  if (payer === 'SPLIT_50_50') return 50;
  return undefined;
}

export function legacyFeeSplit(percent: number | undefined) {
  if (percent === 100) return 'BUYER_100';
  if (percent === 0) return 'SELLER_100';
  if (percent === 50) return 'SPLIT_50_50';
  return undefined;
}

export function feePercentOptions(current?: number, previous?: number | null): number[] {
  if (current == null || previous == null) {
    return feePercentages.filter(percent => percent !== current);
  }
  const lower = Math.min(current, previous);
  const upper = Math.max(current, previous);
  return feePercentages.filter(percent => percent > lower && percent < upper);
}

export function splitInspectionFee(total: number, buyerPercent: number) {
  const totalCents = Math.round(total * 100);
  const buyerCents = Math.round(totalCents * buyerPercent / 100);
  return { buyer: buyerCents / 100, seller: (totalCents - buyerCents) / 100 };
}

export function feePercentLabel(percent: number, lang: string) {
  return lang === 'vi'
    ? `Người mua ${percent}% / Người bán ${100 - percent}%`
    : `Buyer ${percent}% / Seller ${100 - percent}%`;
}

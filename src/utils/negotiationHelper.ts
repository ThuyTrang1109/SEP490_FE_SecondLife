import { Negotiation } from '../types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function isSellerOfferId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('seller-offer-') || id.startsWith('seller-sug-');
}

export function isNegotiationExpired(n: { expiredAt?: string | null }): boolean {
  if (!n.expiredAt) return false;
  const exp = new Date(n.expiredAt).getTime();
  return !isNaN(exp) && exp <= Date.now();
}

export function isOfficialAcceptedNegotiation(
  n?: Negotiation | null,
  postId?: string,
  buyerId?: string
): boolean {
  if (!n || !n.id) return false;
  if (!isValidUUID(n.id)) return false;
  if (isSellerOfferId(n.id)) return false;
  if (n.status !== 'ACCEPTED') return false;
  if (isNegotiationExpired(n)) return false;
  if (postId && n.postId && n.postId !== postId) return false;
  if (buyerId && n.buyerId && n.buyerId.toLowerCase() !== buyerId.toLowerCase()) return false;
  return true;
}

/**
 * Tính bước giá trả giá linh động dựa trên giá niêm yết của sản phẩm.
 * - Dưới 100k: bước giá 5.000 ₫
 * - Từ 100k - 500k: bước giá 10.000 ₫
 * - Từ 500k - 2tr: bước giá 20.000 ₫
 * - Trên 2tr: bước giá 50.000 ₫
 */
export function getNegotiationStep(listingPrice: number, maxRejectedPrice = 0): number {
  const price = Number(listingPrice || 0);
  const remainingGap = price > maxRejectedPrice ? price - maxRejectedPrice : price;
  
  let baseStep = 50000;
  if (price <= 100000) baseStep = 5000;
  else if (price <= 500000) baseStep = 10000;
  else if (price <= 2000000) baseStep = 20000;

  if (remainingGap > 0 && remainingGap <= baseStep) {
    return Math.max(1000, Math.floor(remainingGap / 2));
  }
  return baseStep;
}

export function calculateSuggestedNextOffer(
  listingPrice: number,
  lastPrice: number,
  maxRejectedPrice = 0
): number {
  const step = getNegotiationStep(listingPrice, maxRejectedPrice);
  const minAllowed = Math.max(lastPrice, maxRejectedPrice) + step;
  if (minAllowed >= listingPrice) {
    return Math.max(lastPrice + 1000, Math.floor((listingPrice + Math.max(lastPrice, maxRejectedPrice)) / 2));
  }
  const midPoint = Math.round((listingPrice + Math.max(lastPrice, maxRejectedPrice)) / 2 / step) * step;
  return Math.min(listingPrice - step, Math.max(minAllowed, midPoint));
}



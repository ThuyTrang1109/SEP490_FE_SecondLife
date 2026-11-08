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


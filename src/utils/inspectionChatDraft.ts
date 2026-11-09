import { paths } from '../app/router/paths';
import type { InspectionProposalPrefillData, UserRole } from '../types';
import type { InspectionQuoteResponse } from '../services/inspectorService';

const proposalAction = 'inspection_proposal';
const handoffKeys = ['action', 'postId', 'centerId', 'method', 'feeSplit'];

export function inspectionChatParams(location: string) {
  return new URL(location, 'http://localhost').searchParams;
}

export function resolveChatRoomPath(role: UserRole, roomId: string, location: string) {
  const params = inspectionChatParams(location);
  const path = paths.chat(role, roomId);
  return params.get('action') === proposalAction ? `${path}?${params}` : path;
}

export function isInspectionProposalForPost(location: string, postId: string) {
  const params = inspectionChatParams(location);
  return params.get('action') === proposalAction && params.get('postId') === postId;
}

export function clearInspectionChatIntent(location: string) {
  const url = new URL(location, 'http://localhost');
  handoffKeys.forEach((key) => url.searchParams.delete(key));
  return url.pathname + url.search + url.hash;
}

export function matchesInspectionChatDraft(
  draft: InspectionProposalPrefillData | null | undefined,
  postId: string,
  buyerId: string,
) {
  return Boolean(draft && typeof draft === 'object' && (!draft.postId || draft.postId === postId) &&
    (!draft.buyerId || draft.buyerId === buyerId) && (!draft.quote?.postId || draft.quote.postId === postId));
}

export function inspectionChatDraftFromUrl(location: string, postId: string): InspectionProposalPrefillData | null {
  if (!isInspectionProposalForPost(location, postId)) return null;
  const params = inspectionChatParams(location);
  const method = params.get('method');
  const split = params.get('feeSplit');
  return {
    postId,
    centerId: params.get('centerId') || undefined,
    inspectionMethod: method === 'AT_HOME' || method === 'AT_CENTER' ? method : undefined,
    feeSplit: split === 'BUYER_100' || split === 'SELLER_100' || split === 'SPLIT_50_50' ? split : undefined,
  };
}

export function isInspectionQuoteExpired(quote: InspectionQuoteResponse, method: 'AT_CENTER' | 'AT_HOME', now = Date.now()) {
  if (method !== 'AT_CENTER' || !quote.shippingQuote?.expiresAt) return false;
  const expiresAt = Date.parse(quote.shippingQuote.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function getReusableInspectionQuote(
  draft: InspectionProposalPrefillData | null | undefined,
  postId: string,
): InspectionQuoteResponse | null {
  const quote = draft?.quote as InspectionQuoteResponse | undefined;
  if (!quote || quote.postId !== postId || !draft?.centerId || !draft.inspectionMethod) return null;
  if (draft.inspectionMethod === 'AT_CENTER' &&
      (!quote.shippingQuote?.id || quote.shippingQuote.inspectionCenterId !== draft.centerId)) return null;
  return isInspectionQuoteExpired(quote, draft.inspectionMethod) ? null : quote;
}

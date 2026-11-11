import type { InspectionOrderDto } from '../services/inspectorService';
import type { ShippingQuoteResponseDto } from '../types';

export function getInspectionStageOne(order: InspectionOrderDto | null) {
  const base = order?.inspectionFee ?? null;
  const transport = (order?.orderType === 'AT_HOME' ? order?.travelFee : order?.shippingFee) ?? null;
  const reserve = order?.orderType === 'AT_HOME' ? null : (order?.returnShippingReserveFee ?? null);
  const buyerShare = order?.buyerFeeShare ?? null;
  const sellerShare = order?.sellerFeeShare ?? null;
  const total = buyerShare !== null && sellerShare !== null
    ? buyerShare + sellerShare
    : base !== null && transport !== null && (order?.orderType === 'AT_HOME' || reserve !== null)
      ? base + transport + (reserve ?? 0)
      : null;
  return { base, transport, reserve, buyerShare, sellerShare, total };
}

export function getInspectionStageTwo(order: InspectionOrderDto | null, quote: ShippingQuoteResponseDto | null) {
  const itemPrice = quote?.productPrice ?? order?.finalItemPrice ?? order?.postPrice ?? null;
  const deliveryFee = quote?.shippingFee ?? order?.finalShippingFee ?? null;
  const total = quote?.totalPayable ?? (itemPrice !== null && deliveryFee !== null ? itemPrice + deliveryFee : null);
  return { itemPrice, deliveryFee, total };
}

export function getInspectionRemoteMediaUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : '';
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : '';
  } catch {
    return '';
  }
}

const inlineProofImage = /^data:image\/(?:avif|gif|heic|jpe?g|png|webp);base64,/i;

export function isInspectionProofImage(url: string) {
  if (inlineProofImage.test(url)) return true;
  const remoteUrl = getInspectionRemoteMediaUrl(url);
  if (remoteUrl) {
    const { pathname } = new URL(remoteUrl);
    // Older reports may store an uploaded photo in the videoProofUrl field.
    return pathname.includes('/image/upload/') || /\.(?:avif|gif|heic|jpe?g|png|webp)$/i.test(pathname);
  }
  return false;
}

// The report API currently stores additional photo URLs in this note tag.
const photoTag = /\[Photos:\s*(\[\s*(?:"(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")*)?\s*\])\s*\]/;

export function getInspectionReportMedia(
  order: InspectionOrderDto | null,
  unavailableUrls?: ReadonlySet<string>,
) {
  const note = order?.note || '';
  const photoMatch = note.match(photoTag);
  let notePhotos: string[] = [];
  if (photoMatch) {
    try {
      notePhotos = JSON.parse(photoMatch[1]);
    } catch { /* Ignore malformed legacy photo metadata. */ }
  }

  const proof = order?.videoProofUrl?.trim() || '';
  const unboxing = order?.unboxingVideoUrl?.trim() || '';
  const proofImages = [proof, unboxing].filter(isInspectionProofImage);
  const rawEvidencePhotos = Array.isArray(order?.evidencePhotoUrls) ? order.evidencePhotoUrls : [];
  const photos = [...new Set([
    ...rawEvidencePhotos,
    ...(order?.inspectorPhotos ?? []),
    ...(order?.proofPhotos ?? []),
    ...(order?.evidenceUrls ?? []).filter(isInspectionProofImage),
    ...notePhotos,
    ...proofImages,
  ].filter((url) => typeof url === 'string').map((url) => url.trim()).filter((url) =>
    (getInspectionRemoteMediaUrl(url) || inlineProofImage.test(url)) && !unavailableUrls?.has(url)
  ))];
  const videoUrl = (url: string) => proofImages.includes(url) || unavailableUrls?.has(url)
    ? '' : getInspectionRemoteMediaUrl(url);

  return {
    videoProofUrl: videoUrl(proof),
    unboxingVideoUrl: videoUrl(unboxing),
    photos,
    note: photoMatch ? note.replace(photoMatch[0], '').trim() : note,
  };
}

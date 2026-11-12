import type { InspectionOrderDto } from '../services/inspectorService';
import type { ShippingQuoteResponseDto } from '../types';
import { getInspectionTaskStage } from './inspectionTaskStatus';

export function getInspectionApprovalMessage(status: string, isSeller: boolean) {
  switch (status) {
    case 'WAITING_SELLER_APPROVAL':
      return {
        title: 'Chờ người bán duyệt đề xuất kiểm định',
        description: isSeller
          ? 'Người mua đã gửi đề xuất kiểm định. Bạn có thể chọn Đồng Ý hoặc Từ Chối ở mục Đề Xuất Kiểm Định Từ Người Mua.'
          : 'Đề xuất kiểm định đã được gửi. Bạn có thể theo dõi phản hồi của người bán tại đây.',
      };
    case 'WAITING_BUYER_APPROVAL':
      return {
        title: 'Chờ người mua duyệt lại đề xuất kiểm định',
        description: isSeller
          ? 'Phương án kiểm định mới đang chờ người mua phản hồi.'
          : 'Người bán đã đề xuất lại phương án kiểm định. Bạn có thể phản hồi trong phòng chat.',
      };
    case 'WAITING_FEE_PAYMENT':
      return {
        title: 'Chờ nộp phí kiểm định',
        description: 'Hai bên đã chốt phương án kiểm định. Đơn sẽ được chuyển sang điều phối sau khi thu đủ phí.',
      };
    default:
      return null;
  }
}

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

/**
 * Kiểm tra xem chuỗi ghi chú có phải là ghi chú đề xuất chia phí hoặc ghi chú điều phối nội bộ hay không.
 * Các ghi chú này KHÔNG PHẢI là kết luận kỹ thuật của KTV và không được hiển thị như kết luận kiểm định.
 */
export function isProposalOrDispatchNote(noteText: string): boolean {
  if (!noteText) return false;
  const lower = noteText.toLowerCase();
  return (
    lower.includes('phương án chia phí') ||
    lower.includes('đề xuất lại phương án') ||
    lower.includes('seller_pays') ||
    lower.includes('buyer_pays') ||
    lower.includes('split_50_50') ||
    lower.includes('hướng dẫn kỹ thuật cho ktv') ||
    lower.includes('ghi chú hướng dẫn') ||
    lower.includes('lưu ý mang đồng hồ') ||
    lower.startsWith('[đề xuất')
  );
}

export function getInspectionReportMedia(
  order: InspectionOrderDto | null,
  unavailableUrls?: ReadonlySet<string>,
) {
  const rawNote = order?.note || '';
  const photoMatch = rawNote.match(photoTag);
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

  // Chỉ công nhận là kết luận kỹ thuật của KTV khi đơn đã ở giai đoạn hoàn tất kiểm định
  // (hoặc có điểm/xếp hạng đánh giá cụ thể) VÀ nội dung không phải là đề xuất phí hay hướng dẫn điều phối
  const cleanNote = photoMatch ? rawNote.replace(photoMatch[0], '').trim() : rawNote.trim();
  const stage = getInspectionTaskStage(order?.status);
  const isCompletedStage = stage === 'completed' ||
    order?.status === 'PASSED' ||
    order?.status === 'FAILED' ||
    order?.status === 'COMPLETED' ||
    Boolean(order?.conditionGrade && order?.conditionScore != null);

  const isValidInspectorConclusion = isCompletedStage && cleanNote && !isProposalOrDispatchNote(cleanNote);

  return {
    videoProofUrl: videoUrl(proof),
    unboxingVideoUrl: videoUrl(unboxing),
    photos,
    note: isValidInspectorConclusion ? cleanNote : '',
  };
}

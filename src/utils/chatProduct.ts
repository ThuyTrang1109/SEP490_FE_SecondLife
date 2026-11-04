import type { Listing } from '../types';
import type { ChatRoomDto } from '../services/chatService';

export type ChatProductListing = Omit<Listing, 'priceVnd'> & {
  priceVnd: number | null;
};

export const CHAT_PRODUCT_PLACEHOLDER = '/product-placeholder.svg';

export function normalizeChatPostStatus(status?: string | null): string {
  return status?.trim().toUpperCase() || 'UNKNOWN';
}

export function getChatPostStatusBadge(status?: string | null, lang: 'vi' | 'en' = 'vi'): {
  label: string;
  className: string;
  isClosed: boolean;
} | null {
  const norm = normalizeChatPostStatus(status);
  switch (norm) {
    case 'SOLD':
      return {
        label: lang === 'vi' ? 'Đã bán' : 'Sold',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
        isClosed: true,
      };
    case 'PAYMENT_PENDING':
      return {
        label: lang === 'vi' ? 'Chờ thanh toán' : 'Payment pending',
        className: 'bg-amber-50 text-amber-800 border-amber-300',
        isClosed: true,
      };
    case 'RESERVED':
      return {
        label: lang === 'vi' ? 'Đã giữ chỗ' : 'Reserved',
        className: 'bg-purple-50 text-purple-800 border-purple-200',
        isClosed: true,
      };
    case 'REJECTED':
      return {
        label: lang === 'vi' ? 'Bị từ chối' : 'Rejected',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        isClosed: true,
      };
    case 'DRAFT':
      return {
        label: lang === 'vi' ? 'Bản nháp' : 'Draft',
        className: 'bg-slate-50 text-slate-500 border-slate-200',
        isClosed: true,
      };
    case 'PENDING':
    case 'PENDING_INSPECTION':
      return {
        label: lang === 'vi' ? 'Đang duyệt' : 'Pending',
        className: 'bg-amber-50 text-amber-600 border-amber-200',
        isClosed: true,
      };
    case 'ACTIVE':
      return {
        label: lang === 'vi' ? 'Đang mở bán' : 'Active',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        isClosed: false,
      };
    default:
      return null;
  }
}

// Marketplace data only supplements fields that the chat API does not provide.
// In particular, a missing chat price/status must not revive stale listing data.
export function buildChatProductListing(room: ChatRoomDto, existing?: Listing): ChatProductListing {
  const price = room.postPrice != null && Number.isFinite(room.postPrice) && room.postPrice >= 0
    ? room.postPrice
    : null;
  const status = normalizeChatPostStatus(room.postStatus);
  const image = room.postImageUrl?.trim() || CHAT_PRODUCT_PLACEHOLDER;
  const listingStatus: Listing['status'] = status === 'ACTIVE' ? 'active'
    : status === 'RESERVED' ? 'reserved'
    : status === 'SOLD' ? 'sold'
    : status === 'PAYMENT_PENDING' ? 'reserved'
    : status === 'DRAFT' ? 'draft'
    : status === 'REJECTED' ? 'rejected'
    : status === 'PENDING_INSPECTION' ? 'pending_inspection'
    : 'pending';

  return {
    ...existing,
    id: room.postId,
    title: room.postTitle?.trim() || 'Sản phẩm trao đổi',
    priceVnd: price,
    backendStatus: status,
    status: listingStatus,
    sellerId: room.sellerId,
    sellerName: room.sellerName || existing?.sellerName || 'Người Bán',
    sellerAvatar: room.sellerAvatar || existing?.sellerAvatar,
    category: existing?.category || '',
    brand: existing?.brand || '',
    model: existing?.model || '',
    purchaseYear: existing?.purchaseYear || 0,
    conditionGrade: existing?.conditionGrade || 'Good',
    declaredConditionText: existing?.declaredConditionText || '',
    description: existing?.description || '',
    location: existing?.location || '',
    sellerRating: existing?.sellerRating ?? 0,
    sellerCompletedOrders: existing?.sellerCompletedOrders ?? 0,
    sellerVerified: existing?.sellerVerified ?? false,
    photos: {
      front: image,
      back: existing?.photos?.back || '',
      screenOrDetails: existing?.photos?.screenOrDetails || '',
      accessoriesOrBox: existing?.photos?.accessoriesOrBox || '',
      serialOrReceipt: existing?.photos?.serialOrReceipt || '',
    },
    photoGallery: room.postImageUrl ? [image] : [],
    createdAt: existing?.createdAt || room.updatedAt || '',
    isInspectionGuaranteed: existing?.isInspectionGuaranteed ?? false,
    requiresInspection: existing?.requiresInspection ?? (price != null && price > 5000000),
  };
}

export function getChatProductActions(
  status: string | null | undefined,
  price: number | null,
  acceptedNegotiationId?: string,
) {
  const normalizedStatus = normalizeChatPostStatus(status);
  const hasPrice = price != null && Number.isFinite(price) && price > 0;
  return {
    canNegotiate: hasPrice && normalizedStatus === 'ACTIVE',
    canBuy: hasPrice && (
      normalizedStatus === 'ACTIVE' ||
      (normalizedStatus === 'RESERVED' && Boolean(acceptedNegotiationId))
    ),
  };
}

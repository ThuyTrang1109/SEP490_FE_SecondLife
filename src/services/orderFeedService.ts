import { requestGet } from './apiClient';
import type { InspectionOrderDto } from './inspectorService';
import type { OrderBackend } from '../types';
import type { OrderFeedQuery, OrderFilterTab } from '../utils/escrowOrderFilters';

export interface OrderFeedItem {
  order: OrderBackend | null;
  inspection: InspectionOrderDto | null;
  buyerName: string | null;
  sellerName: string | null;
  postImageUrl: string | null;
  categoryId: string | null;
  itemId: string | null;
  itemCondition: string | null;
}

export interface OrderFeed {
  items: OrderFeedItem[];
  detail: OrderFeedItem | null;
  counts: Record<OrderFilterTab, number>;
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export async function getOrderFeed(query: OrderFeedQuery, orderId?: string, signal?: AbortSignal): Promise<OrderFeed> {
  const params = new URLSearchParams({
    filter: query.filter,
    perspective: query.perspective,
    q: query.q,
    page: String(query.page),
    size: '10',
  });
  if (orderId) params.set('orderId', orderId);
  const { data } = await requestGet<OrderFeed>(`/orders/feed?${params}`, { requiresAuth: true, signal });
  if (!data || !Array.isArray(data.items) || !data.counts) throw new Error('Invalid order feed response');
  return data;
}

export function orderFeedItemToRaw({ order, inspection, ...metadata }: OrderFeedItem) {
  return {
    ...inspection,
    ...order,
    ...metadata,
    buyerName: metadata.buyerName ?? inspection?.buyerName,
    sellerName: metadata.sellerName ?? inspection?.sellerName,
    postImageUrl: inspection?.postImageUrls?.[0] ?? metadata.postImageUrl,
    inspectionOrderId: inspection?.id,
    inspectionStatus: inspection?.customerStatus || inspection?.status,
    linkedOrderId: order && inspection ? order.id : inspection?.linkedOrderId,
    __isInspection: Boolean(inspection),
  };
}


export const ORDER_FILTER_TABS = [
  'all', 'awaiting_pickup', 'inspecting', 'shipping', 'delivered',
  'completed', 'cancelled', 'disputed', 'with_inspection',
] as const;

export type OrderFilterTab = typeof ORDER_FILTER_TABS[number];
export type OrderPerspective = 'all' | 'buyer' | 'seller';

export interface OrderFeedQuery {
  filter: OrderFilterTab;
  perspective: OrderPerspective;
  q: string;
  page: number;
}

export function readOrderFeedQuery(location: string): OrderFeedQuery {
  const params = new URL(location, 'http://localhost').searchParams;
  const filter = params.get('filter') || params.get('order_tab') || params.get('tab');
  const perspective = params.get('perspective');
  const page = Number(params.get('page'));
  return {
    filter: ORDER_FILTER_TABS.find((tab) => tab === filter) ?? 'all',
    perspective: perspective === 'buyer' || perspective === 'seller' ? perspective : 'all',
    q: (params.get('q') || '').trim().slice(0, 150),
    page: Number.isInteger(page) && page > 0 && page <= 2147483647 ? page - 1 : 0,
  };
}

export function orderFeedSearch(currentSearch: string, query: OrderFeedQuery): string {
  const params = new URLSearchParams(currentSearch);
  params.delete('tab');
  params.delete('order_tab');
  for (const [key, value] of [
    ['filter', query.filter === 'all' ? '' : query.filter],
    ['perspective', query.perspective === 'all' ? '' : query.perspective],
    ['q', query.q],
    ['page', query.page > 0 ? String(query.page + 1) : ''],
  ]) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.size ? '?' + params.toString() : '';
}

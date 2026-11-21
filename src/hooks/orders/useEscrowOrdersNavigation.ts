import { useEffect, useState, type SetStateAction } from 'react';
import { useBrowserLocation, navigatePath } from '../../app/router/browser';
import { resolveAppRoute, paths } from '../../app/router/paths';
import type { EscrowOrder, UserRole } from '../../types';
import { orderFeedSearch, readOrderFeedQuery, type OrderFeedQuery, type OrderFilterTab, type OrderPerspective } from '../../utils/escrowOrderFilters';

interface Options {
  filterQuery: OrderFeedQuery;
  currentRole?: UserRole;
  userRole?: UserRole;
  orders: EscrowOrder[];
  routeOrder: EscrowOrder | null;
  isLoading: boolean;
}

export function useEscrowOrdersNavigation({
  filterQuery, currentRole, userRole, orders, routeOrder, isLoading,
}: Options) {
  const routeLocation = useBrowserLocation();
  const orderRoute = resolveAppRoute(routeLocation, currentRole || userRole);
  const activeTab = filterQuery.filter;
  const updateQuery = (changes: Partial<OrderFeedQuery>) => {
    const { pathname, search } = window.location;
    navigatePath(pathname + orderFeedSearch(search, { ...filterQuery, ...changes }));
  };
  const setActiveTab = (filter: OrderFilterTab) => updateQuery({ filter, page: 0, q: searchQuery.trim() });
  const setOrderPerspective = (perspective: OrderPerspective) => updateQuery({
    perspective,
    filter: perspective === 'buyer' && activeTab === 'pre_listing' ? 'all' : activeTab,
    page: 0,
    q: searchQuery.trim(),
  });

  const [searchQuery, setSearchQuery] = useState(filterQuery.q);
  useEffect(() => setSearchQuery(filterQuery.q), [filterQuery.q]);
  const searching = searchQuery.trim() !== filterQuery.q;
  useEffect(() => {
    if (!searching) return;
    const timer = window.setTimeout(() => {
      const { pathname, search } = window.location;
      navigatePath(pathname + orderFeedSearch(search, {
        ...readOrderFeedQuery(window.location.href), q: searchQuery.trim(), page: 0,
      }), { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searching, filterQuery.q, routeLocation]);

  const [detailModalOrder, setDetailModalOrderState] = useState<EscrowOrder | null>(null);
  const setDetailModalOrder = (value: SetStateAction<EscrowOrder | null>) => {
    setDetailModalOrderState(value);
    if (typeof value === 'function') return;
    navigatePath(paths.orders(orderRoute.role || userRole, value?.id) + window.location.search);
  };
  useEffect(() => {
    const id = orderRoute.params.orderId;
    if (!id) {
      setDetailModalOrderState(null);
      return;
    }
    const found = routeOrder ?? orders.find((order) => order.id === id);
    setDetailModalOrderState((previous) => found ?? (isLoading && previous?.id === id ? previous : null));
  }, [orderRoute.params.orderId, routeOrder, orders, isLoading]);
  return {
    activeTab, updateQuery, setActiveTab, setOrderPerspective,
    searchQuery, setSearchQuery, searching, detailModalOrder, setDetailModalOrder,
  };
}

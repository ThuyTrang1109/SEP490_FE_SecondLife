export const safeJsonParse = <T = any>(raw: string | null | undefined, fallback: T): T => {
  if (!raw || raw === 'undefined' || raw === 'null' || (typeof raw === 'string' && raw.trim() === '')) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const getSortableOrderTimestamp = (ord: any): number => {
  if (!ord) return 0;
  const candidates = [
    ord.createdAt,
    ord.createdDate,
    ord.created_at,
    ord.timestamp,
    ord.paidAt,
    ord.sellerConfirmedAt,
    ord.sellerReadyAt,
    ord.carrierPickedUpAt,
    ord.shippingDeliveredAt,
    ord.appointmentScheduledAt,
    ord.updatedAt,
  ];

  for (const val of candidates) {
    if (val === undefined || val === null || val === '') continue;

    if (val instanceof Date) {
      const t = val.getTime();
      if (!isNaN(t) && t > 0) return t;
    }

    if (typeof val === 'number') {
      if (isNaN(val) || val <= 0) continue;
      if (val < 1e11) return Math.round(val * 1000);
      return Math.round(val);
    }

    if (Array.isArray(val) && val.length >= 3) {
      const y = val[0];
      const m = (val[1] || 1) - 1;
      const d = val[2] || 1;
      const h = val[3] || 0;
      const min = val[4] || 0;
      const s = val[5] || 0;
      const dt = new Date(y, m, d, h, min, s);
      const t = dt.getTime();
      if (!isNaN(t) && t > 0) return t;
    }

    if (typeof val === 'string') {
      const s = val.trim();
      if (!s) continue;

      if (/^\d+(\.\d+)?$/.test(s)) {
        const num = parseFloat(s);
        if (!isNaN(num) && num > 0) {
          if (num < 1e11) return Math.round(num * 1000);
          return Math.round(num);
        }
      }

      const parsedIso = Date.parse(s);
      if (!isNaN(parsedIso) && parsedIso > 0) {
        return parsedIso;
      }

      const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1;
        const year = parseInt(dmy[3], 10);
        const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
        const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
        const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
        const dt = new Date(year, month, day, hour, min, sec);
        const t = dt.getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
  }

  return 0;
};

export const isOrderCancelledOrRefunded = (o: any): boolean => {
  if (!o) return false;
  const escrow = String(o.escrowStatus || '').toUpperCase();
  const backend = String(o.backendStatus || '').toUpperCase();
  const status = String(o.status || '').toUpperCase();
  const confStatus = String(o.confirmationStatus || '').toUpperCase();

  // Đơn chưa thanh toán / chờ thanh toán VietQR / hết hạn thanh toán thì KHÔNG ĐƯỢC khóa bài đăng trên sàn
  if (
    backend === 'PENDING_PAYMENT' ||
    backend === 'PAYMENT_EXPIRED' ||
    backend === 'UNPAID' ||
    status === 'PENDING_PAYMENT' ||
    status === 'PAYMENT_EXPIRED' ||
    status === 'UNPAID' ||
    escrow === 'AWAITING_PAYMENT' ||
    escrow === 'PENDING_PAYMENT'
  ) {
    return true;
  }

  if (
    escrow === 'REFUNDED_TO_BUYER' ||
    escrow === 'REFUNDED' ||
    escrow === 'CANCELLED' ||
    escrow === 'CANCELED'
  ) {
    return true;
  }

  if (
    backend === 'CANCELLED' ||
    backend === 'CANCELED' ||
    backend === 'REFUNDED' ||
    backend === 'REJECTED' ||
    backend === 'FAILED' ||
    backend === 'PAYMENT_EXPIRED'
  ) {
    return true;
  }

  if (
    status === 'CANCELLED' ||
    status === 'CANCELED' ||
    status === 'REFUNDED' ||
    status === 'REJECTED' ||
    status === 'FAILED' ||
    status === 'PAYMENT_EXPIRED'
  ) {
    return true;
  }

  if (confStatus === 'REJECTED') {
    return true;
  }

  return false;
};

export const reconcileBoughtListingIds = (ordersList?: any[]): Set<string> => {
  const cancelledListingIds = new Set<string>();
  const activeOrderListingIds = new Set<string>();

  const processOrder = (o: any) => {
    if (!o) return;
    const lid = String(o.listingId || o.listing?.id || o.postId || '');
    if (!lid) return;

    if (isOrderCancelledOrRefunded(o)) {
      cancelledListingIds.add(lid);
    } else {
      activeOrderListingIds.add(lid);
    }
  };

  if (Array.isArray(ordersList)) {
    ordersList.forEach(processOrder);
  }

  try {
    const rawAll = localStorage.getItem('all_orders_cache');
    const allOrds = safeJsonParse<any[]>(rawAll, []);
    if (Array.isArray(allOrds)) allOrds.forEach(processOrder);
  } catch {}

  try {
    const rawOrders = localStorage.getItem('recent_placed_orders');
    const ords = safeJsonParse<any[]>(rawOrders, []);
    if (Array.isArray(ords)) ords.forEach(processOrder);
  } catch {}

  // Any listing that has a cancelled/refunded/unpaid order and NO active uncancelled order must be released
  const toRemove = new Set<string>(Array.from(cancelledListingIds).filter((id) => !activeOrderListingIds.has(id)));

  try {
    const raw = localStorage.getItem('bought_listing_ids');
    const list = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(list)) {
      const hasOrderSource = (Array.isArray(ordersList) && ordersList.length > 0) || !!localStorage.getItem('all_orders_cache');
      list.forEach((id: any) => {
        const sId = String(id);
        if (cancelledListingIds.has(sId) || (hasOrderSource && !activeOrderListingIds.has(sId))) {
          toRemove.add(sId);
        }
      });
      const nextList = list.filter((id: any) => !toRemove.has(String(id)));
      localStorage.setItem('bought_listing_ids', JSON.stringify(nextList));
    }
  } catch {}

  return activeOrderListingIds;
};

export const getBoughtListingIds = (ordersList?: any[]): Set<string> => {
  reconcileBoughtListingIds(ordersList);

  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('bought_listing_ids');
    const ids = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(ids)) ids.forEach((id: any) => set.add(String(id)));
  } catch {}

  const processOrder = (o: any) => {
    if (!o) return;
    const isCancelled = isOrderCancelledOrRefunded(o);
    const lid = String(o.listingId || o.listing?.id || o.postId || '');
    if (!lid) return;

    if (!isCancelled) {
      set.add(lid);
    } else {
      set.delete(lid);
    }
  };

  try {
    const rawAll = localStorage.getItem('all_orders_cache');
    const allOrds = safeJsonParse<any[]>(rawAll, []);
    if (Array.isArray(allOrds)) allOrds.forEach(processOrder);
  } catch {}

  try {
    const rawOrders = localStorage.getItem('recent_placed_orders');
    const ords = safeJsonParse<any[]>(rawOrders, []);
    if (Array.isArray(ords)) ords.forEach(processOrder);
  } catch {}

  if (Array.isArray(ordersList)) {
    ordersList.forEach(processOrder);
  }

  return set;
};

export const markListingAsBought = (listingId: string): void => {
  if (!listingId) return;
  try {
    const target = String(listingId);
    const raw = localStorage.getItem('bought_listing_ids');
    const list = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(list) && !list.map(String).includes(target)) {
      list.push(target);
      localStorage.setItem('bought_listing_ids', JSON.stringify(list));
    }
  } catch {}
};

export const markListingAsAvailable = (listingId: string): void => {
  if (!listingId) return;
  try {
    const target = String(listingId);
    const raw = localStorage.getItem('bought_listing_ids');
    const list = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(list)) {
      const nextList = list.filter((id: any) => String(id) !== target);
      localStorage.setItem('bought_listing_ids', JSON.stringify(nextList));
    }
  } catch {}
};


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

export const getSortablePostTimestamp = (item: any): number => {
  if (!item) return 0;
  const candidates = [
    item.createdAt,
    item.createdDate,
    item.created_at,
    item.publishedAt,
    item.publishDate,
    item.updatedAt,
    item.updatedDate,
    item.timestamp,
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

  if (typeof item.id === 'string') {
    const match = item.id.match(/(\d{10,13})/);
    if (match) {
      const num = Number(match[1]);
      if (num < 1e11) return num * 1000;
      return num;
    }
  }

  return 0;
};

export const extractListingIdFromOrder = (o: any): string => {
  if (!o) return '';
  return String(
    o.listingId ||
    o.listing?.id ||
    o.listing?.postId ||
    (o.listing && (o.listing as any).id) ||
    (o.post && (o.post.id || o.post.postId)) ||
    o.postId ||
    ''
  );
};

export const isOrderCancelledOrRefunded = (o: any): boolean => {
  if (!o) return false;

  // 1. Kiểm tra trực tiếp metadata hủy đơn và cờ hủy trong localStorage
  if (typeof window !== 'undefined' && o.id) {
    try {
      const orderIdStr = String(o.id);
      const bStat = String(o.backendStatus || (o as any).status || '').toUpperCase();
      const activeInspectionList = [
        'WAITING_SELLER_APPROVAL',
        'WAITING_BUYER_APPROVAL',
        'WAITING_FEE_PAYMENT',
        'CONFIRMED_PENDING_DISPATCH',
        'DISPATCHED',
        'SCHEDULED',
        'SHIPPING_TO_CENTER',
        'INSPECTING',
        'PASSED',
        'DELIVERING_TO_BUYER',
      ];
      if (activeInspectionList.includes(bStat)) {
        return false;
      }

      if (
        localStorage.getItem(`order_cancellation_info_${orderIdStr}`) !== null ||
        localStorage.getItem(`order_cancelled_${orderIdStr}`) === 'true'
      ) {
        return true;
      }
    } catch {}
  }

  // 1b. Kiểm tra nếu bài đăng của đơn này đã được giải phóng (hủy đơn để đưa về sàn)
  const lid = extractListingIdFromOrder(o);
  if (typeof window !== 'undefined' && lid) {
    try {
      const bStat = String(o.backendStatus || (o as any).status || '').toUpperCase();
      const activeInspectionList = [
        'WAITING_SELLER_APPROVAL',
        'WAITING_BUYER_APPROVAL',
        'WAITING_FEE_PAYMENT',
        'CONFIRMED_PENDING_DISPATCH',
        'DISPATCHED',
        'SCHEDULED',
        'SHIPPING_TO_CENTER',
        'INSPECTING',
        'PASSED',
        'DELIVERING_TO_BUYER',
      ];
      if (activeInspectionList.includes(bStat)) {
        return false;
      }

      if (localStorage.getItem(`listing_available_${lid}`) === 'true') {
        const isCompleted =
          o.escrowStatus === 'COMPLETED_RELEASED' ||
          o.escrowStatus === 'RELEASED' ||
          o.backendStatus === 'COMPLETED' ||
          o.status === 'COMPLETED' ||
          o.status === 'DELIVERED';
        const isActivelyProcessing =
          o.backendStatus === 'PROCESSING' ||
          o.backendStatus === 'SHIPPED' ||
          o.status === 'PROCESSING' ||
          o.status === 'SHIPPED' ||
          o.escrowStatus === 'HELD_IN_ESCROW' ||
          o.escrowStatus === 'AWAITING_INSPECTION' ||
          o.escrowStatus === 'INSPECTION_IN_PROGRESS';
        if (!isCompleted && !isActivelyProcessing) {
          return true;
        }
      }
    } catch {}
  }

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
    const lid = extractListingIdFromOrder(o);
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

  try {
    const rawSellerInsp = localStorage.getItem('my_seller_inspection_orders');
    const sellerInspOrds = safeJsonParse<any[]>(rawSellerInsp, []);
    if (Array.isArray(sellerInspOrds)) sellerInspOrds.forEach(processOrder);
  } catch {}

  try {
    const rawCenterInsp = localStorage.getItem('center_inspection_orders');
    const centerInspOrds = safeJsonParse<any[]>(rawCenterInsp, []);
    if (Array.isArray(centerInspOrds)) centerInspOrds.forEach(processOrder);
  } catch {}

  // Bất kỳ listing nào có đơn hàng đã hủy / hoàn tiền thì lập tức giải phóng về sàn
  const toRemove = new Set<string>();
  cancelledListingIds.forEach((id) => {
    toRemove.add(id);
    activeOrderListingIds.delete(id);
    try {
      localStorage.setItem(`listing_available_${id}`, 'true');
    } catch {}
  });

  try {
    const raw = localStorage.getItem('bought_listing_ids');
    const list = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(list)) {
      list.forEach((id: any) => {
        const sId = String(id);
        if (localStorage.getItem(`listing_available_${sId}`) === 'true') {
          toRemove.add(sId);
          activeOrderListingIds.delete(sId);
        }
      });
      const nextList = list.filter((id: any) => !toRemove.has(String(id)));
      localStorage.setItem('bought_listing_ids', JSON.stringify(nextList));
    }
  } catch {}

  return activeOrderListingIds;
};

export const getBoughtListingIds = (ordersList?: any[]): Set<string> => {
  const activeOrderListingIds = reconcileBoughtListingIds(ordersList);

  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('bought_listing_ids');
    const ids = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(ids)) {
      ids.forEach((id: any) => {
        const sId = String(id);
        if (localStorage.getItem(`listing_available_${sId}`) !== 'true') {
          set.add(sId);
        }
      });
    }
  } catch {}

  // Thêm tất cả ID của đơn hàng còn đang hoạt động
  activeOrderListingIds.forEach((id) => {
    if (localStorage.getItem(`listing_available_${id}`) !== 'true') {
      set.add(id);
    }
  });

  // Thu thập danh sách đã hủy để loại bỏ triệt để khỏi set trả về
  const cancelledListingIds = new Set<string>();
  const checkOrder = (o: any) => {
    if (!o) return;
    const lid = extractListingIdFromOrder(o);
    if (!lid) return;
    if (isOrderCancelledOrRefunded(o)) {
      cancelledListingIds.add(lid);
    }
  };

  try {
    const rawAll = localStorage.getItem('all_orders_cache');
    const allOrds = safeJsonParse<any[]>(rawAll, []);
    if (Array.isArray(allOrds)) allOrds.forEach(checkOrder);
  } catch {}
  try {
    const rawOrders = localStorage.getItem('recent_placed_orders');
    const ords = safeJsonParse<any[]>(rawOrders, []);
    if (Array.isArray(ords)) ords.forEach(checkOrder);
  } catch {}
  try {
    const rawSellerInsp = localStorage.getItem('my_seller_inspection_orders');
    const sellerInspOrds = safeJsonParse<any[]>(rawSellerInsp, []);
    if (Array.isArray(sellerInspOrds)) sellerInspOrds.forEach(checkOrder);
  } catch {}
  try {
    const rawCenterInsp = localStorage.getItem('center_inspection_orders');
    const centerInspOrds = safeJsonParse<any[]>(rawCenterInsp, []);
    if (Array.isArray(centerInspOrds)) centerInspOrds.forEach(checkOrder);
  } catch {}

  if (Array.isArray(ordersList)) {
    ordersList.forEach(checkOrder);
  }

  cancelledListingIds.forEach((id) => {
    set.delete(id);
    try {
      localStorage.setItem(`listing_available_${id}`, 'true');
    } catch {}
  });

  return set;
};

export const markListingAsBought = (listingId: string): void => {
  if (!listingId) return;
  try {
    const target = String(listingId);
    try {
      localStorage.removeItem(`listing_available_${target}`);
      localStorage.removeItem(`listing_cancelled_at_${target}`);
    } catch {}
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
    try {
      localStorage.setItem(`listing_available_${target}`, 'true');
      localStorage.setItem(`listing_cancelled_at_${target}`, String(Date.now()));
    } catch {}
    const raw = localStorage.getItem('bought_listing_ids');
    const list = safeJsonParse<any[]>(raw, []);
    if (Array.isArray(list)) {
      const nextList = list.filter((id: any) => String(id) !== target);
      localStorage.setItem('bought_listing_ids', JSON.stringify(nextList));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('secondlife_listing_status_changed', { detail: { listingId: target, status: 'active' } }));
    }
  } catch {}
};

export interface ParcelDimensions {
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export const KNOWN_POST_PARCELS: Record<string, ParcelDimensions> = {
  '598feefc-c1b1-4796-97a3-ee4bb4ccd66e': { weight: 3000, length: 40, width: 40, height: 70 }, // Bàn ủi / Bàn là Philips
  '201603ed-fc62-4b29-8e4e-1d347ecc3783': { weight: 2500, length: 30, width: 25, height: 20 }, // Nồi Cơm Điện BlueStone 1.8L
  'ccead440-2d5e-4bfc-a4ed-ebaceab15e48': { weight: 1700, length: 20, width: 20, height: 40 }, // Máy lọc không khí Elmich
  'ca485e58-664c-4e6e-b7b2-e08a5a9e1b85': { weight: 7500, length: 200, width: 300, height: 10 }, // Nệm Nhập Khẩu Cũ
  '8885bc31-918f-48f2-b5e5-c0061eb66c08': { weight: 10000, length: 20, width: 20, height: 30 }, // Nồi cơm điện National
  'dff52291-c690-4dc6-93f1-409a3c2b0bd0': { weight: 40000, length: 50, width: 40, height: 70 }, // Bàn ban công
  'e47234cf-8acf-43eb-9b56-7c2eca434cf2': { weight: 40000, length: 70, width: 70, height: 70 }, // Panasonic Máy giặt
  '7e669c5c-1d73-4e67-8c42-4cb7246dd559': { weight: 40000, length: 70, width: 70, height: 70 }, // Panasonic Máy giặt
  '1baf393b-d490-407b-9d4c-65dbf50ebb83': { weight: 2500, length: 30, width: 25, height: 30 }, // BlueStone Nồi cơm điện
  '075aee0a-22d7-4f62-a7ab-925b48007b2e': { weight: 50000, length: 50, width: 50, height: 135 }, // Máy giặt LG
  'cf0cfd97-282b-4ec1-9ae8-55eaf746e9cf': { weight: 50000, length: 90, width: 70, height: 90 }, // Máy giặt 9KG
  '662a5061-bc65-4278-a0f5-199c571c2535': { weight: 5000, length: 160, width: 40, height: 50 }, // Bàn trà
  'edc39336-4fc7-4e52-a80c-60646fea8e29': { weight: 5000, length: 160, width: 40, height: 40 }, // Bàn ban công
};

/**
 * Trích xuất kích thước và khối lượng thực tế từ bài đăng / mô tả do người bán nhập
 */
export function extractParcelFromDescription(desc?: string): ParcelDimensions {
  if (!desc) return {};
  const result: ParcelDimensions = {};

  // 1. Tìm kích thước 3 chiều: dài x rộng x cao (e.g. 40 x 30 x 20 cm, 40x30x20)
  const dimsMatch = desc.match(/(?:kích thước|kích cỡ|quy cách|dims?|size)?\s*[:=–-]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m)?\s*[xX*×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m)?\s*[xX*×]\s*(\d+(?:[.,]\d+)?)\s*(cm|m|mm)?/i);
  if (dimsMatch) {
    let l = parseFloat(dimsMatch[1].replace(',', '.'));
    let w = parseFloat(dimsMatch[2].replace(',', '.'));
    let h = parseFloat(dimsMatch[3].replace(',', '.'));
    const unit = (dimsMatch[4] || 'cm').toLowerCase();
    if (unit === 'm') {
      l *= 100;
      w *= 100;
      h *= 100;
    } else if (unit === 'mm') {
      l /= 10;
      w /= 10;
      h /= 10;
    }
    if (l > 0 && w > 0 && h > 0) {
      result.length = Math.round(l);
      result.width = Math.round(w);
      result.height = Math.round(h);
    }
  }

  // 2. Tìm khối lượng / trọng lượng (e.g. Khối lượng: 3kg, Trọng lượng: 1500g, Cân nặng 2.5 kg)
  const weightMatch = desc.match(/(?:khối lượng|trọng lượng|cân nặng|nặng|weight)\s*[:=–-]?\s*(\d+(?:[.,]\d+)?)\s*(kg|kí|ký|g|gram|gam)/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1].replace(',', '.'));
    const unit = weightMatch[2].toLowerCase();
    if (val > 0) {
      if (unit.startsWith('k')) {
        result.weight = Math.round(val * 1000);
      } else {
        result.weight = Math.round(val);
      }
    }
  }

  return result;
}

/**
 * Trả về thông tin kiện hàng (khối lượng, dài, rộng, cao) theo thứ tự ưu tiên:
 * 1. Backend post object (shippingWeight, weight, length...)
 * 2. CSDL / Cache post đã biết (KNOWN_POST_PARCELS)
 * 3. Dữ liệu lưu trong localStorage lúc người bán thiết lập bài đăng (post_parcel_${id})
 * 4. Trích xuất từ mô tả chi tiết của người bán (description)
 */
export function getResolvedPostParcel(postId?: string, postObj?: any, desc?: string, categoryName?: string) {
  const pid = String(postId || postObj?.id || postObj?.postId || '');
  const localParcel = (() => {
    try {
      const raw = localStorage.getItem(`post_parcel_${pid}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const known = pid ? KNOWN_POST_PARCELS[pid] : undefined;
  const descParcel = extractParcelFromDescription(desc || postObj?.description || postObj?.aiDescription);

  const weight = Number(
    postObj?.shippingWeight ??
    postObj?.weight ??
    known?.weight ??
    localParcel?.weight ??
    descParcel.weight ??
    (
      categoryName === 'Tủ lạnh & Tủ đông' ? 45000 :
      categoryName === 'Máy giặt & Máy sấy' ? 35000 :
      categoryName === 'Điều hòa & Máy lọc' ? 4000 :
      categoryName === 'Lò vi sóng & Lò nướng' ? 6000 :
      categoryName === 'Robot & Máy hút bụi' ? 3500 :
      categoryName === 'Nồi cơm & Bếp từ' ? 2500 : 2500
    )
  );

  const length = Number(
    postObj?.shippingLength ??
    postObj?.length ??
    known?.length ??
    localParcel?.length ??
    descParcel.length ??
    (
      categoryName === 'Tủ lạnh & Tủ đông' ? 65 :
      categoryName === 'Máy giặt & Máy sấy' ? 60 :
      categoryName === 'Điều hòa & Máy lọc' ? 40 :
      categoryName === 'Lò vi sóng & Lò nướng' ? 45 :
      categoryName === 'Robot & Máy hút bụi' ? 35 :
      categoryName === 'Nồi cơm & Bếp từ' ? 30 : 25
    )
  );

  const width = Number(
    postObj?.shippingWidth ??
    postObj?.width ??
    known?.width ??
    localParcel?.width ??
    descParcel.width ??
    (
      categoryName === 'Tủ lạnh & Tủ đông' ? 65 :
      categoryName === 'Máy giặt & Máy sấy' ? 60 :
      categoryName === 'Điều hòa & Máy lọc' ? 30 :
      categoryName === 'Lò vi sóng & Lò nướng' ? 35 :
      categoryName === 'Robot & Máy hút bụi' ? 35 :
      categoryName === 'Nồi cơm & Bếp từ' ? 25 : 20
    )
  );

  const height = Number(
    postObj?.shippingHeight ??
    postObj?.height ??
    known?.height ??
    localParcel?.height ??
    descParcel.height ??
    (
      categoryName === 'Tủ lạnh & Tủ đông' ? 150 :
      categoryName === 'Máy giặt & Máy sấy' ? 85 :
      categoryName === 'Điều hòa & Máy lọc' ? 30 :
      categoryName === 'Lò vi sóng & Lò nướng' ? 30 :
      categoryName === 'Robot & Máy hút bụi' ? 15 :
      categoryName === 'Nồi cơm & Bếp từ' ? 20 : 15
    )
  );

  return { weight, length, width, height };
}



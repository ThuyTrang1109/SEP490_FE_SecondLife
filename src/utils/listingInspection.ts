import { safeJsonParse } from './orderUtils';

interface InspectedPostRegistry {
  ids: Set<string>;
  titles: Set<string>;
  timestamp: number;
}

let cachedRegistry: InspectedPostRegistry | null = null;
const REGISTRY_CACHE_TTL_MS = 2500;
const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return localStorage.getItem(key);
    } catch {}
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
  memoryStore.set(key, value);
}

export function normalizeListingTitle(rawTitle?: string | null): string {
  if (!rawTitle) return '';
  return String(rawTitle)
    .trim()
    .replace(/^Tiêu đề:\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/[.…]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if an order (EscrowOrder, InspectionOrderDto, or generic order object)
 * represents an inspection that has successfully PASSED.
 *
 * Strictly returns false if the verdict or status indicates FAILED.
 */
export function isOrderInspectionVerdictPassed(order: any): boolean {
  if (!order || typeof order !== 'object') return false;

  const statusStr = String(order.status || '').toUpperCase();
  const inspStatusStr = String(order.inspectionStatus || '').toUpperCase();
  const escrowStatusStr = String(order.escrowStatus || '').toUpperCase();
  const backendStatusStr = String(order.backendStatus || '').toUpperCase();
  const noteStr = String(order.note || order.inspectionNote || order.summaryNotes || order.cancellationReason || '');
  const verdictStr = String(
    order.inspectionReport?.verdict ||
    order.verdict ||
    order.inspectionVerdict ||
    order.latestInspectionVerdict ||
    ''
  ).toUpperCase();

  // 1. Explicit FAILED always takes precedence: NEVER treat failed inspections as passed
  if (
    verdictStr === 'FAIL' ||
    verdictStr === 'FAILED' ||
    statusStr === 'FAILED' ||
    statusStr === 'INSPECTION_FAILED' ||
    inspStatusStr === 'FAILED' ||
    inspStatusStr === 'INSPECTION_FAILED' ||
    escrowStatusStr === 'INSPECTION_FAILED' ||
    backendStatusStr === 'FAILED' ||
    order.cancellationReasonCode === 'INSPECTION_FAILED' ||
    noteStr.toLowerCase().includes('không đạt kiểm định') ||
    noteStr.toLowerCase().includes('không đạt yêu cầu kiểm định')
  ) {
    return false;
  }

  // 2. Direct PASSED status
  if (
    verdictStr === 'PASS' ||
    verdictStr === 'PASSED' ||
    statusStr === 'PASSED' ||
    statusStr === 'INSPECTION_PASSED' ||
    inspStatusStr === 'PASSED' ||
    inspStatusStr === 'INSPECTION_PASSED' ||
    escrowStatusStr === 'INSPECTION_PASSED' ||
    backendStatusStr === 'PASSED' ||
    backendStatusStr === 'INSPECTION_PASSED'
  ) {
    return true;
  }

  // 3. Tamper Seal attached: Tem niêm phong chỉ được cấp và gán khi sản phẩm đã đạt kiểm định Hub
  const sealId = String(
    order.tamperSealId ||
    order.inspectionReport?.tamperSealId ||
    order.sealId ||
    ''
  ).trim();
  if (sealId && sealId !== 'null' && sealId !== 'undefined') {
    return true;
  }

  // 4. Settlement outcome PASSED_BUYER_DEFAULTED / BUYER_REJECTED:
  // Người mua từ chối mua tiếp sau khi đơn đã đạt kiểm định tại Hub
  const outcomeStr = String(
    order.settlementOutcome ||
    order.outcome ||
    order.inspectionOutcome ||
    order.cancellationReasonCode ||
    ''
  ).toUpperCase();
  if (
    outcomeStr === 'PASSED_BUYER_DEFAULTED' ||
    outcomeStr === 'BUYER_REJECTED_PURCHASE' ||
    outcomeStr === 'BUYER_REJECTED' ||
    statusStr === 'BUYER_REJECTED' ||
    statusStr === 'BUYER_REJECTED_PURCHASE' ||
    inspStatusStr === 'BUYER_REJECTED' ||
    inspStatusStr === 'BUYER_REJECTED_PURCHASE'
  ) {
    return true;
  }

  // 5. LocalStorage override check by order ID
  if (order.id) {
    const localStatus = getStorageItem(`inspection_status_${order.id}`);
    if (localStatus === 'PASSED') return true;
    if (localStatus === 'FAILED') return false;
    if (getStorageItem(`inspection_passed_${order.id}`) === 'true') return true;
    if (getStorageItem(`order_inspection_passed_${order.id}`) === 'true') return true;
  }

  // 6. Order note explicitly confirming inspection passed, including buyer rejection after pass
  const lowerNote = noteStr.toLowerCase();
  if (
    lowerNote.includes('kiểm định đạt chuẩn') ||
    lowerNote.includes('sau khi kiểm định đạt') ||
    lowerNote.includes('đạt tiêu chuẩn thẩm định') ||
    lowerNote.includes('từ chối mua tiếp sau kiểm định') ||
    lowerNote.includes('từ chối mua sau kiểm định') ||
    lowerNote.includes('từ chối mua tiếp sau khi') ||
    lowerNote.includes('từ chối mua sau khi') ||
    lowerNote.includes('sau khi có kết quả kiểm định') ||
    lowerNote.includes('kết quả kiểm định đạt') ||
    lowerNote.includes('sau kiểm định') ||
    lowerNote.includes('sau khi kiểm định')
  ) {
    return true;
  }

  // 7. Subsequent delivery states in center inspection workflow (reachable only after inspection passed)
  if (
    (statusStr === 'DELIVERING_TO_BUYER' || inspStatusStr === 'DELIVERING_TO_BUYER') &&
    (order.hasInspectionService || order.inspectionCenterId || order.orderType === 'AT_CENTER')
  ) {
    return true;
  }

  // 8. Order has condition grade or positive score from technician and was not failed
  const conditionGrade = String(order.conditionGrade || '').trim().toUpperCase();
  const conditionScore = Number(order.conditionScore);
  if (
    (conditionGrade && !['FAILED', 'FAIL', 'NONE', 'UNKNOWN', 'NULL'].includes(conditionGrade)) ||
    (!isNaN(conditionScore) && conditionScore > 0)
  ) {
    if (
      order.hasInspectionService ||
      order.inspectionCenterId ||
      order.orderType === 'AT_CENTER' ||
      order.orderType === 'AT_HOME' ||
      order.inspectorId ||
      order.checklistResultJson
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Builds and caches the registry of post IDs and product titles that have passed inspection.
 */
export function getCachedInspectedPostRegistry(): InspectedPostRegistry {
  const now = Date.now();
  if (cachedRegistry && now - cachedRegistry.timestamp < REGISTRY_CACHE_TTL_MS) {
    return cachedRegistry;
  }

  const ids = new Set<string>();
  const titles = new Set<string>();

  const registerOrderIfPassed = (order: any) => {
    if (!order || typeof order !== 'object') return;
    if (!isOrderInspectionVerdictPassed(order)) return;

    if (order.postId) ids.add(String(order.postId));
    if (order.listingId) ids.add(String(order.listingId));
    if (order.listing?.id) ids.add(String(order.listing.id));
    if (order.listing?.postId) ids.add(String(order.listing.postId));
    if (order.post?.id) ids.add(String(order.post.id));
    if (order.post?.postId) ids.add(String(order.post.postId));
    if (order.relatedPostId) ids.add(String(order.relatedPostId));
    if (order.id) ids.add(String(order.id));

    const postTitle = order.postTitle || order.listing?.title || order.post?.title || order.title || order.itemName;
    if (postTitle) {
      const normalized = normalizeListingTitle(postTitle);
      if (normalized) titles.add(normalized);
    }
  };

  // Scan all stored orders caches
  const cacheKeys = [
    'recent_placed_orders',
    'all_orders_cache',
    'center_inspection_orders',
    'my_seller_inspection_orders',
    'my_buyer_inspection_orders',
    'all_inspection_orders_cache',
    'app_inspection_orders_cache',
    'sl_api_inspection_orders',
  ];

  for (const key of cacheKeys) {
    try {
      const raw = getStorageItem(key);
      const list = safeJsonParse<any[]>(raw, []);
      if (Array.isArray(list)) {
        for (const ord of list) {
          registerOrderIfPassed(ord);
        }
      }
    } catch {}
  }

  // Additional registered titles in storage
  try {
    const rawTitles = getStorageItem('passed_inspection_titles');
    const titleList = safeJsonParse<string[]>(rawTitles, []);
    if (Array.isArray(titleList)) {
      for (const t of titleList) {
        const norm = normalizeListingTitle(t);
        if (norm) titles.add(norm);
      }
    }
  } catch {}

  // Additional registered post IDs in storage
  try {
    const rawIds = getStorageItem('passed_inspection_post_ids');
    const idList = safeJsonParse<string[]>(rawIds, []);
    if (Array.isArray(idList)) {
      for (const id of idList) {
        if (id) ids.add(String(id));
      }
    }
  } catch {}

  cachedRegistry = { ids, titles, timestamp: now };
  return cachedRegistry;
}

/**
 * Invalidate the memory cache (e.g. when an inspection completes or order list updates).
 */
export function invalidateInspectedRegistry(): void {
  cachedRegistry = null;
}

/**
 * Checks whether a given product/listing has passed inspection.
 *
 * Rules:
 * 1. Checks item's direct boolean / status flags.
 * 2. Checks localStorage keys for the listing's ID/postId.
 * 3. Checks against provided orders list.
 * 4. Checks against cached orders from localStorage.
 */
export function isListingInspectionPassed(item: any, orders?: any[]): boolean {
  if (!item || typeof item !== 'object') return false;

  // 1. Direct explicit flags on item
  if (item.isInspected === true || item.inspectionPassed === true) return true;
  const inspStatus = String(item.inspectionStatus || '').toUpperCase();
  if (inspStatus === 'PASSED' || inspStatus === 'INSPECTION_PASSED') return true;
  const backendStatus = String(item.backendStatus || item.status || '').toUpperCase();
  if (backendStatus === 'INSPECTION_PASSED') return true;
  if (item.tamperSealId && typeof item.tamperSealId === 'string' && item.tamperSealId.trim() !== '' && item.tamperSealId !== 'null') {
    return true;
  }
  if (String(item.latestInspectionVerdict || item.verdict || '').toUpperCase() === 'PASSED') return true;
  if (String(item.settlementOutcome || item.outcome || '').toUpperCase() === 'PASSED_BUYER_DEFAULTED') return true;

  const idStr = String(item.id || '').trim();
  const postIdStr = String(item.postId || '').trim();
  const itemIdStr = String(item.itemId || '').trim();
  const titleClean = normalizeListingTitle(item.title || item.itemName);

  // 2. Direct storage flags
  const candidateKeys = [idStr, postIdStr, itemIdStr].filter(Boolean);
  for (const key of candidateKeys) {
    if (getStorageItem(`inspection_passed_${key}`) === 'true') return true;
    if (getStorageItem(`inspection_status_${key}`) === 'PASSED') return true;
    if (getStorageItem(`inspection_status_post_${key}`) === 'PASSED') return true;
    if (getStorageItem(`listing_inspected_${key}`) === 'true') return true;
  }

  // 3. Check directly against in-memory orders if provided
  if (Array.isArray(orders) && orders.length > 0) {
    for (const ord of orders) {
      if (!isOrderInspectionVerdictPassed(ord)) continue;

      const ordPostId = String(ord.postId || ord.listingId || ord.listing?.id || ord.listing?.postId || ord.post?.id || '');
      if (ordPostId && (ordPostId === idStr || ordPostId === postIdStr || ordPostId === itemIdStr)) {
        return true;
      }

      const ordTitle = normalizeListingTitle(ord.postTitle || ord.listing?.title || ord.post?.title || ord.title || ord.itemName);
      if (titleClean && ordTitle) {
        if (titleClean === ordTitle) return true;
        if (titleClean.length >= 8 && ordTitle.length >= 8) {
          if (titleClean.startsWith(ordTitle) || ordTitle.startsWith(titleClean)) {
            return true;
          }
          if (titleClean.includes(ordTitle) || ordTitle.includes(titleClean)) {
            return true;
          }
        }
      }
    }
  }

  // 4. Check cached registry
  const registry = getCachedInspectedPostRegistry();
  if (idStr && registry.ids.has(idStr)) return true;
  if (postIdStr && registry.ids.has(postIdStr)) return true;
  if (itemIdStr && registry.ids.has(itemIdStr)) return true;

  if (titleClean) {
    if (registry.titles.has(titleClean)) return true;
    // Prefix / substring match for titles with ellipsis truncation
    for (const knownTitle of registry.titles) {
      if (titleClean === knownTitle) return true;
      if (titleClean.length >= 8 && knownTitle.length >= 8) {
        if (titleClean.startsWith(knownTitle) || knownTitle.startsWith(titleClean)) {
          return true;
        }
        if (titleClean.includes(knownTitle) || knownTitle.includes(titleClean)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Helper to record that an inspection has passed for a specific product ID and/or title.
 */
export function markListingInspectionPassed(idOrPostId?: string, title?: string): void {
  if (idOrPostId) {
    const key = String(idOrPostId).trim();
    setStorageItem(`inspection_passed_${key}`, 'true');
    setStorageItem(`inspection_status_${key}`, 'PASSED');
    setStorageItem(`inspection_status_post_${key}`, 'PASSED');
    setStorageItem(`listing_inspected_${key}`, 'true');

    try {
      const rawIds = getStorageItem('passed_inspection_post_ids');
      const list = safeJsonParse<string[]>(rawIds, []);
      if (Array.isArray(list) && !list.includes(key)) {
        list.push(key);
        setStorageItem('passed_inspection_post_ids', JSON.stringify(list));
      }
    } catch {}
  }

  if (title) {
    const norm = normalizeListingTitle(title);
    if (norm) {
      try {
        const rawTitles = getStorageItem('passed_inspection_titles');
        const list = safeJsonParse<string[]>(rawTitles, []);
        if (Array.isArray(list) && !list.includes(norm)) {
          list.push(norm);
          setStorageItem('passed_inspection_titles', JSON.stringify(list));
        }
      } catch {}
    }
  }

  invalidateInspectedRegistry();

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('secondlife_inspection_completed', {
          detail: { id: idOrPostId, title, status: 'PASSED' },
        })
      );
    } catch {}
  }
}

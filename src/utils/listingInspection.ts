function getStorageItem(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
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

/** Public listing badges use the inspection result included in the listing response. */
export function isListingInspectionPassed(item?: { isInspected?: boolean | null } | null): boolean {
  return item?.isInspected === true;
}

export function getListingInspectionBadgeText(
  method?: string | null,
  lang: 'vi' | 'en' = 'vi',
  short = false,
): string {
  const normalized = String(method || '').trim().toUpperCase();
  if (normalized === 'AT_HOME') {
    return lang === 'vi'
      ? 'Đã đạt kiểm định tại nhà'
      : (short ? 'Home Inspected' : 'On-site Inspected & Passed');
  }
  if (normalized === 'AT_CENTER') {
    return lang === 'vi'
      ? 'Đã đạt kiểm định tại Hub'
      : (short ? 'Hub Inspected' : 'Hub Inspected & Passed');
  }
  return lang === 'vi'
    ? 'Đã đạt kiểm định'
    : (short ? 'Inspected' : 'Inspected & Passed');
}

function getOrderInspectionOutcome(record: any): 'passed' | 'failed' | null {
  if (!record || typeof record !== 'object') return null;

  const statusStr = String(record.status || '').toUpperCase();
  const inspStatusStr = String(record.inspectionStatus || '').toUpperCase();
  const escrowStatusStr = String(record.escrowStatus || '').toUpperCase();
  const backendStatusStr = String(record.backendStatus || '').toUpperCase();
  const verdictStr = String(
    record.inspectionReport?.verdict ||
    record.verdict ||
    record.inspectionVerdict ||
    record.latestInspectionVerdict ||
    '',
  ).toUpperCase();
  const noteStr = String(record.note || record.inspectionNote || record.summaryNotes || record.cancellationReason || '').toLowerCase();

  if (
    verdictStr === 'FAIL' ||
    verdictStr === 'FAILED' ||
    statusStr === 'FAILED' ||
    statusStr === 'INSPECTION_FAILED' ||
    inspStatusStr === 'FAILED' ||
    inspStatusStr === 'INSPECTION_FAILED' ||
    escrowStatusStr === 'INSPECTION_FAILED' ||
    backendStatusStr === 'FAILED' ||
    record.cancellationReasonCode === 'INSPECTION_FAILED' ||
    noteStr.includes('không đạt kiểm định') ||
    noteStr.includes('không đạt yêu cầu kiểm định')
  ) {
    return 'failed';
  }

  if (isOrderInspectionVerdictPassed(record)) {
    return 'passed';
  }

  return null;
}

function getInspectionRecordMethod(record: any): string | undefined {
  const raw = record?.orderType || record?.inspectionMethod || record?.inspectionOrder?.orderType || record?.inspectionOrder?.inspectionMethod;
  const normalized = String(raw || '').trim().toUpperCase();
  if (normalized === 'AT_HOME' || normalized === 'AT_CENTER') return normalized;
  return undefined;
}

function getInspectionRecordTimestamp(record: any): number {
  const candidates = [
    record?.updatedAt,
    record?.inspectionReport?.completedAt,
    record?.inspectionReport?.inspectedAt,
    record?.inspectedAt,
    record?.createdAt,
  ];
  for (const val of candidates) {
    if (!val) continue;
    const ms = Date.parse(String(val));
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

/**
 * Resolves inspection badge state for a seller's own listing in Seller Dashboard.
 * Strictly requires either `item.isInspected === true` OR a verified passed inspection
 * record matching exact `postId` whose latest finalized outcome is passed (never failed).
 */
export function resolveSellerListingInspectionState(
  item?: { id?: string | null; isInspected?: boolean | null; inspectionMethod?: string | null } | null,
  preListingInspection?: any,
  orders?: any[] | null,
): { passed: boolean; method?: string } {
  if (!item) return { passed: false };

  const postId = String(item.id || '').trim();
  const finalizedRecords: { outcome: 'passed' | 'failed'; method?: string; timestamp: number }[] = [];

  const pushRecord = (record: any) => {
    const outcome = getOrderInspectionOutcome(record);
    if (!outcome) return;
    finalizedRecords.push({
      outcome,
      method: getInspectionRecordMethod(record),
      timestamp: getInspectionRecordTimestamp(record),
    });
  };

  if (preListingInspection && (!preListingInspection.postId || String(preListingInspection.postId) === postId)) {
    pushRecord(preListingInspection);
  }

  if (postId && Array.isArray(orders)) {
    for (const ord of orders) {
      if (!ord || typeof ord !== 'object') continue;
      const ordPostId = String(
        ord.postId ||
        ord.listingId ||
        ord.listing?.id ||
        ord.inspectionOrder?.postId ||
        '',
      ).trim();
      if (ordPostId === postId) {
        pushRecord(ord);
      }
    }
  }

  finalizedRecords.sort((a, b) => b.timestamp - a.timestamp);
  const latest = finalizedRecords[0];

  if (item.isInspected === true) {
    return {
      passed: true,
      method: item.inspectionMethod || latest?.method,
    };
  }

  if (latest && latest.outcome === 'passed') {
    return {
      passed: true,
      method: latest.method || item.inspectionMethod || undefined,
    };
  }

  return { passed: false };
}

let cachedHighValueThreshold: number | null = null;

export function getSystemHighValueThreshold(): number {
  if (cachedHighValueThreshold != null) return cachedHighValueThreshold;
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('system_high_value_threshold');
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed > 0) {
          cachedHighValueThreshold = parsed;
          return parsed;
        }
      }
    }
  } catch { }
  return 5000000;
}

export function setSystemHighValueThreshold(threshold: number): void {
  if (Number.isFinite(threshold) && threshold > 0) {
    cachedHighValueThreshold = threshold;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('system_high_value_threshold', String(threshold));
      }
    } catch { }
  }
}

export function isPostRequiringInspection(post: any, customThreshold?: number): boolean {
  if (!post) return false;
  if (typeof post.requiresInspection === 'boolean') return post.requiresInspection;
  if (typeof post.isHighValue === 'boolean') return post.isHighValue;
  const threshold = post.inspectionThreshold ?? customThreshold ?? getSystemHighValueThreshold();
  const price = Number(post.price || post.priceVnd || 0);
  return price > threshold;
}


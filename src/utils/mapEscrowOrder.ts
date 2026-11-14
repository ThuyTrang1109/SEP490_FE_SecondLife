import type { EscrowOrder, Listing, UserProfile, UserRole } from '../types';
import { extractWardAndCity } from './addressUtils';
import { resolveOrderListing } from './catalogCache';
import { getBuyerInspectionStage, getCustomerInspectionStatus } from './inspectionPurchase';
import { getResolvedPostParcel, resolveInspectionCenter } from './orderUtils';

interface OrderMappingContext {
  currentListings: Listing[];
  currentUser?: UserProfile | null;
  currentRole: UserRole;
  allSellerPostsCached?: unknown[];
  mapBackendPostToListing?: (post: unknown) => Listing;
  postCacheMap?: Map<string, Listing>;
  postTitleCacheMap?: Map<string, Listing>;
  buyerNameMap?: Map<string, string>;
  buyerPhoneMap?: Map<string, string>;
  sellerNameMap?: Map<string, string>;
  postImageMap?: Map<string, string>;
  postTitleMap?: Map<string, string>;
  authoritative?: boolean;
}

export function mapEscrowOrder(bOrd: any, {
  currentListings, currentUser, currentRole, allSellerPostsCached = [], mapBackendPostToListing,
  postCacheMap, postTitleCacheMap, buyerNameMap, buyerPhoneMap, sellerNameMap, postImageMap, postTitleMap,
  authoritative = false,
}: OrderMappingContext): EscrowOrder {
  let cachedListing: any = (bOrd.postId ? postCacheMap?.get(String(bOrd.postId)) : null)
    || (bOrd.postTitle ? postTitleCacheMap?.get(bOrd.postTitle.toLowerCase().trim()) : null);

  if (!cachedListing) {
    try {
      const rawOrderListing = localStorage.getItem(`order_listing_${bOrd.id}`);
      if (rawOrderListing) cachedListing = JSON.parse(rawOrderListing);
      if (!cachedListing && bOrd.postId) {
        const rawPost = localStorage.getItem(`cached_post_${bOrd.postId}`);
        if (rawPost) cachedListing = JSON.parse(rawPost);
      }
      if (!cachedListing && bOrd.postTitle) {
        const rawPostByTitle = localStorage.getItem(`cached_post_title_${bOrd.postTitle.toLowerCase().trim()}`);
        if (rawPostByTitle) cachedListing = JSON.parse(rawPostByTitle);
      }
      if (!cachedListing && mapBackendPostToListing && allSellerPostsCached.length > 0) {
        const matchedFromSellerCache = allSellerPostsCached.find((p: any) =>
          (p.postId && p.postId === bOrd.postId) ||
          (p.id && p.id === bOrd.postId) ||
          (bOrd.postTitle && p.title && p.title.toLowerCase().trim() === bOrd.postTitle.toLowerCase().trim())
        );
        if (matchedFromSellerCache) {
          cachedListing = mapBackendPostToListing(matchedFromSellerCache);
        }
      }
    } catch {}
  }

  const directMatched = currentListings.find(l => l.id === bOrd.postId ||
    (!authoritative && bOrd.postTitle && l.title === bOrd.postTitle));
  const baseListing = directMatched || cachedListing;

  const backendPostImg = (bOrd as any).postImageUrl || (bOrd as any).postImageUrls?.[0];
  const resolvedPostTitle = bOrd.postTitle || baseListing?.title || postTitleMap?.get(bOrd.postId) || 'Thiết bị gia dụng SecondLife';
  const resolvedImage = backendPostImg
    || postImageMap?.get(bOrd.postId)
    || (baseListing?.photos?.front && !baseListing.photos.front.includes('photo-1555041469') && !baseListing.photos.front.includes('photo-1584269600464') ? baseListing.photos.front : '')
    || (baseListing?.photoGallery?.[0] && !baseListing.photoGallery[0].includes('photo-1555041469') && !baseListing.photoGallery[0].includes('photo-1584269600464') ? baseListing.photoGallery[0] : '')
    || baseListing?.photos?.front
    || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';

  const rawMatchedListing = baseListing ? {
    ...baseListing,
    title: resolvedPostTitle,
    ...(authoritative ? {
      categoryId: bOrd.categoryId ?? baseListing.categoryId,
      itemId: bOrd.itemId ?? baseListing.itemId,
      itemCondition: bOrd.itemCondition ?? baseListing.itemCondition,
    } : {}),
    photos: {
      ...baseListing.photos,
      front: resolvedImage,
      back: (bOrd as any).postImageUrls?.[1] || baseListing.photos?.back || resolvedImage,
      screenOrDetails: (bOrd as any).postImageUrls?.[2] || baseListing.photos?.screenOrDetails || resolvedImage,
      accessoriesOrBox: baseListing.photos?.accessoriesOrBox || resolvedImage,
      serialOrReceipt: baseListing.photos?.serialOrReceipt || resolvedImage,
    },
    photoGallery: ((bOrd as any).postImageUrls && (bOrd as any).postImageUrls.length > 0)
      ? (bOrd as any).postImageUrls
      : ((baseListing.photoGallery && baseListing.photoGallery.length > 0) ? baseListing.photoGallery : [resolvedImage]),
  } : (() => {
    const fallbackOrderParcel = getResolvedPostParcel(
      bOrd.postId,
      bOrd,
      bOrd.description || (bOrd as any).postDescription,
      'Nội thất & Gia dụng'
    );
    const resolvedSellerAddr = (bOrd as any).sellerAddress || (bOrd as any).pickupAddress || '';
    const resolvedLoc = resolvedSellerAddr ? extractWardAndCity(resolvedSellerAddr) : 'Hà Nội';
    return {
      id: bOrd.postId,
      title: resolvedPostTitle,
      category: 'Nội thất & Gia dụng',
      categoryId: bOrd.categoryId || undefined,
      itemId: bOrd.itemId || undefined,
      itemCondition: bOrd.itemCondition || undefined,
      brand: 'SecondLife',
      model: 'Verified Model',
      purchaseYear: 2024,
      priceVnd: Number(bOrd.itemPriceVnd || bOrd.finalItemPrice || bOrd.postPrice || bOrd.finalPrice || bOrd.price || 0),
      conditionGrade: 'Good',
      declaredConditionText: 'Sản phẩm đã qua kiểm định cơ bản',
      description: 'Giao dịch bảo lãnh qua Quỹ Escrow SecondLife.',
      location: resolvedLoc,
      sellerAddress: resolvedSellerAddr,
      sellerId: bOrd.sellerId,
      sellerName: (bOrd as any).sellerName || 'Người Bán SecondLife',
      sellerRating: 4.9,
      sellerCompletedOrders: 10,
      sellerVerified: true,
      status: 'sold',
      createdAt: bOrd.createdAt,
      isInspectionGuaranteed: true,
      requiresInspection: authoritative ? bOrd.__isInspection : true,
      photos: {
        front: resolvedImage,
        back: resolvedImage,
        screenOrDetails: resolvedImage,
        accessoriesOrBox: resolvedImage,
        serialOrReceipt: resolvedImage
      },
      photoGallery: [resolvedImage],
      shippingWeight: (bOrd as any).shippingWeight ?? fallbackOrderParcel.weight,
      shippingLength: (bOrd as any).shippingLength ?? fallbackOrderParcel.length,
      shippingWidth: (bOrd as any).shippingWidth ?? fallbackOrderParcel.width,
      shippingHeight: (bOrd as any).shippingHeight ?? fallbackOrderParcel.height,
    };
  })();

  const matchedListing = resolveOrderListing(rawMatchedListing);

  const inspFee = Number(bOrd.inspectionFeeVnd || bOrd.buyerInspectionFeeVnd || bOrd.buyerFeeShare || bOrd.inspectionFee || 0);
  const isInspectionOrder = Boolean(bOrd.__isInspection || bOrd.hasInspectionService || inspFee > 0 || bOrd.orderType);
  const rawStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
  const customerInspectionStatus = getCustomerInspectionStatus(
    authoritative ? (bOrd.inspectionStatus || rawStatusUpper) : rawStatusUpper, bOrd.customerStatus, bOrd.inspectorId,
  );
  const inspectionStage = bOrd.__isInspection && getBuyerInspectionStage({
    inspectionStatus: customerInspectionStatus,
    inspectionNote: bOrd.note,
    finalPaymentPaidAt: bOrd.finalPaymentPaidAt,
    linkedOrderId: bOrd.linkedOrderId,
  });

  const isReceiptConfirmedLocal = !authoritative &&
    !inspectionStage &&
    typeof window !== 'undefined' &&
    localStorage.getItem(`order_receipt_confirmed_${bOrd.id}`) === 'true';

  const isCompletedOrReleased = Boolean(
    bOrd.escrowStatus === 'RELEASED' ||
    bOrd.escrowStatus === 'COMPLETED_RELEASED' ||
    bOrd.status === 'COMPLETED' ||
    bOrd.status === 'RELEASED' ||
    (bOrd as any).backendStatus === 'COMPLETED' ||
    bOrd.releasedAt ||
    bOrd.released_at ||
    isReceiptConfirmedLocal
  );

  const activeInspectionStatuses = [
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
  const isActivelyProcessingInspection = isInspectionOrder && activeInspectionStatuses.includes(rawStatusUpper);

  if (isActivelyProcessingInspection && typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`order_cancellation_info_${bOrd.id}`);
      localStorage.removeItem(`order_cancelled_${bOrd.id}`);
    } catch {}
  }

  const isLocalCancelled = !authoritative && !isActivelyProcessingInspection && typeof window !== 'undefined' && (
    localStorage.getItem(`order_cancellation_info_${bOrd.id}`) !== null ||
    localStorage.getItem(`order_cancelled_${bOrd.id}`) === 'true'
  );

  const isCancelledOrRefund = !isCompletedOrReleased && (authoritative || !isActivelyProcessingInspection) && Boolean(
    isLocalCancelled ||
    bOrd.escrowStatus === 'CANCELLED' ||
    bOrd.escrowStatus === 'REFUNDED' ||
    bOrd.escrowStatus === 'REFUNDED_TO_BUYER' ||
    bOrd.status === 'CANCELLED' ||
    bOrd.status === 'FAILED' ||
    bOrd.status === 'PAYMENT_EXPIRED' ||
    bOrd.status === 'REJECTED'
  );

  let mappedEscrowStatus: EscrowOrder['escrowStatus'] = 'AWAITING_PAYMENT';
  if (isCompletedOrReleased) {
    mappedEscrowStatus = 'COMPLETED_RELEASED';
  } else if (isCancelledOrRefund) {
    mappedEscrowStatus = 'REFUNDED_TO_BUYER';
  } else if (authoritative && bOrd.escrowStatus === 'FROZEN') {
    mappedEscrowStatus = 'DISPUTED';
  } else if (isInspectionOrder && (!authoritative || !bOrd.linkedOrderId)) {
    const localSavedStatus = !authoritative && typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${bOrd.id}`) : null;
    const s = bOrd.__isInspection && (bOrd.customerStatus || customerInspectionStatus === 'INSPECTING')
      ? customerInspectionStatus : String(localSavedStatus || bOrd.status || bOrd.backendStatus || '');
    if (s === 'PASSED') {
      mappedEscrowStatus = 'INSPECTION_PASSED';
    } else if (s === 'FAILED' || s === 'REJECTED') {
      mappedEscrowStatus = 'INSPECTION_FAILED';
    } else if (s === 'INSPECTING') {
      mappedEscrowStatus = 'INSPECTION_IN_PROGRESS';
    } else if (s === 'DELIVERING_TO_BUYER') {
      mappedEscrowStatus = 'SHIPPED_TO_BUYER';
    } else if (s === 'COMPLETED') {
      mappedEscrowStatus = 'COMPLETED_RELEASED';
    } else if (s === 'DISPUTED') {
      mappedEscrowStatus = 'DISPUTED';
    } else if (s === 'CANCELLED' || s === 'PAYMENT_EXPIRED') {
      mappedEscrowStatus = 'REFUNDED_TO_BUYER';
    } else {
      // WAITING_SELLER_APPROVAL, WAITING_BUYER_APPROVAL, CONFIRMED_PENDING_DISPATCH, DISPATCHED, SCHEDULED, SHIPPING_TO_CENTER
      // Trạng thái ban đầu luôn là Chờ kiểm định
      mappedEscrowStatus = 'AWAITING_INSPECTION';
    }
  } else {
    if (bOrd.escrowStatus === 'RELEASED' || bOrd.status === 'COMPLETED') {
      mappedEscrowStatus = 'COMPLETED_RELEASED';
    } else if (bOrd.status === 'DELIVERED') {
      mappedEscrowStatus = 'DELIVERED_INSPECTION_WINDOW';
    } else if (bOrd.status === 'SHIPPED') {
      mappedEscrowStatus = 'SHIPPED_TO_BUYER';
    } else if (
      bOrd.status === 'PROCESSING' ||
      bOrd.status === 'CONFIRMED' ||
      bOrd.escrowStatus === 'HELD' ||
      bOrd.escrowStatus === 'FROZEN' ||
      Boolean(bOrd.paidAt)
    ) {
      mappedEscrowStatus = 'HELD_IN_ESCROW';
    } else if (
      bOrd.status === 'PENDING_PAYMENT' ||
      bOrd.status === 'PENDING' ||
      bOrd.escrowStatus === 'PENDING' ||
      bOrd.escrowStatus === 'PENDING_PAYMENT'
    ) {
      mappedEscrowStatus = 'AWAITING_PAYMENT';
    } else {
      mappedEscrowStatus = 'AWAITING_PAYMENT';
    }
  }

  let parsedAddressObj: any = null;
  let parsedBuyerName = '';
  let parsedBuyerPhone = '';
  if (bOrd.deliveryAddress) {
    if (typeof bOrd.deliveryAddress === 'string') {
      try {
        parsedAddressObj = JSON.parse(bOrd.deliveryAddress);
        if (parsedAddressObj && typeof parsedAddressObj === 'object') {
          parsedBuyerName = parsedAddressObj.name || '';
          parsedBuyerPhone = parsedAddressObj.phone || '';
        }
      } catch {
        // normal text string
      }
    } else if (typeof bOrd.deliveryAddress === 'object') {
      parsedAddressObj = bOrd.deliveryAddress;
      parsedBuyerName = bOrd.deliveryAddress.name || '';
      parsedBuyerPhone = bOrd.deliveryAddress.phone || '';
    }
  }

  let cachedBuyer: any = null;
  try {
    const rawOrderBuyer = localStorage.getItem(`order_buyer_info_${bOrd.id}`);
    if (rawOrderBuyer) {
      cachedBuyer = JSON.parse(rawOrderBuyer);
    } else if (bOrd.buyerId) {
      const rawUser = localStorage.getItem(`buyer_info_${bOrd.buyerId}`);
      if (rawUser) cachedBuyer = JSON.parse(rawUser);
    }
  } catch {}

  const resolvedBuyerName = (
    (authoritative && bOrd.buyerName) ||
    cachedBuyer?.buyerName ||
    cachedBuyer?.name ||
    buyerNameMap?.get(bOrd.buyerId) ||
    buyerNameMap?.get(`post_${bOrd.postId}`) ||
    parsedBuyerName ||
    bOrd.buyerName ||
    (currentRole === 'buyer' ? (currentUser?.name || currentUser?.email || 'Khách Hàng') : '') ||
    `Khách Mua #${bOrd.buyerId ? bOrd.buyerId.slice(0, 8).toUpperCase() : 'VIP'}`
  ).trim();

  const resolvedBuyerPhone = (
    cachedBuyer?.buyerPhone ||
    cachedBuyer?.phone ||
    parsedBuyerPhone ||
    buyerPhoneMap?.get(bOrd.buyerId) ||
    bOrd.buyerPhone ||
    (currentRole === 'buyer' ? (currentUser?.phone || '') : '') ||
    ''
  ).trim();

  const resolvedSellerName = (
    bOrd.sellerName ||
    sellerNameMap?.get(bOrd.sellerId) ||
    matchedListing.sellerName ||
    (currentRole === 'seller' ? (currentUser?.name || 'Người Bán') : 'Người Bán')
  ).trim();

  const buyerAddr = (currentUser && currentUser.id === bOrd.buyerId && (currentUser.address || currentUser.pickupAddress))
    ? (currentUser.address || currentUser.pickupAddress || '')
    : typeof bOrd.deliveryAddress === 'string'
      ? (parsedAddressObj?.address || bOrd.deliveryAddress)
      : bOrd.deliveryAddress?.detailAddress
        ? `${bOrd.deliveryAddress.detailAddress}, ${bOrd.deliveryAddress.wardName || ''}, ${bOrd.deliveryAddress.provinceName || ''}`
        : (cachedBuyer?.buyerAddress || currentUser?.address || (isInspectionOrder && bOrd.orderType !== 'AT_HOME' ? 'Trạm Kiểm Định SecondLife Hub' : 'Địa chỉ nhận hàng của người mua'));

  const itemPrice = Number(bOrd.itemPriceVnd || bOrd.finalItemPrice || bOrd.postPrice || bOrd.finalPrice || bOrd.price || bOrd.listing?.priceVnd || matchedListing?.priceVnd || 0);
  const shipFee = Number(bOrd.shippingFeeVnd || bOrd.shippingFee || bOrd.finalShippingFee || 0);
  const totalPaid = Number(bOrd.totalPaidVnd || bOrd.totalPaid || (itemPrice + inspFee + shipFee));

  let resolvedInspectorId = bOrd.inspectorId;
  let resolvedInspectorName = bOrd.inspectorName;
  let resolvedInspectorEmail = (bOrd as any).inspectorEmail;
  let resolvedInspectorPhone = (bOrd as any).inspectorPhone;
  try {
    const rawAssign = localStorage.getItem(`order_assigned_inspector_${bOrd.id}`);
    if (rawAssign) {
      const assignData = JSON.parse(rawAssign);
      resolvedInspectorId = assignData.inspectorId || resolvedInspectorId;
      resolvedInspectorName = assignData.inspectorName || resolvedInspectorName;
      resolvedInspectorEmail = assignData.inspectorEmail || resolvedInspectorEmail;
      resolvedInspectorPhone = assignData.inspectorPhone || resolvedInspectorPhone;
    }
  } catch {}

  const rawInspOrder = (bOrd as any).inspectionOrder || {};
  const resolvedFeePayer = bOrd.feePayer || (bOrd as any).counterFeePayer || rawInspOrder.feePayer || undefined;
  const resolvedFeeSplit: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100' =
    bOrd.inspectionFeeSplit ||
    rawInspOrder.inspectionFeeSplit ||
    (resolvedFeePayer === 'SELLER_PAYS' ? 'SELLER_100' :
     resolvedFeePayer === 'SPLIT_50_50' ? 'SPLIT_50_50' :
     resolvedFeePayer === 'BUYER_PAYS' ? 'BUYER_100' :
     (bOrd.sellerFeeShare && Number(bOrd.sellerFeeShare) > 0 && bOrd.buyerFeeShare && Number(bOrd.buyerFeeShare) > 0) ? 'SPLIT_50_50' :
     (bOrd.sellerFeeShare && Number(bOrd.sellerFeeShare) > 0) ? 'SELLER_100' : 'BUYER_100');

  const resolvedSellerFeeShare = bOrd.sellerFeeShare !== undefined && bOrd.sellerFeeShare !== null
    ? Number(bOrd.sellerFeeShare)
    : ((bOrd as any).sellerInspectionFeeVnd !== undefined && (bOrd as any).sellerInspectionFeeVnd !== null
      ? Number((bOrd as any).sellerInspectionFeeVnd)
      : (rawInspOrder.sellerFeeShare !== undefined ? Number(rawInspOrder.sellerFeeShare) :
        (resolvedFeeSplit === 'SPLIT_50_50' ? Math.round(inspFee / 2) : (resolvedFeeSplit === 'SELLER_100' ? inspFee : 0))));

  const resolvedBuyerFeeShare = bOrd.buyerFeeShare !== undefined && bOrd.buyerFeeShare !== null
    ? Number(bOrd.buyerFeeShare)
    : ((bOrd as any).buyerInspectionFeeVnd !== undefined && (bOrd as any).buyerInspectionFeeVnd !== null
      ? Number((bOrd as any).buyerInspectionFeeVnd)
      : (rawInspOrder.buyerFeeShare !== undefined ? Number(rawInspOrder.buyerFeeShare) :
        (resolvedFeeSplit === 'SPLIT_50_50' ? Math.round(inspFee / 2) : (resolvedFeeSplit === 'BUYER_100' ? inspFee : 0))));

  const resolvedPaymentDeadline = bOrd.paymentDeadline || rawInspOrder.paymentDeadline || null;
  const resolvedBuyerPaidAt = bOrd.buyerPaidAt || (bOrd as any).buyer_paid_at || rawInspOrder.buyerPaidAt || null;
  const resolvedSellerPaidAt = bOrd.sellerPaidAt || (bOrd as any).seller_paid_at || rawInspOrder.sellerPaidAt || null;

  const mappedOrder: EscrowOrder = {
    id: bOrd.id,
    listingId: bOrd.postId,
    listing: matchedListing,
    buyerId: bOrd.buyerId,
    buyerName: resolvedBuyerName,
    buyerPhone: resolvedBuyerPhone,
    buyerAddress: buyerAddr,
    sellerId: bOrd.sellerId,
    sellerName: resolvedSellerName,
    itemPriceVnd: itemPrice,
    inspectionFeeVnd: inspFee,
    shippingFeeVnd: shipFee,
    platformFeeVnd: 0,
    totalPaidVnd: totalPaid,
    escrowStatus: isCompletedOrReleased ? 'COMPLETED_RELEASED' : (isCancelledOrRefund ? 'REFUNDED_TO_BUYER' : mappedEscrowStatus),
    backendStatus: isCompletedOrReleased ? 'COMPLETED' : (isCancelledOrRefund ? 'CANCELLED' : ((mappedEscrowStatus === 'INSPECTION_PASSED' ? 'PASSED' : mappedEscrowStatus === 'INSPECTION_FAILED' ? 'FAILED' : bOrd.backendStatus || bOrd.status || (isInspectionOrder ? 'WAITING_SELLER_APPROVAL' : 'PROCESSING')) as any)),
    status: isCompletedOrReleased ? 'COMPLETED' : (isCancelledOrRefund ? 'CANCELLED' : (mappedEscrowStatus === 'INSPECTION_PASSED' ? 'PASSED' : mappedEscrowStatus === 'INSPECTION_FAILED' ? 'FAILED' : (bOrd.status || bOrd.backendStatus || 'INSPECTING'))),
    inspectorId: resolvedInspectorId || undefined,
    inspectorName: resolvedInspectorName || undefined,
    inspectorEmail: resolvedInspectorEmail || undefined,
    inspectorPhone: resolvedInspectorPhone || undefined,
    shippingQuoteId: bOrd.shippingQuoteId,
    shippingDeliveredAt: bOrd.shippingDeliveredAt,
    deliveryAddress: bOrd.deliveryAddress,
    sellerConfirmedAt: (() => {
      const inspStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
      const isInspConfirmedBySeller = isInspectionOrder && (
        bOrd.sellerConsentZin === true ||
        (Boolean(inspStatusUpper) && !['WAITING_SELLER_APPROVAL', 'PENDING'].includes(inspStatusUpper))
      );
      return isInspConfirmedBySeller
        ? (bOrd.sellerPaidAt || bOrd.updatedAt || bOrd.createdAt || new Date().toISOString())
        : (bOrd.sellerConfirmedAt || null);
    })(),
    confirmationDeadline: bOrd.confirmationDeadline || null,
    confirmationCancelAt: bOrd.confirmationCancelAt || null,
    confirmationStatus: (() => {
      const inspStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
      const isInspConfirmedBySeller = isInspectionOrder && (
        bOrd.sellerConsentZin === true ||
        (Boolean(inspStatusUpper) && !['WAITING_SELLER_APPROVAL', 'PENDING'].includes(inspStatusUpper))
      );
      return isInspConfirmedBySeller
        ? 'CONFIRMED'
        : (bOrd.confirmationStatus || (bOrd.sellerConfirmedAt ? 'CONFIRMED' : 'PENDING'));
    })(),
    sellerReadyAt: (bOrd as any).sellerReadyAt || null,
    carrierPickedUpAt: (bOrd as any).carrierPickedUpAt || null,
    handoverDeadline: (bOrd as any).handoverDeadline || null,
    appointmentScheduledAt: bOrd.appointmentScheduledAt || bOrd.scheduledAt || null,
    appointmentNote: bOrd.appointmentNote || bOrd.note || null,
    counterScheduledAt: bOrd.counterScheduledAt || (bOrd as any).counter_scheduled_at || rawInspOrder.counterScheduledAt || null,
    counterShift: bOrd.counterShift || (bOrd as any).counter_shift || rawInspOrder.counterShift || null,
    counterNote: bOrd.counterNote || (bOrd as any).counter_note || rawInspOrder.counterNote || null,
    appointmentStatus: bOrd.appointmentStatus || (bOrd as any).appointment_status || rawInspOrder.appointmentStatus || null,
    appointmentRejectionReason: bOrd.appointmentRejectionReason || rawInspOrder.appointmentRejectionReason || null,
    inspectionOrderId: bOrd.inspectionOrderId || (bOrd as any).inspectionOrderId || rawInspOrder.id || (bOrd.__isInspection ? bOrd.id : null),
    cancellationReasonCode: isCompletedOrReleased ? null : (bOrd.cancellationReasonCode || (bOrd as any).cancelReasonCode || (() => {
      try {
        const rawCancel = localStorage.getItem(`order_cancellation_info_${bOrd.id}`);
        if (rawCancel) return JSON.parse(rawCancel).reasonCode;
      } catch {}
      return null;
    })()),
    cancellationReason: isCompletedOrReleased ? null : ((bOrd as any).cancellationReason || (bOrd as any).cancelReason || (() => {
      try {
        const rawCancel = localStorage.getItem(`order_cancellation_info_${bOrd.id}`);
        if (rawCancel) return JSON.parse(rawCancel).reason;
      } catch {}
      return null;
    })()),
    cancelledBy: isCompletedOrReleased ? null : (bOrd.cancelledBy || null),
    hasInspectionService: isInspectionOrder,
    feePayer: resolvedFeePayer,
    inspectionFeeSplit: resolvedFeeSplit,
    sellerFeeShare: resolvedSellerFeeShare,
    buyerFeeShare: resolvedBuyerFeeShare,
    cashShippingSimulation: bOrd.cashShippingSimulation ?? rawInspOrder.cashShippingSimulation,
    sellerInspectionFeeVnd: resolvedSellerFeeShare,
    buyerInspectionFeeVnd: resolvedBuyerFeeShare,
    sellerPaidAt: resolvedSellerPaidAt,
    buyerPaidAt: resolvedBuyerPaidAt,
    paymentDeadline: resolvedPaymentDeadline,
    finalPaymentDeadline: (bOrd as any).finalPaymentDeadline || rawInspOrder.finalPaymentDeadline || null,
    buyerCommitmentDeposit: bOrd.buyerCommitmentDeposit !== undefined ? Number(bOrd.buyerCommitmentDeposit) : (rawInspOrder.buyerCommitmentDeposit !== undefined ? Number(rawInspOrder.buyerCommitmentDeposit) : 0),
    returnShippingReserveFee: bOrd.returnShippingReserveFee !== undefined ? Number(bOrd.returnShippingReserveFee) : (rawInspOrder.returnShippingReserveFee !== undefined ? Number(rawInspOrder.returnShippingReserveFee) : 0),
    feeSettledAt: bOrd.feeSettledAt || rawInspOrder.feeSettledAt || null,
    returnReserveStatus: (bOrd as any).returnReserveStatus || (rawInspOrder as any).returnReserveStatus || (bOrd as any).returnReserve?.status || (rawInspOrder as any).returnReserve?.status || null,
    inspectionCenterId: bOrd.inspectionCenterId || (bOrd as any).inspectionCenter?.id || rawInspOrder.inspectionCenterId || undefined,
    inspectionCenterName: bOrd.inspectionCenterName || (bOrd as any).inspectionCenter?.name || rawInspOrder.inspectionCenterName || undefined,
    inspectionCenterAddress: bOrd.inspectionCenterAddress || (bOrd as any).inspectionCenter?.address || rawInspOrder.inspectionCenterAddress || undefined,
    inspectionCenterPhone: bOrd.inspectionCenterPhone || (bOrd as any).inspectionCenter?.phone || rawInspOrder.inspectionCenterPhone || undefined,
    inspectionStatus: bOrd.__isInspection ? customerInspectionStatus : undefined,
    inspectionNote: bOrd.__isInspection ? bOrd.note : undefined,
    linkedOrderId: bOrd.__isInspection ? bOrd.linkedOrderId : undefined,
    finalPaymentPaidAt: bOrd.__isInspection ? bOrd.finalPaymentPaidAt : undefined,
    homeCheckedInAt: bOrd.homeCheckedInAt,
    inspectionMethod: isInspectionOrder
      ? ((bOrd.orderType === 'AT_HOME' || bOrd.inspectionMethod === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER')
      : undefined,
    shippingLegs: (isInspectionOrder && bOrd.orderType !== 'AT_HOME')
      ? [
          {
            id: 'LEG-1',
            legType: 'SELLER_TO_CENTER',
            carrier: 'Lalamove',
            trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
            status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
            origin: (bOrd as any).sellerAddress || matchedListing.sellerAddress || (matchedListing.location && matchedListing.location !== 'Đà Nẵng, Việt Nam' ? matchedListing.location : null) || 'Địa chỉ kho người bán',
            destination: (bOrd as any).inspectionCenterAddress || resolveInspectionCenter(bOrd).address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh',
            estimatedDelivery: 'Trong ngày',
            timeline: [
              {
                timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                description: 'Khởi tạo đơn hàng kiểm định Hub. Chờ bưu tá Lalamove chuyển kiện hàng về Hub.',
                location: 'Hệ thống SecondLife Hub'
              }
            ]
          },
          {
            id: 'LEG-2',
            legType: 'CENTER_TO_BUYER',
            carrier: 'Lalamove',
            trackingNumber: '',
            status: 'PENDING',
            origin: (bOrd as any).inspectionCenterAddress || resolveInspectionCenter(bOrd).address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh',
            destination: buyerAddr,
            estimatedDelivery: 'Giao nhanh trong ngày sau kiểm định',
            timeline: [
              {
                timestamp: '--:--',
                description: 'Chờ hoàn tất kiểm định tại Hub và niêm phong giao đến người mua.',
                location: buyerAddr
              }
            ]
          }
        ]
      : (isInspectionOrder && bOrd.orderType === 'AT_HOME')
      ? [
          {
            id: 'LEG-1',
            legType: 'SELLER_TO_BUYER',
            carrier: 'SecondLife On-site Team',
            trackingNumber: '',
            status: 'PENDING',
            origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
            destination: 'Kiểm định tại nhà người bán',
            estimatedDelivery: 'Kỹ sư đến tận nơi theo lịch hẹn',
            timeline: [
              {
                timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                description: 'Cử chuyên viên kỹ thuật đến kiểm định on-site tại nhà người bán.',
                location: 'Địa chỉ kho người bán'
              }
            ]
          },
          {
            id: 'LEG-2',
            legType: 'SELLER_TO_BUYER',
            carrier: 'Lalamove',
            trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
            status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
            origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
            destination: buyerAddr,
            estimatedDelivery: 'Giao ngay sau khi kiểm định đạt chuẩn',
            timeline: [
              {
                timestamp: '--:--',
                description: 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong.',
                location: buyerAddr
              }
            ]
          }
        ]
      : [
          {
            id: 'LEG-1',
            legType: 'SELLER_TO_BUYER',
            carrier: 'Lalamove',
            trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
            status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
            origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
            destination: buyerAddr,
            estimatedDelivery: '1 - 2 ngày',
            timeline: [
              {
                timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                description: `Khởi tạo đơn hàng giao trực tiếp. Trạng thái: ${bOrd.status || 'PROCESSING'}.`,
                location: 'Hệ thống Vận chuyển Lalamove'
              }
            ]
          }
        ],
    createdAt: bOrd.createdAt || bOrd.createdDate || bOrd.created_at || bOrd.paidAt || bOrd.sellerConfirmedAt || bOrd.updatedAt || new Date().toISOString(),
    multiStagePhotos: {
      listingPhotos: Array.from(new Set([
        ...((bOrd as any).postImageUrls || []),
        (bOrd as any).postImageUrl,
        ...(matchedListing.photoGallery || []),
        matchedListing.photos?.front,
        matchedListing.photos?.back,
        matchedListing.photos?.screenOrDetails,
        matchedListing.photos?.accessoriesOrBox,
        matchedListing.photos?.serialOrReceipt,
      ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0))),
      inspectorPhotos: Array.isArray((bOrd as any).inspectorPhotos) && (bOrd as any).inspectorPhotos.length > 0
        ? (bOrd as any).inspectorPhotos
        : (Array.isArray((bOrd as any).proofPhotos) && (bOrd as any).proofPhotos.length > 0
          ? (bOrd as any).proofPhotos
          : []),
      handoverPhotos: (bOrd as any).tamperSealPhoto ? [(bOrd as any).tamperSealPhoto] : [],
    }
  };
  if (!authoritative && isCompletedOrReleased && typeof window !== 'undefined') {
    try {
      localStorage.setItem(`order_receipt_confirmed_${bOrd.id}`, 'true');
      localStorage.removeItem(`order_cancellation_info_${bOrd.id}`);
    } catch {}
  }
  return mappedOrder;
}

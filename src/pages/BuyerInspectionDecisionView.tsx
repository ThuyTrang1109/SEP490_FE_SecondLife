import { buyerFeePercentFor, feePercentLabel } from '../utils/inspectionFeePercent';
import { paths } from '../app/router/paths';
import { navigatePath } from '../app/router/browser';
import { chatService } from '../services/chatService';
import React, { useState, useEffect, useMemo } from 'react';
import { EscrowOrder, Language, UserProfile } from '../types';
import { formatConditionGrade, formatVND } from '../utils/translations';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Store,
  Phone,
  QrCode,
  FileCheck,
  Award,
  Video,
  VideoOff,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ChevronRight,
  Wallet,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare,
  Truck,
  RotateCcw,
  Building2,
  Package
} from 'lucide-react';
import { CreateShipmentModal } from '../components/modals/CreateShipmentModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { readOrderAppointment } from '../utils/orders/orderAppointments';
import { DigitalInspectionCertificateModal, buildInspectionReportFromDto } from '../components/modals/DigitalInspectionCertificateModal';
import { inspectorService, InspectionOrderDto } from '../services/inspectorService';
import { getOrderFeed } from '../services/orderFeedService';
import { shippingService } from '../services/shippingService';
import { ShipmentBackend, ShippingQuoteResponseDto } from '../types';
import { walletService, WalletBackend, notifyWalletBalanceUpdated } from '../services/walletService';
import { saveScopedLocalNotification } from '../utils/notificationStorage';
import { markListingInspectionPassed } from '../utils/listingInspection';
import { getCustomerInspectionStatus, getInspectionPurchaseDecision, inspectionPurchaseDecisionLabel, isExpiredInspectionPurchase, extractInspectionRejectionDetails, parseInspectorVerdictNote } from '../utils/inspectionPurchase';
import { notificationWsClient } from '../services/notificationWsClient';
import { getInspectionBuyerDestination, getInspectionDecisionStatus, getInspectionReportMedia, getInspectionStageOne, getInspectionStageTwo } from '../utils/inspectionDecisionData';
import { canAppealInspection, getHubReturnProgress, getHubReturnState, getReturnReserveMessage, isHubReturnCase, getInboundShipmentProgress, getLatestInboundShipment } from '../utils/inspectionCenterData';
import { getOrderAllShipments } from '../utils/orders/shipmentCache';
import { isOrderReceivedAtHub } from './ProductInspectionStationView';
import { LalamoveProgress } from '../components/common/LalamoveProgress';
import { resolveInspectionCenter } from '../utils/orderUtils';

const formatAmount = (amount: number | null | undefined) => amount == null ? 'Chưa có dữ liệu' : formatVND(amount);

interface BuyerInspectionDecisionViewProps {
  orderId?: string;
  order?: EscrowOrder | null;
  currentUser?: UserProfile | null;
  userRole?: string;
  lang?: Language;
  onBack: () => void;
  onSuccess?: () => void;
  onOpenChat?: (listing: any) => void;
  onOpenTopUp?: () => void;
}

const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  return null;
};

export const BuyerInspectionDecisionView: React.FC<BuyerInspectionDecisionViewProps> = ({
  orderId,
  order,
  currentUser,
  userRole,
  lang = 'vi',
  onBack,
  onSuccess,
  onOpenChat,
  onOpenTopUp,
}) => {
  const effectiveOrderId = orderId || (order as any)?.inspectionOrderId || order?.id || '';
  const [inspectionDto, setInspectionDto] = useState<InspectionOrderDto | null>(null);
  const [wallet, setWallet] = useState<WalletBackend | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertNotice, setAlertNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deliveryQuote, setDeliveryQuote] = useState<{
    key: string;
    address: string;
    quote: ShippingQuoteResponseDto | null;
  } | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);

  // Return shipment states
  const confirmRequestIdRef = React.useRef<string | null>(null);
  const [returnShipment, setReturnShipment] = useState<ShipmentBackend | null>(null);
  const [createdLinkedOrderId, setCreatedLinkedOrderId] = useState<string | null>(null);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showShipmentModal, setShowShipmentModal] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');

  const isOtherRejectReason = selectedRejectReason === 'Lý do khác';
  const rejectWords = customRejectNote.trim() ? customRejectNote.trim().split(/\s+/).filter(Boolean) : [];
  const rejectWordCount = rejectWords.length;
  const isRejectNoteValid = rejectWordCount > 10 && rejectWordCount < 50;

  // Tab state for report view
  const [activeReportTab, setActiveReportTab] = useState<'checklist' | 'media' | 'verdict'>('checklist');
  const [unavailableMediaUrls, setUnavailableMediaUrls] = useState<ReadonlySet<string>>(() => new Set());

  // Load the inspection report independently of the buyer's wallet.
  useEffect(() => {
    if (!effectiveOrderId) return;
    let request: AbortController | undefined;
    const fetchData = async (isBackground = false) => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      if (!isBackground) setIsLoading(true);
      try {
        const dto = await inspectorService.getOrder(effectiveOrderId, { signal: controller.signal, isBackground, bypassCache: true });
        if (!controller.signal.aborted && dto) {
          setInspectionDto(dto);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        if (!controller.signal.aborted) {
          console.warn('Direct getOrder failed, attempting fallback to find order:', err);
          try {
            const feed = await getOrderFeed({ filter: 'all', perspective: 'all', q: '', page: 0 }, effectiveOrderId, controller.signal);
            if (!controller.signal.aborted && feed.detail?.inspection) {
              setInspectionDto(feed.detail.inspection);
              return;
            }
            const foundItem = feed.items?.find((item) =>
              String(item.order?.id || '').toLowerCase() === effectiveOrderId.toLowerCase() ||
              String(item.inspection?.id || '').toLowerCase() === effectiveOrderId.toLowerCase()
            );
            if (!controller.signal.aborted && foundItem?.inspection) {
              setInspectionDto(foundItem.inspection);
              return;
            }
            if (!controller.signal.aborted && foundItem?.order) {
              const ord = foundItem.order as any;
              setInspectionDto({
                id: ord.inspectionOrderId || ord.id,
                postId: ord.listingId || ord.post?.id,
                postTitle: ord.listing?.title || ord.productTitle || '',
                postPrice: ord.itemPriceVnd || 0,
                postImageUrls: ord.listing?.images || (ord.productImageUrl ? [ord.productImageUrl] : []),
                status: (ord.inspectionStatus || ord.backendStatus || ord.status || 'PENDING') as any,
                note: ord.note || ord.inspectionNote || '',
                inspectionFee: ord.inspectionFeeVnd || 0,
                shippingFee: ord.shippingFeeVnd || 0,
                returnShippingReserveFee: ord.returnShippingReserveFee || 0,
                buyerFeePercent: ord.buyerFeePercent,
                buyerFeeShare: ord.buyerFeeShare,
                sellerFeeShare: ord.sellerFeeShare,
                feePayer: ord.feePayer || 'SPLIT_50_50',
                orderType: ord.inspectionMethod || ord.orderType || 'AT_CENTER',
                centerName: ord.inspectionCenterName,
                centerAddress: ord.inspectionCenterAddress,
                buyerId: ord.buyerId,
                sellerId: ord.sellerId,
                sellerName: ord.sellerName,
                buyerName: ord.buyerName,
              } as any);
              return;
            }
          } catch (feedErr) {
            console.warn('Order feed fallback failed:', feedErr);
          }
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void fetchData();
    const unsubscribe = notificationWsClient.subscribeListener((notification) => {
      if (notification.referenceType === 'INSPECTION_ORDER' && notification.referenceId === effectiveOrderId) void fetchData(true);
    });
    return () => { unsubscribe(); request?.abort(); };
  }, [effectiveOrderId]);

  // Fallback to synthesize inspectionDto from order if inspectionDto is not yet loaded
  useEffect(() => {
    if (order && !inspectionDto) {
      const ord = order as any;
      setInspectionDto((prev) => prev || ({
        id: ord.inspectionOrderId || ord.id,
        postId: ord.listingId || ord.post?.id,
        postTitle: ord.listing?.title || ord.productTitle || ord.post?.title || '',
        postPrice: ord.itemPriceVnd || ord.productPrice || ord.post?.price || 0,
        postImageUrls: ord.listing?.images || ord.post?.imageUrls || (ord.productImageUrl ? [ord.productImageUrl] : []),
        status: (ord.inspectionStatus || ord.backendStatus || ord.status || 'PENDING') as any,
        note: ord.note || ord.inspectionNote || '',
        inspectionFee: ord.inspectionFeeVnd || ord.inspectionFee,
        shippingFee: ord.shippingFeeVnd || ord.shippingFee,
        returnShippingReserveFee: ord.returnShippingReserveFee,
        buyerFeePercent: ord.buyerFeePercent,
        buyerFeeShare: ord.buyerFeeShare,
        sellerFeeShare: ord.sellerFeeShare,
        feePayer: ord.feePayer,
        orderType: ord.inspectionMethod || ord.orderType || (ord.isAtHome ? 'AT_HOME' : 'AT_CENTER'),
        centerName: ord.inspectionCenterName || ord.centerName,
        centerAddress: ord.inspectionCenterAddress || ord.centerAddress,
        buyerId: ord.buyerId,
        sellerId: ord.sellerId,
        sellerName: ord.sellerName,
        buyerName: ord.buyerName,
      } as any));
    }
  }, [order, inspectionDto]);

  // Status & Role Resolution
  const { status: backendStatus, isFailed, isCancellationStatus } = getInspectionDecisionStatus(order, inspectionDto);
  const escrowStatus = String(order?.escrowStatus || '').toUpperCase();

  const rejectionDetails = extractInspectionRejectionDetails(
    inspectionDto?.note || (order as any)?.note || (order as any)?.inspectionNote
  );
  const purchaseDecision = isFailed ? null : getInspectionPurchaseDecision(order, inspectionDto);
  const purchaseExpired = isExpiredInspectionPurchase(inspectionDto?.status, inspectionDto?.note);
  const isBuyerPurchaseRejected = !isFailed && (purchaseDecision === 'rejected' || rejectionDetails.isBuyerPurchaseRejected);
  const decisionSettled = purchaseDecision === 'accepted' || purchaseDecision === 'rejected' || purchaseExpired || isBuyerPurchaseRejected;

  const isCancelled = !isBuyerPurchaseRejected && isCancellationStatus;

  const isPassed = !isFailed && !isCancelled && (purchaseDecision !== null || purchaseExpired || isBuyerPurchaseRejected);
  const customerStatus = getCustomerInspectionStatus(backendStatus, inspectionDto?.customerStatus,
    inspectionDto ? inspectionDto.inspectorId : order?.inspectorId);
  const isInspecting = !isPassed && !isFailed && !isCancelled && !isBuyerPurchaseRejected && (customerStatus === 'INSPECTING' || customerStatus === 'INSPECTION_IN_PROGRESS');
  const isPending = !isPassed && !isFailed && !isInspecting && !isCancelled && !isBuyerPurchaseRejected;
  const hasInspectionResult = Boolean(
    isPassed ||
    isFailed ||
    purchaseDecision !== null ||
    purchaseExpired ||
    inspectionDto?.conditionGrade ||
    (order as any)?.conditionGrade ||
    (order as any)?.inspectionReport ||
    backendStatus === 'PASSED' ||
    backendStatus === 'FAILED' ||
    backendStatus === 'COMPLETED'
  );
  const isAtHome = inspectionDto?.orderType === 'AT_HOME' ||
    (inspectionDto as any)?.inspectionMethod === 'AT_HOME' ||
    (order as any)?.inspectionMethod === 'AT_HOME' ||
    (order as any)?.orderType === 'AT_HOME';

  const isReceiptConfirmed = Boolean(
    (order as any)?.receiptConfirmedAt ||
    (inspectionDto as any)?.receiptConfirmedAt ||
    (typeof window !== 'undefined' && effectiveOrderId && (
      localStorage.getItem(`order_receipt_confirmed_${effectiveOrderId}`) === 'true' ||
      ((order as any)?.linkedOrderId && localStorage.getItem(`order_receipt_confirmed_${(order as any).linkedOrderId}`) === 'true') ||
      (inspectionDto?.linkedOrderId && localStorage.getItem(`order_receipt_confirmed_${inspectionDto.linkedOrderId}`) === 'true')
    ))
  );

  const isOrderCompleted = Boolean(
    isReceiptConfirmed ||
    backendStatus === 'COMPLETED' ||
    backendStatus === 'RELEASED' ||
    backendStatus === 'COMPLETED_RELEASED' ||
    escrowStatus === 'COMPLETED_RELEASED' ||
    escrowStatus === 'RELEASED' ||
    (inspectionDto as any)?.status === 'COMPLETED' ||
    (() => {
      if (typeof window === 'undefined' || !effectiveOrderId) return false;
      const targetIds = [effectiveOrderId, (order as any)?.linkedOrderId, inspectionDto?.linkedOrderId].filter(Boolean);
      for (const storageKey of ['recent_placed_orders', 'center_inspection_orders', 'my_seller_inspection_orders']) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const found = list.find((o: any) => targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId) || targetIds.includes(o.inspectionOrderId));
              if (found && (found.escrowStatus === 'COMPLETED_RELEASED' || found.escrowStatus === 'RELEASED' || found.status === 'COMPLETED' || found.receiptConfirmedAt)) {
                return true;
              }
            }
          }
        } catch { }
      }
      return false;
    })()
  );

  const isOrderDelivered = Boolean(
    !isOrderCompleted && (
      (order as any)?.shippingDeliveredAt ||
      (inspectionDto as any)?.shippingDeliveredAt ||
      escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
      backendStatus === 'DELIVERED' ||
      (() => {
        if (typeof window === 'undefined' || !effectiveOrderId) return false;
        const targetIds = [effectiveOrderId, (order as any)?.linkedOrderId, inspectionDto?.linkedOrderId].filter(Boolean);
        for (const storageKey of ['recent_placed_orders', 'center_inspection_orders', 'my_seller_inspection_orders']) {
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const found = list.find((o: any) => targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId) || targetIds.includes(o.inspectionOrderId));
                if (found && (found.shippingDeliveredAt || found.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || found.backendStatus === 'DELIVERED')) {
                  return true;
                }
              }
            }
          } catch { }
        }
        return false;
      })()
    )
  );

  const [inboundShipment, setInboundShipment] = useState<ShipmentBackend | null>(() => {
    if (typeof window === 'undefined' || !effectiveOrderId) return null;
    const all = getOrderAllShipments(effectiveOrderId);
    return getLatestInboundShipment(all);
  });

  const isInboundDelivered = Boolean(
    !isAtHome && !isPassed && !isFailed && !isCancelled && !isBuyerPurchaseRejected && !decisionSettled && !isOrderCompleted && !isOrderDelivered && (
      isOrderReceivedAtHub(inspectionDto) ||
      isOrderReceivedAtHub(order) ||
      (typeof window !== 'undefined' && localStorage.getItem(`hub_package_received_${effectiveOrderId}`) === 'true') ||
      (inboundShipment && (
        inboundShipment.status === 'DELIVERED' ||
        inboundShipment.status === 'COMPLETED' ||
        inboundShipment.providerStatus === 'COMPLETED' ||
        getInboundShipmentProgress(inboundShipment).step === 3
      ))
    )
  );

  const isShippingToCenter = !isPassed && !isFailed && !isInspecting && !isCancelled && !isInboundDelivered && (
    backendStatus === 'SHIPPING_TO_CENTER' ||
    Boolean((order as any)?.shippingTrackingCode) ||
    Boolean((order as any)?.inboundTrackingCode) ||
    (inboundShipment && inboundShipment.status !== 'CANCELLED' && getInboundShipmentProgress(inboundShipment).step !== null) ||
    (typeof window !== 'undefined' && (
      localStorage.getItem(`order_shipment_created_${effectiveOrderId}`) === 'true' ||
      localStorage.getItem(`seller_shipped_to_hub_${effectiveOrderId}`) === 'true'
    ))
  );

  const escrowOrderForShipment = useMemo<EscrowOrder | null>(() => {
    if (!order && !inspectionDto) return null;
    return {
      ...(order || {}),
      id: effectiveOrderId,
      orderType: (inspectionDto?.orderType as any) || (order as any)?.orderType || 'AT_CENTER',
      inspectionMethod: (inspectionDto?.orderType as any) || (order as any)?.orderType || 'AT_CENTER',
      hasInspectionService: true,
      inspectionFeeVnd: inspectionDto?.inspectionFee || order?.inspectionFeeVnd || 0,
      inspectionCenterId: inspectionDto?.inspectionCenterId || order?.inspectionCenterId,
      inspectionCenterName: (inspectionDto as any)?.centerName || (order as any)?.inspectionCenterName,
      listing: (order?.listing || {
        id: inspectionDto?.postId,
        title: inspectionDto?.postTitle,
        priceVnd: inspectionDto?.postPrice,
        photos: { front: inspectionDto?.postImageUrl },
      }) as any,
      sellerId: inspectionDto?.sellerId || order?.sellerId,
      sellerName: inspectionDto?.sellerName || order?.sellerName || 'Người bán',
      sellerPhone: (inspectionDto as any)?.sellerPhone || (order as any)?.sellerPhone || '0912345678',
      buyerId: inspectionDto?.buyerId || order?.buyerId,
      buyerName: inspectionDto?.buyerName || order?.buyerName || 'Người mua',
      buyerPhone: (inspectionDto as any)?.buyerPhone || (order as any)?.buyerPhone || '0987654321',
      totalAmount: (inspectionDto?.postPrice || (order as any)?.totalAmount || 0),
      itemTitle: inspectionDto?.postTitle || (order as any)?.itemTitle || 'Sản phẩm',
      inspectionStatus: (inspectionDto?.status as any) || (order as any)?.inspectionStatus,
      status: (inspectionDto?.status as any) || order?.status || 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: (inspectionDto?.status as any) || order?.backendStatus || 'CONFIRMED_PENDING_DISPATCH',
      customerStatus: (inspectionDto as any)?.customerStatus || (order as any)?.customerStatus,
      conditionScore: inspectionDto?.conditionScore ?? (order as any)?.conditionScore,
      conditionGrade: inspectionDto?.conditionGrade || (order as any)?.conditionGrade,
      tamperSealId: inspectionDto?.tamperSealId || (order as any)?.tamperSealId,
      inspectorName: inspectionDto?.inspectorName || (order as any)?.inspectorName,
      evidencePhotoUrls: inspectionDto?.evidencePhotoUrls || (order as any)?.evidencePhotoUrls,
      note: inspectionDto?.note || (order as any)?.note,
      checklistResultJson: inspectionDto?.checklistResultJson || (order as any)?.checklistResultJson,
      inspectionReport: inspectionDto ? buildInspectionReportFromDto(inspectionDto, order) : (order?.inspectionReport),
      escrowStatus: 'CONFIRMED_PENDING_DISPATCH',
      createdAt: inspectionDto?.createdAt || order?.createdAt || new Date().toISOString(),
      updatedAt: inspectionDto?.updatedAt || order?.updatedAt || new Date().toISOString(),
    } as unknown as EscrowOrder;
  }, [order, inspectionDto, effectiveOrderId]);

  const currentAppt = useMemo(() => {
    return readOrderAppointment(escrowOrderForShipment || (order as any), inspectionDto);
  }, [escrowOrderForShipment, order, inspectionDto]);

  const hasValidApptDate = Boolean(
    (currentAppt?.scheduledAt && currentAppt.scheduledAt !== 'null' && currentAppt.scheduledAt !== 'undefined' && !isNaN(new Date(currentAppt.scheduledAt).getTime())) ||
    (inspectionDto?.appointmentScheduledAt && (inspectionDto.appointmentScheduledAt as any) !== 'null' && (inspectionDto.appointmentScheduledAt as any) !== 'undefined' && !isNaN(new Date(inspectionDto.appointmentScheduledAt).getTime())) ||
    (order?.appointmentScheduledAt && (order.appointmentScheduledAt as any) !== 'null' && (order.appointmentScheduledAt as any) !== 'undefined' && !isNaN(new Date(order.appointmentScheduledAt).getTime()))
  );

  let hasInsp = Boolean(
    order?.inspectorId ||
    (order as any)?.inspectorName ||
    inspectionDto?.inspectorId ||
    (inspectionDto as any)?.inspectorName
  );
  if (!hasInsp && (effectiveOrderId || order?.id) && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`order_assigned_inspector_${effectiveOrderId || order?.id}`);
      if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
    } catch { }
  }

  const isApptCountered = Boolean(
    (currentAppt?.status === 'COUNTERED_BY_CENTER' && Boolean(currentAppt?.counterScheduledAt)) ||
    Boolean(currentAppt?.counterScheduledAt) ||
    Boolean((inspectionDto as any)?.counterScheduledAt) ||
    Boolean((order as any)?.counterScheduledAt) ||
    (inspectionDto as any)?.appointmentStatus === 'COUNTERED_BY_CENTER'
  );

  const hasApptConfirmed = Boolean(
    !isApptCountered &&
    hasValidApptDate && (
      currentAppt?.status === 'CONFIRMED' ||
      (inspectionDto as any)?.appointmentStatus === 'CONFIRMED' ||
      (order as any)?.appointmentStatus === 'CONFIRMED' ||
      hasInsp
    )
  );

  const isApptPendingApproval = Boolean(
    !isApptCountered &&
    !hasApptConfirmed &&
    hasValidApptDate && (
      currentAppt?.status === 'PENDING_CENTER_CONFIRMATION' ||
      currentAppt?.status === 'PENDING_CONFIRMATION' ||
      (inspectionDto as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' ||
      (order as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
    )
  );

  const hasNoAppt = isAtHome && !isApptCountered && !hasValidApptDate;

  const currentUserId = String(currentUser?.id || '').trim().toLowerCase();
  const currentUserName = String(currentUser?.name || (currentUser as any)?.fullName || '').trim().toLowerCase();
  const currentUserEmail = String(currentUser?.email || '').trim().toLowerCase();

  const orderSellerId = String(order?.sellerId || order?.listing?.sellerId || (order?.listing as any)?.userId || (order?.listing as any)?.user?.id || inspectionDto?.sellerId || '').trim().toLowerCase();
  const orderSellerName = String(order?.sellerName || order?.listing?.sellerName || (order?.listing as any)?.seller?.name || (order?.listing as any)?.user?.fullName || inspectionDto?.sellerName || '').trim().toLowerCase();
  const orderSellerEmail = String((order as any)?.sellerEmail || (order?.listing as any)?.sellerEmail || (order?.listing as any)?.user?.email || inspectionDto?.sellerEmail || '').trim().toLowerCase();

  const isRoleSeller = (userRole && userRole.toLowerCase() === 'seller') ||
    String(currentUser?.role || '').toLowerCase() === 'seller' ||
    (Array.isArray((currentUser as any)?.roles) && (currentUser as any).roles.some((r: string) => String(r).toUpperCase().includes('SELLER')));

  const orderBuyerId = String(inspectionDto?.buyerId || order?.buyerId || '').trim().toLowerCase();
  const isUserBuyer = Boolean(currentUserId && currentUserId === orderBuyerId);
  const isUserSeller = !isUserBuyer && Boolean(
    isRoleSeller ||
    (currentUserId && orderSellerId && currentUserId === orderSellerId) ||
    (currentUserEmail && orderSellerEmail && currentUserEmail === orderSellerEmail) ||
    (currentUserName && orderSellerName && (
      currentUserName === orderSellerName ||
      orderSellerName.includes(currentUserName) ||
      currentUserName.includes(orderSellerName)
    ))
  );
  const canDecide = purchaseDecision === 'pending' && !isUserSeller;

  useEffect(() => {
    if (!canDecide || !inspectionDto) return;
    let active = true;
    walletService.getMyWallet()
      .then((balance) => { if (active) setWallet(balance); })
      .catch(() => { if (active) setWallet(null); });
    return () => { active = false; };
  }, [canDecide, inspectionDto, showConfirmModal]);

  // Dynamic Center Lookup & Immediate Fallback
  const fallbackCenter = useMemo(() => {
    const directName = (inspectionDto as any)?.centerName || (order as any)?.inspectionCenterName || (order as any)?.centerName;
    const directAddress = (inspectionDto as any)?.centerAddress || (order as any)?.inspectionCenterAddress || (order as any)?.centerAddress;
    const directPhone = (inspectionDto as any)?.centerPhone || (order as any)?.inspectionCenterPhone || (order as any)?.centerPhone;
    if (directName && directAddress) {
      return {
        name: directName,
        address: directAddress,
        phone: directPhone || '0875456654',
      };
    }
    const resolved = resolveInspectionCenter((order as any) || (inspectionDto as any));
    return {
      name: directName || resolved.name,
      address: directAddress || resolved.address,
      phone: directPhone || resolved.phone,
    };
  }, [order, inspectionDto]);

  const [resolvedCenter, setResolvedCenter] = useState<{ name: string; address?: string; phone?: string } | null>(null);

  useEffect(() => {
    const centerId = inspectionDto?.inspectionCenterId;
    if (!centerId) return;
    inspectorService.getInspectionCenters().then((centers) => {
      const found = centers.find((c) => c.id === centerId || c.id?.toLowerCase() === centerId?.toLowerCase());
      if (found) {
        setResolvedCenter({ name: found.name, address: found.address, phone: found.phone });
      }
    }).catch(() => { });
  }, [inspectionDto?.inspectionCenterId]);

  // Merge data between backend DTO and frontend order prop
  const postTitle = inspectionDto?.postTitle || order?.listing?.title || 'Thiết bị công nghệ / gia dụng';
  const postPrice = inspectionDto?.finalItemPrice || inspectionDto?.postPrice || order?.listing?.priceVnd || order?.itemPriceVnd || 0;
  const postImage = inspectionDto?.postImageUrl || inspectionDto?.postImageUrls?.[0] || order?.listing?.photos?.front || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';
  const centerName = resolvedCenter?.name || fallbackCenter.name;
  const centerAddress = resolvedCenter?.address || fallbackCenter.address;
  const centerPhone = resolvedCenter?.phone || fallbackCenter.phone;
  const inspectorName = inspectionDto?.inspectorName || (isInboundDelivered ? 'Hub đang phân công KTV' : 'Chưa có thông tin kỹ thuật viên');
  const tamperSealId = inspectionDto?.tamperSealId;
  const conditionGrade = inspectionDto?.conditionGrade || 'Chưa có đánh giá';
  const conditionScore = inspectionDto?.conditionScore;
  const buyerFeePercent = inspectionDto?.buyerFeePercent ?? buyerFeePercentFor(inspectionDto?.feePayer);
  const { base: baseInspectionFee, transport: inspectionTransportFee, reserve: returnReserveFee,
    buyerShare: buyerFeeShare, sellerShare: sellerFeeShare, total: totalInspectionFee } = getInspectionStageOne(inspectionDto);
  const buyerDestination = getInspectionBuyerDestination(inspectionDto, order, currentUser);
  const { name: recipientName, phone: recipientPhone, address: recipientAddress, latitude, longitude } = buyerDestination ?? {};
  const postId = inspectionDto?.postId;
  const deliveryQuoteKey = JSON.stringify([effectiveOrderId, postId, recipientName, recipientPhone, recipientAddress, latitude, longitude, quoteAttempt]);
  const currentDeliveryQuote = deliveryQuote?.key === deliveryQuoteKey ? deliveryQuote : null;
  const finalShippingQuote = currentDeliveryQuote?.quote ?? null;
  const displayedRecipientAddress = currentDeliveryQuote?.address || recipientAddress;

  useEffect(() => {
    setIsLoadingQuote(false);
    setQuoteError(null);
    if (!postId || !canDecide || (!recipientAddress && (latitude == null || longitude == null))) return;

    const controller = new AbortController();
    const { signal } = controller;
    setIsLoadingQuote(true);
    const loadQuote = async () => {
      try {
        const coords = latitude != null && longitude != null
          ? { latitude, longitude }
          : await shippingService.geocode(recipientAddress ?? '', signal);
        const address = recipientAddress || (await shippingService.reverseGeocode(coords.latitude, coords.longitude, signal)).address?.trim();
        if (signal.aborted) return;
        if (!address) throw new Error('Chưa thể xác định địa chỉ nhận hàng từ vị trí đã chọn.');
        setDeliveryQuote({ key: deliveryQuoteKey, address, quote: null });
        if (!recipientName || !recipientPhone) {
          throw new Error('Cần có tên và số điện thoại hợp lệ của người nhận để tính cước giao hàng.');
        }
        const quote = await shippingService.getShippingQuote({
          postId,
          deliveryAddress: { name: recipientName, phone: recipientPhone, address, latitude: coords.latitude, longitude: coords.longitude },
        }, { signal });
        if (signal.aborted) return;
        if (!quote?.quoteId || !Number.isFinite(quote.shippingFee)) throw new Error('Chưa có báo giá vận chuyển.');
        setDeliveryQuote({ key: deliveryQuoteKey, address, quote });
      } catch (err) {
        if (!signal.aborted) {
          setQuoteError(err instanceof Error ? err.message : 'Chưa thể tải báo giá vận chuyển.');
        }
      } finally {
        if (!signal.aborted) setIsLoadingQuote(false);
      }
    };
    void loadQuote();
    return () => controller.abort();
  }, [postId, canDecide, recipientName, recipientPhone, recipientAddress, latitude, longitude, deliveryQuoteKey]);

  // Ưu tiên báo giá khi hiển thị tiền hàng và cước giao đến người mua.
  const { itemPrice: stageTwoItemPrice, deliveryFee: stageTwoDeliveryFee, total: stageTwoTotal } = getInspectionStageTwo(inspectionDto, finalShippingQuote);
  const finalItemPrice = stageTwoItemPrice ?? postPrice;
  const apiDeliveryFee = stageTwoDeliveryFee ?? (order as any)?.leg2ShippingFee ?? 0;
  const finalPriceToPay = stageTwoTotal ?? (finalItemPrice + apiDeliveryFee);
  const inspectionTransportLabel = isAtHome ? 'Phí di chuyển kỹ thuật viên' : 'Cước vận chuyển giao tới trung tâm kiểm định';
  const stageTwoDeliveryRoute = (finalShippingQuote?.leg === 'CENTER_TO_BUYER' || (!isAtHome && finalShippingQuote?.leg !== 'SELLER_TO_BUYER'))
    ? 'từ Hub đến bạn'
    : 'từ người bán đến bạn';

  const isWaitingSellerApproval = !isFailed && !isCancelled && (
    backendStatus === 'WAITING_SELLER_APPROVAL' ||
    backendStatus === 'PENDING_SELLER_APPROVAL' ||
    backendStatus === 'AWAITING_SELLER_APPROVAL' ||
    inspectionDto?.status === 'WAITING_SELLER_APPROVAL' ||
    (order as any)?.status === 'WAITING_SELLER_APPROVAL' ||
    (order as any)?.inspectionStatus === 'WAITING_SELLER_APPROVAL'
  );

  const isWaitingBuyerApproval = !isFailed && !isCancelled && (
    backendStatus === 'WAITING_BUYER_APPROVAL' ||
    backendStatus === 'PENDING_BUYER_APPROVAL' ||
    backendStatus === 'AWAITING_BUYER_APPROVAL' ||
    inspectionDto?.status === 'WAITING_BUYER_APPROVAL' ||
    (order as any)?.status === 'WAITING_BUYER_APPROVAL' ||
    (order as any)?.inspectionStatus === 'WAITING_BUYER_APPROVAL'
  );

  const feesPaid = Boolean((buyerFeeShare === 0 || inspectionDto?.buyerPaidAt) && (sellerFeeShare === 0 || inspectionDto?.sellerPaidAt));

  const isWaitingFeePayment = !isFailed && !isCancelled && (
    backendStatus === 'WAITING_FEE_PAYMENT' ||
    backendStatus === 'PENDING_PAYMENT' ||
    backendStatus === 'WAITING_PAYMENT' ||
    inspectionDto?.status === 'WAITING_FEE_PAYMENT' ||
    (!feesPaid && !isWaitingSellerApproval && !isWaitingBuyerApproval && !isPassed && !isFailed && !isInspecting)
  );

  const feePaymentLabel = isCancelled ? 'ĐÃ HỦY / TỪ CHỐI'
    : inspectionDto?.feeSettledAt ? 'ĐÃ HẠCH TOÁN PHÍ KIỂM ĐỊNH'
      : isWaitingSellerApproval || isWaitingBuyerApproval ? 'CHỜ DUYỆT'
        : isInspecting ? 'ĐANG KIỂM ĐỊNH'
          : isInboundDelivered ? 'ĐÃ ĐẾN HUB KIỂM ĐỊNH'
            : isShippingToCenter ? 'ĐANG GIAO ĐẾN HUB'
              : feesPaid ? 'ĐÃ NỘP PHÍ'
                : isWaitingFeePayment ? 'CHỜ NỘP PHÍ' : 'CHƯA XÁC NHẬN NỘP PHÍ';

  // Tự động tải và đồng bộ thông tin vận chuyển Chặng 1 (Seller -> Hub)
  useEffect(() => {
    if (!effectiveOrderId || isAtHome || isPassed || isFailed || isCancelled) return;
    const controller = new AbortController();
    let timer: number;
    const fetchInbound = async () => {
      try {
        const list = await shippingService.getInspectionShipments(effectiveOrderId, { signal: controller.signal, isBackground: true });
        if (!controller.signal.aborted) {
          const latest = getLatestInboundShipment(list);
          if (latest) {
            setInboundShipment(latest);
            if (latest.status === 'DELIVERED' || latest.status === 'COMPLETED' || latest.providerStatus === 'COMPLETED' || getInboundShipmentProgress(latest).step === 3) {
              try {
                localStorage.setItem(`hub_package_received_${effectiveOrderId}`, 'true');
              } catch { }
            }
          }
          try {
            localStorage.setItem(`sl_order_shipments_${effectiveOrderId}`, JSON.stringify(list));
            localStorage.setItem(`order_shipments_${effectiveOrderId}`, JSON.stringify(list));
          } catch { }
        }
      } catch { } finally {
        if (!controller.signal.aborted && !isPassed && !isFailed && !isCancelled) {
          timer = window.setTimeout(fetchInbound, 30_000);
        }
      }
    };
    void fetchInbound();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [effectiveOrderId, isAtHome, isPassed, isFailed, isCancelled]);

  const hasHubReturn = isHubReturnCase(inspectionDto);
  useEffect(() => {
    setReturnShipment(null);
    if (!effectiveOrderId || !hasHubReturn) return;
    const controller = new AbortController();
    let timer: number;
    const refresh = async () => {
      try {
        const list = await shippingService.getInspectionShipments(effectiveOrderId, { signal: controller.signal, isBackground: true });
        if (!controller.signal.aborted) setReturnShipment(getHubReturnState(list).shipment);
      } catch { } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(refresh, 30_000);
      }
    };
    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [effectiveOrderId, hasHubReturn]);



  // Countdown timer for 6 hours final payment window based on backend finalPaymentDeadline
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!canDecide || !inspectionDto?.finalPaymentDeadline) return;
    const deadlineMs = Date.parse(inspectionDto.finalPaymentDeadline);
    if (!Number.isFinite(deadlineMs)) return;
    const calculateTimeRemaining = () => {
      const diffMs = deadlineMs - Date.now();
      if (diffMs <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return { hours, minutes, seconds, isExpired: false };
    };

    setTimeLeft(calculateTimeRemaining());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [inspectionDto?.finalPaymentDeadline, canDecide]);

  useEffect(() => {
    if (!effectiveOrderId || !canDecide || !timeLeft.isExpired || isSubmitting) return;
    const controller = new AbortController();
    let timer: number;
    const refresh = async () => {
      try {
        const dto = await inspectorService.getOrder(effectiveOrderId, { isBackground: true, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (dto.status !== 'PASSED' || dto.finalPaymentPaidAt || dto.finalPaymentDeadline !== inspectionDto?.finalPaymentDeadline) {
          setInspectionDto(dto);
          return;
        }
      } catch { }
      if (!controller.signal.aborted) timer = window.setTimeout(refresh, 15_000);
    };
    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [effectiveOrderId, canDecide, timeLeft.isExpired, isSubmitting, inspectionDto?.finalPaymentDeadline]);

  const { videoProofUrl, unboxingVideoUrl, photos: inspectorPhotos, note: inspectorNote } = useMemo(
    () => getInspectionReportMedia(inspectionDto, unavailableMediaUrls),
    [inspectionDto, unavailableMediaUrls],
  );
  const markMediaUnavailable = (url: string) => {
    setUnavailableMediaUrls((previous) => previous.has(url) ? previous : new Set(previous).add(url));
  };
  const hasAnyVideo = Boolean(videoProofUrl || unboxingVideoUrl);

  // Parse checklist results - TUYỆT ĐỐI KHÔNG dùng mock data khi chưa kiểm định
  const checklistItems = useMemo(() => {
    const jsonStr = inspectionDto?.checklistResultJson;
    if (jsonStr) {
      try {
        const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, idx: number) => ({
            id: String(item.itemId || idx),
            title: item.itemTitle || item.name || `Hạng mục ${idx + 1}`,
            status: (item.isPassed ?? item.passed) === true ? 'PASSED' :
              (item.isPassed ?? item.passed) === false ? 'FAILED' : 'Chưa có đánh giá',
            note: item.inspectorNote || item.note,
          }));
        }
      } catch { }
    }

    // Nếu chưa kiểm định thực tế thì danh sách rỗng, để giao diện hiển thị trạng thái đang chờ
    return [];
  }, [inspectionDto?.checklistResultJson]);

  // Handle Confirm Final Purchase
  const handleConfirmPurchase = async () => {
    if (!canDecide || isSubmitting || timeLeft.isExpired || !finalShippingQuote) return;
    setIsSubmitting(true);
    try {
      if (!confirmRequestIdRef.current) {
        confirmRequestIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;
      }
      let confirmedLinkedOrderId: string | null = null;
      if (effectiveOrderId) {
        const confirmRes = await inspectorService.confirmPurchase(effectiveOrderId, {
          requestId: confirmRequestIdRef.current,
          paymentMethod: 'WALLET',
          shippingQuoteId: finalShippingQuote.quoteId,
        });
        if (confirmRes) {
          setInspectionDto(confirmRes);
          confirmedLinkedOrderId = confirmRes?.linkedOrderId || (confirmRes as any)?.orderId || null;
          if (confirmedLinkedOrderId) {
            setCreatedLinkedOrderId(confirmedLinkedOrderId);
          }
        }
      }

      // Update local storage order status
      try {
        const recentStr = localStorage.getItem('recent_placed_orders');
        if (recentStr) {
          const list: EscrowOrder[] = JSON.parse(recentStr);
          const updated = list.map(o => o.id === effectiveOrderId ? {
            ...o,
            escrowStatus: 'SHIPPED_TO_BUYER' as const,
            backendStatus: 'DELIVERING_TO_BUYER' as any,
            inspectionStatus: 'DELIVERING_TO_BUYER',
            linkedOrderId: confirmedLinkedOrderId,
            totalPaidVnd: (o.totalPaidVnd || 0) + finalPriceToPay,
          } : o);
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }

      // Dispatch local notification for Buyer
      const successNotif = {
        id: `notif-confirm-purchase-${effectiveOrderId}`,
        recipientId: currentUser?.id || order?.buyerId,
        recipientRole: 'buyer',
        title: 'Thanh toán mua hàng thành công',
        message: `Bạn đã xác nhận mua tiếp và thanh toán tiền hàng cho sản phẩm "${postTitle}". Đơn hàng đang được đóng gói gửi đến bạn!`,
        type: 'ORDER' as const,
        referenceId: effectiveOrderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('buyer', effectiveOrderId),
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(successNotif, currentUser?.id || order?.buyerId, 'buyer');

      setAlertNotice({
        type: 'success',
        message: 'Xác nhận mua hàng và thanh toán tiền hàng thành công! Đơn hàng được chuyển sang khâu giao tận tay cho bạn.',
      });
      if (finalPriceToPay > 0) {
        notifyWalletBalanceUpdated(undefined, finalPriceToPay);
      }
      try {
        await walletService.getMyWallet();
      } catch { }
      setShowConfirmModal(false);
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
      if (/quote.*(?:consumed|expired)/i.test(err?.message || '')) {
        setQuoteAttempt((attempt) => attempt + 1);
        return;
      }
      setAlertNotice({
        type: 'error',
        message: err?.message || 'Không thể xác nhận mua hàng. Vui lòng kiểm tra lại số dư ví hoặc thử lại.',
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject / Cancel Purchase
  const handleRejectPurchase = async () => {
    if (!canDecide) return;
    setIsSubmitting(true);
    try {
      const fullReason = selectedRejectReason === 'Lý do khác'
        ? `Lý do khác: ${customRejectNote.trim()}`
        : `${selectedRejectReason}${customRejectNote ? `: ${customRejectNote}` : ''}`;
      const rejectedOrder = effectiveOrderId ? await inspectorService.rejectPurchase(effectiveOrderId, fullReason) : null;
      if (rejectedOrder) setInspectionDto(rejectedOrder);

      // Retrieve relevant target post identifiers
      const targetPostId = String(
        rejectedOrder?.postId ||
        inspectionDto?.postId ||
        (order as any)?.postId ||
        (order as any)?.listing?.id ||
        (order as any)?.listingId ||
        ''
      ).trim();
      const targetPostTitle =
        rejectedOrder?.postTitle ||
        inspectionDto?.postTitle ||
        (order as any)?.postTitle ||
        (order as any)?.listing?.title ||
        postTitle;
      const targetTamperSealId =
        rejectedOrder?.tamperSealId ||
        inspectionDto?.tamperSealId ||
        (order as any)?.tamperSealId;
      const targetConditionGrade =
        rejectedOrder?.conditionGrade ||
        inspectionDto?.conditionGrade ||
        (order as any)?.conditionGrade;
      const targetConditionScore =
        rejectedOrder?.conditionScore ??
        inspectionDto?.conditionScore ??
        (order as any)?.conditionScore;

      // Register inspection pass so this listing continues to show "Đã đạt kiểm định tại Hub"
      if (targetPostId) {
        markListingInspectionPassed(targetPostId, targetPostTitle);
        try {
          localStorage.setItem(`inspection_passed_${targetPostId}`, 'true');
          localStorage.setItem(`inspection_status_${targetPostId}`, 'PASSED');
          localStorage.setItem(`inspection_status_post_${targetPostId}`, 'PASSED');
          localStorage.setItem(`listing_available_${targetPostId}`, 'true');
        } catch { }
      }
      if (targetPostTitle) {
        markListingInspectionPassed(undefined, targetPostTitle);
      }

      // Restore listing availability in bought_listing_ids
      try {
        const boughtStr = localStorage.getItem('bought_listing_ids');
        if (boughtStr && targetPostId) {
          const list: string[] = JSON.parse(boughtStr);
          const filtered = list.filter((id) => id !== targetPostId);
          localStorage.setItem('bought_listing_ids', JSON.stringify(filtered));
        }
      } catch { }

      // Update local storage order status in recent_placed_orders
      try {
        const recentStr = localStorage.getItem('recent_placed_orders');
        if (recentStr) {
          const list: EscrowOrder[] = JSON.parse(recentStr);
          const updated = list.map((o) =>
            o.id === effectiveOrderId
              ? {
                ...o,
                escrowStatus: 'CANCELLED' as const,
                backendStatus: 'CANCELLED' as any,
                inspectionStatus: 'CANCELLED',
                inspectionNote: rejectedOrder?.note || fullReason,
                tamperSealId: targetTamperSealId || (o as any).tamperSealId,
                conditionGrade: targetConditionGrade || (o as any).conditionGrade,
                conditionScore: targetConditionScore ?? (o as any).conditionScore,
                settlementOutcome: 'PASSED_BUYER_DEFAULTED',
                cancellationReasonCode: 'PASSED_BUYER_DEFAULTED',
              }
              : o
          );
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }

      // Also update all_orders_cache
      try {
        const allStr = localStorage.getItem('all_orders_cache');
        if (allStr) {
          const list: any[] = JSON.parse(allStr);
          const updated = list.map((o) =>
            o.id === effectiveOrderId
              ? {
                ...o,
                escrowStatus: 'CANCELLED',
                backendStatus: 'CANCELLED',
                inspectionStatus: 'CANCELLED',
                inspectionNote: rejectedOrder?.note || fullReason,
                tamperSealId: targetTamperSealId || (o as any).tamperSealId,
                conditionGrade: targetConditionGrade || o.conditionGrade,
                conditionScore: targetConditionScore ?? o.conditionScore,
                settlementOutcome: 'PASSED_BUYER_DEFAULTED',
                cancellationReasonCode: 'PASSED_BUYER_DEFAULTED',
              }
              : o
          );
          localStorage.setItem('all_orders_cache', JSON.stringify(updated));
        }
      } catch { }

      // Dispatch notification specifically for Seller
      const targetSellerId = inspectionDto?.sellerId || order?.sellerId;
      const sellerNotice = {
        id: `notif-seller-buyer-rejected-${effectiveOrderId}`,
        recipientId: targetSellerId,
        recipientRole: 'seller',
        title: 'Người mua từ chối mua tiếp sau kiểm định',
        message: `Khách hàng đã từ chối mua tiếp sản phẩm "${postTitle}" sau khi xem kết quả kiểm định. Lý do ${fullReason}.`,
        type: 'INSPECTION' as const,
        referenceId: effectiveOrderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('seller', effectiveOrderId),
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(sellerNotice, targetSellerId, 'seller');

      // Dispatch notification for Buyer confirmation
      const buyerNotice = {
        id: `notif-buyer-rejected-confirm-${effectiveOrderId}`,
        recipientId: currentUser?.id || order?.buyerId,
        recipientRole: 'buyer',
        title: 'Đã từ chối mua sản phẩm sau kiểm định',
        message: `Bạn đã từ chối mua sản phẩm "${postTitle}" sau khi xem kết quả kiểm định.`,
        type: 'INSPECTION' as const,
        referenceId: effectiveOrderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('buyer', effectiveOrderId),
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(buyerNotice, currentUser?.id || order?.buyerId, 'buyer');

      setAlertNotice({
        type: 'success',
        message: 'Đã ghi nhận bạn từ chối mua tiếp và gửi thông báo cho người bán.',
      });
      setShowRejectModal(false);
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
      setAlertNotice({
        type: 'error',
        message: err?.message || 'Có lỗi xảy ra khi hủy đơn. Vui lòng thử lại.',
      });
      setShowRejectModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Seller Accept Proposal
  const handleSellerAcceptProposal = async () => {
    if (!effectiveOrderId) return;
    setIsSubmitting(true);
    try {
      const res = await inspectorService.respondRequest(effectiveOrderId, {
        action: 'ACCEPT',
        sellerConsentZin: true,
      });
      setInspectionDto(res);
      setAlertNotice({
        type: 'success',
        message: 'Bạn đã chấp nhận đề xuất kiểm định thành công. Đơn hàng chuyển sang trạng thái chờ nạp phí kiểm định.',
      });
    } catch (err: any) {
      setAlertNotice({
        type: 'error',
        message: err?.message || 'Không thể đồng ý đề xuất. Vui lòng thử lại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Seller Reject Proposal
  const handleSellerRejectProposal = async () => {
    if (!effectiveOrderId) return;
    setIsSubmitting(true);
    try {
      const res = await inspectorService.respondRequest(effectiveOrderId, {
        action: 'REJECT',
        rejectionReason: customRejectNote.trim() || selectedRejectReason || 'Người bán từ chối kiểm định',
      });
      setInspectionDto(res);
      setShowRejectModal(false);
      setAlertNotice({
        type: 'success',
        message: 'Bạn đã từ chối đề xuất kiểm định này.',
      });
    } catch (err: any) {
      setAlertNotice({
        type: 'error',
        message: err?.message || 'Không thể từ chối đề xuất. Vui lòng thử lại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Negotiation Chat (Đưa đến đúng đoạn chat chứa yêu cầu kiểm định)
  const [isNavigatingChat, setIsNavigatingChat] = useState<boolean>(false);
  const handleOpenNegotiationChat = async () => {
    const targetPostId = inspectionDto?.postId || (order as any)?.listing?.id || (order as any)?.postId;
    const targetBuyerId = inspectionDto?.buyerId || (order as any)?.buyerId;
    const targetSellerId = inspectionDto?.sellerId || (order as any)?.sellerId;
    const targetInspectionId = inspectionDto?.id || effectiveOrderId;
    const role = userRole === 'buyer' ? 'buyer' : 'seller';

    if (!targetPostId) {
      navigatePath(paths.chat(role));
      return;
    }

    try {
      setIsNavigatingChat(true);
      const rooms = await chatService.getChatRooms();

      // Tìm phòng chat khớp với bài đăng và người đối thoại
      let targetRoom = rooms.find((r) => {
        const matchesPost = r.postId && String(r.postId).toLowerCase() === String(targetPostId).toLowerCase();
        const matchesPartner = isUserSeller
          ? (!targetBuyerId || (r.buyerId && String(r.buyerId).toLowerCase() === String(targetBuyerId).toLowerCase()))
          : (!targetSellerId || (r.sellerId && String(r.sellerId).toLowerCase() === String(targetSellerId).toLowerCase()));
        return matchesPost && matchesPartner;
      });

      if (!targetRoom) {
        targetRoom = rooms.find((r) => r.postId && String(r.postId).toLowerCase() === String(targetPostId).toLowerCase());
      }

      if (!targetRoom) {
        targetRoom = await chatService.getOrCreateRoom(targetPostId);
      }

      const queryParam = targetInspectionId ? `?inspectionId=${encodeURIComponent(targetInspectionId)}` : '';
      if (targetRoom?.id) {
        navigatePath(`${paths.chat(role, targetRoom.id)}${queryParam}`);
      } else {
        navigatePath(`${paths.chat(role)}?postId=${encodeURIComponent(targetPostId)}${targetInspectionId ? `&inspectionId=${encodeURIComponent(targetInspectionId)}` : ''}`);
      }
    } catch (err) {
      console.warn('Lỗi khi mở phòng chat thương lượng:', err);
      navigatePath(`${paths.chat(role)}?postId=${encodeURIComponent(targetPostId)}${targetInspectionId ? `&inspectionId=${encodeURIComponent(targetInspectionId)}` : ''}`);
    } finally {
      setIsNavigatingChat(false);
    }
  };

  // Handle Pay Inspection Fee
  const handlePayInspectionFee = async () => {
    if (!effectiveOrderId) return;
    setIsSubmitting(true);
    try {
      const res = await inspectorService.payInspectionFee(effectiveOrderId);
      setInspectionDto(res);
      setAlertNotice({
        type: 'success',
        message: 'Thanh toán phí kiểm định thành công! Đơn hàng đã được nạp phí vào Quỹ Escrow.',
      });
      if (buyerFeeShare > 0) {
        notifyWalletBalanceUpdated(undefined, buyerFeeShare);
      }
      walletService.getMyWallet().then((w) => setWallet(w)).catch(() => { });
    } catch (err: any) {
      setAlertNotice({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Không thể thanh toán phí kiểm định. Vui lòng kiểm tra số dư ví.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentWalletBal = wallet?.balance ?? null;
  const isWalletSufficient = currentWalletBal !== null ? currentWalletBal >= finalPriceToPay : true;
  const walletShortfall = currentWalletBal !== null && finalPriceToPay !== null
    ? Math.max(0, finalPriceToPay - currentWalletBal)
    : null;

  if (isLoading || (!inspectionDto && !order)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center text-slate-700">
        <p role="status">{isLoading ? 'Đang tải dữ liệu đơn kiểm định…' : 'Không tải được dữ liệu đơn kiểm định.'}</p>
        {!isLoading && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                inspectorService.getOrder(effectiveOrderId, { bypassCache: true })
                  .then((dto) => { if (dto) setInspectionDto(dto); })
                  .catch((err) => console.warn('Retry failed:', err))
                  .finally(() => setIsLoading(false));
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Quay lại đơn hàng
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/50 to-white pb-16 font-sans animate-fadeIn">
      {/* Top Header Bar */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/80 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="w-full px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Quay lại danh sách đơn hàng"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đơn kiểm định</span>
                <span className="text-xs font-mono font-bold text-slate-700">#{effectiveOrderId.slice(0, 12).toUpperCase()}</span>
                {isPassed && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>KẾT QUẢ: ĐẠT CHUẨN (PASSED)</span>
                  </span>
                )}
                {isOrderCompleted ? (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{isUserSeller ? 'ĐÃ NHẬN TIỀN VÀO VÍ' : 'HOÀN TẤT • ĐÃ GIẢI NGÂN'}</span>
                  </span>
                ) : isOrderDelivered ? (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{isUserSeller ? 'ĐÃ GIAO HÀNG (48H)' : 'ĐÃ GIAO • ĐỐI SOÁT 48H'}</span>
                  </span>
                ) : purchaseDecision ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${purchaseDecision === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                    {inspectionPurchaseDecisionLabel(purchaseDecision, lang, isUserSeller)}
                  </span>
                ) : null}
                {purchaseExpired && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                    Đã hủy do hết hạn thanh toán
                  </span>
                )}
                {isCancelled && !purchaseDecision && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold flex items-center gap-1 border border-rose-300">
                    <XCircle className="w-3 h-3 text-rose-600" />
                    <span>ĐÃ HỦY / TỪ CHỐI</span>
                  </span>
                )}
                {isFailed && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-600" />
                    <span>KẾT QUẢ: KHÔNG ĐẠT (FAILED)</span>
                  </span>
                )}
                {isInspecting && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-600 animate-spin" />
                    <span>ĐANG KIỂM ĐỊNH</span>
                  </span>
                )}
                {isWaitingSellerApproval && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>CHỜ NGƯỜI BÁN DUYỆT</span>
                  </span>
                )}
                {isWaitingBuyerApproval && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-purple-600" />
                    <span>CHỜ NGƯỜI MUA DUYỆT LẠI</span>
                  </span>
                )}
                {isWaitingFeePayment && !isWaitingSellerApproval && !isWaitingBuyerApproval && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-amber-600" />
                    <span>CHỜ NỘP PHÍ KIỂM ĐỊNH</span>
                  </span>
                )}
                {isInboundDelivered && !isInspecting && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    <span>ĐÃ ĐẾN HUB KIỂM ĐỊNH</span>
                  </span>
                )}
                {isShippingToCenter && !isInboundDelivered && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Truck className="w-3 h-3 text-indigo-600" />
                    <span>ĐANG GIAO ĐẾN HUB</span>
                  </span>
                )}
                {isPending && !isWaitingSellerApproval && !isWaitingBuyerApproval && !isWaitingFeePayment && !isShippingToCenter && !isInboundDelivered && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>{isAtHome ? (
                      hasNoAppt
                        ? (isUserSeller ? 'CHỜ BẠN HẸN LỊCH ĐÓN KTV' : 'CHỜ NGƯỜI BÁN HẸN LỊCH ĐÓN KTV')
                        : isApptCountered
                          ? 'HUB ĐỀ XUẤT LỊCH MỚI'
                          : isApptPendingApproval
                            ? 'CHỜ TRUNG TÂM DUYỆT LỊCH'
                            : hasApptConfirmed
                              ? (hasInsp ? 'ĐÃ PHÂN CÔNG KTV • CHỜ KHẢO SÁT' : 'ĐÃ CHỐT LỊCH • CHỜ GIAO KTV')
                              : (isUserSeller ? 'CHỜ BẠN HẸN LỊCH ĐÓN KTV' : 'CHỜ NGƯỜI BÁN HẸN LỊCH ĐÓN KTV')
                    ) : 'CHƯA KIỂM ĐỊNH • CHỜ TIẾP NHẬN'}</span>
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {isUserSeller
                  ? 'Kênh Người Bán • Chi Tiết Trạng Thái Kiểm Định'
                  : 'Biên Bản Thẩm Định Kỹ Thuật & Quyết Định Mua Hàng'}
              </h1>
            </div>
          </div>

          {/* 6-hour countdown pill (chỉ hiện khi đã ĐẠT và là người mua) */}
          {canDecide && inspectionDto.finalPaymentDeadline && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold shadow-xs">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
              <span>Hạn chốt quyết định:</span>
              <span className="font-mono font-extrabold text-[#c34c36]">
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full px-3 sm:px-5 lg:px-6 pt-6 space-y-6">

        {canDecide && timeLeft.isExpired && (
          <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Đã hết hạn thanh toán. Đang chờ hệ thống cập nhật trạng thái đơn.
          </p>
        )}

        {/* Tiến trình hoàn hàng về cho người bán khi có chặng CENTER_TO_SELLER */}
        {returnShipment && (
          <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/80 border border-amber-200/80 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-950">
                    Tiến Trình Trả Hàng Về Cho Người Bán (Chặng Hub → Seller)
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    {getHubReturnProgress(returnShipment, lang).label}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-200/70 text-amber-900">
                LALAMOVE RETURN
              </span>
            </div>

            <LalamoveProgress currentStep={getHubReturnProgress(returnShipment, lang).step} completeCurrentStep={returnShipment.status === 'DELIVERED'} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Mã vận đơn:</span>
                <span className="font-bold text-slate-900">
                  {returnShipment.orderCode || 'Chưa có mã'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Dự phòng cước chiều về:</span>
                <span className="font-bold text-slate-900">
                  {formatAmount(returnReserveFee)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Cước thực tế:</span>
                <span className="font-bold text-amber-700">
                  {returnShipment.actualFee != null
                    ? formatVND(returnShipment.actualFee)
                    : 'Chờ đối soát thực tế'}
                </span>
              </div>
            </div>

            {returnShipment.deliveredAt && <p className="text-xs">Giao hoàn lúc {new Date(returnShipment.deliveredAt).toLocaleString('vi-VN')}</p>}
            {returnShipment.shareLink && <a href={returnShipment.shareLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline">Theo dõi trên Lalamove</a>}
            <p className="text-xs text-amber-900">{getReturnReserveMessage(returnReserveFee, returnShipment)}</p>
          </div>
        )}

        {/* Alert notification if any */}
        {alertNotice && (
          <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-sm ${alertNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
            }`}>
            <div className="flex items-center gap-2.5">
              {alertNotice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{alertNotice.message}</span>
            </div>
            <button onClick={() => setAlertNotice(null)} className="text-slate-400 hover:text-slate-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Decision Banner Announcement - CHỈ HIỆN KHI ĐÃ ĐẠT VÀ LÀ NGƯỜI MUA */}
        {canDecide ? (
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-[#24263e] text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_70%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/30">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Quy trình bảo lãnh giao dịch 2 giai đoạn SecondLife Escrow</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Sản phẩm đã vượt qua bài kiểm định kỹ thuật!
                </h2>
                <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                  Bạn đã thanh toán trước phí kiểm định & tiền ship. Bây giờ hãy xem kỹ biên bản thẩm định từ Kỹ thuật viên. Bạn có toàn quyền <strong>Xác nhận mua tiếp</strong> (để thanh toán tiền sản phẩm) hoặc <strong>Từ chối mua</strong> (sản phẩm sẽ được hoàn trả cho người bán).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Award className="w-4 h-4 text-amber-900" />
                  <span>Xem Chứng Nhận Kiểm Định</span>
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/25 transition cursor-pointer flex items-center justify-center shadow-sm"
                >
                  <span>Từ chối mua tiếp</span>
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-3 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm shadow-lg transition cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Xác nhận mua ({formatVND(finalItemPrice)})</span>
                </button>
              </div>
            </div>
          </div>
        ) : isFailed ? (
          /* Banner thông báo khi KẾT QUẢ KIỂM ĐỊNH KHÔNG ĐẠT (FAILED) */
          <div className="py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-rose-700 via-red-600 to-[#24263e] text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                  <XCircle className="w-3.5 h-3.5 text-rose-200" />
                  <span>{isUserSeller ? 'Kênh Người Bán • Kiểm Định Không Đạt (FAILED)' : 'Kết Quả: Không Đạt (FAILED)'}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Sản phẩm kiểm định không đạt tiêu chuẩn kỹ thuật
                </h2>
                <p className="text-xs text-rose-50/90 leading-relaxed max-w-3xl">
                  {isUserSeller
                    ? 'Đơn hàng kiểm định không đạt chuẩn chất lượng. Thiết bị sẽ được Hub thu xếp đóng gói hoàn trả về địa chỉ kho của bạn.'
                    : 'Kỹ thuật viên đã kiểm tra và ghi nhận sản phẩm không vượt qua các tiêu chí kỹ thuật quy định. Đơn hàng đã dừng lại ở bước kiểm định và thiết bị sẽ được hoàn trả cho người bán.'}
                </p>
                <p className="text-xs text-rose-50/90 leading-relaxed max-w-3xl">
                  Giai đoạn 2 không mở thanh toán tiền hàng vì sản phẩm kiểm định không đạt.
                </p>
              </div>

              {(escrowOrderForShipment || order) && (
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/25 shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>Xem Biên Bản Kiểm Định</span>
                </button>
              )}
            </div>
          </div>
        ) : isBuyerPurchaseRejected ? (
          /* Banner thông báo khi NGƯỜI MUA TỪ CHỐI MUA TIẾP SAU KIỂM ĐỊNH */
          <div className="py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-[#24263e] text-white shadow-md relative overflow-hidden border border-rose-700/50">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                  <XCircle className="w-3.5 h-3.5 text-rose-200" />
                  <span>{isUserSeller ? 'Kênh Người Bán • Người Mua Từ Chối Mua Tiếp' : 'Bạn Đã Từ Chối Mua Tiếp'}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isUserSeller
                    ? 'Người mua đã từ chối mua tiếp sau kiểm định'
                    : 'Bạn đã từ chối mua tiếp sản phẩm sau kiểm định'}
                </h2>
                <div className="space-y-1">
                  <p className="text-xs text-rose-50/90 leading-relaxed max-w-3xl">
                    <strong>Lý do từ chối:</strong> {rejectionDetails.buyerRejectReason || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân'}
                  </p>
                  <p className="text-xs text-rose-200/90 leading-relaxed max-w-3xl">
                    {isUserSeller
                      ? 'Người mua đã xem kết quả kiểm định đạt chuẩn và chọn không tiếp tục mua sản phẩm. Thiết bị sẽ được Hub thu xếp đóng gói hoàn trả về địa chỉ của bạn.'
                      : 'Bạn đã xem kết quả kiểm định kỹ thuật và chọn không tiếp tục mua sản phẩm. Thiết bị sẽ được thu xếp hoàn trả lại cho người bán.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(escrowOrderForShipment || order) && (
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/25 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    <span>Xem Biên Bản Kiểm Định</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenNegotiationChat}
                  disabled={isNavigatingChat}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/25 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-200" />
                  <span>Xem Phòng Chat</span>
                </button>
              </div>
            </div>
          </div>
        ) : isCancelled ? (
          /* Banner thông báo khi ĐỀ XUẤT KIỂM ĐỊNH BỊ TỪ CHỐI / HỦY BỎ */
          <div className="py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-[#24263e] text-white shadow-md relative overflow-hidden border border-rose-700/50">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                  <XCircle className="w-3.5 h-3.5 text-rose-200" />
                  <span>{isUserSeller ? 'Kênh Người Bán • Đề Xuất Đã Bị Hủy / Từ Chối' : 'Đề Xuất Kiểm Định Đã Bị Hủy / Từ Chối'}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {(() => {
                    const note = String(inspectionDto?.note || (order as any)?.note || (order as any)?.inspectionNote || '').trim();
                    if (note.toLowerCase().includes('người bán từ chối')) {
                      return isUserSeller ? 'Bạn đã từ chối yêu cầu kiểm định này' : 'Người bán đã từ chối yêu cầu kiểm định này';
                    }
                    if (note.toLowerCase().includes('người mua từ chối')) {
                      return isUserSeller ? 'Người mua đã từ chối đề xuất kiểm định' : 'Bạn đã từ chối đề xuất kiểm định này';
                    }
                    return 'Đề xuất kiểm định đã kết thúc';
                  })()}
                </h2>
                <p className="text-xs text-rose-50/90 leading-relaxed max-w-3xl">
                  {(() => {
                    const rawReason = rejectionDetails.buyerRejectReason || String(inspectionDto?.note || (order as any)?.note || (order as any)?.inspectionNote || '').trim();
                    return rawReason
                      ? `Lý do: ${rawReason}. Yêu cầu kiểm định này đã kết thúc, không có khoản phí nào bị trừ và sản phẩm đã được mở lại giao dịch bình thường.`
                      : 'Yêu cầu kiểm định này đã bị hủy hoặc từ chối. Không có khoản phí nào bị trừ từ tài khoản của bạn.';
                  })()}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenNegotiationChat}
                disabled={isNavigatingChat}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/25 shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-rose-200" />
                <span>Xem Phòng Chat</span>
              </button>
            </div>
          </div>
        ) : decisionSettled ? (
          purchaseDecision === 'accepted' ? (
            <div className="py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-[#24263e] text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      {isOrderCompleted
                        ? (isUserSeller ? 'Đã Nhận Tiền Vào Ví • Giao Dịch Hoàn Tất' : 'Giao Dịch Hoàn Tất • Đã Giải Ngân')
                        : isOrderDelivered
                          ? (isUserSeller ? 'Đã Giao Hàng • Chờ Đối Soát (48h)' : 'Đã Giao Hàng • 48h Kiểm Tra Đối Soát')
                          : isUserSeller
                            ? 'Người Mua Đã Mua Tiếp'
                            : 'Đã Xác Nhận Mua Hàng'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight">
                    {isOrderCompleted
                      ? (isUserSeller
                        ? 'Đơn hàng đã hoàn tất — Tiền bán hàng đã chuyển vào ví'
                        : 'Đơn hàng đã hoàn tất — Cảm ơn bạn đã mua sắm')
                      : isOrderDelivered
                        ? (isUserSeller
                          ? 'Tài xế đã giao kiện hàng thành công tới người mua'
                          : 'Kiện hàng đã được giao thành công tới bạn')
                        : isUserSeller
                          ? 'Người mua đã thanh toán GĐ 2 và xác nhận mua sản phẩm'
                          : 'Bạn đã thanh toán GĐ 2 và xác nhận mua sản phẩm'}
                  </h2>
                  <p className="text-xs text-emerald-50/90 leading-relaxed max-w-2xl">
                    {isOrderCompleted
                      ? (isUserSeller
                        ? 'Khách mua đã nhận hàng và đối soát thành công. Số tiền thực nhận đã được cộng vào ví của bạn.'
                        : 'Bạn đã hoàn tất nhận hàng và đối soát. Tiền hàng đã được giải ngân cho người bán.')
                      : isOrderDelivered
                        ? (isUserSeller
                          ? 'Khách mua có 48 giờ để kiểm tra đối soát trước khi hệ thống tự động giải ngân vào ví của bạn.'
                          : 'Bạn có 48 giờ để kiểm tra và đối soát thiết bị trước khi hệ thống tự động giải ngân cho người bán.')
                        : isAtHome
                          ? (isUserSeller
                            ? 'Vui lòng đóng gói cẩn thận (giữ nguyên tem niêm phong) và bàn giao cho tài xế Lalamove giao tới người mua.'
                            : 'Người bán đang đóng gói kiện hàng nguyên tem niêm phong để bàn giao tài xế giao thẳng đến bạn.')
                          : (isUserSeller
                            ? 'Trung tâm Hub đang chuẩn bị đóng gói và bàn giao bưu tá để phát đến người mua.'
                            : 'Đơn hàng đang trong quy trình đóng gói và giao từ Hub đến bạn.')}
                  </p>
                </div>
                {(escrowOrderForShipment || order) && (
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-sm transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-900" />
                    <span>Xem Chứng Nhận Kiểm Định</span>
                  </button>
                )}
              </div>
            </div>
          ) : null
        ) : isUserSeller ? (
          /* Banner thông báo dành riêng cho Người bán khi đơn ĐANG XỬ LÝ */
          <div className={`py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl text-white shadow-md relative overflow-hidden ${isInspecting || isInboundDelivered
            ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-[#24263e]'
            : 'bg-gradient-to-r from-slate-800 via-indigo-900 to-[#24263e]'
            }`}>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                  {isInspecting ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-200" />
                      <span>Đang Kiểm Định Kỹ Thuật</span>
                    </>
                  ) : isInboundDelivered ? (
                    <>
                      <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>ĐÃ ĐẾN HUB KIỂM ĐỊNH</span>
                    </>
                  ) : (
                    <>
                      <Store className="w-3.5 h-3.5 text-indigo-300" />
                      <span>
                        {isWaitingSellerApproval
                          ? 'Chờ Bạn Phê Duyệt Đề Xuất'
                          : isWaitingBuyerApproval
                            ? 'Chờ Người Mua Duyệt Lại'
                            : isWaitingFeePayment
                              ? 'Chờ Nộp Phí Kiểm Định'
                              : isShippingToCenter
                                ? 'Đang Giao Đến Hub'
                                : (feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH')
                                  ? (isAtHome
                                    ? (isApptCountered
                                      ? 'Hub Đề Xuất Lịch Mới'
                                      : isApptPendingApproval
                                        ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt'
                                        : hasApptConfirmed
                                          ? (hasInsp ? 'Đã Phân Công KTV' : 'Đã Chốt Lịch • Chờ Giao KTV')
                                          : 'Chờ Bạn Hẹn Lịch Đón KTV')
                                    : 'Chờ Bạn Gửi Hàng Đến Hub')
                                  : 'Kênh Người Bán • Theo Dõi Đơn Kiểm Định'}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isPassed
                    ? 'Sản phẩm đã được KTV kiểm định ĐẠT CHUẨN!'
                    : isInspecting
                      ? (isAtHome
                        ? 'Kỹ thuật viên đang có mặt tại nhà bạn và kiểm định thiết bị thực tế'
                        : 'Kỹ thuật viên đang kiểm định thiết bị thực tế tại Hub')
                      : isInboundDelivered
                        ? 'Thiết bị đã đến Hub kiểm định • Trung tâm đã tiếp nhận máy'
                        : isShippingToCenter
                          ? 'Thiết bị đang được vận chuyển đến Hub kiểm định'
                          : isWaitingSellerApproval
                            ? (isAtHome
                              ? 'Đang chờ bạn phản hồi yêu cầu kiểm định tại nhà'
                              : 'Đang chờ bạn phản hồi yêu cầu kiểm định qua Hub')
                            : isWaitingBuyerApproval
                              ? 'Đang chờ người mua phản hồi lại đề xuất kiểm định'
                              : isWaitingFeePayment
                                ? 'Chờ thanh toán phí kiểm định Giai đoạn 1'
                                : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                                  ? (isAtHome
                                    ? (hasNoAppt
                                      ? 'Hai bên đã nộp đủ phí • Chờ bạn hẹn lịch đón KTV'
                                      : isApptPendingApproval
                                        ? 'Đã gửi lịch hẹn • Chờ Trung tâm duyệt lịch'
                                        : isApptCountered
                                          ? 'Trung tâm đề xuất lịch hẹn mới • Cần bạn phản hồi'
                                          : hasApptConfirmed
                                            ? (hasInsp ? 'Đã phân công KTV • KTV sẽ đến kiểm định tận nhà' : 'Đã chốt lịch hẹn • KTV sẽ đến kiểm định tận nhà')
                                            : 'Đang chờ xếp lịch kỹ thuật viên đến kiểm định tại nhà')
                                    : 'Đã thu đủ phí kiểm định • Vui lòng gửi máy đến Hub')
                                  : (isAtHome
                                    ? 'Đang chờ xếp lịch kỹ thuật viên đến kiểm định tại nhà'
                                    : 'Đơn kiểm định đang chờ tiếp nhận')}
                </h2>
                <p className="text-xs text-slate-200/90 leading-relaxed max-w-3xl">
                  {isPassed
                    ? `Đang chờ người mua quyết định.${inspectionDto?.finalPaymentDeadline ? ` Hạn quyết định: ${new Date(inspectionDto.finalPaymentDeadline).toLocaleString('vi-VN')}.` : ''}`
                    : isInspecting
                      ? (isAtHome
                        ? 'Kỹ thuật viên SecondLife đang kiểm tra thiết bị trực tiếp tại địa chỉ của bạn.'
                        : 'Kỹ thuật viên đang kiểm tra chất lượng thực tế máy tại Trung tâm.')
                      : isInboundDelivered
                        ? 'Trung tâm kiểm định đã nhận kiện hàng từ đơn vị vận chuyển. Kỹ thuật viên sẽ tiếp nhận máy lên bàn đo kiểm và tiến hành thẩm định.'
                        : isShippingToCenter
                          ? 'Tài xế đang vận chuyển máy đến Trung tâm. KTV sẽ tiếp nhận ngay khi máy tới nơi.'
                          : isInspecting
                            ? (isAtHome
                              ? 'Kỹ thuật viên SecondLife đang kiểm tra thiết bị trực tiếp tại địa chỉ của bạn.'
                              : 'Kỹ thuật viên đang kiểm tra chất lượng thực tế máy tại Trung tâm.')
                            : isWaitingSellerApproval
                              ? (isAtHome
                                ? 'Người mua đã đề xuất cử KTV đến tận nhà bạn để kiểm định máy trước khi mua. Vui lòng xem phương án phân chia phí và bấm Đồng ý hoặc Từ chối bên dưới.'
                                : 'Người mua đã đề xuất kiểm định sản phẩm qua Hub trước khi mua. Vui lòng xem phương án phân chia phí và bấm Đồng ý hoặc Từ chối bên dưới.')
                              : isWaitingBuyerApproval
                                ? 'Bạn đã gửi lại đề xuất thay đổi phương án. Vui lòng chờ người mua xem và phản hồi trong phòng chat.'
                                : isWaitingFeePayment
                                  ? (sellerFeeShare > 0 && !inspectionDto?.sellerPaidAt
                                    ? 'Phương án kiểm định đã được duyệt. Vui lòng nộp phần phí kiểm định của bạn để hệ thống xếp lịch kiểm định.'
                                    : 'Bạn đã hoàn tất nộp phí kiểm định. Đang chờ người mua thanh toán phần phí còn lại.')
                                  : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                                    ? (isAtHome
                                      ? (hasNoAppt
                                        ? 'Khách mua đã đăng ký gói kiểm định tận nơi. Vui lòng bấm nút "Hẹn Lịch Đón KTV" bên dưới để chọn ngày giờ làm việc trong khung giờ hành chính (08:00 - 12:00 hoặc 13:00 - 17:00).'
                                        : isApptPendingApproval
                                          ? `Đã gửi đề xuất lịch đón KTV${currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt ? `: ${new Date(currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt!).toLocaleString('vi-VN')}` : ''}. Đang chờ Hub xác nhận điều phối.`
                                          : isApptCountered
                                            ? `Trung tâm kiểm định đã đề xuất thời gian mới: ${new Date(currentAppt?.counterScheduledAt || (inspectionDto as any)?.counterScheduledAt).toLocaleString('vi-VN')}. Vui lòng bấm Hẹn lại lịch khác nếu không phù hợp.`
                                            : `Kỹ thuật viên SecondLife sẽ có mặt tại nhà bạn vào lúc ${new Date(currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt!).toLocaleString('vi-VN')} để kiểm định thiết bị.`)
                                      : (buyerFeeShare === 0
                                        ? 'Bạn (Người bán) đã nộp đủ 100% phí kiểm định. Vui lòng đóng gói và tạo đơn Lalamove để giao máy đến Hub.'
                                        : sellerFeeShare === 0
                                          ? 'Người mua đã nộp đủ 100% phí kiểm định. Vui lòng đóng gói và tạo đơn Lalamove để giao máy đến Hub.'
                                          : 'Hai bên đã nộp đủ phí kiểm định (chia phí). Vui lòng đóng gói và tạo đơn Lalamove để giao máy đến Hub.'))
                                    : (isAtHome
                                      ? 'Hệ thống đang chuẩn bị xếp lịch kỹ thuật viên đến tận nhà bạn để kiểm định máy.'
                                      : 'Kỹ thuật viên đang chuẩn bị tiếp nhận đơn kiểm định trên hệ thống.')}
                </p>
              </div>

              {/* Nút Hẹn Lịch Đón KTV cho Seller khi kiểm định tại nhà */}
              {isUserSeller && isAtHome && (feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH') && !isInspecting && !isPassed && !isFailed && !hasApptConfirmed && (
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{hasNoAppt ? 'Hẹn Lịch Đón KTV' : isApptCountered ? 'Hẹn Lại Lịch Khác' : 'Xem / Đổi Lịch Hẹn'}</span>
                </button>
              )}

              {/* Nút Tạo Vận Đơn cho Seller nếu chưa ship (chỉ áp dụng kiểm định tại Hub) */}
              {isUserSeller && !isAtHome && (feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH') && !isShippingToCenter && !isInboundDelivered && !isInspecting && !isPassed && !isFailed && (
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Đã gói hàng • Tạo đơn vận chuyển</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Banner thông báo dành cho Người mua khi CHƯA CÓ KẾT QUẢ ĐẠT */
          <div className={`py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl text-white shadow-md relative overflow-hidden ${isInboundDelivered
            ? 'bg-gradient-to-r from-emerald-700 via-teal-800 to-[#24263e]'
            : isShippingToCenter
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-[#24263e]'
              : 'bg-gradient-to-r from-slate-800 via-indigo-900 to-[#24263e]'
            }`}>
            <div className="relative z-10 space-y-1 sm:space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                {isInspecting ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-200" />
                    <span>Đang Kiểm Định Kỹ Thuật</span>
                  </>
                ) : isInboundDelivered ? (
                  <>
                    <Building2 className="w-3 h-3 text-emerald-200" />
                    <span>ĐÃ ĐẾN HUB KIỂM ĐỊNH</span>
                  </>
                ) : isShippingToCenter ? (
                  <>
                    <Truck className="w-3 h-3 text-amber-200" />
                    <span>Đang Vận Chuyển Đến Hub</span>
                  </>
                ) : isWaitingSellerApproval ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-200" />
                    <span>Chờ Người Bán Duyệt Đề Xuất</span>
                  </>
                ) : isWaitingBuyerApproval ? (
                  <>
                    <Clock className="w-3 h-3 text-purple-200" />
                    <span>Chờ Bạn Phản Hồi Đề Xuất Mới</span>
                  </>
                ) : isWaitingFeePayment ? (
                  <>
                    <Wallet className="w-3 h-3 text-amber-200" />
                    <span>Chờ Nộp Phí Kiểm Định</span>
                  </>
                ) : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH' ? (
                  <>
                    <Package className="w-3 h-3 text-amber-200" />
                    <span>
                      {isAtHome
                        ? (hasNoAppt
                          ? 'Chờ Người Bán Hẹn Lịch Đón KTV'
                          : isApptPendingApproval
                            ? 'Chờ Hub Duyệt Lịch'
                            : isApptCountered
                              ? 'Chờ Hẹn Lại Lịch'
                              : hasApptConfirmed
                                ? (hasInsp ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Đã Chốt Lịch • Chờ Giao KTV')
                                : 'Chờ Người Bán Hẹn Lịch Đón KTV')
                        : 'Chờ Người Bán Gửi Hàng Đến Hub'}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-amber-200" />
                    <span>{isAtHome ? (hasApptConfirmed ? (hasInsp ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Đã Chốt Lịch • Chờ Giao KTV') : 'Chờ Xác Nhận Lịch Hẹn') : 'Chờ Tiếp Nhận Thẩm Định'}</span>
                  </>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {isInspecting
                  ? (isAtHome
                    ? 'Kỹ thuật viên đang có mặt tại nhà người bán để kiểm định thiết bị'
                    : 'Kỹ thuật viên đang kiểm định thiết bị thực tế tại Hub')
                  : isInboundDelivered
                    ? 'Thiết bị đã đến Trung tâm kiểm định • Đang chờ KTV kiểm tra'
                    : isShippingToCenter
                      ? 'Thiết bị đang được vận chuyển đến Trung tâm kiểm định'
                      : isWaitingSellerApproval
                        ? (isAtHome
                          ? 'Đang chờ người bán phản hồi đề xuất kiểm định tại nhà'
                          : 'Đang chờ người bán phản hồi đề xuất kiểm định qua Hub')
                        : isWaitingBuyerApproval
                          ? 'Người bán đã đề xuất phương án mới • Vui lòng kiểm tra'
                          : isWaitingFeePayment
                            ? 'Chờ thanh toán phí kiểm định Giai đoạn 1'
                            : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                              ? (isAtHome
                                ? (hasNoAppt
                                  ? 'Đã thu đủ phí kiểm định • Đang chờ người bán hẹn lịch đón KTV'
                                  : isApptPendingApproval
                                    ? 'Đã đề xuất lịch hẹn • Chờ Trung tâm duyệt lịch'
                                    : isApptCountered
                                      ? 'Đang chờ điều chỉnh lại lịch hẹn kiểm định'
                                      : hasApptConfirmed
                                        ? (hasInsp
                                          ? 'Đã phân công KTV • KTV sẽ đến kiểm định tận nhà người bán'
                                          : 'Đã chốt lịch hẹn • Chờ người bán giao máy cho KTV')
                                        : 'Đang chờ xếp lịch kỹ thuật viên đến kiểm định tại nhà người bán')
                                : 'Đang chờ Người bán đóng gói & gửi sản phẩm đến trung tâm kiểm định')
                              : (isAtHome
                                ? 'Đang chờ điều phối kỹ thuật viên đến kiểm định tại nhà'
                                : 'Đang chờ Người bán gửi máy & kỹ thuật viên tiếp nhận')}
              </h2>
              <p className="text-xs text-amber-50/90 leading-relaxed max-w-3xl">
                {isInspecting
                  ? (isAtHome
                    ? 'Kỹ thuật viên đang có mặt tại nhà người bán để kiểm tra thực tế máy. Bạn có thể theo dõi và quyết định mua tiếp sau khi có biên bản đạt chuẩn.'
                    : 'Kỹ thuật viên đang kiểm tra chất lượng thực tế. Bạn có thể quyết định mua tiếp sau khi có biên bản đạt chuẩn.')
                  : isInboundDelivered
                    ? 'Kiện hàng đã được giao thành công tới Trung tâm kiểm định. Kỹ thuật viên sẽ tiến hành thẩm định kỹ thuật và xuất biên bản nghiệm thu.'
                    : isShippingToCenter
                      ? 'Tài xế đang giao kiện hàng đến Hub. Kỹ thuật viên sẽ tiếp nhận và tiến hành thẩm định khi nhận máy.'
                      : isWaitingSellerApproval
                        ? (isAtHome
                          ? 'Bạn đã gửi yêu cầu cử kỹ thuật viên đến tận nhà người bán kiểm định máy. Vui lòng chờ người bán xem và đồng ý phương án phân chia phí.'
                          : 'Bạn đã gửi đề xuất kiểm định qua trung tâm Hub. Vui lòng chờ người bán xem và đồng ý phương án phân chia phí.')
                        : isWaitingBuyerApproval
                          ? 'Người bán đã đề xuất điều chỉnh phương án kiểm định. Bạn vui lòng vào phòng chat để xem và phản hồi.'
                          : isWaitingFeePayment
                            ? (buyerFeeShare > 0 && !inspectionDto?.buyerPaidAt
                              ? 'Phương án kiểm định đã được thống nhất. Vui lòng nộp phần phí kiểm định của bạn để hệ thống xếp lịch kiểm định.'
                              : 'Đã nộp phí kiểm định phần bạn. Đang chờ người bán hoàn tất thanh toán phần phí còn lại.')
                            : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                              ? (isAtHome
                                ? (hasNoAppt
                                  ? 'Hai bên đã nộp đủ phí kiểm định GĐ 1. Đang chờ người bán chọn ngày giờ để Kỹ thuật viên SecondLife đến tận nhà kiểm định thiết bị.'
                                  : isApptPendingApproval
                                    ? `Lịch hẹn đón KTV đã được gửi${currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt ? `: ${new Date(currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt!).toLocaleString('vi-VN')}` : ''}. Trung tâm đang xem xét điều phối KTV.`
                                    : isApptCountered
                                      ? 'Trung tâm kiểm định và người bán đang thu xếp lại lịch hẹn phù hợp.'
                                      : `Kỹ thuật viên sẽ có mặt tại nhà người bán vào lúc ${new Date(currentAppt?.scheduledAt || inspectionDto?.appointmentScheduledAt!).toLocaleString('vi-VN')} để kiểm định thiết bị. Bạn có thể theo dõi tiến trình trực tuyến.`)
                                : (buyerFeeShare === 0
                                  ? 'Người bán đã nộp đủ 100% phí kiểm định. Người bán đang chuẩn bị đóng gói và lên đơn gửi sản phẩm đến Hub để KTV kiểm định.'
                                  : sellerFeeShare === 0
                                    ? 'Bạn đã nộp đủ 100% phí kiểm định. Người bán đang chuẩn bị đóng gói và lên đơn gửi sản phẩm đến Hub để KTV kiểm định.'
                                    : 'Hai bên đã nộp đủ phí kiểm định (chia phí). Người bán đang chuẩn bị đóng gói và lên đơn gửi sản phẩm đến Hub để KTV kiểm định.'))
                              : `${feesPaid ? 'Đã nộp phí kiểm định. ' : ''}Bạn có thể theo dõi tiến trình và quyết định mua tiếp sau khi kỹ thuật viên hoàn tất thẩm định.`}
              </p>
            </div>
          </div>
        )}

        {/* Grid Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: Technical Report & Inspector Verdict (7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Product & Inspector Card */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-start gap-4">
                {postImage ? <img
                  src={postImage}
                  alt={postTitle}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
                /> : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sản phẩm thẩm định</span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug line-clamp-2">
                    {postTitle}
                  </h3>
                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-600">
                    <span>Giá sản phẩm: <strong className="text-slate-900 font-extrabold">{formatAmount(postPrice)}</strong></span>
                    <span>•</span>
                    <span>Tình trạng: <strong className="text-emerald-700 font-bold">{formatConditionGrade(conditionGrade, lang)}</strong></span>
                  </div>
                  {inspectionDto.sellerName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Người bán: <strong className="text-slate-700">{inspectionDto.sellerName}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Inspector & Hub metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">Kỹ thuật viên phụ trách</span>
                    <span className="font-bold text-slate-900 block truncate">{inspectorName}</span>
                    <span className="text-[10px] text-slate-500">{centerName}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* FULL PROPOSAL DETAILS CARD (Shown so Buyer and Seller see identical rich breakdown as chat & checkout) */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Chi tiết phương án kiểm định</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Mã đơn: #{effectiveOrderId.slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${isBuyerPurchaseRejected
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : isCancelled
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : isWaitingSellerApproval
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : isWaitingBuyerApproval
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : isWaitingFeePayment
                            ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                            : isPassed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isFailed
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : isInspecting
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : isInboundDelivered
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isShippingToCenter
                                      ? 'bg-cyan-100 text-cyan-800 border-cyan-300'
                                      : 'bg-teal-100 text-teal-900 border-teal-300'
                    }`}
                >
                  {isBuyerPurchaseRejected
                    ? (isUserSeller ? '❌ Người Mua Từ Chối Mua' : '❌ Bạn Đã Từ Chối Mua')
                    : isCancelled
                      ? '🚫 Đã Hủy / Từ Chối'
                      : isWaitingSellerApproval
                        ? '⏳ Chờ Người Bán Duyệt'
                        : isWaitingBuyerApproval
                          ? '⏳ Chờ Người Mua Duyệt Lại'
                          : isWaitingFeePayment
                            ? '💳 Chờ Nạp Phí Kiểm Định'
                            : isPassed
                              ? '✅ Đã Đạt Chuẩn'
                              : isFailed
                                ? '❌ Không Đạt'
                                : isInspecting
                                  ? '🔬 Đang Kiểm Định'
                                  : isInboundDelivered
                                    ? '🏢 Đã Đến Hub Kiểm Định'
                                    : isShippingToCenter
                                      ? '🚚 Đang Giao Đến Hub'
                                      : feePaymentLabel}
                </span>
              </div>

              {/* Center Details */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2 text-xs">
                <div className="flex items-start gap-2.5 text-slate-800">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{centerName}</span>
                    {centerAddress && (
                      <p className="text-[11px] text-slate-500">{centerAddress}</p>
                    )}
                    {centerPhone && (
                      <p className="text-[11px] text-slate-500">Hotline: {centerPhone}</p>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-slate-600 text-[11px]">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Phương thức giao nhận:</span>
                  <strong className="text-slate-800">{isAtHome ? 'Kiểm định tại nhà' : inspectionDto.orderType === 'AT_CENTER' ? 'Gửi hàng đến trung tâm kiểm định' : 'Chưa có dữ liệu'}</strong>
                </div>
              </div>

              {/* Sub-fee breakdown */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 text-xs shadow-2xs">
                <div className="flex justify-between items-center text-slate-700 font-bold border-b border-slate-100 pb-2">
                  <span>Chi tiết các khoản phí kiểm định:</span>
                  <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {buyerFeePercent == null ? 'Chưa có dữ liệu' : feePercentLabel(buyerFeePercent, lang)}
                  </span>
                </div>

                <div className="space-y-2 text-[11px] text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>• Phí kiểm định cơ sở:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(baseInspectionFee)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>• {inspectionTransportLabel}:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(inspectionTransportFee)}</span>
                  </div>
                  {!isAtHome && <div className="flex justify-between items-center">
                    <span>• Dự phòng hoàn hàng:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(returnReserveFee)}</span>
                  </div>}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-black">
                  <span className="text-slate-800">• Tổng phí kiểm định:</span>
                  <strong className="text-blue-900 font-black text-base">{formatAmount(totalInspectionFee)}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Người mua trả:</span>
                    <span className="font-black text-xs sm:text-sm text-[#c34c36]">{formatAmount(buyerFeeShare)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Người bán chịu:</span>
                    <span className="font-black text-xs sm:text-sm text-slate-800">{formatAmount(sellerFeeShare)}</span>
                  </div>
                </div>

                {/* Zin agreement notice */}
                {inspectionDto.buyerConsentZin === true && inspectionDto.sellerConsentZin === true && (
                  <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                    Người mua và người bán đã đồng ý cho phép tháo máy để kiểm định.
                  </div>
                )}

                {/* Reserve refund notice */}
                {returnReserveFee !== null && returnReserveFee > 0 && <p className="text-[10px] text-slate-500 italic leading-snug">
                  ℹ️ Khoản dự phòng cước trả về sẽ được hoàn lại nếu Buyer mua tiếp hoặc hoàn phần dư sau khi đối soát cước trả hàng.
                </p>}
              </div>
            </div>

            {/* Comprehensive Checklist Tabs */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#c34c36]" />
                  <h4 className="text-sm font-black text-slate-900">Chi tiết biên bản kỹ thuật{conditionScore != null && ` (${conditionScore}/100)`}</h4>
                </div>
                <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setActiveReportTab('checklist')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeReportTab === 'checklist' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
                  >
                    Checklist ({checklistItems.length})
                  </button>
                  <button
                    onClick={() => setActiveReportTab('verdict')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeReportTab === 'verdict' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
                  >
                    Đánh Giá KTV
                  </button>
                  <button
                    onClick={() => setActiveReportTab('media')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeReportTab === 'media' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
                  >
                    Video & Ảnh
                  </button>
                </div>
              </div>

              {/* Tab 1: Checklist items */}
              {activeReportTab === 'checklist' && (
                <div className="space-y-2.5">
                  {checklistItems.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <FileCheck className="w-10 h-10 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-800">Chưa có dữ liệu kiểm định linh kiện thực tế</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        {isPending
                          ? 'Đơn hàng đang chờ người bán gửi hàng đến Trung tâm và Kỹ thuật viên tiếp nhận máy. Sau khi KTV thực hiện kiểm tra thực tế, chi tiết từng hạng mục sẽ hiển thị tại đây.'
                          : isInspecting
                            ? 'Kỹ thuật viên đang trong quá trình đo đạc và kiểm tra thiết bị tại Hub/tại nhà.'
                            : 'Biên bản kiểm tra kỹ thuật chưa được cập nhật.'}
                      </p>
                    </div>
                  ) : (
                    checklistItems.map((chk, idx) => (
                      <div
                        key={chk.id || idx}
                        className="p-3.5 rounded-2xl border border-slate-100 hover:border-emerald-200 bg-slate-50/50 hover:bg-emerald-50/20 transition flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {chk.status === 'PASSED' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              : chk.status === 'FAILED' ? <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                : <FileCheck className="h-4 w-4 shrink-0 text-slate-400" />}
                            <span className="text-xs font-bold text-slate-900">{chk.title}</span>
                          </div>
                          {chk.note && <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                            {chk.note}
                          </p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${chk.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' :
                          chk.status === 'FAILED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {chk.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Inspector Verdict */}
              {activeReportTab === 'verdict' && (() => {
                const parsedVerdict = parseInspectorVerdictNote(inspectorNote || '');
                const effectiveGrade = conditionGrade || parsedVerdict.grade || 'Chưa có';
                const effectiveScore = conditionScore != null ? `${conditionScore}/100` : (parsedVerdict.score ? `${parsedVerdict.score}` : 'Chưa có');

                return (
                  <div className="space-y-4 text-xs text-slate-700 animate-fadeIn">
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 border border-emerald-200/90 shadow-2xs space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-100">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${isPassed ? 'bg-emerald-600 text-white' : isFailed ? 'bg-rose-600 text-white' : 'bg-slate-600 text-white'
                            }`}>
                            {isPassed ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : isFailed ? <XCircle className="w-4 h-4 stroke-[2.5]" /> : <FileCheck className="w-4 h-4 stroke-[2.5]" />}
                          </div>
                          <div>
                            <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                              Kết luận tổng thể của Kỹ thuật viên
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Đánh giá chuyên môn từ trạm kiểm định SecondLife Hub
                            </span>
                          </div>
                        </div>

                        <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${isPassed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isFailed
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}>
                          {isPassed ? 'ĐẠT CHUẨN (PASS)' : isFailed ? 'TỪ CHỐI (FAILED)' : 'ĐANG KIỂM ĐỊNH'}
                        </span>
                      </div>

                      {/* Main Note text */}
                      <div className="p-3.5 bg-white rounded-2xl border border-emerald-100/90 shadow-2xs">
                        {parsedVerdict.cleanText ? (
                          <p className="text-slate-800 text-xs sm:text-sm font-bold leading-relaxed">
                            "{parsedVerdict.cleanText}"
                          </p>
                        ) : (
                          <p className="text-slate-500 text-xs italic">
                            {(isPassed || isFailed)
                              ? 'Kỹ thuật viên không để lại ghi chú thêm.'
                              : 'Chưa có nhận xét kiểm định từ kỹ thuật viên.'}
                          </p>
                        )}
                      </div>

                      {/* Metadata Chips: Bao bì & Phụ kiện */}
                      {(parsedVerdict.packaging || parsedVerdict.accessories) && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {parsedVerdict.packaging && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 shadow-2xs">
                              <span className="font-bold text-amber-800">Tình trạng bao bì:</span>
                              <span className="font-medium text-amber-900">{parsedVerdict.packaging}</span>
                            </div>
                          )}
                          {parsedVerdict.accessories && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-sky-950 shadow-2xs">
                              <span className="font-bold text-sky-800">Phụ kiện bàn giao:</span>
                              <span className="font-medium text-sky-900">{parsedVerdict.accessories}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                        <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                          Tình trạng sau kiểm định
                        </span>
                        <strong className="text-base font-black text-slate-900 block">{formatConditionGrade(effectiveGrade, lang)}</strong>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                        <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                          Điểm đánh giá kỹ thuật
                        </span>
                        <strong className="text-base font-black text-[#c34c36] block">{effectiveScore}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tab 3: Media & Video proof */}
              {activeReportTab === 'media' && (
                <div className="space-y-4">
                  {hasAnyVideo ? (
                    <>
                      {videoProofUrl && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-[#c34c36]" />
                              <span>Video quá trình tháo máy & kiểm định kỹ thuật</span>
                            </span>
                            <a
                              href={videoProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[#c34c36] hover:underline flex items-center gap-1"
                            >
                              <span>Mở video</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="aspect-video rounded-2xl bg-black overflow-hidden shadow-inner flex items-center justify-center">
                            {getEmbedUrl(videoProofUrl) ? (
                              <iframe
                                src={getEmbedUrl(videoProofUrl)!}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Video kiểm định kỹ thuật"
                              />
                            ) : (
                              <video
                                controls
                                playsInline
                                preload="metadata"
                                src={videoProofUrl}
                                onError={() => markMediaUnavailable(videoProofUrl)}
                                className="w-full h-full object-contain"
                              >
                                Trình duyệt của bạn không hỗ trợ phát video trực tiếp.
                              </video>
                            )}
                          </div>
                        </div>
                      )}

                      {unboxingVideoUrl && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-emerald-600" />
                              <span>Video mở thùng & đồng kiểm bóc seal</span>
                            </span>
                            <a
                              href={unboxingVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[#c34c36] hover:underline flex items-center gap-1"
                            >
                              <span>Mở video</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="aspect-video rounded-2xl bg-black overflow-hidden shadow-inner flex items-center justify-center">
                            {getEmbedUrl(unboxingVideoUrl) ? (
                              <iframe
                                src={getEmbedUrl(unboxingVideoUrl)!}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Video mở thùng đồng kiểm"
                              />
                            ) : (
                              <video
                                controls
                                playsInline
                                preload="metadata"
                                src={unboxingVideoUrl}
                                onError={() => markMediaUnavailable(unboxingVideoUrl)}
                                className="w-full h-full object-contain"
                              >
                                Trình duyệt của bạn không hỗ trợ phát video trực tiếp.
                              </video>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : inspectorPhotos.length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <VideoOff className="w-10 h-10 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-800">Chưa có ảnh hoặc video kiểm định khả dụng</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        {inspectionDto.videoCleanedMessage || (isPending
                          ? 'Đơn hàng đang chờ xử lý. Kỹ thuật viên chưa tiếp nhận thiết bị để quay video kiểm định.'
                          : isInspecting
                            ? 'Kỹ thuật viên đang kiểm định thiết bị. Video quá trình tháo máy sẽ hiển thị tại đây sau khi hoàn tất.'
                            : 'Biên bản chưa có ảnh hoặc video có thể hiển thị.')}
                      </p>
                    </div>
                  )}

                  {/* Ảnh chụp hiện trạng thực tế từ KTV */}
                  {inspectorPhotos.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-emerald-600" />
                          <span>Ảnh chụp hiện trạng thực tế do KTV cung cấp ({inspectorPhotos.length})</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {inspectorPhotos.map((photoUrl, idx) => {
                          const isMainPhoto = !hasAnyVideo && idx === 0;
                          return (
                            <a
                              key={photoUrl}
                              href={photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`group relative block overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 transition hover:shadow-md ${isMainPhoto ? 'col-span-full' : 'aspect-square'
                                }`}
                            >
                              <img
                                src={photoUrl}
                                alt={`Ảnh kiểm định ${idx + 1}`}
                                onError={() => markMediaUnavailable(photoUrl)}
                                className={isMainPhoto ? 'max-h-[65vh] w-full object-contain' : 'h-full w-full object-cover'}
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1">
                                <ExternalLink className="w-4 h-4" />
                                <span>Xem ảnh gốc</span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: Financial Breakdown & Decision Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">

            {/* Payment Summary Box */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>Tài Chính & Ký Quỹ Đơn Hàng</span>
                </h4>
                <span className="text-[11px] font-bold text-slate-400">2 Giai Đoạn</span>
              </div>

              {/* Stage 1: Already paid upfront or waiting approval */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Giai đoạn 1 (Phí kiểm định & vận chuyển):</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isBuyerPurchaseRejected || feesPaid || inspectionDto.feeSettledAt
                      ? 'bg-emerald-100 text-emerald-800'
                      : isCancelled
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-900'
                      }`}
                  >
                    {isBuyerPurchaseRejected || feesPaid || inspectionDto.feeSettledAt ? 'ĐÃ NỘP PHÍ' : isCancelled ? 'ĐÃ HỦY' : feePaymentLabel}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600 pl-5">
                  <div className="flex justify-between">
                    <span>• Phí kiểm định cơ sở:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(baseInspectionFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• {inspectionTransportLabel}:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(inspectionTransportFee)}</span>
                  </div>
                  {!isAtHome && <div className="flex justify-between">
                    <span>• Dự phòng hoàn hàng:</span>
                    <span className="font-semibold text-slate-800">{formatAmount(returnReserveFee)}</span>
                  </div>}
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-bold text-slate-800">
                    <span>Tổng phí kiểm định giai đoạn 1:</span>
                    <span className="text-blue-900 font-extrabold">{formatAmount(totalInspectionFee)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <div className="bg-blue-50/70 p-1.5 rounded-lg border border-blue-100">
                      <span className="text-slate-500 block text-[10px]">Người mua trả:</span>
                      <strong className="text-[#c34c36]">{formatAmount(buyerFeeShare)}</strong>
                    </div>
                    <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">Người bán chịu:</span>
                      <strong className="text-slate-700">{formatAmount(sellerFeeShare)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 2: Final Payment to Buy Product */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-white border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Giai đoạn 2 (Tiền sản phẩm):</span>
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 text-right ${isOrderCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : isOrderDelivered
                      ? 'bg-emerald-100 text-emerald-800'
                      : isBuyerPurchaseRejected
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : isCancelled
                          ? 'bg-rose-100 text-rose-800'
                          : canDecide
                            ? 'bg-amber-100 text-amber-900 animate-pulse'
                            : isFailed
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                    }`}>
                    {isOrderCompleted
                      ? (isUserSeller ? 'ĐÃ NHẬN TIỀN VÀO VÍ' : 'HOÀN TẤT • ĐÃ GIẢI NGÂN')
                      : isOrderDelivered
                        ? (isUserSeller ? 'ĐÃ GIAO HÀNG (48H)' : 'ĐÃ GIAO • ĐỐI SOÁT 48H')
                        : purchaseDecision
                          ? inspectionPurchaseDecisionLabel(purchaseDecision, lang, isUserSeller)
                          : isBuyerPurchaseRejected
                            ? (isUserSeller ? 'Người mua từ chối mua' : 'Bạn đã từ chối mua')
                            : isCancelled
                              ? 'ĐÃ HỦY'
                              : isFailed
                                ? 'KHÔNG MỞ THANH TOÁN'
                                : 'CHƯA MỞ THANH TOÁN'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 pl-5">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>• Tiền sản phẩm:</span>
                      {!hasInspectionResult && (
                        <span className="text-[11px] text-amber-700 font-medium italic">(Chưa tính tiền vận chuyển)</span>
                      )}
                    </span>
                    <span className="font-bold text-slate-900 shrink-0">{formatVND(finalItemPrice)}</span>
                  </div>

                  {hasInspectionResult && (
                    <div className="flex justify-between items-baseline gap-2">
                      <span>• Tiền vận chuyển {stageTwoDeliveryRoute}:</span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {isLoadingQuote && !apiDeliveryFee ? (
                          <span className="text-slate-400 font-normal italic text-[11px]">Đang tính cước...</span>
                        ) : (
                          formatVND(apiDeliveryFee)
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2 border-t border-amber-200/80 font-black text-sm text-[#24263e]">
                    <span>Tổng tiền thanh toán giai đoạn 2:</span>
                    <span className="text-base font-black text-[#c34c36]">
                      {formatVND(hasInspectionResult ? (finalItemPrice + (apiDeliveryFee || 0)) : finalItemPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallet Balance Status (chỉ hiện cho người mua khi đã Đạt và cần thanh toán) */}
              {canDecide && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold">Số dư Ví SecondLife</span>
                      <span className="font-mono font-bold text-slate-900">{formatAmount(currentWalletBal)}</span>
                    </div>
                  </div>
                  {walletShortfall === null ? null : walletShortfall === 0 ? (
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Đủ số dư
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Chênh lệch {formatVND(walletShortfall)}
                      </span>
                      {onOpenTopUp && (
                        <button
                          type="button"
                          onClick={onOpenTopUp}
                          className="px-2.5 py-1 rounded-lg bg-[#c34c36] hover:bg-[#a83c28] text-white text-[11px] font-bold cursor-pointer transition shadow-2xs"
                        >
                          Nạp ngay
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Phân quyền rành mạch giữa Người bán và Người mua */}
              <div className="space-y-3 pt-2">
                {decisionSettled ? (
                  purchaseDecision === 'accepted' ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>
                          {isOrderCompleted
                            ? (isUserSeller ? 'Đã Nhận Tiền Vào Ví' : 'Giao Dịch Hoàn Tất')
                            : isOrderDelivered
                              ? (isUserSeller ? 'Đã Giao Hàng (48h Đối Soát)' : 'Đã Giao • 48h Kiểm Tra')
                              : (isUserSeller ? 'Người Mua Đã Mua Tiếp' : 'Đã Xác Nhận Mua Hàng')}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        {isOrderCompleted
                          ? (isUserSeller
                            ? 'Đơn hàng đã được xác nhận hoàn tất thành công. Tiền bán hàng đã được tự động giải ngân về ví của bạn.'
                            : 'Đơn hàng đã hoàn tất thành công. Bạn đã nhận hàng và tiền hàng đã được giải ngân cho người bán.')
                          : isOrderDelivered
                            ? (isUserSeller
                              ? 'Kiện hàng đã được tài xế Lalamove giao tới người mua. Khách mua có 48 giờ để dùng thử và kiểm tra đối soát.'
                              : 'Kiện hàng đã được giao tới bạn. Bạn có 48 giờ để kiểm tra sản phẩm trước khi hệ thống tự động giải ngân.')
                            : (isUserSeller
                              ? (isAtHome
                                ? 'Người mua đã thanh toán tiền mua sản phẩm. Vui lòng đóng gói cẩn thận và bàn giao cho tài xế Lalamove khi tài xế đến lấy hàng.'
                                : 'Người mua đã thanh toán tiền mua sản phẩm. Trung tâm Hub đang chuẩn bị giao hàng đến người mua.')
                              : 'Bạn đã hoàn tất thanh toán tiền sản phẩm (GĐ 2). Đơn hàng đang được điều phối vận chuyển đến bạn.')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCertificateModal(true)}
                        className="w-full py-3 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Award className="w-4 h-4 text-amber-600" />
                        <span>Xem Chứng Nhận Kiểm Định</span>
                      </button>
                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Danh Sách Đơn Hàng
                      </button>
                    </div>
                  ) : null
                ) : isUserSeller ? (
                  isWaitingSellerApproval ? (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                        <Store className="w-4 h-4 text-indigo-600" />
                        <span>Đề Xuất Kiểm Định Từ Người Mua</span>
                      </div>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        Người mua đã đề xuất kiểm định sản phẩm này {isAtHome ? 'tại nhà bạn' : 'tại trung tâm Hub'} trước khi nhận hàng. Bạn có đồng ý với phương án kiểm định và phân chia phí này không?
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSellerAcceptProposal}
                          disabled={isSubmitting}
                          className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs disabled:opacity-50 text-center"
                        >
                          {isSubmitting ? 'Đang xử lý...' : 'Đồng Ý'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectModal(true)}
                          disabled={isSubmitting}
                          className="w-full py-3 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 text-center"
                        >
                          Từ Chối
                        </button>
                      </div>

                      {/* Nút Thương Lượng Lại */}
                      <button
                        type="button"
                        onClick={handleOpenNegotiationChat}
                        disabled={isSubmitting || isNavigatingChat}
                        className="w-full py-3 px-3 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:opacity-95 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center justify-center gap-2 text-center disabled:opacity-50"
                      >
                        {isNavigatingChat ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang chuyển đến đoạn chat...</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 text-indigo-200" />
                            <span>Thương Lượng Lại</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Quản Lý Đơn Bán Hàng
                      </button>
                    </div>
                  ) : isWaitingFeePayment ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                        <Wallet className="w-4 h-4 text-amber-600" />
                        <span>
                          {sellerFeeShare > 0 && !inspectionDto.sellerPaidAt
                            ? 'Chờ Bạn Nộp Phí Kiểm Định (Giai Đoạn 1)'
                            : sellerFeeShare === 0
                              ? 'Đang Chờ Người Mua Nộp Phí Kiểm Định'
                              : 'Đã Nộp Phí • Chờ Người Mua Thanh Toán'}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {sellerFeeShare > 0 && !inspectionDto.sellerPaidAt
                          ? `Hai bên đã thống nhất phương án chia phí. Phần phí kiểm định của người bán là ${formatAmount(sellerFeeShare)}. Vui lòng thanh toán vào Quỹ Escrow để tiếp tục.`
                          : sellerFeeShare === 0
                            ? `Phương án kiểm định quy định người mua chịu 100% phí (${formatAmount(buyerFeeShare)}). Bạn không cần thanh toán phí ở giai đoạn 1 và đang chờ người mua nộp phí.`
                            : `Bạn đã nộp thành công phần phí kiểm định (${formatAmount(sellerFeeShare)}). Đang chờ người mua hoàn tất phần phí còn lại.`}
                      </p>
                      {sellerFeeShare > 0 && !inspectionDto.sellerPaidAt && (
                        <button
                          type="button"
                          onClick={handlePayInspectionFee}
                          disabled={isSubmitting}
                          className="w-full py-3 px-3 bg-gradient-to-r from-orange-600 via-amber-600 to-[#c34c36] hover:opacity-95 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md disabled:opacity-50 text-center"
                        >
                          {isSubmitting ? 'Đang xử lý...' : `Nộp Phí Kiểm Định (${formatAmount(sellerFeeShare)})`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Quản Lý Đơn Bán Hàng
                      </button>
                    </div>
                  ) : isBuyerPurchaseRejected ? (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Người Mua Từ Chối Mua Tiếp</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-rose-900 leading-relaxed">
                        <p>
                          <strong>Lý do từ chối:</strong> {rejectionDetails.buyerRejectReason || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân'}
                        </p>
                        <p className="text-rose-700">
                          Sản phẩm đã kiểm định đạt chuẩn nhưng khách hàng chọn không tiếp tục mua. Hub sẽ thực hiện thủ tục hoàn trả thiết bị về cho bạn.
                        </p>
                      </div>
                      {(escrowOrderForShipment || order) && (
                        <button
                          type="button"
                          onClick={() => setShowCertificateModal(true)}
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Award className="w-4 h-4" />
                          <span>Xem Chứng Nhận Kiểm Định</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenNegotiationChat}
                        disabled={isNavigatingChat}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:opacity-95 text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 text-center disabled:opacity-50"
                      >
                        {isNavigatingChat ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang chuyển đến đoạn chat...</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 text-indigo-200" />
                            <span>Mở Phòng Chat Với Người Mua</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Quản Lý Đơn Bán Hàng
                      </button>
                    </div>
                  ) : isCancelled ? (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Đề Xuất Kiểm Định Đã Kết Thúc</span>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        {(() => {
                          const rawReason = rejectionDetails.buyerRejectReason || String(inspectionDto?.note || (order as any)?.note || (order as any)?.inspectionNote || '').trim();
                          return rawReason
                            ? `Lý do: ${rawReason}`
                            : 'Yêu cầu kiểm định này đã bị hủy hoặc từ chối. Không có chi phí nào phát sinh.';
                        })()}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenNegotiationChat}
                        disabled={isNavigatingChat}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:opacity-95 text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 text-center disabled:opacity-50"
                      >
                        {isNavigatingChat ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang chuyển đến đoạn chat...</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 text-indigo-200" />
                            <span>Mở Phòng Chat Với Người Mua</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Quản Lý Đơn Bán Hàng
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                        <Store className="w-4 h-4 text-indigo-600" />
                        <span>Góc Nhìn Người Bán</span>
                      </div>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        {isPassed
                          ? 'Sản phẩm đã đạt kiểm định và đang chờ người mua quyết định.'
                          : isFailed
                            ? 'Sản phẩm kiểm định không đạt tiêu chuẩn kỹ thuật. Bạn có thể xem kết quả trong biên bản.'
                            : 'Sản phẩm đang trong quá trình tiếp nhận & kiểm định thực tế. Bạn không thể tự mua lại sản phẩm của chính mình.'}
                      </p>
                      <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-3 rounded-xl bg-[#24263e] hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer text-center"
                      >
                        Quay Lại Quản Lý Đơn Bán Hàng
                      </button>
                    </div>
                  )
                ) : isWaitingSellerApproval ? (
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>{isAtHome ? 'Đang Chờ Người Bán Phản Hồi Kiểm Định Tại Nhà' : 'Đang Chờ Người Bán Phản Hồi'}</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {isAtHome
                        ? 'Yêu cầu cử kỹ thuật viên đến tận nhà người bán kiểm định đã được gửi. Bạn có thể thương lượng thêm trong phòng chat hoặc chờ người bán phản hồi đồng ý phương án phân chia phí.'
                        : 'Yêu cầu kiểm định của bạn đã được gửi tới người bán. Bạn có thể thương lượng thêm trong phòng chat hoặc chờ người bán phản hồi đồng ý.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenNegotiationChat}
                      disabled={isNavigatingChat}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isNavigatingChat ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang chuyển đến đoạn chat...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-blue-200" />
                          <span>Đến Phòng Chat Thương Lượng</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : isWaitingBuyerApproval ? (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>Người Bán Đã Đề Xuất Lại Phương Án</span>
                    </div>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      Người bán đã đề xuất lại phương án kiểm định / phân chia phí. Vui lòng vào phòng chat để xem và phản hồi đề xuất mới.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenNegotiationChat}
                      disabled={isNavigatingChat}
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isNavigatingChat ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang chuyển đến đoạn chat...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-purple-200" />
                          <span>Đến Phòng Chat Xem Đề Xuất Mới</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : isWaitingFeePayment ? (
                  /* GIAI ĐOẠN 1: CHỜ NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) - GÓC NHÌN NGƯỜI MUA */
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      {buyerFeeShare === 0 ? (
                        <>
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Chờ Người Bán Nộp Phí Kiểm Định (Giai Đoạn 1)</span>
                        </>
                      ) : inspectionDto.buyerPaidAt ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Đã Nộp Phí • Chờ Người Bán Thanh Toán</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 text-orange-600" />
                          <span>Chờ Bạn Nộp Phí Kiểm Định (Giai Đoạn 1)</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {buyerFeeShare === 0 ? (
                        <>
                          Hai bên đã thống nhất phương án chia phí: <strong className="text-amber-950">Người bán chịu 100% chi phí kiểm định ({formatAmount(sellerFeeShare)})</strong>. Bạn không cần nộp khoản phí nào ở giai đoạn 1. Đơn hàng đang chờ người bán hoàn tất nộp phí vào Quỹ Escrow để Trung tâm điều phối kiểm định.
                        </>
                      ) : inspectionDto.buyerPaidAt ? (
                        <>
                          Bạn đã nộp thành công phần phí kiểm định của mình (<strong className="text-emerald-900">{formatAmount(buyerFeeShare)}</strong>). Đơn hàng đang chờ người bán nộp phần phí còn lại ({formatAmount(sellerFeeShare)}) vào Quỹ Escrow.
                        </>
                      ) : (
                        <>
                          Hai bên đã thống nhất phương án chia phí. Vui lòng thanh toán phần phí kiểm định của bạn là <strong className="text-orange-950">{formatAmount(buyerFeeShare)}</strong> vào Quỹ Escrow để Trung tâm tiếp nhận và tiến hành quy trình kiểm định.
                        </>
                      )}
                    </p>
                    {buyerFeeShare > 0 && !inspectionDto.buyerPaidAt && (
                      <button
                        type="button"
                        onClick={handlePayInspectionFee}
                        disabled={isSubmitting}
                        className="w-full py-3 px-3 bg-gradient-to-r from-orange-600 via-amber-600 to-[#c34c36] hover:opacity-95 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md disabled:opacity-50 text-center"
                      >
                        {isSubmitting ? 'Đang xử lý...' : `Nộp Phí Kiểm Định (${formatAmount(buyerFeeShare)})`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : isFailed ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Kiểm Định Không Đạt (Đơn Hàng Đã Dừng)</span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      Sản phẩm không đạt chuẩn kiểm định chất lượng sau khi KTV nghiệm thu. Đơn hàng đã dừng và thiết bị sẽ được chuyển hoàn trả lại cho người bán.
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : isBuyerPurchaseRejected ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Bạn Đã Từ Chối Mua Tiếp</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-rose-900 leading-relaxed">
                      <p>
                        <strong>Lý do từ chối:</strong> {rejectionDetails.buyerRejectReason || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân'}
                      </p>
                      <p className="text-rose-700">
                        Bạn đã xem kết quả kiểm định đạt chuẩn và chọn không tiếp tục mua sản phẩm. Thiết bị sẽ được chuyển hoàn lại cho người bán.
                      </p>
                    </div>
                    {(escrowOrderForShipment || order) && (
                      <button
                        type="button"
                        onClick={() => setShowCertificateModal(true)}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Award className="w-4 h-4" />
                        <span>Xem Chứng Nhận Kiểm Định</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : isCancelled ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Đề Xuất Kiểm Định Đã Kết Thúc</span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      {(() => {
                        const rawReason = rejectionDetails.buyerRejectReason || String(inspectionDto?.note || (order as any)?.note || (order as any)?.inspectionNote || '').trim();
                        return rawReason
                          ? `Lý do: ${rawReason}`
                          : 'Yêu cầu kiểm định này đã bị hủy hoặc từ chối. Không có chi phí nào phát sinh.';
                      })()}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenNegotiationChat}
                      disabled={isNavigatingChat}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:opacity-95 text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 text-center disabled:opacity-50"
                    >
                      {isNavigatingChat ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang chuyển đến đoạn chat...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-indigo-200" />
                          <span>Mở Phòng Chat Với Người Bán</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : !canDecide ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Chưa Có Quyết Định Mua (Chờ KTV Hoàn Tất Thẩm Định)</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Sản phẩm chưa có biên bản thẩm định đạt từ Kỹ thuật viên. Nút thanh toán tiền mua hàng (Giai đoạn 2) sẽ tự động mở khi KTV kiểm tra xong và xuất biên bản ĐẠT CHUẨN.
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer text-center"
                    >
                      Quay Lại Danh Sách Đơn Hàng
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={isSubmitting || timeLeft.isExpired || isLoadingQuote}
                      className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    >
                      <div className="flex items-center gap-2">
                        {isLoadingQuote ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        )}
                        <span className="font-black text-sm">XÁC NHẬN MUA TIẾP</span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-100">
                        {isLoadingQuote
                          ? 'Đang tính cước giao hàng...'
                          : finalShippingQuote
                            ? `Trừ ${formatVND(finalPriceToPay)} từ ví Escrow (gồm ${formatVND(apiDeliveryFee)} cước giao ${stageTwoDeliveryRoute})`
                            : 'Xem địa chỉ nhận hàng và cước giao'}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-red-600 hover:border-red-300 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center text-center"
                    >
                      <span>Từ chối mua tiếp / Hủy đơn (Báo Cho Người Bán)</span>
                    </button>
                  </>
                )}
              </div>

              {/* Policy note */}
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Sau khi thanh toán tiền sản phẩm, tiền vẫn được bảo vệ tại Escrow cho tới khi bưu tá giao tận tay và bạn xác nhận nhận hàng thành công.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: Confirm Final Purchase Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Xác Nhận Mua Hàng & Thanh Toán</h3>
                <p className="text-xs text-slate-500">Hoàn tất đơn mua sau kiểm định kỹ thuật</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sản phẩm:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">{postTitle}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tiền sản phẩm:</span>
                <span className="font-bold text-slate-900">{formatVND(finalItemPrice)}</span>
              </div>
              <div className="flex justify-between gap-2 text-slate-600">
                <span>Cước giao {stageTwoDeliveryRoute}:</span>
                <span className="shrink-0 font-bold text-slate-900">
                  {finalShippingQuote ? formatVND(apiDeliveryFee) : isLoadingQuote ? 'Đang tính cước…' : 'Chưa có báo giá'}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-slate-600">
                <span className="shrink-0">Địa chỉ nhận hàng:</span>
                <span className="min-w-0 break-words text-right font-medium text-slate-700">
                  {displayedRecipientAddress || (isLoadingQuote ? 'Đang tải địa chỉ…' : 'Chưa xác định được địa chỉ')}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-600">
                <span className="font-bold">Tổng thanh toán GĐ 2:</span>
                <span className="font-extrabold text-[#c34c36] text-sm">{finalShippingQuote ? formatVND(finalPriceToPay) : '—'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phương thức:</span>
                <span className="font-semibold text-slate-800">Ví SecondLife Escrow</span>
              </div>
            </div>

            {finalShippingQuote && (
              <p className="text-xs text-slate-600 leading-relaxed">
                Bằng việc bấm xác nhận, số tiền <strong>{formatVND(finalPriceToPay)}</strong> (gồm {formatVND(finalItemPrice)} tiền sản phẩm và {formatVND(apiDeliveryFee)} cước giao {stageTwoDeliveryRoute}) sẽ được chuyển vào quỹ Escrow bảo lãnh.
              </p>
            )}

            {quoteError && (
              <div role="status" className="flex items-center justify-between gap-3 text-xs text-amber-800">
                <span>{quoteError}</span>
                <button
                  type="button"
                  onClick={() => setQuoteAttempt((attempt) => attempt + 1)}
                  className="shrink-0 font-bold underline"
                >
                  Thử lại
                </button>
              </div>
            )}

            {finalShippingQuote && !isWalletSufficient && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold block">Số dư ví không đủ:</span>
                  <span>Cần nạp thêm {formatVND(walletShortfall || (finalPriceToPay - (currentWalletBal || 0)))}</span>
                </div>
                {onOpenTopUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmModal(false);
                      onOpenTopUp();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a83c28] text-white text-xs font-bold cursor-pointer transition shrink-0"
                  >
                    Nạp Tiền Ngay
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={isSubmitting || !finalShippingQuote || !isWalletSufficient || timeLeft.isExpired}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : timeLeft.isExpired ? (
                  <span>Đã hết hạn quyết định</span>
                ) : (
                  <span>Xác Nhận & Thanh Toán</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Purchase Dialog (Notify Seller or Seller rejects proposal) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isUserSeller && isWaitingSellerApproval ? 'Từ Chối Đề Xuất Kiểm Định' : 'Từ Chối Mua Tiếp & Báo Người Bán'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isUserSeller && isWaitingSellerApproval
                    ? 'Từ chối yêu cầu kiểm định và chia phí từ người mua'
                    : 'Hủy đơn mua hàng sau khi xem kết quả kiểm định'}
                </p>
              </div>
            </div>

            {isUserSeller && isWaitingSellerApproval ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 block">
                  Nhập lý do từ chối đề xuất kiểm định:
                </label>
                <textarea
                  value={customRejectNote}
                  onChange={(e) => setCustomRejectNote(e.target.value)}
                  placeholder="Nhập lý do bạn không đồng ý kiểm định (ví dụ: Muốn bán giao trực tiếp, không đồng ý tháo máy, không đồng ý chia phí...)..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-rose-400 bg-slate-50/50"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 block">
                  Chọn lý do bạn không tiếp tục mua sản phẩm:
                </label>
                {[
                  'Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng',
                  'Kết quả kiểm định pin hoặc linh kiện chưa đáp ứng nhu cầu',
                  'Phát hiện dấu hiệu linh kiện đã từng được thay thế',
                  'Thay đổi nhu cầu sử dụng / Lý do cá nhân',
                  'Lý do khác'
                ].map((reason) => (
                  <label
                    key={reason}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${selectedRejectReason === reason
                      ? 'bg-red-50 border-red-300 text-red-950 ring-1 ring-red-200'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="rejectReason"
                      value={reason}
                      checked={selectedRejectReason === reason}
                      onChange={(e) => {
                        setSelectedRejectReason(e.target.value);
                        if (e.target.value !== 'Lý do khác') {
                          setCustomRejectNote('');
                        }
                      }}
                      className="accent-red-600"
                    />
                    <span>{reason}</span>
                  </label>
                ))}

                {/* Phần ghi chú chỉ hiển thị khi chọn Lý do khác */}
                {selectedRejectReason === 'Lý do khác' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <span>Ghi chú chi tiết thêm cho Người bán (*):</span>
                      <span
                        className={`font-bold transition ${rejectWordCount === 0
                          ? 'text-slate-400'
                          : isRejectNoteValid
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                          }`}
                      >
                        {rejectWordCount === 0
                          ? 'Yêu cầu trên 10 chữ và dưới 50 chữ'
                          : isRejectNoteValid
                            ? `✓ Hợp lệ (${rejectWordCount} từ)`
                            : rejectWordCount <= 10
                              ? `Cần trên 10 chữ (hiện có ${rejectWordCount} từ)`
                              : `Cần dưới 50 chữ (hiện có ${rejectWordCount} từ)`}
                      </span>
                    </div>
                    <textarea
                      value={customRejectNote}
                      onChange={(e) => setCustomRejectNote(e.target.value)}
                      placeholder="Nhập lý do chi tiết từ chối mua tiếp (yêu cầu trên 10 chữ và dưới 50 chữ)..."
                      rows={3}
                      className={`w-full p-3 rounded-xl border text-xs text-slate-800 focus:outline-none bg-slate-50/50 transition ${rejectWordCount > 0 && !isRejectNoteValid
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20'
                        : rejectWordCount > 0 && isRejectNoteValid
                          ? 'border-emerald-400 focus:border-emerald-500 bg-emerald-50/20'
                          : 'border-slate-200 focus:border-red-400'
                        }`}
                    />
                    {rejectWordCount > 0 && !isRejectNoteValid && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {rejectWordCount <= 10
                          ? `⚠️ Bạn cần nhập trên 10 chữ (hiện tại có ${rejectWordCount} từ, còn thiếu ít nhất ${11 - rejectWordCount} từ).`
                          : `⚠️ Bạn đã nhập ${rejectWordCount} từ, vượt quá giới hạn tối đa dưới 50 từ.`}
                      </p>
                    )}
                  </div>
                )}

                {/* <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Hệ thống sẽ gửi thông báo ngay cho Người bán:</strong> Sản phẩm sẽ được Trung tâm đóng gói sản phẩm hoàn trả về địa chỉ người bán theo quy chế sàn.
                  </p>
                </div> */}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={isUserSeller && isWaitingSellerApproval ? handleSellerRejectProposal : handleRejectPurchase}
                disabled={
                  isSubmitting ||
                  (isUserSeller && isWaitingSellerApproval && !customRejectNote.trim()) ||
                  (!isUserSeller && isOtherRejectReason && !isRejectNoteValid)
                }
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>{isUserSeller && isWaitingSellerApproval ? 'Xác Nhận Từ Chối' : 'Xác Nhận Từ Chối & Báo Người Bán'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo Vận Đơn Vận Chuyển Lalamove (dành cho Người bán) */}
      {showShipmentModal && escrowOrderForShipment && (
        <CreateShipmentModal
          order={escrowOrderForShipment}
          onClose={() => setShowShipmentModal(false)}
          onShipmentCreated={() => {
            setShowShipmentModal(false);
            if (effectiveOrderId) {
              inspectorService.getOrder(effectiveOrderId).then((dto) => {
                if (dto) setInspectionDto(dto);
              }).catch(() => { });
            }
            setAlertNotice({
              type: 'success',
              message: 'Đã tạo vận đơn Lalamove thành công! Tài xế đang được điều phối đến lấy máy.'
            });
          }}
          lang={lang}
        />
      )}

      {/* Modal Giấy Chứng Nhận / Biên Bản Kiểm Định Kỹ Thuật */}
      {showCertificateModal && (escrowOrderForShipment || order) && (
        <DigitalInspectionCertificateModal
          order={(escrowOrderForShipment || order)!}
          initialDto={inspectionDto}
          onClose={() => setShowCertificateModal(false)}
          lang={lang}
        />
      )}

      {/* Modal Hẹn Lịch Đón KTV (dành cho Người bán khi kiểm định tại nhà) */}
      {showScheduleModal && (
        <ScheduleAppointmentModal
          orderId={effectiveOrderId}
          orderCode={effectiveOrderId}
          linkedOrderId={(inspectionDto as any)?.linkedOrderId || (order as any)?.linkedOrderId || effectiveOrderId}
          inspectionOrderId={inspectionDto?.id || effectiveOrderId}
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            if (effectiveOrderId) {
              inspectorService.getOrder(effectiveOrderId).then((dto) => {
                if (dto) setInspectionDto(dto);
              }).catch(() => { });
            }
          }}
          lang={lang}
          readOnly={!isUserSeller}
          initialScheduledAt={inspectionDto?.appointmentScheduledAt || currentAppt?.scheduledAt || undefined}
          initialNote={(inspectionDto as any)?.appointmentNote || currentAppt?.note || undefined}
          order={inspectionDto || order}
        />
      )}

    </div>
  );
};

import { paths } from '../app/router/paths';
import React, { useState, useEffect, useMemo } from 'react';
import { EscrowOrder, Language, UserProfile } from '../types';
import { formatVND } from '../utils/translations';
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
import { DigitalInspectionCertificateModal, buildInspectionReportFromDto } from '../components/modals/DigitalInspectionCertificateModal';
import { inspectorService, InspectionOrderDto } from '../services/inspectorService';
import { shippingService } from '../services/shippingService';
import { ShipmentBackend, ShippingQuoteResponseDto } from '../types';
import { walletService, WalletBackend } from '../services/walletService';
import { saveScopedLocalNotification } from '../utils/notificationStorage';
import { getCustomerInspectionStatus, getInspectionPurchaseDecision, inspectionPurchaseDecisionLabel, isExpiredInspectionPurchase } from '../utils/inspectionPurchase';
import { notificationWsClient } from '../services/notificationWsClient';
import { getInspectionReportMedia, getInspectionStageOne } from '../utils/inspectionDecisionData';
import { canAppealInspection, getHubReturnProgress, getHubReturnState, getReturnReserveMessage, isHubReturnCase } from '../utils/inspectionCenterData';
import { InspectionAppealModal } from '../components/inspection/InspectionAppealModal';
import { LalamoveProgress } from '../components/common/LalamoveProgress';

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

  // Shipping quote states (calculated via API from Inspection Center to Buyer)
  const [finalShippingQuote, setFinalShippingQuote] = useState<ShippingQuoteResponseDto | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteRequestIdRef = React.useRef(0);

  // Return shipment states
  const confirmRequestIdRef = React.useRef<string | null>(null);
  const [returnShipment, setReturnShipment] = useState<ShipmentBackend | null>(null);
  const [showAppeal, setShowAppeal] = useState(false);
  const [createdLinkedOrderId, setCreatedLinkedOrderId] = useState<string | null>(null);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showShipmentModal, setShowShipmentModal] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');

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
        const dto = await inspectorService.getOrder(effectiveOrderId, { signal: controller.signal, isBackground });
        if (!controller.signal.aborted && dto) setInspectionDto(dto);
      } catch (err) {
        if (!controller.signal.aborted) console.warn('Failed to load inspection order details:', err);
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

  // Status & Role Resolution
  const backendStatus = String(inspectionDto?.status || order?.inspectionStatus || order?.backendStatus || order?.status || '').toUpperCase();
  const escrowStatus = String(order?.escrowStatus || '').toUpperCase();

  const purchaseDecision = getInspectionPurchaseDecision(order, inspectionDto);
  const purchaseExpired = isExpiredInspectionPurchase(inspectionDto?.status, inspectionDto?.note);
  const isPassed = purchaseDecision !== null || purchaseExpired;
  const isFailed = !isPassed && (backendStatus === 'FAILED' || (!inspectionDto && escrowStatus === 'INSPECTION_FAILED'));
  const customerStatus = getCustomerInspectionStatus(backendStatus, inspectionDto?.customerStatus,
    inspectionDto ? inspectionDto.inspectorId : order?.inspectorId);
  const isInspecting = !isPassed && (customerStatus === 'INSPECTING' || customerStatus === 'INSPECTION_IN_PROGRESS');
  const isPending = !isPassed && !isFailed && !isInspecting && backendStatus !== 'CANCELLED';
  const isShippingToCenter = !isPassed && !isFailed && !isInspecting && (
    backendStatus === 'SHIPPING_TO_CENTER' ||
    Boolean((order as any)?.shippingTrackingCode) ||
    Boolean((order as any)?.inboundTrackingCode) ||
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
  const decisionSettled = purchaseDecision === 'accepted' || purchaseDecision === 'rejected' || purchaseExpired;
  const canAppeal = Boolean(isUserSeller && inspectionDto && canAppealInspection(inspectionDto, currentUser?.id));
  const [, refreshAppealDeadline] = useState(0);

  useEffect(() => {
    if (!canAppeal || !inspectionDto?.appealDeadline) return;
    const delay = Date.parse(inspectionDto.appealDeadline) - Date.now();
    const timer = window.setTimeout(() => refreshAppealDeadline(Date.now()), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [canAppeal, inspectionDto?.appealDeadline]);

  useEffect(() => {
    if (!canDecide || !inspectionDto) return;
    let active = true;
    walletService.getMyWallet()
      .then((balance) => { if (active) setWallet(balance); })
      .catch(() => { if (active) setWallet(null); });
    return () => { active = false; };
  }, [canDecide, inspectionDto, showConfirmModal]);

  // Dynamic Center Lookup
  const [resolvedCenter, setResolvedCenter] = useState<{ name: string; address?: string; phone?: string } | null>(null);

  useEffect(() => {
    const centerId = inspectionDto?.inspectionCenterId;
    if (!centerId) return;
    inspectorService.getInspectionCenters().then((centers) => {
      const found = centers.find((c) => c.id === centerId || c.id?.toLowerCase() === centerId?.toLowerCase());
      if (found) {
        setResolvedCenter({ name: found.name, address: found.address, phone: found.phone });
      }
    }).catch(() => {});
  }, [inspectionDto?.inspectionCenterId]);

  // Merge data between backend DTO and frontend order prop
  const postTitle = inspectionDto?.postTitle || order?.listing?.title || 'Thiết bị công nghệ / gia dụng';
  const postPrice = inspectionDto?.finalItemPrice || inspectionDto?.postPrice || order?.listing?.priceVnd || order?.itemPriceVnd || 0;
  const postImage = inspectionDto?.postImageUrl || inspectionDto?.postImageUrls?.[0] || order?.listing?.photos?.front || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';
  const centerName = resolvedCenter?.name || 'Chưa có thông tin trung tâm';
  const inspectorName = inspectionDto?.inspectorName || 'Chưa có thông tin kỹ thuật viên';
  const tamperSealId = inspectionDto?.tamperSealId;
  const conditionGrade = inspectionDto?.conditionGrade || 'Chưa có đánh giá';
  const conditionScore = inspectionDto?.conditionScore;
  const isAtHome = inspectionDto?.orderType === 'AT_HOME';
  const feePayer = inspectionDto?.feePayer;
  const { base: baseInspectionFee, transport: inspectionTransportFee, reserve: returnReserveFee,
    buyerShare: buyerFeeShare, sellerShare: sellerFeeShare, total: totalInspectionFee } = getInspectionStageOne(inspectionDto);
  const resolvedBuyerAddress = useMemo(() => {
    const name = (inspectionDto?.buyerName || currentUser?.name || 'Khách Hàng').trim();
    const rawPhone = currentUser?.phone || '0912345678';
    let cleanedPhone = rawPhone.replace(/\D/g, '');
    if (!cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('84')) {
      cleanedPhone = '0' + cleanedPhone;
    }
    const phone = cleanedPhone.length >= 10 ? cleanedPhone : '0912345678';
    const address = currentUser?.address || (inspectionDto as any)?.address || (order as any)?.deliveryAddress?.address || 'TP. Hồ Chí Minh';
    const latitude = Number(currentUser?.latitude ?? (inspectionDto as any)?.buyerLatitude ?? (order as any)?.deliveryAddress?.latitude) || 10.762622;
    const longitude = Number(currentUser?.longitude ?? (inspectionDto as any)?.buyerLongitude ?? (order as any)?.deliveryAddress?.longitude) || 106.660172;
    return { name, phone, address, latitude, longitude };
  }, [inspectionDto, currentUser, order]);

  // Tự động gọi API tính cước giao hàng từ Trung tâm kiểm định đến người mua (chiều 2)
  useEffect(() => {
    if (!inspectionDto?.postId || !canDecide) return;
    const currentReq = ++quoteRequestIdRef.current;
    setIsLoadingQuote(true);
    setQuoteError(null);

    shippingService.getShippingQuote({
      postId: inspectionDto.postId,
      deliveryAddress: {
        name: resolvedBuyerAddress.name,
        phone: resolvedBuyerAddress.phone,
        latitude: resolvedBuyerAddress.latitude,
        longitude: resolvedBuyerAddress.longitude,
        address: resolvedBuyerAddress.address,
      },
    }).then((q) => {
      if (currentReq === quoteRequestIdRef.current) {
        if (q && Number.isFinite(q.shippingFee)) {
          setFinalShippingQuote(q);
        }
      }
    }).catch((err) => {
      console.warn('Lỗi gọi API tính cước Lalamove từ Hub đến người mua:', err);
      if (currentReq === quoteRequestIdRef.current) {
        setQuoteError(err?.message || 'Chưa thể tải báo giá vận chuyển tự động');
      }
    }).finally(() => {
      if (currentReq === quoteRequestIdRef.current) {
        setIsLoadingQuote(false);
      }
    });
  }, [inspectionDto?.postId, canDecide, resolvedBuyerAddress]);

  // Phí giao tận tay (chiều 2) tính từ Trung tâm kiểm định qua người mua (Ưu tiên: từ API báo giá -> từ DTO backend -> cước vận chuyển chuẩn)
  const apiDeliveryFee = finalShippingQuote?.shippingFee ?? inspectionDto?.finalShippingFee ?? (order?.shippingFeeVnd || 35000);
  const finalItemPrice = finalShippingQuote?.productPrice ?? inspectionDto?.finalItemPrice ?? postPrice;
  const finalPriceToPay = finalShippingQuote?.totalPayable ?? (finalItemPrice + apiDeliveryFee);
  const inspectionTransportLabel = isAtHome ? 'Phí di chuyển kỹ thuật viên' : 'Cước Lalamove giao Hub';

  const isWaitingSellerApproval = backendStatus === 'WAITING_SELLER_APPROVAL' || inspectionDto?.status === 'WAITING_SELLER_APPROVAL';
  const isWaitingBuyerApproval = backendStatus === 'WAITING_BUYER_APPROVAL' || inspectionDto?.status === 'WAITING_BUYER_APPROVAL';
  const isWaitingFeePayment = backendStatus === 'WAITING_FEE_PAYMENT' || inspectionDto?.status === 'WAITING_FEE_PAYMENT';

  const feesPaid = Boolean(inspectionDto?.buyerPaidAt && (sellerFeeShare === 0 || inspectionDto.sellerPaidAt));
  const feePaymentLabel = inspectionDto?.feeSettledAt ? 'ĐÃ HẠCH TOÁN PHÍ KIỂM ĐỊNH'
    : isWaitingSellerApproval || isWaitingBuyerApproval ? 'CHỜ DUYỆT'
    : feesPaid ? 'ĐÃ NỘP PHÍ'
    : isWaitingFeePayment ? 'CHỜ NỘP PHÍ' : 'CHƯA XÁC NHẬN NỘP PHÍ';

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
      } catch {} finally {
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
      } catch {}
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
      } catch {}
    }

    // Nếu chưa kiểm định thực tế thì danh sách rỗng, để giao diện hiển thị trạng thái đang chờ
    return [];
  }, [inspectionDto?.checklistResultJson]);

  // Handle Confirm Final Purchase
  const handleConfirmPurchase = async () => {
    if (!canDecide || isSubmitting || timeLeft.isExpired) return;
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
          shippingQuoteId: finalShippingQuote?.quoteId,
        }).catch(() => {
          return inspectorService.confirmPurchase(effectiveOrderId);
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
      } catch {}

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
      setShowConfirmModal(false);
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
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
      const fullReason = `${selectedRejectReason}${customRejectNote ? `: ${customRejectNote}` : ''}`;
      const rejectedOrder = effectiveOrderId ? await inspectorService.rejectPurchase(effectiveOrderId, fullReason) : null;
      if (rejectedOrder) setInspectionDto(rejectedOrder);

      // Update local storage order status
      try {
        const recentStr = localStorage.getItem('recent_placed_orders');
        if (recentStr) {
          const list: EscrowOrder[] = JSON.parse(recentStr);
          const updated = list.map(o => o.id === effectiveOrderId ? {
            ...o,
            escrowStatus: 'CANCELLED' as const,
            backendStatus: 'CANCELLED' as any,
            inspectionStatus: 'CANCELLED',
            inspectionNote: rejectedOrder?.note,
          } : o);
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch {}

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

  const currentWalletBal = wallet?.balance ?? null;
  const isWalletSufficient = currentWalletBal !== null ? currentWalletBal >= finalPriceToPay : true;
  const walletShortfall = currentWalletBal !== null && finalPriceToPay !== null
    ? Math.max(0, finalPriceToPay - currentWalletBal)
    : null;

  if (isLoading || !inspectionDto) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center text-slate-700">
        <p role="status">{isLoading ? 'Đang tải dữ liệu đơn kiểm định…' : 'Không tải được dữ liệu đơn kiểm định.'}</p>
        {!isLoading && <button type="button" onClick={onBack} className="font-bold text-blue-700">Quay lại đơn hàng</button>}
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
                {purchaseDecision && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                    {inspectionPurchaseDecisionLabel(purchaseDecision, lang)}
                  </span>
                )}
                {purchaseExpired && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                    Đã hủy do hết hạn thanh toán
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
                {isPending && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>CHƯA KIỂM ĐỊNH • CHỜ TIẾP NHẬN</span>
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

        {canAppeal && inspectionDto && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p>Hạn khiếu nại {new Date(inspectionDto.appealDeadline!).toLocaleString('vi-VN')}</p>
            <button type="button" onClick={() => setShowAppeal(true)} className="rounded-lg bg-amber-800 px-3 py-2 font-bold text-white">
              Khiếu nại kết quả kiểm định
            </button>
            <InspectionAppealModal order={inspectionDto} isOpen={showAppeal} onClose={() => setShowAppeal(false)} onSuccess={setInspectionDto} />
          </div>
        )}

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
          <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-sm ${
            alertNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
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
                  onClick={() => setShowRejectModal(true)}
                  className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/25 transition cursor-pointer flex items-center justify-center shadow-sm"
                >
                  <span>Từ Chối Mua Tiếp</span>
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-3 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm shadow-lg transition cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Xác Nhận Mua Hàng ({formatVND(finalPriceToPay)})</span>
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
                    : 'Kỹ thuật viên đã kiểm tra và ghi nhận sản phẩm không vượt qua các tiêu chí kỹ thuật quy định. Đơn hàng đã dừng lại ở bước kiểm định và thiết bị sẽ được hoàn trả cho người bán. Quỹ Escrow bảo lãnh hoàn tiền an toàn cho bạn.'}
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
        ) : decisionSettled ? null : isUserSeller ? (
          /* Banner thông báo dành riêng cho Người bán khi đơn ĐANG XỬ LÝ */
          <div className="py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900 to-[#24263e] text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                  <Store className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Kênh Người Bán • Theo Dõi Đơn Kiểm Định</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isPassed
                    ? 'Sản phẩm đã được KTV kiểm định ĐẠT CHUẨN!'
                    : isShippingToCenter
                    ? 'Thiết bị đang được vận chuyển đến Hub kiểm định'
                    : isInspecting
                    ? 'Kỹ thuật viên đang kiểm định thiết bị thực tế'
                    : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                    ? 'Đã thu đủ phí kiểm định • Vui lòng gửi máy về Hub'
                    : 'Sản phẩm đang trong tiến trình kiểm định'}
                </h2>
                <p className="text-xs text-slate-200/90 leading-relaxed max-w-3xl">
                  {isPassed
                    ? `Đang chờ người mua quyết định.${inspectionDto?.finalPaymentDeadline ? ` Hạn quyết định: ${new Date(inspectionDto.finalPaymentDeadline).toLocaleString('vi-VN')}.` : ''}`
                    : isShippingToCenter
                    ? 'Tài xế đang vận chuyển máy đến Trung tâm. KTV sẽ tiếp nhận ngay khi máy tới nơi.'
                    : isInspecting
                    ? 'Kỹ thuật viên đang kiểm tra chất lượng thực tế máy.'
                    : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                    ? 'Hai bên đã nộp đủ phí kiểm định. Vui lòng đóng gói và tạo đơn Lalamove để giao máy về Hub.'
                    : 'Kỹ thuật viên đang tiếp nhận và kiểm định máy. Vui lòng theo dõi cập nhật biên bản trên hệ thống.'}
                </p>
              </div>

              {/* Nút Tạo Vận Đơn cho Seller nếu chưa ship */}
              {isUserSeller && (feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH') && !isShippingToCenter && !isInspecting && !isPassed && !isFailed && (
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Đã Đóng Gói • Tạo Đơn Lalamove</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Banner thông báo dành cho Người mua khi CHƯA CÓ KẾT QUẢ ĐẠT */
          <div className="py-3.5 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-[#24263e] text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-1 sm:space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                {isInspecting ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-200" />
                    <span>Đang Kiểm Định Kỹ Thuật</span>
                  </>
                ) : isShippingToCenter ? (
                  <>
                    <Truck className="w-3 h-3 text-amber-200" />
                    <span>Đang Vận Chuyển Đến Hub</span>
                  </>
                ) : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH' ? (
                  <>
                    <Package className="w-3 h-3 text-amber-200" />
                    <span>Chờ Người Bán Gửi Hàng Đến Hub</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-amber-200" />
                    <span>Chờ Tiếp Nhận Thẩm Định</span>
                  </>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {isInspecting
                  ? 'Kỹ thuật viên đang kiểm định thiết bị thực tế'
                  : isShippingToCenter
                  ? 'Thiết bị đang được vận chuyển đến Trung tâm kiểm định'
                  : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                  ? 'Đang chờ Người bán đóng gói & gửi máy đến Hub'
                  : 'Đang chờ Người bán gửi máy & KTV tiếp nhận'}
              </h2>
              <p className="text-xs text-amber-50/90 leading-relaxed max-w-3xl">
                {isInspecting
                  ? 'Kỹ thuật viên đang kiểm tra chất lượng thực tế. Bạn có thể quyết định mua tiếp sau khi có biên bản đạt chuẩn.'
                  : isShippingToCenter
                  ? 'Tài xế đang giao kiện hàng đến Hub. Kỹ thuật viên sẽ tiếp nhận và tiến hành thẩm định khi nhận máy.'
                  : feesPaid || backendStatus === 'CONFIRMED_PENDING_DISPATCH'
                  ? 'Hai bên đã nộp đủ phí kiểm định. Người bán đang chuẩn bị đóng gói và lên đơn gửi máy về Hub để KTV kiểm định.'
                  : `${feesPaid ? 'Đã nộp phí kiểm định. ' : ''}Bạn có thể quyết định mua tiếp sau khi kỹ thuật viên trả biên bản đạt chuẩn.`}
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
                    <span>Giá niêm yết: <strong className="text-slate-900 font-extrabold">{formatAmount(postPrice)}</strong></span>
                    <span>•</span>
                    <span>Tình trạng: <strong className="text-emerald-700 font-bold">{conditionGrade}</strong></span>
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

                {(!isAtHome && !tamperSealId) ? null : (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block font-semibold">Tem niêm phong QR</span>
                      <span className="font-mono font-bold text-slate-900 block truncate">{tamperSealId || 'Chưa có mã tem'}</span>
                    </div>
                  </div>
                )}
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
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                    isWaitingSellerApproval
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : isWaitingBuyerApproval
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : isWaitingFeePayment
                      ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                      : isPassed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isFailed || backendStatus === 'CANCELLED'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-teal-100 text-teal-900 border-teal-300'
                  }`}
                >
                  {isWaitingSellerApproval
                    ? '⏳ Chờ Người Bán Duyệt'
                    : isWaitingBuyerApproval
                    ? '⏳ Chờ Người Mua Duyệt Lại'
                    : isWaitingFeePayment
                    ? '💳 Chờ Nạp Phí Kiểm Định'
                    : isPassed
                    ? '✅ Đã Đạt Chuẩn'
                    : isFailed
                    ? '❌ Không Đạt'
                    : feePaymentLabel}
                </span>
              </div>

              {/* Center Details */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2 text-xs">
                <div className="flex items-start gap-2.5 text-slate-800">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{centerName}</span>
                    {resolvedCenter?.address && (
                      <p className="text-[11px] text-slate-500">{resolvedCenter.address}</p>
                    )}
                    {resolvedCenter?.phone && (
                      <p className="text-[11px] text-slate-500">Hotline: {resolvedCenter.phone}</p>
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
                    {feePayer === 'BUYER_PAYS'
                      ? 'Người mua chịu 100%'
                      : feePayer === 'SELLER_PAYS'
                      ? 'Người bán chịu 100%'
                      : feePayer === 'SPLIT_50_50' ? 'Chia đôi 50% - 50%' : 'Chưa có dữ liệu'}
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

                {/* 2-stage escrow */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Giai đoạn 1 (Trả trước):</span>
                    <span className="font-bold text-slate-800">Phí kiểm định {formatAmount(buyerFeeShare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Giai đoạn 2 (Sau khi máy ĐẠT):</span>
                    <span className="font-bold text-emerald-800">
                      Tiền sản phẩm {formatAmount(finalItemPrice)} + Cước Hub giao {formatVND(apiDeliveryFee)}
                    </span>
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
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                          chk.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' :
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
              {activeReportTab === 'verdict' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                      Kết luận tổng thể của Kỹ thuật viên
                    </span>
                    <blockquote className="italic text-slate-700 text-xs sm:text-sm leading-relaxed border-l-2 border-emerald-600 pl-3">
                      {inspectorNote || 'Chưa có nhận xét kiểm định từ kỹ thuật viên.'}
                    </blockquote>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Tình trạng sau kiểm định</span>
                      <strong className="text-sm font-black text-slate-900">{conditionGrade}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Điểm đánh giá</span>
                      <strong className="text-sm font-black text-[#c34c36]">{conditionScore != null ? `${conditionScore}/100` : 'Chưa có'}</strong>
                    </div>
                  </div>
                </div>
              )}

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
                              className={`group relative block overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 transition hover:shadow-md ${
                                isMainPhoto ? 'col-span-full' : 'aspect-square'
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      feesPaid || inspectionDto.feeSettledAt ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {feePaymentLabel}
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
                    <span>Tổng phí kiểm định GĐ 1:</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Giai đoạn 2 (Tiền sản phẩm):</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    canDecide
                      ? 'bg-amber-100 text-amber-900 animate-pulse'
                      : isFailed
                      ? 'bg-rose-100 text-rose-800'
                      : isUserSeller
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {purchaseDecision
                      ? inspectionPurchaseDecisionLabel(purchaseDecision, lang)
                      : isFailed
                      ? 'KHÔNG MỞ THANH TOÁN (LỖI)'
                      : (isUserSeller ? 'CHỜ KTV KIỂM ĐỊNH' : 'CHƯA MỞ THANH TOÁN')}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 pl-5">
                  <div className="flex justify-between">
                    <span>Tiền sản phẩm:</span>
                    <span className="font-bold text-slate-900">{formatVND(finalItemPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Phí giao tận tay (chiều 2):</span>
                    {isLoadingQuote ? (
                      <span className="flex items-center gap-1.5 text-xs text-[#c34c36] font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang tính cước qua API...
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className="font-bold text-slate-900">{formatVND(apiDeliveryFee)}</span>
                        <span className="ml-1 text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Hub ➔ Người mua
                        </span>
                      </div>
                    )}
                  </div>
                  {quoteError && !isLoadingQuote && (
                    <p className="text-[10px] text-amber-600 italic">
                      ℹ️ Cước tạm tính dựa trên địa chỉ giao hàng của bạn
                    </p>
                  )}
                  <div className="flex justify-between pt-2 border-t border-amber-200/80 font-black text-sm text-[#24263e]">
                    <span>Tổng tiền thanh toán giai đoạn 2:</span>
                    <span className="text-base font-black text-[#c34c36]">{formatVND(finalPriceToPay)}</span>
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
                {decisionSettled ? null : isUserSeller ? (
                  isWaitingSellerApproval ? (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                        <Store className="w-4 h-4 text-indigo-600" />
                        <span>Đề Xuất Kiểm Định Từ Người Mua</span>
                      </div>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        Người mua đã đề xuất kiểm định sản phẩm này tại trung tâm trước khi nhận hàng. Bạn có đồng ý với phương án kiểm định và phân chia phí này không?
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
                          ? 'Sản phẩm đã đạt kiểm định và đang chờ quyết định mua.'
                          : isFailed
                          ? 'Sản phẩm kiểm định không đạt tiêu chuẩn kỹ thuật. Bạn có thể xem kết quả trong biên bản.'
                          : isWaitingFeePayment
                          ? 'Đã thống nhất phương án chia phí kiểm định. Đang chờ người mua nộp phí kiểm định vào quỹ bảo lãnh Escrow.'
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
                      <span>Đang Chờ Người Bán Phản Hồi</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Yêu cầu kiểm định của bạn đã được gửi tới người bán. Bạn có thể thương lượng thêm trong phòng chat hoặc chờ người bán phản hồi đồng ý.
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer text-center"
                    >
                      Đến Phòng Chat Thương Lượng
                    </button>
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
                        <span className="font-black text-sm">XÁC NHẬN MUA TIẾP & TRẢ TIỀN SẢN PHẨM</span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-100">
                        {isLoadingQuote
                          ? 'Đang tính cước giao qua API...'
                          : `Trừ ${formatVND(finalPriceToPay)} từ ví Escrow (gồm ${formatVND(apiDeliveryFee)} cước giao Hub)`}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-red-600 hover:border-red-300 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center text-center"
                    >
                      <span>Từ Chối Mua Tiếp / Hủy Đơn (Báo Cho Người Bán)</span>
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
              <div className="flex justify-between text-slate-600">
                <span>Cước giao Hub ➔ Bạn:</span>
                <span className="font-bold text-slate-900">{formatVND(apiDeliveryFee)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Địa chỉ nhận hàng:</span>
                <span className="font-medium text-slate-700 truncate max-w-[200px]" title={resolvedBuyerAddress.address}>
                  {resolvedBuyerAddress.address}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-600">
                <span className="font-bold">Tổng thanh toán GĐ 2:</span>
                <span className="font-extrabold text-[#c34c36] text-sm">{formatVND(finalPriceToPay)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phương thức:</span>
                <span className="font-semibold text-slate-800">Ví SecondLife Escrow</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bằng việc bấm xác nhận, số tiền <strong>{formatVND(finalPriceToPay)}</strong> (gồm {formatVND(finalItemPrice)} tiền sản phẩm và {formatVND(apiDeliveryFee)} cước giao tận tay từ Hub) sẽ được chuyển vào quỹ Escrow bảo lãnh. Trạm kiểm định sẽ đóng gói với tem niêm phong QR và bàn giao bưu tá Lalamove để giao tới địa chỉ của bạn.
            </p>

            {!isWalletSufficient && (
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
                disabled={isSubmitting || !isWalletSufficient || timeLeft.isExpired}
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
                  'Thay đổi nhu cầu sử dụng / Lý do cá nhân'
                ].map((reason) => (
                  <label
                    key={reason}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                      selectedRejectReason === reason
                        ? 'bg-red-50 border-red-300 text-red-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectReason"
                      value={reason}
                      checked={selectedRejectReason === reason}
                      onChange={(e) => setSelectedRejectReason(e.target.value)}
                      className="accent-red-600"
                    />
                    <span>{reason}</span>
                  </label>
                ))}

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Ghi chú chi tiết thêm cho Người bán (tùy chọn):
                  </label>
                  <textarea
                    value={customRejectNote}
                    onChange={(e) => setCustomRejectNote(e.target.value)}
                    placeholder="Nhập thêm lý do hoặc lời nhắn cho người bán..."
                    rows={2}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-red-400 bg-slate-50/50"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Hệ thống sẽ gửi thông báo ngay cho Người bán:</strong> Sản phẩm sẽ được Trung tâm đóng gói niêm phong tem hoàn trả và bưu tá sẽ mang hàng hoàn về địa chỉ người bán theo quy chế sàn.
                  </p>
                </div>
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
                disabled={isSubmitting || (isUserSeller && isWaitingSellerApproval && !customRejectNote.trim())}
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
              }).catch(() => {});
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

    </div>
  );
};

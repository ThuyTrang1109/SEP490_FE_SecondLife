import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Coins,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  Check,
  X,
  RotateCcw,
  Wallet,
  ExternalLink,
  Truck,
  Calendar
} from 'lucide-react';
import {
  inspectorService,
  InspectionOrderDto
} from '../../services/inspectorService';
import { walletService, notifyWalletBalanceUpdated } from '../../services/walletService';
import { shippingService } from '../../services/shippingService';
import { Listing, Language, UserRole, EscrowOrder, ShipmentBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import { InspectionFeePercentSelect } from '../orders/InspectionFeePercentSelect';
import { buyerFeePercentFor, feePercentLabel, feePercentOptions } from '../../utils/inspectionFeePercent';
import { getCashInspectionFeeShares } from '../../utils/inspectionCashShipping';
import { getChatInspectionFees } from '../../utils/chatInspection';
import { CHAT_PRODUCT_PLACEHOLDER } from '../../utils/chatProduct';
import {
  getCustomerInspectionStatus,
  extractInspectionRejectionDetails,
  getInspectionPurchaseDecision,
  formatOrderCancellationReason,
  isExpiredInspectionPurchase
} from '../../utils/inspectionPurchase';
import { getInboundShipmentProgress, getLatestInboundShipment } from '../../utils/inspectionCenterData';
import { getOrderAllShipments } from '../../utils/orders/shipmentCache';
import { isOrderReceivedAtHub } from '../../pages/ProductInspectionStationView';
import { CreateShipmentModal } from '../modals/CreateShipmentModal';
import { ScheduleAppointmentModal } from '../modals/ScheduleAppointmentModal';
import { readOrderAppointment } from '../../utils/orders/orderAppointments';
import { getAtHomeDeliveryStage } from '../../utils/orders/orderReceipt';
import {
  formatInspectionDeadline,
  isInspectionPaymentExpired,
  calculateDeadlineTimeLeft
} from '../../utils/inspectionPaymentDeadline';
import { paths } from '../../app/router/paths';
import { navigatePath } from '../../app/router/browser';

interface InspectionProposalCardProps {
  order: InspectionOrderDto;
  listing: Listing;
  isSeller: boolean;
  isBuyer: boolean;
  currentRole: UserRole;
  lang: Language;
  onOrderUpdated: (updatedOrder: InspectionOrderDto) => void;
  onRefreshOrder: (orderId: string) => Promise<void>;
  onViewDetails?: (orderId: string) => void;
}

const formatFee = (value?: number | null) => value == null ? '—' : formatVND(value);

export const InspectionProposalCard: React.FC<InspectionProposalCardProps> = ({
  order,
  listing,
  isSeller,
  isBuyer,
  currentRole,
  lang,
  onOrderUpdated,
  onRefreshOrder,
  onViewDetails,
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Seller Counter Drawer State
  const [showCounterDrawer, setShowCounterDrawer] = useState(false);
  const [counterBuyerFeePercent, setCounterBuyerFeePercent] = useState(50);

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel Proposal Modal State (for Buyer cancelling request)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Payment Confirmation State
  const [showPayConfirmModal, setShowPayConfirmModal] = useState(false);

  // Schedule Appointment Modal State (for On-Site Inspection)
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const status = (order.status || '').toUpperCase();
  const isWaitingSellerApproval = status === 'WAITING_SELLER_APPROVAL';
  const isWaitingBuyerApproval = status === 'WAITING_BUYER_APPROVAL';
  const isWaitingFeePayment = status === 'WAITING_FEE_PAYMENT';
  const purchaseDecision = getInspectionPurchaseDecision(order);
  const isPurchaseAccepted = Boolean(
    purchaseDecision === 'accepted' ||
    status === 'DELIVERING_TO_BUYER' ||
    (order as any).status === 'DELIVERING_TO_BUYER' ||
    order.finalPaymentPaidAt ||
    order.linkedOrderId ||
    (order as any).buyerDecision === 'accepted' ||
    (order as any).inspectionDecision === 'accepted'
  );

  const isReceiptConfirmed = Boolean(
    (order as any).receiptConfirmedAt ||
    (typeof window !== 'undefined' && order.id && (
      localStorage.getItem(`order_receipt_confirmed_${order.id}`) === 'true' ||
      ((order as any).linkedOrderId && localStorage.getItem(`order_receipt_confirmed_${(order as any).linkedOrderId}`) === 'true')
    ))
  );

  const isCompleted = Boolean(
    isReceiptConfirmed ||
    status === 'COMPLETED' ||
    status === 'RELEASED' ||
    status === 'COMPLETED_RELEASED' ||
    (order as any).status === 'COMPLETED' ||
    (order as any).escrowStatus === 'COMPLETED_RELEASED' ||
    (order as any).escrowStatus === 'RELEASED' ||
    (order as any).backendStatus === 'COMPLETED' ||
    (() => {
      if (typeof window === 'undefined' || !order.id) return false;
      const targetIds = [order.id, (order as any).linkedOrderId].filter(Boolean);
      for (const storageKey of ['recent_placed_orders', 'center_inspection_orders', 'my_seller_inspection_orders']) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const found = list.find((o: any) => targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId) || targetIds.includes(o.inspectionOrderId));
              if (found && (
                found.escrowStatus === 'COMPLETED_RELEASED' ||
                found.escrowStatus === 'RELEASED' ||
                found.status === 'COMPLETED' ||
                found.backendStatus === 'COMPLETED' ||
                found.receiptConfirmedAt ||
                localStorage.getItem(`order_receipt_confirmed_${found.id}`) === 'true'
              )) {
                return true;
              }
            }
          }
        } catch { }
      }
      return false;
    })()
  );

  const isPassed = status === 'PASSED' || isPurchaseAccepted || isCompleted;
  const isFailed = status === 'FAILED';
  const isLocalCancelled = typeof window !== 'undefined' && localStorage.getItem(`order_cancelled_${order.id}`) === 'true';
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED' || isLocalCancelled;
  const rawOrderReason = order.note || (order as any).rejectionReason || (order as any).rejectReason;
  const rejectionDetails = extractInspectionRejectionDetails(rawOrderReason);
  const isBuyerPurchaseRejected = isCancelled && rejectionDetails.isBuyerPurchaseRejected;
  const isBuyerPurchaseExpired = isCancelled && (
    Boolean(rejectionDetails.isBuyerPurchaseExpired) ||
    isExpiredInspectionPurchase(status, rawOrderReason)
  );
  const displayCancellationReason = formatOrderCancellationReason(rawOrderReason, lang) || (
    isBuyerPurchaseExpired
      ? (lang === 'vi' ? 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.' : 'Buyer defaulted on payment within 6 hours after inspection passed.')
      : (isBuyerPurchaseRejected
        ? (rejectionDetails.buyerRejectReason || (lang === 'vi' ? 'Người mua từ chối mua tiếp sau kiểm định' : 'Buyer declined purchase after inspection'))
        : rawOrderReason)
  );
  const isAtHome = Boolean(
    String(order.orderType || '').toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionMethod || '').toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionScope || '').toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionOrder?.orderType || '').toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionOrder?.inspectionMethod || '').toUpperCase() === 'AT_HOME' ||
    (order as any).isAtHome ||
    Boolean(
      typeof window !== 'undefined' && order.id && (
        localStorage.getItem(`inspection_type_${order.id}`) === 'AT_HOME' ||
        localStorage.getItem(`order_type_${order.id}`) === 'AT_HOME'
      )
    )
  );
  const isAtCenter = !isAtHome;

  const [allShipments, setAllShipments] = useState<ShipmentBackend[]>(() => {
    if (typeof window === 'undefined' || !order.id) return [];
    const targetIds = [...new Set([order.id, (order as any).linkedOrderId, (order as any).inspectionOrderId])].filter(Boolean);
    return targetIds.flatMap((id) => getOrderAllShipments(id));
  });
  const buyerShipment = allShipments.find((s) => (s.leg === 'SELLER_TO_BUYER' || s.leg === 'CENTER_TO_BUYER' || s.leg === 'DELIVERY') && s.status !== 'CANCELLED')
    || allShipments.find((s) => s.leg === 'SELLER_TO_BUYER' || s.leg === 'CENTER_TO_BUYER' || s.leg === 'DELIVERY');

  const atHomeDeliveryStage = isAtHome ? getAtHomeDeliveryStage(order as any, allShipments) : null;

  const isDelivered = Boolean(
    !isCompleted && (
      (order as any).shippingDeliveredAt ||
      (order as any).escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
      (order as any).backendStatus === 'DELIVERED' ||
      (isAtHome && atHomeDeliveryStage === 'delivered') ||
      (buyerShipment && (
        buyerShipment.status === 'DELIVERED' ||
        buyerShipment.status === 'COMPLETED' ||
        buyerShipment.providerStatus === 'COMPLETED'
      )) ||
      (() => {
        if (typeof window === 'undefined' || !order.id) return false;
        const targetIds = [order.id, (order as any).linkedOrderId, (order as any).inspectionOrderId].filter(Boolean);
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

  const isAwaitingPickup = Boolean(
    !isCompleted && !isDelivered && isPurchaseAccepted && (
      (isAtHome && atHomeDeliveryStage === 'awaiting_pickup') ||
      (!isAtHome && buyerShipment && Boolean(buyerShipment.orderCode) &&
        !['DELIVERING', 'SHIPPED', 'PICKED_UP', 'IN_TRANSIT', 'ON_GOING'].includes(buyerShipment.status?.toUpperCase() || '') &&
        !['DELIVERING', 'PICKED_UP', 'ON_GOING'].includes(buyerShipment.providerStatus?.toUpperCase() || ''))
    )
  );

  const isDelivering = Boolean(
    !isCompleted && !isDelivered && !isAwaitingPickup && isPurchaseAccepted && (
      (isAtHome && atHomeDeliveryStage === 'in_transit') ||
      (!isAtHome && (
        Boolean((order as any).carrierPickedUpAt) ||
        (buyerShipment && (
          ['DELIVERING', 'SHIPPED', 'ON_GOING', 'IN_TRANSIT', 'PICKED_UP'].includes(buyerShipment.status?.toUpperCase() || '') ||
          ['DELIVERING', 'PICKED_UP', 'ON_GOING'].includes(buyerShipment.providerStatus?.toUpperCase() || '')
        ))
      ))
    )
  );

  const [inboundShipment, setInboundShipment] = useState<ShipmentBackend | null>(() => {
    if (typeof window === 'undefined' || !order.id) return null;
    const all = getOrderAllShipments(order.id, (order as any).linkedOrderId);
    return getLatestInboundShipment(all);
  });

  const isInboundDelivered = Boolean(
    isAtCenter && !isPassed && !isFailed && !isCancelled && !isPurchaseAccepted && !isCompleted && !isDelivered && (
      isOrderReceivedAtHub(order) ||
      (typeof window !== 'undefined' && localStorage.getItem(`hub_package_received_${order.id}`) === 'true') ||
      (inboundShipment && (
        inboundShipment.status === 'DELIVERED' ||
        inboundShipment.status === 'COMPLETED' ||
        inboundShipment.providerStatus === 'COMPLETED' ||
        getInboundShipmentProgress(inboundShipment).step === 3
      ))
    )
  );

  const inStatus = String(inboundShipment?.status || '').toUpperCase();
  const inProvStatus = String(inboundShipment?.providerStatus || '').toUpperCase();
  const inProgress = inboundShipment ? getInboundShipmentProgress(inboundShipment, lang) : null;

  const isInboundCancelled = Boolean(
    isAtCenter && inboundShipment && !isPassed && !isFailed && !isCancelled && !isPurchaseAccepted && !isCompleted && !isDelivered && (
      inStatus === 'CANCELLED' ||
      inStatus === 'CANCELED' ||
      inProvStatus === 'CANCELLED' ||
      inProvStatus === 'CANCELED' ||
      inProgress?.label === (lang === 'vi' ? 'Vận đơn đã hủy' : 'Shipment cancelled')
    )
  );

  const isInboundFailed = Boolean(
    isAtCenter && inboundShipment && !isInboundCancelled && !isPassed && !isFailed && !isCancelled && !isPurchaseAccepted && !isCompleted && !isDelivered && (
      inStatus === 'FAILED' ||
      inProvStatus === 'FAILED' ||
      inProvStatus === 'REJECTED' ||
      inProvStatus === 'EXPIRED' ||
      inProgress?.label === (lang === 'vi' ? 'Vận đơn thất bại' : 'Shipment failed')
    )
  );

  const isInboundShipping = Boolean(
    isAtCenter && !isInboundDelivered && !isInboundCancelled && !isInboundFailed && !isPassed && !isFailed && !isCancelled && !isPurchaseAccepted && !isCompleted && !isDelivered && (
      status === 'SHIPPING_TO_CENTER' ||
      (inboundShipment && getInboundShipmentProgress(inboundShipment).step !== null) ||
      (typeof window !== 'undefined' && (
        localStorage.getItem(`order_shipment_created_${order.id}`) === 'true' ||
        localStorage.getItem(`seller_shipped_to_hub_${order.id}`) === 'true'
      ))
    )
  );

  const customerStatus = getCustomerInspectionStatus(status, order.customerStatus, order.inspectorId);
  const badgeStatus = isCompleted
    ? 'COMPLETED'
    : isBuyerPurchaseRejected
      ? 'BUYER_REJECTED_PURCHASE'
      : isCancelled
        ? 'CANCELLED'
        : isPurchaseAccepted
          ? 'DELIVERING_TO_BUYER'
          : isPassed
            ? 'PASSED'
            : isFailed
              ? 'FAILED'
              : customerStatus === 'INSPECTION_IN_PROGRESS' || customerStatus === 'INSPECTING'
                ? 'INSPECTING'
                : isInboundDelivered
                  ? 'RECEIVED_AT_CENTER'
                  : isInboundCancelled
                    ? 'INBOUND_CANCELLED'
                    : isInboundFailed
                      ? 'INBOUND_FAILED'
                      : isInboundShipping
                        ? 'SHIPPING_TO_CENTER'
                        : customerStatus;
  const isConfirmedPendingDispatch = (status === 'CONFIRMED_PENDING_DISPATCH' || status === 'DISPATCHED' || status === 'SCHEDULED' || status === 'ASSIGNED') && (
    badgeStatus === 'CONFIRMED_PENDING_DISPATCH' ||
    badgeStatus === 'DISPATCHED' ||
    badgeStatus === 'SCHEDULED' ||
    badgeStatus === 'ASSIGNED' ||
    badgeStatus === 'SHIPPING_TO_CENTER' ||
    badgeStatus === 'DISPATCHED_TO_CENTER' ||
    badgeStatus === 'RECEIVED_AT_CENTER' ||
    badgeStatus === 'WAITING_INSPECTION' ||
    badgeStatus === 'INBOUND_CANCELLED' ||
    badgeStatus === 'INBOUND_FAILED'
  );
  const isInspecting = badgeStatus === 'INSPECTING' || customerStatus === 'INSPECTING' || customerStatus === 'INSPECTION_IN_PROGRESS';

  // Kiểm tra xem đây có phải là lần gửi đề xuất ĐẦU TIÊN của người mua hay không.
  // Từ lần thương lượng thứ 2 (đối phương hoặc chính mình đã gửi đề xuất lại) thì không cho hủy.
  const isCounterProposal = Boolean(
    order.note?.toLowerCase().includes('đề xuất lại') ||
    order.note?.toLowerCase().includes('counter') ||
    order.note?.toLowerCase().includes('thương lượng')
  );
  const isInitialProposal = isWaitingSellerApproval && !isSeller && !isCounterProposal;

  useEffect(() => {
    setShowCounterDrawer(false);
    setActionError(null);
  }, [order.status, order.feePayer]);

  const centerId = order.inspectionCenterId;
  const [centerResult, setCenterResult] = useState<{ id: string; name?: string } | null>(null);
  const centerName = order.inspectionCenterName || (centerResult?.id === centerId ? centerResult?.name : undefined);
  useEffect(() => {
    if (!centerId || order.inspectionCenterName) return;
    let active = true;
    void inspectorService.getAvailableCenters().then((centers) => {
      if (active) setCenterResult({ id: centerId, name: centers.find((center) => center.id === centerId)?.name });
    });
    return () => { active = false; };
  }, [centerId, order.inspectionCenterName]);

  // Chuyển sang mô hình cước vận chuyển tập trung qua Sàn (100% Cashless / Không tiền mặt)
  const cashShipping = false;
  const { inspection: baseInspectionFee, travel: travelFeeRoundTrip, shipping: shippingFeeToHub,
    reserve: returnReserveFee, total: totalFee } = getChatInspectionFees(order);
  const buyerFeeShare = order.buyerFeeShare;
  const sellerFeeShare = order.sellerFeeShare;
  const buyerCommitmentDeposit = order.buyerCommitmentDeposit ?? 0;
  const buyerAmount = buyerFeeShare == null ? undefined : buyerFeeShare + buyerCommitmentDeposit;
  const itemPrice = order.finalItemPrice ?? order.postPrice;
  const buyerFeePercent = order.buyerFeePercent ?? buyerFeePercentFor(order.feePayer);
  const feePayerLabel = buyerFeePercent == null ? null : feePercentLabel(buyerFeePercent, lang);
  const counterOptions = feePercentOptions(buyerFeePercent, order.previousBuyerFeePercent);
  const canCounter = counterOptions.length > 0;
  const toggleCounterDrawer = () => {
    if (!canCounter) return;
    const nextOpen = !showCounterDrawer;
    setShowCounterDrawer(nextOpen);
    if (nextOpen) setCounterBuyerFeePercent(counterOptions[0]);
    setShowRejectModal(false);
    setActionError(null);
  };

  const myFeeToPay = isSeller ? sellerFeeShare : buyerAmount;
  const otherFeeToPay = isSeller ? buyerAmount : sellerFeeShare;
  const canPay = myFeeToPay != null && myFeeToPay > 0;
  const isMyPaymentDone = canPay && Boolean(isSeller ? order.sellerPaidAt : order.buyerPaidAt);
  const isOtherPartyPaid = otherFeeToPay === 0 || Boolean(isSeller ? order.buyerPaidAt : order.sellerPaidAt);

  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shipmentState, setShipmentState] = useState<'checking' | 'created' | 'none' | 'unavailable'>(() => {
    if (typeof window !== 'undefined' && order.id) {
      const all = getOrderAllShipments(order.id);
      const latest = getLatestInboundShipment(all);
      if (latest && latest.status !== 'CANCELLED') return 'created';
      if (localStorage.getItem(`order_shipment_created_${order.id}`) === 'true') return 'created';
    }
    return 'checking';
  });
  const [shipmentRetry, setShipmentRetry] = useState(0);

  useEffect(() => {
    if (!order.id || isFailed || isCancelled) return;
    if (!isAtCenter && !isPurchaseAccepted) return;
    let active = true;
    setShipmentState((prev) => (prev === 'created' ? 'created' : 'checking'));
    void shippingService.getInspectionShipments(order.id, { isBackground: true }).then((shipments) => {
      if (!active) return;
      setAllShipments(shipments);
      const latest = getLatestInboundShipment(shipments);
      if (latest) {
        setInboundShipment(latest);
        if (latest.status === 'DELIVERED' || latest.status === 'COMPLETED' || latest.providerStatus === 'COMPLETED' || getInboundShipmentProgress(latest).step === 3) {
          try {
            localStorage.setItem(`hub_package_received_${order.id}`, 'true');
          } catch { }
        }
      }
      setShipmentState(shipments.some((shipment) => shipment.leg === 'SELLER_TO_CENTER' && shipment.status !== 'CANCELLED') ? 'created' : 'none');
      try {
        localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(shipments));
        localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(shipments));
      } catch { }
    }).catch(() => {
      if (active) setShipmentState((prev) => (prev === 'created' ? 'created' : 'unavailable'));
    });

    if (isAtHome && isPurchaseAccepted) {
      const purchaseId = (order as any).linkedOrderId || order.id;
      void shippingService.getOrderShipments(purchaseId, { isBackground: true }).then((shipments) => {
        if (!active || !shipments?.length) return;
        setAllShipments((prev) => {
          const ids = new Set(prev.map((s) => s.shipmentId || s.orderCode));
          const additions = shipments.filter((s) => !ids.has(s.shipmentId || s.orderCode));
          return [...prev, ...additions];
        });
      }).catch(() => { });
    }

    const targetOrderId = (order as any).linkedOrderId;
    if (targetOrderId && targetOrderId !== order.id) {
      void shippingService.getInspectionShipments(targetOrderId, { isBackground: true }).then((shipments) => {
        if (!active || !shipments.length) return;
        setAllShipments((prev) => {
          const ids = new Set(prev.map((s) => s.shipmentId || s.orderCode));
          const additions = shipments.filter((s) => !ids.has(s.shipmentId || s.orderCode));
          return [...prev, ...additions];
        });
      }).catch(() => { });
    }

    return () => { active = false; };
  }, [order.id, (order as any).updatedAt, (order as any).linkedOrderId, isAtCenter, isPurchaseAccepted, isFailed, isCancelled, shipmentRetry]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('sl_order_shipments_') || e.key.startsWith('order_shipments_'))) {
        const targetIds = [...new Set([order.id, (order as any).linkedOrderId, (order as any).inspectionOrderId])].filter(Boolean);
        if (targetIds.some((id) => e.key === `sl_order_shipments_${id}` || e.key === `order_shipments_${id}`)) {
          setAllShipments(targetIds.flatMap((id) => getOrderAllShipments(id)));
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [order.id, (order as any).linkedOrderId, (order as any).inspectionOrderId]);

  const escrowOrderForShipment = useMemo<EscrowOrder>(() => {
    return {
      id: order.id,
      orderType: (order.orderType as any) || (isAtHome ? 'AT_HOME' : 'AT_CENTER'),
      inspectionMethod: (order.orderType as any) || (isAtHome ? 'AT_HOME' : 'AT_CENTER'),
      hasInspectionService: true,
      inspectionFeeVnd: totalFee ?? 0,
      inspectionCenterId: order.inspectionCenterId || (order as any).centerId,
      inspectionCenterName: centerName,
      listing: listing as any,
      sellerId: order.sellerId || (listing as any)?.seller?.id || (listing as any)?.sellerId,
      sellerName: order.sellerName || (listing as any)?.seller?.name || 'Người bán',
      sellerPhone: (order as any).sellerPhone,
      buyerId: order.buyerId,
      buyerName: order.buyerName || 'Người mua',
      buyerPhone: (order as any).buyerPhone,
      totalAmount: (itemPrice ?? 0) + (totalFee ?? 0),
      itemTitle: order.postTitle || listing?.title || 'Sản phẩm',
      status: (order.status as any) || 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: (order.status as any) || 'CONFIRMED_PENDING_DISPATCH',
      escrowStatus: 'CONFIRMED_PENDING_DISPATCH',
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
    } as unknown as EscrowOrder;
  }, [order, listing, isAtHome, totalFee, itemPrice, centerName]);

  const currentAppt = useMemo(() => {
    return readOrderAppointment(escrowOrderForShipment, order);
  }, [escrowOrderForShipment, order]);

  const hasValidApptDate = Boolean(
    (currentAppt?.scheduledAt && currentAppt.scheduledAt !== 'null' && currentAppt.scheduledAt !== 'undefined' && !isNaN(new Date(currentAppt.scheduledAt).getTime())) ||
    (order.appointmentScheduledAt && (order.appointmentScheduledAt as any) !== 'null' && (order.appointmentScheduledAt as any) !== 'undefined' && !isNaN(new Date(order.appointmentScheduledAt).getTime()))
  );

  const isApptCountered = Boolean(
    (currentAppt?.status === 'COUNTERED_BY_CENTER' && Boolean(currentAppt?.counterScheduledAt)) ||
    Boolean(currentAppt?.counterScheduledAt) ||
    Boolean((order as any).counterScheduledAt) ||
    (order as any).appointmentStatus === 'COUNTERED_BY_CENTER'
  );
  let hasInsp = Boolean(order.inspectorId || (order as any).inspectorName);
  if (!hasInsp && order.id && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`order_assigned_inspector_${order.id}`);
      if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
    } catch { }
  }

  const hasApptConfirmed = Boolean(
    !isApptCountered &&
    hasValidApptDate && (
      currentAppt?.status === 'CONFIRMED' ||
      (order as any).appointmentStatus === 'CONFIRMED' ||
      hasInsp
    )
  );

  const isApptPendingApproval = Boolean(
    !isApptCountered &&
    !hasApptConfirmed &&
    hasValidApptDate && (
      currentAppt?.status === 'PENDING_CENTER_CONFIRMATION' ||
      currentAppt?.status === 'PENDING_CONFIRMATION' ||
      (order as any).appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
    )
  );
  const hasNoAppt = isAtHome && !isApptCountered && !hasValidApptDate;

  // Dynamic countdown timer based on paymentDeadline
  const [timeLeft, setTimeLeft] = useState(() => calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang));
  const hasRefreshedAfterExpireRef = React.useRef(false);

  useEffect(() => {
    setTimeLeft(calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang));
    hasRefreshedAfterExpireRef.current = false;
  }, [order.paymentDeadline, lang]);

  useEffect(() => {
    if (!order.paymentDeadline || !isWaitingFeePayment) return;

    const tick = () => {
      const remaining = calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang);
      setTimeLeft(remaining);
      if (remaining.isExpired && !hasRefreshedAfterExpireRef.current) {
        hasRefreshedAfterExpireRef.current = true;
        // Tải lại trạng thái đơn từ BE khi tới hạn
        void onRefreshOrder(order.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.paymentDeadline, order.id, isWaitingFeePayment, lang, onRefreshOrder]);

  const isPaymentDeadlinePassed = timeLeft.isExpired || isInspectionPaymentExpired(order.paymentDeadline);

  // Navigate to decision / order detail
  const handleOpenDetail = () => {
    if (onViewDetails) {
      onViewDetails(order.id);
    } else {
      navigatePath(paths.decision(currentRole, order.id));
    }
  };

  // 1. Seller Accept
  const handleSellerAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.respondRequest(order.id, {
        action: 'ACCEPT',
        sellerConsentZin: true,
      });
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to accept inspection proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể chấp nhận đề xuất.' : 'Failed to accept proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Seller Counter
  const handleSellerCounter = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.respondRequest(order.id, {
        action: 'COUNTER',
        counterBuyerFeePercent,
      });
      setShowCounterDrawer(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to counter inspection proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể gửi đề xuất lại.' : 'Failed to send counter proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Seller or Buyer Reject
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setActionError(lang === 'vi' ? 'Vui lòng nhập lý do từ chối.' : 'Please enter rejection reason.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      let res: InspectionOrderDto;
      if (isSeller) {
        res = await inspectorService.respondRequest(order.id, {
          action: 'REJECT',
          rejectionReason: rejectReason.trim(),
        });
      } else {
        res = await inspectorService.buyerRespondRequest(order.id, {
          action: 'REJECT',
          note: rejectReason.trim(),
        });
      }
      if (!res?.note && rejectReason.trim()) {
        res = {
          ...res,
          note: isSeller ? `Người bán từ chối: ${rejectReason.trim()}` : `Người mua từ chối đề xuất: ${rejectReason.trim()}`,
        };
      }
      setShowRejectModal(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to reject proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể từ chối đề xuất.' : 'Failed to reject proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 3.5 Buyer Cancel Inspection Request / Proposal
  const handleConfirmCancelProposal = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const reasonText = cancelReason.trim() || (lang === 'vi' ? 'Người mua chủ động hủy yêu cầu kiểm định' : 'Buyer cancelled inspection proposal');
      let res: InspectionOrderDto;
      try {
        res = await inspectorService.buyerRespondRequest(order.id, {
          action: 'REJECT',
          note: reasonText,
        });
      } catch (err: any) {
        console.warn('Backend buyerRespondRequest issue (falling back to local update):', err);
        res = {
          ...order,
          status: 'CANCELLED',
          note: reasonText,
        };
      }

      const updatedRes: InspectionOrderDto = {
        ...res,
        status: 'CANCELLED',
        note: `Người mua từ chối đề xuất: ${reasonText}`,
      };

      try {
        localStorage.setItem(`order_cancelled_${order.id}`, 'true');
        localStorage.setItem(`order_cancellation_info_${order.id}`, JSON.stringify({
          reasonCode: 'BUYER_REQUESTED',
          reason: reasonText,
        }));
        window.dispatchEvent(new CustomEvent('secondlife_order_cancelled', { detail: { orderId: order.id } }));
        window.dispatchEvent(new CustomEvent('secondlife_inspection_updated', { detail: { orderId: order.id } }));
      } catch { }

      setShowCancelModal(false);
      onOrderUpdated(updatedRes);
    } catch (err: any) {
      console.warn('Failed to cancel inspection request:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể hủy đề xuất.' : 'Failed to cancel request.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Buyer Accept Counter
  const handleBuyerAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.buyerRespondRequest(order.id, {
        action: 'ACCEPT',
        buyerConsentZin: true,
      });
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to accept counter proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể chấp thuận đề xuất.' : 'Failed to accept proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 4.5 Buyer Counter
  const handleBuyerCounter = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.buyerRespondRequest(order.id, {
        action: 'COUNTER',
        counterBuyerFeePercent,
      });
      setShowCounterDrawer(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to counter inspection proposal as buyer:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể gửi đề xuất lại.' : 'Failed to send counter proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Pay Fee via Wallet
  const handlePayFee = async () => {
    if (!isWaitingFeePayment || !canPay || isMyPaymentDone) return;
    if (isPaymentDeadlinePassed) {
      setActionError(
        lang === 'vi'
          ? `Đã hết hạn đóng phí kiểm định (${formatInspectionDeadline(order.paymentDeadline, lang)}). Đơn hàng không thể thanh toán tiếp.`
          : `Inspection fee payment deadline has expired (${formatInspectionDeadline(order.paymentDeadline, lang)}).`
      );
      setShowPayConfirmModal(false);
      void onRefreshOrder(order.id);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const fresh = await inspectorService.payInspectionFee(order.id);
      setShowPayConfirmModal(false);
      onOrderUpdated(fresh);

      // Cập nhật giảm ngay số dư ví trên Header để thấy hiệu ứng realtime lập tức
      if (typeof myFeeToPay === 'number' && myFeeToPay > 0) {
        notifyWalletBalanceUpdated(undefined, myFeeToPay);
      }
      try {
        await walletService.getMyWallet();
      } catch { }
    } catch (err: any) {
      console.warn('Failed to pay inspection fee:', err);
      const msg =
        err?.message ||
        (lang === 'vi' ? 'Không thể thanh toán phí kiểm định từ ví. Vui lòng kiểm tra số dư ví.' : 'Failed to pay fee from wallet.');
      setActionError(msg);
      // Nếu API thanh toán báo quá hạn, dùng thông báo BE và cập nhật đơn
      void onRefreshOrder(order.id);
    } finally {
      setActionLoading(false);
    }
  };

  const vi = lang === 'vi';
  const badgeLabels: Record<string, string> = {
    WAITING_SELLER_APPROVAL: isSeller
      ? (vi ? 'Chờ bạn duyệt đề xuất' : 'Awaiting your approval')
      : (vi ? 'Chờ người bán duyệt' : 'Waiting for seller approval'),
    WAITING_BUYER_APPROVAL: isBuyer
      ? (vi ? 'Chờ bạn phản hồi đề xuất' : 'Awaiting your response')
      : (vi ? 'Chờ người mua duyệt lại' : 'Waiting for buyer approval'),
    WAITING_FEE_PAYMENT: vi ? 'Chờ nộp phí kiểm định' : 'Waiting for payment',
    CONFIRMED_PENDING_DISPATCH: isAtHome
      ? (isApptCountered
        ? (isSeller ? (vi ? 'Hub đề xuất lịch mới' : 'Hub proposed reschedule') : (vi ? 'Chờ hẹn lại lịch' : 'Awaiting reschedule'))
        : isApptPendingApproval
          ? (isSeller ? (vi ? 'Đã đề xuất lịch • Chờ Hub duyệt' : 'Visit proposed • Awaiting Hub') : (vi ? 'Chờ Hub duyệt lịch' : 'Awaiting Hub approval'))
          : hasApptConfirmed
            ? (hasInsp
              ? (vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned')
              : (vi ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'))
            : (hasNoAppt
              ? (isSeller ? (vi ? 'Chờ bạn hẹn lịch đón KTV' : 'Awaiting your schedule') : (vi ? 'Chờ người bán hẹn lịch đón KTV' : 'Awaiting seller schedule'))
              : (hasInsp
                ? (vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned')
                : (vi ? 'Đã điều phối KTV' : 'Technician Dispatched'))))
      : (vi ? 'Đã thu đủ phí' : 'Fees collected'),
    DISPATCHED: isAtHome
      ? (isApptCountered
        ? (isSeller ? (vi ? 'Hub đề xuất lịch mới' : 'Hub proposed reschedule') : (vi ? 'Chờ hẹn lại lịch' : 'Awaiting reschedule'))
        : isApptPendingApproval
          ? (isSeller ? (vi ? 'Đã đề xuất lịch • Chờ Hub duyệt' : 'Visit proposed • Awaiting Hub') : (vi ? 'Chờ Hub duyệt lịch' : 'Awaiting Hub approval'))
          : hasApptConfirmed
            ? (hasInsp
              ? (vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned')
              : (vi ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'))
            : (hasNoAppt
              ? (isSeller ? (vi ? 'Chờ bạn hẹn lịch đón KTV' : 'Awaiting your schedule') : (vi ? 'Chờ người bán hẹn lịch đón KTV' : 'Awaiting seller schedule'))
              : (hasInsp
                ? (vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned')
                : (vi ? 'Đã điều phối KTV' : 'Technician Dispatched'))))
      : (vi ? 'Đã điều phối vận chuyển' : 'Dispatched'),
    SCHEDULED: isAtHome
      ? (hasApptConfirmed
        ? (hasInsp
          ? (vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned')
          : (vi ? 'Đã chốt lịch kiểm định' : 'Schedule Confirmed'))
        : (vi ? 'Đã xếp lịch kiểm định' : 'Inspection Scheduled'))
      : (vi ? 'Đã xếp lịch kiểm định' : 'Inspection Scheduled'),
    ASSIGNED: vi ? (isSeller ? 'Đã phân công KTV' : 'Đã Phân Công KTV • Chờ Khảo Sát') : 'Inspector Assigned',
    DISPATCHED_TO_CENTER: vi ? 'Đang giao đến Hub' : 'Shipping to Hub',
    WAITING_INSPECTION: vi ? 'Chờ kiểm định' : 'Awaiting Inspection',
    INSPECTION_IN_PROGRESS: vi ? 'Đang kiểm định' : 'Inspection in Progress',
    IN_PROGRESS: vi ? 'Đang kiểm định' : 'Inspection in progress',
    SHIPPING_TO_CENTER: vi ? 'Đang giao đến Hub' : 'Shipping to Hub',
    INBOUND_CANCELLED: vi ? 'Vận đơn đến Hub đã hủy' : 'Shipment to Hub cancelled',
    INBOUND_FAILED: vi ? 'Vận đơn đến Hub thất bại' : 'Shipment to Hub failed',
    RECEIVED_AT_CENTER: vi ? 'Đã đến Hub kiểm định' : 'Delivered to Hub',
    INSPECTING: vi ? 'Đang kiểm định' : 'Inspection in progress',
    PASSED: vi ? 'Kiểm định đạt chuẩn' : 'Passed',
    FAILED: vi ? 'Không đạt chuẩn' : 'Failed',
    REJECTED: vi ? 'Đã từ chối' : 'Rejected',
    CANCELLED: vi ? 'Đã hủy' : 'Cancelled',
    BUYER_REJECTED_PURCHASE: isSeller
      ? (vi ? 'Người mua từ chối mua' : 'Buyer declined purchase')
      : (vi ? 'Bạn đã từ chối mua' : 'Purchase declined'),
    PAYMENT_EXPIRED: vi ? 'Hết hạn nộp phí' : 'Payment expired',
    DELIVERING_TO_BUYER: isSeller
      ? (vi ? 'Người mua đã mua tiếp' : 'Purchase confirmed')
      : (vi ? 'Người mua đã mua tiếp' : 'Purchase confirmed'),
    COMPLETED: vi ? 'Giao dịch hoàn tất' : 'Completed',
    PENDING: vi ? 'Đang xử lý đề xuất' : 'Pending',
    PROCESSING: vi ? 'Đang xử lý' : 'Processing',
  };

  return (
    <div className="flex justify-center my-3 animate-fadeIn w-full">
      <div
        className={`max-w-lg w-full rounded-2xl border p-4 shadow-sm text-left transition-all relative overflow-hidden ${isPassed || isConfirmedPendingDispatch || badgeStatus === 'RECEIVED_AT_CENTER'
          ? 'bg-gradient-to-b from-emerald-50/70 to-white border-emerald-300'
          : isRejected || isCancelled || badgeStatus === 'INBOUND_CANCELLED' || badgeStatus === 'INBOUND_FAILED'
            ? 'bg-gradient-to-b from-rose-50/70 to-white border-rose-200'
            : isWaitingFeePayment
              ? 'bg-gradient-to-b from-amber-50/80 to-white border-amber-300'
              : 'bg-gradient-to-b from-blue-50/70 via-[#fbfdff] to-white border-blue-200'
          }`}
      >
        {/* TOP STATUS BAR */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block">
                {lang === 'vi' ? 'Đề xuất kiểm định' : 'Inspection proposal'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Mã đơn: #{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${badgeStatus === 'WAITING_SELLER_APPROVAL'
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : badgeStatus === 'WAITING_BUYER_APPROVAL'
                ? 'bg-purple-100 text-purple-800 border-purple-300'
                : badgeStatus === 'WAITING_FEE_PAYMENT'
                  ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  : badgeStatus === 'RECEIVED_AT_CENTER'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : badgeStatus === 'SHIPPING_TO_CENTER' || badgeStatus === 'DISPATCHED_TO_CENTER'
                      ? 'bg-cyan-100 text-cyan-800 border-cyan-300'
                      : badgeStatus === 'INBOUND_CANCELLED' || badgeStatus === 'INBOUND_FAILED'
                        ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                        : badgeStatus === 'CONFIRMED_PENDING_DISPATCH' || badgeStatus === 'DISPATCHED' || badgeStatus === 'SCHEDULED' || badgeStatus === 'ASSIGNED'
                          ? (isAtHome
                            ? (hasNoAppt
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                              : isApptPendingApproval
                                ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                : isApptCountered
                                  ? 'bg-orange-100 text-orange-900 border-orange-300 font-bold'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold')
                            : 'bg-blue-100 text-blue-800 border-blue-300 font-bold')
                          : badgeStatus === 'INSPECTING' || badgeStatus === 'INSPECTION_IN_PROGRESS' || badgeStatus === 'WAITING_INSPECTION' || badgeStatus === 'IN_PROGRESS'
                            ? 'bg-teal-100 text-teal-900 border-teal-300'
                            : badgeStatus === 'PASSED' || badgeStatus === 'DELIVERING_TO_BUYER' || badgeStatus === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                              : ['FAILED', 'REJECTED', 'CANCELLED', 'BUYER_REJECTED_PURCHASE', 'PAYMENT_EXPIRED'].includes(badgeStatus)
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}
          >
            {badgeLabels[badgeStatus] || (vi ? 'Đang xử lý kiểm định' : badgeStatus)}
          </span>
        </div>

        {/* PRODUCT & CENTER INFO */}
        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-3 text-xs space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={order.postImageUrl || order.postImageUrls?.[0] || listing.photos?.front || CHAT_PRODUCT_PLACEHOLDER}
              alt={order.postTitle || listing.title}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h5 className="font-extrabold text-slate-900 truncate text-[11px] sm:text-xs">
                {order.postTitle || listing.title}
              </h5>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-[#c34c36]">
                  {formatFee(itemPrice)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">| Tiền sản phẩm</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {centerName || (centerId && centerResult?.id !== centerId
                  ? (lang === 'vi' ? 'Đang tải tên trung tâm…' : 'Loading center name…')
                  : (lang === 'vi' ? 'Chưa có tên trung tâm' : 'Center name unavailable'))}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-[10px] pl-5">
              <span>Hình thức:</span>
              <strong className="text-slate-700">
                {isAtHome ? 'Kiểm định tại nhà' : isAtCenter ? 'Đưa đến trung tâm kiểm định Hub' : 'Chưa có thông tin'}
              </strong>
            </div>
          </div>
        </div>

        {/* FEE BREAKDOWN GRID */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-2.5 text-xs mb-3 shadow-2xs">
          <div className="flex justify-between items-center text-slate-700 font-bold border-b border-slate-100 pb-2">
            <span className="text-xs">{lang === 'vi' ? 'Chi tiết các khoản phí kiểm định:' : 'Inspection fee breakdown:'}</span>
            {feePayerLabel && <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{feePayerLabel}</span>}
          </div>

          {/* Sub-fees */}
          <div className="space-y-1.5 text-[11px] text-slate-600">
            {isAtHome ? (
              <>
                <div className="flex justify-between items-center">
                  <span>• {lang === 'vi' ? 'Phí kiểm định cơ sở:' : 'Base inspection fee:'}</span>
                  <span className="font-semibold text-slate-800">{formatFee(baseInspectionFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• {lang === 'vi' ? 'Phí di chuyển KTV đến nhà:' : 'Technician travel fee:'}</span>
                  <span className="font-semibold text-slate-800">{formatFee(travelFeeRoundTrip)}</span>
                </div>
              </>
            ) : isAtCenter ? (
              <>
                <div className="flex justify-between items-center">
                  <span>• Phí kiểm định cơ sở:</span>
                  <span className="font-semibold text-slate-800">{formatFee(baseInspectionFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Cước vận chuyển giao hàng tới Hub:</span>
                  <span className="font-semibold text-slate-800">{formatFee(shippingFeeToHub)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Dự phòng hoàn hàng:</span>
                  <span className="font-semibold text-slate-800">{formatFee(returnReserveFee)}</span>
                </div>
                <div className="text-[10px] text-slate-500 italic bg-blue-50/50 p-1.5 rounded-lg border border-blue-100/70 leading-snug">
                  {lang === 'vi'
                    ? 'Khoản dự phòng cước trả về sẽ được hoàn nếu người mua mua tiếp hoặc hoàn phần dư sau khi đối soát cước trả hàng.'
                    : 'Return reserve is refunded if Buyer completes purchase or residual balance refunded after reconciliation.'}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-black">
            <span className="text-slate-800 text-xs">• {lang === 'vi' ? 'Tổng phí kiểm định:' : 'Total fee:'}</span>
            <strong className="text-blue-900 font-black text-sm sm:text-base">{formatFee(totalFee)}</strong>
          </div>

          {/* Split cards */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <span className="text-[10px] text-slate-500 block">{lang === 'vi' ? 'Người mua trả:' : 'Buyer pays:'}</span>
              <span className="font-black text-xs sm:text-sm text-[#c34c36]">{formatFee(buyerFeeShare)}</span>
              {buyerCommitmentDeposit > 0 && (
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  + Cọc: <strong>{formatFee(buyerCommitmentDeposit)}</strong>
                </span>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block">{lang === 'vi' ? 'Người bán chịu:' : 'Seller share:'}</span>
              <span className="font-black text-xs sm:text-sm text-slate-800">{formatFee(sellerFeeShare)}</span>
            </div>
          </div>

          {/* 2-Stage Payment Roadmap */}
          <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 1 (Thu trước):</span>
              <span className="font-bold text-slate-800">Buyer nộp trước {formatFee(buyerAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 2 (Sau khi máy ĐẠT):</span>
              <span className="font-bold text-emerald-800">Tiền sản phẩm {formatFee(itemPrice)}</span>
            </div>
          </div>

          {/* Zin loss notice */}
          {order.buyerConsentZin === true && <div className="text-[10px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 leading-snug">
            ✓ <strong>Quy trình tháo máy:</strong> Đã đồng ý mở máy kiểm tra chuyên sâu sẽ mất trạng thái tem zin của nhà sản xuất (Nếu có).
          </div>}
        </div>

        {/* ACTION / NOTIFICATION AREA BASED ON STATUS */}
        {actionError && (
          <div className="p-2.5 mb-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
          </div>
        )}

        {/* 1. STATUS: WAITING_SELLER_APPROVAL */}
        {isWaitingSellerApproval && (
          <div className="space-y-2 pt-1">
            {isSeller ? (
              <>
                <p className="text-[11px] text-slate-700 font-medium">
                  {lang === 'vi'
                    ? 'Người mua đề xuất kiểm định sản phẩm trước khi chốt đơn. Bạn có đồng ý với phương án chia phí này không?'
                    : 'Buyer proposed inspecting item before final purchase. Do you agree with this fee split?'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Đồng ý */}
                  <button
                    type="button"
                    onClick={handleSellerAccept}
                    disabled={actionLoading}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng ý' : 'Accept'}</span>}
                  </button>

                  {canCounter && (
                    <button
                      type="button"
                      onClick={toggleCounterDrawer}
                      disabled={actionLoading}
                      className="flex-1 min-w-[110px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>{lang === 'vi' ? 'Đề xuất lại' : 'Counter'}</span>
                    </button>
                  )}

                  {/* Từ chối */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(true);
                      setShowCounterDrawer(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Từ chối' : 'Reject'}</span>
                  </button>
                </div>

                {!canCounter && (
                  <p className="text-xs text-slate-600">
                    {vi ? 'Không còn tỷ lệ trung gian để đề xuất lại.' : 'No intermediate fee split remains.'}
                  </p>
                )}
                {/* Seller Counter Drawer */}
                {canCounter && showCounterDrawer && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-indigo-950">
                        {lang === 'vi' ? 'Chọn phương án chia phí muốn đề xuất lại:' : 'Choose counter fee split:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <InspectionFeePercentSelect
                      value={counterBuyerFeePercent}
                      onChange={setCounterBuyerFeePercent}
                      options={counterOptions}
                      total={totalFee}
                      lang={lang}
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSellerCounter}
                        disabled={actionLoading || !counterOptions.includes(counterBuyerFeePercent)}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Xác nhận đề xuất lại </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-800 font-medium flex items-center gap-1.5 min-w-0">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {isCounterProposal
                      ? (lang === 'vi' ? 'Đã gửi lại đề xuất chia phí, đang chờ người bán phản hồi...' : 'Counter proposal sent, waiting for seller response...')
                      : (lang === 'vi' ? 'Đã gửi đề xuất cho người bán, đang chờ phản hồi...' : 'Proposal sent, waiting for seller response...')}
                  </span>
                </p>
                {isInitialProposal && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelModal(true);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap shrink-0 shadow-2xs active:scale-95 disabled:opacity-50"
                    title={lang === 'vi' ? 'Hủy yêu cầu kiểm định này' : 'Cancel inspection request'}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Hủy yêu cầu' : 'Cancel request'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. STATUS: WAITING_BUYER_APPROVAL */}
        {isWaitingBuyerApproval && (
          <div className="space-y-2 pt-1">
            {isBuyer ? (
              <>
                <p className="text-[11px] text-purple-900 font-medium">
                  {lang === 'vi'
                    ? 'Người bán đã đề xuất lại phương án chia phí kiểm định. Bạn có đồng ý với phương án này không?'
                    : 'Seller countered the fee split proposal. Do you accept this counter offer?'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Đồng ý */}
                  <button
                    type="button"
                    onClick={handleBuyerAccept}
                    disabled={actionLoading}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng ý ' : 'Accept Counter'}</span>}
                  </button>

                  {canCounter && (
                    <button
                      type="button"
                      onClick={toggleCounterDrawer}
                      disabled={actionLoading}
                      className="flex-1 min-w-[100px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>{lang === 'vi' ? 'Đề xuất lại' : 'Counter'}</span>
                    </button>
                  )}

                  {/* Từ chối */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(true);
                      setShowCounterDrawer(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Từ chối' : 'Reject'}</span>
                  </button>
                </div>

                {!canCounter && (
                  <p className="text-xs text-slate-600">
                    {vi ? 'Không còn tỷ lệ trung gian để đề xuất lại.' : 'No intermediate fee split remains.'}
                  </p>
                )}
                {/* Buyer Counter Drawer */}
                {canCounter && showCounterDrawer && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-indigo-950">
                        {lang === 'vi' ? 'Chọn phương án chia phí muốn đề xuất lại:' : 'Choose counter fee split:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <InspectionFeePercentSelect
                      value={counterBuyerFeePercent}
                      onChange={setCounterBuyerFeePercent}
                      options={counterOptions}
                      total={totalFee}
                      lang={lang}
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBuyerCounter}
                        disabled={actionLoading || !counterOptions.includes(counterBuyerFeePercent)}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{lang === 'vi' ? 'Xác nhận đề xuất lại' : 'Confirm Counter'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-purple-900 font-medium bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{lang === 'vi' ? 'Đã gửi đề xuất lại chia phí, đang chờ người mua xác nhận...' : 'Counter proposal sent, waiting for buyer response...'}</span>
              </p>
            )}
          </div>
        )}

        {/* 3. STATUS: WAITING_FEE_PAYMENT */}
        {isWaitingFeePayment && (
          <div className="space-y-2.5 pt-1">
            <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${isPaymentDeadlinePassed
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
              <div className="font-bold flex items-center justify-between flex-wrap gap-1">
                <span>{lang === 'vi' ? 'Đã thống nhất phương án chia phí!' : 'Fee split agreed!'}</span>
                {order.paymentDeadline && (
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${isPaymentDeadlinePassed ? 'text-rose-700' : 'text-amber-800'
                    }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'vi' ? 'Hạn:' : 'Due:'} {formatInspectionDeadline(order.paymentDeadline, lang)}
                    </span>
                    {!isPaymentDeadlinePassed && timeLeft.formattedRemaining && (
                      <span className="font-bold text-[#c34c36] bg-amber-100/80 px-1.5 py-0.5 rounded text-[10px]">
                        (còn {timeLeft.formattedRemaining})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {isPaymentDeadlinePassed ? (
                <div className="p-2 rounded-lg bg-rose-100/70 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {lang === 'vi'
                      ? `Đã hết hạn đóng phí kiểm định (${formatInspectionDeadline(order.paymentDeadline, lang)}). Đơn hàng không thể thanh toán tiếp.`
                      : `Inspection fee payment deadline has expired (${formatInspectionDeadline(order.paymentDeadline, lang)}).`}
                  </span>
                </div>
              ) : myFeeToPay == null ? (
                <p className="text-slate-700">{lang === 'vi' ? 'Chưa có số tiền phải nộp từ hệ thống.' : 'Payment amount unavailable.'}</p>
              ) : myFeeToPay === 0 ? (
                <div className="space-y-1">
                  <p className="text-blue-700 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? `Phần phí của bạn là 0 ₫ (${isSeller ? 'Người mua' : 'Người bán'} chịu 100% phí kiểm định)`
                        : `Your share is 0 VND (${isSeller ? 'Buyer' : 'Seller'} covers 100% inspection fee)`}
                    </span>
                  </p>
                  {!isOtherPartyPaid && otherFeeToPay != null && (
                    <p className="text-amber-800 text-[11px] flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                      <span>
                        {lang === 'vi'
                          ? `Đang chờ ${isSeller ? 'người mua' : 'người bán'} nộp ${formatFee(otherFeeToPay)} vào Escrow.`
                          : `Awaiting ${isSeller ? 'buyer' : 'seller'} to pay ${formatFee(otherFeeToPay)} into Escrow.`}
                      </span>
                    </p>
                  )}
                </div>
              ) : isMyPaymentDone ? (
                <div className="space-y-1">
                  <p className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? `Bạn đã thanh toán phí kiểm định (${formatFee(myFeeToPay)}) thành công.`
                        : `You have completed your fee payment (${formatFee(myFeeToPay)}).`}
                    </span>
                  </p>
                  {!isOtherPartyPaid && otherFeeToPay != null && (
                    <p className="text-amber-800 text-[11px] flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                      <span>
                        {lang === 'vi'
                          ? `Đang chờ ${isSeller ? 'người mua' : 'người bán'} nộp phần phí còn lại (${formatFee(otherFeeToPay)}).`
                          : `Awaiting ${isSeller ? 'buyer' : 'seller'} to pay remaining fee (${formatFee(otherFeeToPay)}).`}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-amber-900 text-[11px]">
                  {lang === 'vi' ? 'Số tiền bạn cần nộp vào Escrow:' : 'Amount to pay into Escrow:'}{' '}
                  <strong className="text-[#c34c36] font-black text-sm">{formatFee(myFeeToPay)}</strong>
                </p>
              )}
            </div>

            {/* Nút thanh toán nếu tôi chưa trả */}
            {!isMyPaymentDone && canPay && (
              isPaymentDeadlinePassed ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-300 cursor-not-allowed"
                >
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span>{lang === 'vi' ? 'Đã Hết Hạn Đóng Phí Kiểm Định' : 'Payment Deadline Expired'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPayConfirmModal(true)}
                  disabled={actionLoading || isPaymentDeadlinePassed}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-[#c34c36] hover:opacity-95 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-md cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {lang === 'vi'
                      ? `Thanh toán phí kiểm định (${formatFee(myFeeToPay)})`
                      : `Pay Inspection Fee (${formatFee(myFeeToPay)})`}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {/* 4. STATUS: CONFIRMED_PENDING_DISPATCH / SHIPPING_TO_CENTER / RECEIVED_AT_CENTER / INBOUND_CANCELLED / INBOUND_FAILED */}
        {(isConfirmedPendingDispatch || badgeStatus === 'SHIPPING_TO_CENTER' || badgeStatus === 'DISPATCHED_TO_CENTER' || badgeStatus === 'RECEIVED_AT_CENTER' || badgeStatus === 'INBOUND_CANCELLED' || badgeStatus === 'INBOUND_FAILED') && !isInspecting && !isPassed && !isFailed && !isCancelled && !isPurchaseAccepted && !isCompleted && (
          isInboundDelivered ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{lang === 'vi' ? 'Đã đến Hub kiểm định' : 'Delivered to Hub'}</span>
                </div>
                {inboundShipment?.orderCode && (
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                    #{inboundShipment.orderCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                {lang === 'vi'
                  ? 'Thiết bị đã được giao tới Trung tâm kiểm định. Kỹ thuật viên chuẩn bị tiếp nhận và tiến hành thẩm định.'
                  : 'The item has arrived at the inspection center. Technicians are preparing to inspect.'}
              </p>
            </div>
          ) : isInboundCancelled ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 space-y-2">
              <div className="font-bold flex items-center justify-between text-rose-900">
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{lang === 'vi' ? 'Vận đơn đến Hub đã hủy' : 'Shipment to Hub cancelled'}</span>
                </div>
                {inboundShipment?.orderCode && (
                  <span className="text-[10px] font-mono text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-300">
                    #{inboundShipment.orderCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                {isSeller
                  ? (lang === 'vi'
                    ? 'Vận đơn Lalamove gửi kiện hàng đến Hub đã bị hủy. Vui lòng bấm "Tạo lại vận đơn Lalamove" bên dưới để gọi tài xế mới.'
                    : 'The shipment to Hub was cancelled. Please create a new shipment.')
                  : (lang === 'vi'
                    ? 'Vận đơn chuyển kiện hàng đến Hub đã bị hủy. Người bán sẽ điều phối lại chuyến xe mới để gửi kiện hàng đến Hub.'
                    : 'The shipment to Hub was cancelled. The seller will dispatch a new shipment.')}
              </p>
              {isSeller && isAtCenter && (
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(true)}
                  className="w-full mt-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Truck className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Tạo lại vận đơn Lalamove' : 'Re-create Shipment'}</span>
                </button>
              )}
            </div>
          ) : isInboundFailed ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 space-y-2">
              <div className="font-bold flex items-center justify-between text-rose-900">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{lang === 'vi' ? 'Vận đơn đến Hub thất bại' : 'Shipment to Hub failed'}</span>
                </div>
                {inboundShipment?.orderCode && (
                  <span className="text-[10px] font-mono text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-300">
                    #{inboundShipment.orderCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                {isSeller
                  ? (lang === 'vi'
                    ? 'Chuyến xe giao đến Hub không thành công hoặc không tìm được tài xế nhận đơn. Vui lòng bấm "Tạo lại vận đơn Lalamove" bên dưới.'
                    : 'The delivery to Hub failed. Please create a new shipment.')
                  : (lang === 'vi'
                    ? 'Chuyến xe giao kiện hàng đến Hub gặp sự cố hoặc quá hạn nhận đơn. Người bán đang xử lý điều phối lại vận đơn.'
                    : 'The delivery to Hub failed. Seller is arranging a new shipment.')}
              </p>
              {isSeller && isAtCenter && (
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(true)}
                  className="w-full mt-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Truck className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Tạo lại vận đơn Lalamove' : 'Re-create Shipment'}</span>
                </button>
              )}
            </div>
          ) : isInboundShipping ? (
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-950 space-y-1.5">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>{lang === 'vi' ? 'Đang vận chuyển đến Hub kiểm định' : 'Shipping to Hub'}</span>
                </div>
                {inboundShipment?.orderCode && (
                  <span className="text-[10px] font-mono text-cyan-800 bg-cyan-100/80 px-2 py-0.5 rounded-md border border-cyan-300">
                    #{inboundShipment.orderCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-cyan-800 leading-relaxed">
                {lang === 'vi'
                  ? 'Tài xế Lalamove đang giao kiện hàng đến Hub. Kỹ thuật viên sẽ tiếp nhận khi máy tới nơi.'
                  : 'Lalamove driver is delivering the parcel to the Hub.'}
              </p>
            </div>
          ) : isAtHome ? (
            <div className="space-y-2">
              {hasNoAppt ? (
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Awaiting Your Schedule')
                        : (lang === 'vi' ? 'Chờ Người Bán Hẹn Lịch Đón KTV' : 'Awaiting Seller Schedule')}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {isSeller
                      ? (lang === 'vi'
                        ? 'Khách mua đã đăng ký gói kiểm định tận nơi. Vui lòng bấm nút "Hẹn Lịch Đón KTV" bên dưới để chọn ngày giờ làm việc trong khung giờ hành chính (08:00 - 12:00 hoặc 13:00 - 17:00). Trung tâm SecondLife sẽ nhận thông tin để điều phối Kỹ thuật viên phù hợp.'
                        : 'Buyer requested on-site inspection. Please click "Schedule Visit" below to choose an appointment slot.')
                      : (lang === 'vi'
                        ? 'Hai bên đã nộp đủ phí kiểm định giai đoạn 1. Đang chờ người bán chọn ngày giờ làm việc để Kỹ thuật viên SecondLife đến tận nhà kiểm định thiết bị.'
                        : 'Inspection fees collected. Waiting for the seller to choose a visit appointment.')}
                  </p>

                  {/* Nút Hẹn Lịch Đón KTV dành cho Người bán */}
                  {isSeller && (
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Inspector Visit'}</span>
                    </button>
                  )}
                </div>
              ) : isApptPendingApproval ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{lang === 'vi' ? 'Đã đề xuất lịch • Chờ Hub duyệt' : 'Visit proposed • Awaiting Hub approval'}</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    {lang === 'vi'
                      ? `Đã gửi đề xuất lịch đón KTV${currentAppt?.scheduledAt || order.appointmentScheduledAt ? `: ${new Date(currentAppt?.scheduledAt || order.appointmentScheduledAt!).toLocaleString('vi-VN')}` : ''}. Đang chờ Trung tâm kiểm định duyệt lịch.`
                      : 'Inspection appointment has been proposed. Awaiting Hub confirmation.'}
                  </p>
                </div>
              ) : isApptCountered ? (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 space-y-2">
                  <div className="font-bold flex items-center justify-between">
                    <span className="text-amber-900 font-extrabold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      {lang === 'vi' ? 'Trung tâm đề xuất lịch hẹn mới:' : 'Hub proposed a new appointment:'}
                    </span>
                  </div>
                  {(currentAppt?.counterScheduledAt || (order as any).counterScheduledAt) && (
                    <div className="p-2 rounded-lg bg-white border border-amber-200 font-bold text-amber-900">
                      {new Date(currentAppt?.counterScheduledAt || (order as any).counterScheduledAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                  {isSeller && (
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Hẹn Lại Lịch Khác' : 'Reschedule'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {hasInsp
                        ? (lang === 'vi' ? (isSeller ? 'Đã phân công KTV • KTV sẽ đến kiểm định tận nhà' : 'Đã phân công KTV • Chờ khảo sát') : 'Inspector Assigned')
                        : (lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch')}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {lang === 'vi'
                      ? `Kỹ thuật viên sẽ có mặt tại nhà${currentAppt?.scheduledAt || order.appointmentScheduledAt ? ` vào lúc: ${new Date(currentAppt?.scheduledAt || order.appointmentScheduledAt!).toLocaleString('vi-VN')}` : ''}. Vui lòng chuẩn bị sẵn thiết bị để KTV kiểm định.`
                      : 'Technician visit has been confirmed.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-teal-700" />
                <span>
                  {isSeller
                    ? (lang === 'vi' ? 'Chờ bạn gửi hàng đến Hub' : 'Awaiting shipment to Hub')
                    : (lang === 'vi' ? 'Chờ người bán gửi hàng đến Hub' : 'Awaiting seller shipment to Hub')}
                </span>
              </div>
              <p className="text-[11px] text-teal-800 leading-relaxed">
                {isSeller
                  ? (lang === 'vi' ? 'Hai bên đã hoàn tất nộp phí. Vui lòng đóng gói và tạo đơn vận chuyển Lalamove để giao máy đến Hub kiểm định.' : 'Waiting for shipment to the inspection center.')
                  : (lang === 'vi' ? 'Đang chờ người bán đóng gói và tạo đơn vận chuyển đến Hub.' : 'Waiting for seller to pack and create shipment to Hub.')}
              </p>

              {/* Nút Tạo Vận Đơn Lalamove dành cho Người bán */}
              {isSeller && isAtCenter && (
                shipmentState === 'created' ? (
                  <div className="mt-2 py-2 px-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-800 font-bold text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Đã tạo vận đơn Lalamove' : 'Lalamove shipment created'}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded-md border border-emerald-200">
                      {lang === 'vi' ? 'Chặng 1' : 'Leg 1'}
                    </span>
                  </div>
                ) : shipmentState === 'none' ? (
                  <button
                    type="button"
                    onClick={() => setShowShipmentModal(true)}
                    className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Truck className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Shipment'}</span>
                  </button>
                ) : (
                  <p role="status" className="mt-2 text-[11px] text-slate-600">
                    {shipmentState === 'checking'
                      ? (lang === 'vi' ? 'Đang tải vận đơn…' : 'Loading shipment…')
                      : (lang === 'vi' ? 'Chưa tải được vận đơn' : 'Shipment unavailable')}
                    {shipmentState === 'unavailable' && (
                      <button type="button" className="ml-2 font-semibold underline" onClick={() => setShipmentRetry((previous) => previous + 1)}>
                        {lang === 'vi' ? 'Thử lại' : 'Retry'}
                      </button>
                    )}
                  </p>
                )
              )}
            </div>
          )
        )}

        {/* 5. STATUS: PASSED / DELIVERING_TO_BUYER / COMPLETED */}
        {isPassed && (
          <div className="space-y-2">
            {!isDelivered && !(isAtCenter && isCompleted) && (
              <p className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isCompleted
                    ? (isSeller
                      ? (lang === 'vi' ? 'Giao dịch hoàn tất • Tiền hàng đã chuyển về ví' : 'Transaction completed • Payout credited to wallet')
                      : (lang === 'vi' ? 'Giao dịch hoàn tất • Đã nhận hàng thành công' : 'Transaction completed • Order successfully delivered'))
                    : isPurchaseAccepted
                      ? (isSeller
                        ? (lang === 'vi'
                          ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Người mua đã xác nhận mua hàng.'
                          : 'Product passed inspection. Buyer confirmed purchase.')
                        : (lang === 'vi'
                          ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Bạn đã xác nhận mua hàng thành công.'
                          : 'Product passed inspection. You have completed purchase.'))
                      : isDelivering
                        ? (isSeller
                          ? (lang === 'vi' ? 'Đang giao hàng đến người mua • Lalamove' : 'Delivering to buyer • Lalamove')
                          : (lang === 'vi' ? 'Đang giao hàng tới bạn • Lalamove' : 'Delivering to you • Lalamove'))
                        : isSeller
                          ? (lang === 'vi'
                            ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Đang chờ người mua xác nhận mua hàng.'
                            : 'Product passed inspection. Awaiting buyer confirmation.')
                          : (lang === 'vi'
                            ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Bạn có thể mua tiếp.'
                            : 'Product passed inspection. You can proceed with the purchase.')}
                </span>
              </p>
            )}
            {isCompleted ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Hoàn tất giao dịch • Đã nhận tiền vào ví' : 'Transaction Completed • Funds Released')
                        : (lang === 'vi' ? 'Giao dịch hoàn tất • Đã giải ngân' : 'Transaction Completed • Escrow Released')}
                    </span>
                  </div>
                  {buyerShipment?.orderCode && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                      #{buyerShipment.orderCode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {isSeller
                    ? (lang === 'vi'
                      ? 'Đơn hàng đã được giao thành công tới người mua và tiền bán hàng đã được tự động giải ngân vào ví SecondLife của bạn.'
                      : 'Order has been delivered to buyer and funds have been released to your SecondLife wallet.')
                    : (lang === 'vi'
                      ? 'Đơn hàng đã được giao thành công và hoàn tất đối soát. Cảm ơn bạn đã tin tưởng mua sắm trên SecondLife!'
                      : 'Order delivered and verified successfully. Thank you for shopping on SecondLife!')}
                </p>
              </div>
            ) : isDelivered ? (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Đã giao hàng • Chờ đối soát (48h)' : 'Delivered • Review Window (48h)')
                        : (lang === 'vi' ? 'Đã nhận hàng • 48h kiểm tra đối soát' : 'Package Delivered • 48h Inspection Window')}
                    </span>
                  </div>
                  {buyerShipment?.orderCode && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                      #{buyerShipment.orderCode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {isSeller
                    ? (lang === 'vi'
                      ? 'Tài xế đã giao kiện hàng thành công tới người mua. Khách mua có 48 giờ để kiểm tra đối soát trước khi hệ thống tự động giải ngân vào ví của bạn.'
                      : 'Driver has delivered package to buyer. Buyer has 48 hours inspection window before escrow is released to your wallet.')
                    : (lang === 'vi'
                      ? 'Kiện hàng đã được giao thành công đến bạn. Bạn có 48 giờ để dùng thử và kiểm tra đối soát trước khi hệ thống tự động giải ngân cho người bán.'
                      : 'Package has been delivered to you. You have 48 hours to inspect before funds are released to seller.')}
                </p>
              </div>
            ) : isDelivering ? (
              <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Đang giao hàng đến người mua • Lalamove' : 'Delivering to Buyer • Lalamove')
                        : (lang === 'vi' ? 'Đang giao hàng tới bạn • Lalamove' : 'Delivering to You • Lalamove')}
                    </span>
                  </div>
                  {buyerShipment?.orderCode && (
                    <span className="text-[10px] font-mono text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">
                      #{buyerShipment.orderCode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  {isSeller
                    ? (lang === 'vi'
                      ? 'Kiện hàng đã được bàn giao cho tài xế Lalamove vận chuyển giao đến người mua.'
                      : 'Parcel is sealed with tamper-proof seal and handed to Lalamove driver for delivery to buyer.')
                    : (lang === 'vi'
                      ? 'Tài xế Lalamove đang vận chuyển kiện hàng đến địa chỉ nhận hàng của bạn.'
                      : 'Lalamove driver is delivering the sealed parcel to your address.')}
                </p>
              </div>
            ) : isAwaitingPickup ? isAtHome && (
              <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl text-xs text-teal-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-teal-800">
                    <Truck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Đã tạo vận đơn • Chờ tài xế lấy hàng' : 'Shipment Created • Awaiting Driver')
                        : (lang === 'vi' ? 'Người bán đã tạo vận đơn • Chờ tài xế lấy hàng' : 'Shipment Created • Awaiting Driver Pickup')}
                    </span>
                  </div>
                  {buyerShipment?.orderCode && (
                    <span className="text-[10px] font-mono text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-300">
                      #{buyerShipment.orderCode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-teal-800 leading-relaxed">
                  {isSeller
                    ? (lang === 'vi'
                      ? 'Đã tạo vận đơn Lalamove thành công. Vui lòng giữ nguyên tem niêm phong và bàn giao kiện hàng cho tài xế khi đến lấy.'
                      : 'Lalamove shipment created successfully. Keep tamper seal intact and hand over parcel to driver upon arrival.')
                    : (lang === 'vi'
                      ? 'Người bán đã tạo vận đơn Lalamove thành công. Tài xế sẽ đến nhận kiện hàng nguyên tem niêm phong để phát đến bạn.'
                      : 'Lalamove shipment created. Driver will pick up sealed package from seller.')}
                </p>
              </div>
            ) : isPurchaseAccepted ? (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isAtHome
                        ? (isSeller
                          ? (lang === 'vi' ? 'Đã Xác Nhận Mua • Chờ bạn gửi hàng' : 'Purchase Confirmed • Awaiting Your Shipment')
                          : (lang === 'vi' ? 'Đã Duyệt Mua • Chờ người bán gửi hàng' : 'Purchase Confirmed • Awaiting Seller Shipment'))
                        : (isSeller
                          ? (lang === 'vi' ? 'Chặng 2: Hub Giao Người Mua (Đã Duyệt Mua)' : 'Leg 2: Hub to Buyer (Purchase Confirmed)')
                          : (lang === 'vi' ? 'Chặng 2: Đã Duyệt Mua • Chờ Hub Giao Hàng' : 'Leg 2: Purchase Confirmed • Hub Delivering'))}
                    </span>
                  </div>
                  {buyerShipment?.orderCode && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                      #{buyerShipment.orderCode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {isAtHome
                    ? (isSeller
                      ? (lang === 'vi'
                        ? 'Thiết bị đã kiểm định ĐẠT CHUẨN tại nhà và Người mua đã đồng ý mua tiếp. Vui lòng đóng gói và bấm "Đã gói hàng • Tạo đơn vận chuyển" để bàn giao hàng cho tài xế giao đến người mua.'
                        : 'Product passed inspection and buyer confirmed purchase. Please pack and create shipment to deliver to buyer.')
                      : (lang === 'vi'
                        ? 'Thiết bị đã kiểm định ĐẠT CHUẨN tại nhà và bạn đã xác nhận mua tiếp. Người bán đang chuẩn bị kiện hàng (nguyên vẹn tem niêm phong) để bàn giao cho tài xế giao đến bạn.'
                        : 'Product passed inspection and you confirmed purchase. Seller is preparing the sealed package for dispatch to your address.'))
                    : (isSeller
                      ? (lang === 'vi'
                        ? 'Thiết bị đã kiểm định ĐẠT CHUẨN và Người mua đã đồng ý mua tiếp. Hub đang xử lý giao hàng đến người mua; tiền hàng sẽ được giải ngân về ví của bạn khi người mua nhận hàng.'
                        : 'Product passed inspection and buyer confirmed purchase. Hub is dispatching to buyer; funds will be released upon delivery.')
                      : (lang === 'vi'
                        ? 'Thiết bị đã kiểm định ĐẠT CHUẨN và bạn đã xác nhận mua tiếp. Hub đang đóng gói và chuẩn bị bàn giao đơn vị vận chuyển phát đến bạn.'
                        : 'Product passed inspection and you confirmed purchase. Hub is preparing dispatch to your address.'))}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {isSeller
                        ? (lang === 'vi' ? 'Kiểm định ĐẠT • Chờ người mua quyết định' : 'Inspection Passed • Awaiting Buyer Decision')
                        : (lang === 'vi' ? 'Kiểm định ĐẠT • Vui lòng quyết định mua hàng' : 'Inspection Passed • Please make purchase decision')}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isSeller
                    ? (lang === 'vi'
                      ? 'Kỹ thuật viên Hub đã kiểm định ĐẠT chuẩn. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                      : 'Hub inspector confirmed the item PASSED quality standards with tamper seal. Awaiting buyer to review report and decide on purchase.')
                    : (lang === 'vi'
                      ? 'Thiết bị đã được KTV kiểm định ĐẠT chuẩn và dán tem niêm phong. Bạn hãy xem biên bản thẩm định và đưa ra quyết định mua hàng tiếp tục.'
                      : 'Item PASSED inspection standards with tamper seal. Please review report and decide on purchase.')}
                </p>
              </div>
            )}
          </div>
        )}
        {isFailed && (
          <p className="text-xs text-rose-800 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {isSeller
                ? (lang === 'vi'
                  ? 'Sản phẩm kiểm định KHÔNG ĐẠT chuẩn. Kiện hàng sẽ được hoàn trả về cho bạn.'
                  : 'Inspection failed. Item will be returned to seller.')
                : (lang === 'vi'
                  ? 'Sản phẩm kiểm định KHÔNG ĐẠT chuẩn. Đơn hàng sẽ được hủy và tiền sẽ được chia đều theo đúng tỉ lệ mà hai bên đã thương lượng'
                  : 'Inspection failed. Order cancelled and payment refunded.')}
            </span>
          </p>
        )}
        {(isRejected || isCancelled) && (
          <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900 animate-fadeIn">
            <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isBuyerPurchaseExpired
                  ? (lang === 'vi' ? 'Đã hủy do hết hạn quyết định mua' : 'Cancelled due to purchase decision timeout')
                  : isBuyerPurchaseRejected
                    ? (isSeller
                      ? (lang === 'vi' ? 'Người mua từ chối mua tiếp sau kiểm định' : 'Buyer declined purchase after inspection')
                      : (lang === 'vi' ? 'Bạn đã từ chối mua tiếp sau kiểm định' : 'You declined purchase after inspection'))
                    : isCancelled
                      ? (lang === 'vi' ? 'Đề xuất kiểm định đã bị hủy' : 'Inspection proposal cancelled')
                      : (lang === 'vi' ? 'Đề xuất kiểm định đã bị từ chối' : 'Inspection proposal rejected')}
              </span>
            </div>
            {displayCancellationReason ? (
              <div className="text-[11px] text-rose-800 bg-white/90 p-2 rounded-lg border border-rose-200/80 leading-relaxed font-medium">
                <strong>{lang === 'vi' ? 'Lý do:' : 'Reason:'}</strong>{' '}
                {displayCancellationReason}
              </div>
            ) : (
              <p className="text-[11px] text-rose-600 italic">
                {lang === 'vi' ? '(Không có lý do chi tiết)' : '(No reason specified)'}
              </p>
            )}
          </div>
        )}

        {/* FOOTER: NÚT XEM CHI TIẾT KIỂM ĐỊNH */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">SecondLife Inspection Hub</span>
          <button
            type="button"
            onClick={handleOpenDetail}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition hover:underline"
          >
            <span>{lang === 'vi' ? 'Xem chi tiết kiểm định' : 'View Inspection Details'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODAL NHẬP LÝ DO TỪ CHỐI */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{lang === 'vi' ? 'Từ chối đề xuất kiểm định' : 'Reject Inspection Proposal'}</span>
              </h4>
              <p className="text-xs text-slate-600 leading-snug">
                {lang === 'vi'
                  ? 'Vui lòng cung cấp lý do bạn từ chối đề xuất này để thông báo cho đối phương:'
                  : 'Please state the reason for rejecting this proposal:'}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={lang === 'vi' ? 'Nhập lý do từ chối...' : 'Enter rejection reason...'}
                rows={3}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-rose-500 bg-slate-50"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Xác nhận từ chối</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XÁC NHẬN HỦY ĐƠN CHO BUYER */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{lang === 'vi' ? 'Xác nhận hủy đề xuất kiểm định' : 'Cancel Inspection Proposal'}</span>
              </h4>
              <p className="text-xs text-slate-600 leading-snug">
                {lang === 'vi'
                  ? 'Bạn có chắc chắn muốn hủy yêu cầu kiểm định này không? Đề xuất sẽ kết thúc và tiền ký quỹ (nếu có) sẽ được bảo toàn nguyên vẹn.'
                  : 'Are you sure you want to cancel this inspection proposal?'}
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={lang === 'vi' ? 'Nhập lý do hủy (tùy chọn)...' : 'Enter cancellation reason (optional)...'}
                rows={3}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-rose-500 bg-slate-50"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {lang === 'vi' ? 'Giữ lại' : 'Keep'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelProposal}
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{lang === 'vi' ? 'Xác nhận hủy yêu cầu' : 'Confirm Cancel'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XÁC NHẬN NỘP PHÍ QUA VÍ */}
        {showPayConfirmModal && isWaitingFeePayment && canPay && !isMyPaymentDone && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-orange-600" />
                <span>{lang === 'vi' ? 'Xác nhận nộp phí kiểm định' : 'Confirm fee payment'}</span>
              </h4>
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">{lang === 'vi' ? 'Số tiền nộp:' : 'Amount:'}</span>
                  <strong className="text-[#c34c36] font-black text-sm">{formatFee(myFeeToPay)}</strong>
                </div>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  {lang === 'vi' ? 'Phương thức: Trừ tiền tự động từ Ví khả dụng SecondLife' : 'Method: Auto-deduct from SecondLife Wallet'}
                </div>
                {order.paymentDeadline && (
                  <div className={`text-[10px] pt-0.5 font-medium ${isPaymentDeadlinePassed ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                    {lang === 'vi' ? 'Hạn thanh toán:' : 'Payment deadline:'} {formatInspectionDeadline(order.paymentDeadline, lang)}
                    {isPaymentDeadlinePassed && (lang === 'vi' ? ' (Đã quá hạn)' : ' (Expired)')}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                {isPaymentDeadlinePassed
                  ? (lang === 'vi'
                    ? 'Đơn hàng này đã quá thời hạn nộp phí kiểm định. Không thể tiếp tục trừ ví.'
                    : 'Payment deadline has expired for this inspection order.')
                  : (lang === 'vi'
                    ? 'Số tiền sẽ được ký quỹ Escrow an toàn. Bạn có muốn tiến hành thanh toán ngay?'
                    : 'The amount will be held in Escrow safely. Do you wish to proceed?')}
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPayConfirmModal(false)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isPaymentDeadlinePassed ? (lang === 'vi' ? 'Đóng' : 'Close') : (lang === 'vi' ? 'Hủy' : 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handlePayFee}
                  disabled={actionLoading || isPaymentDeadlinePassed}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-[#c34c36] hover:opacity-95 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{isPaymentDeadlinePassed ? (lang === 'vi' ? 'Đã Hết Hạn' : 'Expired') : (lang === 'vi' ? 'Xác nhận thanh toán' : 'Confirm Payment')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tạo Vận Đơn Vận Chuyển Lalamove (dành cho Người bán) */}
        {showShipmentModal && isSeller && isAtCenter && (
          <CreateShipmentModal
            order={escrowOrderForShipment}
            onClose={() => setShowShipmentModal(false)}
            onShipmentCreated={() => {
              setShowShipmentModal(false);
              setShipmentState('created');
              void onRefreshOrder(order.id);
            }}
            lang={lang}
          />
        )}

        {/* Modal Hẹn Lịch Đón KTV (dành cho Người bán khi kiểm định tại nhà) */}
        {showScheduleModal && (
          <ScheduleAppointmentModal
            orderId={order.id}
            orderCode={order.id}
            linkedOrderId={(order as any).linkedOrderId || order.id}
            inspectionOrderId={order.id}
            isOpen={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSuccess={() => {
              setShowScheduleModal(false);
              void onRefreshOrder(order.id);
            }}
            lang={lang}
            readOnly={!isSeller}
            initialScheduledAt={order.appointmentScheduledAt || currentAppt?.scheduledAt || undefined}
            initialNote={(order as any).appointmentNote || currentAppt?.note || undefined}
            order={order}
          />
        )}
      </div>
    </div>
  );
};


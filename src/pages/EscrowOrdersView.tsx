import React, { useState, useMemo } from 'react';
import { EscrowOrder, Language, UserRole } from '../types';
import { translations, formatVND } from '../utils/translations';
import {
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Layers,
  ChevronRight,
  Package,
  Store,
  Eye,
  X,
  Search,
  RotateCcw,
  Calendar,
  MapPin,
  QrCode,
  Shield,
  ArrowRight,
  User,
  Phone,
  Printer,
  MessageSquare,
  Wallet,
  Receipt,
  Check,
  Star,
  Award
} from 'lucide-react';
import { ProductReviewModal } from '../components/modals/ProductReviewModal';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { reviewService } from '../data/mockReviews';
import { OrderTrackingModal } from '../components/modals/OrderTrackingModal';
import { CreateShipmentModal } from '../components/modals/CreateShipmentModal';
import { ShippingLabelModal } from '../components/modals/ShippingLabelModal';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { ShipmentBackend, OrderSettlementDTO } from '../types';
import { orderService } from '../services/orderService';
import { inspectorService } from '../services/inspectorService';

interface EscrowOrdersViewProps {
  orders: EscrowOrder[];
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  onMarkShipped?: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
  onRefreshOrders?: () => void;
  lang: Language;
  userRole?: UserRole;
  onOpenChat?: (listing: any, roomId?: string) => void;
}

type OrderFilterTab =
  | 'all'
  | 'awaiting_pickup'
  | 'inspecting'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'disputed';

export const EscrowOrdersView: React.FC<EscrowOrdersViewProps> = ({
  orders,
  onConfirmReceipt,
  onOpenDispute,
  onMarkShipped,
  onCancelOrder,
  onRefreshOrders,
  lang,
  userRole = 'buyer',
  onOpenChat,
}) => {
  const t = translations[lang];
  const isSeller = userRole === 'seller';

  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState<EscrowOrder | null>(null);
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('inspector');
  const [orderSettlement, setOrderSettlement] = useState<OrderSettlementDTO | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [settlementNotSettled, setSettlementNotSettled] = useState(false);

  React.useEffect(() => {
    if (detailModalOrder?.id) {
      setIsLoadingSettlement(true);
      setSettlementNotSettled(false);
      orderService.getOrderSettlement(detailModalOrder.id)
        .then((data) => {
          setOrderSettlement(data);
          setSettlementNotSettled(false);
        })
        .catch(() => {
          setOrderSettlement(null);
          setSettlementNotSettled(true);
        })
        .finally(() => {
          setIsLoadingSettlement(false);
        });
    } else {
      setOrderSettlement(null);
      setSettlementNotSettled(false);
    }
  }, [detailModalOrder]);

  // GHN Shipping Modals state
  const [trackingOrder, setTrackingOrder] = useState<EscrowOrder | null>(null);
  const [createShipmentOrder, setCreateShipmentOrder] = useState<EscrowOrder | null>(null);
  const [activeLabelShipment, setActiveLabelShipment] = useState<{ order: EscrowOrder; shipment: ShipmentBackend } | null>(null);
  const [certificateModalOrder, setCertificateModalOrder] = useState<EscrowOrder | null>(null);
  const [inspectionActionNotice, setInspectionActionNotice] = useState<string | null>(null);

  const handleRespondInspection = async (orderId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await inspectorService.respondRequest(orderId, { action });
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'chấp nhận' : 'từ chối'} đề xuất kiểm định thành công!`);
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Không thể phản hồi yêu cầu kiểm định');
    }
  };

  const handlePayInspectionFee = async (orderId: string) => {
    try {
      await inspectorService.payInspectionFee(orderId);
      setInspectionActionNotice('Đã thanh toán phần phí kiểm định thành công!');
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Không thể thanh toán phí kiểm định');
    }
  };

  // Review & Seller Trust Modal state
  const [reviewModalOrder, setReviewModalOrder] = useState<EscrowOrder | null>(null);
  const [schedulingOrder, setSchedulingOrder] = useState<EscrowOrder | null>(null);
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('secondlife_reviewed_order_ids');
      if (saved && saved !== 'undefined' && saved !== 'null' && saved.trim() !== '') {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  const handleReviewSubmit = (reviewData: { rating: number; comment: string; tags: string[]; photos: string[] }) => {
    if (!reviewModalOrder) return;
    reviewService.addReview({
      orderId: reviewModalOrder.id,
      listingId: reviewModalOrder.listingId,
      productName: reviewModalOrder.listing.title,
      sellerId: reviewModalOrder.sellerId,
      sellerName: reviewModalOrder.sellerName,
      buyerId: reviewModalOrder.buyerId,
      buyerName: reviewModalOrder.buyerName,
      rating: reviewData.rating,
      comment: reviewData.comment,
      tags: reviewData.tags,
      photos: reviewData.photos,
      isVerifiedPurchase: true,
      conditionGrade: reviewModalOrder.listing.conditionGrade
    });

    const nextReviewed = Array.from(new Set([...reviewedOrderIds, reviewModalOrder.id]));
    setReviewedOrderIds(nextReviewed);
    try {
      localStorage.setItem('secondlife_reviewed_order_ids', JSON.stringify(nextReviewed));
    } catch {}
    setReviewModalOrder(null);
  };

  // Seller specific state
  const [pickupConfirmedNotice, setPickupConfirmedNotice] = useState<string | null>(null);
  const [shippingLabelOrder, setShippingLabelOrder] = useState<EscrowOrder | null>(null);

  const handleConfirmCourierPickup = (orderId: string) => {
    setPickupConfirmedNotice(`Đã lên lịch thành công! Bưu tá GHTK sẽ đến địa chỉ kho lấy máy #${orderId} giao về Hub trong hôm nay.`);
    setTimeout(() => setPickupConfirmedNotice(null), 5000);
  };

  // Seller metrics
  const pendingEscrowTotal = useMemo(() => {
    return orders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => sum + Math.round(o.itemPriceVnd * 0.975), 0);
  }, [orders]);

  const awaitingPickupCount = orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = orders.filter(
    (o) =>
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      o.escrowStatus === 'HELD_IN_ESCROW'
  ).length;
  const completedPaidCount = orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  // Filter logic based on status tabs
  const filteredOrders = orders.filter((ord) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ord.listing.title.toLowerCase().includes(q);
      const matchId = ord.id.toLowerCase().includes(q);
      const matchSeller = ord.sellerName.toLowerCase().includes(q);
      const matchBuyer = ord.buyerName.toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchSeller && !matchBuyer) return false;
    }

    switch (activeTab) {
      case 'awaiting_pickup':
        return ord.escrowStatus === 'AWAITING_PAYMENT';
      case 'inspecting':
        return (
          ord.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
          ord.escrowStatus === 'INSPECTION_PASSED' ||
          ord.escrowStatus === 'HELD_IN_ESCROW'
        );
      case 'shipping':
        return ord.escrowStatus === 'SHIPPED_TO_BUYER';
      case 'delivered':
        return ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';
      case 'completed':
        return ord.escrowStatus === 'COMPLETED_RELEASED';
      case 'disputed':
        return ord.escrowStatus === 'DISPUTED' || ord.escrowStatus === 'REFUNDED_TO_BUYER';
      case 'all':
      default:
        return true;
    }
  });

  const getTabCount = (tab: OrderFilterTab) => {
    switch (tab) {
      case 'awaiting_pickup':
        return orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
      case 'inspecting':
        return orders.filter(
          (o) =>
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            o.escrowStatus === 'HELD_IN_ESCROW'
        ).length;
      case 'shipping':
        return orders.filter((o) => o.escrowStatus === 'SHIPPED_TO_BUYER').length;
      case 'delivered':
        return orders.filter((o) => o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW').length;
      case 'completed':
        return orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;
      case 'disputed':
        return orders.filter(
          (o) => o.escrowStatus === 'DISPUTED' || o.escrowStatus === 'REFUNDED_TO_BUYER'
        ).length;
      case 'all':
      default:
        return orders.length;
    }
  };

  const getStatusBadge = (status: EscrowOrder['escrowStatus']) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Chờ Bạn Giao Bưu Tá' : 'Chờ Lấy Hàng & Đóng Gói'
                : isSeller ? 'Awaiting Courier Handover' : 'Awaiting Pickup & Packaging'}
            </span>
          </span>
        );
      case 'INSPECTION_IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
          </span>
        );
      case 'INSPECTION_PASSED':
      case 'SHIPPED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
            <Truck className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Đang Giao Tới Người Mua' : 'Đang Giao Hàng Tới Bạn'
                : isSeller ? 'Delivering to Buyer' : 'Delivering to You'}
            </span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Khách Đang Kiểm Máy (48h)' : 'Đã Giao • 48h Kiểm Tra Đối Soát'
                : isSeller ? 'Buyer Review (48h Window)' : 'Delivered • 48h Inspection Window'}
            </span>
          </span>
        );
      case 'COMPLETED_RELEASED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'
                : isSeller ? 'Payout Transferred to Wallet' : 'Completed • Escrow Released'}
            </span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đang Tranh Chấp • Đóng Băng Escrow' : 'Disputed • Escrow Frozen'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  const tabs: { key: OrderFilterTab; label: string }[] = isSeller
    ? [
        { key: 'all', label: lang === 'vi' ? 'Tất cả đơn bán' : 'All Seller Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ giao bưu tá' : 'Awaiting Courier' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao người mua' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Chờ nghiệm thu (48h)' : 'Review (48h)' },
        { key: 'completed', label: lang === 'vi' ? 'Đã nhận tiền' : 'Funds Released' },
        { key: 'disputed', label: lang === 'vi' ? 'Khiếu nại / Trả hàng' : 'Disputes / Returns' },
      ]
    : [
        { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ lấy hàng' : 'Awaiting Pickup' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao hàng' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Đã nhận hàng' : 'Delivered' },
        { key: 'completed', label: lang === 'vi' ? 'Hoàn thành' : 'Completed' },
        { key: 'disputed', label: lang === 'vi' ? 'Trả hàng / Tranh chấp' : 'Disputes / Refunds' },
      ];

  return (
    <div className="space-y-6 pb-16 text-[#24263e]">
      {/* Top Banner: Switch between Buyer and Seller mode */}
      {isSeller ? (
        <div className="space-y-4">
          <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-7 shadow-xl border border-[#24263e]/15 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-[#24263e] text-xs font-bold border border-[#24263e]/15 shadow-xs">
                  <Store className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{lang === 'vi' ? 'Kênh Người Bán SecondLife • Quản Lý Đơn Hàng' : 'SecondLife Seller Center • Order Management'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#24263e] mt-2">
                  {lang === 'vi' ? 'Quản Lý Đơn Bán Hàng & Dòng Tiền Escrow' : 'Seller Orders & Escrow Payouts'}
                </h1>
                <p className="text-xs sm:text-sm text-[#24263e]/80 mt-1 font-semibold">
                  {lang === 'vi'
                    ? 'Theo dõi lịch bưu tá đến kho lấy hàng chuyển về Hub, kết quả kiểm định kỹ thuật và đối soát tiền giải ngân vào ví người bán.'
                    : 'Track courier pickup schedules to Hub, technical inspection results, and automated escrow payouts to seller wallet.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-2 rounded-xl bg-white/80 text-[#24263e] border border-[#24263e]/15 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span>{lang === 'vi' ? 'Bảo Lãnh Escrow' : 'Escrow Protection'}</span>
                </span>
              </div>
            </div>

            {/* Seller Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#24263e]/15">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Tiền Chờ Giải Ngân (Escrow)' : 'Pending Escrow Payout'}
                </div>
                <div className="text-lg sm:text-xl font-black text-[#24263e] mt-0.5">
                  {formatVND(pendingEscrowTotal)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Tự động giải ngân sau giao' : 'Auto-released after delivery'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Cần Giao Bưu Tá (Kho lấy)' : 'Awaiting Courier Pickup'}
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">
                  {awaitingPickupCount} {lang === 'vi' ? 'Đơn' : 'Orders'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Hẹn tài xế Lalamove' : 'Lalamove Delivery'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}
                </div>
                <div className="text-lg sm:text-xl font-black text-purple-600 mt-0.5">
                  {inHubInspectionCount} {lang === 'vi' ? 'Thiết Bị' : 'Items'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Test 48 bước & dán NFC' : '48-step test & NFC seal'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Đã Nhận Tiền Thành Công' : 'Successfully Paid Out'}
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
                  {completedPaidCount} {lang === 'vi' ? 'Đơn' : 'Orders'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Tiền đã cộng vào tài khoản' : 'Credited to balance'}
                </div>
              </div>
            </div>
          </div>

          {pickupConfirmedNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{pickupConfirmedNotice}</span>
            </div>
          )}
        </div>
      ) : (
        /* Buyer Header */
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] text-[#24263e] text-xs font-bold border border-gray-200 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#24263e]" />
            <span>SecondLife Smart Escrow & Multi-Leg Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#24263e] mt-2">
            {lang === 'vi' ? 'Đơn Hàng & Escrow' : 'Orders & Escrow Protection'}
          </h1>
          <p className="text-xs sm:text-sm text-[#24263e]/70">
            {lang === 'vi'
              ? 'Theo dõi hành trình 2 chặng: Người bán → Trung tâm kiểm định → Người mua, biên bản nghiệm thu và ảnh 3 giai đoạn.'
              : 'Multi-leg tracking: Seller → Certified Inspection Hub → Buyer, digital inspection reports, and 3-stage photo logs.'}
          </p>
        </div>
      )}

      {/* Shopee-style Status Tab Bar */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none border-b border-gray-100">
          {tabs.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-[#24263e] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive
                        ? 'bg-[#c34c36]/10 text-[#24263e]'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {/* Active underline indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#c34c36] to-[#fce5da] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Search inside Orders */}
        <div className="p-3 bg-slate-50/60 border-t border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'vi'
                  ? (isSeller ? 'Tìm mã đơn #ORD, tên sản phẩm hoặc tên người mua...' : 'Tìm kiếm theo mã đơn #ORD, tên sản phẩm hoặc người bán...')
                  : (isSeller ? 'Search by #ORD, product title or buyer name...' : 'Search by #ORD, product title or seller...')
              }
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-gray-200 rounded-xl focus:outline-none focus:border-[#c34c36] transition-all"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 bg-gray-200/70 rounded-xl transition cursor-pointer"
            >
              {lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
            </button>
          )}

          {onRefreshOrders && (
            <button
              onClick={() => onRefreshOrders()}
              className="px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-gray-200 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
              title="Làm mới danh sách đơn hàng từ Backend"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#c34c36]" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Đồng bộ Live' : 'Live Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Shopee-style Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-3xl p-12 text-center border border-gray-200 text-[#24263e] shadow-xs">
          <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-base text-[#24263e]">
            {lang === 'vi' ? 'Chưa có đơn hàng nào trong mục này' : 'No orders found in this category'}
          </h3>
          <p className="text-xs text-[#24263e]/70 mt-1 max-w-md mx-auto">
            {lang === 'vi'
              ? `Không tìm thấy đơn hàng nào ở trạng thái này. Bạn có thể chọn tab "${isSeller ? 'Tất cả đơn bán' : 'Tất cả'}" để xem toàn bộ danh sách.`
              : `No orders currently match this status tab. Select "${isSeller ? 'All Seller Orders' : 'All Orders'}" to view all.`}
          </p>
          {onRefreshOrders && (
            <button
              onClick={() => onRefreshOrders()}
              className="mt-4 px-4 py-2 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#fce5da]" />
              <span>{lang === 'vi' ? 'Tải Lại Từ Máy Chủ' : 'Reload from Server'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const sellerNetPayout = Math.round(ord.itemPriceVnd * 0.975);
            return (
              <div
                key={ord.id}
                onClick={() => setDetailModalOrder(ord)}
                className="bg-[#FFFFFF] rounded-2xl border border-gray-200 hover:border-[#c34c36]/50 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                {/* Order Top Bar */}
                <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {isSeller ? (
                      <>
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">
                          {lang === 'vi' ? 'Khách mua:' : 'Buyer:'} {ord.buyerName}
                        </span>
                        {ord.buyerPhone ? (
                          <span className="text-[11px] text-slate-400">({ord.buyerPhone})</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Store className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-900">{ord.sellerName}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSellerReviewsModalData({
                              sellerId: ord.sellerId,
                              sellerName: ord.sellerName
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                          title={lang === 'vi' ? 'Xem điểm uy tín & đánh giá người bán' : 'View seller trust & reviews'}
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>98đ uy tín</span>
                        </button>
                      </>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">#{ord.id}</span>
                    <span className="hidden sm:inline-block text-[11px] text-slate-400">
                      • {new Date(ord.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                    </span>
                  </div>
                  <div>{getStatusBadge(ord.escrowStatus)}</div>
                </div>

                {/* Order Main Body: Product Snippet */}
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={ord.listing.photos.front}
                      alt={ord.listing.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-gray-200 shrink-0 bg-slate-100 group-hover:scale-102 transition-transform"
                    />
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 line-clamp-2 group-hover:text-[#24263e] transition-colors">
                        {ord.listing.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {ord.listing.category}
                        </span>
                        <span>•</span>
                        <span>
                          {lang === 'vi' ? 'Tình trạng:' : 'Condition:'}{' '}
                          <strong className="text-slate-800">{ord.listing.conditionGrade}</strong>
                        </span>
                        <span>•</span>
                        <span>{lang === 'vi' ? 'Số lượng: 1' : 'Qty: 1'}</span>
                      </div>

                      {isSeller ? (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lang === 'vi' ? 'Bưu tá: GHTK Express (Lấy tại kho Seller)' : 'Courier: GHTK Express (Pickup at Seller)'}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Bảo chứng Escrow & Kiểm định Hub' : 'Escrow Protection & Hub Inspected'}</span>
                        </div>
                      )}

                      {/* Inspection Method & Fee Sharing Badge */}
                      {(ord.hasInspectionService || ord.inspectionMethod) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            <span>
                              {ord.inspectionMethod === 'AT_HOME'
                                ? (lang === 'vi' ? 'Kiểm Định Tận Nhà' : 'At-Home Inspection')
                                : (lang === 'vi' ? 'Kiểm Định Tại Hub SecondLife' : 'Hub Inspection')}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span>
                              {ord.inspectionFeeSplit === 'SPLIT_50_50'
                                ? (lang === 'vi' ? 'Chia đôi phí 50/50' : 'Split 50/50')
                                : ord.inspectionFeeSplit === 'SELLER_100'
                                ? (lang === 'vi' ? 'Người bán 100%' : 'Seller 100%')
                                : (lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%')}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Tag */}
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs text-slate-400 block">
                      {isSeller
                        ? (lang === 'vi' ? 'Giá niêm yết bán' : 'Listing Price')
                        : (lang === 'vi' ? 'Đơn giá sản phẩm' : 'Item Price')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {formatVND(ord.itemPriceVnd)}
                    </span>
                  </div>
                </div>

                {/* Order Card Footer: Financial & Actions */}
                <div className="px-4 sm:px-6 py-3.5 bg-slate-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                    {isSeller ? (
                      <>
                        <span className="text-xs text-slate-500">
                          {lang === 'vi' ? 'Thực nhận về ví (Đã trừ 2.5% phí sàn):' : 'Net Payout (after 2.5% platform fee):'}
                        </span>
                        <span className="text-base sm:text-lg font-black text-emerald-600">
                          +{formatVND(sellerNetPayout)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">
                          {lang === 'vi' ? 'Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):' : 'Total (incl. inspection & escrow guarantee):'}
                        </span>
                        <span className="text-base sm:text-lg font-black text-[#24263e]">
                          {formatVND(ord.totalPaidVnd)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Seller Actions */}
                    {isSeller ? (
                      <>
                        {/* Awaiting pickup / In progress: Create GHN Shipment */}
                        {(ord.escrowStatus === 'AWAITING_PAYMENT' || ord.escrowStatus === 'HELD_IN_ESCROW' || ord.escrowStatus === 'INSPECTION_IN_PROGRESS') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateShipmentOrder(ord);
                              }}
                              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Tạo Vận Đơn Lalamove' : 'Create Lalamove'}</span>
                            </button>
                            {onCancelOrder && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancelOrder(ord.id);
                                }}
                                className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
                                title="Hủy đơn hàng"
                              >
                                <X className="w-3.5 h-3.5 inline mr-1" />
                                <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* Lalamove Tracking & Management */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingOrder(ord);
                          }}
                          className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                        </button>

                        {/* Completed: Escrow released notice */}
                        {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'vi' ? 'Đã Giải Ngân Vào Ví' : 'Funds Credited to Wallet'}</span>
                          </span>
                        )}

                        {/* Chat with buyer */}
                        {onOpenChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(ord.listing);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title={lang === 'vi' ? 'Nhắn tin với người mua' : 'Chat with buyer'}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Detail Modal Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalOrder(ord);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#c34c36] text-slate-700 hover:text-[#24263e] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Chi Tiết Đơn' : 'Order Details'}</span>
                        </button>
                      </>
                    ) : (
                      /* Buyer Actions */
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalOrder(ord);
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#c34c36] text-slate-700 hover:text-[#24263e] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Xem Chi Tiết' : 'View Details'}</span>
                        </button>

                        {/* Tracking Lalamove for Buyer */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingOrder(ord);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                        </button>

                        {/* Inspection Certificate Button for Buyer */}
                        {(ord.hasInspectionService || ord.escrowStatus === 'INSPECTION_PASSED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.escrowStatus === 'SHIPPED_TO_BUYER' || ord.escrowStatus === 'COMPLETED_RELEASED') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCertificateModalOrder(ord);
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            title="Xem Giấy Chứng Nhận & Biên Bản Nghiệm Thu Kỹ Thuật Số"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-600" />
                            <span>{lang === 'vi' ? 'Xem Chứng Nhận Kiểm Định' : 'Inspection Certificate'}</span>
                          </button>
                        )}

                        {/* Schedule Inspection Appointment Button */}
                        {(ord.hasInspectionService || ord.escrowStatus === 'HELD_IN_ESCROW' || ord.escrowStatus === 'INSPECTION_IN_PROGRESS') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSchedulingOrder(ord);
                            }}
                            className="px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            title="Lên lịch hẹn ngày giờ kỹ thuật viên đến kiểm định tại nhà"
                          >
                            <Calendar className="w-3.5 h-3.5 text-orange-600" />
                            <span>{lang === 'vi' ? 'Hẹn Giờ Kiểm Định' : 'Schedule Inspect'}</span>
                          </button>
                        )}

                        {/* Awaiting Inspection Proposal Action */}
                        {ord.escrowStatus === 'AWAITING_PAYMENT' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRespondInspection(ord.id, 'ACCEPT');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Chấp nhận đề xuất kiểm định"
                            >
                              <Check className="w-3 h-3" />
                              <span>{lang === 'vi' ? 'Nhận Kiểm Định' : 'Accept Inspect'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRespondInspection(ord.id, 'REJECT');
                              }}
                              className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-[11px] font-bold transition cursor-pointer"
                              title="Từ chối đề xuất kiểm định"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePayInspectionFee(ord.id);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Nộp phí kiểm định độc lập từ Ví"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>{lang === 'vi' ? 'Nộp Phí' : 'Pay Fee'}</span>
                            </button>
                          </div>
                        )}

                        {(ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED' || ord.shippingDeliveredAt) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Xác nhận bạn đã nhận hàng đầy đủ và nghiệm thu sản phẩm? Tiền ký quỹ sẽ được giải ngân cho người bán.')) {
                                onConfirmReceipt(ord.id);
                              }
                            }}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                            title="Xác nhận đã nhận máy an toàn và giải ngân Escrow cho người bán"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Đã Nhận Hàng (Giải Ngân)' : 'Confirm Delivery'}</span>
                          </button>
                        ) : ord.escrowStatus === 'SHIPPED_TO_BUYER' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTrackingOrder(ord);
                            }}
                            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Bưu tá đang giao hàng, bạn có thể kiểm tra định vị bưu kiện"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit'}</span>
                          </button>
                        ) : null}

                        {onCancelOrder && (ord.escrowStatus === 'AWAITING_PAYMENT' || ord.escrowStatus === 'HELD_IN_ESCROW' || ord.escrowStatus === 'INSPECTION_IN_PROGRESS') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelOrder(ord.id);
                            }}
                            className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
                            title="Hủy đơn và hoàn 100% tiền Escrow về ví"
                          >
                            <X className="w-3.5 h-3.5 inline mr-1" />
                            <span>{lang === 'vi' ? 'Hủy Đơn (Hoàn Tiền)' : 'Cancel Order'}</span>
                          </button>
                        )}

                        {ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDispute(ord);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            <span>{lang === 'vi' ? 'Khiếu Nại ❌' : 'Dispute ❌'}</span>
                          </button>
                        )}

                        {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                          <>
                            {reviewedOrderIds.includes(ord.id) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewModalOrder(ord);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{lang === 'vi' ? 'Đã Đánh Giá • Xem lại ❌' : 'Reviewed • View ❌'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewModalOrder(ord);
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#c34c36] text-white text-xs font-black hover:opacity-90 transition cursor-pointer flex items-center gap-1.5 shadow-md animate-pulse"
                              >
                                <Star className="w-3.5 h-3.5 fill-white text-white" />
                                <span>{lang === 'vi' ? '⭐ Đánh Giá Sản Phẩm ❌' : 'Rate & Review ❌'}</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalOrder(ord);
                              }}
                              className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
                            >
                              <span>{lang === 'vi' ? 'Xem Biên Bản Hub' : 'Hub Report'}</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 48h Auto-release notice banner on the order card */}
                {ord.shippingDeliveredAt && ord.escrowStatus !== 'COMPLETED_RELEASED' && ord.escrowStatus !== 'DISPUTED' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        Đã giao thành công lúc {new Date(ord.shippingDeliveredAt).toLocaleString('vi-VN')}
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Hệ thống sẽ <strong>tự động giải ngân</strong> cho người bán sau 48 giờ kể từ khi giao thành công. Người mua có thể nhấn <strong>"Đã Nhận Hàng"</strong> để giải ngân ngay lập tức, hoặc gửi khiếu nại nếu sản phẩm có sai sót.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL: CHI TIẾT ĐƠN HÀNG KHI NGƯỜI DÙNG BẤM VÀO */}
      {detailModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailModalOrder(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FFFFFF] border border-gray-200 p-5 sm:p-7 shadow-2xl text-[#24263e] scrollbar-thin scrollbar-thumb-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-[#24263e]">
                    {lang === 'vi' ? 'Chi Tiết Đơn Hàng' : 'Order Details'} #{detailModalOrder.id}
                  </h2>
                  {getStatusBadge(detailModalOrder.escrowStatus)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-800">{detailModalOrder.sellerName}</strong> • {lang === 'vi' ? 'Người mua:' : 'Buyer:'}{' '}
                  <strong className="text-slate-800">{detailModalOrder.buyerName}</strong> • {lang === 'vi' ? 'Đặt ngày' : 'Ordered on'}{' '}
                  {new Date(detailModalOrder.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                </p>
              </div>

              <button
                onClick={() => setDetailModalOrder(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 pt-5">
              {/* Product Info Card in Modal */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#faf8f5] border border-gray-200">
                <img
                  src={detailModalOrder.listing.photos.front}
                  alt={detailModalOrder.listing.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 truncate">
                    {detailModalOrder.listing.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {detailModalOrder.listing.category} • {lang === 'vi' ? 'Tình trạng:' : 'Condition:'} {detailModalOrder.listing.conditionGrade}
                  </p>
                  <div className="text-sm font-extrabold text-[#24263e] mt-1">
                    {formatVND(detailModalOrder.itemPriceVnd)}
                  </div>
                </div>
              </div>

              {/* Lalamove Shipping & Tracking Action in Detail Modal */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/90 to-slate-50 border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-600 text-white">Lalamove Tracking</span>
                    <span className="text-xs font-bold text-slate-800">
                      {detailModalOrder.shippingQuoteId ? `Mã báo giá: #${detailModalOrder.shippingQuoteId}` : 'Đơn hàng tích hợp Lalamove Tracking'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Phí vận chuyển: <strong className="text-orange-700 font-bold">{formatVND(detailModalOrder.shippingFeeVnd)}</strong> • Địa chỉ giao: <span className="font-medium text-slate-700">{detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTrackingOrder(detailModalOrder);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Tra cứu vận đơn Lalamove</span>
                </button>
              </div>

              {/* 2-Leg Shipping Visualizer */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#24263e]" />
                  <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Leg 1: Seller to Center */}
                  {detailModalOrder.shippingLegs[0] ? (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                          {t.leg1}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#24263e]">
                          {detailModalOrder.shippingLegs[0].carrier} #{detailModalOrder.shippingLegs[0].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0].origin}</span></div>
                        <div>Đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/70">
                        {detailModalOrder.shippingLegs[0].timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đã bàn giao bưu tá'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500">
                      Chặng 1 đang chờ bưu tá phân phối lấy hàng từ nhà người bán.
                    </div>
                  )}

                  {/* Leg 2: Center to Buyer */}
                  {detailModalOrder.shippingLegs[1] ? (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                          {t.leg2}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#24263e]">
                          {detailModalOrder.shippingLegs[1].carrier} #{detailModalOrder.shippingLegs[1].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1].origin}</span></div>
                        <div>Giao đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e] font-medium">
                        {detailModalOrder.shippingLegs[1].timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500 flex items-center justify-center">
                      Chặng 2 sẽ tự động kích hoạt sau khi kiểm định Hub đạt chuẩn.
                    </div>
                  )}
                </div>
              </div>

              {/* Inspection Certificate & Tamper Seal Section */}
              {detailModalOrder.inspectionReport && (
                <div className="rounded-2xl bg-[#faf8f5] p-5 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white flex items-center justify-center">
                        <FileCheck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#24263e]">
                          Biên Bản Giám Định Xác Thực #{detailModalOrder.inspectionReport.id}
                        </h4>
                        <p className="text-xs text-[#24263e]/70">
                          {detailModalOrder.inspectionReport.centerName} • {detailModalOrder.inspectionReport.inspectorName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-[#24263e] text-white">
                        {detailModalOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#24263e] border border-gray-200">
                        Mã Tem NFC: {detailModalOrder.inspectionReport.tamperSealId}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#24263e] bg-[#FFFFFF] p-3 rounded-xl border border-gray-200 italic">
                    "{detailModalOrder.inspectionReport.summaryNotes}"
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(detailModalOrder.inspectionReport.checklistResults || []).slice(0, 4).map((chk) => (
                      <div key={chk.id} className="flex items-center gap-2 bg-[#FFFFFF] p-2 rounded-lg border border-gray-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#24263e] shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-[#24263e]">{chk.category}: </span>
                          <span className="text-[#24263e]/70">{chk.testedValue || 'Đạt'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3-Stage Multi-Version Photo Audit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#24263e]" />
                    <span>{t.multiStageTitle}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-xl text-xs border border-gray-200">
                    <button
                      onClick={() => setActivePhotoStage('listing')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        activePhotoStage === 'listing'
                          ? 'bg-[#24263e] text-white'
                          : 'text-[#24263e]/70'
                      }`}
                    >
                      1. Người bán
                    </button>
                    <button
                      onClick={() => setActivePhotoStage('inspector')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        activePhotoStage === 'inspector'
                          ? 'bg-[#24263e] text-white'
                          : 'text-[#24263e]/70'
                      }`}
                    >
                      2. Kiểm định Hub
                    </button>
                    <button
                      onClick={() => setActivePhotoStage('handover')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        activePhotoStage === 'handover'
                          ? 'bg-[#24263e] text-white'
                          : 'text-[#24263e]/70'
                      }`}
                    >
                      3. Niêm phong giao
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(activePhotoStage === 'listing'
                    ? detailModalOrder.multiStagePhotos.listingPhotos
                    : activePhotoStage === 'inspector'
                    ? detailModalOrder.multiStagePhotos.inspectorPhotos || []
                    : detailModalOrder.multiStagePhotos.handoverPhotos || []
                  ).map((photoUrl, idx) => (
                    <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#faf8f5] border border-gray-200 group">
                      <img
                        src={photoUrl}
                        alt="Stage audit"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute bottom-1.5 left-1.5 bg-[#24263e]/85 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded border border-white/20 font-bold">
                        {activePhotoStage === 'listing' && 'Ảnh rao bán'}
                        {activePhotoStage === 'inspector' && 'Ảnh soi Hub'}
                        {activePhotoStage === 'handover' && 'Ảnh dán tem NFC'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escrow Fee Breakdown */}
              <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
                <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                  {t.orderSummary}
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.itemAmount}:</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.itemPriceVnd)}</span>
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.inspectionFee}:</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.inspectionFeeVnd)}</span>
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.shippingFee} (Vận chuyển Lalamove):</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.shippingFeeVnd)}</span>
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.platformFee}:</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.platformFeeVnd)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-[#24263e]">
                  <span>{t.totalEscrow}:</span>
                  <span className="font-extrabold text-[#24263e]">
                    {formatVND(detailModalOrder.totalPaidVnd)}
                  </span>
                </div>
              </div>

              {/* 48h Auto-release notice banner in Modal */}
              {detailModalOrder.shippingDeliveredAt && detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' && detailModalOrder.escrowStatus !== 'DISPUTED' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Quy Trình Tự Động Giải Ngân Sau 48 Giờ</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Đơn hàng đã được bưu tá xác nhận giao thành công vào lúc <strong>{new Date(detailModalOrder.shippingDeliveredAt).toLocaleString('vi-VN')}</strong>.
                    Theo chính sách bảo vệ người mua của SecondLife, hệ thống sẽ tự động giải ngân cho người bán sau 48 giờ kể từ thời điểm này nếu không có khiếu nại phát sinh.
                  </p>
                </div>
              )}

              {/* Order Settlement Breakdown (Quyết toán giải ngân) */}
              <div className="rounded-2xl p-4 border border-gray-200 bg-[#faf8f5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#24263e]" />
                    <span className="font-bold text-xs uppercase tracking-wide text-[#24263e]">
                      Chi Tiết Quyết Toán Giải Ngân (Settlement)
                    </span>
                  </div>
                  {orderSettlement ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                      ĐÃ QUYẾT TOÁN
                    </span>
                  ) : settlementNotSettled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                      CHƯA GIẢI NGÂN
                    </span>
                  ) : null}
                </div>

                {isLoadingSettlement ? (
                  <div className="py-3 text-center text-xs text-slate-500 font-medium">
                    Đang tải dữ liệu quyết toán từ hệ thống...
                  </div>
                ) : orderSettlement ? (
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-gray-200 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Tiền người bán thực nhận:</span>
                        <span className="text-sm font-black text-emerald-600">
                          {formatVND(orderSettlement.sellerPayout)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 text-[11px]">
                        <span>Hoa hồng sàn SecondLife:</span>
                        <span className="font-bold text-[#c34c36]">
                          {formatVND(orderSettlement.platformCommission)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 text-[11px]">
                        <span>Cước vận chuyển:</span>
                        <span className="font-bold text-slate-800">
                          {formatVND(orderSettlement.shippingFee)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 text-[11px]">
                        <span>Giá cơ sở tính hoa hồng:</span>
                        <span className="font-bold text-slate-800">
                          {formatVND(orderSettlement.commissionBase)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Mã quyết toán: <strong className="font-mono text-slate-700">#{orderSettlement.settlementId}</strong></span>
                      <span>Thời điểm giải ngân: <strong>{new Date(orderSettlement.settledAt).toLocaleString('vi-VN')}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Chưa giải ngân</p>
                    <p className="text-[11px] text-slate-500">
                      Khoản tiền ký quỹ của đơn hàng đang được bảo toàn tại ví trung gian Escrow của hệ thống. Tiền sẽ được chuyển vào ví người bán sau khi người mua xác nhận đã nhận hàng hoặc sau thời hạn 48 giờ.
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
                  detailModalOrder.escrowStatus !== 'DISPUTED' && (
                    <>
                      <button
                        onClick={() => {
                          onConfirmReceipt(detailModalOrder.id);
                          setDetailModalOrder(null);
                        }}
                        className="flex-1 py-3 px-4 bg-[#24263e] hover:bg-black text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.confirmReceipt}</span>
                      </button>

                      <button
                        onClick={() => {
                          onOpenDispute(detailModalOrder);
                          setDetailModalOrder(null);
                        }}
                        className="py-3 px-4 bg-white hover:bg-gray-100 text-[#24263e] border border-[#24263e]/30 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-4 h-4 text-[#24263e]" />
                        <span>{t.openDispute} ❌</span>
                      </button>
                    </>
                  )}

                <button
                  onClick={() => setDetailModalOrder(null)}
                  className="py-3 px-5 bg-white hover:bg-gray-100 text-[#24263e] border border-[#24263e]/20 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lalamove Order Tracking Modal */}
      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          isSeller={isSeller}
          onClose={() => setTrackingOrder(null)}
          lang={lang}
          onConfirmReceipt={onConfirmReceipt}
          onOpenLabelModal={(shipment) => setActiveLabelShipment({ order: trackingOrder, shipment })}
          onOrderUpdated={onRefreshOrders}
        />
      )}

      {/* Lalamove Create Shipment Modal */}
      {createShipmentOrder && (
        <CreateShipmentModal
          order={createShipmentOrder}
          onClose={() => setCreateShipmentOrder(null)}
          lang={lang}
          onShipmentCreated={(shipment) => {
            setCreateShipmentOrder(null);
            onRefreshOrders?.();
            setActiveLabelShipment({ order: createShipmentOrder, shipment });
          }}
        />
      )}

      {/* Lalamove Official Shipping Label Modal */}
      {activeLabelShipment && (
        <ShippingLabelModal
          order={activeLabelShipment.order}
          shipment={activeLabelShipment.shipment}
          onClose={() => setActiveLabelShipment(null)}
          lang={lang}
        />
      )}

      {/* Product Review Modal for Customer (Requirement 1) */}
      {reviewModalOrder && (
        <ProductReviewModal
          order={reviewModalOrder}
          isOpen={!!reviewModalOrder}
          onClose={() => setReviewModalOrder(null)}
          onSubmitReview={handleReviewSubmit}
          lang={lang}
        />
      )}

      {/* Seller Reviews & Trust Modal for Buyer (Requirements 2 & 3) */}
      {sellerReviewsModalData && (
        <SellerReviewsModal
          sellerId={sellerReviewsModalData.sellerId}
          sellerName={sellerReviewsModalData.sellerName}
          isOpen={!!sellerReviewsModalData}
          onClose={() => setSellerReviewsModalData(null)}
          lang={lang}
        />
      )}
      {/* Digital Inspection Certificate Modal */}
      {certificateModalOrder && (
        <DigitalInspectionCertificateModal
          order={certificateModalOrder}
          onClose={() => setCertificateModalOrder(null)}
          lang={lang}
        />
      )}

      {/* Schedule Inspection Appointment Modal */}
      {schedulingOrder && (
        <ScheduleAppointmentModal
          orderId={schedulingOrder.id}
          orderCode={schedulingOrder.id.slice(0, 8)}
          isOpen={!!schedulingOrder}
          onClose={() => setSchedulingOrder(null)}
          onSuccess={() => {
            onRefreshOrders?.();
          }}
          lang={lang}
        />
      )}
    </div>
  );
};

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
  Layers,
  Sparkles,
  ChevronRight,
  Wallet,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../services/inspectorService';
import { walletService, WalletBackend } from '../services/walletService';
import { saveScopedLocalNotification } from '../utils/notificationStorage';

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

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');

  // Tab state for report view
  const [activeReportTab, setActiveReportTab] = useState<'checklist' | 'media' | 'verdict'>('checklist');

  // Load backend inspection order details & wallet
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (effectiveOrderId) {
          const dto = await inspectorService.getOrder(effectiveOrderId).catch(() => null);
          if (isMounted && dto) {
            setInspectionDto(dto);
          }
        }
        const w = await walletService.getMyWallet().catch(() => null);
        if (isMounted && w) setWallet(w);
      } catch (err) {
        console.warn('Failed to load inspection order details:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [effectiveOrderId]);

  // Status & Role Resolution
  const backendStatus = String(inspectionDto?.status || (order as any)?.backendStatus || order?.status || '').toUpperCase();
  const escrowStatus = String(order?.escrowStatus || '').toUpperCase();

  const isPassed = inspectionDto?.status === 'PASSED' || escrowStatus === 'INSPECTION_PASSED' || backendStatus === 'PASSED';
  const isFailed = inspectionDto?.status === 'FAILED' || escrowStatus === 'INSPECTION_FAILED' || backendStatus === 'FAILED';
  const isInspecting = escrowStatus === 'INSPECTION_IN_PROGRESS' || backendStatus === 'INSPECTING';
  const isPending = !isPassed && !isFailed && !isInspecting;

  const currentUserId = String(currentUser?.id || '').trim().toLowerCase();
  const currentUserName = String(currentUser?.name || (currentUser as any)?.fullName || '').trim().toLowerCase();
  const currentUserEmail = String(currentUser?.email || '').trim().toLowerCase();

  const orderSellerId = String(order?.sellerId || order?.listing?.sellerId || (order?.listing as any)?.userId || (order?.listing as any)?.user?.id || inspectionDto?.sellerId || '').trim().toLowerCase();
  const orderSellerName = String(order?.sellerName || order?.listing?.sellerName || (order?.listing as any)?.seller?.name || (order?.listing as any)?.user?.fullName || inspectionDto?.sellerName || '').trim().toLowerCase();
  const orderSellerEmail = String((order as any)?.sellerEmail || (order?.listing as any)?.sellerEmail || (order?.listing as any)?.user?.email || inspectionDto?.sellerEmail || '').trim().toLowerCase();

  const isRoleSeller = (userRole && userRole.toLowerCase() === 'seller') ||
    String(currentUser?.role || '').toLowerCase() === 'seller' ||
    (Array.isArray((currentUser as any)?.roles) && (currentUser as any).roles.some((r: string) => String(r).toUpperCase().includes('SELLER')));

  const isUserSeller = Boolean(
    isRoleSeller ||
    (currentUserId && orderSellerId && currentUserId === orderSellerId) ||
    (currentUserEmail && orderSellerEmail && currentUserEmail === orderSellerEmail) ||
    (currentUserName && orderSellerName && (
      currentUserName === orderSellerName ||
      orderSellerName.includes(currentUserName) ||
      currentUserName.includes(orderSellerName)
    ))
  );

  // Merge data between backend DTO and frontend order prop
  const postTitle = inspectionDto?.postTitle || order?.listing?.title || 'Thiết bị công nghệ / gia dụng';
  const postPrice = inspectionDto?.finalItemPrice || inspectionDto?.postPrice || order?.listing?.priceVnd || order?.itemPriceVnd || 0;
  const postImage = inspectionDto?.postImageUrl || inspectionDto?.postImageUrls?.[0] || order?.listing?.photos?.front || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';
  const centerName = (inspectionDto as any)?.centerName || order?.inspectionCenterName || 'Trung Tâm Giám Định SecondLife Hub Lab';
  const inspectorName = isPassed || isFailed || isInspecting
    ? (inspectionDto?.inspectorName || order?.inspectionReport?.inspectorName || 'Kỹ Thuật Viên Trưởng SecondLife')
    : 'Chưa phân công KTV';
  const tamperSealId = isPassed
    ? (inspectionDto?.tamperSealId || order?.inspectionReport?.tamperSealId || `SL-SEAL-${(effectiveOrderId || '').slice(0, 6).toUpperCase()}`)
    : 'Chưa dán tem (Chờ nghiệm thu)';
  const conditionGrade = isPassed
    ? (inspectionDto?.conditionGrade || order?.listing?.conditionGrade || 'Like New')
    : (isFailed ? 'Không Đạt' : 'Chờ thẩm định');
  const conditionScore = isPassed
    ? (inspectionDto?.conditionScore || order?.inspectionReport?.conditionScore || null)
    : null;
  const inspectionFeePaid = inspectionDto?.buyerFeeShare || order?.inspectionFeeVnd || 120000;
  const shippingFeePaid = inspectionDto?.shippingFee || order?.shippingFeeVnd || 30000;
  const finalPriceToPay = postPrice;

  // Countdown timer for 6 hours final payment window based on backend finalPaymentDeadline
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 6,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!isPassed) return;
    const calculateTimeRemaining = () => {
      if (!inspectionDto?.finalPaymentDeadline) {
        return { hours: 6, minutes: 0, seconds: 0, isExpired: false };
      }
      const deadlineMs = new Date(inspectionDto.finalPaymentDeadline).getTime();
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
  }, [inspectionDto?.finalPaymentDeadline, isPassed]);

  // Parse checklist results - TUYỆT ĐỐI KHÔNG dùng mock data khi chưa kiểm định
  const checklistItems = useMemo(() => {
    const jsonStr = inspectionDto?.checklistResultJson || (order?.inspectionReport as any)?.checklistResultJson || (order?.inspectionReport as any)?.checklistResults;
    if (jsonStr) {
      try {
        const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, idx: number) => ({
            id: String(item.itemId || idx),
            title: item.itemTitle || item.name || `Hạng mục ${idx + 1}`,
            status: item.isPassed !== false && item.passed !== false ? 'PASSED' : 'FAILED',
            note: item.inspectorNote || item.note || 'Đạt tiêu chuẩn kỹ thuật',
          }));
        }
      } catch {}
    }

    // Nếu chưa kiểm định thực tế thì danh sách rỗng, để giao diện hiển thị trạng thái đang chờ
    return [];
  }, [inspectionDto, order?.inspectionReport]);

  // Handle Confirm Final Purchase
  const handleConfirmPurchase = async () => {
    setIsSubmitting(true);
    try {
      if (effectiveOrderId) {
        await inspectorService.confirmPurchase(effectiveOrderId);
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
        actionUrl: '/orders',
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
    setIsSubmitting(true);
    try {
      const fullReason = `${selectedRejectReason}${customRejectNote ? `: ${customRejectNote}` : ''}`;
      if (effectiveOrderId) {
        await inspectorService.rejectPurchase(effectiveOrderId, fullReason);
      }

      // Update local storage order status
      try {
        const recentStr = localStorage.getItem('recent_placed_orders');
        if (recentStr) {
          const list: EscrowOrder[] = JSON.parse(recentStr);
          const updated = list.map(o => o.id === effectiveOrderId ? {
            ...o,
            escrowStatus: 'REFUNDED_TO_BUYER' as const,
            backendStatus: 'CANCELLED' as any,
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
        message: `Khách hàng đã quyết định từ chối mua tiếp sản phẩm "${postTitle}" sau khi xem kết quả kiểm định. Lý do: ${fullReason}. Trung tâm sẽ đóng gói hoàn trả sản phẩm về cho bạn.`,
        type: 'INSPECTION' as const,
        referenceId: effectiveOrderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: '/orders',
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
        message: `Bạn đã từ chối nhận mua sản phẩm "${postTitle}". Khoản tạm giữ tiền hàng sẽ được giải phóng hoàn lại ví cho bạn.`,
        type: 'INSPECTION' as const,
        referenceId: effectiveOrderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: '/orders',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(buyerNotice, currentUser?.id || order?.buyerId, 'buyer');

      setAlertNotice({
        type: 'success',
        message: 'Đã gửi thông báo từ chối mua tiếp tới Người bán. Sản phẩm sẽ được niêm phong và bưu tá hoàn trả về địa chỉ người bán an toàn.',
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

  const currentWalletBal = wallet?.balance ?? 0;
  const isWalletSufficient = currentWalletBal >= finalPriceToPay;

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
                {isFailed && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-600" />
                    <span>KẾT QUẢ: KHÔNG ĐẠT (FAILED)</span>
                  </span>
                )}
                {isInspecting && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-600 animate-spin" />
                    <span>ĐANG THẨM ĐỊNH TẠI HUB/TẠI NHÀ</span>
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
          {isPassed && !isUserSeller && (
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
        {isPassed && !isUserSeller ? (
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
                  className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/25 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <XCircle className="w-4 h-4 text-red-300" />
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
        ) : isUserSeller ? (
          /* Banner thông báo dành riêng cho Người bán */
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-800 via-indigo-900 to-[#24263e] text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/30">
                <Store className="w-3.5 h-3.5 text-indigo-300" />
                <span>Kênh Người Bán • Theo Dõi Đơn Kiểm Định</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {isPassed
                  ? 'Sản phẩm đã được KTV kiểm định ĐẠT CHUẨN!'
                  : isFailed
                  ? 'Sản phẩm kiểm định không đạt tiêu chuẩn kỹ thuật'
                  : 'Sản phẩm đang trong tiến trình kiểm định'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl">
                {isPassed
                  ? 'Khách mua đang có tối đa 6 giờ để xem biên bản kỹ thuật và thanh toán tiền hàng (Giai đoạn 2). Sau khi khách thanh toán xong, hệ thống sẽ mở nút để bạn bàn giao sản phẩm cho tài xế.'
                  : isFailed
                  ? 'Đơn hàng kiểm định không đạt. Sản phẩm sẽ được thu xếp hoàn trả về địa chỉ của bạn.'
                  : 'Kỹ thuật viên đang tiếp nhận và kiểm định máy. Vui lòng theo dõi cập nhật biên bản trên hệ thống.'}
              </p>
            </div>
          </div>
        ) : (
          /* Banner thông báo dành cho Người mua khi CHƯA CÓ KẾT QUẢ ĐẠT */
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-[#24263e] text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/30">
                <Clock className="w-3.5 h-3.5 text-amber-200" />
                <span>{isInspecting ? 'Đang Kiểm Định Kỹ Thuật' : 'Chờ Tiếp Nhận Thẩm Định'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {isInspecting
                  ? 'Kỹ thuật viên đang kiểm định thiết bị thực tế'
                  : 'Đang chờ Người bán xác nhận & KTV tiếp nhận máy'}
              </h2>
              <p className="text-xs sm:text-sm text-amber-50 leading-relaxed max-w-3xl">
                Bạn đã hoàn tất nộp cọc Giai đoạn 1 (phí kiểm định & vận chuyển). Tiền sản phẩm ({formatVND(finalPriceToPay)}) vẫn được giữ an toàn. Bạn chỉ cần quyết định mua tiếp sau khi Kỹ thuật viên kiểm tra xong và xuất biên bản ĐẠT CHUẨN.
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
                <img
                  src={postImage}
                  alt={postTitle}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sản phẩm thẩm định</span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug line-clamp-2">
                    {postTitle}
                  </h3>
                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-600">
                    <span>Giá niêm yết: <strong className="text-slate-900 font-extrabold">{formatVND(postPrice)}</strong></span>
                    <span>•</span>
                    <span>Tình trạng: <strong className="text-emerald-700 font-bold">{conditionGrade}</strong></span>
                  </div>
                  {order?.sellerName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Người bán: <strong className="text-slate-700">{order.sellerName}</strong></span>
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

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">Tem niêm phong QR</span>
                    <span className="font-mono font-bold text-slate-900 block truncate">{tamperSealId}</span>
                    <span className="text-[10px] text-emerald-700 font-bold">Trạng thái: INTACT (Nguyên seal)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comprehensive Checklist Tabs */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#c34c36]" />
                  <h4 className="text-sm font-black text-slate-900">Chi Tiết Biên Bản Kỹ Thuật (Điểm: {conditionScore}/100)</h4>
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
                          ? 'Đơn hàng đang chờ người bán xác nhận và điều phối Kỹ thuật viên tiếp nhận máy. Sau khi KTV thực hiện kiểm tra thực tế, chi tiết từng hạng mục sẽ hiển thị tại đây.'
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
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-900">{chk.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                            {chk.note}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase shrink-0">
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
                      "{inspectionDto?.note || order?.inspectionReport?.summaryNotes || (isPassed ? 'Thiết bị đạt toàn bộ tiêu chuẩn kỹ thuật sau khi kiểm định.' : isFailed ? 'Thiết bị không đạt yêu cầu kiểm định.' : 'Chưa có nhận xét kiểm định từ kỹ thuật viên.')}"
                    </blockquote>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Độ nguyên bản</span>
                      <strong className="text-sm font-black text-slate-900">{isPassed ? 'Đạt chuẩn' : 'Chờ kiểm định'}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Tình trạng pin</span>
                      <strong className="text-sm font-black text-emerald-600">{isPassed ? 'Đạt chuẩn' : 'Chờ kiểm định'}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Điểm đánh giá</span>
                      <strong className="text-sm font-black text-[#c34c36]">{conditionScore ? `${conditionScore}/100` : 'Chưa có'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Media & Video proof */}
              {activeReportTab === 'media' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-[#c34c36]" />
                        <span>Video quá trình tháo máy & kiểm định kỹ thuật</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">1080p Full HD</span>
                    </div>
                    <div className="aspect-video rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden group">
                      <img
                        src={postImage}
                        alt="Video Thumbnail"
                        className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xs"
                      />
                      <div className="relative z-10 w-12 h-12 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition cursor-pointer shadow-lg border border-white/40">
                        <div className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-12 border-l-white ml-1" />
                      </div>
                      <span className="relative z-10 mt-3 text-xs font-semibold text-slate-200">
                        Bấm để xem video mở seal và kiểm tra bo mạch (Lưu trữ an toàn 14 ngày)
                      </span>
                    </div>
                  </div>
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

              {/* Stage 1: Already paid upfront */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Giai đoạn 1 (Đã trả trước lúc đặt):</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    ĐÃ NỘP VÍ
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-600 pl-5">
                  <div className="flex justify-between">
                    <span>Phí kiểm định kỹ thuật:</span>
                    <span className="font-semibold text-slate-800">{formatVND(inspectionFeePaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phí vận chuyển Lalamove:</span>
                    <span className="font-semibold text-slate-800">{formatVND(shippingFeePaid)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-bold text-slate-800">
                    <span>Tổng cọc giai đoạn 1:</span>
                    <span className="text-emerald-700">{formatVND(inspectionFeePaid + shippingFeePaid)}</span>
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
                    isPassed && !isUserSeller
                      ? 'bg-amber-100 text-amber-900 animate-pulse'
                      : isUserSeller
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isPassed
                      ? (isUserSeller ? 'CHỜ NGƯỜI MUA CHỐT' : 'CHỜ BẠN DUYỆT')
                      : (isUserSeller ? 'CHỜ KTV KIỂM ĐỊNH' : 'CHƯA MỞ THANH TOÁN')}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-700 pl-5">
                  <div className="flex justify-between">
                    <span>Tiền sản phẩm:</span>
                    <span className="font-bold text-slate-900">{formatVND(finalPriceToPay)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phí giao tận tay (chiều 2):</span>
                    <span className="font-semibold text-emerald-700">Miễn phí (Tài xế Hub giao)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-amber-200/80 font-black text-sm text-[#24263e]">
                    <span>Tổng tiền thanh toán giai đoạn 2:</span>
                    <span className="text-base font-black text-[#c34c36]">{formatVND(finalPriceToPay)}</span>
                  </div>
                </div>
              </div>

              {/* Wallet Balance Status (chỉ hiện cho người mua khi đã Đạt và cần thanh toán) */}
              {!isUserSeller && isPassed && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold">Số dư Ví SecondLife</span>
                      <span className="font-mono font-bold text-slate-900">{formatVND(currentWalletBal)}</span>
                    </div>
                  </div>
                  {isWalletSufficient ? (
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Đủ số dư
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Thiếu {formatVND(finalPriceToPay - currentWalletBal)}
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
                {isUserSeller ? (
                  /* 1. GÓC NHÌN NGƯỜI BÁN: Tuyệt đối không có nút mua hay thanh toán */
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                      <Store className="w-4 h-4 text-indigo-600" />
                      <span>Góc Nhìn Người Bán</span>
                    </div>
                    <p className="text-xs text-indigo-800 leading-relaxed">
                      {isPassed
                        ? 'Sản phẩm của bạn đã được KTV kiểm định ĐẠT CHUẨN. Khách mua đang có tối đa 6 giờ để thanh toán tiền sản phẩm (GĐ 2). Khi khách hoàn tất, hệ thống sẽ mở nút Giao Hàng để bạn chuyển cho tài xế.'
                        : isFailed
                        ? 'Sản phẩm kiểm định không đạt tiêu chuẩn kỹ thuật. Đơn hàng đã dừng và tiền cọc giai đoạn 1 đã được hoàn theo quy định.'
                        : 'Sản phẩm đang trong quá trình tiếp nhận & kiểm định thực tế. Bạn không thể tự mua lại sản phẩm của chính mình.'}
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-[#24263e] hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Quay Lại Quản Lý Đơn Bán Hàng</span>
                    </button>
                  </div>
                ) : !isPassed ? (
                  /* 2. GÓC NHÌN NGƯỜI MUA KHI CHƯA ĐẠT: Không cho bấm thanh toán sớm */
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Chưa Có Quyết Định Mua (Chờ KTV Hoàn Tất Thẩm Định)</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {isFailed
                        ? 'Sản phẩm không đạt chuẩn kiểm định. Đơn hàng đã kết thúc và tiền cọc giai đoạn 1 đã được hoàn về ví Escrow của bạn.'
                        : 'Sản phẩm chưa có biên bản thẩm định đạt từ Kỹ thuật viên. Nút thanh toán tiền mua hàng (Giai đoạn 2) sẽ tự động mở khi KTV kiểm tra xong và xuất biên bản ĐẠT CHUẨN.'}
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Quay Lại Danh Sách Đơn Hàng</span>
                    </button>
                  </div>
                ) : (
                  /* 3. GÓC NHÌN NGƯỜI MUA KHI ĐÃ ĐẠT: Mở nút chốt mua tiếp hoặc từ chối */
                  <>
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={isSubmitting || timeLeft.isExpired}
                      className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        <span>XÁC NHẬN MUA TIẾP & TRẢ TIỀN SẢN PHẨM</span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-100">
                        Trừ {formatVND(finalPriceToPay)} từ ví Escrow • Khởi tạo giao hàng
                      </span>
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-red-600 hover:border-red-300 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
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
                <span>Số tiền thanh toán:</span>
                <span className="font-extrabold text-[#c34c36] text-sm">{formatVND(finalPriceToPay)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phương thức:</span>
                <span className="font-semibold text-slate-800">Ví SecondLife Escrow</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bằng việc bấm xác nhận, số tiền <strong>{formatVND(finalPriceToPay)}</strong> sẽ được chuyển vào quỹ Escrow bảo lãnh. Trạm kiểm định sẽ đóng gói với tem niêm phong QR và bàn giao bưu tá Lalamove để giao tới địa chỉ của bạn.
            </p>

            {!isWalletSufficient && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold block">Số dư ví không đủ:</span>
                  <span>Cần nạp thêm {formatVND(finalPriceToPay - currentWalletBal)}</span>
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
                  <span>Đã Hết Hạn 6 Giờ</span>
                ) : (
                  <span>Xác Nhận & Thanh Toán</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Purchase Dialog (Notify Seller) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Từ Chối Mua Tiếp & Báo Người Bán</h3>
                <p className="text-xs text-slate-500">Hủy đơn mua hàng sau khi xem kết quả kiểm định</p>
              </div>
            </div>

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
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Hệ thống sẽ gửi thông báo ngay cho Người bán:</strong> Sản phẩm sẽ được Trung tâm đóng gói niêm phong tem hoàn trả và bưu tá sẽ mang hàng hoàn về địa chỉ người bán theo quy chế sàn.
              </p>
            </div>

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
                onClick={handleRejectPurchase}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang gửi thông báo...</span>
                  </>
                ) : (
                  <span>Xác Nhận Từ Chối & Báo Người Bán</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

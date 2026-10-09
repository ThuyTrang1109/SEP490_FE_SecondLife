import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Wallet,
  CheckCircle2,
  Clock,
  Tag,
  Eye,
  Edit3,
  Star,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  XCircle,
  Award,
  Upload,
  Coins,
  History
} from 'lucide-react';
import { Listing, Language } from '../types';
import { formatVND } from '../utils/translations';
import { sellerService, SellerVerificationResponseDto } from '../services/sellerService';
import { sellerCreditService, CreditBalanceResponseDto, CreditLedgerResponseDto } from '../services/sellerCreditService';
import { mediaService } from '../services/mediaService';
import { postService } from '../services/postService';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';

interface SellerDashboardViewProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  onCreateListing: (draft?: Listing) => void;
  onViewOrders?: () => void;
  lang: Language;
}

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  listings,
  onSelectListing,
  onCreateListing,
  onViewOrders,
  lang,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'pending' | 'rejected' | 'reserved' | 'sold'>('ALL');
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [bankName, setBankName] = useState('Vietcombank - Ngân hàng TMCP Ngoại Thương Việt Nam');
  const [accountNumber, setAccountNumber] = useState('10298839201');
  const [accountHolder, setAccountHolder] = useState('NGUYEN MINH TUAN');
  const [payoutAmount, setPayoutAmount] = useState<number>(42800000);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [isSellerReviewsOpen, setIsSellerReviewsOpen] = useState(false);

  // Seller Verification State
  const [myVerification, setMyVerification] = useState<SellerVerificationResponseDto | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [resubmitFrontUrl, setResubmitFrontUrl] = useState('');
  const [resubmitBackUrl, setResubmitBackUrl] = useState('');
  const [resubmitSelfieUrl, setResubmitSelfieUrl] = useState('');
  const [resubmitDocNum, setResubmitDocNum] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [resubmitMsg, setResubmitMsg] = useState<string | null>(null);

  // Credit Balance & Ledger State
  const [creditBalance, setCreditBalance] = useState<CreditBalanceResponseDto | null>(null);
  const [isCreditLedgerOpen, setIsCreditLedgerOpen] = useState(false);
  const [creditLedgerItems, setCreditLedgerItems] = useState<CreditLedgerResponseDto[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Real Backend Posts State
  const [myServerPosts, setMyServerPosts] = useState<Listing[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const fetchSellerData = React.useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      sellerService.getMyVerification()
        .then((ver) => {
          if (ver) {
            setMyVerification(ver);
            setResubmitDocNum(ver.documentNumber || '');
            setResubmitFrontUrl(ver.documentFrontUrl || '');
            setResubmitBackUrl(ver.documentBackUrl || '');
            setResubmitSelfieUrl(ver.selfieUrl || '');
          }
        })
        .catch(() => {});

      sellerCreditService.getCredits()
        .then((bal) => {
          if (bal) setCreditBalance(bal);
        })
        .catch(() => {});

      const res = await postService.getMyPosts(0, 50);
      const posts = (res as any)?.content || (res as any)?.data || (Array.isArray(res) ? res : []);
      if (posts && posts.length > 0) {
        const mapped: Listing[] = posts.map((p: any) => {
          const rawImages: string[] = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
            ? p.imageUrls
            : (p.imageUrl ? [p.imageUrl] : []);
          const fallbackImage = 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800';
          const primaryImage = rawImages[0] || fallbackImage;

          return {
            id: p.id || `post-${Date.now()}`,
            title: p.title || 'Thiết bị gia dụng SecondLife',
            category: (p.category || 'Tủ lạnh & Tủ đông') as any,
            brand: p.brand || 'SecondLife',
            model: p.model || 'Model',
            purchaseYear: 2024,
            priceVnd: Number(p.price || p.aiSuggestedPrice || 0),
            originalPriceVnd: Number(p.aiSuggestedPrice || p.price || 0),
            conditionGrade: (p.itemCondition || 'Like New') as any,
            declaredConditionText: p.itemCondition || 'Tình trạng tốt',
            description: p.description || p.aiDescription || 'Đã qua thẩm định SecondLife.',
            location: 'Việt Nam',
            sellerId: p.user?.id || p.userId || 'me',
            sellerName: p.user?.fullName || 'Tôi',
            sellerRating: 5.0,
            sellerCompletedOrders: 0,
            sellerVerified: true,
            status: (p.status === 'ACTIVE' ? 'active' : p.status === 'DRAFT' ? 'draft' : 'reserved') as any,
            backendStatus: p.status,
            rejectionReason: p.rejectionReason,
            createdAt: p.createdAt || new Date().toISOString(),
            isInspectionGuaranteed: true,
            requiresInspection: Number(p.price || 0) > 5000000,
            photos: {
              front: rawImages[0] || primaryImage,
              back: rawImages[1] || primaryImage,
              screenOrDetails: rawImages[2] || primaryImage,
              accessoriesOrBox: rawImages[3] || primaryImage,
              serialOrReceipt: rawImages[4] || primaryImage,
            },
            photoGallery: rawImages.length > 0 ? rawImages : [primaryImage],
          };
        });
        setMyServerPosts(mapped);
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu người bán từ server:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchSellerData();
  }, [fetchSellerData]);

  const handleOpenCreditLedger = async () => {
    setIsCreditLedgerOpen(true);
    setIsLoadingLedger(true);
    try {
      const res = await sellerCreditService.getLedger(0, 30);
      const items = (res as any)?.content || (res as any)?.data || (Array.isArray(res) ? res : []);
      setCreditLedgerItems(items);
    } catch (err) {
      console.warn('Lỗi lấy sổ cái credit:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'front' | 'back' | 'selfie') => {
    try {
      setIsUploading(true);
      const res = await mediaService.uploadImage(file, 'ekyc-resubmit');
      if (type === 'front') setResubmitFrontUrl(res.url);
      else if (type === 'back') setResubmitBackUrl(res.url);
      else setResubmitSelfieUrl(res.url);
    } catch (err: any) {
      alert('Tải ảnh thất bại: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myVerification?.id) return;
    try {
      setIsUploading(true);
      const updated = await sellerService.resubmitVerification(myVerification.id, {
        documentFrontUrl: resubmitFrontUrl,
        documentBackUrl: resubmitBackUrl,
        selfieUrl: resubmitSelfieUrl,
      });
      setMyVerification(updated);
      setResubmitMsg('Đã nộp lại hồ sơ eKYC thành công. Quản trị viên sẽ xem xét duyệt lại hồ sơ của bạn.');
      setIsResubmitModalOpen(false);
    } catch (err: any) {
      setResubmitMsg('Nộp lại thất bại: ' + (err.message || 'Đã có lỗi xảy ra'));
    } finally {
      setIsUploading(false);
    }
  };

  // Merge server-loaded posts with listings props, prioritizing server posts
  const combinedListings = React.useMemo(() => {
    const list = [...myServerPosts];
    const existingIds = new Set(myServerPosts.map(p => p.id));
    for (const item of listings) {
      if (!existingIds.has(item.id)) {
        list.push(item);
      }
    }
    return list;
  }, [myServerPosts, listings]);

  const filteredListings = combinedListings.filter((l) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'pending') {
      return l.backendStatus === 'PENDING' || l.backendStatus === 'PENDING_INSPECTION' || l.status === 'draft';
    }
    if (filterStatus === 'rejected') {
      return l.backendStatus === 'REJECTED';
    }
    if (filterStatus === 'active') {
      return l.backendStatus === 'ACTIVE' || l.status === 'active';
    }
    return l.status === filterStatus;
  });

  const totalEarnings = 42800000;
  const pendingEscrow = 18500000;

  const handleRequestPayout = () => {
    setIsPayoutModalOpen(false);
    setPayoutSuccessMsg(
      lang === 'vi'
        ? `Đã gửi lệnh rút ${formatVND(payoutAmount)} về tài khoản ${accountHolder} (${bankName.split('-')[0]}). Tiền sẽ về tài khoản trong 1-3 phút!`
        : `Withdrawal request for ${formatVND(payoutAmount)} sent to ${accountHolder} (${bankName.split('-')[0]}). Funds will arrive in 1-3 minutes!`
    );
    setTimeout(() => setPayoutSuccessMsg(null), 6000);
  };

  return (
    <div className="space-y-8 pb-16 text-[#24263e]">
      {/* eKYC Verification Status Banner */}
      {myVerification && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
          myVerification.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          myVerification.status === 'NEEDS_REVIEW' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          myVerification.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-50 border-orange-200 text-orange-950' :
          myVerification.status === 'REJECTED' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-3">
            {myVerification.status === 'APPROVED' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : myVerification.status === 'NEEDS_REVIEW' ? (
              <Clock className="w-6 h-6 text-amber-600 shrink-0" />
            ) : myVerification.status === 'RESUBMIT_REQUIRED' ? (
              <AlertCircle className="w-6 h-6 text-orange-600 shrink-0" />
            ) : myVerification.status === 'REJECTED' ? (
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-600 shrink-0 animate-spin" />
            )}
            <div>
              <div className="font-bold text-sm">
                {myVerification.status === 'APPROVED' && (lang === 'vi' ? 'Xác thực thành công! Tài khoản người bán đã kích hoạt.' : 'eKYC Verified! Seller account active.')}
                {myVerification.status === 'NEEDS_REVIEW' && (lang === 'vi' ? 'Đang chờ Quản trị viên duyệt' : 'Pending Admin Review')}
                {(myVerification.status === 'EKYC_PENDING' || myVerification.status === 'SUBMITTED' || myVerification.status === 'PENDING') && (lang === 'vi' ? 'Đang đối soát eKYC' : 'eKYC Verification In Progress')}
                {myVerification.status === 'RESUBMIT_REQUIRED' && (lang === 'vi' ? 'Cần chụp lại ảnh' : 'Resubmission Required')}
                {myVerification.status === 'REJECTED' && (lang === 'vi' ? 'Hồ sơ bị từ chối' : 'Verification Rejected')}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed">
                {myVerification.status === 'APPROVED' && (
                  <span>{lang === 'vi' ? 'Tất cả các tin đăng của bạn sẽ hiển thị huy hiệu Người Bán Uy Tín & Đã Kiểm Định.' : 'All your listings will display the Verified Seller badge.'}</span>
                )}
                {myVerification.status === 'NEEDS_REVIEW' && (
                  <span>{lang === 'vi' ? `Hồ sơ đang được chuyên viên thẩm định thủ công trong 24h. Mã CCCD: ${myVerification.documentNumber}` : `Application is under manual review within 24h. ID: ${myVerification.documentNumber}`}</span>
                )}
                {(myVerification.status === 'EKYC_PENDING' || myVerification.status === 'SUBMITTED' || myVerification.status === 'PENDING') && (
                  <span>{lang === 'vi' ? 'Hệ thống đang kết nối đối soát dữ liệu eKYC tự động. Vui lòng đợi trong giây lát...' : 'Connecting to automated eKYC system...'}</span>
                )}
                {myVerification.status === 'RESUBMIT_REQUIRED' && (
                  <span>{lang === 'vi' ? 'Lý do từ chối tạm thời: ' : 'Reason: '}<strong>{myVerification.rejectionReason || (lang === 'vi' ? 'Ảnh mờ hoặc bị chói sáng.' : 'Photos are blurry or glare.')}</strong></span>
                )}
                {myVerification.status === 'REJECTED' && (
                  <span>{lang === 'vi' ? 'Lý do từ chối: ' : 'Reason: '}<strong>{myVerification.rejectionReason || (lang === 'vi' ? 'Thông tin không hợp lệ.' : 'Information is invalid.')}</strong></span>
                )}
              </div>
            </div>
          </div>

          {myVerification.status === 'RESUBMIT_REQUIRED' && (
            <button
              onClick={() => setIsResubmitModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Chụp / Nộp Lại Ảnh' : 'Resubmit Photos'}</span>
            </button>
          )}

          {myVerification.status === 'REJECTED' && (
            <button
              onClick={() => setIsResubmitModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Tạo Hồ Sơ Xác Thực Mới' : 'Create New Verification'}</span>
            </button>
          )}
        </div>
      )}

      {resubmitMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <span>{resubmitMsg}</span>
          <button onClick={() => setResubmitMsg(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#24263e]/15 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt="Seller Avatar"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#24263e]/20 shadow-md"
              />
              <div
                className="absolute -bottom-1 -right-1 bg-[#24263e] text-white p-1 rounded-full text-xs shadow-xs"
                title={lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#24263e]">
                  Nguyễn Minh Tuấn
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 border border-[#24263e]/15 text-[#24263e] text-[11px] font-bold shadow-xs">
                  <CheckCircle2 className="w-3 h-3 text-[#c34c36]" />
                  {lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#24263e] text-white text-[11px] font-black shadow-xs">
                  <Award className="w-3 h-3 text-amber-300" />
                  98 Điểm Uy Tín • Hạng Kim Cương
                </span>
              </div>
              <p className="text-xs text-[#24263e]/80 mt-1 flex items-center gap-3 font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-[#24263e] font-bold">
                  <Star className="w-3.5 h-3.5 fill-[#c34c36] text-[#c34c36]" />
                  {lang === 'vi' ? '4.9 / 5.0 (48 đánh giá)' : '4.9 / 5.0 (48 reviews)'}
                </span>
                <span>•</span>
                <span>{lang === 'vi' ? '32 đơn thành công' : '32 successful orders'}</span>
                <span>•</span>
                <span>{lang === 'vi' ? 'Tỷ lệ phản hồi 100%' : '100% response rate'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onCreateListing()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white font-black text-xs shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Đăng Bán Đồ Gia Dụng Mới (AI)' : 'Post New Appliance (AI)'}</span>
            </button>
            <button
              onClick={() => setIsSellerReviewsOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>{lang === 'vi' ? 'Xem Đánh Giá Của Khách Hàng (48)' : 'Customer Reviews (48)'}</span>
            </button>
            {onViewOrders && (
              <button
                onClick={onViewOrders}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
              >
                <Clock className="w-4 h-4 text-emerald-800" />
                <span>{lang === 'vi' ? 'Quản Lý Đơn Bán Hàng' : 'Manage Sales Orders'}</span>
              </button>
            )}
            <button
              onClick={() => setIsPayoutModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Wallet className="w-4 h-4 text-[#24263e]" />
              <span>{lang === 'vi' ? 'Rút Tiền Ví Doanh Thu' : 'Withdraw Revenue'}</span>
            </button>
          </div>
        </div>

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#24263e]/15">
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Số dư ví khả dụng' : 'Available wallet balance'}</span>
              <Wallet className="w-4 h-4 text-[#24263e]" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              {formatVND(totalEarnings)}
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Có thể rút về Ngân hàng ngay' : 'Can withdraw to bank immediately'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Đang đóng băng Escrow' : 'Held in Escrow'}</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              {formatVND(pendingEscrow)}
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Giải ngân sau khi Buyer nhận hàng' : 'Released after buyer confirms delivery'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Điểm Tín Dụng (Credits)' : 'Active Credits'}</span>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#24263e]">
                {creditBalance ? creditBalance.listing : 12}
              </span>
              <span className="text-xs font-bold text-slate-500">Đăng tin</span>
              <span className="text-slate-300">•</span>
              <span className="text-lg font-black text-emerald-600">
                {creditBalance ? creditBalance.valuation : 5}
              </span>
              <span className="text-xs font-bold text-slate-500">Định giá</span>
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleOpenCreditLedger}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
              >
                <History className="w-3 h-3" />
                <span>Xem sổ cái điểm</span>
              </button>
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Tỷ lệ Pass Kiểm Định Hub' : 'Hub Inspection Pass Rate'}</span>
              <TrendingUp className="w-4 h-4 text-[#c34c36]" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              96.8%
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Chỉ số uy tín tin đăng cao' : 'High listing trust score'}
            </div>
          </div>
        </div>
      </div>

      {payoutSuccessMsg && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-200 shadow-md flex items-center gap-3 animate-fadeIn font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs">{payoutSuccessMsg}</span>
        </div>
      )}

      {/* Seller Listings Management */}
      <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#24263e]" />
              <span>
                {lang === 'vi'
                  ? `Quản Lý Tin Đăng Cá Nhân (${filteredListings.length})`
                  : `My Listings Management (${filteredListings.length})`}
              </span>
            </h2>
            <p className="text-xs text-[#24263e]/70 mt-0.5">
              {lang === 'vi'
                ? 'Quản lý trạng thái niêm yết, theo dõi phản hồi đề xuất giá từ người mua và cập nhật thông tin.'
                : 'Manage listing status, monitor buyer price offers, and update item details.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={fetchSellerData}
              disabled={isLoadingPosts}
              className="p-1.5 px-2.5 rounded-xl border border-gray-200 bg-[#faf8f5] hover:bg-gray-100 text-[#24263e] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title={lang === 'vi' ? 'Làm mới dữ liệu từ server' : 'Refresh server data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-[#faf8f5] p-1 rounded-xl border border-gray-200">
              {(['ALL', 'active', 'pending', 'rejected', 'reserved', 'sold'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer ${
                    filterStatus === st ? 'bg-[#24263e] text-white font-bold' : 'text-[#24263e]/70 hover:text-[#24263e] font-medium'
                  }`}
                >
                  {st === 'ALL'
                    ? (lang === 'vi' ? 'Tất cả' : 'All')
                    : st === 'active'
                    ? (lang === 'vi' ? 'Đang bán' : 'Active')
                    : st === 'pending'
                    ? (lang === 'vi' ? 'Chờ duyệt / Hub' : 'Pending')
                    : st === 'rejected'
                    ? (lang === 'vi' ? 'Bị từ chối' : 'Rejected')
                    : st === 'reserved'
                    ? (lang === 'vi' ? 'Đang giữ hàng' : 'Reserved')
                    : (lang === 'vi' ? 'Đã bán' : 'Sold')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 hover:border-[#c34c36] transition shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div className="flex gap-3">
                <img
                  src={item.photos.front}
                  alt={item.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-[#FFFFFF]"
                />
                <div className="space-y-1 overflow-hidden flex-1">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.backendStatus === 'REJECTED'
                      ? 'bg-rose-600 text-white'
                      : item.backendStatus === 'PENDING' || item.backendStatus === 'PENDING_INSPECTION'
                      ? 'bg-amber-500 text-white'
                      : item.backendStatus === 'DRAFT' || item.status === 'draft'
                      ? 'bg-slate-500 text-white'
                      : item.status === 'active'
                      ? 'bg-[#24263e] text-white'
                      : 'bg-[#c34c36] text-white'
                  }`}>
                    {item.backendStatus === 'REJECTED'
                      ? (lang === 'vi' ? '● Bị Từ Chối' : '● Rejected')
                      : item.backendStatus === 'PENDING' || item.backendStatus === 'PENDING_INSPECTION'
                      ? (lang === 'vi' ? '● Chờ Duyệt / Hub' : '● Pending Review')
                      : item.backendStatus === 'DRAFT' || item.status === 'draft'
                      ? (lang === 'vi' ? '● Bản Nháp' : '● Draft')
                      : item.status === 'active'
                      ? (lang === 'vi' ? '● Đang Niêm Yết' : '● Active')
                      : (lang === 'vi' ? '● Đã Cọc Ký Quỹ' : '● Escrow Deposited')}
                  </span>
                  {item.backendStatus === 'REJECTED' && item.rejectionReason && (
                    <div className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200 mt-1 leading-snug">
                      <span className="font-bold">{lang === 'vi' ? 'Lý do: ' : 'Reason: '}</span>
                      <span>{item.rejectionReason}</span>
                    </div>
                  )}
                  <h3 className="font-bold text-xs text-[#24263e] truncate" title={item.title}>
                    {item.title}
                  </h3>
                  <div className="text-sm font-extrabold text-[#24263e]">
                    {formatVND(item.priceVnd)}
                  </div>
                  <div className="text-[11px] text-[#24263e]/70">
                    {lang === 'vi' ? 'Độ mới: ' : 'Grade: '}
                    <span className="font-semibold text-[#24263e]">{item.conditionGrade}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectListing(item)}
                  className="flex-1 py-1.5 px-2 bg-[#24263e] hover:bg-black border border-[#24263e] rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Xem Chi Tiết' : 'View Details'}</span>
                </button>
                <button
                  onClick={() => onCreateListing(item)}
                  className="py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#faf8f5] border border-gray-200 text-[#24263e] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  title={lang === 'vi' ? 'Sửa tin đăng' : 'Edit listing'}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#24263e]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 space-y-5 border border-gray-200 shadow-2xl text-[#24263e]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-base text-[#24263e]">
                <Wallet className="w-5 h-5 text-[#24263e]" />
                <span>{lang === 'vi' ? 'Rút Tiền Ví Doanh Thu Ngay' : 'Instant Revenue Withdrawal'}</span>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="text-gray-400 hover:text-[#24263e] text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#faf8f5] p-3 rounded-2xl border border-gray-200">
                <div className="text-[#24263e]/70">
                  {lang === 'vi' ? 'Số dư ví khả dụng có thể rút:' : 'Available balance eligible for withdrawal:'}
                </div>
                <div className="text-xl font-extrabold text-[#24263e] mt-0.5">
                  {formatVND(totalEarnings)}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#24263e]">
                  {lang === 'vi' ? 'Ngân hàng thụ hưởng *' : 'Beneficiary Bank *'}
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-medium text-[#24263e]"
                >
                  <option value="Vietcombank - Ngân hàng TMCP Ngoại Thương Việt Nam">Vietcombank - Ngân hàng VCB</option>
                  <option value="MBBank - Ngân hàng Quân Đội">MBBank - Ngân hàng Quân Đội</option>
                  <option value="Techcombank - Ngân hàng Kỹ Thương">Techcombank - Ngân hàng Kỹ Thương</option>
                  <option value="VPBank - Ngân hàng Việt Nam Thịnh Vượng">VPBank - Ngân hàng VPBank</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#24263e]">
                  {lang === 'vi' ? 'Số tài khoản *' : 'Account Number *'}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-semibold text-[#24263e]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#24263e]">
                  {lang === 'vi' ? 'Tên chủ tài khoản (Viết hoa không dấu) *' : 'Account Holder Name (Uppercase) *'}
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-bold text-[#24263e]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#24263e]">
                  {lang === 'vi' ? 'Số tiền cần rút (VND) *' : 'Amount to withdraw (VND) *'}
                </label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-bold text-[#24263e]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="px-4 py-2 bg-[#faf8f5] hover:bg-gray-200 text-[#24263e] rounded-xl text-xs font-semibold transition cursor-pointer border border-gray-200"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                onClick={handleRequestPayout}
                className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer"
              >
                {lang === 'vi' ? 'Xác Nhận Rút Tiền Ngay' : 'Confirm Instant Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RESUBMIT eKYC VERIFICATION                         */}
      {/* ======================================================== */}
      {isResubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Nộp Lại Hồ Sơ Xác Minh Định Danh (eKYC)
                </h3>
              </div>
              <button
                onClick={() => setIsResubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResubmit} className="space-y-4 text-xs">
              {myVerification?.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <strong className="block font-bold">Lý do từ chối trước đó:</strong>
                  <p className="mt-0.5">{myVerification.rejectionReason}</p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Số Căn Cước Công Dân (CCCD):</label>
                <input
                  type="text"
                  required
                  value={resubmitDocNum}
                  onChange={(e) => setResubmitDocNum(e.target.value)}
                  placeholder="Nhập 12 số CCCD"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-rose-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Front Image Upload */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold text-[11px]">Ảnh CCCD Mặt Trước *</label>
                  <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                    {resubmitFrontUrl ? (
                      <div className="relative group">
                        <img src={resubmitFrontUrl} alt="CCCD Mặt trước" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setResubmitFrontUrl('')}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-3 space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh mặt trước</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'front')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Back Image Upload */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold text-[11px]">Ảnh CCCD Mặt Sau *</label>
                  <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                    {resubmitBackUrl ? (
                      <div className="relative group">
                        <img src={resubmitBackUrl} alt="CCCD Mặt sau" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setResubmitBackUrl('')}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-3 space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh mặt sau</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'back')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Selfie Image Upload */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold text-[11px]">Ảnh Chân Dung Selfie (Tùy chọn)</label>
                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                  {resubmitSelfieUrl ? (
                    <div className="relative group">
                      <img src={resubmitSelfieUrl} alt="Selfie" className="h-28 w-32 object-cover rounded-lg mx-auto" />
                      <button
                        type="button"
                        onClick={() => setResubmitSelfieUrl('')}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2 space-y-1">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                      <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh chân dung khuôn mặt</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'selfie')}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !resubmitDocNum || !resubmitFrontUrl || !resubmitBackUrl}
                  className="px-5 py-2 rounded-xl bg-[#24263e] hover:bg-black disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {isUploading ? 'Đang Tải / Đang Xử Lý...' : 'Cập Nhật & Nộp Lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Reviews Modal */}
      {isSellerReviewsOpen && (
        <SellerReviewsModal
          sellerId="user-tuan-hcm"
          sellerName="Nguyễn Minh Tuấn"
          isOpen={isSellerReviewsOpen}
          onClose={() => setIsSellerReviewsOpen(false)}
          lang={lang}
        />
      )}

      {/* Credit Ledger Modal */}
      {isCreditLedgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900">
                  Lịch Sử Biến Động Điểm Tín Dụng (Credit Ledger)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditLedgerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingLedger ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Đang tải lịch sử giao dịch credit...</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Loại Credit</th>
                      <th className="py-2.5 px-3">Nghiệp vụ</th>
                      <th className="py-2.5 px-3 text-right">Biến động</th>
                      <th className="py-2.5 px-3 text-right">Số dư sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creditLedgerItems.length > 0 ? (
                      creditLedgerItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.creditType === 'LISTING'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {item.creditType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.entryType === 'PURCHASE' ? 'Nạp gói Credit' :
                             item.entryType === 'CONSUMPTION' ? 'Tiêu trừ dịch vụ' :
                             item.entryType === 'REFUND' ? 'Hoàn trả điểm' : item.entryType}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                            item.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {item.quantityDelta > 0 ? `+${item.quantityDelta}` : item.quantityDelta}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.balanceAfter}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có lịch sử giao dịch credit nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreditLedgerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

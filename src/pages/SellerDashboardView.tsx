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
  Upload,
  RefreshCw,
  X
} from 'lucide-react';
import { Listing, Language } from '../types';
import { formatVND } from '../utils/translations';
import { sellerService, SellerVerificationResponseDto } from '../services/sellerService';
import { mediaService } from '../services/mediaService';

interface SellerDashboardViewProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  onCreateListing: () => void;
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'reserved' | 'sold'>('ALL');
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [bankName, setBankName] = useState('Vietcombank - Ngân hàng TMCP Ngoại Thương Việt Nam');
  const [accountNumber, setAccountNumber] = useState('10298839201');
  const [accountHolder, setAccountHolder] = useState('NGUYEN MINH TUAN');
  const [payoutAmount, setPayoutAmount] = useState<number>(42800000);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);

  // Seller Verification State
  const [myVerification, setMyVerification] = useState<SellerVerificationResponseDto | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [resubmitFrontUrl, setResubmitFrontUrl] = useState('');
  const [resubmitBackUrl, setResubmitBackUrl] = useState('');
  const [resubmitSelfieUrl, setResubmitSelfieUrl] = useState('');
  const [resubmitDocNum, setResubmitDocNum] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [resubmitMsg, setResubmitMsg] = useState<string | null>(null);

  useEffect(() => {
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
      .catch(() => {
        // Ignored if not verified yet
      });

    // Fetch backend categories & public posts
    import('../services').then(({ categoryService, postService }) => {
      categoryService.getCategories().catch(() => []);
      postService.getPublicPosts().catch(() => []);
    });
  }, []);

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
        documentNumber: resubmitDocNum,
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

  const sellerListings = listings.filter(l => l.sellerId === 'user-tuan-hcm' || true);
  const filteredListings = sellerListings.filter(l => filterStatus === 'ALL' || l.status === filterStatus);

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
    <div className="space-y-8 pb-16 text-[#0E121B]">
      {/* eKYC Verification Status Banner */}
      {myVerification && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
          myVerification.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          myVerification.status === 'REJECTED' || myVerification.status === 'RESUBMIT_REQUIRED' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            {myVerification.status === 'APPROVED' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : myVerification.status === 'REJECTED' || myVerification.status === 'RESUBMIT_REQUIRED' ? (
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                {myVerification.status === 'APPROVED' && 'Tài khoản người bán đã được xác minh eKYC!'}
                {(myVerification.status === 'PENDING' || myVerification.status === 'NEEDS_REVIEW') && 'Hồ sơ xác minh eKYC đang được xem xét (Pending Review)'}
                {(myVerification.status === 'REJECTED' || myVerification.status === 'RESUBMIT_REQUIRED') && 'Hồ sơ xác minh eKYC bị từ chối / Cần bổ sung'}
              </div>
              <p className="mt-0.5">
                {myVerification.status === 'APPROVED' && 'Tất cả các tin đăng của bạn sẽ hiển thị huy hiệu Người Bán Uy Tín & Đã Kiểm Định.'}
                {(myVerification.status === 'PENDING' || myVerification.status === 'NEEDS_REVIEW') && 'Đã nhận hồ sơ CCCD ' + myVerification.documentNumber + '. Ban quản trị đang rà soát điểm rủi ro & ảnh đối chiếu.'}
                {(myVerification.status === 'REJECTED' || myVerification.status === 'RESUBMIT_REQUIRED') && (
                  <span>Lý do từ chối: <strong>{myVerification.rejectionReason || 'Giấy tờ mờ hoặc không trùng khớp với thông tin cá nhân.'}</strong></span>
                )}
              </p>
            </div>
          </div>

          {(myVerification.status === 'REJECTED' || myVerification.status === 'RESUBMIT_REQUIRED') && (
            <button
              onClick={() => setIsResubmitModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Nộp Lại Hồ Sơ eKYC</span>
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
      <div className="bg-[#0E121B] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt="Seller Avatar"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md"
              />
              <div
                className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white p-1 rounded-full text-xs shadow-xs"
                title={lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Nguyễn Minh Tuấn
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-[#EC1577]" />
                  {lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
                </span>
              </div>
              <p className="text-xs text-white/70 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1 text-white font-semibold">
                  <Star className="w-3.5 h-3.5 fill-[#F1622A] text-[#F1622A]" />
                  {lang === 'vi' ? '4.9 / 5.0 (32 đánh giá)' : '4.9 / 5.0 (32 reviews)'}
                </span>
                <span>•</span>
                <span>{lang === 'vi' ? '32 đơn thành công' : '32 successful orders'}</span>
                <span>•</span>
                <span>{lang === 'vi' ? 'Tỷ lệ phản hồi 99%' : '99% response rate'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onCreateListing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white font-semibold text-xs shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Đăng Bán Đồ Gia Dụng Mới (AI)' : 'Post New Appliance (AI)'}</span>
            </button>
            {onViewOrders && (
              <button
                onClick={onViewOrders}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'vi' ? 'Quản Lý Đơn Bán Hàng' : 'Manage Sales Orders'}</span>
              </button>
            )}
            <button
              onClick={() => setIsPayoutModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs transition cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-[#F1622A]" />
              <span>{lang === 'vi' ? 'Rút Tiền Ví Doanh Thu' : 'Withdraw Revenue'}</span>
            </button>
          </div>
        </div>

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#0E121B]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Số dư ví khả dụng' : 'Available wallet balance'}</span>
              <Wallet className="w-4 h-4 text-[#EC1577]" />
            </div>
            <div className="text-2xl font-black text-[#0E121B]">
              {formatVND(totalEarnings)}
            </div>
            <div className="text-[11px] text-[#0E121B]/60">
              {lang === 'vi' ? 'Có thể rút về Ngân hàng ngay' : 'Can withdraw to bank immediately'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#0E121B]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Đang đóng băng Escrow' : 'Held in Escrow'}</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-[#EC1577]">
              {formatVND(pendingEscrow)}
            </div>
            <div className="text-[11px] text-[#0E121B]/60">
              {lang === 'vi' ? 'Giải ngân sau khi Buyer nhận hàng' : 'Released after buyer confirms delivery'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#0E121B]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Tỷ lệ Pass Kiểm Định Hub' : 'Hub Inspection Pass Rate'}</span>
              <TrendingUp className="w-4 h-4 text-[#F1622A]" />
            </div>
            <div className="text-2xl font-black text-[#0E121B]">
              96.8%
            </div>
            <div className="text-[11px] text-[#0E121B]/60">
              {lang === 'vi' ? 'Chỉ số uy tín tin đăng cao' : 'High listing trust score'}
            </div>
          </div>
        </div>
      </div>

      {payoutSuccessMsg && (
        <div className="bg-[#0E121B] text-white p-4 rounded-2xl border border-white/10 shadow-lg flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-[#EC1577] shrink-0" />
          <span className="text-xs font-semibold">{payoutSuccessMsg}</span>
        </div>
      )}

      {/* Seller Listings Management */}
      <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0E121B] flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#EC1577]" />
              <span>
                {lang === 'vi'
                  ? `Quản Lý Tin Đăng Cá Nhân (${filteredListings.length})`
                  : `My Listings Management (${filteredListings.length})`}
              </span>
            </h2>
            <p className="text-xs text-[#0E121B]/70 mt-0.5">
              {lang === 'vi'
                ? 'Quản lý trạng thái niêm yết, theo dõi phản hồi đề xuất giá từ người mua và cập nhật thông tin.'
                : 'Manage listing status, monitor buyer price offers, and update item details.'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F4F5F8] p-1 rounded-xl border border-gray-200 self-start sm:self-auto">
            {(['ALL', 'active', 'reserved', 'sold'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterStatus === st ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold' : 'text-[#0E121B]/70 hover:text-[#0E121B]'
                }`}
              >
                {st === 'ALL'
                  ? (lang === 'vi' ? 'Tất cả' : 'All')
                  : st === 'active'
                  ? (lang === 'vi' ? 'Đang bán' : 'Active')
                  : st === 'reserved'
                  ? (lang === 'vi' ? 'Đang giữ hàng' : 'Reserved')
                  : (lang === 'vi' ? 'Đã bán' : 'Sold')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 hover:border-[#EC1577] transition shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div className="flex gap-3">
                <img
                  src={item.photos.front}
                  alt={item.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-[#FFFFFF]"
                />
                <div className="space-y-1 overflow-hidden">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.status === 'active' ? 'bg-[#0E121B] text-white' : 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white'
                  }`}>
                    {item.status === 'active'
                      ? (lang === 'vi' ? '● Đang Niêm Yết' : '● Active')
                      : (lang === 'vi' ? '● Đã Cọc Ký Quỹ' : '● Escrow Deposited')}
                  </span>
                  <h3 className="font-bold text-xs text-[#0E121B] truncate" title={item.title}>
                    {item.title}
                  </h3>
                  <div className="text-sm font-extrabold text-[#EC1577]">
                    {formatVND(item.priceVnd)}
                  </div>
                  <div className="text-[11px] text-[#0E121B]/70">
                    {lang === 'vi' ? 'Độ mới: ' : 'Grade: '}
                    <span className="font-semibold text-[#0E121B]">{item.conditionGrade}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectListing(item)}
                  className="flex-1 py-1.5 px-2 bg-[#0E121B] hover:bg-[#0E121B]/80 border border-[#0E121B] rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Xem Chi Tiết' : 'View Details'}</span>
                </button>
                <button
                  onClick={onCreateListing}
                  className="py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#F4F5F8] border border-gray-200 text-[#0E121B] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  title={lang === 'vi' ? 'Sửa tin đăng' : 'Edit listing'}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#0E121B]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 space-y-5 border border-gray-200 shadow-2xl text-[#0E121B]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-base text-[#0E121B]">
                <Wallet className="w-5 h-5 text-[#EC1577]" />
                <span>{lang === 'vi' ? 'Rút Tiền Ví Doanh Thu Ngay' : 'Instant Revenue Withdrawal'}</span>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="text-gray-400 hover:text-[#0E121B] text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#F4F5F8] p-3 rounded-2xl border border-gray-200">
                <div className="text-[#0E121B]/70">
                  {lang === 'vi' ? 'Số dư ví khả dụng có thể rút:' : 'Available balance eligible for withdrawal:'}
                </div>
                <div className="text-xl font-extrabold text-[#EC1577] mt-0.5">
                  {formatVND(totalEarnings)}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#0E121B]">
                  {lang === 'vi' ? 'Ngân hàng thụ hưởng *' : 'Beneficiary Bank *'}
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-medium text-[#0E121B]"
                >
                  <option value="Vietcombank - Ngân hàng TMCP Ngoại Thương Việt Nam">Vietcombank - Ngân hàng VCB</option>
                  <option value="MBBank - Ngân hàng Quân Đội">MBBank - Ngân hàng Quân Đội</option>
                  <option value="Techcombank - Ngân hàng Kỹ Thương">Techcombank - Ngân hàng Kỹ Thương</option>
                  <option value="VPBank - Ngân hàng Việt Nam Thịnh Vượng">VPBank - Ngân hàng VPBank</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#0E121B]">
                  {lang === 'vi' ? 'Số tài khoản *' : 'Account Number *'}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-semibold text-[#0E121B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#0E121B]">
                  {lang === 'vi' ? 'Tên chủ tài khoản (Viết hoa không dấu) *' : 'Account Holder Name (Uppercase) *'}
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-bold text-[#0E121B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#0E121B]">
                  {lang === 'vi' ? 'Số tiền cần rút (VND) *' : 'Amount to withdraw (VND) *'}
                </label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-bold text-[#0E121B]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="px-4 py-2 bg-[#F4F5F8] hover:bg-gray-200 text-[#0E121B] rounded-xl text-xs font-semibold transition cursor-pointer border border-gray-200"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                onClick={handleRequestPayout}
                className="px-5 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {isUploading ? 'Đang Tải / Đang Xử Lý...' : 'Cập Nhật & Nộp Lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

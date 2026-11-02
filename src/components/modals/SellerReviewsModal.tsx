import React, { useState, useEffect } from 'react';
import {
  Star,
  ShieldCheck,
  Award,
  CheckCircle2,
  X,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { Language } from '../../types';
import { reviewService } from '../../data/mockReviews';
import { reputationService, SellerReputationDto, getAssessmentStatusMeta } from '../../services';

interface SellerReviewsModalProps {
  isOpen: boolean;
  sellerId: string;
  sellerName: string;
  onClose: () => void;
  lang?: Language;
}

export const SellerReviewsModal: React.FC<SellerReviewsModalProps> = ({
  isOpen,
  sellerId,
  sellerName,
  onClose,
  lang = 'vi'
}) => {
  const [filterRating, setFilterRating] = useState<number | 'ALL'>('ALL');
  const [reputation, setReputation] = useState<SellerReputationDto | null>(null);
  const [isLoadingRep, setIsLoadingRep] = useState(false);

  useEffect(() => {
    if (!isOpen || !sellerId) return;
    let isMounted = true;
    setIsLoadingRep(true);
    reputationService.getSellerReputation(sellerId)
      .then((rep) => {
        if (isMounted) setReputation(rep);
      })
      .catch((err) => {
        console.warn('Could not fetch seller reputation:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRep(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, sellerId]);

  if (!isOpen) return null;

  const allReviews = reviewService.getReviewsBySeller(sellerId);

  const filteredReviews = allReviews.filter((r) => {
    if (filterRating === 'ALL') return true;
    return r.rating === filterRating;
  });

  const ratingCounts = {
    5: allReviews.filter((r) => r.rating === 5).length,
    4: allReviews.filter((r) => r.rating === 4).length,
    3: allReviews.filter((r) => r.rating === 3).length,
    2: allReviews.filter((r) => r.rating === 2).length,
    1: allReviews.filter((r) => r.rating === 1).length,
  };

  const statusMeta = reputation ? getAssessmentStatusMeta(reputation.assessmentStatus) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-2xl text-[#24263e] flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#24263e] to-[#343759] text-white shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-lg font-black text-[#fce5da] shadow-sm">
              {sellerName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  {sellerName}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  eKYC Verified
                </span>
              </div>
              <p className="text-xs text-white/70 font-medium">
                {lang === 'vi'
                  ? 'Hồ sơ uy tín & Nhận xét đánh giá từ cộng đồng người mua'
                  : 'Seller trust profile & verified buyer reviews'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 space-y-6 text-xs text-[#24263e] flex-1 overflow-y-auto subtle-scrollbar">
          {/* Trust Score & Key Stats Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-[#faf8f5] to-[#fce5da]/30 p-5 border border-amber-200/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Big Score Badge */}
                <div className="w-18 h-18 rounded-2xl bg-[#24263e] text-white flex flex-col items-center justify-center shadow-md p-2 text-center shrink-0">
                  <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider">UY TÍN</span>
                  <span className="text-2xl font-black text-white leading-none mt-0.5">
                    {reputation?.score !== undefined && reputation?.score !== null ? reputation.score : '--'}
                  </span>
                  <span className="text-[9px] text-white/70">/ 100</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">
                      {lang === 'vi' ? 'Trạng Thái Uy Tín:' : 'Reputation Status:'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border flex items-center gap-1 shadow-2xs ${
                      statusMeta?.badgeClass || 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      {statusMeta?.shortLabel || 'Chưa đánh giá'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {allReviews.length} {lang === 'vi' ? 'lượt đánh giá' : 'reviews'}
                    </span>
                    <span>•</span>
                    <span className="text-slate-600">
                      {reputation?.evaluatedOrders ?? 0} {lang === 'vi' ? 'đơn đã nghiệm thu' : 'evaluated orders'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap sm:flex-col gap-1.5 text-[11px] font-semibold text-slate-700">
                <div className="flex items-center gap-1.5 bg-white/90 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Bảo vệ quỹ tín thác Escrow</span>
                </div>
                {reputation?.sellingRestricted && (
                  <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-300 text-rose-800 shadow-2xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Đang bị giới hạn bán hàng</span>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metric Counters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-amber-200/50 text-center">
              <div className="bg-white/80 p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold">{lang === 'vi' ? 'Giao dịch tốt' : 'Good Orders'}</div>
                <div className="text-sm font-black text-emerald-700 mt-0.5">{reputation?.goodTransactions ?? 0}</div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold">{lang === 'vi' ? 'Đơn đã kiểm định' : 'Evaluated Orders'}</div>
                <div className="text-sm font-black text-emerald-700 mt-0.5">{reputation?.evaluatedOrders ?? 0}</div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold">{lang === 'vi' ? 'Đơn hủy do người bán' : 'Seller Cancellations'}</div>
                <div className="text-sm font-black text-[#24263e] mt-0.5">{reputation?.sellerCancellationOrders ?? 0}</div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold">{lang === 'vi' ? 'Giao dịch vi phạm' : 'Bad Orders'}</div>
                <div className="text-sm font-black text-slate-800 mt-0.5">{reputation?.badTransactions ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Reviews Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[#24263e]">
                {lang === 'vi' ? 'Nhận Xét Từ Người Mua Đã Giao Dịch:' : 'Verified Buyer Reviews:'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#faf8f5] text-slate-600 border border-gray-200">
                {filteredReviews.length}
              </span>
            </div>

            {/* Filter Buttons */}
            {allReviews.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterRating('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    filterRating === 'ALL'
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                  }`}
                >
                  {lang === 'vi' ? 'Tất cả' : 'All'} ({allReviews.length})
                </button>
                {[5, 4, 3, 2, 1].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFilterRating(star)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      filterRating === star
                        ? 'bg-[#24263e] text-white shadow-xs'
                        : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>({ratingCounts[star as keyof typeof ratingCounts]})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {filteredReviews.length === 0 ? (
              <div className="p-8 text-center bg-[#faf8f5] rounded-3xl border border-dashed border-gray-200 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto text-slate-300 shadow-2xs">
                  <MessageSquare className="w-6 h-6 text-slate-400" />
                </div>
                <div className="font-bold text-slate-700 text-xs">
                  {lang === 'vi' ? 'Người bán này chưa có nhận xét nào từ khách mua' : 'No written reviews from buyers yet'}
                </div>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  {lang === 'vi'
                    ? 'Sau khi các giao dịch hoàn tất qua quỹ ký quỹ Escrow và sản phẩm được nghiệm thu, người mua có thể để lại nhận xét công khai tại đây.'
                    : 'Reviews will appear here after orders are completed and confirmed via Escrow.'}
                </p>
              </div>
            ) : (
              filteredReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2.5 hover:border-gray-300 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={rev.buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                        alt={rev.buyerName}
                        className="w-9 h-9 rounded-xl object-cover border border-gray-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{rev.buyerName}</span>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã mua qua Escrow' : 'Verified Escrow Buyer'}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(rev.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                      </div>
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Product purchased info */}
                  {rev.productName && (
                    <div className="text-[11px] font-medium text-slate-500 bg-white/70 px-2.5 py-1 rounded-lg border border-gray-200/80 w-fit">
                      {lang === 'vi' ? 'Sản phẩm đã mua:' : 'Item purchased:'}{' '}
                      <strong className="text-slate-800">{rev.productName}</strong>
                    </div>
                  )}

                  {/* Review Content */}
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {rev.comment}
                  </p>

                  {/* Tags */}
                  {rev.tags && rev.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {rev.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-slate-600 shadow-2xs"
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Seller response if any */}
                  {rev.sellerResponse && (
                    <div className="mt-2.5 p-3 rounded-xl bg-white border-l-3 border-[#c34c36] text-[11px] space-y-1">
                      <div className="font-bold text-[#c34c36] flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Phản hồi từ Người Bán:' : 'Seller Response:'}</span>
                      </div>
                      <p className="text-slate-600 leading-snug">{rev.sellerResponse.comment}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-slate-50 rounded-b-3xl">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'vi' ? '100% dữ liệu uy tín đồng bộ từ hệ thống Quỹ Tín Thác Escrow' : '100% reputation metrics synced from Escrow system'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

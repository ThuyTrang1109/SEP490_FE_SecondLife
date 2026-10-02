import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Star,
  MapPin,
  MessageSquare,
  Info,
  Award,
  FileCheck2,
  Camera,
  Box,
  ThumbsUp,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Listing, Language, ProductReview } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { ProductViewer3D } from '../3d/ProductViewer3D';
import { soundFx } from '../../utils/soundEffects';
import { reviewService } from '../../data/mockReviews';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  onBuyClick: (listing: Listing) => void;
  onChatClick: (listing: Listing) => void;
  lang: Language;
  initialViewMode?: 'photos' | '3d';
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  onClose,
  onBuyClick,
  onChatClick,
  lang,
  initialViewMode = 'photos',
  onOpenSellerReviews
}) => {
  if (!listing) return null;
  const t = translations[lang];

  const photoKeys: Array<{ key: keyof typeof listing.photos; labelVi: string; labelEn: string }> = [
    { key: 'front', labelVi: '1. Mặt trước', labelEn: '1. Front' },
    { key: 'back', labelVi: '2. Mặt sau & Viền', labelEn: '2. Back & Frame' },
    { key: 'screenOrDetails', labelVi: '3. Soi vết xước', labelEn: '3. Scratches / Details' },
    { key: 'accessoriesOrBox', labelVi: '4. Phụ kiện / Hộp', labelEn: '4. Accessories & Box' },
    { key: 'serialOrReceipt', labelVi: '5. Serial / Hóa đơn', labelEn: '5. Serial / Proof' }
  ];

  const [viewMode, setViewMode] = useState<'photos' | '3d'>(initialViewMode);
  const [activePhotoKey, setActivePhotoKey] = useState<keyof typeof listing.photos>('front');
  const [reviewsTab, setReviewsTab] = useState<'product' | 'seller'>('product');

  // Load reviews & trust profile
  const productReviews = reviewService.getReviewsByListing(listing.id);
  const sellerReviews = reviewService.getReviewsBySeller(listing.sellerId);
  const sellerTrust = reviewService.getSellerTrustProfile(listing.sellerId, listing.sellerName);

  const displayReviews = reviewsTab === 'product' ? productReviews : sellerReviews;
  const avgProductRating = productReviews.length > 0
    ? (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#fce5da] backdrop-blur-md px-6 py-4 border-b border-[#24263e]/15 flex items-center justify-between text-[#24263e]">
          <div className="flex items-center gap-2">
            <span className="bg-white text-[#24263e] text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#24263e]" />
              {listing.conditionGrade === 'Like New' ? 'Grade A+ (99%)' : 'Grade A (95%)'}
            </span>
            <span className="text-xs text-[#24263e]/80 font-bold">
              Mã tin: #{listing.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#24263e] hover:bg-white/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Visual Mode Selector Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundFx.playChime();
                  setViewMode('photos');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'photos'
                    ? 'bg-[#24263e] text-white shadow-sm font-black'
                    : 'bg-[#faf8f5] text-[#24263e] hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Ảnh Thực Tế (5 Góc Chuẩn)' : 'Real Photos (5 Angles)'}</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playScanBeep();
                  setViewMode('3d');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-[#24263e] text-white shadow-sm font-black'
                    : 'bg-[#faf8f5] text-[#24263e] hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Mô Hình 3D Xoay 360° & Soi Linh Kiện' : 'Interactive 3D 360° & X-Ray'}</span>
                <span className="bg-white text-[#24263e] text-[10px] px-1.5 py-0.2 rounded-full uppercase font-black">3D</span>
              </button>
            </div>

            <div className="text-xs text-[#24263e]/70 hidden sm:flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Dữ liệu quét 3D tại Hub giám định' : '3D Spatial Scan from Hub'}</span>
            </div>
          </div>

          {/* Conditional Display: 3D Full Viewer or 2D Photo Gallery */}
          {viewMode === '3d' ? (
            <div className="w-full">
              <ProductViewer3D listing={listing} lang={lang} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Gallery Column (7 cols) */}
              <div className="md:col-span-7 space-y-3">
                <div className="relative aspect-4/3 w-full bg-[#faf8f5] rounded-2xl overflow-hidden border border-gray-200">
                  <img
                    src={listing.photos[activePhotoKey] || listing.photos.front}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-[#24263e]/90 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10 font-bold">
                    <Camera className="w-3.5 h-3.5 text-white" />
                    <span>
                      {photoKeys.find((p) => p.key === activePhotoKey)?.[lang === 'vi' ? 'labelVi' : 'labelEn']}
                    </span>
                  </div>
                </div>

                {/* Thumbnails */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-[#24263e]/70 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#24263e]" />
                    <span>{t.photoChecklistTitle}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photoKeys.map((item) => {
                      const isSelected = activePhotoKey === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActivePhotoKey(item.key)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#24263e] ring-2 ring-[#24263e]/30 scale-102'
                              : 'border-gray-200 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={listing.photos[item.key] || listing.photos.front}
                            alt={item.labelVi}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-[#24263e]/90 text-white text-[9px] py-0.5 text-center truncate px-1 font-bold">
                            {lang === 'vi' ? item.labelVi.split('.')[1] : item.labelEn.split('.')[1]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Price & Seller Action Column (5 cols) */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[#24263e]/70 font-medium">
                    <span className="font-black text-[#24263e] uppercase tracking-wider">{listing.brand}</span>
                    <span>•</span>
                    <span>{listing.category}</span>
                    <span>•</span>
                    <span>{listing.purchaseYear}</span>
                  </div>

                  <h1 className="text-xl font-extrabold text-[#24263e] leading-snug">
                    {listing.title}
                  </h1>

                  {/* Price block */}
                  <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-1">
                    <div className="text-xs text-[#24263e]/70 font-medium">
                      {listing.originalPriceVnd && (
                        <span className="line-through text-[#24263e]/50 mr-2">
                          {formatVND(listing.originalPriceVnd)}
                        </span>
                      )}
                      {lang === 'vi' ? 'Giá người bán niêm yết' : 'Listing Price'}
                    </div>
                    <div className="text-2xl font-black text-[#c34c36]">
                      {formatVND(listing.priceVnd)}
                    </div>
                    <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Bảo lãnh Escrow 100%: Nhận hàng kiểm tra 48h mới giải ngân' : '100% Escrow Protection: Funds released only after 48h test'}</span>
                    </div>
                  </div>

                  {/* Enhanced Seller Card with Reputation / Trust Score (Requirement 2 & 3) */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#faf8f5] to-amber-50/40 border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#24263e] text-white font-black flex items-center justify-center text-sm shadow-sm">
                          {listing.sellerName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-[#24263e] flex items-center gap-1.5">
                            <span>{listing.sellerName}</span>
                            {listing.sellerVerified && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center text-amber-500 font-extrabold">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                              {listing.sellerRating}
                            </span>
                            <span>•</span>
                            <span>{sellerTrust.reviewCount} {lang === 'vi' ? 'đánh giá' : 'reviews'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <MapPin className="w-3 h-3" />
                              {listing.location.split(',')[0]}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Prominent Trust Score Badge (Requirement 2) */}
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#24263e] text-white shadow-xs">
                          <Award className="w-3.5 h-3.5 text-amber-300" />
                          <span className="text-xs font-black">{sellerTrust.trustScore}</span>
                          <span className="text-[10px] text-white/70">/100</span>
                        </div>
                        <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                          {sellerTrust.tier}
                        </div>
                      </div>
                    </div>

                    {/* View Seller Reviews Trigger (Requirement 3) */}
                    <div className="pt-2 border-t border-amber-200/50 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">
                        {lang === 'vi' ? 'Tỷ lệ hàng qua Hub đạt chuẩn: ' : 'Hub pass rate: '}
                        <strong className="text-emerald-700">{sellerTrust.hubPassRate}%</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                        className="text-[11px] font-extrabold text-[#c34c36] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{lang === 'vi' ? 'Xem đánh giá của buyer khác' : 'View buyer feedback'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => onBuyClick(listing)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>{lang === 'vi' ? 'Mua Bảo Đảm Escrow & Kiểm Định Hub' : 'Buy with Escrow & Inspection'}</span>
                  </button>

                  <button
                    onClick={() => onChatClick(listing)}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-[#24263e] border border-slate-300 rounded-2xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Chat & Đàm Phán Trả Giá Với Người Bán' : 'Chat & Make Counter Offer'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Price Estimation & Valuation Deep-Dive */}
          {listing.aiPriceEstimation && (
            <div className="rounded-2xl bg-[#faf8f5] p-5 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white flex items-center justify-center shadow-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#24263e]">
                      {lang === 'vi' ? 'Mô Hình AI Định Giá Thị Trường SecondLife' : 'SecondLife AI Market Valuation'}
                    </h3>
                    <p className="text-xs text-[#24263e]/70 font-medium">
                      {lang === 'vi'
                        ? 'Dựa trên 1,420+ tin đăng và giao dịch thực tế tương đương tại Việt Nam'
                        : 'Calibrated with 1,420+ verified real transaction records in Vietnam'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#24263e] text-white px-3 py-1 rounded-full text-xs font-bold">
                  <Award className="w-3.5 h-3.5 text-white" />
                  <span>{lang === 'vi' ? 'Độ tin cậy mô hình' : 'Model Confidence'}: {listing.aiPriceEstimation.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#24263e]/70 font-semibold">{t.fairRange}</div>
                  <div className="text-sm font-black text-[#24263e]">
                    {formatVND(listing.aiPriceEstimation.minVnd)} - {formatVND(listing.aiPriceEstimation.maxVnd)}
                  </div>
                  <div className="text-[10px] text-[#24263e]/60 font-medium mt-0.5">{lang === 'vi' ? 'Biên độ thanh khoản tốt' : 'Optimal liquidity range'}</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#24263e]/70 font-semibold">{t.suggestedPrice}</div>
                  <div className="text-sm font-black text-[#24263e]">
                    {formatVND(listing.aiPriceEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[10px] text-[#24263e]/60 font-medium mt-0.5">{lang === 'vi' ? 'Thời gian bán ~ 7 ngày' : 'Avg. sale time ~ 7 days'}</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#24263e]/70 font-semibold">{t.quickSalePrice}</div>
                  <div className="text-sm font-black text-[#24263e]">
                    {formatVND(listing.aiPriceEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[10px] text-[#24263e]/60 font-medium mt-0.5">{lang === 'vi' ? 'Bán nhanh trong 3 ngày' : 'Quick sale in 3 days'}</div>
                </div>
              </div>

              <div className="text-[11px] text-[#24263e] bg-[#FFFFFF] p-2.5 rounded-xl border border-gray-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#24263e] shrink-0 mt-0.5" />
                <span className="font-medium">{t.disclaimer}</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#24263e] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Cam kết tình trạng người bán' : 'Seller Condition Statement'}
            </h3>
            <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 text-sm text-[#24263e] space-y-2 leading-relaxed">
              <div className="font-bold text-[#24263e] flex items-center gap-1.5 text-xs bg-white border border-[#24263e]/20 px-2.5 py-1 rounded-lg w-fit shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#24263e]" />
                <span>{listing.declaredConditionText}</span>
              </div>
              <p className="whitespace-pre-line text-xs sm:text-sm text-[#24263e]">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Customer Reviews Section (Requirements 1 & 3) */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReviewsTab('product')}
                  className={`text-xs sm:text-sm font-extrabold pb-1 transition cursor-pointer flex items-center gap-1.5 ${
                    reviewsTab === 'product'
                      ? 'text-[#24263e] border-b-2 border-[#c34c36]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{lang === 'vi' ? `Đánh Giá Sản Phẩm Này (${productReviews.length})` : `Item Reviews (${productReviews.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewsTab('seller')}
                  className={`text-xs sm:text-sm font-extrabold pb-1 transition cursor-pointer flex items-center gap-1.5 ${
                    reviewsTab === 'seller'
                      ? 'text-[#24263e] border-b-2 border-[#c34c36]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-[#c34c36]" />
                  <span>{lang === 'vi' ? `Đánh Giá Về Người Bán (${sellerReviews.length})` : `Seller Feedback (${sellerReviews.length})`}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {reviewsTab === 'product' ? `${avgProductRating} / 5.0 ⭐` : `${sellerTrust.rating} / 5.0 ⭐`}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 cursor-pointer transition"
                >
                  {lang === 'vi' ? 'Xem hồ sơ uy tín seller' : 'View seller reputation'}
                </button>
              </div>
            </div>

            {/* List of Reviews */}
            {displayReviews.length === 0 ? (
              <div className="text-center py-8 bg-[#faf8f5] rounded-2xl border border-gray-200 text-slate-400 text-xs">
                <Star className="w-7 h-7 mx-auto mb-1.5 text-gray-300" />
                <p>{lang === 'vi' ? 'Chưa có đánh giá nào. Hãy là người đầu tiên trải nghiệm và để lại nhận xét!' : 'No reviews yet for this listing.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={rev.buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                          alt={rev.buyerName}
                          className="w-8 h-8 rounded-xl object-cover border border-gray-200"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{rev.buyerName}</span>
                            {rev.isVerifiedPurchase && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>{lang === 'vi' ? 'Đã mua qua Escrow' : 'Verified Purchase'}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                          </span>
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

                    <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>

                    {rev.tags && rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {rev.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-slate-600"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {rev.sellerResponse && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white border-l-2 border-[#c34c36] text-[11px] space-y-0.5">
                        <span className="font-bold text-[#c34c36]">{lang === 'vi' ? 'Người bán phản hồi:' : 'Seller replied:'}</span>
                        <p className="text-slate-600">{rev.sellerResponse.comment}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inspection Center Trust Workflow Badge */}
          <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-black text-[#24263e] text-sm">
                  {lang === 'vi' ? 'Dịch Vụ Kiểm Định Trung Tâm SecondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-xs text-[#24263e]/70 font-medium">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo soi linh kiện, đo pin, test màn hình và dán tem niêm phong NFC trước khi giao.'
                    : 'Certified hardware engineers verify authentic parts, battery health, and apply tamper-proof NFC seals.'}
                </div>
              </div>
            </div>

            <span className="text-xs font-black text-[#24263e] bg-white border border-[#24263e]/20 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xs">
              {lang === 'vi' ? 'Phí kiểm định: 250,000đ' : 'Inspection fee: 250,000 VND'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

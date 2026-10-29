import React, { useState, useEffect } from 'react';
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
  ThumbsUp,
  ChevronRight,
  UserCheck,
  Flag
} from 'lucide-react';
import { Listing, Language, ProductReview, UserProfile } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { cleanFullAddress } from '../../utils/addressUtils';
import { getBoughtListingIds } from '../../utils/orderUtils';
import { soundFx } from '../../utils/soundEffects';
import { reviewService } from '../../data/mockReviews';
import { reputationService, postService, SellerReputationDto, getStoredUser, getAssessmentStatusMeta } from '../../services';
import { UserReportModal } from './UserReportModal';
import { resolveCategoryAndItem, extractSellerOriginalPrice } from '../../utils/catalogCache';

interface ListingDetailModalProps {
  listing: Listing | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onBuyClick: (listing: Listing) => void;
  onChatClick: (listing: Listing) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
  isAdmin?: boolean;
  lang: Language;
}

const cleanDisplayDescription = (desc?: string): string => {
  if (!desc) return '';
  return desc
    .replace(/<!--(?:sl_orig_price|ORIGINAL_PRICE):\d+-->/gi, '')
    .replace(/^[-*•\s]*giá\s*(?:sản\s*phẩm\s*)?lúc\s*mua\s*(?:mới)?\s*[:=–-].*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  currentUser: propCurrentUser,
  onClose,
  onBuyClick,
  onChatClick,
  lang,
  onOpenSellerReviews,
  isAdmin = false
}) => {
  if (!listing) return null;
  const t = translations[lang];
  const user = propCurrentUser || getStoredUser();
  const isOwnListing = Boolean(
    user?.id && listing.sellerId && String(user.id) === String(listing.sellerId)
  );

  const resolved = React.useMemo(() => {
    return resolveCategoryAndItem({
      postId: listing.id,
      categoryId: listing.categoryId,
      itemId: listing.itemId,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      brand: listing.brand,
      model: listing.model,
    });
  }, [listing]);

  const displayBrand = (listing.brand && listing.brand !== 'SecondLife' && listing.brand !== 'Hãng' ? listing.brand : resolved.brand) || 'Chính hãng';
  const displayCategory = listing.itemName || resolved.itemName || listing.category || resolved.displayCategory || 'Đồ gia dụng';

  // Giá tiền lúc người bán mua (Original purchase price) từ thông tin người bán khai báo khi tạo bài đăng
  const effectiveOriginalPrice = React.useMemo(() => {
    return extractSellerOriginalPrice(listing) || 0;
  }, [listing]);

  const discountPercent = React.useMemo(() => {
    if (!effectiveOriginalPrice || !listing.priceVnd || effectiveOriginalPrice <= listing.priceVnd) return 0;
    return Math.round(((effectiveOriginalPrice - listing.priceVnd) / effectiveOriginalPrice) * 100);
  }, [effectiveOriginalPrice, listing.priceVnd]);

  // Lấy chính xác danh sách ảnh thực tế của bài đăng (không nhân bản / không lặp lại ảnh)
  const galleryImages: string[] = React.useMemo(() => {
    if (Array.isArray(listing.photoGallery) && listing.photoGallery.length > 0) {
      const filtered = listing.photoGallery.filter(Boolean);
      const unique = Array.from(new Set(filtered));
      if (unique.length > 0) return unique;
    }
    const fromPhotos = [
      listing.photos?.front,
      listing.photos?.back,
      listing.photos?.screenOrDetails,
      listing.photos?.accessoriesOrBox,
      listing.photos?.serialOrReceipt,
      listing.photos?.extraDetail
    ].filter(Boolean) as string[];

    const deduped = Array.from(new Set(fromPhotos));
    if (deduped.length > 0) return deduped;
    return [(listing as any).imageUrl || listing.photos?.front || 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800'];
  }, [listing]);

  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [listing.id]);
  const [reviewsTab, setReviewsTab] = useState<'product' | 'seller'>('product');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Load reviews & trust profile
  const productReviews = reviewService.getReviewsByListing(listing.id);
  const sellerReviews = reviewService.getReviewsBySeller(listing.sellerId);
  const sellerTrust = reviewService.getSellerTrustProfile(listing.sellerId, listing.sellerName);
  const [realReputation, setRealReputation] = useState<SellerReputationDto | null>(null);
  const [aiEstimate, setAiEstimate] = useState<any>(null);

  useEffect(() => {
    if (listing.sellerId) {
      reputationService.getSellerReputation(listing.sellerId).then((rep) => {
        if (rep) setRealReputation(rep);
      });
    }
  }, [listing.sellerId]);

  useEffect(() => {
    if (listing.id) {
      // Gọi API lấy dữ liệu chi tiết bài đăng mới nhất từ server (GET /api/v1/posts/{postId})
      postService.getListingDetail(listing.id).then((detail) => {
        if (!isOwnListing && detail?.aiSuggestedPrice) {
          setAiEstimate({
            suggestedPriceMin: Math.round(Number(detail.aiSuggestedPrice) * 0.9),
            suggestedPriceMax: Math.round(Number(detail.aiSuggestedPrice) * 1.1),
            confidenceScore: 0.95,
            reasoningNotes: 'Giá gợi ý tham khảo theo định giá hệ thống AI'
          });
        }
      }).catch(() => {});

      // Chỉ gọi API định giá nội bộ riêng tư (Owner-only) nếu người đang đăng nhập chính là người bán
      if (isOwnListing) {
        postService.getLatestPriceEstimate(listing.id).then((est) => {
          if (est) setAiEstimate(est);
        }).catch(() => {});
      } else if (listing.aiPriceEstimation) {
        setAiEstimate({
          suggestedPriceMin: listing.aiPriceEstimation.minVnd,
          suggestedPriceMax: listing.aiPriceEstimation.maxVnd,
          confidenceScore: 0.95,
          reasoningNotes: 'Giá gợi ý tham khảo theo định giá hệ thống AI'
        });
      } else if (listing.aiSuggestedPrice && listing.aiSuggestedPrice > 0) {
        setAiEstimate({
          suggestedPriceMin: Math.round(Number(listing.aiSuggestedPrice) * 0.9),
          suggestedPriceMax: Math.round(Number(listing.aiSuggestedPrice) * 1.1),
          confidenceScore: 0.95,
          reasoningNotes: 'Giá gợi ý tham khảo theo định giá hệ thống AI'
        });
      } else {
        setAiEstimate(null);
      }
    }
  }, [listing.id, isOwnListing, listing.aiSuggestedPrice, listing.aiPriceEstimation]);

  const displayReviews = reviewsTab === 'product' ? productReviews : sellerReviews;
  const avgProductRating = productReviews.length > 0
    ? (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-2xl max-w-2xl sm:max-w-[740px] w-full max-h-[88vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Header */}
        <div className="shrink-0 bg-[#fce5da] px-4 py-2.5 border-b border-[#24263e]/15 flex items-center justify-between text-[#24263e] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="bg-white text-[#24263e] text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3 h-3 text-[#24263e]" />
              {listing.conditionGrade === 'Like New' ? 'Grade A+ (99%)' : 'Grade A (95%)'}
            </span>
            <span className="text-[10px] text-[#24263e]/80 font-bold truncate max-w-[220px]">
              Mã tin: #{listing.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#24263e] hover:bg-white/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 subtle-scrollbar">
          {/* Photos Header */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#24263e]">
              <div className="flex items-center gap-1.5 bg-[#24263e] text-white px-2.5 py-1 rounded-lg shadow-xs text-[11px]">
                <Camera className="w-3 h-3 text-white" />
                <span>{lang === 'vi' ? `Ảnh Thực Tế Sản Phẩm (${galleryImages.length} ảnh)` : `Real Photos (${galleryImages.length} photos)`}</span>
              </div>
            </div>

            <div className="text-[10px] text-[#24263e]/70 hidden sm:flex items-center gap-1 font-bold">
              <Sparkles className="w-3 h-3 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Hình ảnh thực tế minh bạch từ người bán' : 'Verified authentic seller photos'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Gallery Column (6 cols) */}
              <div className="md:col-span-6 space-y-2">
                <div className="relative aspect-4/3 min-h-[240px] max-h-[340px] w-full bg-[#f8f9fa] rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center p-2">
                  <img
                    src={galleryImages[activePhotoIndex] || galleryImages[0]}
                    alt={listing.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Thumbnails (Có bao nhiêu ảnh thì hiển thị bấy nhiêu) */}
                {galleryImages.length > 1 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[#24263e]/70 flex items-center gap-1">
                      <FileCheck2 className="w-3 h-3 text-[#24263e]" />
                      <span>{lang === 'vi' ? `Danh sách ảnh thực tế (${galleryImages.length} ảnh)` : `Actual photos (${galleryImages.length})`}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {galleryImages.map((imgUrl, idx) => {
                        const isSelected = activePhotoIndex === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setActivePhotoIndex(idx)}
                            className={`relative rounded-lg overflow-hidden w-14 h-14 sm:w-16 sm:h-16 border transition-all cursor-pointer p-0.5 bg-slate-50 shrink-0 ${
                              isSelected
                                ? 'border-[#24263e] ring-2 ring-[#24263e]/40 shadow-xs scale-105'
                                : 'border-gray-200 opacity-75 hover:opacity-100 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={imgUrl}
                              alt={`Ảnh ${idx + 1}`}
                              className="w-full h-full object-contain"
                            />
                            <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded font-bold">
                              #{idx + 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Price & Seller Action Column (6 cols) */}
              <div className="md:col-span-6 flex flex-col justify-between space-y-2.5">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#24263e]/70 font-medium">
                    <span className="font-black text-[#24263e] uppercase tracking-wider">{displayBrand}</span>
                    <span>•</span>
                    <span className="truncate max-w-[150px]" title={resolved.categoryName ? `${resolved.categoryName} > ${displayCategory}` : displayCategory}>{displayCategory}</span>
                    <span>•</span>
                    <span>{listing.purchaseYear}</span>
                  </div>

                  <h1 className="text-xs sm:text-[14px] font-bold text-[#24263e] leading-snug line-clamp-2">
                    {listing.title}
                  </h1>

                  {/* Price block */}
                  <div className="bg-[#faf8f5] rounded-xl p-3 border border-gray-200 space-y-1.5">
                    {/* Dòng giá tiền lúc người bán mua và gạch ngang */}
                    {effectiveOriginalPrice > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-[#24263e]/75 font-medium">
                        <span>{lang === 'vi' ? 'Giá tiền lúc người bán mua:' : 'Original purchase price:'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="line-through font-bold text-slate-400 text-xs decoration-slate-400 decoration-1.5">
                            {formatVND(effectiveOriginalPrice)}
                          </span>
                          {discountPercent > 0 && (
                            <span className="text-[9.5px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md font-mono">
                              -{discountPercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className={effectiveOriginalPrice > 0 ? 'border-t border-dashed border-gray-200 pt-1.5' : ''}>
                      <div className="text-[10px] text-[#24263e]/70 font-medium leading-none mb-1">
                        {lang === 'vi' ? 'Giá người bán niêm yết' : 'Listing Price'}
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xl sm:text-2xl font-black text-[#c34c36] leading-tight">
                          {formatVND(listing.priceVnd)}
                        </span>
                        {effectiveOriginalPrice > 0 && (
                          <span className="text-xs text-slate-400 line-through font-semibold">
                            {formatVND(effectiveOriginalPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 pt-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Bảo lãnh Escrow 100%: Kiểm tra 48h mới giải ngân' : '100% Escrow Protection'}</span>
                    </div>
                  </div>

                  {/* AI Suggested Price Range Widget (GET /posts/{postId}/ai-price-estimation) */}
                  {aiEstimate && (aiEstimate.suggestedPriceMin || aiEstimate.suggestedPriceMax) && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-extrabold text-purple-900 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Khoảng Giá Gợi Ý Bởi AI:</span>
                        </span>
                        {aiEstimate.confidenceScore && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-200/70 text-purple-900 font-bold text-[9px]">
                            Độ tin cậy: {Math.round(aiEstimate.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-black text-purple-950 font-mono">
                        {formatVND(aiEstimate.suggestedPriceMin)} ~ {formatVND(aiEstimate.suggestedPriceMax)}
                      </div>
                      {aiEstimate.reasoningNotes && (
                        <p className="text-[10px] text-purple-800/80 leading-tight italic">
                          "{aiEstimate.reasoningNotes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Seller Card */}
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#faf8f5] to-amber-50/40 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                          {listing.sellerName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#24263e] flex items-center gap-1">
                            <span className="truncate max-w-[110px]">{listing.sellerName}</span>
                            {listing.sellerVerified && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.2 flex-wrap">
                            <span className="flex items-center text-amber-500 font-bold">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                              {listing.sellerRating}
                            </span>
                            <span>•</span>
                            <span>{sellerTrust.reviewCount} {lang === 'vi' ? 'đánh giá' : 'reviews'}</span>
                            {(listing.sellerAddress || listing.location) && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-slate-600 font-medium">
                                  <MapPin className="w-2.5 h-2.5 text-[#c34c36]" />
                                  <span>{cleanFullAddress(listing.sellerAddress || listing.location) || (lang === 'vi' ? 'Chưa cập nhật địa chỉ' : 'Address not updated')}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Trust Score Badge */}
                      <div className="text-right shrink-0">
                        {realReputation?.assessmentStatus === 'NO_TRANSACTIONS' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold shadow-2xs">
                            <Award className="w-3 h-3 text-slate-500" />
                            <span>{lang === 'vi' ? 'Người bán mới' : 'New Seller'}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#24263e] text-white shadow-xs">
                            <Award className="w-3 h-3 text-amber-300" />
                            <span className="text-[11px] font-black">
                              {realReputation?.score !== undefined && realReputation?.score !== null
                                ? realReputation.score
                                : sellerTrust.trustScore}
                            </span>
                            <span className="text-[9px] text-white/70">/100</span>
                          </div>
                        )}
                        <div className="text-[9px] font-bold text-amber-700 mt-0.5">
                          {realReputation ? getAssessmentStatusMeta(realReputation.assessmentStatus).shortLabel : sellerTrust.tier}
                        </div>
                      </div>
                    </div>

                    {/* View Seller Reviews Trigger */}
                    <div className="pt-1.5 border-t border-amber-200/50 flex items-center justify-between text-[10px]">
                      <span className="text-slate-600">
                        {lang === 'vi' ? 'Đạt chuẩn: ' : 'Pass rate: '}
                        <strong className="text-emerald-700">{sellerTrust.hubPassRate}%</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                        className="font-bold text-[#c34c36] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{lang === 'vi' ? 'Xem đánh giá buyer' : 'View feedback'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {isOwnListing ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full py-2.5 px-3 bg-blue-50 text-blue-800 rounded-xl font-bold text-xs text-center border border-blue-200 flex items-center justify-center gap-1.5">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        {lang === 'vi'
                          ? 'Đây là sản phẩm do chính bạn đăng bán'
                          : 'This is your own listing'}
                      </span>
                    </div>
                  </div>
                ) : isAdmin ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full py-2.5 px-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs text-center border border-slate-200">
                      {lang === 'vi' ? 'Quản trị viên không thể mua hàng hoặc chat' : 'Admin cannot purchase or chat'}
                    </div>
                  </div>
                ) : (localStorage.getItem(`listing_available_${listing.id}`) !== 'true' && (listing.status === 'RESERVED' || listing.backendStatus === 'RESERVED' || listing.status === 'reserved' || listing.status === 'sold' || listing.backendStatus === 'SOLD' || getBoughtListingIds().has(String(listing.id)))) ? (
                  <div className="space-y-1.5 pt-1">
                     <div className="w-full py-2.5 px-3 bg-amber-50 text-amber-800 rounded-xl font-bold text-xs text-center border border-amber-200">
                        {lang === 'vi' ? 'Sản phẩm đã có người đặt mua' : 'Item is currently reserved'}
                     </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => onBuyClick(listing)}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-xl font-black text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      <span>{lang === 'vi' ? 'Mua Hàng' : 'Buy Now'}</span>
                    </button>

                    <button
                      onClick={() => onChatClick(listing)}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#24263e] border border-slate-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>{lang === 'vi' ? 'Chat & Đàm Phán Trả Giá Với Người Bán' : 'Chat & Make Counter Offer'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(true)}
                      className="w-full py-1.5 px-3 text-slate-400 hover:text-rose-600 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Flag className="w-3 h-3" />
                      <span>{lang === 'vi' ? 'Báo cáo bài đăng vi phạm' : 'Report this listing'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          {/* AI Price Estimation & Valuation Deep-Dive */}
          {listing.aiPriceEstimation && (
            <div className="rounded-xl bg-[#faf8f5] p-3 border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-[#24263e] text-white flex items-center justify-center shadow-xs font-bold text-xs shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#24263e]">
                      {lang === 'vi' ? 'Mô Hình AI Định Giá Thị Trường SecondLife' : 'SecondLife AI Market Valuation'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[#24263e] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                  <Award className="w-3 h-3 text-white" />
                  <span>{lang === 'vi' ? 'Độ tin cậy' : 'Confidence'}: {listing.aiPriceEstimation.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-[#FFFFFF] rounded-lg p-2 border border-gray-200 shadow-2xs">
                  <div className="text-[10px] text-[#24263e]/70 font-semibold">{t.fairRange}</div>
                  <div className="text-xs sm:text-sm font-black text-[#24263e]">
                    {formatVND(listing.aiPriceEstimation.minVnd)} - {formatVND(listing.aiPriceEstimation.maxVnd)}
                  </div>
                </div>

                <div className="bg-[#FFFFFF] rounded-lg p-2 border border-gray-200 shadow-2xs">
                  <div className="text-[10px] text-[#24263e]/70 font-semibold">{t.suggestedPrice}</div>
                  <div className="text-xs sm:text-sm font-black text-[#24263e]">
                    {formatVND(listing.aiPriceEstimation.suggestedVnd)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="font-black text-[#24263e] uppercase tracking-wider text-[10px]">
              {lang === 'vi' ? 'Mô tả sản phẩm' : 'Product Description'}
            </h3>
            <div className="bg-[#faf8f5] rounded-xl p-3 border border-gray-200 text-xs text-[#24263e] space-y-1.5 leading-relaxed">
              <div className="font-bold text-[#24263e] flex items-center gap-1 text-[11px] bg-white border border-[#24263e]/20 px-2 py-0.5 rounded-md w-fit shadow-xs">
                <CheckCircle2 className="w-3 h-3 text-[#24263e]" />
                <span>{listing.declaredConditionText}</span>
              </div>
              <p className="whitespace-pre-line text-xs text-[#24263e]">
                {cleanDisplayDescription(listing.description)}
              </p>
            </div>
          </div>

          {/* Customer Reviews Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewsTab('product')}
                  className={`text-xs font-extrabold pb-0.5 transition cursor-pointer flex items-center gap-1 ${
                    reviewsTab === 'product'
                      ? 'text-[#24263e] border-b-2 border-[#c34c36]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{lang === 'vi' ? `Đánh Giá Sản Phẩm (${productReviews.length})` : `Item Reviews (${productReviews.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewsTab('seller')}
                  className={`text-xs font-extrabold pb-0.5 transition cursor-pointer flex items-center gap-1 ${
                    reviewsTab === 'seller'
                      ? 'text-[#24263e] border-b-2 border-[#c34c36]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{lang === 'vi' ? `Đánh Giá Người Bán (${sellerReviews.length})` : `Seller Reviews (${sellerReviews.length})`}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700">
                  {reviewsTab === 'product' ? `${avgProductRating} ⭐` : `${sellerTrust.rating} ⭐`}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                  className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 cursor-pointer transition"
                >
                  {lang === 'vi' ? 'Xem hồ sơ seller' : 'View profile'}
                </button>
              </div>
            </div>

            {/* List of Reviews */}
            {displayReviews.length === 0 ? (
              <div className="text-center py-5 bg-[#faf8f5] rounded-xl border border-gray-200 text-slate-400 text-xs">
                <Star className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                <p>{lang === 'vi' ? 'Chưa có đánh giá nào cho sản phẩm này.' : 'No reviews yet for this listing.'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-2.5 rounded-xl bg-[#faf8f5] border border-gray-200 space-y-1.5 hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={rev.buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                          alt={rev.buyerName}
                          className="w-6 h-6 rounded-lg object-cover border border-gray-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px] text-slate-900">{rev.buyerName}</span>
                            {rev.isVerifiedPurchase && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{lang === 'vi' ? 'Escrow' : 'Verified'}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>

                    {rev.tags && rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {rev.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.2 rounded-md bg-white border border-gray-200 text-[9px] font-semibold text-slate-600"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {rev.sellerResponse && (
                      <div className="mt-1.5 p-2 rounded-lg bg-white border-l-2 border-[#c34c36] text-[10px] space-y-0.5">
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
          <div className="p-3 rounded-xl bg-[#faf8f5] border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-[#24263e] text-xs">
                  {lang === 'vi' ? 'Dịch Vụ Kiểm Định Trung Tâm SecondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-[10px] text-[#24263e]/70 font-medium">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo mở máy soi linh kiện (sản phẩm sẽ mất trạng thái zin ban đầu), test vận hành và dán tem niêm phong NFC bảo đảm.'
                    : 'Certified engineers inspect internal hardware (disassembly voids original "zin" condition) and apply tamper-evident NFC seals.'}
                </div>
              </div>
            </div>

            <span className="text-[10px] font-black text-[#24263e] bg-white border border-[#24263e]/20 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-xs">
              {lang === 'vi' ? 'Phí kiểm định: 250,000đ' : 'Inspection: 250k VND'}
            </span>
          </div>
        </div>
      </div>

      {/* Modal Báo Cáo Bài Đăng */}
      <UserReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        postId={listing.id}
        itemTitle={listing.title}
      />
    </div>
  );
};

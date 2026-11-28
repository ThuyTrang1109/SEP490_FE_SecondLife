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
  Flag,
  Truck,
  AlertCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Listing, Language, ProductReview, UserProfile, SellerPostDetailDto } from '../../types';
import { translations, formatConditionGrade, formatVND } from '../../utils/translations';
import { cleanFullAddress, extractWardAndCity } from '../../utils/addressUtils';
import { getBoughtListingIds, getResolvedPostParcel, isPostUnderInspectionOrReturning } from '../../utils/orderUtils';
import { soundFx } from '../../utils/soundEffects';
import { reputationService, postService, SellerReputationDto, getStoredUser, getAssessmentStatusMeta, orderReviewService, SellerReviewSummaryDto } from '../../services';
import { UserReportModal } from './UserReportModal';
import { isListingInspectionPassed, getListingInspectionBadgeText } from '../../utils/listingInspection';
import { formatInspectionFailureReason } from '../../utils/inspectionPurchase';
import type { AiPriceEstimationResponse } from '../../services/postService';
import { resolveCategoryAndItem, extractSellerOriginalPrice, getPostMetadata } from '../../utils/catalogCache';
import { MarkdownContent } from '../common/MarkdownDescription';

interface ListingDetailModalProps {
  listing: Listing | null;
  currentUser?: UserProfile | null;
  initialSellerDetail?: SellerPostDetailDto | null;
  onClose: () => void;
  onBuyClick: (listing: Listing) => void;
  onChatClick: (listing: Listing) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
  isAdmin?: boolean;
  lang: Language;
}

const cleanDisplayDescription = (desc: string | undefined, lang: Language): string => {
  if (!desc) return '';
  return desc
    .replace(/<!--(?:sl_orig_price|ORIGINAL_PRICE):\d+-->/gi, '')
    .replace(/^[-*•\s]*giá\s*(?:sản\s*phẩm\s*)?lúc\s*mua\s*(?:mới)?\s*[:=–-].*$/gmi, '')
    .replace(/(https?:\/\/[^\s)]+)|\bUSED_GOOD\b/gi, (match, url?: string) => url ?? formatConditionGrade(match, lang))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  currentUser: propCurrentUser,
  initialSellerDetail,
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
  const [sellerDetail, setSellerDetail] = useState<SellerPostDetailDto | null>(initialSellerDetail ?? null);
  const [publicDetail, setPublicDetail] = useState<any | null>(null);
  const [isLoadingSellerDetail, setIsLoadingSellerDetail] = useState(false);
  const [sellerDetailError, setSellerDetailError] = useState<string | null>(null);

  const activeDetail = sellerDetail || publicDetail;
  const effectivePrice = Number(activeDetail?.price ?? listing.priceVnd);
  const effectiveTitle = activeDetail?.title || listing.title;
  const declaredCondition = activeDetail?.itemCondition || listing.declaredConditionText;
  const conditionLabel = declaredCondition === 'NEW'
    ? (lang === 'vi' ? 'Hàng mới / nguyên bản' : 'Brand New')
    : formatConditionGrade(declaredCondition, lang);

  const isOwnListing = Boolean(
    user?.id && (
      (listing.sellerId && String(user.id) === String(listing.sellerId)) ||
      (activeDetail?.sellerId && String(user.id) === String(activeDetail.sellerId)) ||
      (activeDetail?.user?.id && String(user.id) === String(activeDetail.user.id)) ||
      (user?.name && listing.sellerName && user.name.trim().toLowerCase() === listing.sellerName.trim().toLowerCase()) ||
      (user?.name && activeDetail?.user?.name && user.name.trim().toLowerCase() === activeDetail.user.name.trim().toLowerCase())
    )
  );

  const fallbackParcel = React.useMemo(() => {
    return getResolvedPostParcel(
      listing.id,
      activeDetail || listing,
      activeDetail?.description || listing.description,
      activeDetail?.category || listing.category
    );
  }, [listing, activeDetail]);

  const effectiveWeight = activeDetail?.shippingWeight != null && Number(activeDetail.shippingWeight) > 0
    ? Number(activeDetail.shippingWeight)
    : (activeDetail?.weight != null && Number(activeDetail.weight) > 0
      ? Number(activeDetail.weight)
      : (listing.shippingWeight != null && listing.shippingWeight > 0 ? listing.shippingWeight : fallbackParcel.weight));

  const effectiveLength = activeDetail?.shippingLength != null && Number(activeDetail.shippingLength) > 0
    ? Number(activeDetail.shippingLength)
    : (activeDetail?.length != null && Number(activeDetail.length) > 0
      ? Number(activeDetail.length)
      : (listing.shippingLength != null && listing.shippingLength > 0 ? listing.shippingLength : fallbackParcel.length));

  const effectiveWidth = activeDetail?.shippingWidth != null && Number(activeDetail.shippingWidth) > 0
    ? Number(activeDetail.shippingWidth)
    : (activeDetail?.width != null && Number(activeDetail.width) > 0
      ? Number(activeDetail.width)
      : (listing.shippingWidth != null && listing.shippingWidth > 0 ? listing.shippingWidth : fallbackParcel.width));

  const effectiveHeight = activeDetail?.shippingHeight != null && Number(activeDetail.shippingHeight) > 0
    ? Number(activeDetail.shippingHeight)
    : (activeDetail?.height != null && Number(activeDetail.height) > 0
      ? Number(activeDetail.height)
      : (listing.shippingHeight != null && listing.shippingHeight > 0 ? listing.shippingHeight : fallbackParcel.height));

  const effectiveStatus = (sellerDetail?.status || activeDetail?.status || listing.backendStatus || listing.status || 'ACTIVE').toUpperCase();
  const effectiveRejectionReason = formatInspectionFailureReason(sellerDetail?.rejectionReason ?? listing.rejectionReason, lang);
  const effectiveCreditCharged = sellerDetail?.listingCreditCharged ?? listing.listingCreditCharged;
  const effectiveSellerAddress = cleanFullAddress(
    activeDetail?.sellerAddress ?? activeDetail?.user?.address ?? listing.sellerAddress ?? ''
  );
  const sellerLocation = extractWardAndCity(effectiveSellerAddress);
  const displaySellerLocation = (sellerLocation || effectiveSellerAddress)
    .replace(/Thành phố Hồ Chí Minh/gi, 'TP. HCM').replace(/Thành phố Hà Nội/gi, 'Hà Nội');

  const canDisassemble = React.useMemo(() => {
    if (activeDetail?.canDisassemble !== undefined) return Boolean(activeDetail.canDisassemble);
    if ((listing as any)?.canDisassemble !== undefined) return Boolean((listing as any).canDisassemble);
    const meta = listing?.id ? getPostMetadata(listing.id) : null;
    if (meta?.canDisassemble !== undefined) return meta.canDisassemble;
    const local = listing?.id ? localStorage.getItem(`post_can_disassemble_${listing.id}`) : null;
    return local !== null ? local === 'true' : null;
  }, [listing, activeDetail]);

  const resolved = React.useMemo(() => {
    return resolveCategoryAndItem({
      postId: listing.id,
      categoryId: activeDetail?.categoryId || listing.categoryId,
      itemId: activeDetail?.itemId || listing.itemId,
      title: activeDetail?.title || listing.title,
      description: activeDetail?.description || listing.description,
      category: activeDetail?.category || listing.category,
      brand: activeDetail?.brand || listing.brand,
      model: activeDetail?.model || listing.model,
    });
  }, [listing, activeDetail]);

  const displayBrand = (listing.brand && listing.brand !== 'SecondLife' && listing.brand !== 'Hãng' ? listing.brand : resolved.brand) || 'Chính hãng';
  const displayCategory = listing.itemName || resolved.itemName || listing.category || resolved.displayCategory || 'Đồ gia dụng';

  // Giá tiền lúc người bán mua (Original purchase price) từ thông tin người bán khai báo khi tạo bài đăng
  const effectiveOriginalPrice = React.useMemo(() => {
    return extractSellerOriginalPrice(listing) || 0;
  }, [listing]);

  const discountPercent = React.useMemo(() => {
    if (!effectiveOriginalPrice || !effectivePrice || effectiveOriginalPrice <= effectivePrice) return 0;
    return Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100);
  }, [effectiveOriginalPrice, effectivePrice]);

  // Lấy chính xác danh sách ảnh thực tế của bài đăng (không nhân bản / không lặp lại ảnh)
  const galleryImages: string[] = React.useMemo(() => {
    if (activeDetail?.imageUrls && Array.isArray(activeDetail.imageUrls) && activeDetail.imageUrls.length > 0) {
      const filtered = activeDetail.imageUrls.filter(Boolean);
      if (filtered.length > 0) return Array.from(new Set(filtered));
    }
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
    return [activeDetail?.imageUrl || (listing as any).imageUrl || listing.photos?.front || 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800'];
  }, [listing, activeDetail]);

  const currentListing = React.useMemo(() => {
    if (!activeDetail) return listing;
    return {
      ...listing,
      priceVnd: effectivePrice,
      ...(activeDetail.status === 'ACTIVE' && { status: 'active' as const, backendStatus: 'ACTIVE' }),
      shippingWeight: effectiveWeight,
      shippingLength: effectiveLength,
      shippingWidth: effectiveWidth,
      shippingHeight: effectiveHeight,
      sellerAddress: effectiveSellerAddress,
      location: sellerLocation,
      sellerName: activeDetail.sellerName || activeDetail.user?.fullName || listing.sellerName,
      sellerAvatar: activeDetail.sellerAvatar || activeDetail.user?.avatarUrl || listing.sellerAvatar,
      sellerId: activeDetail.sellerId || activeDetail.user?.id || listing.sellerId,
      description: activeDetail.description || listing.description,
      title: activeDetail.title || listing.title,
      photos: {
        ...listing.photos,
        front: activeDetail.imageUrl || listing.photos?.front || galleryImages[0] || '',
      },
      photoGallery: galleryImages.length > 0 ? galleryImages : listing.photoGallery,
    };
  }, [listing, activeDetail, effectivePrice, effectiveWeight, effectiveLength, effectiveWidth, effectiveHeight, effectiveSellerAddress, sellerLocation, galleryImages]);

  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  useEffect(() => {
    setActivePhotoIndex(0);
    setPublicDetail(null);
    setSellerDetailError(null);
    setSellerReviewPage(1);
  }, [listing.id]);
  const [sellerReviewPage, setSellerReviewPage] = useState<number>(1);
  const REVIEWS_PER_PAGE = 5;
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Load verified reviews & reputation from Backend (bỏ hoàn toàn mock data)
  const [realReputation, setRealReputation] = useState<SellerReputationDto | null>(null);
  const [sellerReviewSummary, setSellerReviewSummary] = useState<SellerReviewSummaryDto | null>(null);
  const [realSellerReviews, setRealSellerReviews] = useState<ProductReview[]>([]);
  const [reviewsTotalElements, setReviewsTotalElements] = useState<number>(0);
  const [reviewsTotalPages, setReviewsTotalPages] = useState<number>(1);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(true);
  const [latestEstimate, setLatestEstimate] = useState<AiPriceEstimationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSellerReviewPage(1);
    if (listing.sellerId) {
      Promise.all([
        reputationService.getSellerReputation(listing.sellerId).catch(() => null),
        orderReviewService.getSellerSummary(listing.sellerId).catch(() => null),
      ]).then(([rep, summary]) => {
        if (cancelled) return;
        if (rep) setRealReputation(rep);
        if (summary) setSellerReviewSummary(summary);
      });
    } else {
      setRealReputation(null);
      setSellerReviewSummary(null);
    }
    return () => {
      cancelled = true;
    };
  }, [listing.sellerId]);

  useEffect(() => {
    let cancelled = false;
    if (listing.sellerId) {
      setIsLoadingReviews(true);
      orderReviewService.getSellerReviews(listing.sellerId, Math.max(0, sellerReviewPage - 1), REVIEWS_PER_PAGE)
        .then((res) => {
          if (cancelled) return;
          const items = Array.isArray((res as any)?.items) ? (res as any).items : [];
          const mapped: ProductReview[] = items.map((r: any) => ({
            id: r.id,
            orderId: r.orderId,
            listingId: r.postId || '',
            productName: r.productTitle || 'Sản phẩm giao dịch',
            productImage: r.productImage,
            sellerId: r.sellerId,
            sellerName: r.sellerName,
            buyerId: r.buyerId,
            buyerName: r.buyerName,
            buyerAvatar: r.buyerAvatar,
            rating: r.rating,
            comment: r.comment,
            tags: r.tags || [],
            photos: r.photos || [],
            createdAt: r.createdAt,
            isVerifiedPurchase: r.verifiedPurchase ?? true,
            conditionGrade: r.conditionGrade,
          }));
          setRealSellerReviews(mapped);
          const totalEl = Number((res as any)?.totalElements ?? mapped.length);
          const totalPg = Number((res as any)?.totalPages ?? Math.ceil(totalEl / REVIEWS_PER_PAGE));
          setReviewsTotalElements(Number.isFinite(totalEl) ? totalEl : mapped.length);
          setReviewsTotalPages(Math.max(1, Number.isFinite(totalPg) ? totalPg : 1));
        })
        .catch(() => {
          if (!cancelled) {
            setRealSellerReviews([]);
            setReviewsTotalElements(0);
            setReviewsTotalPages(1);
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingReviews(false);
        });
    } else {
      setIsLoadingReviews(false);
      setRealSellerReviews([]);
      setReviewsTotalElements(0);
      setReviewsTotalPages(1);
    }
    return () => {
      cancelled = true;
    };
  }, [listing.sellerId, sellerReviewPage]);

  const listingId = listing.id;
  const isPublicListing = ['ACTIVE', 'RESERVED'].includes(
    String(sellerDetail?.status ?? listing.backendStatus ?? listing.status).toUpperCase(),
  );

  useEffect(() => {
    if (!listingId || (isOwnListing && !isPublicListing)) return;
    let cancelled = false;
    void postService.getListingDetail(listingId).then((detail) => {
      if (!cancelled && detail) setPublicDetail(detail);
    });
    return () => { cancelled = true; };
  }, [listingId, isOwnListing, isPublicListing]);

  useEffect(() => {
    if (!listingId || !isOwnListing || initialSellerDetail?.id === listingId) return;
    const controller = new AbortController();
    setIsLoadingSellerDetail(true);
    setSellerDetailError(null);
    void postService.getMyPostDetail(listingId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setSellerDetail(detail);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSellerDetailError(error.message || (lang === 'vi' ? 'Không thể tải chi tiết bài đăng.' : 'Could not load the listing.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSellerDetail(false);
      });
    return () => controller.abort();
  }, [listingId, isOwnListing, initialSellerDetail, lang]);

  const hasSellerEstimate = isOwnListing && Number(sellerDetail?.aiSuggestedPrice) > 0;
  useEffect(() => {
    if (!listingId || !hasSellerEstimate) return;
    const controller = new AbortController();
    void postService.getLatestPriceEstimate(listingId, controller.signal)
      .then((estimate) => {
        if (!controller.signal.aborted) setLatestEstimate(estimate);
      })
      .catch(() => { });
    return () => controller.abort();
  }, [listingId, hasSellerEstimate]);

  const suggestedPrice = Number(sellerDetail?.aiSuggestedPrice ?? publicDetail?.aiSuggestedPrice
    ?? listing.aiPriceEstimation?.suggestedVnd ?? listing.aiSuggestedPrice ?? 0);
  const minEstimate = latestEstimate?.fairPriceMin ?? listing.aiPriceEstimation?.minVnd
    ?? 0;
  const maxEstimate = latestEstimate?.fairPriceMax ?? listing.aiPriceEstimation?.maxVnd
    ?? 0;

  // Dữ liệu đánh giá thật 100% từ Database backend qua orderReviewService (5 đánh giá / trang)
  const totalSellerEvaluated = Math.max(sellerReviewSummary?.totalReviews ?? 0, reviewsTotalElements);
  const totalReviewPages = Math.max(1, reviewsTotalPages || Math.ceil(totalSellerEvaluated / REVIEWS_PER_PAGE));
  const currentSellerPageReviews = realSellerReviews;

  const realSellerRating = (() => {
    if (sellerReviewSummary && Number(sellerReviewSummary.totalReviews) > 0) {
      return Number(sellerReviewSummary.averageRating ?? 0).toFixed(1);
    }
    if (realSellerReviews.length > 0) {
      return (realSellerReviews.reduce((sum, r) => sum + r.rating, 0) / realSellerReviews.length).toFixed(1);
    }
    return listing.sellerRating && listing.sellerRating > 0 ? String(listing.sellerRating) : null;
  })();

  const inspectionSource = isOwnListing
    ? {
        ...listing,
        ...publicDetail,
        ...sellerDetail,
        isInspected: Boolean(sellerDetail?.isInspected ?? (publicDetail?.isInspected || listing.isInspected)),
        inspectionMethod: sellerDetail?.inspectionMethod ?? publicDetail?.inspectionMethod ?? listing.inspectionMethod,
      }
    : (publicDetail ?? listing);
  const isInspected = isListingInspectionPassed(inspectionSource);
  const inspectedMethod = String(inspectionSource?.inspectionMethod || '').trim().toUpperCase();
  const isUnderInspectionOrReturning = effectiveStatus !== 'ACTIVE'
    && (effectiveStatus === 'RETURNING' || isPostUnderInspectionOrReturning(listing));
  const isUnavailableForPurchase = effectiveStatus !== 'ACTIVE' && (isUnderInspectionOrReturning
    || ['RESERVED', 'PAYMENT_PENDING', 'SOLD', 'RETURNED'].includes(effectiveStatus)
    || (localStorage.getItem(`listing_available_${listing.id}`) !== 'true'
      && getBoughtListingIds().has(String(listing.id))));

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
            {isInspected && (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-emerald-400/30">
                <ShieldCheck className="w-3 h-3 text-emerald-100" />
                <span>{getListingInspectionBadgeText(inspectedMethod, lang)}</span>
              </span>
            )}
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
                <span>{lang === 'vi' ? `Ảnh thực tế sản phẩm (${galleryImages.length} ảnh)` : `Real Photos (${galleryImages.length} photos)`}</span>
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
                  alt={effectiveTitle}
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
                          className={`relative rounded-lg overflow-hidden w-14 h-14 sm:w-16 sm:h-16 border transition-all cursor-pointer p-0.5 bg-slate-50 shrink-0 ${isSelected
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
                  {effectiveTitle}
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
                        {formatVND(effectivePrice)}
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

                {/* Verified Inspected Passed Banner */}
                {isInspected && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {inspectedMethod === 'AT_HOME'
                            ? (lang === 'vi' ? 'Sản phẩm đã đạt kiểm định tại nhà' : 'On-site Inspected & Passed Product')
                            : inspectedMethod === 'AT_CENTER'
                              ? (lang === 'vi' ? 'Sản phẩm đã đạt kiểm định tại Hub' : 'Hub Inspected & Passed Product')
                              : (lang === 'vi' ? 'Sản phẩm đã được kiểm định đạt chuẩn' : 'Inspected & Passed Product')}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold text-[9px] shadow-2xs">
                        PASSED
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-900 leading-snug">
                      {inspectedMethod === 'AT_HOME'
                        ? (lang === 'vi'
                          ? 'Thiết bị đã được kỹ thuật viên SecondLife kiểm tra kỹ thuật trực tiếp tại nhà và đạt chuẩn chất lượng giao dịch.'
                          : 'This device passed on-site technical hardware inspection by SecondLife technicians and meets verified transaction standards.')
                        : inspectedMethod === 'AT_CENTER'
                          ? (lang === 'vi'
                            ? 'Thiết bị đã vượt qua quy trình kiểm tra kỹ thuật phần cứng nghiêm ngặt tại SecondLife Hub và đạt chuẩn chất lượng giao dịch.'
                            : 'This device passed technical hardware inspection at SecondLife Hub and meets verified transaction standards.')
                          : (lang === 'vi'
                            ? 'Thiết bị đã vượt qua quy trình kiểm tra kỹ thuật phần cứng nghiêm ngặt của SecondLife và đạt chuẩn chất lượng giao dịch.'
                            : 'This device passed SecondLife technical hardware inspection and meets verified transaction standards.')}
                    </p>
                  </div>
                )}

                {(minEstimate > 0 && maxEstimate >= minEstimate) && (
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-extrabold text-purple-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Khoảng giá gợi Ý Bởi AI:</span>
                      </span>
                    </div>
                    <div className="text-xs font-black text-purple-950 font-mono">
                      {formatVND(minEstimate)} ~ {formatVND(maxEstimate)}
                    </div>
                  </div>
                )}

                {/* Seller Card */}
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#faf8f5] to-amber-50/40 border border-amber-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                        {(activeDetail?.sellerName || listing.sellerName || 'N').charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#24263e] flex items-center gap-1">
                          <span className="truncate max-w-[110px]">{activeDetail?.sellerName || listing.sellerName}</span>
                          {listing.sellerVerified && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.2 flex-wrap">
                          <span className="flex items-center text-amber-500 font-bold">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                            {realSellerRating ? `${realSellerRating} ⭐` : (listing.sellerRating || (lang === 'vi' ? 'Người bán mới' : 'New'))}
                          </span>
                          <span>•</span>
                          <span>{totalSellerEvaluated} {lang === 'vi' ? 'đánh giá' : 'reviews'}</span>
                          {displaySellerLocation && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-slate-600 font-medium">
                                <MapPin className="w-2.5 h-2.5 text-[#c34c36]" />
                                <span>{displaySellerLocation}</span>
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
                              : '--'}
                          </span>
                          <span className="text-[9px] text-white/70">/100</span>
                        </div>
                      )}
                      <div className="text-[9px] font-bold text-amber-700 mt-0.5">
                        {realReputation?.assessmentStatus ? getAssessmentStatusMeta(realReputation.assessmentStatus).shortLabel : (lang === 'vi' ? 'Người bán mới' : 'New Seller')}
                      </div>
                    </div>
                  </div>

                  {/* View Seller Reviews Trigger */}
                  <div className="pt-1.5 border-t border-amber-200/50 flex items-center justify-between text-[10px]">
                    <span className="text-slate-600">
                      {lang === 'vi' ? 'Đơn hoàn thành: ' : 'Completed: '}
                      <strong className="text-emerald-700">{realReputation?.evaluatedOrders ?? 0} đơn</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isOwnListing ? (
                <div className="space-y-2 pt-1">
                  <div className="w-full py-2.5 px-3 bg-blue-50/90 text-blue-900 rounded-xl font-bold text-xs border border-blue-200/90 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="flex items-center gap-1.5 font-black text-blue-800 text-xs">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          {lang === 'vi'
                            ? 'Đây là sản phẩm do chính bạn đăng bán'
                            : 'This is your own listing'}
                        </span>
                      </span>
                      {/* Status badge */}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs ${effectiveStatus === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : effectiveStatus === 'RETURNING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : effectiveStatus === 'RETURNED'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : effectiveStatus === 'RESERVED' || effectiveStatus === 'PAYMENT_PENDING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : effectiveStatus === 'SOLD'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : effectiveStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : effectiveStatus === 'DRAFT'
                                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                    : effectiveStatus === 'PENDING_INSPECTION' || effectiveStatus === 'READY_TO_PUBLISH'
                                      ? (isInspected || effectiveStatus === 'READY_TO_PUBLISH'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300')
                                      : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}>
                        {effectiveStatus === 'ACTIVE'
                          ? (lang === 'vi' ? '● Đang bán' : '● Active')
                          : effectiveStatus === 'RETURNING'
                            ? (lang === 'vi' ? '● Đang hoàn trả' : '● Returning')
                            : effectiveStatus === 'RETURNED'
                              ? (lang === 'vi' ? '● Đã hoàn trả' : '● Returned')
                              : effectiveStatus === 'RESERVED' || effectiveStatus === 'PAYMENT_PENDING'
                                ? (lang === 'vi' ? '● Đã đặt mua / ký quỹ' : '● Reserved')
                                : effectiveStatus === 'SOLD'
                                  ? (lang === 'vi' ? '● Đã bán' : '● Sold')
                                  : effectiveStatus === 'REJECTED'
                                    ? (lang === 'vi' ? '● Bị từ chối' : '● Rejected')
                                    : effectiveStatus === 'DRAFT'
                                      ? (lang === 'vi' ? '● Bản nháp' : '● Draft')
                                      : effectiveStatus === 'READY_TO_PUBLISH'
                                        ? (lang === 'vi' ? '● Sẵn sàng đăng bán' : '● Ready to publish')
                                        : effectiveStatus === 'PENDING_INSPECTION'
                                          ? (isInspected
                                            ? (lang === 'vi' ? '● Đã kiểm định · Chờ nhận lại hàng' : '● Inspected · Awaiting return')
                                            : (lang === 'vi' ? '● Chờ kiểm định' : '● Pending Inspection'))
                                          : (lang === 'vi' ? '● Chờ duyệt Hub' : '● Pending')}
                      </span>
                    </div>

                    {effectiveCreditCharged && (
                      <div className="text-[10.5px] text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{lang === 'vi' ? 'Đã trừ 1 lượt đăng bài' : 'Listing credit charged'}</span>
                      </div>
                    )}

                    {effectiveStatus === 'PENDING_INSPECTION' && isInspected && (
                      <div className="text-[10.5px] text-slate-600 font-medium pt-1 border-t border-blue-200/60 leading-snug">
                        {lang === 'vi'
                          ? 'Thiết bị đã đạt kiểm định. Bạn có thể tự đăng bán sau khi nhận lại hàng.'
                          : 'Inspection passed. You can publish the listing once you receive the returned item.'}
                      </div>
                    )}

                    {isLoadingSellerDetail && (
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-700 font-medium pt-0.5">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        <span>{lang === 'vi' ? 'Đang đồng bộ chi tiết mới nhất từ server...' : 'Syncing latest details from server...'}</span>
                      </div>
                    )}
                  </div>

                  {/* Rejection reason alert */}
                  {effectiveRejectionReason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{lang === 'vi' ? 'Lý do kiểm duyệt từ chối:' : 'Rejection reason:'}</span>
                      </div>
                      <p className="break-words text-[11px] leading-relaxed text-rose-700 pl-5">
                        {effectiveRejectionReason}
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {sellerDetailError && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{sellerDetailError}</span>
                    </div>
                  )}
                </div>
              ) : isAdmin ? (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full py-2.5 px-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs text-center border border-slate-200">
                    {lang === 'vi' ? 'Quản trị viên không thể mua hàng hoặc chat' : 'Admin cannot purchase or chat'}
                  </div>
                </div>
              ) : isUnavailableForPurchase ? (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full py-2.5 px-3 bg-amber-50 text-amber-800 rounded-xl font-bold text-xs text-center border border-amber-200">
                    {lang === 'vi' ? 'Sản phẩm đang trong quá trình kiểm định / hoàn trả về người bán' : 'Item is currently under inspection / returning to seller'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => onBuyClick(currentListing)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-xl font-black text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>{lang === 'vi' ? 'Mua hàng' : 'Buy Now'}</span>
                  </button>

                  <button
                    onClick={() => onChatClick(currentListing)}
                    className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#24263e] border border-slate-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Chat & đàm phán trả giá với người bán' : 'Chat & Make Counter Offer'}</span>
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
                      {lang === 'vi' ? 'Khoảng giá AI tham khảo' : 'AI price estimate'}
                    </h3>
                  </div>
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

          {/* Thông Số Kiện Hàng Vận Chuyển (Shipping & Package Specifications) */}
          <div className="rounded-xl bg-[#faf8f5] p-3 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-[#24263e] text-white flex items-center justify-center shadow-xs font-bold text-xs shrink-0">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-black text-[#24263e]">
                  {lang === 'vi' ? 'Thông số kiện hàng vận chuyển' : 'Shipping Package Specifications'}
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {lang === 'vi' ? 'Đo lường đóng gói' : 'Packaged dimensions'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs space-y-0.5">
                <span className="text-[10.5px] text-slate-500 block font-medium">
                  {lang === 'vi' ? 'Trọng lượng kiện hàng:' : 'Package Weight:'}
                </span>
                <div className="font-bold text-[#24263e] text-xs sm:text-sm font-mono">
                  {effectiveWeight != null && effectiveWeight > 0 ? (
                    <span>
                      {(effectiveWeight / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg{' '}
                      <span className="text-slate-400 font-normal text-xs font-sans">({effectiveWeight.toLocaleString('vi-VN')} g)</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium text-xs italic font-sans">
                      {lang === 'vi' ? 'Chưa cập nhật' : 'Not updated'}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs space-y-0.5">
                <span className="text-[10.5px] text-slate-500 block font-medium">
                  {lang === 'vi' ? 'Kích thước kiện (Dài × Rộng × Cao):' : 'Dimensions (L × W × H):'}
                </span>
                <div className="font-bold text-[#24263e] text-xs sm:text-sm font-mono">
                  {effectiveLength != null && effectiveWidth != null && effectiveHeight != null &&
                    effectiveLength > 0 && effectiveWidth > 0 && effectiveHeight > 0 ? (
                    <span>
                      {effectiveLength} × {effectiveWidth} × {effectiveHeight} cm
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium text-xs italic font-sans">
                      {lang === 'vi' ? 'Chưa cập nhật' : 'Not updated'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canDisassemble !== null && (
              <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                <span className="text-slate-500">{lang === 'vi' ? 'Khả năng tháo rời linh kiện:' : 'Disassembly capability:'}</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10.5px] ${canDisassemble ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'}`}>
                  {canDisassemble ? (lang === 'vi' ? '✓ Có thể tháo rời' : 'Disassemblable') : (lang === 'vi' ? 'Nguyên khối' : 'Non-disassemblable')}
                </span>
              </div>
            )}

            {effectiveSellerAddress && isOwnListing && (
              <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-gray-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                <span className="text-slate-500">{lang === 'vi' ? 'Địa chỉ hồ sơ người bán:' : 'Seller profile address:'}</span>
                <span className="font-semibold text-slate-800 truncate" title={effectiveSellerAddress}>
                  {effectiveSellerAddress}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="font-black text-[#24263e] uppercase tracking-wider text-[10px]">
              {lang === 'vi' ? 'Mô tả sản phẩm' : 'Product Description'}
            </h3>
            <div className="bg-[#faf8f5] rounded-xl p-3 border border-gray-200 text-xs text-[#24263e] space-y-1.5 leading-relaxed">
              <div className="font-bold text-[#24263e] flex items-center gap-1 text-[11px] bg-white border border-[#24263e]/20 px-2 py-0.5 rounded-md w-fit shadow-xs">
                <CheckCircle2 className="w-3 h-3 text-[#24263e]" />
                <span>{conditionLabel}</span>
              </div>
              <MarkdownContent content={cleanDisplayDescription(activeDetail?.description || listing.description, lang)} />
            </div>
          </div>

          {/* Customer Reviews Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#24263e]">
                <UserCheck className="w-4 h-4 text-[#c34c36]" />
                <span>{lang === 'vi' ? `Đánh giá người bán (${totalSellerEvaluated})` : `Seller Reviews (${totalSellerEvaluated})`}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-700 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200/80">
                  {realSellerRating ? `${realSellerRating} ⭐` : (lang === 'vi' ? 'Người bán mới' : 'New Seller')}
                </span>
              </div>
            </div>

            {/* List of Reviews */}
            {isLoadingReviews ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs bg-[#faf8f5] rounded-xl border border-gray-200">
                <Loader2 className="w-4 h-4 animate-spin text-[#c34c36]" />
                <span>{lang === 'vi' ? 'Đang tải đánh giá thực tế...' : 'Loading verified reviews...'}</span>
              </div>
            ) : realSellerReviews.length === 0 ? (
              <div className="text-center py-5 bg-[#faf8f5] rounded-xl border border-gray-200 text-slate-400 text-xs">
                <Star className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                <p>
                  {lang === 'vi'
                    ? 'Người bán chưa có nhận xét văn bản nào từ người mua.'
                    : 'No verified reviews yet for this seller.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentSellerPageReviews.map((rev) => (
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
                            className={`w-3 h-3 ${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                              }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Hiển thị sản phẩm đã mua kèm ảnh */}
                    {rev.productName && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-gray-200/90 text-[10px] text-slate-600 w-fit">
                        {rev.productImage && (
                          <img
                            src={rev.productImage}
                            alt=""
                            className="w-4 h-4 rounded object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <span>
                          {lang === 'vi' ? 'Sản phẩm đã mua:' : 'Item purchased:'}{' '}
                          <strong className="text-slate-800 font-semibold">{rev.productName}</strong>
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>

                    {rev.photos && rev.photos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {rev.photos.map((p, pIdx) => (
                          <img
                            key={pIdx}
                            src={p}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                          />
                        ))}
                      </div>
                    )}

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

                {/* Pagination Controls (5 reviews per page) */}
                {totalReviewPages > 1 && (
                  <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500 border-t border-gray-100">
                    <span className="text-[11px] font-medium text-slate-500">
                      {lang === 'vi'
                        ? `Trang ${sellerReviewPage} / ${totalReviewPages} (${totalSellerEvaluated} đánh giá)`
                        : `Page ${sellerReviewPage} of ${totalReviewPages} (${totalSellerEvaluated} reviews)`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sellerReviewPage <= 1}
                        onClick={() => setSellerReviewPage((prev) => Math.max(1, prev - 1))}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[11px] text-[#24263e] transition cursor-pointer shadow-2xs"
                      >
                        {lang === 'vi' ? '← Trước' : '← Prev'}
                      </button>
                      <span className="px-2 py-0.5 rounded-md bg-[#24263e] text-white font-black text-[11px]">
                        {sellerReviewPage}
                      </span>
                      <button
                        type="button"
                        disabled={sellerReviewPage >= totalReviewPages}
                        onClick={() => setSellerReviewPage((prev) => Math.min(totalReviewPages, prev + 1))}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[11px] text-[#24263e] transition cursor-pointer shadow-2xs"
                      >
                        {lang === 'vi' ? 'Sau →' : 'Next →'}
                      </button>
                    </div>
                  </div>
                )}
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
                  {lang === 'vi' ? 'Dịch vụ kiểm định trung tâm secondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-[10px] text-[#24263e]/70 font-medium">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo mở máy soi linh kiện (sản phẩm sẽ mất trạng thái zin ban đầu), test vận hành và dán tem niêm phong NFC bảo đảm.'
                    : 'Certified engineers inspect internal hardware (disassembly voids original "zin" condition) and apply tamper-evident NFC seals.'}
                </div>
              </div>
            </div>

            {(isUnderInspectionOrReturning) ? (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xs flex items-center gap-1.5 shrink-0 cursor-not-allowed">
                <span>{lang === 'vi' ? 'Đang kiểm định / hoàn trả' : 'Under inspection / returning'}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onChatClick(listing)}
                className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Thương lượng kiểm định' : 'Negotiate Inspection'}</span>
              </button>
            )}
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

import React, { useState, useEffect, useRef } from 'react';
import { Star, X, CheckCircle2, ShieldCheck, Sparkles, Upload, Clock, AlertTriangle, Lock, Trash2, Loader2 } from 'lucide-react';
import { EscrowOrder, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import { resolveListingCategory, resolveOrderListing } from '../../utils/catalogCache';
import { OrderReviewDto } from '../../services/orderReviewService';

interface ProductReviewModalProps {
  order: EscrowOrder;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (reviewData: {
    rating: number;
    comment: string;
    tags: string[];
    photos: string[];
  }) => Promise<void> | void;
  onDeleteReview?: () => Promise<void> | void;
  existingReview?: OrderReviewDto | null;
  isLoadingReview?: boolean;
  lang?: Language;
}

const DEFAULT_TAGS = [
  'Đúng như mô tả',
  'Máy chạy êm ái',
  'Kiểm định Hub chuẩn xác',
  'Đóng gói cẩn thận',
  'Giao hàng siêu tốc',
  'Người bán hỗ trợ nhiệt tình',
  'Ngoại hình như mới',
  'Tiết kiệm điện năng'
];

export const ProductReviewModal: React.FC<ProductReviewModalProps> = ({
  order,
  isOpen,
  onClose,
  onSubmitReview,
  onDeleteReview,
  existingReview,
  isLoadingReview = false,
  lang = 'vi'
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Đúng như mô tả',
    'Kiểm định Hub chuẩn xác'
  ]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Khởi tạo state từ existingReview nếu có
  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
      setSelectedTags(existingReview.tags && existingReview.tags.length > 0 ? existingReview.tags : ['Đúng như mô tả', 'Kiểm định Hub chuẩn xác']);
      setPhotos(existingReview.photos || []);
    } else {
      setRating(5);
      setComment('');
      setSelectedTags(['Đúng như mô tả', 'Kiểm định Hub chuẩn xác']);
      setPhotos([]);
    }
    setErrorMsg(null);
  }, [existingReview, isOpen]);

  if (!isOpen) return null;

  // Tính toán thời hạn 48h và trạng thái đóng băng
  const isEditing = Boolean(existingReview);
  const isFrozen = Boolean(existingReview && !existingReview.canEdit);
  const canDelete = Boolean(existingReview && existingReview.canDelete);

  let remainingSeconds = 0;
  if (existingReview?.remainingEditSeconds !== undefined) {
    remainingSeconds = existingReview.remainingEditSeconds;
  } else {
    const deliveredAt = order.shippingDeliveredAt
      ? new Date(order.shippingDeliveredAt).getTime()
      : new Date(order.createdAt).getTime();
    const deadline = deliveredAt + 48 * 3600 * 1000;
    remainingSeconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  }

  const hoursLeft = Math.floor(remainingSeconds / 3600);
  const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);
  const timeRemainingText = `${hoursLeft} giờ ${minutesLeft} phút`;

  const handleToggleTag = (tag: string) => {
    if (isFrozen || isSubmitting) return;
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFrozen || isSubmitting) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 4 - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setPhotos((prev) => (prev.length < 4 ? [...prev, result] : prev));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    if (isFrozen || isSubmitting) return;
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen || isSubmitting) return;

    if (!comment.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập nội dung đánh giá để giúp cộng đồng mua sắm tốt hơn!' : 'Please enter review comments!');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmitReview({
        rating,
        comment: comment.trim(),
        tags: selectedTags,
        photos
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'vi' ? 'Không thể lưu đánh giá. Vui lòng thử lại!' : 'Failed to save review!'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !onDeleteReview || isSubmitting) return;
    const confirmed = window.confirm(lang === 'vi' ? 'Bạn có chắc chắn muốn xóa đánh giá này không? Sau khi xóa bạn có thể đánh giá lại nếu vẫn trong hạn 48 giờ.' : 'Are you sure you want to delete this review?');
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await onDeleteReview();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'vi' ? 'Không thể xóa đánh giá!' : 'Failed to delete review!'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 5:
        return lang === 'vi' ? 'Tuyệt vời (Rất hài lòng)' : 'Excellent (Very Satisfied)';
      case 4:
        return lang === 'vi' ? 'Hài lòng (Đúng chất lượng)' : 'Good (Quality Met)';
      case 3:
        return lang === 'vi' ? 'Bình thường (Đạt yêu cầu)' : 'Average (Acceptable)';
      case 2:
        return lang === 'vi' ? 'Không hài lòng' : 'Poor (Below Expectation)';
      case 1:
        return lang === 'vi' ? 'Rất tệ (Sai mô tả)' : 'Terrible';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-2xl text-[#24263e] flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#fce5da] to-white shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#c34c36] text-white flex items-center justify-center shadow-sm">
              <Star className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[#24263e]">
                  {isEditing
                    ? (lang === 'vi' ? 'Chi tiết đánh giá đơn hàng' : 'Order Review Details')
                    : (lang === 'vi' ? 'Đánh giá sản phẩm & người bán' : 'Review Product & Seller')}
                </h3>
                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Đã kiểm định Escrow' : 'Verified Escrow'}</span>
                </span>
              </div>
              <p className="text-[11px] text-[#24263e]/70 font-medium">
                {lang === 'vi' ? 'Đơn hàng đã hoàn thành qua bảo lãnh Escrow' : 'Verified completed Escrow order'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 48-Hour Business Logic Notice Banner */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-slate-100 text-xs">
          {isFrozen ? (
            <div className="flex items-center gap-2 text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                <strong>Đánh giá đã được đóng băng vĩnh viễn: </strong>
                {existingReview?.editCount && existingReview.editCount >= 1
                  ? 'Bạn đã sử dụng 1 lần chỉnh sửa cho phép để đảm bảo tính minh bạch.'
                  : 'Đã quá thời hạn 48 giờ kể từ khi bưu tá giao hàng thành công.'}
              </span>
            </div>
          ) : isEditing ? (
            <div className="flex items-center justify-between gap-2 text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Chế độ chỉnh sửa:</strong> Bạn được phép sửa 1 lần duy nhất trong vòng 48 giờ sau khi nhận hàng.
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-amber-700 shrink-0 bg-white/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Còn lại: {timeRemainingText}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-emerald-900 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Thời hạn đánh giá:</strong> Bạn có thể đánh giá và chỉnh sửa 1 lần trong vòng 48 giờ kể từ lúc nhận hàng.
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0 bg-white/80 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                Còn lại: {timeRemainingText}
              </span>
            </div>
          )}
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 text-xs">
          <div className="p-5 sm:p-6 overflow-y-auto subtle-scrollbar flex-1">
            {isLoadingReview ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-[#c34c36]" />
                <span className="text-xs font-medium">Đang tải thông tin đánh giá...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* CỘT TRÁI (5/12): Snapshot + Đánh giá sao + Bảo chứng Escrow */}
                <div className="md:col-span-5 space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Product Snapshot */}
                    <div className="flex items-center gap-3 bg-[#faf8f5] p-3 rounded-2xl border border-gray-200">
                      <img
                        src={order.listing.photos.front}
                        alt={order.listing.title}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
                      />
                      <div className="overflow-hidden min-w-0">
                        <span className="text-[10px] font-bold text-[#c34c36] uppercase tracking-wider block truncate">
                          {resolveOrderListing(order.listing).brand} • {resolveListingCategory(order.listing)}
                        </span>
                        <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[150px]">{lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-700">{order.sellerName}</strong></span>
                          <span>•</span>
                          <span className="font-bold text-[#24263e]">{formatVND(order.itemPriceVnd)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Star Rating Selector */}
                    <div className="text-center py-2 space-y-2 bg-[#faf8f5]/60 rounded-2xl border border-gray-100 p-3.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {lang === 'vi' ? 'Chất lượng sản phẩm nhận được:' : 'Rate the product quality:'}
                      </label>
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isLit = (hoverRating !== null ? hoverRating : rating) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={isFrozen || isSubmitting}
                              onMouseEnter={() => !isFrozen && setHoverRating(star)}
                              onMouseLeave={() => !isFrozen && setHoverRating(null)}
                              onClick={() => {
                                if (isFrozen) return;
                                setRating(star);
                                setErrorMsg(null);
                              }}
                              className={`p-1 transition-transform ${isFrozen ? 'cursor-default' : 'hover:scale-115 cursor-pointer'} focus:outline-none`}
                              title={`${star} sao`}
                            >
                              <Star
                                className={`w-7 h-7 sm:w-8 sm:h-8 ${
                                  isLit
                                    ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                                    : 'text-gray-300'
                                } transition-colors`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-xs font-bold text-amber-600">
                        {getRatingLabel(hoverRating !== null ? hoverRating : rating)}
                      </div>
                    </div>
                  </div>

                  {/* Trust Guarantee Note */}
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-[11px] mt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      {lang === 'vi'
                        ? 'Đánh giá này được lưu vào hệ thống Backend và hiển thị công khai trên Hồ sơ người bán sau bảo chứng Escrow.'
                        : 'This review is securely recorded and displayed on the seller profile via Escrow verified purchase.'}
                    </span>
                  </div>
                </div>

                {/* CỘT PHẢI (7/12): Điểm hài lòng (Tags) + Nhận xét chi tiết + Hình ảnh thực tế */}
                <div className="md:col-span-7 space-y-3.5">
                  {/* Quick Feedback Tags */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>{lang === 'vi' ? 'Điểm bạn hài lòng nhất:' : 'What pleased you most:'}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            type="button"
                            key={tag}
                            disabled={isFrozen || isSubmitting}
                            onClick={() => handleToggleTag(tag)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition border ${
                              isFrozen ? 'cursor-default opacity-80' : 'cursor-pointer'
                            } ${
                              isSelected
                                ? 'bg-[#24263e] text-white border-[#24263e] font-bold shadow-2xs'
                                : 'bg-white text-slate-600 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment Box */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      {lang === 'vi' ? 'Nhận xét chi tiết của bạn:' : 'Your detailed review:'}
                    </label>
                    <textarea
                      rows={2}
                      disabled={isFrozen || isSubmitting}
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder={
                        lang === 'vi'
                          ? 'Hãy chia sẻ cảm nhận về tình trạng máy thực tế, khả năng vận hành, độ chính xác so với báo cáo kiểm định Hub và sự hỗ trợ của người bán...'
                          : 'Share your thoughts on the real condition, operation, Hub inspection accuracy, and seller support...'
                      }
                      className={`w-full p-2.5 bg-[#faf8f5] border border-gray-200 rounded-2xl text-xs text-[#24263e] placeholder-gray-400 focus:outline-none focus:border-[#c34c36] transition leading-relaxed resize-none ${
                        isFrozen ? 'opacity-80 bg-gray-50 cursor-not-allowed' : ''
                      }`}
                    />
                    {errorMsg && (
                      <p className="text-[11px] text-rose-600 font-bold">{errorMsg}</p>
                    )}
                  </div>

                  {/* Photo attachments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        {lang === 'vi' ? 'Hình ảnh thực tế khi nhận máy (Tối đa 4 ảnh):' : 'Real photos upon receipt:'}
                      </label>
                      <span className="text-[10px] text-slate-400">{photos.length}/4 {lang === 'vi' ? 'ảnh' : 'photos'}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {photos.map((url, idx) => (
                        <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 group">
                          <img src={url} alt="Review attachment" className="w-full h-full object-cover" />
                          {!isFrozen && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleRemovePhoto(idx)}
                              className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-md hover:bg-black transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      {!isFrozen && photos.length < 4 && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                          />
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => fileInputRef.current?.click()}
                            className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#c34c36] flex flex-col items-center justify-center text-slate-400 hover:text-[#c34c36] bg-[#faf8f5] transition cursor-pointer"
                            title="Thêm ảnh chụp thực tế từ thiết bị"
                          >
                            <Upload className="w-4 h-4 mb-0.5" />
                            <span className="text-[9px] font-bold">{lang === 'vi' ? 'Tải ảnh' : 'Upload'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons Footer */}
          <div className="px-5 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-2.5 bg-gray-50/70 rounded-b-3xl shrink-0">
            <div>
              {canDelete && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="Xóa đánh giá này (trong vòng 48h)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{lang === 'vi' ? 'Xóa đánh giá' : 'Delete Review'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-slate-600 hover:bg-gray-100 text-xs font-semibold transition cursor-pointer"
              >
                {isFrozen ? (lang === 'vi' ? 'Đóng' : 'Close') : (lang === 'vi' ? 'Hủy bỏ' : 'Cancel')}
              </button>

              {!isFrozen && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#d6604b] text-white hover:opacity-95 text-xs font-black shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{lang === 'vi' ? 'Đang lưu...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>{isEditing ? (lang === 'vi' ? 'Lưu thay đổi (1 Lần)' : 'Save Changes') : (lang === 'vi' ? 'Gửi đánh giá ngay' : 'Submit Review')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

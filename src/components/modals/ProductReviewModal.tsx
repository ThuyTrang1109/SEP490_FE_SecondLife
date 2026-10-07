import React, { useState } from 'react';
import { Star, X, CheckCircle2, ShieldCheck, Sparkles, Upload, ThumbsUp } from 'lucide-react';
import { EscrowOrder, Language, ProductReview } from '../../types';
import { formatVND } from '../../utils/translations';

interface ProductReviewModalProps {
  order: EscrowOrder;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (reviewData: {
    rating: number;
    comment: string;
    tags: string[];
    photos: string[];
  }) => void;
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

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSimulateAddPhoto = () => {
    // Add sample photos from front/back if available or sample appliances
    const samplePool = [
      order.listing.photos.front,
      order.listing.photos.back,
      order.listing.photos.screenOrDetails,
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80'
    ].filter(Boolean);

    const nextPhoto = samplePool[photos.length % samplePool.length];
    if (photos.length < 4 && nextPhoto) {
      setPhotos((prev) => [...prev, nextPhoto]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập nội dung đánh giá để giúp cộng đồng mua sắm tốt hơn!' : 'Please enter review comments!');
      return;
    }
    onSubmitReview({
      rating,
      comment: comment.trim(),
      tags: selectedTags,
      photos
    });
    onClose();
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
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-2xl text-[#24263e] flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#fce5da] to-white shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#c34c36] text-white flex items-center justify-center shadow-sm">
              <Star className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#24263e]">
                {lang === 'vi' ? 'Đánh Giá Sản Phẩm & Người Bán' : 'Review Product & Seller'}
              </h3>
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 text-xs flex-1 overflow-y-auto subtle-scrollbar">
          {/* Product Snapshot */}
          <div className="flex items-center gap-3 bg-[#faf8f5] p-3 rounded-2xl border border-gray-200">
            <img
              src={order.listing.photos.front}
              alt={order.listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
            />
            <div className="overflow-hidden">
              <span className="text-[10px] font-bold text-[#c34c36] uppercase tracking-wider">
                {order.listing.brand} • {order.listing.category}
              </span>
              <h4 className="font-bold text-slate-900 truncate">{order.listing.title}</h4>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-700">{order.sellerName}</strong></span>
                <span>•</span>
                <span className="font-bold text-[#24263e]">{formatVND(order.itemPriceVnd)}</span>
              </div>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center py-2 space-y-2 bg-[#faf8f5]/60 rounded-2xl border border-gray-100 p-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {lang === 'vi' ? 'Chất lượng sản phẩm nhận được:' : 'Rate the product quality:'}
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => {
                      setRating(star);
                      setErrorMsg(null);
                    }}
                    className="p-1 transition-transform hover:scale-115 cursor-pointer focus:outline-none"
                    title={`${star} sao`}
                  >
                    <Star
                      className={`w-8 h-8 ${
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

          {/* Quick Feedback Tags */}
          <div className="space-y-2">
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
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition cursor-pointer border ${
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
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {lang === 'vi' ? 'Nhận xét chi tiết của bạn:' : 'Your detailed review:'}
            </label>
            <textarea
              rows={3}
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
              className="w-full p-3.5 bg-[#faf8f5] border border-gray-200 rounded-2xl text-xs text-[#24263e] placeholder-gray-400 focus:outline-none focus:border-[#c34c36] transition leading-relaxed resize-none"
            />
            {errorMsg && (
              <p className="text-[11px] text-rose-600 font-bold">{errorMsg}</p>
            )}
          </div>

          {/* Photo attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {lang === 'vi' ? 'Hình ảnh thực tế khi nhận máy (Tối đa 4 ảnh):' : 'Real photos upon receipt:'}
              </label>
              <span className="text-[10px] text-slate-400">{photos.length}/4 {lang === 'vi' ? 'ảnh' : 'photos'}</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {photos.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={url} alt="Review attachment" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-md hover:bg-black transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={handleSimulateAddPhoto}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#c34c36] flex flex-col items-center justify-center text-slate-400 hover:text-[#c34c36] bg-[#faf8f5] transition cursor-pointer"
                  title="Thêm ảnh chụp thực tế"
                >
                  <Upload className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-bold">{lang === 'vi' ? 'Thêm ảnh' : 'Add photo'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Trust Guarantee Note */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {lang === 'vi'
                ? 'Đánh giá này sẽ được gắn nhãn "Đã mua bảo chứng Escrow & Kiểm định Hub" để tăng độ tin cậy tuyệt đối cho cộng đồng mua sắm SecondLife.'
                : 'This review will carry the "Escrow & Hub Verified Purchase" badge to ensure high community trust.'}
            </span>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white hover:opacity-95 text-xs font-black shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{lang === 'vi' ? 'Gửi Đánh Giá Ngay' : 'Submit Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

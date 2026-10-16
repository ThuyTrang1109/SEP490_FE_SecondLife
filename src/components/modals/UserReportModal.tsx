import React, { useState } from 'react';
import {
  AlertTriangle,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ShieldAlert,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import {
  userReportService,
  ReportReasonCode,
  CreateReportRequestDto
} from '../../services/userReportService';

interface UserReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  orderId?: string;
  itemTitle?: string;
  onSuccess?: () => void;
}

const REPORT_REASONS: { code: ReportReasonCode; label: string; desc: string }[] = [
  {
    code: 'MISLEADING_DESCRIPTION',
    label: 'Mô tả sai lệch / không đúng thực tế',
    desc: 'Thông tin sản phẩm, tình trạng hoặc thông số kỹ thuật bị khai man, che giấu lỗi.',
  },
  {
    code: 'COUNTERFEIT',
    label: 'Hàng giả / hàng nhái',
    desc: 'Sản phẩm không chính hãng, nghi ngờ hàng nhái hoặc vi phạm bản quyền.',
  },
  {
    code: 'FRAUD',
    label: 'Dấu hiệu lừa đảo',
    desc: 'Yêu cầu chuyển tiền ngoài sàn, thông tin thanh toán gian lận hoặc mạo danh.',
  },
  {
    code: 'ITEM_NOT_RECEIVED',
    label: 'Chưa nhận được hàng',
    desc: 'Đơn hàng quá hạn cam kết nhưng chưa nhận được sản phẩm từ người bán/vận chuyển.',
  },
  {
    code: 'RETURN_NOT_AS_DESCRIBED',
    label: 'Hàng nhận được hư hỏng / khác biệt',
    desc: 'Sản phẩm nhận được bị nứt vỡ, thiếu phụ kiện hoặc khác biệt hoàn toàn với tin đăng.',
  },
  {
    code: 'LATE_HANDOVER',
    label: 'Chậm bàn giao hàng hóa',
    desc: 'Người bán không chịu gửi hàng đúng hạn cho đơn vị vận chuyển hoặc Hub kiểm định.',
  },
  {
    code: 'SELLER_CANCELLATION',
    label: 'Người bán tự ý hủy giao dịch',
    desc: 'Hủy đơn vô cớ hoặc ép người mua hủy đơn ngoài hệ thống.',
  },
  {
    code: 'OTHER',
    label: 'Lý do khác',
    desc: 'Các hành vi vi phạm tiêu chuẩn cộng đồng hoặc tranh chấp khác.',
  },
];

export const UserReportModal: React.FC<UserReportModalProps> = ({
  isOpen,
  onClose,
  postId,
  orderId,
  itemTitle,
  onSuccess,
}) => {
  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('MISLEADING_DESCRIPTION');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`File "${file.name}" vượt quá kích thước 15MB cho phép.`);
        }
        const res = await userReportService.uploadEvidence(file);
        if (res?.evidenceUrl) {
          setEvidenceUrls((prev) => [...prev, res.evidenceUrl]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải lên file bằng chứng.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (description.trim().length < 10) {
      setErrorMessage('Vui lòng mô tả chi tiết lý do khiếu nại (tối thiểu 10 ký tự).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateReportRequestDto = {
        postId: postId || undefined,
        orderId: orderId || undefined,
        reasonCode,
        description: description.trim(),
        evidenceUrls,
      };

      await userReportService.createReport(payload);
      setSuccessMessage('Khiếu nại của bạn đã được ghi nhận vào hệ thống. Bộ phận Trust & Safety sẽ xem xét và phản hồi trong vòng 24 giờ.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Gửi khiếu nại thất bại. Vui lòng thử lại sau.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl text-[#24263e] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#24263e]">Báo Cáo & Khiếu Nại</h3>
              <p className="text-[11px] text-slate-500">Bảo vệ quyền lợi người dùng sàn SecondLife</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Target Info */}
        {(itemTitle || postId || orderId) && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs shrink-0">
            <span className="text-slate-400 font-medium">Đối tượng khiếu nại:</span>
            <div className="font-bold text-slate-800 line-clamp-1 mt-0.5">
              {itemTitle ? itemTitle : postId ? `Tin đăng: #${postId}` : `Đơn hàng: #${orderId}`}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Lý do khiếu nại <span className="text-rose-500">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReportReasonCode)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-semibold text-slate-800"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 italic">
              {REPORT_REASONS.find((r) => r.code === reasonCode)?.desc}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Mô tả chi tiết vi phạm <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Tối thiểu 10 ký tự</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vui lòng cung cấp chi tiết sự việc, mốc thời gian, nội dung tin nhắn hoặc sai khác thực tế..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] leading-relaxed"
            />
          </div>

          {/* Private Evidence Upload */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Tải file bằng chứng riêng tư (ảnh, video nhận hàng)</span>
              <span className="text-[10px] text-slate-400 font-normal">Tối đa 15MB/file</span>
            </label>

            <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center justify-center space-y-1">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-400" />
                )}
                <div className="text-[11px] font-bold text-slate-700">
                  {isUploading ? 'Đang mã hóa & tải bằng chứng lên...' : 'Bấm để chọn file hoặc kéo thả ảnh/video vào đây'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Hỗ trợ JPG, PNG, WEBP, MP4 (Bảo mật riêng tư chỉ Staff/Admin xem xét)
                </div>
              </div>
            </div>

            {/* Evidence List */}
            {evidenceUrls.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Đã tải lên ({evidenceUrls.length} tệp)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {evidenceUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-mono text-slate-600 truncate">
                          {url.split('/').pop() || `Tệp ${idx + 1}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(idx)}
                        className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || description.trim().length < 10}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Gửi Khiếu Nại Vi Phạm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

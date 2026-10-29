import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Video,
  Image as ImageIcon,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText
} from 'lucide-react';
import {
  userReportService,
  videoService,
  ReportSubmissionResponse
} from '../../services';

interface SellerDisputeResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  orderId?: string;
  onSuccess?: () => void;
}

export const SellerDisputeResponseModal: React.FC<SellerDisputeResponseModalProps> = ({
  isOpen,
  onClose,
  reportId,
  orderId,
  onSuccess,
}) => {
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Past responses from this seller
  const [pastResponses, setPastResponses] = useState<ReportSubmissionResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    if (isOpen && reportId) {
      setDescription('');
      setEvidenceUrls([]);
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadProgress(null);

      // Load existing seller responses
      setLoadingResponses(true);
      userReportService
        .getReportResponses(reportId, 0, 50)
        .then((res) => {
          setPastResponses(res.items || []);
        })
        .catch((err) => {
          console.warn('Could not load past responses:', err);
        })
        .finally(() => {
          setLoadingResponses(false);
        });
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  // Handle uploading files (images or video)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('video/')) {
          // Direct chunked video upload
          setUploadProgress(0);
          const vRes = await videoService.uploadVideoChunked(file, (pct) => {
            setUploadProgress(pct);
          });
          if (vRes?.evidenceUrl) {
            setEvidenceUrls((prev) => [...prev, vRes.evidenceUrl]);
          }
          setUploadProgress(null);
        } else {
          // Private image upload
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`Ảnh "${file.name}" vượt quá kích thước 10MB.`);
          }
          const imgRes = await userReportService.uploadEvidence(file);
          if (imgRes?.evidenceUrl) {
            setEvidenceUrls((prev) => [...prev, imgRes.evidenceUrl]);
          }
        }
      }
    } catch (err: any) {
      console.error('Evidence upload error:', err);
      setErrorMessage(err?.message || 'Không thể tải lên file bằng chứng.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Vui lòng nhập nội dung giải trình hoặc mô tả quy trình đóng gói.');
      return;
    }
    if (description.trim().length > 2000) {
      setErrorMessage('Nội dung phản hồi không được vượt quá 2000 ký tự.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await userReportService.submitReportResponse(reportId, {
        description: description.trim(),
        evidenceUrls,
      });
      setSuccessMessage('Đã gửi phản hồi và bằng chứng đóng gói thành công đến ban trọng tài!');
      setDescription('');
      setEvidenceUrls([]);
      if (onSuccess) onSuccess();

      // Refresh responses
      const res = await userReportService.getReportResponses(reportId, 0, 50);
      setPastResponses(res.items || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gửi phản hồi thất bại. Có thể hồ sơ khiếu nại đã được chốt phán quyết.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#c34c36]" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                Phản Hồi Khiếu Nại & Cung Cấp Bằng Chứng Đóng Gói
              </h3>
              <p className="text-[11px] text-slate-400">
                Đơn hàng #{orderId ? orderId.substring(0, 8) : 'N/A'} — Hồ sơ #{reportId.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmitResponse} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Nội dung giải trình & chứng minh đóng gói <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả tình trạng hàng hóa trước khi bàn giao cho bưu tá, quy trình niêm phong kiện hàng..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#c34c36] focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {description.length} / 2000 ký tự
              </span>
            </div>

            {/* Evidence Upload */}
            <div className="space-y-2">
              <label className="font-bold text-slate-800 block">
                Tải lên video khui / đóng gói và ảnh niêm phong (tối đa 10 tệp):
              </label>

              <div className="border-2 border-dashed border-slate-200 hover:border-[#c34c36] rounded-xl p-4 text-center transition cursor-pointer bg-slate-50/50">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileUpload}
                  disabled={isUploading || isSubmitting}
                  className="hidden"
                  id="seller-evidence-input"
                />
                <label
                  htmlFor="seller-evidence-input"
                  className="cursor-pointer flex flex-col items-center gap-1.5"
                >
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="font-bold text-slate-700">
                    Bấm vào đây để tải ảnh hoặc video quy trình đóng gói
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Hỗ trợ ảnh JPEG, PNG, WebP (&lt;10MB) và video MP4, WebM (upload phân đoạn bảo mật)
                  </span>
                </label>
              </div>

              {isUploading && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>
                    {uploadProgress != null
                      ? `Đang tải video lên máy chủ đám mây (${uploadProgress}%)...`
                      : 'Đang mã hóa và tải tệp bằng chứng...'}
                  </span>
                </div>
              )}

              {/* Uploaded Evidence Previews */}
              {evidenceUrls.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 block">
                    Đã chọn {evidenceUrls.length} tệp bằng chứng:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {evidenceUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-[11px]"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span className="font-mono text-slate-700">Tệp #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvidence(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploading || !description.trim()}
                className="px-5 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi Ban Trọng Tài</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Past Seller Responses List */}
          {pastResponses.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <h4 className="font-bold text-xs text-slate-800">
                Các phản hồi bạn đã gửi trước đó ({pastResponses.length}):
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pastResponses.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Đã nộp</span>
                      <span>{new Date(r.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-700">"{r.description}"</p>
                    {r.evidenceUrls && r.evidenceUrls.length > 0 && (
                      <span className="text-[10px] text-slate-500 block font-bold">
                        Đính kèm {r.evidenceUrls.length} tệp bằng chứng
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

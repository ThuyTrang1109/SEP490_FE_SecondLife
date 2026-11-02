import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FileText,
  User,
  Calendar,
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';

interface CenterReviewAppealModalProps {
  order: InspectionOrderDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: InspectionOrderDto) => void;
}

export const CenterReviewAppealModal: React.FC<CenterReviewAppealModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<'UPHELD' | 'OVERTURNED'>('UPHELD');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Parse evidence URLs if stringified
  let evidenceList: string[] = [];
  if (order.appealEvidenceJson) {
    try {
      const parsed = JSON.parse(order.appealEvidenceJson);
      if (Array.isArray(parsed)) {
        evidenceList = parsed;
      }
    } catch {
      // ignore
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      setErrorMessage('Vui lòng nhập căn cứ phân xử chi tiết của Trung tâm.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await inspectorService.reviewAppeal(order.id, {
        decision,
        resolutionNote: resolutionNote.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu phán quyết khiếu nại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                Phê Duyệt Khiếu Nại Kiểm Định
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Đơn hàng: {order.postTitle || order.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Side by side comparison: Inspector vs Seller */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inspector side */}
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Kết Luận Kỹ Thuật Viên
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  FAILED
                </span>
              </div>

              <div className="text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">KTV phụ trách:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {order.inspectorName || 'Kỹ thuật viên trạm'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Điểm đánh giá:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {order.conditionScore ?? 'Chưa chấm'}/100 ({order.conditionGrade || 'POOR'})
                  </span>
                </div>
                {order.videoProofUrl && (
                  <div className="pt-2">
                    <a
                      href={order.videoProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Xem video kiểm định / bóc seal của KTV
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Seller side */}
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Nội Dung Khiếu Nại Của Người Bán
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {order.appealStatus || 'PENDING_REVIEW'}
                </span>
              </div>

              <div className="text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Người nộp:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {order.sellerName || 'Người bán'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs block">Lý do khiếu nại:</span>
                  <p className="mt-1 p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 leading-relaxed font-medium">
                    {order.appealReason || 'Không có lý do chi tiết'}
                  </p>
                </div>

                {evidenceList.length > 0 && (
                  <div className="pt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Chứng cứ đối soát ({evidenceList.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {evidenceList.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 text-xs text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Bằng chứng #{idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Decision Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Phán quyết của Trung tâm:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision('UPHELD')}
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 ${
                  decision === 'UPHELD'
                    ? 'border-red-500 bg-red-50/60 dark:bg-red-950/30 dark:border-red-600 ring-2 ring-red-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="p-2 rounded-xl bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-red-900 dark:text-red-200">
                    Bác bỏ khiếu nại (UPHELD)
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300/80 mt-1 leading-relaxed">
                    Giữ nguyên kết luận FAILED của KTV. Tự động áp dụng khấu trừ điểm uy tín người bán.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('OVERTURNED')}
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 ${
                  decision === 'OVERTURNED'
                    ? 'border-green-500 bg-green-50/60 dark:bg-green-950/30 dark:border-green-600 ring-2 ring-green-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="p-2 rounded-xl bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-green-900 dark:text-green-200">
                    Chấp thuận khiếu nại (OVERTURNED)
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300/80 mt-1 leading-relaxed">
                    Xác nhận kết luận kiểm định có sai lệch. Miễn trừ phạt uy tín và hoàn cọc cho người bán.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Resolution Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Căn cứ phân xử và kết luận chính thức <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Ghi rõ nhận định của Ban Giám đốc: đối soát video bóc seal, kiểm tra hóa đơn, lý do đưa ra phán quyết..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !resolutionNote.trim()}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-sm transition ${
              decision === 'OVERTURNED'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu phán quyết...</span>
              </>
            ) : (
              <span>
                {decision === 'OVERTURNED'
                  ? 'Chấp Thuận Khiếu Nại (OVERTURNED)'
                  : 'Bác Bỏ Khiếu Nại (UPHELD)'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


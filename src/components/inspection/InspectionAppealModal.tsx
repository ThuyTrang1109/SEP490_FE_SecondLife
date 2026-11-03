import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Upload,
  FileCheck,
  CheckSquare,
  Square,
  Loader2,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { mediaService } from '../../services/mediaService';

interface InspectionAppealModalProps {
  order: InspectionOrderDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: InspectionOrderDto) => void;
}

interface ChecklistItemDto {
  itemId?: string;
  id?: string;
  itemTitle?: string;
  name?: string;
  passed?: boolean;
  isPassed?: boolean;
  inspectorNote?: string;
}

export const InspectionAppealModal: React.FC<InspectionAppealModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [contestedItemIds, setContestedItemIds] = useState<string[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse failed checklist items from order
  const failedItems = useMemo<ChecklistItemDto[]>(() => {
    if (!order.checklistResultJson) return [];
    try {
      const parsed = JSON.parse(order.checklistResultJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((it: any) => it.passed === false || it.isPassed === false);
      }
    } catch (e) {
      // ignore
    }
    return [];
  }, [order.checklistResultJson]);

  if (!isOpen) return null;

  const toggleItem = (itemId: string) => {
    setContestedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setErrorMessage(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await mediaService.uploadImage(file, 'secondlife/inspections/appeals');
        if (res && res.url) {
          setEvidenceUrls((prev) => [...prev, res.url]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi tải ảnh bằng chứng lên.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddUrl = () => {
    if (!newUrlInput.trim()) return;
    try {
      new URL(newUrlInput.trim());
      setEvidenceUrls((prev) => [...prev, newUrlInput.trim()]);
      setNewUrlInput('');
    } catch {
      setErrorMessage('URL không hợp lệ. Vui lòng nhập link đầy đủ (ví dụ: https://...)');
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Vui lòng nêu rõ lý do bạn khiếu nại kết quả kiểm định.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await inspectorService.submitAppeal(order.id, {
        reason: reason.trim(),
        contestedItemIds: contestedItemIds.length > 0 ? contestedItemIds : undefined,
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
        note: note.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gửi khiếu nại thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                Khiếu Nại Kết Quả Kiểm Định
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Alert Notice */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-bold">Lưu ý quan trọng:</span> Bạn có 24 giờ kể từ khi có kết quả
            kiểm định để gửi khiếu nại. Ban Giám đốc Trung tâm Kiểm định sẽ đối soát lại báo cáo,
            video unboxing của kỹ thuật viên cùng các chứng cứ bạn cung cấp để ra phán quyết cuối cùng.
          </div>

          {/* Failed Checklist Items Selection */}
          {failedItems.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Chọn các tiêu chí bạn không đồng tình với KTV ({failedItems.length} mục không đạt):
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {failedItems.map((item, idx) => {
                  const itemId = item.itemId || item.id || `item_${idx}`;
                  const title = item.itemTitle || item.name || `Tiêu chí kiểm định #${idx + 1}`;
                  const isChecked = contestedItemIds.includes(itemId);

                  return (
                    <div
                      key={itemId}
                      onClick={() => toggleItem(itemId)}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition flex items-start gap-3 ${
                        isChecked
                          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 dark:border-primary-600'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-primary-600 dark:text-primary-400 flex-shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{title}</div>
                        {item.inspectorNote && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            KTV ghi nhận: {item.inspectorNote}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appeal Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Lý do khiếu nại <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nêu rõ lý do và căn cứ bạn cho rằng kết luận kiểm định chưa chính xác (ví dụ: máy nguyên bản chưa sửa chữa, có hóa đơn mua hàng chính hãng...)"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Hình ảnh & Chứng cứ đối soát
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 cursor-pointer transition">
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  ) : (
                    <Upload className="w-4 h-4 text-primary-500" />
                  )}
                  <span>{uploadingImage ? 'Đang tải lên...' : 'Tải ảnh hóa đơn / bằng chứng'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingImage || submitting}
                    className="hidden"
                  />
                </label>

                <span className="text-xs text-gray-400">hoặc</span>

                <div className="flex-1 flex gap-1.5">
                  <input
                    type="url"
                    value={newUrlInput}
                    onChange={(e) => setNewUrlInput(e.target.value)}
                    placeholder="Dán link video/ảnh Google Drive/Cloud"
                    className="flex-1 px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition"
                  >
                    Thêm link
                  </button>
                </div>
              </div>

              {/* Uploaded evidences preview */}
              {evidenceUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {evidenceUrls.map((url, index) => (
                    <div
                      key={index}
                      className="relative group p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center gap-2 overflow-hidden"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary-600 dark:text-primary-400 truncate flex-1 hover:underline"
                      >
                        Bằng chứng #{index + 1}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(index)}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-80 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Ghi chú thêm (không bắt buộc)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thông tin liên hệ bổ sung hoặc thời gian phản hồi mong muốn..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
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
            disabled={submitting || !reason.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi khiếu nại...</span>
              </>
            ) : (
              <span>Gửi Khiếu Nại (24h)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


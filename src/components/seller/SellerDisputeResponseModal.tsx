import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  FileText,
  MessageSquare,
  Plus
} from 'lucide-react';
import { createReportRequestId } from '../../services/userReportService';
import {
  userReportService,
  videoService,
  ReportSubmissionResponse
} from '../../services';
import { DisputeEvidenceThumbnail } from '../common/DisputeEvidenceThumbnail';
import { formatDisputeReason, type getSellerDisputeResponseState } from '../../utils/orders/orderDispute';
import {
  REPORT_EVIDENCE_IMAGE_MAX_MB,
  REPORT_EVIDENCE_MAX_FILES,
  REPORT_EVIDENCE_VIDEO_ACCEPT,
  REPORT_EVIDENCE_VIDEO_MAX_MB,
  REPORT_EVIDENCE_VIDEO_MAX_SECONDS,
  validateReportEvidenceFiles,
} from '../../utils/reportEvidenceLimits';

type ResponseState = ReturnType<typeof getSellerDisputeResponseState>;

interface SellerDisputeResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  orderId?: string;
  onSuccess?: () => void;
  participant?: 'buyer' | 'seller';
  responseState?: ResponseState;
  complaintReasonLabel?: string;
  responseDeadline?: string;
}

export const SellerDisputeResponseModal: React.FC<SellerDisputeResponseModalProps> = ({
  isOpen,
  onClose,
  reportId,
  orderId,
  onSuccess,
  participant = 'seller',
  responseState = 'available',
  complaintReasonLabel,
  responseDeadline,
}) => {
  const isBuyer = participant === 'buyer';
  const uploadId = React.useId();
  const request = React.useRef<{ key: string; id: string } | null>(null);
  const [serverResponseState, setServerResponseState] = useState<Exclude<ResponseState, 'available'> | null>(null);
  const currentResponseState = serverResponseState ?? responseState;
  const readOnly = currentResponseState !== 'available';
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Original dispute detail
  const [reportDetail, setReportDetail] = useState<{
    reasonCode?: string;
    description?: string;
    evidenceUrls?: string[];
  } | null>(null);

  // Past responses from this seller
  const [pastResponses, setPastResponses] = useState<ReportSubmissionResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ kind: 'IMAGE' | 'VIDEO'; src: string } | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewMedia) {
          setPreviewMedia(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewMedia, onClose]);

  useEffect(() => {
    if (!isOpen || !reportId) return;
    let active = true;
    setDescription('');
    setPastResponses([]);
    setReportDetail(null);
    setServerResponseState(null);
    request.current = null;
    setEvidenceUrls([]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(null);
    setLoadingResponses(true);
    setLoadingDetail(true);

    // Fetch report detail (Buyer claim info)
    const loadDetail = async () => {
      try {
        if (!isBuyer) {
          try {
            const sellerDetail = await userReportService.getSellerDisputeDetail(reportId);
            if (active && sellerDetail) {
              setReportDetail({
                reasonCode: sellerDetail.reasonCode,
                description: sellerDetail.description,
                evidenceUrls: sellerDetail.buyerEvidenceUrls || [],
              });
              if ((sellerDetail as any).status && (sellerDetail as any).status !== 'OPEN') {
                setServerResponseState('closed');
              }
              return;
            }
          } catch (sellerErr) {
            console.warn('getSellerDisputeDetail error, trying getReportById fallback:', sellerErr);
          }
        }
        const rep = await userReportService.getReportById(reportId);
        if (active && rep) {
          setReportDetail({
            reasonCode: rep.reasonCode,
            description: rep.description,
            evidenceUrls: rep.evidenceUrls || (rep as any).buyerEvidenceUrls || [],
          });
          if (rep.status && rep.status !== 'OPEN') {
            setServerResponseState('closed');
          }
        }
      } catch (err) {
        console.warn('Could not load report detail:', err);
      } finally {
        if (active) setLoadingDetail(false);
      }
    };
    void loadDetail();

    // Fetch existing responses
    userReportService
      .getReportResponses(reportId, 0, 50)
      .then((response) => {
        if (active) setPastResponses(response.items ?? []);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Không tải được phản hồi đã gửi.');
      })
      .finally(() => {
        if (active) setLoadingResponses(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, reportId, isBuyer]);

  if (!isOpen) return null;

  // Handle uploading files (images or video)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (readOnly || !files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(null);

    try {
      const accepted = await validateReportEvidenceFiles(Array.from(files), evidenceUrls.length, true);
      for (const file of accepted) {
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

  const handleSubmitResponse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (readOnly || isSubmitting || isUploading) return;
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
      const key = JSON.stringify([description.trim(), evidenceUrls]);
      if (request.current?.key !== key) request.current = { key, id: createReportRequestId() };
      const response = await userReportService.submitReportResponse(reportId, {
        requestId: request.current.id,
        description: description.trim(),
        evidenceUrls,
      });
      setPastResponses((previous) => previous.some((item) => item.id === response.id) ? previous : [...previous, response]);
      request.current = null;
      setSuccessMessage('Đã gửi bằng chứng bổ sung đến nhân viên xử lý.');
      setDescription('');
      setEvidenceUrls([]);
      setIsAddingNew(false);
      if (onSuccess) onSuccess();

    } catch (err: any) {
      const message = err?.message || '';
      if (/seller response deadline has expired/i.test(message)) {
        setServerResponseState('expired');
      } else if (/open report or a report under review/i.test(message)) {
        setServerResponseState('closed');
      } else {
        setErrorMessage(message || 'Gửi phản hồi thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div
        className="relative bg-white rounded-2xl max-w-2xl w-full h-[86vh] max-h-[86vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Khóa cứng tuyệt đối ở đỉnh */}
        <div className="h-14 px-5 sm:px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 select-none z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#c34c36] shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight truncate">
                {readOnly ? 'Chi tiết khiếu nại' : isBuyer ? 'Bổ sung bằng chứng khiếu nại' : 'Phản hồi khiếu nại và cung cấp bằng chứng đóng gói'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Đơn hàng #{orderId ? orderId.substring(0, 8) : 'N/A'} — Hồ sơ #{reportId.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold transition cursor-pointer shrink-0 ml-2"
            title="Đóng modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Vùng cuộn mượt mà duy nhất */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 text-xs subtle-scrollbar">
          {readOnly && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{currentResponseState === 'expired'
                ? 'Hồ sơ đã hết hạn phản hồi. Bạn có thể xem chi tiết và các bằng chứng đã gửi.'
                : 'Hồ sơ đang thẩm định hoặc đã kết thúc. Bạn có thể xem chi tiết và các bằng chứng đã gửi.'}</span>
            </div>
          )}
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

          {/* 1. THÔNG TIN & BẰNG CHỨNG KHIẾU NẠI TỪ NGƯỜI MUA (DÀNH CHO NGƯỜI BÁN ĐỐI CHIẾU) */}
          {!isBuyer && (
            <div className="p-4 bg-blue-50/70 border border-blue-200/90 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 pb-2 flex-wrap">
                <div className="flex items-center gap-2 text-blue-950 font-extrabold text-xs">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>KHIẾU NẠI TỪ NGƯỜI MUA:</span>
                  {(complaintReasonLabel || reportDetail?.reasonCode) && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-extrabold border border-blue-200">
                      {complaintReasonLabel || formatDisputeReason(reportDetail?.reasonCode)}
                    </span>
                  )}
                </div>
                {responseDeadline && (
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Hạn phản hồi: {new Date(responseDeadline).toLocaleString('vi-VN')}</span>
                  </span>
                )}
              </div>

              {loadingDetail ? (
                <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Đang tải thông tin khiếu nại của người mua...</span>
                </div>
              ) : reportDetail ? (
                <div className="space-y-2.5">
                  {/* Nội dung mô tả của người mua */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                      Nội dung người mua khiếu nại:
                    </span>
                    <div className="p-3 bg-white rounded-xl border border-blue-100 text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                      "{reportDetail.description || 'Không có mô tả chi tiết'}"
                    </div>
                  </div>

                  {/* Bằng chứng người mua cung cấp */}
                  {reportDetail.evidenceUrls && reportDetail.evidenceUrls.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                          Video / Ảnh người mua cung cấp ({reportDetail.evidenceUrls.length} tệp):
                        </span>
                        <span className="text-[10px] text-slate-400">Bấm vào tệp để xem phóng to</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-0.5">
                        {reportDetail.evidenceUrls.map((url, idx) => (
                          <DisputeEvidenceThumbnail
                            key={`buyer-ev-${url}-${idx}`}
                            url={url}
                            idx={idx}
                            size="md"
                            labelPrefix="Bằng chứng người mua"
                            onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded-xl border border-blue-100">
                  Chưa có thông tin khiếu nại từ người mua.
                </p>
              )}
            </div>
          )}

          {/* 2. NỘI DUNG VÀ BẰNG CHỨNG PHẢN HỒI CỦA NGƯỜI BÁN (SELLER) */}
          {loadingResponses ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#c34c36] mx-auto" />
              <span className="text-xs text-slate-500 font-medium">Đang tải phản hồi của người bán...</span>
            </div>
          ) : pastResponses.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    {isBuyer ? 'Bằng chứng & Phản hồi đã nộp' : 'Phản hồi & Bằng chứng đóng gói của Người bán'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {pastResponses.length} lượt đã gửi
                  </span>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(!isAddingNew)}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 text-[#c34c36] text-[11px] font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    {isAddingNew ? (
                      <span>Đóng form nhập</span>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Bổ sung thêm</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {pastResponses.map((r, rIdx) => (
                <div
                  key={r.id || rIdx}
                  className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[11px] border-b border-emerald-100 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isBuyer ? 'Lượt phản hồi' : 'Người bán đã gửi'} #{rIdx + 1}</span>
                    </div>
                    <span className="text-slate-500 text-[10px] font-mono">
                      {new Date(r.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  {/* Nội dung giải trình */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider block">
                      Nội dung giải trình & chứng minh đóng gói:
                    </span>
                    <div className="p-3 bg-white rounded-xl border border-emerald-100 text-xs text-slate-800 leading-relaxed font-normal shadow-2xs whitespace-pre-wrap">
                      "{r.description}"
                    </div>
                  </div>

                  {/* Ảnh / Video bằng chứng quy trình đóng gói */}
                  {r.evidenceUrls && r.evidenceUrls.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider">
                          Video / Ảnh quy trình đóng gói ({r.evidenceUrls.length} tệp):
                        </span>
                        <span className="text-[10px] text-slate-400">Bấm vào tệp để xem phóng to</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-0.5">
                        {r.evidenceUrls.map((url, idx) => (
                          <DisputeEvidenceThumbnail
                            key={`past-${url}-${idx}`}
                            url={url}
                            idx={idx}
                            size="md"
                            labelPrefix="Bằng chứng đóng gói"
                            onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            readOnly && (
              <div className="p-5 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-1">
                <Clock className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600">Người bán chưa gửi phản hồi hoặc bằng chứng đóng gói</p>
              </div>
            )
          )}

          {/* 2. FORM NHẬP PHẢN HỒI / BỔ SUNG BẰNG CHỨNG ĐÓNG GÓI */}
          {!readOnly && (pastResponses.length === 0 || isAddingNew) && (
            <form onSubmit={handleSubmitResponse} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                  <MessageSquare className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{pastResponses.length > 0 ? 'Bổ sung thêm bằng chứng đóng gói mới' : 'Nhập nội dung giải trình và chứng minh đóng gói'}</span>
                </div>
                {pastResponses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    Đóng form
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block text-xs">
                  {isBuyer ? 'Nội dung bổ sung' : 'Nội dung giải trình và quá trình đóng gói'} <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder={isBuyer ? 'Mô tả tình trạng hàng khi nhận và bằng chứng bổ sung' : 'Mô tả tình trạng hàng khi bàn giao, quá trình kiểm tra và đóng gói gửi hàng...'}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#c34c36] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 block text-right">
                  {description.length} / 2000 ký tự
                </span>
              </div>

              {/* Evidence Upload */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 block text-xs">
                  Ảnh hoặc video bằng chứng đóng gói (tối đa {REPORT_EVIDENCE_MAX_FILES} tệp)
                </label>

                <div className="border-2 border-dashed border-slate-200 hover:border-[#c34c36] rounded-xl p-4 text-center transition cursor-pointer bg-white">
                  <input
                    type="file"
                    multiple
                    accept={`image/jpeg,image/png,image/webp,${REPORT_EVIDENCE_VIDEO_ACCEPT}`}
                    onChange={handleFileUpload}
                    disabled={isUploading || isSubmitting}
                    className="hidden"
                    id={uploadId}
                  />
                  <label
                    htmlFor={uploadId}
                    className="cursor-pointer flex flex-col items-center gap-1.5"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="font-bold text-slate-700">
                      Bấm để tải ảnh hoặc video quy trình đóng gói
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Ảnh JPG, PNG, WebP dưới {REPORT_EVIDENCE_IMAGE_MAX_MB} MB · Video MP4, WebM, MOV dưới {REPORT_EVIDENCE_VIDEO_MAX_MB} MB và {REPORT_EVIDENCE_VIDEO_MAX_SECONDS} giây
                    </span>
                  </label>
                </div>

                {isUploading && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span className="font-medium">
                      {uploadProgress != null
                        ? (uploadProgress >= 100
                          ? 'Đang xử lý và lưu tệp video...'
                          : `Đang tải video lên máy chủ đám mây (${Math.round(uploadProgress)}%)...`)
                        : 'Đang mã hóa và tải tệp bằng chứng...'}
                    </span>
                  </div>
                )}

                {/* Uploaded Evidence Previews */}
                {evidenceUrls.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">
                        Đã chọn {evidenceUrls.length} tệp bằng chứng:
                      </span>
                      <span className="text-[10px] text-slate-400">Bấm để phóng to, bấm ✕ để gỡ tệp</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5 pt-0.5">
                      {evidenceUrls.map((url, idx) => (
                        <DisputeEvidenceThumbnail
                          key={`${url}-${idx}`}
                          url={url}
                          idx={idx}
                          labelPrefix="Bằng chứng"
                          onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                          onRemove={() => handleRemoveEvidence(idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                {pastResponses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                )}
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
                      <span>Gửi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer - Khóa cứng tuyệt đối ở đáy */}
        <div className="bg-white px-5 sm:px-6 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0 select-none z-20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* MEDIA PREVIEW MODAL */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-3 flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-2 px-1 text-white border-b border-white/10 mb-2">
              <span className="text-xs font-bold text-slate-200">
                {previewMedia.kind === 'VIDEO' ? 'Xem video bằng chứng' : 'Xem ảnh bằng chứng'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer text-xs flex items-center gap-1"
              >
                <span>Đóng</span>
                <span className="font-bold text-sm">×</span>
              </button>
            </div>
            <div className="w-full flex items-center justify-center max-h-[78vh] overflow-hidden rounded-xl bg-black/50">
              {previewMedia.kind === 'IMAGE' ? (
                <img
                  src={previewMedia.src}
                  alt="Bằng chứng"
                  className="max-h-[75vh] w-auto object-contain rounded-xl"
                />
              ) : (
                <video
                  src={previewMedia.src}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75vh] w-full rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

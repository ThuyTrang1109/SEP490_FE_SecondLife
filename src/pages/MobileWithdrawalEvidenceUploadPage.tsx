import React, { useEffect, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import {
  walletService,
  WithdrawalMobileUploadSessionDto,
  getDefaultWithdrawalEvidenceMaxBytes,
  formatEvidenceSizeLimit,
} from '../services/walletService';
import { formatVND } from '../utils/translations';

export const MobileWithdrawalEvidenceUploadPage: React.FC = () => {
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token')?.trim() || ''
      : '';

  const [session, setSession] = useState<WithdrawalMobileUploadSessionDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [uploadedSuccess, setUploadedSuccess] = useState<boolean>(false);
  const [partialMessage, setPartialMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Đường dẫn thiếu mã xác thực phiên tải ảnh. Vui lòng quét lại mã QR trên máy tính.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    walletService
      .getPublicMobileUploadSession(token)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        if (data.status === 'UPLOADED') {
          setUploadedSuccess(true);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'Mã QR không hợp lệ hoặc đã hết hạn.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const maxFiles = session?.maxFiles ?? 1;
  const maxFileSizeBytes =
    session?.maxFileSizeBytes && session.maxFileSizeBytes > 0
      ? session.maxFileSizeBytes
      : getDefaultWithdrawalEvidenceMaxBytes();
  const maxFileSizeLabel = formatEvidenceSizeLimit(maxFileSizeBytes);
  const uploadedCount = session?.evidenceUrls?.length ?? (uploadedSuccess ? maxFiles : 0);
  const remainingSlots = Math.max(0, maxFiles - uploadedCount);
  const isUserSession = session?.purpose === 'USER_DISPUTE' || session?.purpose === 'USER_EXCEPTION';

  const handleSelectFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setPartialMessage(null);

    const files = Array.from(fileList).slice(0, Math.max(1, remainingSlots));
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WEBP.');
        return;
      }
      if (file.size > maxFileSizeBytes) {
        setError(`Mỗi ảnh minh chứng không được vượt quá ${maxFileSizeLabel}.`);
        return;
      }
    }

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles(files);
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
  };

  const handleUpload = async () => {
    if (!token || selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setPartialMessage(null);
    let latestSession = session;
    let uploadedNow = 0;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgressText(
          selectedFiles.length > 1
            ? `Đang tải ảnh ${i + 1}/${selectedFiles.length} lên máy tính...`
            : 'Đang tải ảnh lên máy tính...',
        );
        latestSession = await walletService.uploadPublicMobileEvidence(token, selectedFiles[i]);
        setSession(latestSession);
        uploadedNow += 1;
      }

      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviewUrls([]);

      const nextCount = latestSession?.evidenceUrls?.length ?? uploadedNow;
      const nextMax = latestSession?.maxFiles ?? maxFiles;
      if (latestSession?.status === 'UPLOADED' || nextCount >= nextMax) {
        setUploadedSuccess(true);
      } else {
        const left = Math.max(0, nextMax - nextCount);
        setPartialMessage(
          `Đã gửi ${uploadedNow} ảnh lên máy tính thành công. Ảnh đã xuất hiện trong biểu mẫu — bạn có thể chọn thêm tối đa ${left} ảnh nữa hoặc quay lại máy tính.`,
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Tải ảnh minh chứng thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  const pageTitle =
    session?.purpose === 'USER_DISPUTE'
      ? 'Tải ảnh minh chứng báo cáo sự cố'
      : session?.purpose === 'USER_EXCEPTION'
        ? 'Tải ảnh minh chứng hỗ trợ ngoại lệ'
        : 'Tải ảnh biên lai chuyển khoản';

  const pageSubtitle = isUserSession
    ? 'Chọn ảnh chụp màn hình lịch sử giao dịch ngân hàng để tự động thêm vào biểu mẫu trên máy tính.'
    : 'Ảnh tải lên từ điện thoại sẽ tự động hiển thị trên máy tính xử lý.';

  return (
    <main className="min-h-screen bg-[#faf8f5] text-[#24263e] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-[#24263e] text-white px-5 py-4">
          <h1 className="text-base font-extrabold tracking-tight">{pageTitle}</h1>
          <p className="text-xs text-white/75 mt-1">{pageSubtitle}</p>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {loading ? (
            <div className="py-10 flex flex-col items-center gap-2.5 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-[#c34c36]" />
              <span className="font-semibold">Đang kiểm tra phiên tải ảnh...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {partialMessage && !uploadedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{partialMessage}</span>
                </div>
              )}

              {uploadedSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold space-y-1">
                  <div className="flex items-center gap-2 font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isUserSession
                        ? `Đã tải ${uploadedCount}/${maxFiles} ảnh minh chứng lên máy tính thành công`
                        : 'Đã tải ảnh biên lai lên máy tính thành công'}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-emerald-800 font-medium">
                    {isUserSession
                      ? 'Ảnh minh chứng đã tự động thêm vào biểu mẫu trên máy tính. Bạn có thể đóng trang này và bấm Gửi báo cáo.'
                      : 'Ảnh minh chứng đã tự động cập nhật vào ô xử lý trên laptop. Bạn có thể đóng trang này và bấm Xác nhận đã chuyển khoản trên máy tính.'}
                  </p>
                </div>
              )}

              {session && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Mã lệnh rút</span>
                    <span className="font-mono font-extrabold text-slate-900">
                      #{session.requestCode}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Số tiền</span>
                    <span className="font-mono font-black text-sm text-[#c34c36]">
                      {formatVND(session.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Ngân hàng nhận</span>
                    <span className="font-bold text-slate-800 text-right">
                      {session.bankName} ({session.maskedAccountNumber})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Chủ tài khoản</span>
                    <span className="font-bold text-slate-900 uppercase text-right">
                      {session.accountHolderName}
                    </span>
                  </div>
                  {maxFiles > 1 && (
                    <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-semibold">Tiến độ ảnh minh chứng</span>
                      <span className="font-bold text-emerald-700">
                        {uploadedCount}/{maxFiles} ảnh đã gửi
                      </span>
                    </div>
                  )}
                </div>
              )}

              {session && !uploadedSuccess && remainingSlots > 0 && (
                <>
                  <label className="block w-full p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#c34c36] bg-white text-center cursor-pointer transition">
                    <Upload className="w-6 h-6 mx-auto text-[#c34c36] mb-1.5" />
                    <span className="block text-sm font-extrabold text-slate-900">
                      {selectedFiles.length > 0
                        ? `Chọn lại ảnh khác (đang chọn ${selectedFiles.length} ảnh)`
                        : isUserSession
                          ? 'Chọn ảnh chụp lịch sử giao dịch từ điện thoại'
                          : 'Chọn ảnh biên lai từ điện thoại'}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {maxFiles > 1
                        ? `Có thể chọn tối đa ${remainingSlots} ảnh JPEG, PNG, WEBP (tối đa ${maxFileSizeLabel} / ảnh)`
                        : `Hỗ trợ ảnh chụp màn hình JPEG, PNG, WEBP (tối đa ${maxFileSizeLabel})`}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple={remainingSlots > 1}
                      className="hidden"
                      onChange={(e) => {
                        handleSelectFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {previewUrls.length === 1 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <img
                        src={previewUrls[0]}
                        alt="Xem trước ảnh minh chứng"
                        className="w-full max-h-64 object-contain rounded-lg bg-white"
                      />
                    </div>
                  )}

                  {previewUrls.length > 1 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      {previewUrls.map((url, idx) => (
                        <img
                          key={`${url}-${idx}`}
                          src={url}
                          alt={`Xem trước ảnh ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-slate-200 bg-white"
                        />
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={selectedFiles.length === 0 || uploading}
                    onClick={() => void handleUpload()}
                    className="w-full py-3 px-4 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {uploading
                        ? uploadProgressText || 'Đang tải ảnh lên máy tính...'
                        : selectedFiles.length > 1
                          ? `Gửi ${selectedFiles.length} ảnh minh chứng lên máy tính`
                          : isUserSession
                            ? 'Gửi ảnh minh chứng lên máy tính'
                            : 'Gửi ảnh biên lai lên máy tính'}
                    </span>
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Liên kết bảo mật tạm thời, tự hết hạn sau 10 phút.</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
};

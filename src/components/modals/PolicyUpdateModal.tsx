import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, LogOut, ShieldCheck, X } from 'lucide-react';
import { PolicyAcceptanceStatusDto, PolicyVersionDto, policyService } from '../../services/policyService';
import { PolicyDocumentView } from '../policy/PolicyDocumentView';

interface PolicyUpdateModalProps {
  isOpen: boolean;
  status: PolicyAcceptanceStatusDto;
  onAccepted: (updated: PolicyAcceptanceStatusDto) => void;
  onLogout: () => void;
  onDismissForExistingAssets: () => void;
}

export const PolicyUpdateModal: React.FC<PolicyUpdateModalProps> = ({
  isOpen,
  status,
  onAccepted,
  onLogout,
  onDismissForExistingAssets,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedPolicy, setLoadedPolicy] = useState<PolicyVersionDto | null>(null);

  if (!isOpen) return null;

  const targetVersionId = loadedPolicy?.id || status.activePolicyVersionId;

  const handleConfirm = async () => {
    if (!agreed) {
      setError('Vui lòng đánh dấu xác nhận bạn đã đọc và đồng ý với phiên bản chính sách hiện hành.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await policyService.acceptPolicy(targetVersionId, 'POLICY_UPDATE');
      onAccepted(updated);
    } catch (err: any) {
      if (err?.status === 409) {
        policyService.clearCache();
        setAgreed(false);
        try {
          const fresh = await policyService.getCurrentPolicy(true);
          setLoadedPolicy(fresh);
        } catch {
          // ignore
        }
      }
      setError(err?.message || 'Không thể ghi nhận xác nhận chính sách. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-update-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#faf8f5] rounded-3xl border border-gray-300 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#24263e] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c34c36] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="policy-update-modal-title" className="text-sm sm:text-base font-black text-white">
                {status.lastAcceptedVersion
                  ? `Cập nhật Điều khoản sử dụng (Phiên bản ${status.activeVersion})`
                  : `Xác nhận Điều khoản sử dụng & Quy chế hoạt động (Phiên bản ${status.activeVersion})`}
              </h3>
              <p className="text-xs text-[#fce5da]">
                {status.lastAcceptedVersion
                  ? `Bạn đã xác nhận phiên bản ${status.lastAcceptedVersion}. Vui lòng đọc và xác nhận phiên bản mới nhất.`
                  : 'Vui lòng đọc và xác nhận Điều khoản sử dụng hiện hành của SecondLife để tiếp tục sử dụng đầy đủ dịch vụ.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismissForExistingAssets}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Đóng tạm để xem giao dịch/tài sản hiện có"
            aria-label="Đóng tạm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Policy Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <PolicyDocumentView compact onPolicyLoaded={setLoadedPolicy} />
        </div>

        {/* Footer Acceptance Controls */}
        <div className="px-5 sm:px-6 py-4 bg-white border-t border-gray-200 space-y-3 shrink-0">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <label className="flex items-start gap-2.5 text-xs sm:text-sm text-[#24263e] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#c34c36] focus:ring-[#c34c36] cursor-pointer shrink-0"
            />
            <span className="font-semibold leading-snug">
              Tôi xác nhận đã đọc, hiểu và đồng ý với Điều khoản sử dụng và Quy chế hoạt động hiện hành của SecondLife (Phiên bản {loadedPolicy?.version || status.activeVersion}).
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#24263e] hover:bg-gray-100 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
              <button
                type="button"
                onClick={onDismissForExistingAssets}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-[#24263e]/70 hover:text-[#24263e] hover:underline cursor-pointer"
              >
                Để sau (vẫn xem đơn hàng/ví hiện có)
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a93f2b] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Đang ghi nhận...' : 'Xác nhận đồng ý'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

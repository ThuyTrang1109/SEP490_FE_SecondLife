import React, { useState, useEffect, useCallback } from 'react';
import {
  Percent,
  TrendingUp,
  Plus,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  History,
  ShieldCheck,
  Edit,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Info,
  Eye,
  Loader2
} from 'lucide-react';
import {
  adminCommissionService,
  CommissionRuleResponse,
  CommissionRuleRequest,
} from '../../services/adminCommissionService';
import { translateApiError } from '../../services/apiClient';
import { formatVND } from '../../utils/translations';
import { CommissionHistorySection } from './CommissionHistorySection';

export const CommissionRulesTab: React.FC = () => {
  const [rules, setRules] = useState<CommissionRuleResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal: Create or Edit Rule
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRuleResponse | null>(null);
  const [formName, setFormName] = useState('');
  const [formRatePercent, setFormRatePercent] = useState('5.0');
  const [formMinCommission, setFormMinCommission] = useState('10000');
  const [formMaxCommission, setFormMaxCommission] = useState('500000');
  const [formActive, setFormActive] = useState(true);
  const [formReason, setFormReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formModalError, setFormModalError] = useState<string | null>(null);

  // Modal: Deactivate Rule
  const [deactivatingRule, setDeactivatingRule] = useState<CommissionRuleResponse | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Modal: Audit History
  const [historyRule, setHistoryRule] = useState<CommissionRuleResponse | null>(null);

  // Modal: View Rule Detail by ID (GET /api/v1/admin/commission-rules/{id})
  const [detailRule, setDetailRule] = useState<CommissionRuleResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modal: Capture Commission Snapshot for old orders (POST /api/v1/admin/orders/{orderId}/commission-snapshot)
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotOrderId, setSnapshotOrderId] = useState('');
  const [snapshotReason, setSnapshotReason] = useState('Bổ sung snapshot lưu vết kế toán cho đơn hàng cũ');
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<any>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSnapshotError(null);
    if (!snapshotOrderId.trim()) {
      setSnapshotError('Vui lòng nhập mã đơn hàng (Order ID) cần chốt snapshot hoa hồng.');
      return;
    }
    setIsCapturingSnapshot(true);
    try {
      const res = await adminCommissionService.captureCommissionSnapshot(
        snapshotOrderId.trim(),
        snapshotReason.trim() || 'Bổ sung snapshot lưu vết kế toán'
      );
      setSnapshotResult(res);
      setSnapshotError(null);
      setSuccessMessage(`Đã chụp snapshot hoa hồng cho đơn #${snapshotOrderId.trim()} thành công!`);
    } catch (err: any) {
      console.error('Error capturing commission snapshot:', err);
      setSnapshotError(err?.response?.data?.message || err?.message || 'Lỗi chụp snapshot hoa hồng cho đơn hàng.');
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const handleOpenDetailModal = async (ruleId: string) => {
    setIsLoadingDetail(true);
    try {
      const full = await adminCommissionService.getCommissionRuleById(ruleId);
      setDetailRule(full);
    } catch (err: any) {
      console.warn('Failed to load commission rule detail by ID, using fallback:', err);
      const fallback = rules.find((r) => r.id === ruleId) || null;
      setDetailRule(fallback);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const fetchRules = useCallback(async (page = 0) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await adminCommissionService.getCommissionRules(page, pageSize);
      setRules(data.items);
      const active = data.items.find((r) => r.active) || data.items[0];
      if (active && active.rate !== undefined) {
        try {
          localStorage.setItem('platform_commission_rate', String(Math.round(Number(active.rate) * 1000) / 10));
        } catch {}
      }
      setCurrentPage(data.page);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || data.items.length);
    } catch (err: any) {
      console.error('Error fetching commission rules:', err);
      const rawMsg = err?.response?.data?.message || err?.message || 'Không thể tải danh sách chính sách hoa hồng.';
      setErrorMessage(translateApiError(rawMsg));
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchRules(currentPage);
  }, [fetchRules, currentPage]);

  // Tự động chọn chính sách đang kích hoạt để hiển thị lịch sử bên dưới
  useEffect(() => {
    if (rules.length > 0) {
      setHistoryRule((prev) => {
        if (prev && rules.some((r) => r.id === prev.id)) {
          return rules.find((r) => r.id === prev.id) || prev;
        }
        return rules.find((r) => r.active) || rules[0];
      });
    }
  }, [rules]);

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setFormName('Chính sách hoa hồng tiêu chuẩn');
    setFormRatePercent('5.0');
    setFormMinCommission('10000');
    setFormMaxCommission('500000');
    setFormActive(true);
    setFormReason('Khởi tạo chính sách chiết khấu sàn SecondLife');
    setFormModalError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (rule: CommissionRuleResponse) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormRatePercent((Number(rule.rate) * 100).toFixed(2));
    setFormMinCommission(String(rule.minCommission));
    setFormMaxCommission(rule.maxCommission !== null && rule.maxCommission !== undefined ? String(rule.maxCommission) : '');
    setFormActive(rule.active);
    setFormReason(`Cập nhật phiên bản chính sách #${rule.revision + 1}`);
    setFormModalError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormModalError(null);
    const rateVal = parseFloat(formRatePercent) / 100;
    const minVal = parseFloat(formMinCommission);
    const maxVal = formMaxCommission.trim() !== '' ? parseFloat(formMaxCommission) : null;

    if (isNaN(rateVal) || rateVal < 0 || rateVal > 1) {
      setFormModalError('Tỷ lệ hoa hồng không hợp lệ (phải từ 0% đến 100%).');
      return;
    }
    if (isNaN(minVal) || minVal < 0) {
      setFormModalError('Mức hoa hồng tối thiểu không hợp lệ.');
      return;
    }
    if (maxVal !== null && maxVal < minVal) {
      setFormModalError('Trần hoa hồng tối đa phải lớn hơn hoặc bằng mức tối thiểu.');
      return;
    }
    if (!formReason.trim()) {
      setFormModalError('Vui lòng nhập lý do thay đổi quy tắc theo quy chuẩn kiểm toán.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CommissionRuleRequest = {
        name: formName.trim(),
        rate: rateVal,
        minCommission: minVal,
        maxCommission: maxVal,
        active: formActive,
        reason: formReason.trim()
      };

      if (editingRule) {
        await adminCommissionService.updateCommissionRule(editingRule.id, payload);
        setSuccessMessage(`Đã cập nhật chính sách "${formName}" thành công.`);
      } else {
        await adminCommissionService.createCommissionRule(payload);
        setSuccessMessage(`Đã khởi tạo chính sách "${formName}" thành công.`);
      }

      if (formActive) {
        try {
          localStorage.setItem('platform_commission_rate', String(Math.round(rateVal * 1000) / 10));
        } catch {}
      }

      setIsFormModalOpen(false);
      setFormModalError(null);
      fetchRules(0);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error saving commission rule:', err);
      const rawMsg = err?.response?.data?.message || err?.message || 'Lỗi khi lưu quy tắc hoa hồng.';
      setFormModalError(translateApiError(rawMsg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingRule) return;
    if (!deactivateReason.trim()) {
      setDeactivateError('Vui lòng nhập lý do tắt chính sách.');
      return;
    }
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      await adminCommissionService.deactivateCommissionRule(deactivatingRule.id, deactivateReason.trim());
      setSuccessMessage(`Đã ngưng kích hoạt chính sách "${deactivatingRule.name}".`);
      setDeactivatingRule(null);
      setDeactivateReason('');
      setDeactivateError(null);
      fetchRules(currentPage);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error deactivating rule:', err);
      const rawMsg = err?.response?.data?.message || err?.message || 'Không thể tắt chính sách.';
      setDeactivateError(translateApiError(rawMsg));
    } finally {
      setIsDeactivating(false);
    }
  };

  // Find currently active rule for summary metrics
  const activeRule = rules.find((r) => r.active) || rules[0];

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#c34c36]" />
            <h2 className="text-xl font-black text-[#24263e]">
              Quản lý chính sách & tỷ lệ hoa hồng sàn
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Cấu hình tỷ lệ phần trăm khấu trừ của sàn SecondLife khi đơn hàng hoàn tất ký quỹ Escrow. Quy tắc mới chỉ áp dụng cho các giao dịch phát sinh trong tương lai.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchRules(currentPage)}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#c34c36]' : ''}`} />
            <span>Làm mới</span>
          </button>

          

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-black bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl shadow-xs hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thiết lập quy tắc mới</span>
          </button>
        </div>
      </div>

      {/* 2. Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-gradient-to-br from-[#24263e] to-[#363854] text-white p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-white/80 font-bold mb-1">
            <span>Tỷ lệ chiết khấu sàn</span>
            <Percent className="w-4 h-4 text-[#fce5da]" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {activeRule ? `${(Number(activeRule.rate) * 100).toFixed(1)}%` : '5.0%'}
          </div>
          <div className="text-[11px] text-[#fce5da] mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{activeRule?.active ? 'Đang kích hoạt toàn sàn' : 'Chưa có quy tắc bật'}</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>Mức thu sàn tối thiểu</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeRule ? formatVND(activeRule.minCommission) : '10.000 ₫'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Đảm bảo bù đắp chi phí vận hành
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>Trần hoa hồng tối đa</span>
            <ShieldCheck className="w-4 h-4 text-[#c34c36]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeRule?.maxCommission ? formatVND(activeRule.maxCommission) : 'Không giới hạn'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Bảo vệ người bán giá trị cao
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>Tổng quy tắc cấu hình</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalElements} <span className="text-xs font-semibold text-slate-400">chính sách</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Lịch sử lưu vết đầy đủ kiểm toán
          </div>
        </div>
      </div>

      {/* 4. Main Rules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs text-[#24263e] uppercase tracking-wider">
              Danh sách quy tắc hoa hồng
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#c34c36]/10 text-[#c34c36]">
              {rules.length} mục
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Mỗi lần sửa đổi sẽ tăng Revision tự động
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tên chính sách</th>
                <th className="px-4 py-3 text-center">Tỷ lệ (%)</th>
                <th className="px-4 py-3 text-right">Phí tối thiểu</th>
                <th className="px-4 py-3 text-right">Trần tối đa</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Revision</th>
                <th className="px-4 py-3">Cập nhật gần nhất</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoading && rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#c34c36] mb-2" />
                    <span>Đang nạp danh sách chính sách từ máy chủ...</span>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">Chưa có chính sách hoa hồng nào được tạo.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Bấm "Thiết lập quy tắc mới" để tạo tỷ lệ mặc định cho sàn.</p>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const ratePercent = (Number(rule.rate) * 100).toFixed(2);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{rule.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {rule.id.slice(0, 8)}...</div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ratePercent}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                        {formatVND(rule.minCommission)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                        {rule.maxCommission ? formatVND(rule.maxCommission) : <span className="text-slate-400 font-normal italic">Không giới hạn</span>}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {rule.active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>Đang dùng</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <PowerOff className="w-3 h-3 text-slate-400" />
                            <span>Đã tắt</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500">
                        r{rule.revision}
                      </td>

                      <td className="px-4 py-3.5 text-[11px] text-slate-500">
                        <div>{new Date(rule.updatedAt || rule.createdAt).toLocaleDateString('vi-VN')}</div>
                        <div className="text-[10px] text-slate-400">{new Date(rule.updatedAt || rule.createdAt).toLocaleTimeString('vi-VN')}</div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetailModal(rule.id)}
                            className="p-1.5 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Xem chi tiết chính sách (GET /commission-rules/{id})"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Sửa chính sách (tạo revision mới)"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {rule.active && (
                            <button
                              onClick={() => {
                                setDeactivatingRule(rule);
                                setDeactivateReason('');
                                setDeactivateError(null);
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Tắt chính sách"
                            >
                              <PowerOff className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setHistoryRule(rule);
                              document.getElementById('commission-history-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                              historyRule?.id === rule.id
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                            aria-label={`Xem lịch sử ${rule.name}`}
                            title="Xem lịch sử thay đổi của chính sách này bên dưới"
                          >
                            <History aria-hidden="true" className="w-3.5 h-3.5 text-amber-600" />
                            <span>Lịch sử</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Trang {currentPage + 1} / {totalPages} (Tổng {totalElements} chính sách)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchRules(currentPage - 1)}
                disabled={currentPage === 0}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchRules(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Lịch sử thay đổi quy tắc hoa hồng (Hiển thị bên dưới) */}
      {historyRule && (
        <CommissionHistorySection
          key={historyRule.id}
          rule={historyRule}
          allRules={rules}
          onSelectRule={(selected) => setHistoryRule(selected)}
        />
      )}

      {/* 5. MODAL: Create / Edit Rule */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingRule ? `Cập nhật chính sách #${editingRule.id.slice(0, 8)}` : 'Thiết lập quy tắc hoa hồng mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRule} noValidate className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên chính sách <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Hoa hồng tiêu chuẩn 5%"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tỷ lệ (%) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={formRatePercent}
                      onChange={(e) => setFormRatePercent(e.target.value)}
                      placeholder="5.0"
                      className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Ví dụ: 5.0% = 0.05</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trạng thái kích hoạt
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 text-[#c34c36] rounded focus:ring-0"
                    />
                    <span className="font-bold text-slate-800">
                      {formActive ? 'Đang hiệu lực (Active)' : 'Tắt (Inactive)'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mức tối thiểu (VND) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formMinCommission}
                    onChange={(e) => setFormMinCommission(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                  />
                  <span className="text-[10px] text-slate-400">{formatVND(Number(formMinCommission) || 0)}</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trần tối đa (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formMaxCommission}
                    onChange={(e) => setFormMaxCommission(e.target.value)}
                    placeholder="Để trống nếu không giới hạn"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                  />
                  <span className="text-[10px] text-slate-400">
                    {formMaxCommission.trim() ? formatVND(Number(formMaxCommission) || 0) : 'Không giới hạn'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do cập nhật / khởi tạo <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Ghi chú bắt buộc theo chuẩn kiểm toán tài chính (audit reason)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRule ? 'Lưu thay đổi (Revision Mới)' : 'Tạo chính sách'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Deactivate Rule */}
      {deactivatingRule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <PowerOff className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Xác nhận tắt chính sách hoa hồng
              </h3>
            </div>

            {deactivateError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deactivateError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn ngừng áp dụng chính sách <strong className="text-slate-900">"{deactivatingRule.name}"</strong>? Lịch sử tài chính các đơn hàng cũ vẫn được giữ nguyên.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý do ngừng kích hoạt <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={deactivateReason}
                onChange={(e) => {
                  setDeactivateReason(e.target.value);
                  if (deactivateError) setDeactivateError(null);
                }}
                placeholder="Nhập lý do tắt chính sách..."
                className={`w-full text-xs px-3 py-2 border rounded-xl focus:outline-none transition ${
                  deactivateError
                    ? 'border-rose-500 bg-rose-50/20 focus:border-rose-600 ring-1 ring-rose-200'
                    : 'border-slate-300 focus:border-rose-500'
                }`}
              />
              {deactivateError && (
                <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                  <span>⚠</span>
                  <span>{deactivateError}</span>
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDeactivatingRule(null);
                  setDeactivateError(null);
                  setDeactivateReason('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={isDeactivating}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-60 flex items-center gap-1.5"
              >
                {isDeactivating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận tắt</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 8. MODAL: XEM CHI TIẾT QUY TẮC HOA HỒNG (GET /commission-rules/{id}) */}
      {(detailRule || isLoadingDetail) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Chi tiết chính sách hoa hồng</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Endpoint: GET /api/v1/admin/commission-rules/{detailRule?.id || '...'}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailRule(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                <span className="text-xs">Đang tải chi tiết chính sách từ máy chủ...</span>
              </div>
            ) : detailRule ? (
              <div className="space-y-3.5 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Tên chính sách:</span>
                    <strong className="text-slate-900 text-sm font-black">{detailRule.name}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Mã định danh (ID):</span>
                    <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 select-all">
                      {detailRule.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Trạng thái vận hành:</span>
                    {detailRule.active ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Đang kích hoạt
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                        Đã vô hiệu hóa
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-0.5">Tỷ lệ chiết khấu sàn</span>
                    <div className="text-lg font-black text-emerald-700">
                      {(Number(detailRule.rate) * 100).toFixed(2)}%
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Phiên bản Revision</span>
                    <div className="text-lg font-black font-mono text-slate-800">
                      r{detailRule.revision}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Phí tối thiểu</span>
                    <div className="text-sm font-bold text-slate-900">
                      {formatVND(detailRule.minCommission)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Trần tối đa</span>
                    <div className="text-sm font-bold text-slate-900">
                      {detailRule.maxCommission ? formatVND(detailRule.maxCommission) : 'Không giới hạn'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>Thời điểm khởi tạo:</span>
                    <strong className="text-slate-700 font-mono">
                      {detailRule.createdAt ? new Date(detailRule.createdAt).toLocaleString('vi-VN') : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cập nhật gần nhất:</span>
                    <strong className="text-slate-700 font-mono">
                      {detailRule.updatedAt ? new Date(detailRule.updatedAt).toLocaleString('vi-VN') : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailRule(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chụp Snapshot Hoa Hồng Cho Đơn Hàng Cũ */}
      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl text-[#24263e]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Bổ sung snapshot hoa hồng đơn cũ
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    POST /api/v1/admin/orders/{'{orderId}'}/commission-snapshot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSnapshotModalOpen(false);
                  setSnapshotError(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {snapshotError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{snapshotError}</span>
              </div>
            )}

            <form onSubmit={handleCaptureSnapshot} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Mã đơn hàng (Order ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 550e8400-e29b-41d4-a716-446655440000"
                  value={snapshotOrderId}
                  onChange={(e) => setSnapshotOrderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
                <span className="text-[10px] text-slate-400">
                  Dành cho đơn hàng cũ chưa có snapshot hoặc cần chốt lưu vết trước khi quyết toán.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Lý do bổ sung snapshot *</label>
                <textarea
                  rows={2}
                  required
                  value={snapshotReason}
                  onChange={(e) => setSnapshotReason(e.target.value)}
                  placeholder="Nhập lý do nghiệp vụ..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              {snapshotResult && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã ghi nhận snapshot hoa hồng thành công!</span>
                  </div>
                  <div className="text-[11px] font-mono pl-5">
                    {snapshotResult.commissionAmount !== undefined && (
                      <p>Hoa hồng: {formatVND(snapshotResult.commissionAmount)}</p>
                    )}
                    {snapshotResult.rate !== undefined && (
                      <p>Tỷ lệ: {(Number(snapshotResult.rate) * 100).toFixed(1)}%</p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isCapturingSnapshot || !snapshotOrderId.trim()}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCapturingSnapshot ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang chụp...</span>
                    </>
                  ) : (
                    <span>Chốt snapshot</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


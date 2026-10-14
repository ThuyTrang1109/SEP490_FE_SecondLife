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
  Info
} from 'lucide-react';
import {
  adminCommissionService,
  CommissionRuleResponse,
  CommissionRuleRequest,
  CommissionAuditResponse
} from '../../services/adminCommissionService';
import { formatVND } from '../../utils/translations';

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

  // Modal: Deactivate Rule
  const [deactivatingRule, setDeactivatingRule] = useState<CommissionRuleResponse | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Modal: Audit History
  const [historyRule, setHistoryRule] = useState<CommissionRuleResponse | null>(null);
  const [auditList, setAuditList] = useState<CommissionAuditResponse[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const fetchRules = useCallback(async (page = 0) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await adminCommissionService.getCommissionRules(page, pageSize);
      setRules(data.items);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || data.items.length);
    } catch (err: any) {
      console.error('Error fetching commission rules:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Không thể tải danh sách chính sách hoa hồng.');
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchRules(currentPage);
  }, [fetchRules, currentPage]);

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setFormName('Chính Sách Hoa Hồng Tiêu Chuẩn');
    setFormRatePercent('5.0');
    setFormMinCommission('10000');
    setFormMaxCommission('500000');
    setFormActive(true);
    setFormReason('Khởi tạo chính sách chiết khấu sàn SecondLife');
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
    setIsFormModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(formRatePercent) / 100;
    const minVal = parseFloat(formMinCommission);
    const maxVal = formMaxCommission.trim() !== '' ? parseFloat(formMaxCommission) : null;

    if (isNaN(rateVal) || rateVal < 0 || rateVal > 1) {
      setErrorMessage('Tỷ lệ hoa hồng không hợp lệ (phải từ 0% đến 100%).');
      return;
    }
    if (isNaN(minVal) || minVal < 0) {
      setErrorMessage('Mức hoa hồng tối thiểu không hợp lệ.');
      return;
    }
    if (maxVal !== null && maxVal < minVal) {
      setErrorMessage('Trần hoa hồng tối đa phải lớn hơn hoặc bằng mức tối thiểu.');
      return;
    }
    if (!formReason.trim()) {
      setErrorMessage('Vui lòng nhập lý do thay đổi quy tắc theo quy chuẩn kiểm toán.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
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

      setIsFormModalOpen(false);
      fetchRules(0);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error saving commission rule:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi khi lưu quy tắc hoa hồng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingRule) return;
    if (!deactivateReason.trim()) {
      setErrorMessage('Vui lòng nhập lý do tắt chính sách.');
      return;
    }
    setIsDeactivating(true);
    try {
      await adminCommissionService.deactivateCommissionRule(deactivatingRule.id, deactivateReason.trim());
      setSuccessMessage(`Đã ngưng kích hoạt chính sách "${deactivatingRule.name}".`);
      setDeactivatingRule(null);
      setDeactivateReason('');
      fetchRules(currentPage);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error deactivating rule:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Không thể tắt chính sách.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleOpenAuditHistory = async (rule: CommissionRuleResponse) => {
    setHistoryRule(rule);
    setIsLoadingAudit(true);
    try {
      const data = await adminCommissionService.getCommissionRuleHistory(rule.id, 0, 50);
      setAuditList(data.items);
    } catch (err: any) {
      console.error('Error loading audit history:', err);
      setAuditList([]);
    } finally {
      setIsLoadingAudit(false);
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
              Quản Lý Chính Sách & Tỷ Lệ Hoa Hồng Sàn
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
            <span>Thiết Lập Quy Tắc Mới</span>
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
            <span>Tỷ Lệ Chiết Khấu Sàn</span>
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
            <span>Mức Thu Sàn Tối Thiểu</span>
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
            <span>Trần Hoa Hồng Tối Đa</span>
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
            <span>Tổng Quy Tắc Cấu Hình</span>
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
              Danh Sách Quy Tắc Hoa Hồng
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
                <th className="px-4 py-3">Tên Chính Sách</th>
                <th className="px-4 py-3 text-center">Tỷ Lệ (%)</th>
                <th className="px-4 py-3 text-right">Phí Tối Thiểu</th>
                <th className="px-4 py-3 text-right">Trần Tối Đa</th>
                <th className="px-4 py-3 text-center">Trạng Thái</th>
                <th className="px-4 py-3 text-center">Revision</th>
                <th className="px-4 py-3">Cập Nhật Gần Nhất</th>
                <th className="px-4 py-3 text-center">Hành Động</th>
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
                    <p className="text-[11px] text-slate-400 mt-1">Bấm "Thiết Lập Quy Tắc Mới" để tạo tỷ lệ mặc định cho sàn.</p>
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
                            <span>Đang Dùng</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <PowerOff className="w-3 h-3 text-slate-400" />
                            <span>Đã Tắt</span>
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
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Tắt chính sách"
                            >
                              <PowerOff className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenAuditHistory(rule)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Xem lịch sử kiểm toán"
                          >
                            <History className="w-4 h-4" />
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

      {/* 5. MODAL: Create / Edit Rule */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingRule ? `Cập Nhật Chính Sách #${editingRule.id.slice(0, 8)}` : 'Thiết Lập Quy Tắc Hoa Hồng Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên Chính Sách <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Hoa Hồng Tiêu Chuẩn 5%"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tỷ Lệ (%) <span className="text-rose-500">*</span>
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
                    Trạng Thái Kích Hoạt
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
                    Mức Tối Thiểu (VND) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
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
                    Trần Tối Đa (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
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
                  Lý Do Cập Nhật / Khởi Tạo <span className="text-rose-500">*</span>
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
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRule ? 'Lưu Thay Đổi (Revision Mới)' : 'Tạo Chính Sách'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Deactivate Rule */}
      {deactivatingRule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <PowerOff className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Xác Nhận Tắt Chính Sách Hoa Hồng
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn ngừng áp dụng chính sách <strong className="text-slate-900">"{deactivatingRule.name}"</strong>? Lịch sử tài chính các đơn hàng cũ vẫn được giữ nguyên.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý Do Ngừng Kích Hoạt <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Nhập lý do tắt chính sách..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeactivatingRule(null)}
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
                <span>Xác Nhận Tắt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Audit History */}
      {historyRule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Lịch Sử Kiểm Toán: {historyRule.name}
                </h3>
              </div>
              <button
                onClick={() => setHistoryRule(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {isLoadingAudit ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                  <span>Đang tải lịch sử thay đổi...</span>
                </div>
              ) : auditList.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Info className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <span>Chưa ghi nhận bản ghi kiểm toán nào cho quy tắc này.</span>
                </div>
              ) : (
                auditList.map((audit) => (
                  <div key={audit.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 uppercase text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                        {audit.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(audit.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="text-slate-700">
                      <strong>Lý do:</strong> {audit.reason || 'Không ghi nhận lý do'}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 mt-1">
                      <div>
                        <span className="text-slate-400">Tỷ lệ:</span>{' '}
                        <strong className="text-emerald-700">{(Number(audit.rate) * 100).toFixed(2)}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Revision:</span>{' '}
                        <span className="font-mono font-bold">r{audit.revision}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setHistoryRule(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

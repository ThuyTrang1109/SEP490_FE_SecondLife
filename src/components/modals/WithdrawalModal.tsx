import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  CreditCard,
  User,
  History,
  Info,
  Loader2
} from 'lucide-react';
import {
  walletService,
  WalletWithdrawalResponseDto,
  CreateWithdrawalRequestDto
} from '../../services/walletService';
import { formatVND } from '../../utils/translations';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  initialBankName?: string;
  initialAccountNumber?: string;
  initialAccountHolder?: string;
  onSuccess?: () => void;
}

const SUPPORTED_BANKS = [
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)' },
  { code: 'MB', name: 'MBBank (Quân Đội)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư và Phát Triển)' },
  { code: 'CTG', name: 'VietinBank (Công Thương Việt Nam)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
];

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  initialBankName,
  initialAccountNumber,
  initialAccountHolder,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form State
  const [bankCode, setBankCode] = useState('VCB');
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber || '');
  const [accountHolderName, setAccountHolderName] = useState(initialAccountHolder || '');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<WalletWithdrawalResponseDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Match initial bank if possible
  useEffect(() => {
    if (initialBankName) {
      const match = SUPPORTED_BANKS.find(
        (b) => initialBankName.toLowerCase().includes(b.code.toLowerCase()) ||
               initialBankName.toLowerCase().includes(b.name.toLowerCase())
      );
      if (match) setBankCode(match.code);
    }
    if (initialAccountNumber) setAccountNumber(initialAccountNumber);
    if (initialAccountHolder) setAccountHolderName(initialAccountHolder.toUpperCase());
  }, [initialBankName, initialAccountNumber, initialAccountHolder]);

  const fetchHistory = useCallback(async (page = 0) => {
    setIsLoadingHistory(true);
    try {
      const res = await walletService.getMyWithdrawals(page, 20);
      setHistoryList(res.items);
      setHistoryPage(res.page);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.warn('Lỗi lấy lịch sử rút tiền:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      if (activeTab === 'history') {
        fetchHistory(0);
      }
    }
  }, [isOpen, activeTab, fetchHistory]);

  if (!isOpen) return null;

  const handleQuickAmount = (ratio: number) => {
    const val = Math.floor(availableBalance * ratio);
    setAmountStr(String(Math.max(0, val)));
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const amount = Number(amountStr);
    if (isNaN(amount) || amount < 50000) {
      setErrorMessage('Số tiền rút tối thiểu là 50.000 VND.');
      return;
    }
    if (amount > availableBalance) {
      setErrorMessage(`Số dư khả dụng không đủ (Hiện có: ${formatVND(availableBalance)}).`);
      return;
    }
    if (!accountNumber.trim()) {
      setErrorMessage('Vui lòng nhập số tài khoản ngân hàng thụ hưởng.');
      return;
    }
    if (!accountHolderName.trim()) {
      setErrorMessage('Vui lòng nhập tên chủ tài khoản viết hoa không dấu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateWithdrawalRequestDto = {
        amount,
        bankCode,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
      };

      await walletService.requestWithdrawal(payload);
      setSuccessMessage(`Đã gửi yêu cầu rút ${formatVND(amount)} thành công. Hệ thống đang tiến hành xử lý chuyển khoản.`);
      setAmountStr('');
      if (onSuccess) onSuccess();
      // Auto switch to history after 1.5s
      setTimeout(() => {
        setActiveTab('history');
        fetchHistory(0);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo yêu cầu rút tiền. Vui lòng thử lại sau.';
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
            <div className="w-9 h-9 rounded-xl bg-[#c34c36]/10 text-[#c34c36] flex items-center justify-center font-black">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#24263e]">Rút Tiền Về Ngân Hàng</h3>
              <p className="text-[11px] text-slate-500">Chuyển tiền từ ví SecondLife về tài khoản cá nhân</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-[#24263e] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-[#c34c36]" />
            <span>Tạo Lệnh Rút Tiền</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#24263e] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Lịch Sử Rút Tiền</span>
          </button>
        </div>

        {/* Balance Snapshot */}
        <div className="bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] text-slate-500 font-medium">Số dư ví khả dụng hiện tại:</span>
            <div className="text-xl font-black text-[#24263e] mt-0.5 tracking-tight">
              {formatVND(availableBalance)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black uppercase">
              Tối thiểu 50.000₫
            </span>
          </div>
        </div>

        {/* Tab 1: Create Withdrawal */}
        {activeTab === 'create' && (
          <form onSubmit={handleSubmitWithdrawal} className="space-y-4 flex-1 overflow-y-auto pr-1">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Bank Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngân hàng thụ hưởng <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-semibold"
              >
                {SUPPORTED_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Số tài khoản thụ hưởng <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                placeholder="Nhập số tài khoản ngân hàng..."
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-mono font-bold"
              />
            </div>

            {/* Account Holder */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Tên chủ tài khoản (Viết hoa không dấu) <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value.toUpperCase())}
                placeholder="VD: NGUYEN VAN A"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-bold"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Số tiền cần rút (VND) <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-slate-400">Tối thiểu: 50.000₫</span>
              </label>
              <input
                type="number"
                required
                min={50000}
                max={availableBalance}
                step={1000}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Nhập số tiền (VND)..."
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-black text-base text-[#c34c36]"
              />

              {/* Quick Percentage Chips */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(0.25)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(0.5)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(0.75)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(1)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-[#c34c36]/40 bg-[#c34c36]/5 hover:bg-[#c34c36]/10 text-[#c34c36] cursor-pointer"
                >
                  Tất cả (100%)
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableBalance < 50000}
                className="px-5 py-2.5 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi Yêu Cầu Rút Tiền</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="text-slate-500 font-bold text-[11px]">
                {historyList.length} yêu cầu gần nhất
              </span>
              <button
                onClick={() => fetchHistory(historyPage)}
                disabled={isLoadingHistory}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#24263e] mb-2" />
                <span>Đang tải lịch sử rút tiền...</span>
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <Info className="w-6 h-6 mx-auto text-slate-300" />
                <p>Bạn chưa gửi yêu cầu rút tiền nào.</p>
              </div>
            ) : (
              historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">
                      #{item.id.slice(0, 8)} • {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status === 'APPROVED'
                        ? 'Đã chuyển tiền'
                        : item.status === 'REJECTED'
                        ? 'Đã từ chối'
                        : 'Chờ duyệt'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-[#c34c36] text-sm">
                        {formatVND(item.amount)}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        {item.bankCode} • {item.accountNumber} ({item.accountHolderName})
                      </div>
                    </div>
                  </div>

                  {item.adminNote && (
                    <div className="p-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
                      <strong>Ghi chú từ sàn:</strong> {item.adminNote}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

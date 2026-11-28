import { withdrawalBanks as SUPPORTED_BANKS } from '../../services/withdrawalBanks';
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
import { formatVndInput, cleanVndInput, handleVndInputChange, handleVndInputKeyDown } from '../../utils/numberToWords';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  initialBankName?: string;
  initialAccountNumber?: string;
  initialAccountHolder?: string;
  onSuccess?: () => void;
}



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
  const [bankSearch, setBankSearch] = useState('');
  const [savedBanks, setSavedBanks] = useState<Awaited<ReturnType<typeof walletService.savedBankAccounts>>>([]);
  useEffect(() => {
    let active = true;
    if (isOpen) walletService.savedBankAccounts().then(rows => { if (active) setSavedBanks(rows); }).catch(() => { if (active) setSavedBanks([]); });
    return () => { active = false; };
  }, [isOpen]);
  const [manualBank, setManualBank] = useState('');
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber || '');
  const [accountHolderName, setAccountHolderName] = useState(initialAccountHolder || '');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<WalletWithdrawalResponseDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Match initial bank if possible
  useEffect(() => {
    if (initialBankName) {
      const cleanInit = initialBankName.toLowerCase().replace(/\s+/g, '');
      const match = SUPPORTED_BANKS.find(
        (b) => {
          const cleanCode = b.code.toLowerCase();
          const cleanName = b.name.toLowerCase().replace(/\s+/g, '');
          return cleanInit.includes(cleanCode) ||
                 cleanInit.includes(cleanName) ||
                 cleanName.includes(cleanInit) ||
                 cleanInit === cleanCode;
        }
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
    setIdempotencyKey(null);
  };

  const cancelWithdrawal = async (id: string) => {
    if (!window.confirm('Cancel this pending withdrawal? The reserved amount will be released to your available balance.')) return;
    try { await walletService.cancelWithdrawal(id); await fetchHistory(0); onSuccess?.(); }
    catch (err: any) { setErrorMessage(err?.message || 'This request can no longer be cancelled.'); }
  };

  const reportWithdrawalIssue = async (id: string) => {
    const description = window.prompt('Describe the transfer issue. Do not enter bank passwords or OTP codes.');
    if (!description?.trim()) return;
    try { await walletService.reportWithdrawalIssue(id, 'OTHER', description.trim()); await fetchHistory(0); }
    catch (err: any) { setErrorMessage(err?.message || 'The report could not be submitted.'); }
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const amount = Number(cleanVndInput(amountStr));
    if (isNaN(amount) || amount < 10000) {
      setErrorMessage('Số tiền rút tối thiểu là 10.000 VND.');
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

    const selectedBank = SUPPORTED_BANKS.find((bank) => bank.code === bankCode);
    setIsSubmitting(true);
    try {
      const confirmation = await walletService.getWithdrawalBankConfirmation();
      const confirmed = window.confirm(
        `${confirmation.text}\n\nNgân hàng: ${selectedBank?.name || manualBank.trim()}\nSố tài khoản: ${accountNumber.trim()}\nTên chủ tài khoản: ${accountHolderName.trim().toUpperCase()}`
      );
      if (!confirmed) return;
      const payload: CreateWithdrawalRequestDto = {
        amount,
        bankCode,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
        bankName: selectedBank?.name || manualBank.trim(),
        warningVersion: confirmation.version,
      };

      const requestKey = idempotencyKey || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      setIdempotencyKey(requestKey);
      await walletService.requestWithdrawal(payload, requestKey);
      setIdempotencyKey(null);
      setSuccessMessage(`Đã gửi yêu cầu rút ${formatVND(amount)}. Nhân viên dự kiến xử lý trong 1–3 ngày làm việc.`);
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
              <h3 className="font-black text-base text-[#24263e]">Rút tiền về ngân hàng</h3>
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
            <span>Tạo lệnh rút tiền</span>
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
            <span>Lịch sử rút tiền</span>
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
              Tối thiểu 10.000₫
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
              {savedBanks.length > 0 && <select aria-label="Tài khoản đã lưu" defaultValue="" onChange={e => {
                const bank = savedBanks.find(row => row.id === e.target.value);
                if (bank) { setBankCode(bank.bankCode); setManualBank(bank.bankName); setAccountNumber(bank.accountNumber); setAccountHolderName(bank.accountHolderName); setIdempotencyKey(null); }
              }}><option value="">Chọn tài khoản đã lưu</option>{savedBanks.map(b => <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber.slice(-4)}</option>)}</select>}
              <input aria-label="Tìm ngân hàng" placeholder="Tìm theo tên, mã hoặc BIN" value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="w-full border rounded p-2 mb-2" />
              <select
                value={bankCode}
                onChange={(e) => { setBankCode(e.target.value); setIdempotencyKey(null); }}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-semibold"
              >
                {SUPPORTED_BANKS.filter(b => b.code === bankCode || [b.name,b.code,b.bin].some(v => v.toLowerCase().includes(bankSearch.trim().toLowerCase()))).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.name}
                  </option>
                ))}
                <option value="MANUAL">Ngân hàng khác (chuyển thủ công)</option>
              </select>
              {bankCode === "MANUAL" && <input required maxLength={120} placeholder="Tên ngân hàng" value={manualBank} onChange={e => { setManualBank(e.target.value); setIdempotencyKey(null); }} className="w-full border rounded p-2 mt-2" />}
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
                onChange={(e) => { setAccountNumber(e.target.value.replace(/\s+/g, '')); setIdempotencyKey(null); }}
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
                onChange={(e) => { setAccountHolderName(e.target.value.toUpperCase()); setIdempotencyKey(null); }}
                placeholder="VD: NGUYEN VAN A"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-bold"
              />
            </div>

            <button type="button" className="text-xs underline" onClick={async () => {
              try {
                await walletService.saveBankAccount({bankName: SUPPORTED_BANKS.find(b => b.code === bankCode)?.name || manualBank.trim(), bankCode, accountNumber: accountNumber.trim(), accountHolderName: accountHolderName.trim()});
                setSavedBanks(await walletService.savedBankAccounts()); setSuccessMessage('Đã lưu tài khoản vào hồ sơ.');
              } catch { setErrorMessage('Không thể lưu. Vui lòng kiểm tra thông tin tài khoản.'); }
            }}>Lưu tài khoản vào hồ sơ</button>
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Số tiền cần rút (VND) <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-slate-400">Tối thiểu: 10.000₫</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={amountStr ? formatVndInput(amountStr) : ''}
                  onChange={(e) => handleVndInputChange(e, (_num, raw) => { setAmountStr(raw); setIdempotencyKey(null); })}
                  onKeyDown={(e) => handleVndInputKeyDown(e, (_num, raw) => setAmountStr(raw))}
                  placeholder="Nhập số tiền (VND)..."
                  className="w-full text-xs px-3 py-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-black text-base text-[#c34c36]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  đ
                </span>
              </div>

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
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableBalance < 10000}
                className="px-5 py-2.5 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi yêu cầu rút tiền</span>
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
                        ['TRANSFERRED_AWAITING_REVIEW', 'COMPLETED'].includes(item.status)
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status === 'TRANSFERRED_AWAITING_REVIEW'
                        ? 'Đã chuyển khoản · chờ đối soát'
                        : item.status === 'COMPLETED'
                        ? 'Hoàn tất'
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
                  {item.status === 'PENDING' && <button onClick={() => cancelWithdrawal(item.id)} className="text-xs font-bold text-rose-700 underline">Hủy yêu cầu</button>}
                  {item.status === 'TRANSFERRED_AWAITING_REVIEW' && item.disputeDeadline && Date.now() <= new Date(item.disputeDeadline).getTime() && <><button className="mr-3 font-bold" onClick={async () => { if (!window.confirm("Bạn xác nhận tiền đã vào tài khoản?")) return; try { await walletService.confirmReceipt(item.id); await fetchHistory(0); } catch { setErrorMessage("Không thể xác nhận. Vui lòng tải lại lịch sử."); } }}>Đã nhận</button><button onClick={() => reportWithdrawalIssue(item.id)} className="text-xs font-bold text-amber-800 underline">Báo cáo vấn đề trong 48 giờ</button></>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

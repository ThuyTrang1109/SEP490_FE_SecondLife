import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  History,
  Loader2,
  Lock,
  Plus,
  X,
} from 'lucide-react';
import { withdrawalBanks } from '../../services/withdrawalBanks';
import {
  BankAccountHistoryItem,
  OFFICIAL_BANK_WARNING_TEXT,
  SavedBankAccount,
  walletService,
} from '../../services/walletService';
import { BankSearchSelect } from './BankSearchSelect';
import { BankAccountHistoryTimeline } from './BankAccountHistoryTimeline';

interface SavedBankAccountsManagerProps {
  onDefaultChanged?: (account: SavedBankAccount | null) => void;
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Thiết lập lần đầu',
  REPLACED: 'Đổi sang tài khoản mới',
  UPDATED: 'Cập nhật tài khoản',
  DELETED: 'Xóa tài khoản',
  MIGRATION_BACKFILL: 'Đồng bộ từ hồ sơ',
};

export const SavedBankAccountsManager: React.FC<SavedBankAccountsManagerProps> = ({
  onDefaultChanged,
}) => {
  const [accounts, setAccounts] = useState<SavedBankAccount[]>([]);
  const [history, setHistory] = useState<BankAccountHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Locked vs Edit mode: locked by default when an account exists
  const [isEditing, setIsEditing] = useState(false);
  const [bankCode, setBankCode] = useState(withdrawalBanks[1]?.code || 'VCB');
  const [manualBankName, setManualBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Mandatory Warning Popup state
  const [pendingSubmit, setPendingSubmit] = useState<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  } | null>(null);

  const primaryAccount =
    accounts.find((a) => a.isPrimary) ||
    accounts.find((a) => a.id === walletService.getDefaultBankAccountId()) ||
    accounts[0] ||
    null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, hist] = await Promise.all([
        walletService.savedBankAccounts(),
        walletService.getBankAccountHistory().catch(() => []),
      ]);
      setAccounts(list);
      setHistory(hist);
      if (list.length > 0) {
        const chosen = list.find((a) => a.isPrimary) || list[0];
        walletService.setDefaultBankAccountId(chosen.id);
        onDefaultChanged?.(chosen);
      } else {
        onDefaultChanged?.(null);
      }
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [onDefaultChanged]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openEditor = (existing: SavedBankAccount | null) => {
    setNotice(null);
    if (existing) {
      const matched = withdrawalBanks.find(
        (b) => b.code === existing.bankCode || b.bin === existing.bankCode || b.name === existing.bankName,
      );
      if (matched) {
        setBankCode(matched.code);
        setManualBankName('');
      } else {
        setBankCode('MANUAL');
        setManualBankName(existing.bankName);
      }
      setAccountNumber(existing.accountNumber);
      setAccountHolderName(existing.accountHolderName);
    } else {
      setBankCode(withdrawalBanks[1]?.code || 'VCB');
      setManualBankName('');
      setAccountNumber('');
      setAccountHolderName('');
    }
    setIsEditing(true);
  };

  const handlePrepareSave = () => {
    setNotice(null);
    const cleanAcc = accountNumber.replace(/\D/g, '');
    const cleanHolder = accountHolderName.trim().toUpperCase();
    const matched = withdrawalBanks.find((b) => b.code === bankCode);
    const resolvedBankName = bankCode === 'MANUAL' ? manualBankName.trim() : matched?.name || bankCode;

    if (!resolvedBankName) {
      setNotice({ type: 'error', text: 'Vui lòng tìm và chọn ngân hàng nhận tiền.' });
      return;
    }
    if (cleanAcc.length < 6 || cleanAcc.length > 30) {
      setNotice({ type: 'error', text: 'Số tài khoản phải gồm từ 6 đến 30 chữ số.' });
      return;
    }
    if (cleanHolder.length < 2) {
      setNotice({ type: 'error', text: 'Vui lòng nhập đầy đủ tên chủ tài khoản viết hoa.' });
      return;
    }

    setPendingSubmit({
      bankCode,
      bankName: resolvedBankName,
      accountNumber: cleanAcc,
      accountHolderName: cleanHolder,
    });
  };

  const handleConfirmSave = async () => {
    if (!pendingSubmit || saving) return;
    setSaving(true);
    try {
      // Lưu tài khoản mới làm mặc định; BE tự lưu bản ghi đối soát ngân hàng cũ vào user_bank_account_history
      const newId = await walletService.saveBankAccount({
        bankCode: pendingSubmit.bankCode,
        bankName: pendingSubmit.bankName,
        accountNumber: pendingSubmit.accountNumber,
        accountHolderName: pendingSubmit.accountHolderName,
      });
      if (newId) {
        walletService.setDefaultBankAccountId(newId);
      }
      setPendingSubmit(null);
      setIsEditing(false);
      setNotice({
        type: 'success',
        text: 'Đã lưu tài khoản ngân hàng mới. Thông tin tài khoản cũ đã được ghi nhận vào lịch sử đối soát.',
      });
      await loadData();
    } catch (err: any) {
      setPendingSubmit(null);
      setNotice({
        type: 'error',
        text: err?.message || 'Không thể lưu tài khoản ngân hàng. Vui lòng kiểm tra lại dữ liệu.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="p-5 rounded-2xl bg-slate-50 border border-gray-200 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-700" />
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Tài Khoản Ngân Hàng Nhận Tiền
            </h3>
            <p className="text-[11px] text-slate-500">
              Thông tin được khóa bảo vệ; mọi thay đổi và giao dịch cũ đều lưu lịch sử truy vết.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Lịch sử TK cũ ({history.length})</span>
            </button>
          )}
          {!primaryAccount && !isEditing && (
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24263e] hover:bg-[#1a1c2e] text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thiết lập tài khoản</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Đang tải thông tin ngân hàng...</span>
        </div>
      ) : !isEditing && primaryAccount ? (
        /* Chế độ Khóa (Read-Only) mặc định + Nút Chỉnh sửa ở góc trên bên phải */
        <div className="relative p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => openEditor(primaryAccount)}
            title="Chỉnh sửa / Đổi tài khoản ngân hàng mới"
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#c34c36]" />
            <span>Chỉnh sửa</span>
          </button>

          <div className="pr-24 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Lock className="w-2.5 h-2.5" />
                Đang khóa bảo vệ
              </span>
              <span className="text-xs font-black text-slate-900">
                {primaryAccount.bankName} ({primaryAccount.bankCode})
              </span>
            </div>
            <div className="text-sm font-mono font-black text-slate-800 tracking-wide">
              STK: {primaryAccount.accountNumber}
            </div>
            <div className="text-xs font-bold text-slate-600 uppercase">
              Chủ tài khoản: {primaryAccount.accountHolderName}
            </div>
          </div>
        </div>
      ) : !isEditing ? (
        <div className="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            Chưa có tài khoản ngân hàng nhận tiền trong hồ sơ.
          </p>
          <p className="text-[11px] text-slate-500">
            Nhấn &ldquo;Thiết lập tài khoản&rdquo; để lưu sẵn thông tin nhận tiền khi rút số dư ví.
          </p>
        </div>
      ) : null}

      {/* Form Chỉnh sửa / Lưu tài khoản ngân hàng mới (có ô Tìm kiếm ngân hàng) */}
      {isEditing && (
        <div className="p-4 rounded-2xl bg-white border border-slate-300 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900">
              {primaryAccount
                ? 'Cập Nhật / Đổi Tài Khoản Ngân Hàng Mới'
                : 'Thiết Lập Tài Khoản Ngân Hàng Nhận Tiền'}
            </h4>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-600 text-[11px] font-semibold block mb-1">
                Tìm &amp; chọn ngân hàng *
              </label>
              <BankSearchSelect
                value={bankCode}
                onChange={(code) => setBankCode(code)}
                manualBankName={manualBankName}
                onManualBankNameChange={setManualBankName}
                disabled={saving}
              />
            </div>
            <div>
              <label className="text-slate-600 text-[11px] font-semibold block mb-1">
                Số tài khoản *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập 6 - 30 chữ số"
                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="text-slate-600 text-[11px] font-semibold block mb-1">
                Tên chủ tài khoản (VIẾT HOA) *
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value.toUpperCase())}
                placeholder="VD: NGUYEN VAN A"
                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold uppercase text-slate-900"
              />
            </div>
          </div>

          {primaryAccount && (
            <p className="text-[11px] text-slate-500">
              Khi lưu tài khoản mới, thông tin ngân hàng cũ ({primaryAccount.bankName} •{' '}
              {primaryAccount.accountNumber}) vẫn được lưu lại trong lịch sử truy vết giao dịch.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handlePrepareSave}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              {primaryAccount ? 'Kiểm tra & Lưu tài khoản mới' : 'Kiểm tra & Lưu tài khoản'}
            </button>
          </div>
        </div>
      )}

      {/* Bảng Truy vết lịch sử tài khoản ngân hàng cũ */}
      {showHistory && history.length > 0 && (
        <BankAccountHistoryTimeline
          items={history}
          onCollapse={() => setShowHistory(false)}
          maxHeightClass="max-h-72"
        />
      )}

      {/* Popup Cảnh báo xác nhận thông tin ngân hàng */}
      {pendingSubmit && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Cảnh Báo Xác Nhận Thông Tin Ngân Hàng
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {OFFICIAL_BANK_WARNING_TEXT}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Ngân hàng:</span>
                <strong className="text-slate-900">
                  {pendingSubmit.bankName} ({pendingSubmit.bankCode})
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Số tài khoản:</span>
                <strong className="font-mono text-slate-900">{pendingSubmit.accountNumber}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Chủ tài khoản:</span>
                <strong className="text-slate-900 uppercase">
                  {pendingSubmit.accountHolderName}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingSubmit(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmSave()}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

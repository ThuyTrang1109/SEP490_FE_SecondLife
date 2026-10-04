import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  QrCode,
  ArrowRight,
  Loader2,
  Sparkles,
  CreditCard,
  Wallet,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { TopupPackage, UserCredit, UserWallet, DepositResponseDTO } from '../../types';
import { topupService, walletService } from '../../services';
import logoImg from '../../assets/logo.png';
import { formatVND } from '../../utils/translations';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredit?: number;
  userCredit?: UserCredit;
  walletBalance?: number;
  onCreditUpdated?: (newBalance: number) => void;
  onUserCreditUpdated?: (newCredit: UserCredit) => void;
  onWalletUpdated?: (newBalance: number) => void;
  initialTab?: 'wallet' | 'packages';
}

const DEFAULT_PACKAGES: TopupPackage[] = [
  {
    id: 'pkg-1',
    name: 'Gói Cơ Bản',
    packageName: 'Gói Cơ Bản',
    price: 50000,
    priceVnd: 50000,
    postCredits: 50,
    creditPoints: 50,
    chatCredits: 5,
    bonusPoints: 5,
    description: 'Phù hợp đăng tin thử nghiệm',
    isPopular: false,
  },
  {
    id: 'pkg-2',
    name: 'Gói Phổ Thông',
    packageName: 'Gói Phổ Thông',
    price: 100000,
    priceVnd: 100000,
    postCredits: 100,
    creditPoints: 100,
    chatCredits: 15,
    bonusPoints: 15,
    description: 'Được tặng thêm 15% Xu thưởng',
    isPopular: true,
  },
  {
    id: 'pkg-3',
    name: 'Gói Thương Gia',
    packageName: 'Gói Thương Gia',
    price: 200000,
    priceVnd: 200000,
    postCredits: 200,
    creditPoints: 200,
    chatCredits: 40,
    bonusPoints: 40,
    description: 'Tặng 20% Xu thưởng + Ưu tiên hiển thị tin',
    isPopular: false,
  },
  {
    id: 'pkg-4',
    name: 'Gói VIP Pro',
    packageName: 'Gói VIP Pro',
    price: 500000,
    priceVnd: 500000,
    postCredits: 500,
    creditPoints: 500,
    chatCredits: 120,
    bonusPoints: 120,
    description: 'Tặng 24% Xu thưởng + Đăng tin không giới hạn',
    isPopular: false,
  },
];

const PRESET_DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const getPkgName = (pkg?: TopupPackage | null) => pkg?.name || pkg?.packageName || 'Gói nạp Xu';
const getPkgPrice = (pkg?: TopupPackage | null) => Number(pkg?.price ?? pkg?.priceVnd ?? 50000);
const getPkgCredits = (pkg?: TopupPackage | null) => Number(pkg?.postCredits ?? pkg?.creditPoints ?? 50);
const getPkgBonus = (pkg?: TopupPackage | null) => Number(pkg?.chatCredits ?? pkg?.bonusPoints ?? 0);
const getPkgTotalCredits = (pkg?: TopupPackage | null) => getPkgCredits(pkg) + getPkgBonus(pkg);

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  currentCredit = 0,
  userCredit: initialUserCredit,
  walletBalance: initialWalletBalance,
  onCreditUpdated,
  onUserCreditUpdated,
  onWalletUpdated,
  initialTab = 'wallet',
}) => {
  // Active primary tab: 'wallet' (nạp tiền) or 'packages' (mua gói xu)
  const [activeTab, setActiveTab] = useState<'wallet' | 'packages'>(initialTab);

  // Wallet State
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>('100000');
  const [depositRequest, setDepositRequest] = useState<DepositResponseDTO | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Packages State
  const [packages, setPackages] = useState<TopupPackage[]>(DEFAULT_PACKAGES);
  const [selectedPkg, setSelectedPkg] = useState<TopupPackage | null>(DEFAULT_PACKAGES[1]);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<boolean>(false);

  const [userCredit, setUserCredit] = useState<UserCredit>(
    initialUserCredit || { postCredits: currentCredit || 10, chatCredits: 20 }
  );

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load wallet & packages when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDepositRequest(null);
      setDepositError(null);
      setPurchaseError(null);
      setPackageSuccess(false);
      loadWallet();
      loadPackagesAndCredit();
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen, initialTab]);

  // Polling wallet balance when a deposit request is pending
  useEffect(() => {
    if (depositRequest && depositRequest.status === 'PENDING') {
      const initialBalance = wallet?.balance ?? 0;
      pollingRef.current = setInterval(async () => {
        try {
          const freshWallet = await walletService.getMyWallet();
          if (freshWallet && freshWallet.balance > initialBalance) {
            setWallet(freshWallet);
            if (onWalletUpdated) onWalletUpdated(freshWallet.balance);
            setDepositRequest((prev) => prev ? { ...prev, status: 'SUCCESS' } : null);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        } catch {
          // ignore transient polling errors
        }
      }, 4000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [depositRequest, wallet?.balance]);

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const w = await walletService.getMyWallet();
      if (w) {
        setWallet(w);
        if (onWalletUpdated) onWalletUpdated(w.balance);
      }
    } catch (err: any) {
      console.warn('Could not load wallet from BE:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  const loadPackagesAndCredit = async () => {
    setPackagesLoading(true);
    try {
      const [pkgsRes, creditObj] = await Promise.all([
        topupService.getTopupPackages().catch(() => DEFAULT_PACKAGES),
        topupService.getMyCredit().catch(() => null),
      ]);

      const pkgsList = Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes as any)?.data || DEFAULT_PACKAGES;
      if (Array.isArray(pkgsList) && pkgsList.length > 0) {
        setPackages(pkgsList);
        setSelectedPkg(pkgsList[0]);
      } else {
        setPackages(DEFAULT_PACKAGES);
        setSelectedPkg(DEFAULT_PACKAGES[1]);
      }

      if (creditObj) {
        setUserCredit(creditObj);
      }
    } catch {
      setPackages(DEFAULT_PACKAGES);
      setSelectedPkg(DEFAULT_PACKAGES[1]);
    } finally {
      setPackagesLoading(false);
    }
  };

  // Handle Create Deposit Request
  const handleCreateDeposit = async () => {
    const amountNum = Number(depositAmount);
    if (isNaN(amountNum) || amountNum < 10000) {
      setDepositError('Số tiền nạp tối thiểu là 10.000 VNĐ');
      return;
    }
    setDepositError(null);
    setCreatingDeposit(true);
    try {
      const res = await walletService.createDepositRequest(amountNum);
      setDepositRequest(res);
    } catch (err: any) {
      setDepositError(err?.message || 'Không thể tạo yêu cầu nạp tiền. Vui lòng thử lại sau.');
    } finally {
      setCreatingDeposit(false);
    }
  };

  // Handle Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle Purchase Package via Wallet balance
  const handleConfirmPurchase = async () => {
    if (!selectedPkg) return;
    const pkgPrice = getPkgPrice(selectedPkg);
    const currentBal = wallet?.balance ?? 0;

    if (currentBal < pkgPrice) {
      setPurchaseError(`Số dư ví (${formatVND(currentBal)}) không đủ để mua gói này (${formatVND(pkgPrice)}). Vui lòng nạp thêm tiền vào ví!`);
      return;
    }

    setPurchaseError(null);
    setPurchasing(true);
    try {
      const result = await topupService.purchasePackage(selectedPkg.id);
      const updatedCredit: UserCredit = result || {
        postCredits: (userCredit.postCredits || 0) + (selectedPkg.postCredits || 0),
        chatCredits: (userCredit.chatCredits || 0) + (selectedPkg.chatCredits || 0),
      };
      setUserCredit(updatedCredit);
      if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
      if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
        onCreditUpdated(updatedCredit.postCredits);
      }
      // Re-fetch wallet balance after deduction
      loadWallet();
      setPackageSuccess(true);
    } catch (err: any) {
      setPurchaseError(err?.message || 'Giao dịch mua gói thất bại. Vui lòng kiểm tra lại số dư ví.');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isOpen) return null;

  const currentWalletBalance = wallet?.balance ?? initialWalletBalance ?? 0;

  // VietQR dynamic image URL generator using SePay bank details
  const vietQrUrl = depositRequest
    ? `https://img.vietqr.io/image/${depositRequest.bankName}-${depositRequest.bankAccountNumber}-compact2.png?amount=${depositRequest.amount}&addInfo=${depositRequest.code}&accountName=${encodeURIComponent(depositRequest.bankAccountName)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-[#faf8f5] border border-[#24263e]/15 text-[#24263e] shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#24263e] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-1.5 rounded-xl shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Ví Tiền &amp; Quyền Sử Dụng Second<span className="text-[#c34c36]">Life</span>
              </h3>
              <p className="text-xs text-[#fce5da] font-medium">
                Nạp tiền tự động qua VietQR (SePay) &bull; Mua gói lượt đăng tin AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer border border-white/15 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-[#24263e]/5 via-[#fce5da]/30 to-[#24263e]/5 border-b border-[#24263e]/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[11px] text-[#24263e]/70 font-semibold block leading-tight">Số Dư Ví Khả Dụng:</span>
              <span className="text-base sm:text-lg font-black text-[#24263e] font-mono leading-tight">
                {formatVND(currentWalletBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold font-mono">
            <span className="text-[#24263e] bg-white border border-[#24263e]/15 px-2.5 py-1 rounded-xl shadow-xs">
              Tin: <span className="font-black text-[#c34c36]">{userCredit.postCredits ?? 0}</span>
            </span>
            <span className="text-[#24263e] bg-white border border-[#24263e]/15 px-2.5 py-1 rounded-xl shadow-xs">
              AI Chat: <span className="font-black text-[#c34c36]">{userCredit.chatCredits ?? 0}</span>
            </span>
            <button
              onClick={loadWallet}
              title="Làm mới số dư"
              className="p-1 rounded-lg bg-white border border-[#24263e]/15 text-slate-600 hover:text-[#24263e] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#24263e]/10 bg-white/70 px-6 pt-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('wallet');
              setPurchaseError(null);
            }}
            className={`pb-2.5 px-4 text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'wallet'
                ? 'border-[#c34c36] text-[#c34c36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>1. Nạp Tiền Vào Ví (VietQR)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('packages');
              setDepositError(null);
            }}
            className={`pb-2.5 px-4 text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'packages'
                ? 'border-[#c34c36] text-[#c34c36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Mua Gói Quyền Sử Dụng (Trừ ví)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* ============================================================== */}
          {/* TAB 1: WALLET DEPOSIT VIA VIETQR                               */}
          {/* ============================================================== */}
          {activeTab === 'wallet' && (
            <div className="space-y-5">
              {!depositRequest ? (
                <>
                  <div className="bg-white p-5 rounded-2xl border border-[#24263e]/10 shadow-xs space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-[#24263e] flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#c34c36]" />
                        <span>Chọn hoặc nhập số tiền cần nạp</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Số tiền nạp tối thiểu là 10.000 VNĐ. Tiền được tự động cộng vào ví qua SePay Webhook ngay khi chuyển khoản xong.
                      </p>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {PRESET_DEPOSIT_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setDepositAmount(amt);
                            setCustomAmount(amt.toString());
                          }}
                          className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all border cursor-pointer ${
                            depositAmount === amt
                              ? 'bg-[#c34c36] text-white border-[#c34c36] shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {amt.toLocaleString('vi-VN')} đ
                        </button>
                      ))}
                    </div>

                    {/* Custom Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Số tiền tùy chỉnh (VNĐ):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={10000}
                          step={10000}
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            setDepositAmount(Number(e.target.value) || 0);
                          }}
                          placeholder="Ví dụ: 150000"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-[#c34c36] focus:bg-white transition"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          VNĐ
                        </span>
                      </div>
                    </div>

                    {depositError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{depositError}</span>
                      </div>
                    )}
                  </div>

                  {/* Create Button */}
                  <button
                    disabled={creatingDeposit || depositAmount < 10000}
                    onClick={handleCreateDeposit}
                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {creatingDeposit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang khởi tạo mã giao dịch...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        <span>Tạo Mã QR VietQR Nạp {depositAmount.toLocaleString('vi-VN')} VNĐ</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* QR CODE & BANK TRANSFER DETAILS VIEW */
                <div className="space-y-4 animate-fadeIn">
                  {depositRequest.status === 'SUCCESS' ? (
                    <div className="py-6 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
                      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-black text-emerald-800">
                        Nạp Tiền Thành Công!
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Hệ thống đã nhận được khoản thanh toán <strong>{formatVND(depositRequest.amount)}</strong>. Số dư ví của bạn đã được cập nhật tự động.
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-3">
                        <button
                          onClick={() => setDepositRequest(null)}
                          className="px-4 py-2 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                        >
                          Nạp Thêm Lần Nữa
                        </button>
                        <button
                          onClick={() => setActiveTab('packages')}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-sm"
                        >
                          Chuyển Sang Mua Gói Xu &rarr;
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white p-5 rounded-2xl border border-[#24263e]/10 shadow-xs flex flex-col md:flex-row gap-5 items-center">
                        {/* VietQR Image */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="p-2.5 bg-white rounded-2xl border-2 border-[#c34c36]/40 shadow-md">
                            <img
                              src={vietQrUrl}
                              alt="VietQR Chuyển Khoản"
                              className="w-44 h-44 object-contain rounded-xl"
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold mt-1.5 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                            Đang chờ nhận tiền qua SePay...
                          </span>
                        </div>

                        {/* Transfer Credentials */}
                        <div className="flex-1 w-full space-y-2.5 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Ngân hàng</span>
                              <span className="font-black text-slate-900">{depositRequest.bankName}</span>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Số tài khoản</span>
                              <span className="font-black text-slate-900 font-mono text-sm">{depositRequest.bankAccountNumber}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(depositRequest.bankAccountNumber, 'acc')}
                              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
                              title="Sao chép"
                            >
                              {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Chủ tài khoản</span>
                              <span className="font-bold text-slate-900 uppercase">{depositRequest.bankAccountName}</span>
                            </div>
                          </div>

                          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-amber-700 block font-bold">Nội dung chuyển khoản (Bắt buộc đúng)</span>
                              <span className="font-black text-[#c34c36] font-mono text-sm">{depositRequest.code}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(depositRequest.code, 'code')}
                              className="p-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:text-amber-900 cursor-pointer"
                              title="Sao chép mã"
                            >
                              {copiedField === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Số tiền</span>
                              <span className="font-black text-emerald-700 font-mono text-sm">{depositRequest.amount.toLocaleString('vi-VN')} VNĐ</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setDepositRequest(null)}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
                        >
                          &larr; Tạo giao dịch khác
                        </button>
                        <button
                          type="button"
                          onClick={loadWallet}
                          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                          <span>Kiểm Tra Số Dư Ngay</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: PACKAGES PURCHASE VIA WALLET                            */}
          {/* ============================================================== */}
          {activeTab === 'packages' && (
            <div className="space-y-4">
              {packageSuccess ? (
                <div className="py-8 text-center space-y-4 animate-fadeIn bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-emerald-900">Mua Gói Xu Thành Công!</h3>
                    <p className="text-xs text-emerald-700 font-medium">
                      Đã trừ{' '}
                      <span className="font-black font-mono">
                        {selectedPkg ? formatVND(getPkgPrice(selectedPkg)) : ''}
                      </span>{' '}
                      từ Ví và cộng{' '}
                      <span className="font-black font-mono">
                        +{selectedPkg?.postCredits || 0} tin &amp; +{selectedPkg?.chatCredits || 0} AI
                      </span>{' '}
                      vào tài khoản của bạn.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPackageSuccess(false)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      Mua Tiếp Gói Khác
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-md"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {purchaseError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium flex items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{purchaseError}</span>
                      </div>
                      <button
                        onClick={() => setActiveTab('wallet')}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] shrink-0 hover:bg-red-700 cursor-pointer"
                      >
                        Nạp ví ngay &rarr;
                      </button>
                    </div>
                  )}

                  {packagesLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-[#24263e] animate-spin" />
                      <p className="text-sm text-[#24263e]/80 font-bold">Đang tải danh sách gói nạp...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {packages.map((pkg) => {
                        const isSelected = selectedPkg?.id === pkg.id;
                        const pkgName = getPkgName(pkg);
                        const pkgPrice = getPkgPrice(pkg);
                        const postCredits = Number(pkg.postCredits || 0);
                        const chatCredits = Number(pkg.chatCredits || 0);
                        const isAffordable = currentWalletBalance >= pkgPrice;

                        return (
                          <div
                            key={pkg.id || Math.random().toString()}
                            onClick={() => {
                              setSelectedPkg(pkg);
                              setPurchaseError(null);
                            }}
                            className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-white border-2 border-[#c34c36] shadow-xl ring-2 ring-[#c34c36]/40 transform -translate-y-0.5'
                                : 'bg-white/90 border-[#24263e]/15 hover:border-[#c34c36] hover:bg-white hover:shadow-md'
                            }`}
                          >
                            {pkg.isPopular && (
                              <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-[#c34c36] text-white border border-[#24263e]/20 shadow-sm">
                                Phổ Biến Nhất
                              </span>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-black text-base text-[#24263e]">{pkgName}</h4>
                                <span className="text-base font-black text-[#24263e] font-mono">
                                  {pkgPrice.toLocaleString('vi-VN')} đ
                                </span>
                              </div>

                              <div className="flex flex-col gap-1.5 my-3">
                                <div className="flex items-center gap-2 text-xs text-[#24263e] font-bold">
                                  <Sparkles className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                                  <span>+{postCredits} Lượt đăng tin bài</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[#24263e] font-bold">
                                  <Zap className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                                  <span>+{chatCredits} Lượt AI tư vấn mô tả</span>
                                </div>
                              </div>

                              {pkg.description && (
                                <p className="text-xs text-[#24263e]/80 mt-1 font-medium">{pkg.description}</p>
                              )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#24263e]/10 flex items-center justify-between text-xs font-semibold">
                              <span className="text-slate-500">
                                {isAffordable ? (
                                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đủ số dư ví
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Thiếu {formatVND(pkgPrice - currentWalletBalance)}
                                  </span>
                                )}
                              </span>
                              <span className="text-[#24263e] font-black">Trừ trực tiếp Ví</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Buy Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      disabled={!selectedPkg || purchasing || packagesLoading}
                      onClick={handleConfirmPurchase}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang xử lý trừ ví &amp; cộng xu...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Xác Nhận Mua Gói ({selectedPkg ? formatVND(getPkgPrice(selectedPkg)) : ''})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

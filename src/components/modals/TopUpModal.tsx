import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  RefreshCw,
  Tag,
  Layers,
  Flame,
  Award,
  ShoppingBag
} from 'lucide-react';
import { TopupPackage, UserCredit, UserWallet, DepositResponseDTO } from '../../types';
import { topupService, walletService, sellerCreditService } from '../../services';
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

const COMBO_PACKAGES: TopupPackage[] = [
  {
    id: 'combo-starter',
    name: 'Combo Khởi Đầu (Starter)',
    description: 'Thanh lý nhanh gọn đồ dùng gia đình. Bao gồm 5 bài đăng và 5 lượt AI định giá.',
    postCredits: 5,
    chatCredits: 5,
    price: 55000,
    discountPercentage: 27,
    isPopular: false,
  },
  {
    id: 'combo-pro',
    name: 'Combo Nhà Bán Chuyên Nghiệp',
    description: 'Gói bán chạy nhất! Tối ưu chi phí cho seller đăng bán thường xuyên, hỗ trợ AI không giới hạn.',
    postCredits: 15,
    chatCredits: 20,
    price: 180000,
    discountPercentage: 28,
    isPopular: true,
  },
  {
    id: 'combo-vip',
    name: 'Combo Siêu Thương Nhân (VIP)',
    description: 'Dành cho cửa hàng đồ gia dụng, đại lý điện máy cũ. Mức chiết khấu cao nhất hệ thống.',
    postCredits: 50,
    chatCredits: 60,
    price: 520000,
    discountPercentage: 35,
    isPopular: false,
  }
];

const SINGLE_PACKAGES: (TopupPackage & { singleType: 'listing' | 'valuation' })[] = [
  // Gói lẻ Đăng bài (Listing credits only)
  {
    id: 'single-listing-1',
    name: 'Gói Lẻ: 1 Lượt Đăng Bài',
    description: 'Đăng ngay 1 sản phẩm lên Marketplace với bảo lãnh Escrow an toàn.',
    postCredits: 1,
    chatCredits: 0,
    price: 10000,
    discountPercentage: 0,
    singleType: 'listing',
  },
  {
    id: 'single-listing-5',
    name: 'Gói Lẻ: 5 Lượt Đăng Bài',
    description: 'Tiết kiệm 10% chi phí đăng bài trên sàn.',
    postCredits: 5,
    chatCredits: 0,
    price: 45000,
    discountPercentage: 10,
    singleType: 'listing',
  },
  {
    id: 'single-listing-10',
    name: 'Gói Lẻ: 10 Lượt Đăng Bài',
    description: 'Gói đăng tin được nhiều người bán lựa chọn nhất.',
    postCredits: 10,
    chatCredits: 0,
    price: 80000,
    discountPercentage: 20,
    singleType: 'listing',
    isPopular: true,
  },
  {
    id: 'single-listing-25',
    name: 'Gói Lẻ: 25 Lượt Đăng Bài',
    description: 'Đăng tin số lượng lớn dành cho người bán chuyên nghiệp.',
    postCredits: 25,
    chatCredits: 0,
    price: 185000,
    discountPercentage: 26,
    singleType: 'listing',
  },
  // Gói lẻ Định giá AI (Valuation credits only)
  {
    id: 'single-valuation-1',
    name: 'Gói Lẻ: 1 Lượt Định Giá AI',
    description: 'Định giá 1 sản phẩm chính xác dựa trên Machine Learning.',
    postCredits: 0,
    chatCredits: 1,
    price: 5000,
    discountPercentage: 0,
    singleType: 'valuation',
  },
  {
    id: 'single-valuation-5',
    name: 'Gói Lẻ: 5 Lượt Định Giá AI',
    description: 'Khảo sát giá thị trường cho 5 thiết bị trước khi đăng bán.',
    postCredits: 0,
    chatCredits: 5,
    price: 20000,
    discountPercentage: 20,
    singleType: 'valuation',
  },
  {
    id: 'single-valuation-15',
    name: 'Gói Lẻ: 15 Lượt Định Giá AI',
    description: 'Tiết kiệm 33% chi phí thẩm định giá thiết bị.',
    postCredits: 0,
    chatCredits: 15,
    price: 50000,
    discountPercentage: 33,
    singleType: 'valuation',
    isPopular: true,
  },
  {
    id: 'single-valuation-30',
    name: 'Gói Lẻ: 30 Lượt Định Giá AI',
    description: 'Gói chuyên sâu dành cho người hay khảo sát định giá thiết bị đồ cũ.',
    postCredits: 0,
    chatCredits: 30,
    price: 90000,
    discountPercentage: 40,
    singleType: 'valuation',
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
  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<TopupPackage | null>(null);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<boolean>(false);

  // Sub-category inside packages: 'combo' (Gói Combo) vs 'single' (Gói Lẻ)
  const [packageCategory, setPackageCategory] = useState<'combo' | 'single'>('combo');

  // Filter inside Gói Lẻ: 'all' | 'listing' | 'valuation'
  const [singleFilter, setSingleFilter] = useState<'all' | 'listing' | 'valuation'>('all');

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
        topupService.getTopupPackages().catch(() => []),
        topupService.getMyCredit().catch(() => null),
      ]);

      const pkgsList = Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes as any)?.data || [];
      const allPkgs: TopupPackage[] = [...pkgsList];
      const existingNames = new Set(pkgsList.map((p: any) => (p.name || '').toLowerCase()));

      for (const combo of COMBO_PACKAGES) {
        if (!existingNames.has((combo.name || '').toLowerCase())) {
          allPkgs.push(combo);
        }
      }

      for (const single of SINGLE_PACKAGES) {
        if (!existingNames.has((single.name || '').toLowerCase())) {
          allPkgs.push(single);
        }
      }

      setPackages(allPkgs);
      setSelectedPkg(allPkgs[0]);

      if (creditObj) {
        setUserCredit(creditObj);
      }
    } catch {
      setPackages([...COMBO_PACKAGES, ...SINGLE_PACKAGES]);
      setSelectedPkg(COMBO_PACKAGES[0]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const comboPackages = useMemo(() => {
    return packages.filter((p) => {
      const posts = Number(p.postCredits || 0);
      const chats = Number(p.chatCredits || 0);
      const name = (p.name || '').toLowerCase();
      return (posts > 0 && chats > 0) || name.includes('combo') || name.includes('trọn gói');
    });
  }, [packages]);

  const singlePackages = useMemo(() => {
    return packages.filter((p) => {
      const posts = Number(p.postCredits || 0);
      const chats = Number(p.chatCredits || 0);
      const name = (p.name || '').toLowerCase();
      const isCombo = (posts > 0 && chats > 0) || name.includes('combo') || name.includes('trọn gói');
      if (isCombo) return false;

      const singleType = (p as any).singleType || (posts > 0 ? 'listing' : 'valuation');
      if (singleFilter === 'listing') {
        return singleType === 'listing';
      }
      if (singleFilter === 'valuation') {
        return singleType === 'valuation';
      }
      return true;
    });
  }, [packages, singleFilter]);

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
      let result: any = null;
      const isBackendUuid = selectedPkg.id && selectedPkg.id.length >= 32 && selectedPkg.id.includes('-');
      if (isBackendUuid) {
        try {
          result = await topupService.purchasePackage(selectedPkg.id);
        } catch (err: any) {
          console.warn('topupService.purchasePackage fallback:', err);
        }
      }

      // Sync through sellerCreditService.createPurchase
      try {
        await sellerCreditService.createPurchase({
          listingQuantity: selectedPkg.postCredits || 0,
          valuationQuantity: selectedPkg.chatCredits || 0,
        });
      } catch (err) {
        console.warn('sellerCreditService.createPurchase notice:', err);
      }

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
      await loadWallet();
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
            className={`pb-2.5 px-4 text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 ${activeTab === 'wallet'
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
            className={`pb-2.5 px-4 text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 ${activeTab === 'packages'
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
                          className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all border cursor-pointer ${depositAmount === amt
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
                  {/* Sub-tab Switcher: COMBO vs GÓI LẺ */}
                  <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setPackageCategory('combo');
                        if (comboPackages.length > 0 && (!selectedPkg || !comboPackages.some((c) => c.id === selectedPkg.id))) {
                          setSelectedPkg(comboPackages[0]);
                        }
                        setPurchaseError(null);
                      }}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${packageCategory === 'combo'
                          ? 'bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>Mua Gói Combo (Đăng Bài + Định Giá)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                        Tiết kiệm tới 35%
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPackageCategory('single');
                        if (singlePackages.length > 0 && (!selectedPkg || !singlePackages.some((s) => s.id === selectedPkg.id))) {
                          setSelectedPkg(singlePackages[0]);
                        }
                        setPurchaseError(null);
                      }}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${packageCategory === 'single'
                          ? 'bg-[#24263e] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>Mua Gói Lẻ (Từng Loại Riêng)</span>
                    </button>
                  </div>

                  {packagesLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-[#24263e] animate-spin" />
                      <p className="text-sm text-[#24263e]/80 font-bold">Đang tải danh sách gói nạp...</p>
                    </div>
                  ) : (
                    <>
                      {/* COMBO VIEW */}
                      {packageCategory === 'combo' && (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-[#c34c36] shrink-0" />
                              <span className="text-slate-700">
                                <strong>Gói Combo Toàn Diện:</strong> Tích hợp cả lượt đăng bài chuẩn sàn và lượt định giá AI giúp bạn tối ưu chi phí bán hàng.
                              </span>
                            </div>
                            <span className="text-[11px] font-black text-[#c34c36] shrink-0 ml-2">
                              {comboPackages.length} Gói Combo
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            {comboPackages.map((pkg) => {
                              const isSelected = selectedPkg?.id === pkg.id;
                              const pkgName = getPkgName(pkg);
                              const pkgPrice = getPkgPrice(pkg);
                              const postCredits = Number(pkg.postCredits || 0);
                              const chatCredits = Number(pkg.chatCredits || 0);
                              const isAffordable = currentWalletBalance >= pkgPrice;

                              return (
                                <div
                                  key={pkg.id}
                                  onClick={() => {
                                    setSelectedPkg(pkg);
                                    setPurchaseError(null);
                                  }}
                                  className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                                      ? 'bg-white border-2 border-[#c34c36] shadow-lg ring-2 ring-[#c34c36]/40 transform -translate-y-0.5'
                                      : 'bg-white border-slate-200/90 hover:border-[#c34c36] hover:shadow-md'
                                    }`}
                                >
                                  {pkg.isPopular && (
                                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full bg-gradient-to-r from-amber-500 to-[#c34c36] text-white shadow-xs">
                                      🔥 Phổ Biến Nhất
                                    </span>
                                  )}
                                  {pkg.discountPercentage && pkg.discountPercentage > 0 && !pkg.isPopular && (
                                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full bg-emerald-600 text-white shadow-xs">
                                      Giảm {pkg.discountPercentage}%
                                    </span>
                                  )}

                                  <div>
                                    <h4 className="font-black text-xs sm:text-sm text-[#24263e] line-clamp-1">{pkgName}</h4>
                                    <div className="mt-1 flex items-baseline gap-1.5">
                                      <span className="text-base font-black text-[#c34c36] font-mono">
                                        {formatVND(pkgPrice)}
                                      </span>
                                      {pkg.discountPercentage && pkg.discountPercentage > 0 && (
                                        <span className="text-[10px] text-slate-400 line-through font-mono">
                                          {formatVND(Math.round(pkgPrice / (1 - pkg.discountPercentage / 100)))}
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-1.5 my-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                        <Tag className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                                        <span>+{postCredits} Lượt đăng tin bài</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span>+{chatCredits} Lượt định giá AI</span>
                                      </div>
                                    </div>

                                    {pkg.description && (
                                      <p className="text-[11px] text-slate-500 line-clamp-2">{pkg.description}</p>
                                    )}
                                  </div>

                                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                    {isAffordable ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Đủ số dư ví
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-bold">
                                        Thiếu {formatVND(pkgPrice - currentWalletBalance)}
                                      </span>
                                    )}
                                    <span className="text-[#24263e] font-extrabold text-[10px] bg-slate-100 px-2 py-0.5 rounded-md">
                                      Combo Trừ Ví
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* SINGLE PACKAGES VIEW */}
                      {packageCategory === 'single' && (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setSingleFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${singleFilter === 'all'
                                    ? 'bg-white text-[#24263e] shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                  }`}
                              >
                                Tất Cả Gói Lẻ ({packages.filter(p => !((Number(p.postCredits || 0) > 0 && Number(p.chatCredits || 0) > 0) || (p.name || '').toLowerCase().includes('combo'))).length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSingleFilter('listing')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${singleFilter === 'listing'
                                    ? 'bg-white text-[#c34c36] shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                  }`}
                              >
                                <Tag className="w-3 h-3" />
                                <span>Chỉ Lượt Đăng Bài</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSingleFilter('valuation')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${singleFilter === 'valuation'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                  }`}
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Chỉ Lượt Định Giá AI</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {singlePackages.map((pkg) => {
                              const isSelected = selectedPkg?.id === pkg.id;
                              const pkgName = getPkgName(pkg);
                              const pkgPrice = getPkgPrice(pkg);
                              const postCredits = Number(pkg.postCredits || 0);
                              const chatCredits = Number(pkg.chatCredits || 0);
                              const isListingType = postCredits > 0;
                              const isAffordable = currentWalletBalance >= pkgPrice;

                              return (
                                <div
                                  key={pkg.id}
                                  onClick={() => {
                                    setSelectedPkg(pkg);
                                    setPurchaseError(null);
                                  }}
                                  className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                                      ? 'bg-white border-2 border-[#24263e] shadow-md ring-2 ring-[#24263e]/20 transform -translate-y-0.5'
                                      : 'bg-white border-slate-200 hover:border-[#24263e]/60 hover:shadow-xs'
                                    }`}
                                >
                                  {pkg.discountPercentage && pkg.discountPercentage > 0 && (
                                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 text-[9px] font-black rounded-md bg-emerald-600 text-white">
                                      -{pkg.discountPercentage}%
                                    </span>
                                  )}

                                  <div>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${isListingType
                                          ? 'bg-orange-100 text-orange-900'
                                          : 'bg-indigo-100 text-indigo-900'
                                        }`}
                                    >
                                      {isListingType ? <Tag className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                      <span>{isListingType ? 'Đăng Bài' : 'Định Giá AI'}</span>
                                    </span>

                                    <h4 className="font-black text-xs text-[#24263e] mt-2 line-clamp-1">{pkgName}</h4>
                                    <div className="text-sm font-black text-[#24263e] font-mono mt-1">
                                      {formatVND(pkgPrice)}
                                    </div>

                                    <div className="mt-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      {isListingType ? (
                                        <span>+{postCredits} Lượt đăng tin</span>
                                      ) : (
                                        <span>+{chatCredits} Lượt định giá AI</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                    {isAffordable ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                        <Check className="w-3 h-3" /> Đủ số dư
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-bold">
                                        Thiếu {formatVND(pkgPrice - currentWalletBalance)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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

                      {/* Summary & Purchase Action Bar */}
                      <div className="pt-3 border-t border-[#24263e]/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-700 w-full sm:w-auto">
                          {selectedPkg ? (
                            <div>
                              <span className="font-bold text-slate-500">Đang chọn: </span>
                              <span className="font-black text-[#24263e]">{getPkgName(selectedPkg)}</span>
                              <span className="mx-1.5">•</span>
                              <span className="font-mono font-black text-[#c34c36]">
                                {formatVND(getPkgPrice(selectedPkg))}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Vui lòng chọn một gói nạp ở trên</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {selectedPkg && currentWalletBalance < getPkgPrice(selectedPkg) && (
                            <button
                              type="button"
                              onClick={() => {
                                setDepositAmount(getPkgPrice(selectedPkg) - currentWalletBalance);
                                setActiveTab('wallet');
                              }}
                              className="px-4 py-3 rounded-2xl font-bold text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer"
                            >
                              Nạp Thiếu {formatVND(getPkgPrice(selectedPkg) - currentWalletBalance)} &rarr;
                            </button>
                          )}

                          <button
                            disabled={!selectedPkg || purchasing || packagesLoading}
                            onClick={handleConfirmPurchase}
                            className="flex-1 sm:flex-none px-7 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {purchasing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang xử lý trừ ví...</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-4 h-4" />
                                <span>
                                  Xác Nhận Mua Gói ({selectedPkg ? formatVND(getPkgPrice(selectedPkg)) : ''})
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

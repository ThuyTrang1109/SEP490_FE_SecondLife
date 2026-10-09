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
  ShoppingBag,
  ShieldCheck,
  Clock,
  Search,
} from 'lucide-react';
import { TopupPackage, UserCredit, UserWallet, DepositResponseDTO, UserProfile, UserRole, Language } from '../../types';
import { topupService, walletService, sellerCreditService } from '../../services';
import logoImg from '../../assets/logo.png';
import { formatVND } from '../../utils/translations';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  currentRole?: UserRole;
  currentCredit?: number;
  userCredit?: UserCredit;
  walletBalance?: number;
  onCreditUpdated?: (newBalance: number) => void;
  onUserCreditUpdated?: (newCredit: UserCredit) => void;
  onWalletUpdated?: (newBalance: number) => void;
  initialTab?: 'wallet' | 'packages';
  lang?: Language;
}



const PRESET_DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const getPkgName = (pkg?: TopupPackage | null) => pkg?.name || pkg?.packageName || 'Gói nạp Xu';
const getPkgPrice = (pkg?: TopupPackage | null) => Number(pkg?.price ?? pkg?.priceVnd ?? 50000);
const getPkgCredits = (pkg?: TopupPackage | null) => Number(pkg?.postCredits ?? pkg?.creditPoints ?? 50);
const getPkgBonus = (pkg?: TopupPackage | null) => Number(pkg?.chatCredits ?? pkg?.bonusPoints ?? 0);
const getPkgTotalCredits = (pkg?: TopupPackage | null) => getPkgCredits(pkg) + getPkgBonus(pkg);

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
  currentCredit = 0,
  userCredit: initialUserCredit = { postCredits: currentCredit || 10, valuationCredits: 0, chatCredits: 20 },
  walletBalance: initialWalletBalance,
  onCreditUpdated,
  onUserCreditUpdated,
  onWalletUpdated,
  initialTab = 'wallet',
  lang = 'vi',
}) => {
  const isBuyerRole = (currentRole === 'buyer') || (currentUser?.role === 'buyer');

  // Active primary tab: 'wallet' (nạp tiền) or 'packages' (mua gói xu). Buyers only need 'wallet'
  const [activeTab, setActiveTab] = useState<'wallet' | 'packages' | 'history'>(isBuyerRole ? 'wallet' : initialTab);

  // Wallet State
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>('100.000');
  const [depositRequest, setDepositRequest] = useState<DepositResponseDTO | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes in seconds
  const [isZoomQrOpen, setIsZoomQrOpen] = useState<boolean>(false);

  // Packages State
  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<TopupPackage | null>(null);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<boolean>(false);

  // Pending package to auto-purchase after deficit topup via VietQR
  const [pendingPackage, setPendingPackage] = useState<TopupPackage | null>(null);
  const [autoActivating, setAutoActivating] = useState<boolean>(false);

  // Sub-category inside packages: 'combo' (Gói Combo) vs 'single' (Gói Lẻ)
  const [packageCategory, setPackageCategory] = useState<'combo' | 'single'>('combo');

  // Filter inside Gói Lẻ: 'all' | 'listing' | 'valuation'
  const [singleFilter, setSingleFilter] = useState<'all' | 'listing' | 'valuation'>('all');

  const [userCredit, setUserCredit] = useState<UserCredit>(
    initialUserCredit || { postCredits: currentCredit || 10, valuationCredits: 0, chatCredits: 20 }
  );

  // History State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load wallet & packages when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isBuyerRole ? 'wallet' : initialTab);
      setDepositRequest(null);
      setPendingPackage(null);
      setAutoActivating(false);
      setDepositError(null);
      setPurchaseError(null);
      setPackageSuccess(false);
      loadWallet();
      if (!isBuyerRole) {
        loadPackagesAndCredit();
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen, initialTab, isBuyerRole]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setTransactionsLoading(true);
    try {
      const data = await walletService.getTransactionHistory();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Timer countdown for deposit request
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    if (depositRequest && depositRequest.status === 'PENDING') {
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval!);
            setDepositRequest(null);
            setDepositError('Hết thời gian giao dịch (5 phút). Vui lòng tạo yêu cầu nạp tiền mới nếu vẫn muốn giao dịch.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(300);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [depositRequest]);

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
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            // Nếu người bán đang mua gói bị thiếu tiền, tự động hoàn tất mua gói ngay khi tiền nạp vào ví
            if (pendingPackage) {
              const targetPkg = pendingPackage;
              const pkgPrice = getPkgPrice(targetPkg);
              if (freshWallet.balance >= pkgPrice) {
                setAutoActivating(true);
                try {
                  let result: any = null;
                  const isBackendUuid = targetPkg.id && targetPkg.id.length >= 32 && targetPkg.id.includes('-');
                  if (isBackendUuid) {
                    try {
                      result = await topupService.purchasePackage(targetPkg.id);
                    } catch (err) {
                      console.warn('topupService.purchasePackage auto notice:', err);
                    }
                  }

                  try {
                    await sellerCreditService.createPurchase({
                      listingQuantity: targetPkg.postCredits || 0,
                      valuationQuantity: targetPkg.chatCredits || 0,
                      aiChatQuantity: (targetPkg as any).aiChatCredits || 0,
                    });
                  } catch (err) {
                    console.warn('sellerCreditService.createPurchase auto notice:', err);
                  }

                  const updatedCredit: UserCredit = result || {
                    postCredits: (userCredit?.postCredits || 0) + (targetPkg.postCredits || 0),
                    chatCredits: (userCredit?.chatCredits || 0) + (targetPkg.chatCredits || 0),
                    valuationCredits: (userCredit?.valuationCredits || 0) + (targetPkg.valuationCredits || 0),
                  };
                  setUserCredit(updatedCredit);
                  if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
                  if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
                    onCreditUpdated(updatedCredit.postCredits);
                  }

                  const finalWallet = await walletService.getMyWallet().catch(() => null);
                  if (finalWallet) {
                    setWallet(finalWallet);
                    if (onWalletUpdated) onWalletUpdated(finalWallet.balance);
                  }

                  setDepositRequest(null);
                  setSelectedPkg(targetPkg);
                  setPackageSuccess(true);
                  setActiveTab('packages');
                  return;
                } catch (autoErr) {
                  console.error('Lỗi tự động kích hoạt gói sau khi nạp tiền:', autoErr);
                } finally {
                  setAutoActivating(false);
                }
              }
            }

            setDepositRequest((prev) => prev ? { ...prev, status: 'SUCCESS' } : null);
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
  }, [depositRequest, wallet?.balance, pendingPackage, userCredit]);

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const w = await walletService.getMyWallet();
      if (w) {
        setWallet(w);
        if (onWalletUpdated) onWalletUpdated(w.balance);

        // Nếu đang có pendingPackage và số dư ví đã đủ
        if (depositRequest && depositRequest.status === 'PENDING' && pendingPackage && w.balance >= getPkgPrice(pendingPackage)) {
          await handleConfirmPurchase(pendingPackage);
          setDepositRequest(null);
        }
      }
      if (!isBuyerRole) {
        await loadPackagesAndCredit();
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
      const [pkgsRes, aiCreditObj, sellerCreditObj] = await Promise.all([
        topupService.getTopupPackages().catch(() => []),
        topupService.getMyCredit().catch(() => null),
        sellerCreditService.getCredits().catch(() => null),
      ]);

      const pkgsList = Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes as any)?.data || [];
      const allPkgs: TopupPackage[] = [...pkgsList];

      setPackages(allPkgs);
      if (allPkgs.length > 0) {
        setSelectedPkg(allPkgs[0]);
      }

      if (aiCreditObj || sellerCreditObj) {
        const mergedCredit: UserCredit = {
          ...userCredit,
          postCredits: sellerCreditObj?.postCredits ?? (aiCreditObj as any)?.postCredits ?? userCredit.postCredits ?? 0,
          valuationCredits: sellerCreditObj?.valuationCredits ?? (aiCreditObj as any)?.valuationCredits ?? userCredit.valuationCredits ?? 0,
          chatCredits: sellerCreditObj?.chatCredits ?? (aiCreditObj as any)?.aiChatBalance ?? (aiCreditObj as any)?.chatCredits ?? userCredit.chatCredits ?? 0,
        };
        setUserCredit(mergedCredit);
      }
    } catch {
      setPackages([]);
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

  // Handle Purchase Package via Wallet balance or generate Deficit Deposit QR if balance is insufficient
  const handleConfirmPurchase = async (pkgToBuy?: TopupPackage | null) => {
    const targetPkg = pkgToBuy || selectedPkg;
    if (!targetPkg) return;
    const pkgPrice = getPkgPrice(targetPkg);
    const currentBal = wallet?.balance ?? 0;

    // KHI THIẾU TIỀN: Tự động gọi API BE tạo yêu cầu nạp tiền đúng số tiền thiếu cần thanh toán thêm (tối thiểu 10.000đ theo quy định BE)
    if (currentBal < pkgPrice) {
      const deficit = pkgPrice - currentBal;
      const neededAmount = Math.max(deficit, 10000);
      setPendingPackage(targetPkg);
      setDepositAmount(neededAmount);
      setCustomAmount(neededAmount.toLocaleString('vi-VN'));
      setCreatingDeposit(true);
      setPurchaseError(null);
      setDepositError(null);
      try {
        const res = await walletService.createDepositRequest(neededAmount);
        setDepositRequest(res);
        setActiveTab('wallet');
      } catch (err: any) {
        setPurchaseError(err?.message || 'Không thể tạo mã QR nạp tiền từ hệ thống. Vui lòng thử lại sau.');
      } finally {
        setCreatingDeposit(false);
      }
      return;
    }

    setPurchaseError(null);
    setPurchasing(true);
    try {
      if (!targetPkg.id) {
        throw new Error('ID gói không hợp lệ.');
      }
      
      // Gọi API mua gói
      await topupService.purchasePackage(targetPkg.id);

      // Nạp thành công, lấy lại số dư thực tế từ BE
      const updatedCredit = await topupService.getMyCredit();
      setUserCredit(updatedCredit);
      
      if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
      if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
        onCreditUpdated(updatedCredit.postCredits);
      }
      // Re-fetch wallet balance after deduction
      await loadWallet();
      setPackageSuccess(true);
      setPendingPackage(null);
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
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-[#faf8f5] border border-[#24263e]/15 text-[#24263e] shadow-2xl flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 sm:py-3.5 border-b border-white/10 bg-[#24263e] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-1.5 rounded-xl shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-7 sm:h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                {isBuyerRole
                  ? <>Ví Escrow &amp; Nạp Tiền Second<span className="text-[#c34c36]">Life</span></>
                  : <>Ví Tiền &amp; Quyền Sử Dụng Second<span className="text-[#c34c36]">Life</span></>}
              </h3>
              <p className="text-[11px] text-[#fce5da] font-medium leading-tight">
                {isBuyerRole
                  ? 'Nạp tiền tự động qua VietQR (SePay) • Bảo đảm giao dịch an toàn qua Quỹ Escrow'
                  : 'Nạp tiền tự động qua VietQR (SePay) • Mua gói lượt đăng tin AI'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer border border-white/15 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Status Banner (Chỉ hiện khi chưa ở màn hình quét QR thanh toán) */}
        {!depositRequest && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-[#24263e]/5 via-[#fce5da]/30 to-[#24263e]/5 border-b border-[#24263e]/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#24263e] text-white flex items-center justify-center shadow-xs">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-[#24263e]/70 font-semibold block leading-tight">Số Dư Ví Khả Dụng:</span>
                <span className="text-sm sm:text-base font-black text-[#24263e] font-mono leading-tight">
                  {formatVND(currentWalletBalance)}
                </span>
              </div>
            </div>

            {!isBuyerRole ? (
              <div className="flex items-center gap-2 text-xs font-bold font-mono">
                <span className="text-[#24263e] bg-white border border-[#24263e]/15 px-2.5 py-0.5 rounded-xl shadow-xs">
                  Tin: <span className="font-black text-[#c34c36]">{userCredit?.postCredits ?? 0}</span>
                </span>
                <span className="text-[#24263e] bg-white border border-[#24263e]/15 px-2.5 py-0.5 rounded-xl shadow-xs">
                  AI Chat: <span className="font-black text-[#c34c36]">{userCredit?.chatCredits ?? 0}</span>
                </span>
                <span className="text-[#24263e] bg-white border border-[#24263e]/15 px-2.5 py-0.5 rounded-xl shadow-xs">
                  Định giá: <span className="font-black text-[#c34c36]">{userCredit?.valuationCredits ?? 0}</span>
                </span>
                <button
                  onClick={loadWallet}
                  title="Làm mới số dư"
                  className="p-1 rounded-lg bg-white border border-[#24263e]/15 text-slate-600 hover:text-[#24263e] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-xl font-bold flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Bảo Lãnh Ký Quỹ Escrow
                </span>
                <button
                  onClick={loadWallet}
                  title="Làm mới số dư"
                  className="p-1 rounded-lg bg-white border border-[#24263e]/15 text-slate-600 hover:text-[#24263e] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher - Only show package tab if NOT buyer */}
        <div className="flex border-b border-[#24263e]/10 bg-white/70 px-5 pt-1.5 pb-1 shrink-0">
          <button
            onClick={() => {
              setActiveTab('wallet');
              setPurchaseError(null);
            }}
            className={`pb-2 px-3.5 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'wallet'
                ? 'border-[#c34c36] text-[#c34c36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{isBuyerRole ? 'Nạp Tiền Vào Ví Escrow (VietQR)' : '1. Nạp Tiền Vào Ví (VietQR)'}</span>
            {depositRequest && depositRequest.status === 'PENDING' && (
              <span className="w-2 h-2 rounded-full bg-[#c34c36] animate-ping ml-1" title="Có giao dịch nạp đang chờ" />
            )}
          </button>
          {!isBuyerRole && (
            <button
              onClick={() => {
                setActiveTab('packages');
                setDepositError(null);
              }}
              className={`pb-2 px-3.5 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'packages'
                  ? 'border-[#c34c36] text-[#c34c36]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>2. Mua Gói Quyền Sử Dụng (Trừ ví)</span>
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('history');
              setDepositError(null);
            }}
            className={`pb-2 px-3.5 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'history'
                ? 'border-[#c34c36] text-[#c34c36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch Sử Giao Dịch</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 sm:space-y-3.5 flex-1">
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
                            setCustomAmount(amt.toLocaleString('vi-VN'));
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
                          type="text"
                          value={customAmount}
                          onChange={(e) => {
                            const rawVal = e.target.value.replace(/\D/g, '');
                            if (!rawVal) {
                              setCustomAmount('');
                              setDepositAmount(0);
                            } else {
                              const numVal = parseInt(rawVal, 10);
                              setCustomAmount(numVal.toLocaleString('vi-VN'));
                              setDepositAmount(numVal);
                            }
                          }}
                          placeholder="Ví dụ: 150.000"
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
                  {/* Context banner when seller is topping up the deficit for a package */}
                  {pendingPackage && (
                    <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-[#c34c36]/30 rounded-2xl p-2.5 sm:px-4 sm:py-2 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black uppercase tracking-wider bg-[#c34c36] text-white px-1.5 py-0.2 rounded">
                              Thanh toán nạp thiếu
                            </span>
                            <span className="text-xs font-black text-[#24263e] truncate">{getPkgName(pendingPackage)}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium mt-0.5">
                            <span>Giá: <strong className="text-slate-800 font-mono">{formatVND(getPkgPrice(pendingPackage))}</strong></span>
                            <span>&bull;</span>
                            <span>Ví hiện tại: <strong className="text-slate-800 font-mono">{formatVND(currentWalletBalance)}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 block font-semibold leading-tight">Cần thanh toán thêm:</span>
                        <span className="text-sm sm:text-base font-black text-[#c34c36] font-mono leading-tight">
                          {formatVND(depositRequest.amount)}
                        </span>
                        {depositRequest.amount > (getPkgPrice(pendingPackage) - currentWalletBalance) && (
                          <span className="text-[9px] text-amber-700 block font-semibold leading-none mt-0.5">
                            (Tối thiểu 10.000đ)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Auto activation notice */}
                  {autoActivating && (
                    <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-center gap-3 text-emerald-800 font-bold text-xs animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                      <span>Đã nhận được tiền từ ngân hàng! Hệ thống đang tự động kích hoạt gói {pendingPackage ? getPkgName(pendingPackage) : ''} cho bạn...</span>
                    </div>
                  )}

                  {depositRequest.status === 'SUCCESS' ? (
                    <div className="py-5 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-emerald-800">
                        Nạp Tiền Thành Công!
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Hệ thống đã nhận được khoản thanh toán <strong>{formatVND(depositRequest.amount)}</strong>. Số dư ví của bạn hiện tại: <strong>{formatVND(wallet?.balance ?? 0)}</strong>.
                      </p>
                      {pendingPackage ? (
                        <div className="pt-1.5 flex items-center justify-center gap-2.5">
                          <button
                            onClick={() => {
                              setDepositRequest(null);
                              setPendingPackage(null);
                            }}
                            className="px-4 py-2 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                          >
                            Để Tiền Trong Ví
                          </button>
                          <button
                            disabled={purchasing}
                            onClick={() => handleConfirmPurchase(pendingPackage)}
                            className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                            <span>Hoàn Tất Kích Hoạt Gói {getPkgName(pendingPackage)}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1.5 flex items-center justify-center gap-2.5">
                          <button
                            onClick={() => setDepositRequest(null)}
                            className="px-4 py-2 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                          >
                            Nạp Thêm Lần Nữa
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#24263e]/10 shadow-xs flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-center">
                        {/* VietQR Image - Clickable to zoom */}
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            onClick={() => setIsZoomQrOpen(true)}
                            className="p-1.5 bg-white rounded-2xl border-2 border-[#c34c36]/40 shadow-xs cursor-pointer hover:border-[#c34c36] hover:shadow-md transition-all group"
                          >
                            <img
                              src={vietQrUrl}
                              alt="VietQR Chuyển Khoản"
                              className="w-36 h-36 sm:w-38 sm:h-38 object-contain rounded-xl group-hover:scale-[1.02] transition-transform"
                            />
                          </div>
                          <div className="mt-2.5 px-3 py-1 rounded-xl bg-amber-50/90 border border-amber-300/80 flex items-center justify-center gap-2 shadow-2xs">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                            <span className="font-mono text-base font-black text-[#c34c36] tracking-wider">
                              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                          </div>
                        </div>

                        {/* Transfer Credentials (2-Column Grid + Full Width Transfer Code) */}
                        <div className="flex-1 w-full space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Ngân hàng */}
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-semibold leading-tight">Ngân hàng</span>
                              <span className="font-black text-slate-900 text-xs sm:text-sm">{depositRequest.bankName}</span>
                            </div>

                            {/* Số tài khoản */}
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div className="min-w-0 pr-1">
                                <span className="text-[10px] text-slate-400 block font-semibold leading-tight">Số tài khoản</span>
                                <span className="font-black text-slate-900 font-mono text-xs sm:text-sm truncate block">{depositRequest.bankAccountNumber}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(depositRequest.bankAccountNumber, 'acc')}
                                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer shrink-0 shadow-xs"
                                title="Sao chép số tài khoản"
                              >
                                {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Chủ tài khoản */}
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-semibold leading-tight">Chủ tài khoản</span>
                              <span className="font-bold text-slate-900 uppercase text-[11px] sm:text-xs truncate block">{depositRequest.bankAccountName}</span>
                            </div>

                            {/* Số tiền cần thanh toán */}
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-semibold leading-tight">Số tiền cần thanh toán</span>
                              <span className="font-black text-emerald-700 font-mono text-xs sm:text-sm">{depositRequest.amount.toLocaleString('vi-VN')} VNĐ</span>
                            </div>
                          </div>

                          {/* Nội dung chuyển khoản - Full width highlighted box */}
                          <div className="bg-amber-50 p-2 sm:p-2.5 rounded-xl border-2 border-amber-300 flex items-center justify-between shadow-xs">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] text-amber-800 block font-bold leading-tight">
                                Nội dung chuyển khoản (Bắt buộc đúng để tự động duyệt)
                              </span>
                              <span className="font-black text-[#c34c36] font-mono text-sm sm:text-base tracking-wider truncate block">
                                {depositRequest.code}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(depositRequest.code, 'code')}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 hover:text-amber-950 font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
                              title="Sao chép mã"
                            >
                              {copiedField === 'code' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDepositRequest(null);
                            const hadPending = Boolean(pendingPackage);
                            setPendingPackage(null);
                            if (hadPending) {
                              setActiveTab('packages');
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
                        >
                          {pendingPackage ? '← Hủy & Chọn Gói Khác' : '← Tạo giao dịch khác'}
                        </button>
                        <button
                          type="button"
                          disabled={walletLoading || autoActivating}
                          onClick={loadWallet}
                          className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
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
                        +{selectedPkg?.postCredits || 0} tin &amp; +{selectedPkg?.chatCredits || 0} Chat AI &amp; +{selectedPkg?.valuationCredits || 0} Định giá
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
                              const valuationCredits = Number(pkg.valuationCredits || 0);
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
                                  {(pkg.discountPercentage ?? 0) > 0 && !pkg.isPopular && (
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
                                      {(pkg.discountPercentage ?? 0) > 0 && (
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
                                        <span>+{chatCredits} Lượt Chat AI</span>
                                      </div>
                                      {valuationCredits > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                          <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                          <span>+{valuationCredits} Lượt định giá AI</span>
                                        </div>
                                      )}
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
                                      <span className="text-amber-600 font-bold flex items-center gap-1">
                                        <QrCode className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Thiếu {formatVND(pkgPrice - currentWalletBalance)} (Quét QR nạp thêm)</span>
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
                                <span>Chỉ Lượt Chat AI</span>
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
                              const valuationCredits = Number(pkg.valuationCredits || 0);
                              const isListingType = postCredits > 0;
                              const isValuationType = valuationCredits > 0;
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
                                  {(pkg.discountPercentage ?? 0) > 0 && (
                                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 text-[9px] font-black rounded-md bg-emerald-600 text-white">
                                      -{pkg.discountPercentage}%
                                    </span>
                                  )}

                                  <div>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${isListingType
                                          ? 'bg-orange-100 text-orange-900'
                                          : isValuationType ? 'bg-blue-100 text-blue-900' : 'bg-indigo-100 text-indigo-900'
                                        }`}
                                    >
                                      {isListingType ? <Tag className="w-3 h-3" /> : isValuationType ? <Search className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                      <span>{isListingType ? 'Đăng Bài' : isValuationType ? 'Định Giá AI' : 'Chat AI'}</span>
                                    </span>

                                    <h4 className="font-black text-xs text-[#24263e] mt-2 line-clamp-1">{pkgName}</h4>
                                    <div className="text-sm font-black text-[#24263e] font-mono mt-1">
                                      {formatVND(pkgPrice)}
                                    </div>

                                    <div className="mt-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      {isListingType ? (
                                        <span>+{postCredits} Lượt đăng tin</span>
                                      ) : isValuationType ? (
                                        <span>+{valuationCredits} Lượt định giá AI</span>
                                      ) : (
                                        <span>+{chatCredits} Lượt Chat AI</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                    {isAffordable ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                        <Check className="w-3 h-3" /> Đủ số dư
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-bold flex items-center gap-1">
                                        <QrCode className="w-3 h-3 text-amber-700" />
                                        <span>Thiếu {formatVND(pkgPrice - currentWalletBalance)}</span>
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
                      <div className="pt-3.5 pb-2 border-t border-[#24263e]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/80 p-3 sm:px-4 rounded-2xl shadow-2xs">
                        <div className="flex-1 min-w-0">
                          {selectedPkg ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-500">Đang chọn:</span>
                                <span className="text-xs sm:text-sm font-black text-[#24263e]">{getPkgName(selectedPkg)}</span>
                                <span className="text-xs font-mono font-black text-[#c34c36]">
                                  ({formatVND(getPkgPrice(selectedPkg))})
                                </span>
                              </div>
                              <div className="text-[11px] font-medium">
                                {currentWalletBalance >= getPkgPrice(selectedPkg) ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    Số dư ví: {formatVND(currentWalletBalance)} (Đủ điều kiện trừ ví)
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-semibold flex items-center gap-1 flex-wrap">
                                    <QrCode className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <span>Số dư ví: <strong className="font-mono">{formatVND(currentWalletBalance)}</strong></span>
                                    <span>•</span>
                                    <span>Cần nạp thiếu: <strong className="text-[#c34c36] font-mono font-black">{formatVND(getPkgPrice(selectedPkg) - currentWalletBalance)}</strong></span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Vui lòng chọn một gói nạp ở trên để tiếp tục</span>
                          )}
                        </div>

                        <div className="w-full sm:w-auto shrink-0">
                          <button
                            disabled={!selectedPkg || purchasing || creatingDeposit || packagesLoading}
                            onClick={() => handleConfirmPurchase(selectedPkg)}
                            className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                          >
                            {creatingDeposit ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang tạo mã VietQR...</span>
                              </>
                            ) : purchasing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang xử lý trừ ví...</span>
                              </>
                            ) : selectedPkg && currentWalletBalance < getPkgPrice(selectedPkg) ? (
                              <>
                                <QrCode className="w-4 h-4 shrink-0" />
                                <span>
                                  Quét QR Nạp Thiếu & Mua Gói ({formatVND(Math.max(getPkgPrice(selectedPkg) - currentWalletBalance, 10000))})
                                </span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-4 h-4 shrink-0" />
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

          {/* ============================================================== */}
          {/* TAB 3: TRANSACTION HISTORY                                     */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fadeIn h-full flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-[#c34c36]" />
                <h4 className="font-black text-sm text-[#24263e]">Lịch sử nạp và giao dịch</h4>
              </div>

              <div className="bg-white rounded-2xl border border-[#24263e]/10 shadow-xs flex-1 overflow-hidden flex flex-col">
                {transactionsLoading ? (
                  <div className="flex items-center justify-center p-10 flex-col gap-3">
                    <Loader2 className="w-6 h-6 text-[#c34c36] animate-spin" />
                    <span className="text-xs font-semibold text-slate-500">Đang tải lịch sử giao dịch...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex items-center justify-center p-10 flex-col gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-slate-300" />
                    </div>
                    <span className="text-sm font-semibold text-slate-500">Chưa có giao dịch nào</span>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[50vh] divide-y divide-[#24263e]/5">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-slate-50 transition flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex flex-shrink-0 items-center justify-center shadow-xs ${tx.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-600' : tx.type === 'WITHDRAW' || tx.type === 'PAYMENT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {tx.type === 'DEPOSIT' ? <Wallet className="w-5 h-5" /> : tx.type === 'PAYMENT' ? <ShoppingBag className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-xs sm:text-sm font-bold text-[#24263e] truncate">
                              {tx.description || (tx.type === 'DEPOSIT' ? 'Nạp tiền vào ví' : tx.type === 'PAYMENT' ? 'Thanh toán' : 'Giao dịch khác')}
                            </h5>
                            <span className={`text-xs sm:text-sm font-black whitespace-nowrap ${tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? '+' : '-'}{formatVND(tx.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                              {new Date(tx.createdAt).toLocaleString('vi-VN')}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {tx.status === 'SUCCESS' ? 'Thành công' : tx.status === 'PENDING' ? 'Chờ xử lý' : 'Thất bại'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom QR Modal Overlay */}
      {isZoomQrOpen && vietQrUrl && (
        <div
          onClick={() => setIsZoomQrOpen(false)}
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white p-5 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl cursor-default animate-fadeIn"
          >
            <button onClick={() => setIsZoomQrOpen(false)} className="absolute top-3 right-3 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-black text-slate-800 mb-4 mt-2">Mã VietQR</h3>
            <img src={vietQrUrl} alt="VietQR Zoom" className="w-full h-auto object-contain rounded-xl border border-slate-200 shadow-xs" />
            <p className="text-[11px] text-slate-500 font-medium mt-4 text-center">
              Dùng app ngân hàng bất kỳ để quét mã này
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

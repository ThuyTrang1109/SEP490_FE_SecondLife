import { navigatePath } from '../../app/router/browser';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  QrCode,
  Loader2,
  Sparkles,
  CreditCard,
  Wallet,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Tag,
  ShoppingBag,
  ShieldCheck,
  Clock,
  Search,
  Coins,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Minus,
} from 'lucide-react';
import {
  TopupPackage,
  UserCredit,
  UserWallet,
  DepositResponseDTO,
  UserProfile,
  UserRole,
  Language,
  TopupPackagePurchaseResponse,
  WalletTransaction,
} from '../../types';
import {
  topupService,
  walletService,
  sellerCreditService,
  adminCreditPricingService,
} from '../../services';
import { notificationWsClient } from '../../services/notificationWsClient';
import logoImg from '../../assets/logo.png';
import { formatVND } from '../../utils/translations';
import { WalletHistoryPanel } from './WalletHistoryPanel';

export interface TopUpModalProps {
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

export interface PendingPurchaseIntent {
  userId: string;
  packageId: string;
  packageVersion: number;
  expectedPrice: number;
  requestId: string;
  timestamp: number;
}

const getStorageKey = (userId?: string) => `secondlife_topup_intent_${userId || 'guest'}`;

const getPendingIntent = (userId?: string): PendingPurchaseIntent | null => {
  try {
    const raw = sessionStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (_) { }
  return null;
};

const setPendingIntent = (userId: string | undefined, intent: PendingPurchaseIntent) => {
  try {
    sessionStorage.setItem(getStorageKey(userId), JSON.stringify(intent));
  } catch (_) { }
};

const clearPendingIntent = (userId?: string) => {
  try {
    sessionStorage.removeItem(getStorageKey(userId));
  } catch (_) { }
};

const PRESET_DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const getPkgName = (pkg?: TopupPackage | null) => pkg?.name || pkg?.packageName || 'Gói dịch vụ';
const getPkgPrice = (pkg?: TopupPackage | null) => Number(pkg?.price ?? pkg?.priceVnd ?? 0);
const getPkgCredits = (pkg?: TopupPackage | null) => Number(pkg?.postCredits ?? pkg?.creditPoints ?? 0);
const getPkgBonus = (pkg?: TopupPackage | null) => Number(pkg?.chatCredits ?? pkg?.bonusPoints ?? 0);
const getPkgTotalCredits = (pkg?: TopupPackage | null) => getPkgCredits(pkg) + getPkgBonus(pkg);

export const getPackageType = (pkg: TopupPackage): 'combo' | 'listing' | 'valuation' | 'chat' => {
  const posts = Number(pkg.postCredits || 0);
  const chats = Number(pkg.chatCredits || 0);
  const valuations = Number(pkg.valuationCredits || 0);
  const name = (pkg.name || '').toLowerCase();

  const typesCount = (posts > 0 ? 1 : 0) + (chats > 0 ? 1 : 0) + (valuations > 0 ? 1 : 0);
  if (typesCount > 1 || name.includes('combo') || name.includes('trọn gói')) {
    return 'combo';
  }

  if (valuations > 0 || name.includes('valuation') || name.includes('định giá')) {
    return 'valuation';
  }
  if (chats > 0 || name.includes('chat')) {
    return 'chat';
  }
  if (posts > 0 || name.includes('post') || name.includes('tin') || name.includes('bài')) {
    return 'listing';
  }

  return 'valuation';
};

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
  const isBuyerRole = currentRole === 'buyer' || currentUser?.role === 'buyer';

  // Active primary tab: 'wallet' | 'packages' | 'history'
  const [activeTab, setActiveTab] = useState<'wallet' | 'packages' | 'history'>(isBuyerRole ? 'wallet' : initialTab);

  // Wallet State
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>('100.000');
  const [depositRequest, setDepositRequest] = useState<DepositResponseDTO | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState<boolean>(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutes
  const [isZoomQrOpen, setIsZoomQrOpen] = useState<boolean>(false);

  // Packages State
  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<TopupPackage | null>(null);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<boolean>(false);
  const [, setPurchasedPackage] = useState<TopupPackage | null>(null);

  // Pending package / retail order to auto-purchase after deficit topup via VietQR
  const [pendingPackage, setPendingPackage] = useState<TopupPackage | null>(null);
  const [pendingRetailOrder, setPendingRetailOrder] = useState<{
    listingQuantity: number;
    aiChatQuantity: number;
    valuationQuantity: number;
    totalFee: number;
  } | null>(null);
  const [autoActivating, setAutoActivating] = useState<boolean>(false);

  // Sub-category inside packages: 'combo' (Gói Dịch Vụ) vs 'retail' (Mua Lẻ)
  const [packageCategory, setPackageCategory] = useState<'combo' | 'retail'>('combo');
  const [packageFilter, setPackageFilter] = useState<'all' | 'combo' | 'listing' | 'valuation' | 'chat'>('all');

  // Retail (Mua Lẻ Credit) State
  const [retailListingQty, setRetailListingQty] = useState<number>(5);
  const [retailChatQty, setRetailChatQty] = useState<number>(0);
  const [retailValuationQty, setRetailValuationQty] = useState<number>(0);
  const [unitPrices, setUnitPrices] = useState<{
    listing: number;
    chat: number;
    valuation: number;
  }>({
    listing: 20001,
    chat: 5000,
    valuation: 55555,
  });
  const [retailDiscountAmount, setRetailDiscountAmount] = useState<number>(0);
  const [retailQuoteFinalFee, setRetailQuoteFinalFee] = useState<number | null>(null);

  const [userCredit, setUserCredit] = useState<UserCredit>(
    initialUserCredit || { postCredits: currentCredit || 10, valuationCredits: 0, chatCredits: 20 }
  );

  // History State
  const [latestReceipt, setLatestReceipt] = useState<TopupPackagePurchaseResponse | null>(null);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);
  const [purchases, setPurchases] = useState<TopupPackagePurchaseResponse[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState<boolean>(false);
  const [purchasesPage, setPurchasesPage] = useState<number>(0);
  const [purchasesTotalPages, setPurchasesTotalPages] = useState<number>(1);
  const [purchasesTotalElements, setPurchasesTotalElements] = useState<number>(0);
  const [transactions, setTransactions] = useState<Array<WalletTransaction & { referenceId?: string }>>([]);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const preDepositBalanceRef = useRef<number>(0);
  const isFetchingPackagesRef = useRef<boolean>(false);

  // Load wallet & packages when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isBuyerRole ? 'wallet' : initialTab);
      setHistoryRefreshKey((prev) => prev + 1);
      setDepositRequest(null);
      setPendingPackage(null);
      setPendingRetailOrder(null);
      setAutoActivating(false);
      setDepositError(null);
      setPurchaseError(null);
      setPackageSuccess(false);
      setPurchasedPackage(null);
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

  const loadPurchases = async (page = 0) => {
    setPurchasesLoading(true);
    try {
      const res = await topupService.getPurchases(page, 20);
      const items = res?.items || (Array.isArray(res) ? res : []);
      setPurchases(items);
      setPurchasesPage(res?.page ?? page);
      setPurchasesTotalPages(res?.totalPages ?? 1);
      setPurchasesTotalElements(res?.totalElements ?? items.length);
    } catch (err: any) {
      console.error('Failed to load purchases history:', err);
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const loadHistory = async () => {
    setTransactionsLoading(true);
    try {
      const data = await walletService.getTransactionHistory();
      const sorted = (Array.isArray(data) ? data : []).sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setTransactions(sorted);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      if (!isBuyerRole) {
        loadPurchases(0);
      }
      setHistoryRefreshKey((prev) => prev + 1);
    }
  }, [activeTab]);

  const handleRefreshTopBar = async () => {
    await loadWallet();
    if (!isBuyerRole) {
      await loadPackagesAndCredit();
      await loadPurchases(0);
    }
    if (activeTab === 'history') {
      setHistoryRefreshKey((prev) => prev + 1);
    }
  };

  // Timer countdown for deposit request
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    if (depositRequest && depositRequest.status === 'PENDING') {
      const getInitialSeconds = () => {
        if (depositRequest.expiresAt) {
          const diff = Math.floor((new Date(depositRequest.expiresAt).getTime() - Date.now()) / 1000);
          return Math.max(0, diff);
        }
        if (depositRequest.createdAt) {
          const diff = Math.floor((new Date(depositRequest.createdAt).getTime() + 15 * 60 * 1000 - Date.now()) / 1000);
          return Math.max(0, diff);
        }
        return 900;
      };

      const initialSec = getInitialSeconds();
      setTimeLeft(initialSec);

      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval!);
            setDepositRequest(null);
            const durationMin = depositRequest.expiresAt && depositRequest.createdAt
              ? Math.max(1, Math.round((new Date(depositRequest.expiresAt).getTime() - new Date(depositRequest.createdAt).getTime()) / 60000))
              : 15;
            setDepositError(`Hết thời gian giao dịch (${durationMin} phút). Vui lòng tạo yêu cầu nạp tiền mới nếu vẫn muốn giao dịch.`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(900);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [depositRequest]);

  // Xử lý khi số dư ví tăng thành công (được gọi từ WebSocket Push hoặc Fallback Polling)
  const processSuccessfulBalanceIncrease = React.useCallback(async (freshWallet: UserWallet) => {
    setWallet(freshWallet);
    preDepositBalanceRef.current = freshWallet.balance;
    if (onWalletUpdated) onWalletUpdated(freshWallet.balance);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Nếu người bán đang mua lẻ credit bị thiếu tiền, tự động hoàn tất mua lẻ ngay khi tiền nạp vào ví
    if (pendingRetailOrder) {
      const retailOrder = pendingRetailOrder;
      if (freshWallet.balance >= retailOrder.totalFee) {
        setAutoActivating(true);
        try {
          const res = await sellerCreditService.createPurchase({
            listingQuantity: retailOrder.listingQuantity,
            valuationQuantity: retailOrder.valuationQuantity,
            aiChatQuantity: retailOrder.aiChatQuantity,
          });

          const receiptObj: TopupPackagePurchaseResponse = {
            id: res?.id || `retail-${Date.now()}`,
            packageId: 'retail',
            packageVersion: 1,
            packageName: 'Mua Lẻ Tự Chọn Lượt Dịch Vụ',
            price: retailOrder.totalFee,
            currency: 'VND',
            postCredits: retailOrder.listingQuantity,
            chatCredits: retailOrder.aiChatQuantity,
            valuationCredits: retailOrder.valuationQuantity,
            walletBalanceBefore: freshWallet.balance,
            walletBalanceAfter: Math.max(0, freshWallet.balance - retailOrder.totalFee),
            postBalanceAfter: (userCredit.postCredits || 0) + retailOrder.listingQuantity,
            chatBalanceAfter: (userCredit.chatCredits || 0) + retailOrder.aiChatQuantity,
            valuationBalanceAfter: (userCredit.valuationCredits || 0) + retailOrder.valuationQuantity,
            createdAt: new Date().toISOString(),
            requestId: res?.id || `req-${Date.now()}`,
          };

          setLatestReceipt(receiptObj);
          setPackageSuccess(true);
          setPendingRetailOrder(null);
          setDepositRequest(null);
          setActiveTab('packages');

          const [updatedCredit, finalWallet] = await Promise.all([
            topupService.getMyCredit().catch(() => null),
            walletService.getMyWallet().catch(() => null),
          ]);

          if (updatedCredit) {
            setUserCredit(updatedCredit);
            if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
            if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
              onCreditUpdated(updatedCredit.postCredits);
            }
          }
          if (finalWallet) {
            setWallet(finalWallet);
            preDepositBalanceRef.current = finalWallet.balance;
            if (onWalletUpdated) onWalletUpdated(finalWallet.balance);
          }
          return;
        } catch (autoErr: any) {
          console.error('Lỗi tự động mua lẻ sau khi nạp tiền ví:', autoErr);
          setPurchaseError(autoErr?.message || 'Đã nạp tiền ví nhưng mua lẻ tự động thất bại. Vui lòng bấm Xác nhận mua lẻ để thử lại.');
          setActiveTab('packages');
        } finally {
          setAutoActivating(false);
        }
      }
    } else if (pendingPackage) {
      const targetPkg = pendingPackage;
      const pkgPrice = getPkgPrice(targetPkg);
      if (freshWallet.balance >= pkgPrice) {
        setAutoActivating(true);
        let intent = getPendingIntent(currentUser?.id);
        if (
          !intent ||
          intent.packageId !== targetPkg.id ||
          intent.packageVersion !== (targetPkg.packageVersion ?? 0) ||
          intent.expectedPrice !== pkgPrice
        ) {
          intent = {
            userId: currentUser?.id || '',
            packageId: targetPkg.id,
            packageVersion: targetPkg.packageVersion ?? 0,
            expectedPrice: pkgPrice,
            requestId: crypto.randomUUID(),
            timestamp: Date.now(),
          };
          setPendingIntent(currentUser?.id, intent);
        }

        try {
          const res = await topupService.purchasePackage(targetPkg.id, {
            requestId: intent.requestId,
            packageVersion: intent.packageVersion,
            expectedPrice: intent.expectedPrice,
          });

          const purchaseData: TopupPackagePurchaseResponse = (res as any)?.data || res;
          if (purchaseData && purchaseData.id) {
            clearPendingIntent(currentUser?.id);
            setLatestReceipt(purchaseData);
            setPurchasedPackage(targetPkg);
            setSelectedPkg(targetPkg);
            setPackageSuccess(true);
            setPendingPackage(null);
            setDepositRequest(null);
            setActiveTab('packages');

            const [updatedCredit, finalWallet] = await Promise.all([
              topupService.getMyCredit().catch(() => null),
              walletService.getMyWallet().catch(() => null),
            ]);

            if (updatedCredit) {
              setUserCredit(updatedCredit);
              if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
              if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
                onCreditUpdated(updatedCredit.postCredits);
              }
            }
            if (finalWallet) {
              setWallet(finalWallet);
              preDepositBalanceRef.current = finalWallet.balance;
              if (onWalletUpdated) onWalletUpdated(finalWallet.balance);
            }
            return;
          } else {
            throw new Error((res as any)?.message || 'Không hoàn tất được giao dịch mua gói sau khi nạp tiền.');
          }
        } catch (autoErr: any) {
          console.error('Lỗi tự động mua gói sau khi nạp tiền ví:', autoErr);
          setPurchaseError(autoErr?.message || 'Đã nạp tiền vào ví nhưng mua gói tự động thất bại. Vui lòng nhấn Xác nhận mua gói để thử lại.');
          setActiveTab('packages');
        } finally {
          setAutoActivating(false);
        }
      }
    }

    setDepositRequest((prev) => (prev ? { ...prev, status: 'SUCCESS' } : null));
  }, [currentUser?.id, onCreditUpdated, onUserCreditUpdated, onWalletUpdated, pendingPackage, pendingRetailOrder, userCredit]);

  // Phương án 1: Lắng nghe WebSocket Push Event khi tiền nạp vào ví (Thay cho Polling liên tục)
  useEffect(() => {
    if (!depositRequest || depositRequest.status !== 'PENDING') return;

    const baselineBalance = preDepositBalanceRef.current;

    // 1. Lắng nghe trực tiếp từ WebSocket Push (/user/queue/wallet, /user/queue/wallet-updates)
    const unsubWs = notificationWsClient.subscribeWalletListener(async (event) => {
      try {
        const freshWallet = await walletService.getMyWallet();
        if (
          freshWallet &&
          (freshWallet.balance > baselineBalance ||
            (baselineBalance === 0 && freshWallet.balance >= depositRequest.amount))
        ) {
          await processSuccessfulBalanceIncrease(freshWallet);
        }
      } catch { }
    });

    // 2. Lắng nghe sự kiện đồng bộ toàn hệ thống 'secondlife_wallet_updated'
    const handleWalletUpdated = async (e: any) => {
      const pushedBal = e?.detail?.balance;
      if (typeof pushedBal === 'number' && (pushedBal > baselineBalance || (baselineBalance === 0 && pushedBal >= depositRequest.amount))) {
        try {
          const freshWallet = await walletService.getMyWallet();
          if (freshWallet) await processSuccessfulBalanceIncrease(freshWallet);
        } catch { }
      }
    };
    window.addEventListener('secondlife_wallet_updated', handleWalletUpdated);

    // 3. Fallback nhẹ nhàng: Chỉ poll khi tab đang hiển thị (không poll khi ẩn), giãn cách 12s và tối đa 10 lần
    let pollCount = 0;
    pollingRef.current = setInterval(async () => {
      // Bỏ qua nếu tab đang bị ẩn / background
      if (typeof document !== 'undefined' && document.hidden) return;
      pollCount++;
      if (pollCount > 10) {
        // Sau 2 phút không có giao dịch, tự động dừng polling để tránh spam BE
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }

      try {
        const freshWallet = await walletService.getMyWallet();
        const hasBalanceIncreased =
          freshWallet &&
          (freshWallet.balance > baselineBalance ||
            (baselineBalance === 0 && freshWallet.balance >= depositRequest.amount));
        if (hasBalanceIncreased) {
          await processSuccessfulBalanceIncrease(freshWallet);
        }
      } catch {
        // ignore transient errors
      }
    }, 12000);

    return () => {
      unsubWs();
      window.removeEventListener('secondlife_wallet_updated', handleWalletUpdated);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [depositRequest, processSuccessfulBalanceIncrease]);

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const w = await walletService.getMyWallet();
      if (w) {
        setWallet(w);
        preDepositBalanceRef.current = w.balance;
        if (onWalletUpdated) onWalletUpdated(w.balance);

        if (depositRequest && depositRequest.status === 'PENDING' && pendingRetailOrder && w.balance >= pendingRetailOrder.totalFee) {
          setPendingRetailOrder(null);
          await handleConfirmRetailPurchase();
          setDepositRequest(null);
        } else if (depositRequest && depositRequest.status === 'PENDING' && pendingPackage && w.balance >= getPkgPrice(pendingPackage)) {
          const pkgToActivate = pendingPackage;
          setPendingPackage(null);
          await handleConfirmPurchase(pkgToActivate);
          setDepositRequest(null);
        }
      }
    } catch (err: any) {
      console.warn('Could not load wallet from BE:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  const loadPackagesAndCredit = async () => {
    if (isBuyerRole) {
      setPackagesLoading(false);
      return;
    }
    if (isFetchingPackagesRef.current) return;
    isFetchingPackagesRef.current = true;
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const [pkgsRes, myCreditObj, pricingRules, sellerPricing] = await Promise.all([
        topupService.getTopupPackages(),
        topupService.getMyCredit().catch(() => null),
        adminCreditPricingService.getCreditPrices().catch(() => null),
        sellerCreditService.getPricing().catch(() => null),
      ]);

      const pkgsList = Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes as any)?.data || [];
      const validPkgs = pkgsList.filter((p: TopupPackage) => p.active !== false && p.pricingAvailable !== false);

      const seen = new Set<string>();
      const uniquePkgs: TopupPackage[] = [];
      for (const p of validPkgs) {
        const key = p.id || `${p.name}_${p.postCredits}_${p.chatCredits}_${p.valuationCredits}_${p.price}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePkgs.push(p);
        }
      }

      setPackages(uniquePkgs);
      if (uniquePkgs.length > 0) {
        setSelectedPkg((prev) => (prev && uniquePkgs.some((p) => p.id === prev.id) ? prev : uniquePkgs[0]));
      } else {
        setSelectedPkg(null);
      }

      if (myCreditObj) {
        setUserCredit(myCreditObj);
      }

      const rules = Array.isArray(pricingRules)
        ? pricingRules
        : Array.isArray(sellerPricing?.prices)
          ? sellerPricing.prices
          : [];

      if (rules.length > 0) {
        const findPrice = (type: 'LISTING' | 'AI_CHAT' | 'VALUATION', defaultVal: number) => {
          const found = rules.find((r: any) => {
            const ct = String(r.creditType || '').toUpperCase();
            if (type === 'LISTING') return ct === 'LISTING' || ct === 'POST' || ct.includes('LIST');
            if (type === 'AI_CHAT') return ct === 'AI_CHAT' || ct === 'CHAT' || ct.includes('CHAT');
            if (type === 'VALUATION') return ct === 'VALUATION' || ct.includes('VALUATION');
            return false;
          });
          return found && typeof found.unitPrice === 'number' && found.unitPrice > 0
            ? found.unitPrice
            : defaultVal;
        };

        setUnitPrices({
          listing: findPrice('LISTING', 20001),
          chat: findPrice('AI_CHAT', 5000),
          valuation: findPrice('VALUATION', 55555),
        });
      }
    } catch (err: any) {
      console.warn('Cannot load packages from BE:', err);
      setPackages([]);
      setPackagesError(err?.message || 'Không thể tải danh sách gói dịch vụ từ hệ thống. Vui lòng thử lại.');
    } finally {
      setPackagesLoading(false);
      isFetchingPackagesRef.current = false;
    }
  };

  const maxDiscount = useMemo(() => {
    const valid = packages
      .map((p) => {
        const d = Number(p.discountPercentage || 0);
        if (d > 0) return d;
        const ref = p.referencePrice ? Number(p.referencePrice) : 0;
        const price = getPkgPrice(p);
        return ref > price ? ((ref - price) / ref) * 100 : 0;
      })
      .filter((d) => d > 0);
    return valid.length > 0 ? Math.max(...valid) : 0;
  }, [packages]);

  // Tất cả gói do Admin cấu hình (kể cả chỉ có 1 loại credit như 10 bài đăng hay combo) đều hiển thị ở đây
  const displayedPackages = useMemo(() => {
    return packages
      .filter((p) => {
        if (packageFilter === 'all') return true;
        const type = getPackageType(p);
        if (packageFilter === 'combo') return type === 'combo';
        if (packageFilter === 'listing') return Number(p.postCredits || 0) > 0;
        if (packageFilter === 'chat') return Number(p.chatCredits || 0) > 0;
        if (packageFilter === 'valuation') return Number(p.valuationCredits || 0) > 0;
        return true;
      })
      .sort((a, b) => getPkgPrice(a) - getPkgPrice(b));
  }, [packages, packageFilter]);

  // Tự động đồng bộ selectedPkg theo category và filter đang xem
  useEffect(() => {
    if (packages.length === 0) return;
    if (packageCategory === 'combo') {
      if (!selectedPkg || !displayedPackages.some((c) => c.id === selectedPkg.id)) {
        if (displayedPackages.length > 0) {
          setSelectedPkg(displayedPackages[0]);
        }
      }
    }
  }, [packageCategory, displayedPackages, packages.length]);

  // Tính toán báo giá mua lẻ credit khi số lượng thay đổi
  useEffect(() => {
    if (packageCategory === 'retail') {
      const timer = setTimeout(async () => {
        try {
          const pricingRes = await sellerCreditService.getPricing(retailListingQty, retailValuationQty);
          if (pricingRes?.quote) {
            const q = pricingRes.quote;
            const discount = Number(q.discountAmount || 0);
            setRetailDiscountAmount(discount);
            if (typeof q.finalFee === 'number' && q.finalFee > 0) {
              const chatFee = retailChatQty * unitPrices.chat;
              setRetailQuoteFinalFee(q.finalFee + chatFee);
            } else {
              setRetailQuoteFinalFee(null);
            }
          } else {
            setRetailDiscountAmount(0);
            setRetailQuoteFinalFee(null);
          }
        } catch {
          setRetailDiscountAmount(0);
          setRetailQuoteFinalFee(null);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [packageCategory, retailListingQty, retailValuationQty, retailChatQty, unitPrices]);

  const retailSubtotal = useMemo(() => {
    return (
      retailListingQty * unitPrices.listing +
      retailChatQty * unitPrices.chat +
      retailValuationQty * unitPrices.valuation
    );
  }, [retailListingQty, retailChatQty, retailValuationQty, unitPrices]);

  const totalRetailFee = useMemo(() => {
    if (retailQuoteFinalFee !== null && retailQuoteFinalFee > 0) {
      return retailQuoteFinalFee;
    }
    return Math.max(0, retailSubtotal - retailDiscountAmount);
  }, [retailQuoteFinalFee, retailSubtotal, retailDiscountAmount]);

  const totalRetailCredits = retailListingQty + retailChatQty + retailValuationQty;

  const handleCreateDeposit = async () => {
    const amountNum = Number(depositAmount);
    if (isNaN(amountNum) || amountNum < 10000) {
      setDepositError('Số tiền nạp tối thiểu là 10.000 VNĐ');
      return;
    }
    setDepositError(null);
    setCreatingDeposit(true);
    try {
      const freshW = await walletService.getMyWallet().catch(() => null);
      if (freshW) {
        setWallet(freshW);
        preDepositBalanceRef.current = freshW.balance;
        if (onWalletUpdated) onWalletUpdated(freshW.balance);
      } else {
        preDepositBalanceRef.current = wallet?.balance ?? 0;
      }
      const res = await walletService.createDepositRequest(amountNum);
      setDepositRequest(res);
    } catch (err: any) {
      setDepositError(err?.message || 'Không thể tạo yêu cầu nạp tiền. Vui lòng thử lại sau.');
    } finally {
      setCreatingDeposit(false);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPurchase = async (pkgToBuy?: TopupPackage | null) => {
    const targetPkg = pkgToBuy || selectedPkg;
    if (!targetPkg) return;
    const pkgPrice = getPkgPrice(targetPkg);
    const currentBal = wallet?.balance ?? 0;

    // Thiết lập ý định mua (Purchase Intent) với requestId bất biến khi retry
    let intent = getPendingIntent(currentUser?.id);
    if (
      !intent ||
      intent.packageId !== targetPkg.id ||
      intent.packageVersion !== (targetPkg.packageVersion ?? 0) ||
      intent.expectedPrice !== pkgPrice
    ) {
      intent = {
        userId: currentUser?.id || '',
        packageId: targetPkg.id,
        packageVersion: targetPkg.packageVersion ?? 0,
        expectedPrice: pkgPrice,
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setPendingIntent(currentUser?.id, intent);
    }

    // THIẾU TIỀN VÍ: Tạo yêu cầu nạp tiền thiếu (tối thiểu 10.000đ theo quy định BE)
    if (currentBal < pkgPrice) {
      const deficit = pkgPrice - currentBal;
      const neededAmount = Math.max(deficit, 10000);
      setPendingPackage(targetPkg);
      setSelectedPkg(targetPkg);
      setDepositAmount(neededAmount);
      setCustomAmount(neededAmount.toLocaleString('vi-VN'));
      setCreatingDeposit(true);
      setPurchaseError(null);
      setDepositError(null);
      try {
        const freshW = await walletService.getMyWallet().catch(() => null);
        if (freshW) {
          setWallet(freshW);
          preDepositBalanceRef.current = freshW.balance;
          if (onWalletUpdated) onWalletUpdated(freshW.balance);
        } else {
          preDepositBalanceRef.current = wallet?.balance ?? 0;
        }
        const res = await walletService.createDepositRequest(neededAmount);
        setDepositRequest(res);
        setActiveTab('wallet');
      } catch (err: any) {
        setPurchaseError(err?.message || 'Không thể tạo mã VietQR nạp tiền từ hệ thống.');
      } finally {
        setCreatingDeposit(false);
      }
      return;
    }

    setPurchaseError(null);
    setPurchasing(true);
    try {
      if (!targetPkg.id) {
        throw new Error('ID gói dịch vụ không hợp lệ.');
      }

      // Gọi API mua gói theo contract V65
      const res = await topupService.purchasePackage(targetPkg.id, {
        requestId: intent.requestId,
        packageVersion: intent.packageVersion,
        expectedPrice: intent.expectedPrice,
      });

      const purchaseData: TopupPackagePurchaseResponse = (res as any)?.data || res;
      if (purchaseData && purchaseData.id) {
        clearPendingIntent(currentUser?.id);
        setLatestReceipt(purchaseData);
        setPurchasedPackage(targetPkg);
        setSelectedPkg(targetPkg);
        setPackageSuccess(true);
        setPendingPackage(null);

        // Lấy lại số dư thực tế từ BE (không tự cộng hoặc suy đoán)
        const [updatedCredit, freshW] = await Promise.all([
          topupService.getMyCredit().catch(() => null),
          walletService.getMyWallet().catch(() => null),
        ]);

        if (updatedCredit) {
          setUserCredit(updatedCredit);
          if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
          if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
            onCreditUpdated(updatedCredit.postCredits);
          }
        }
        if (freshW) {
          setWallet(freshW);
          preDepositBalanceRef.current = freshW.balance;
          if (onWalletUpdated) onWalletUpdated(freshW.balance);
        }
      } else {
        throw new Error((res as any)?.message || 'Máy chủ không trả về biên nhận mua gói.');
      }
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const errMsg = String(err?.message || '');
      if (status === 409 || errMsg.includes('409') || errMsg.toLowerCase().includes('phiên bản') || errMsg.toLowerCase().includes('ngừng bán')) {
        await loadPackagesAndCredit();
        setPurchaseError(`${errMsg || 'Gói dịch vụ đã thay đổi hoặc ngừng bán.'} Danh sách gói đã được cập nhật, vui lòng kiểm tra và xác nhận lại.`);
      } else {
        setPurchaseError(errMsg || 'Giao dịch mua gói thất bại. Bạn có thể nhấn nút thử lại giao dịch.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleConfirmRetailPurchase = async () => {
    if (totalRetailCredits <= 0 || totalRetailFee <= 0) {
      setPurchaseError('Vui lòng chọn ít nhất 1 lượt dịch vụ để thanh toán.');
      return;
    }
    if (retailListingQty > 10000 || retailChatQty > 10000 || retailValuationQty > 10000) {
      setPurchaseError('Số lượng lượt mua mỗi loại không được vượt quá 10.000 lượt.');
      return;
    }
    const currentBal = wallet?.balance ?? initialWalletBalance ?? 0;

    // THIẾU TIỀN VÍ: Tạo yêu cầu nạp tiền thiếu
    if (currentBal < totalRetailFee) {
      const deficit = totalRetailFee - currentBal;
      const neededAmount = Math.max(deficit, 10000);
      setPendingRetailOrder({
        listingQuantity: retailListingQty,
        aiChatQuantity: retailChatQty,
        valuationQuantity: retailValuationQty,
        totalFee: totalRetailFee,
      });
      setDepositAmount(neededAmount);
      setCustomAmount(neededAmount.toLocaleString('vi-VN'));
      setCreatingDeposit(true);
      setPurchaseError(null);
      setDepositError(null);
      try {
        const freshW = await walletService.getMyWallet().catch(() => null);
        if (freshW) {
          setWallet(freshW);
          preDepositBalanceRef.current = freshW.balance;
          if (onWalletUpdated) onWalletUpdated(freshW.balance);
        } else {
          preDepositBalanceRef.current = wallet?.balance ?? 0;
        }
        const res = await walletService.createDepositRequest(neededAmount);
        setDepositRequest(res);
        setActiveTab('wallet');
      } catch (err: any) {
        setPurchaseError(err?.message || 'Không thể tạo mã VietQR nạp tiền từ hệ thống.');
      } finally {
        setCreatingDeposit(false);
      }
      return;
    }

    setPurchaseError(null);
    setPurchasing(true);
    try {
      const res = await sellerCreditService.createPurchase({
        listingQuantity: retailListingQty,
        valuationQuantity: retailValuationQty,
        aiChatQuantity: retailChatQty,
      });

      const receiptObj: TopupPackagePurchaseResponse = {
        id: res?.id || `retail-${Date.now()}`,
        packageId: 'retail',
        packageVersion: 1,
        packageName: 'Mua Lẻ Tự Chọn Lượt Dịch Vụ',
        price: totalRetailFee,
        currency: 'VND',
        postCredits: retailListingQty,
        chatCredits: retailChatQty,
        valuationCredits: retailValuationQty,
        walletBalanceBefore: currentBal,
        walletBalanceAfter: Math.max(0, currentBal - totalRetailFee),
        postBalanceAfter: (userCredit.postCredits || 0) + retailListingQty,
        chatBalanceAfter: (userCredit.chatCredits || 0) + retailChatQty,
        valuationBalanceAfter: (userCredit.valuationCredits || 0) + retailValuationQty,
        createdAt: new Date().toISOString(),
        requestId: res?.id || `req-${Date.now()}`,
      };

      setLatestReceipt(receiptObj);
      setPackageSuccess(true);
      setPendingRetailOrder(null);

      // Lấy lại số dư thực tế từ BE
      const [updatedCredit, freshW] = await Promise.all([
        topupService.getMyCredit().catch(() => null),
        walletService.getMyWallet().catch(() => null),
        sellerCreditService.getCredits().catch(() => null),
      ]);

      if (updatedCredit) {
        setUserCredit(updatedCredit);
        if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
        if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
          onCreditUpdated(updatedCredit.postCredits);
        }
      }
      if (freshW) {
        setWallet(freshW);
        preDepositBalanceRef.current = freshW.balance;
        if (onWalletUpdated) onWalletUpdated(freshW.balance);
      }
    } catch (err: any) {
      console.error('Lỗi mua lẻ credit:', err);
      setPurchaseError(err?.message || 'Giao dịch mua lẻ lượt dịch vụ thất bại. Vui lòng thử lại.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleQtyInput = (
    rawText: string,
    setter: (val: number) => void,
    max: number = 10000
  ) => {
    const digits = rawText.replace(/\D/g, '');
    if (!digits) {
      setter(0);
      return;
    }
    const parsed = parseInt(digits, 10);
    if (isNaN(parsed) || parsed < 0) {
      setter(0);
    } else if (parsed > max) {
      setter(max);
    } else {
      setter(parsed);
    }
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (
      allowedKeys.includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
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
      <div className="relative w-full max-w-3xl lg:max-w-4xl h-[680px] sm:h-[720px] max-h-[94vh] overflow-hidden rounded-3xl bg-[#faf8f5] border border-[#24263e]/15 text-[#24263e] shadow-2xl flex flex-col">
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
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                {isBuyerRole
                  ? 'Ví Escrow & Nạp Tiền SecondLife'
                  : 'Ví Tiền & Quyền Sử Dụng SecondLife'}
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

        {/* Balance Status Banner (Luôn cố định giúp chiều cao modal không bị co giật khi chuyển tab) */}
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
                onClick={handleRefreshTopBar}
                title="Làm mới số dư và lịch sử"
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
                onClick={handleRefreshTopBar}
                title="Làm mới số dư và lịch sử"
                className="p-1 rounded-lg bg-white border border-[#24263e]/15 text-slate-600 hover:text-[#24263e] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Tab Switcher - Căn chỉnh đều 3 mục, có số thứ tự rõ ràng */}
        <div className={`grid ${isBuyerRole ? 'grid-cols-2' : 'grid-cols-3'} border-b border-[#24263e]/10 bg-white/80 shrink-0`}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('wallet');
              setPurchaseError(null);
            }}
            className={`py-3 px-2 sm:px-4 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 text-center ${activeTab === 'wallet'
              ? 'border-[#c34c36] text-[#c34c36] bg-[#c34c36]/5 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="truncate">{isBuyerRole ? '1. Nạp Tiền Escrow (VietQR)' : '1. Nạp Tiền Vào Ví (VietQR)'}</span>
            {depositRequest && depositRequest.status === 'PENDING' && (
              <span className="w-2 h-2 rounded-full bg-[#c34c36] animate-ping ml-0.5 shrink-0" title="Có giao dịch nạp đang chờ" />
            )}
          </button>
          {!isBuyerRole && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('packages');
                setDepositError(null);
              }}
              className={`py-3 px-2 sm:px-4 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 text-center ${activeTab === 'packages'
                ? 'border-[#c34c36] text-[#c34c36] bg-[#c34c36]/5 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
                }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="truncate">2. Mua Gói Dịch Vụ (Trừ Ví)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setDepositError(null);
            }}
            className={`py-3 px-2 sm:px-4 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 text-center ${activeTab === 'history'
              ? 'border-[#c34c36] text-[#c34c36] bg-[#c34c36]/5 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">{isBuyerRole ? '2. Lịch Sử Giao Dịch' : '3. Lịch Sử Giao Dịch'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body - Giữ nguyên chiều cao cố định giữa các tab, không bị co giật */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* TAB 1: WALLET DEPOSIT VIA VIETQR */}
          {activeTab === 'wallet' && (
            <div className="space-y-4 animate-fadeIn flex-1 overflow-y-auto min-h-0 flex flex-col justify-between pr-1">
              {!depositRequest ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
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
                          className={`py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all border cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${depositAmount === amt
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

                    {/* Trust & Security features row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Duyệt tự động 30s qua SePay</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Bảo lãnh Escrow an toàn</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Hoàn tiền & tra soát 24/7</span>
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
                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-auto"
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
                </div>
              ) : (
                /* QR CODE & BANK TRANSFER DETAILS VIEW */
                <div className="space-y-4 animate-fadeIn">
                  {/* Context banner when seller is topping up the deficit for a package or retail order */}
                  {pendingRetailOrder && (
                    <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/30 rounded-2xl p-2.5 sm:px-4 sm:py-2 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Coins className="w-4 h-4 text-blue-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.2 rounded">
                              Mua Lẻ Nạp Thiếu
                            </span>
                            <span className="text-xs font-black text-[#24263e] truncate">
                              {pendingRetailOrder.listingQuantity} tin • {pendingRetailOrder.aiChatQuantity} chat • {pendingRetailOrder.valuationQuantity} định giá
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium mt-0.5">
                            <span>Giá: <strong className="text-slate-800 font-mono">{formatVND(pendingRetailOrder.totalFee)}</strong></span>
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
                        {depositRequest.amount > (pendingRetailOrder.totalFee - currentWalletBalance) && (
                          <span className="text-[9px] text-amber-700 block font-semibold leading-none mt-0.5">
                            (Tối thiểu 10.000đ)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

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
                    <div className="py-5 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200 p-5 animate-fadeIn">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-emerald-800">
                        {pendingPackage
                          ? `Chuyển Tiền Thành Công - Đang Kích Hoạt Gói ${getPkgName(pendingPackage)}!`
                          : 'Nạp Tiền Thành Công!'}
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Hệ thống đã nhận được khoản thanh toán <strong>{formatVND(depositRequest.amount)}</strong>. Số dư ví của bạn hiện tại: <strong className="text-emerald-950 font-black">{formatVND(wallet?.balance ?? 0)}</strong>.
                      </p>

                      <div className="flex items-center justify-center gap-2 pt-0.5 pb-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const fresh = await walletService.getMyWallet().catch(() => null);
                            if (fresh) {
                              setWallet(fresh);
                              preDepositBalanceRef.current = fresh.balance;
                              if (onWalletUpdated) onWalletUpdated(fresh.balance);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                          <span>Làm Mới Số Dư Live</span>
                        </button>
                      </div>

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
                        <div className="pt-1.5 flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            onClick={() => {
                              setDepositRequest(null);
                              onClose();
                            }}
                            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm"
                          >
                            Xác Nhận & Quay Lại Mua Hàng
                          </button>
                          <button
                            onClick={() => setDepositRequest(null)}
                            className="px-4 py-2.5 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
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

                        {/* Transfer Credentials */}
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

                          {/* Nội dung chuyển khoản */}
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

          {/* TAB 2: PACKAGES PURCHASE VIA WALLET */}
          {activeTab === 'packages' && (
            <div className="space-y-4 animate-fadeIn flex-1 flex flex-col min-h-0">
              {packageSuccess && latestReceipt ? (
                <div className="py-6 px-5 text-center space-y-4 animate-fadeIn bg-emerald-50 rounded-3xl border border-emerald-200">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                      Biên nhận #{latestReceipt.id.slice(0, 8).toUpperCase()} (v{latestReceipt.packageVersion})
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-emerald-950">
                      Thanh Toán Gói Dịch Vụ Thành Công!
                    </h3>
                    <p className="text-xs text-emerald-800 font-medium">
                      Gói <strong>{latestReceipt.packageName}</strong> đã được thanh toán{' '}
                      <span className="font-black font-mono text-emerald-900">{formatVND(latestReceipt.price)}</span>{' '}
                      từ Ví và cấp quyền lợi trực tiếp vào tài khoản của bạn.
                    </p>
                  </div>

                  {/* Quyền lợi đã cấp theo biên nhận */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {latestReceipt.postCredits > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-black text-emerald-800 shadow-2xs">
                        <Tag className="w-3.5 h-3.5 text-[#c34c36]" />
                        <span>+{latestReceipt.postCredits} Lượt đăng tin</span>
                      </span>
                    )}
                    {latestReceipt.chatCredits > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-black text-emerald-800 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>+{latestReceipt.chatCredits} Lượt Chat AI</span>
                      </span>
                    )}
                    {latestReceipt.valuationCredits > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-black text-emerald-800 shadow-2xs">
                        <Search className="w-3.5 h-3.5 text-blue-500" />
                        <span>+{latestReceipt.valuationCredits} Lượt định giá AI</span>
                      </span>
                    )}
                  </div>

                  {/* Chi tiết snapshot số dư và thời gian */}
                  <div className="max-w-md mx-auto p-3.5 bg-white rounded-2xl border border-emerald-200/80 text-left text-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px]">
                      <span className="text-slate-500">Mã yêu cầu (Idempotency):</span>
                      <span className="font-mono text-slate-700 font-semibold truncate max-w-[200px]" title={latestReceipt.requestId}>
                        {latestReceipt.requestId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px]">
                      <span className="text-slate-500">Số dư ví trước giao dịch:</span>
                      <span className="font-mono text-slate-700">{formatVND(latestReceipt.walletBalanceBefore)}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px]">
                      <span className="text-slate-500 font-bold">Số dư ví sau giao dịch:</span>
                      <span className="font-mono font-extrabold text-emerald-700">{formatVND(latestReceipt.walletBalanceAfter)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Thời gian giao dịch:</span>
                      <span className="text-slate-700">{new Date(latestReceipt.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPackageSuccess(false);
                        setLatestReceipt(null);
                        setPurchasedPackage(null);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      Mua Thêm Gói Khác
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPackageSuccess(false);
                        setLatestReceipt(null);
                        setPurchasedPackage(null);
                        setActiveTab('history');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Xem Lịch Sử Giao Dịch</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-md"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
                  {/* 1. Header (Cố định ở đầu Tab 2): Switcher Combo/Gói dịch vụ vs Mua Lẻ Credit */}
                  <div className="shrink-0 space-y-2 pb-2">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl border border-slate-200/90">
                      <button
                        type="button"
                        onClick={() => {
                          setPackageCategory('combo');
                          setPurchaseError(null);
                        }}
                        className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${packageCategory === 'combo'
                          ? 'bg-[#c34c36] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                          }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                        <span className="whitespace-nowrap">Gói Combo Dịch Vụ</span>
                        {maxDiscount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-300 text-amber-950 font-black shrink-0 shadow-2xs">
                            Tiết kiệm tới {maxDiscount.toFixed(0)}%
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPackageCategory('retail');
                          setPurchaseError(null);
                        }}
                        className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${packageCategory === 'retail'
                          ? 'bg-[#24263e] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                          }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="whitespace-nowrap">Mua Lẻ</span>

                      </button>
                    </div>

                    {/* Sub-header info: Combo Description & Filters vs Mua Lẻ Unit Prices */}
                    {packageCategory === 'combo' ? (
                      <div className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-50 to-orange-50/60 rounded-2xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#c34c36] shrink-0" />
                          <span className="text-slate-700">
                            <strong>Gói Combo Dịch Vụ:</strong> Tất cả các gói dịch vụ cấu hình sẵn giúp bạn tối ưu chi phí bán hàng.
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPackageFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${packageFilter === 'all'
                              ? 'bg-[#c34c36] text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                              }`}
                          >
                            Tất cả ({packages.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPackageFilter('combo')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${packageFilter === 'combo'
                              ? 'bg-[#c34c36] text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                              }`}
                          >
                            Combo ({packages.filter((p) => getPackageType(p) === 'combo').length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPackageFilter('listing')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${packageFilter === 'listing'
                              ? 'bg-[#c34c36] text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                              }`}
                          >
                            Đăng tin ({packages.filter((p) => Number(p.postCredits || 0) > 0).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPackageFilter('chat')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${packageFilter === 'chat'
                              ? 'bg-[#c34c36] text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                              }`}
                          >
                            Chat AI ({packages.filter((p) => Number(p.chatCredits || 0) > 0).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPackageFilter('valuation')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${packageFilter === 'valuation'
                              ? 'bg-[#c34c36] text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                              }`}
                          >
                            Định giá ({packages.filter((p) => Number(p.valuationCredits || 0) > 0).length})
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 sm:p-3 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="text-slate-700">
                            <strong>Giá bán lẻ:</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            Tin đăng: <strong className="font-mono text-[#c34c36]">{formatVND(unitPrices.listing)}</strong> <span className="text-slate-500 font-semibold">/ tin (lượt)</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            Chat AI: <strong className="font-mono text-indigo-600">{formatVND(unitPrices.chat)}</strong> <span className="text-slate-500 font-semibold">/ lượt</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            Định giá: <strong className="font-mono text-blue-600">{formatVND(unitPrices.valuation)}</strong> <span className="text-slate-500 font-semibold">/ lượt</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {packagesError && packages.length > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-700 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{packagesError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={loadPackagesAndCredit}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition cursor-pointer shrink-0"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Middle Scrollable Area */}
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1 pt-2 sm:pt-2.5 pb-2 space-y-3">
                    {packagesLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="w-8 h-8 text-[#24263e] animate-spin" />
                        <p className="text-sm text-[#24263e]/80 font-bold">Đang tải danh sách gói dịch vụ...</p>
                      </div>
                    ) : packages.length === 0 && packagesError ? (
                      <div className="py-10 px-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-4 animate-fadeIn">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-2">
                          <h4 className="text-sm font-black text-slate-900">
                            Bảng Giá Dịch Vụ Chưa Được Cấu Hình Hoặc Đang Cập Nhật
                          </h4>
                          <p className="text-xs text-slate-600">
                            {packagesError}
                          </p>
                          {currentUser?.role === 'admin' ? (
                            <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-left text-[11px] text-amber-900 mt-2 space-y-1">
                              <span className="font-bold block">💡 Hướng dẫn dành cho Quản trị viên (Admin):</span>
                              <span>
                                Backend yêu cầu phải có đơn giá chuẩn đang hoạt động cho 3 loại credit (ĐĂNG TIN, KIỂM ĐỊNH, CHAT AI).
                                Vui lòng mở menu <strong>BẢNG GIÁ & CHIẾT KHẤU</strong> trên trang Quản trị để cấu hình đơn giá chuẩn.
                              </span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">
                              Hệ thống đang đồng bộ bảng giá từ Quản trị viên. Quý khách vui lòng thử lại sau ít phút.
                            </p>
                          )}
                        </div>
                        <div className="pt-1 flex items-center justify-center gap-3 flex-wrap">
                          {currentUser?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigatePath('/admin/credit-pricing');
                              }}
                              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>Mở Bảng Giá & Chiết Khấu Admin</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={loadPackagesAndCredit}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs cursor-pointer inline-flex items-center gap-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Tải lại gói dịch vụ</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* VIEW 1: GÓI DỊCH VỤ CẤU HÌNH BỞI ADMIN (BAO GỒM CẢ COMBO VÀ GÓI ĐƠN LẺ NHƯ 10 BÀI ĐĂNG) */}
                        {packageCategory === 'combo' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 animate-fadeIn">
                            {displayedPackages.map((pkg) => {
                              const isSelected = selectedPkg?.id === pkg.id;
                              const pkgName = getPkgName(pkg);
                              const pkgPrice = getPkgPrice(pkg);
                              const refPrice = pkg.referencePrice ? Number(pkg.referencePrice) : null;
                              const discount = Number(pkg.discountPercentage || 0) || (refPrice && refPrice > pkgPrice ? Math.round(((refPrice - pkgPrice) / refPrice) * 1000) / 10 : 0);
                              const postCredits = Number(pkg.postCredits || 0);
                              const chatCredits = Number(pkg.chatCredits || 0);
                              const valuationCredits = Number(pkg.valuationCredits || 0);
                              const pkgType = getPackageType(pkg);
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
                                  {discount > 0 && (
                                    <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-emerald-600 text-white shadow-xs z-10 pointer-events-none">
                                      Giảm {discount.toFixed(1)}%
                                    </span>
                                  )}

                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${pkgType === 'combo'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                        : pkgType === 'listing'
                                          ? 'bg-orange-100 text-orange-900 border border-orange-200'
                                          : pkgType === 'valuation'
                                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                            : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                        }`}>
                                        {pkgType === 'combo' ? (
                                          <>
                                            <Sparkles className="w-3 h-3 text-amber-600" />
                                            <span>Combo Đa Năng</span>
                                          </>
                                        ) : pkgType === 'listing' ? (
                                          <>
                                            <Tag className="w-3 h-3 text-orange-600" />
                                            <span>Gói Đăng Bài</span>
                                          </>
                                        ) : pkgType === 'valuation' ? (
                                          <>
                                            <Search className="w-3 h-3 text-blue-600" />
                                            <span>Gói Định Giá</span>
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="w-3 h-3 text-indigo-600" />
                                            <span>Gói Chat AI</span>
                                          </>
                                        )}
                                      </span>
                                    </div>

                                    <h4 className="font-black text-xs sm:text-sm text-[#24263e] line-clamp-1">{pkgName}</h4>
                                    <div className="mt-1 flex items-baseline gap-1.5">
                                      <span className="text-base font-black text-[#c34c36] font-mono">
                                        {formatVND(pkgPrice)}
                                      </span>
                                      {pkg.pricingAvailable && refPrice && refPrice > pkgPrice && (
                                        <span className="text-[10px] text-slate-400 line-through font-mono">
                                          {formatVND(refPrice)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-1.5 my-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                      {postCredits > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                          <Tag className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                                          <span>+{postCredits} Lượt đăng tin bài</span>
                                        </div>
                                      )}
                                      {chatCredits > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          <span>+{chatCredits} Lượt Chat AI</span>
                                        </div>
                                      )}
                                      {valuationCredits > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                          <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                          <span>+{valuationCredits} Lượt định giá AI</span>
                                        </div>
                                      )}
                                      {postCredits === 0 && chatCredits === 0 && valuationCredits === 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          <span>+{getPkgTotalCredits(pkg)} Lượt dịch vụ</span>
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
                                        <span>Thiếu {formatVND(pkgPrice - currentWalletBalance)}</span>
                                      </span>
                                    )}
                                    <span
                                      className={`font-black text-[10px] px-2 py-0.5 rounded-md transition-colors ${isSelected
                                        ? 'bg-[#c34c36] text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700'
                                        }`}
                                    >
                                      {isSelected ? '✓ Đang chọn' : 'Chọn gói'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* VIEW 2: MUA LẺ CREDIT TỰ CHỌN SỐ LƯỢNG */}
                        {packageCategory === 'retail' && (
                          <div className="space-y-4 animate-fadeIn">
                            {/* 3 cards: Listing, Chat AI, Valuation */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                              {/* 1. Lượt Đăng Bài */}
                              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between hover:border-orange-300 transition overflow-hidden">
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-orange-50 text-orange-800 border border-orange-200">
                                      <Tag className="w-3.5 h-3.5 text-[#c34c36]" />
                                      <span>Lượt đăng bài</span>
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mb-3">
                                    Dùng để đăng bán các thiết bị điện tử, máy móc cũ lên sàn SecondLife.
                                  </p>

                                  {/* Quantity control */}
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-600 block">Số lượng lượt mua:</label>
                                    <div className="flex items-center gap-1.5 w-full">
                                      <button
                                        type="button"
                                        onClick={() => setRetailListingQty((q) => Math.max(0, q - 1))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Giảm 1 lượt"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={retailListingQty === 0 ? '' : String(retailListingQty)}
                                        placeholder="0"
                                        onKeyDown={handleNumericKeyDown}
                                        onPaste={(e) => {
                                          e.preventDefault();
                                          const pasted = e.clipboardData.getData('text');
                                          handleQtyInput(pasted, setRetailListingQty);
                                        }}
                                        onChange={(e) => handleQtyInput(e.target.value, setRetailListingQty)}
                                        className="flex-1 min-w-0 w-0 h-9 rounded-xl border border-slate-200 text-center font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c34c36]/30 focus:border-[#c34c36] bg-white px-1"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setRetailListingQty((q) => Math.min(10000, q + 1))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Tăng 1 lượt"
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Quick presets */}
                                    <div className="space-y-1 pt-1">
                                      <span className="text-[10px] text-slate-400 font-semibold block">Chọn nhanh:</span>
                                      <div className="grid grid-cols-5 gap-1">
                                        {[0, 5, 10, 20, 50].map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => setRetailListingQty(num)}
                                            className={`py-1 rounded-lg text-[10.5px] font-bold text-center cursor-pointer transition ${retailListingQty === num
                                              ? 'bg-[#c34c36] text-white shadow-2xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                              }`}
                                          >
                                            {num === 0 ? 'Xóa' : `${num}`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                  <span className="text-slate-500 font-medium">Thành tiền tin đăng:</span>
                                  <span className="font-mono font-black text-[#c34c36]">
                                    {formatVND(retailListingQty * unitPrices.listing)}
                                  </span>
                                </div>
                              </div>

                              {/* 2. Lượt Trợ Lý Chat AI */}
                              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between hover:border-indigo-300 transition overflow-hidden">
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Lượt chat AI</span>
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mb-3">
                                    Tạo tiêu đề, mô tả chuẩn SEO tự động và hỏi đáp chuyên sâu thông số kỹ thuật.
                                  </p>

                                  {/* Quantity control */}
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-600 block">Số lượng lượt mua:</label>
                                    <div className="flex items-center gap-1.5 w-full">
                                      <button
                                        type="button"
                                        onClick={() => setRetailChatQty((q) => Math.max(0, q - 5))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Giảm 5 lượt"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={retailChatQty === 0 ? '' : String(retailChatQty)}
                                        placeholder="0"
                                        onKeyDown={handleNumericKeyDown}
                                        onPaste={(e) => {
                                          e.preventDefault();
                                          const pasted = e.clipboardData.getData('text');
                                          handleQtyInput(pasted, setRetailChatQty);
                                        }}
                                        onChange={(e) => handleQtyInput(e.target.value, setRetailChatQty)}
                                        className="flex-1 min-w-0 w-0 h-9 rounded-xl border border-slate-200 text-center font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white px-1"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setRetailChatQty((q) => Math.min(10000, q + 5))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Tăng 5 lượt"
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Quick presets */}
                                    <div className="space-y-1 pt-1">
                                      <span className="text-[10px] text-slate-400 font-semibold block">Chọn nhanh:</span>
                                      <div className="grid grid-cols-5 gap-1">
                                        {[0, 10, 25, 50, 100].map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => setRetailChatQty(num)}
                                            className={`py-1 rounded-lg text-[10.5px] font-bold text-center cursor-pointer transition ${retailChatQty === num
                                              ? 'bg-indigo-600 text-white shadow-2xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                              }`}
                                          >
                                            {num === 0 ? 'Xóa' : `${num}`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                  <span className="text-slate-500 font-medium">Thành tiền Chat AI:</span>
                                  <span className="font-mono font-black text-indigo-600">
                                    {formatVND(retailChatQty * unitPrices.chat)}
                                  </span>
                                </div>
                              </div>

                              {/* 3. Lượt Định Giá AI */}
                              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between hover:border-blue-300 transition overflow-hidden">
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                                      <Search className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Lượt định giá AI</span>
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mb-3">
                                    AI phân tích thị trường và tình trạng máy để đề xuất khoảng giá thanh lý tối ưu.
                                  </p>

                                  {/* Quantity control */}
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-600 block">Số lượng lượt mua:</label>
                                    <div className="flex items-center gap-1.5 w-full">
                                      <button
                                        type="button"
                                        onClick={() => setRetailValuationQty((q) => Math.max(0, q - 1))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Giảm 1 lượt"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={retailValuationQty === 0 ? '' : String(retailValuationQty)}
                                        placeholder="0"
                                        onKeyDown={handleNumericKeyDown}
                                        onPaste={(e) => {
                                          e.preventDefault();
                                          const pasted = e.clipboardData.getData('text');
                                          handleQtyInput(pasted, setRetailValuationQty);
                                        }}
                                        onChange={(e) => handleQtyInput(e.target.value, setRetailValuationQty)}
                                        className="flex-1 min-w-0 w-0 h-9 rounded-xl border border-slate-200 text-center font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white px-1"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setRetailValuationQty((q) => Math.min(10000, q + 1))}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 border border-slate-200/60"
                                        aria-label="Tăng 1 lượt"
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Quick presets */}
                                    <div className="space-y-1 pt-1">
                                      <span className="text-[10px] text-slate-400 font-semibold block">Chọn nhanh:</span>
                                      <div className="grid grid-cols-5 gap-1">
                                        {[0, 5, 10, 20, 50].map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => setRetailValuationQty(num)}
                                            className={`py-1 rounded-lg text-[10.5px] font-bold text-center cursor-pointer transition ${retailValuationQty === num
                                              ? 'bg-blue-600 text-white shadow-2xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                              }`}
                                          >
                                            {num === 0 ? 'Xóa' : `${num}`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                  <span className="text-slate-500 font-medium">Thành tiền định giá:</span>
                                  <span className="font-mono font-black text-blue-600">
                                    {formatVND(retailValuationQty * unitPrices.valuation)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Bảng tính tổng và so sánh số dư ví */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/40 border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Receipt className="w-3.5 h-3.5 text-[#c34c36]" />
                                  <span>Bảng Kê Chi Tiết Đơn Mua Lẻ</span>
                                </h5>
                                <span className="text-[11px] font-bold text-slate-500">
                                  Tổng số lượt chọn: <strong className="font-mono text-slate-900">{totalRetailCredits}</strong> lượt
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-center">
                                  <span>• Lượt đăng tin ({retailListingQty} lượt × {formatVND(unitPrices.listing)}):</span>
                                  <span className="font-mono font-bold text-slate-800">{formatVND(retailListingQty * unitPrices.listing)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>• Lượt Chat AI ({retailChatQty} lượt × {formatVND(unitPrices.chat)}):</span>
                                  <span className="font-mono font-bold text-slate-800">{formatVND(retailChatQty * unitPrices.chat)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>• Lượt định giá AI ({retailValuationQty} lượt × {formatVND(unitPrices.valuation)}):</span>
                                  <span className="font-mono font-bold text-slate-800">{formatVND(retailValuationQty * unitPrices.valuation)}</span>
                                </div>

                                {retailDiscountAmount > 0 && (
                                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-emerald-700 font-bold">
                                    <span>Chiết khấu ưu đãi:</span>
                                    <span className="font-mono">-{formatVND(retailDiscountAmount)}</span>
                                  </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-black text-sm">
                                  <span className="text-[#24263e]">Tổng thanh toán:</span>
                                  <span className="font-mono text-base text-[#c34c36]">{formatVND(totalRetailFee)}</span>
                                </div>
                              </div>

                              {/* Trạng thái số dư ví */}
                              <div className="p-3 rounded-xl bg-white border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="text-slate-600">
                                    Số dư ví SecondLife: <strong className="font-mono font-black text-slate-900">{formatVND(currentWalletBalance)}</strong>
                                  </span>
                                </div>

                                {totalRetailFee === 0 ? (
                                  <span className="text-[11px] text-slate-400 font-medium">Chưa chọn lượt nào</span>
                                ) : currentWalletBalance >= totalRetailFee ? (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Đủ số dư ví (Còn dư {formatVND(currentWalletBalance - totalRetailFee)})</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                                    <QrCode className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Cần nạp thiếu: {formatVND(totalRetailFee - currentWalletBalance)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 3. Summary & Purchase Action Bar (CỐ ĐỊNH Ở ĐÁY TAB 2) */}
                  {packageCategory === 'retail' ? (
                    <div className="shrink-0 pt-2.5 mt-auto border-t border-[#24263e]/10 bg-[#faf8f5]">
                      {purchaseError && (
                        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between gap-3 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{purchaseError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('wallet')}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] shrink-0 hover:bg-red-700 cursor-pointer"
                          >
                            Nạp ví ngay &rarr;
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-2xl shadow-xs border border-slate-200/80">
                        <div className="flex-1 min-w-0">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-500">Đang chọn:</span>
                              <span className="text-xs sm:text-sm font-black text-[#24263e]">
                                Mua Lẻ ({totalRetailCredits} lượt: {retailListingQty} tin, {retailChatQty} chat, {retailValuationQty} định giá)
                              </span>
                              <span className="text-xs font-mono font-black text-[#c34c36]">
                                ({formatVND(totalRetailFee)})
                              </span>
                            </div>
                            <div className="text-[11px] font-medium">
                              {totalRetailFee === 0 ? (
                                <span className="text-slate-400 italic">Vui lòng chọn số lượng lượt dịch vụ cần mua ở trên</span>
                              ) : currentWalletBalance >= totalRetailFee ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  Số dư ví: {formatVND(currentWalletBalance)} (Đủ điều kiện trừ ví trực tiếp)
                                </span>
                              ) : (
                                <span className="text-amber-800 font-semibold flex items-center gap-1 flex-wrap">
                                  <QrCode className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                  <span>Số dư ví: <strong className="font-mono">{formatVND(currentWalletBalance)}</strong></span>
                                  <span>•</span>
                                  <span>Cần nạp thiếu: <strong className="text-[#c34c36] font-mono font-black">{formatVND(totalRetailFee - currentWalletBalance)}</strong></span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="w-full sm:w-auto shrink-0">
                          <button
                            disabled={totalRetailFee === 0 || totalRetailCredits === 0 || purchasing || creatingDeposit}
                            onClick={handleConfirmRetailPurchase}
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
                            ) : totalRetailCredits === 0 || totalRetailFee === 0 ? (
                              <>
                                <ShoppingBag className="w-4 h-4 shrink-0 opacity-50" />
                                <span>Chưa chọn số lượng lượt</span>
                              </>
                            ) : currentWalletBalance < totalRetailFee ? (
                              <>
                                <QrCode className="w-4 h-4 shrink-0" />
                                <span>
                                  Quét QR Nạp Thiếu & Mua Lẻ ({formatVND(Math.max(totalRetailFee - currentWalletBalance, 10000))})
                                </span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-4 h-4 shrink-0" />
                                <span>
                                  Xác Nhận Mua Lẻ ({formatVND(totalRetailFee)})
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : packages.length > 0 && (
                    <div className="shrink-0 pt-2.5 mt-auto border-t border-[#24263e]/10 bg-[#faf8f5]">
                      {purchaseError && (
                        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between gap-3 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{purchaseError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('wallet')}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] shrink-0 hover:bg-red-700 cursor-pointer"
                          >
                            Nạp ví ngay &rarr;
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-2xl shadow-xs border border-slate-200/80">
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
                            <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>Vui lòng chọn một gói dịch vụ ở danh sách phía trên để thanh toán</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full sm:w-auto shrink-0">
                          <button
                            disabled={!selectedPkg || purchasing || creatingDeposit || packagesLoading}
                            onClick={() => selectedPkg && handleConfirmPurchase(selectedPkg)}
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
                                  Xác Nhận Mua Gói {selectedPkg ? `(${formatVND(getPkgPrice(selectedPkg))})` : ''}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSACTION HISTORY (GIAO DỊCH VÍ & GÓI DỊCH VỤ GỘP CHUNG, GỌN GÀNG, ĐỦ CHỖ) */}
          {activeTab === 'history' && (
            <div className="animate-fadeIn flex-1 flex flex-col min-h-0">
              <WalletHistoryPanel
                lang={lang}
                refreshKey={historyRefreshKey}
                purchases={purchases}
                onRefresh={handleRefreshTopBar}
              />
            </div>
          )}
        </div>
      </div>

      {/* Zoom QR Modal Overlay */}
    </div>
  );
};

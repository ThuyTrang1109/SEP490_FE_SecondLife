import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Wallet,
  CheckCircle2,
  Clock,
  Tag,
  Eye,
  Edit3,
  Star,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  XCircle,
  Award,
  Upload,
  Coins,
  History,
  Trash2,
  FileText
} from 'lucide-react';
import { Listing, Language, UserProfile } from '../types';
import { formatVND } from '../utils/translations';
import { getBoughtListingIds } from '../utils/orderUtils';
import { sellerService, SellerVerificationResponseDto } from '../services/sellerService';
import { sellerCreditService, CreditBalanceResponseDto, CreditLedgerResponseDto, CreditPurchaseResponseDto } from '../services/sellerCreditService';
import { mediaService } from '../services/mediaService';
import { postService } from '../services/postService';
import { walletService } from '../services/walletService';
import { reputationService, SellerReputationDto, ReputationHistoryDto } from '../services/reputationService';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { WithdrawalModal } from '../components/modals/WithdrawalModal';
import { extractWardAndCity, getSavedSellerAddress, cleanFullAddress } from '../utils/addressUtils';
import { dialogService } from '../utils/dialogService';

interface SellerDashboardViewProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  onCreateListing: (draft?: Listing) => void;
  onViewOrders?: () => void;
  lang: Language;
  currentUser?: UserProfile | null;
  onDeleteListing?: (listingId: string) => void;
}

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  listings,
  onSelectListing,
  onCreateListing,
  onViewOrders,
  lang,
  currentUser,
  onDeleteListing,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'draft' | 'pending' | 'rejected' | 'reserved' | 'sold'>('ALL');
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToastNotice = (type: 'success' | 'error', message: string) => {
    setToastNotice({ type, message });
    setTimeout(() => setToastNotice(null), 4000);
  };

  const executeDeleteDraft = async () => {
    if (!draftToDelete) return;
    const postId = draftToDelete.id;
    try {
      setDeletingDraftId(postId);
      await postService.deleteDraft(postId);
      setMyServerPosts((prev) => prev.filter((p) => p.id !== postId));
      onDeleteListing?.(postId);
      showToastNotice('success', lang === 'vi' ? 'Đã xóa bản nháp thành công!' : 'Draft deleted successfully!');
      setDraftToDelete(null);
      fetchSellerData();
    } catch (err: any) {
      const msg = err?.message || (lang === 'vi' ? 'Không thể xóa bản nháp' : 'Failed to delete draft');
      showToastNotice('error', msg);
    } finally {
      setDeletingDraftId(null);
    }
  };

  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [bankName, setBankName] = useState(currentUser?.bankAccount?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(currentUser?.bankAccount?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(currentUser?.bankAccount?.accountHolder || currentUser?.name || '');
  const [sellerWalletBalance, setSellerWalletBalance] = useState<number>(currentUser?.walletBalanceVnd ?? currentUser?.walletBalance ?? 0);
  const [payoutAmount, setPayoutAmount] = useState<number>(currentUser?.walletBalanceVnd ?? currentUser?.walletBalance ?? 0);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [isSellerReviewsOpen, setIsSellerReviewsOpen] = useState(false);

  useEffect(() => {
    if (currentUser?.bankAccount) {
      if (currentUser.bankAccount.bankName) setBankName(currentUser.bankAccount.bankName);
      if (currentUser.bankAccount.accountNumber) setAccountNumber(currentUser.bankAccount.accountNumber);
      if (currentUser.bankAccount.accountHolder) setAccountHolder(currentUser.bankAccount.accountHolder);
    } else if (currentUser?.name && !accountHolder) {
      setAccountHolder(currentUser.name);
    }
  }, [currentUser]);

  // Seller Verification State
  const [myVerification, setMyVerification] = useState<SellerVerificationResponseDto | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [resubmitFrontUrl, setResubmitFrontUrl] = useState('');
  const [resubmitBackUrl, setResubmitBackUrl] = useState('');
  const [resubmitSelfieUrl, setResubmitSelfieUrl] = useState('');
  const [resubmitDocNum, setResubmitDocNum] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [resubmitMsg, setResubmitMsg] = useState<string | null>(null);

  // Credit Balance & Ledger State
  const [creditBalance, setCreditBalance] = useState<CreditBalanceResponseDto | null>(null);
  const [isCreditLedgerOpen, setIsCreditLedgerOpen] = useState(false);
  const [creditLedgerItems, setCreditLedgerItems] = useState<CreditLedgerResponseDto[]>([]);
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchaseResponseDto[]>([]);
  const [creditModalTab, setCreditModalTab] = useState<'ledger' | 'purchases' | 'buy'>('ledger');
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [buyListingQty, setBuyListingQty] = useState<number>(5);
  const [buyValuationQty, setBuyValuationQty] = useState<number>(5);
  const [buyChatQty, setBuyChatQty] = useState<number>(5);
  const [calculatedPricing, setCalculatedPricing] = useState<any>(null);
  const [isCalculatingPricing, setIsCalculatingPricing] = useState<boolean>(false);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState<boolean>(false);

  useEffect(() => {
    if (creditModalTab === 'buy') {
      setIsCalculatingPricing(true);
      sellerCreditService
        .getPricing(buyListingQty, buyValuationQty)
        .then((res) => setCalculatedPricing(res))
        .catch((err) => console.warn('Lỗi tính giá credit:', err))
        .finally(() => setIsCalculatingPricing(false));
    }
  }, [creditModalTab, buyListingQty, buyValuationQty]);

  const handleCreateCreditPurchase = async () => {
    setIsSubmittingPurchase(true);
    try {
      const res = await sellerCreditService.createPurchase({
        listingQuantity: buyListingQty,
        valuationQuantity: buyValuationQty,
        aiChatQuantity: buyChatQty,
      });
      showToastNotice('success', `Đã tạo đơn mua #${res?.id ? res.id.slice(0, 8) : ''} thành công!`);
      const [bal, purchases] = await Promise.all([
        sellerCreditService.getCredits(),
        sellerCreditService.getPurchases(0, 30),
      ]);
      if (bal) setCreditBalance(bal);
      const purchaseItems =
        (purchases as any)?.items ||
        (purchases as any)?.content ||
        (purchases as any)?.data?.items ||
        (purchases as any)?.data ||
        (Array.isArray(purchases) ? purchases : []);
      setCreditPurchases(purchaseItems);
      setCreditModalTab('purchases');
    } catch (err: any) {
      showToastNotice('error', err?.message || 'Không thể tạo đơn mua tín dụng');
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Real Backend Posts State
  const [myServerPosts, setMyServerPosts] = useState<Listing[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Seller Reputation State (GET /api/v1/seller/reputation/me & /history)
  const [myReputation, setMyReputation] = useState<SellerReputationDto | null>(null);
  const [isReputationHistoryOpen, setIsReputationHistoryOpen] = useState(false);
  const [reputationHistoryItems, setReputationHistoryItems] = useState<ReputationHistoryDto[]>([]);
  const [isLoadingReputationHistory, setIsLoadingReputationHistory] = useState(false);

  const handleOpenReputationHistory = async () => {
    setIsReputationHistoryOpen(true);
    setIsLoadingReputationHistory(true);
    try {
      const res = await reputationService.getMyReputationHistory(0, 30);
      setReputationHistoryItems(res.items || []);
    } catch (err) {
      console.warn('Lỗi tải lịch sử uy tín:', err);
    } finally {
      setIsLoadingReputationHistory(false);
    }
  };

  // Seller Verification History State (GET /api/v1/seller-verifications/me/history & /status/{status})
  const [isVerificationHistoryOpen, setIsVerificationHistoryOpen] = useState(false);
  const [verificationHistoryList, setVerificationHistoryList] = useState<SellerVerificationResponseDto[]>([]);
  const [isLoadingVerificationHistory, setIsLoadingVerificationHistory] = useState(false);
  const [verificationFilterStatus, setVerificationFilterStatus] = useState<string>('ALL');
  const [selectedVerificationPreview, setSelectedVerificationPreview] = useState<SellerVerificationResponseDto | null>(null);

  const loadVerificationHistory = async () => {
    setIsLoadingVerificationHistory(true);
    try {
      const data = await sellerService.getVerificationHistory();
      if (Array.isArray(data) && data.length > 0) {
        setVerificationHistoryList(data);
      } else if (myVerification) {
        setVerificationHistoryList([myVerification]);
      } else {
        setVerificationHistoryList([]);
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử eKYC:', err);
      if (myVerification) {
        setVerificationHistoryList([myVerification]);
      } else {
        setVerificationHistoryList([]);
      }
    } finally {
      setIsLoadingVerificationHistory(false);
    }
  };

  const handleOpenVerificationHistory = () => {
    setIsVerificationHistoryOpen(true);
    setVerificationFilterStatus('ALL');
    setSelectedVerificationPreview(null);
    loadVerificationHistory();
  };

  const handleFilterVerificationStatus = async (status: string) => {
    setVerificationFilterStatus(status);
    setSelectedVerificationPreview(null);
    if (status === 'ALL') {
      await loadVerificationHistory();
    } else {
      setIsLoadingVerificationHistory(true);
      try {
        const item = await sellerService.getVerificationByStatus(status);
        if (item) {
          setVerificationHistoryList([item]);
        } else {
          setVerificationHistoryList([]);
        }
      } catch (err) {
        console.warn('Lỗi lọc eKYC theo trạng thái:', err);
        try {
          const all = await sellerService.getVerificationHistory();
          const filtered = all.filter((v) => v.status === status);
          setVerificationHistoryList(filtered);
        } catch {
          setVerificationHistoryList([]);
        }
      } finally {
        setIsLoadingVerificationHistory(false);
      }
    }
  };

  const getVerificationStatusInfo = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: lang === 'vi' ? 'Đã Phê Duyệt' : 'Approved',
          icon: CheckCircle2,
        };
      case 'NEEDS_REVIEW':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          label: lang === 'vi' ? 'Chờ Thẩm Định' : 'Needs Review',
          icon: Clock,
        };
      case 'SUBMITTED':
      case 'EKYC_PENDING':
      case 'PENDING':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: lang === 'vi' ? 'Đang Xử Lý eKYC' : 'eKYC Pending',
          icon: Loader2,
        };
      case 'RESUBMIT_REQUIRED':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          label: lang === 'vi' ? 'Yêu Cầu Nộp Lại' : 'Resubmit Required',
          icon: AlertCircle,
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: lang === 'vi' ? 'Bị Từ Chối' : 'Rejected',
          icon: XCircle,
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          label: status,
          icon: Clock,
        };
    }
  };

  const fetchSellerData = React.useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      sellerService.getMyVerification()
        .then((ver) => {
          if (ver) {
            setMyVerification(ver);
            setResubmitDocNum(ver.documentNumber || '');
            setResubmitFrontUrl(ver.documentFrontUrl || '');
            setResubmitBackUrl(ver.documentBackUrl || '');
            setResubmitSelfieUrl(ver.selfieUrl || '');
          }
        })
        .catch(() => {});

      sellerCreditService.getCredits()
        .then((bal) => {
          if (bal) setCreditBalance(bal);
        })
        .catch(() => {});

      walletService.getMyWallet()
        .then((w) => {
          if (w) setSellerWalletBalance(Number(w.balance || 0));
        })
        .catch(() => {});

      reputationService.getMyReputation()
        .then((rep) => {
          if (rep) setMyReputation(rep);
        })
        .catch(() => {});

      const res = await postService.getMyPosts(0, 50);
      const posts = (res as any)?.content || (res as any)?.data || (Array.isArray(res) ? res : []);
      if (posts && posts.length > 0) {
        const savedAddr = getSavedSellerAddress();
        const currentSellerAddr = currentUser?.pickupAddress || currentUser?.address || savedAddr.address;
        const currentSellerWard = currentUser?.wardName || currentUser?.ward || savedAddr.wardName;
        const currentSellerProv = currentUser?.provinceName || currentUser?.province || savedAddr.provinceName;

        const mapped: Listing[] = posts.map((p: any) => {
          const rawImages: string[] = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
            ? p.imageUrls
            : (p.imageUrl ? [p.imageUrl] : []);
          const fallbackImage = 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800';
          const primaryImage = rawImages[0] || fallbackImage;

          // Xác định địa chỉ người bán: Ưu tiên địa chỉ người bán mới nhất từ profile của seller
          const sellerAddr = cleanFullAddress(currentSellerAddr || p.sellerAddress || p.pickupAddress || p.user?.address || '');
          const loc = (currentSellerAddr ? extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv) : '') ||
            extractWardAndCity(p.sellerAddress || p.pickupAddress || p.user?.address, currentSellerWard, currentSellerProv) ||
            'Hà Nội';

          const isDraft = p.status === 'DRAFT';
          const draftTitle = p.title || (isDraft ? 'Bản nháp sản phẩm' : 'Thiết bị gia dụng SecondLife');
          const draftDesc = p.description || p.aiDescription || '';

          return {
            id: p.id || `post-${Date.now()}`,
            categoryId: p.categoryId,
            itemId: p.itemId,
            title: draftTitle,
            category: (p.category || 'Tủ lạnh & Tủ đông') as any,
            brand: p.brand || '',
            model: p.model || '',
            purchaseYear: 2024,
            priceVnd: Number(p.price || p.aiSuggestedPrice || 0),
            originalPriceVnd: Number(p.aiSuggestedPrice || p.price || 0),
            conditionGrade: (p.itemCondition || 'Like New') as any,
            declaredConditionText: p.itemCondition || 'Tình trạng tốt',
            description: draftDesc,
            location: loc,
            sellerAddress: sellerAddr,
            sellerId: p.user?.id || p.userId || currentUser?.id || 'me',
            sellerName: currentUser?.name || p.user?.fullName || p.user?.name || 'Tôi',
            sellerRating: 5.0,
            sellerCompletedOrders: 0,
            sellerVerified: true,
            status: (getBoughtListingIds().has(String(p.postId || p.id)) ? 'reserved' : (p.status === 'ACTIVE' ? 'active' : p.status === 'DRAFT' ? 'draft' : 'reserved')) as any,
            backendStatus: getBoughtListingIds().has(String(p.postId || p.id)) ? 'RESERVED' : p.status,
            rejectionReason: p.rejectionReason,
            createdAt: p.createdAt || new Date().toISOString(),
            isInspectionGuaranteed: true,
            requiresInspection: Number(p.price || 0) > 5000000,
            photos: {
              front: rawImages[0] || primaryImage,
              back: rawImages[1] || '',
              screenOrDetails: rawImages[2] || '',
              accessoriesOrBox: rawImages[3] || '',
              serialOrReceipt: rawImages[4] || '',
              extraDetail: rawImages[5] || '',
            },
            photoGallery: rawImages.length > 0 ? rawImages : [primaryImage],
            shippingWeight: p.shippingWeight,
            shippingLength: p.shippingLength,
            shippingWidth: p.shippingWidth,
            shippingHeight: p.shippingHeight,
          };
        });
        mapped.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
        setMyServerPosts(mapped);
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu người bán từ server:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.address,
    currentUser?.pickupAddress,
    currentUser?.ward,
    currentUser?.wardName,
    currentUser?.province,
    currentUser?.provinceName,
  ]);

  useEffect(() => {
    fetchSellerData();
  }, [fetchSellerData]);

  const handleOpenCreditLedger = async () => {
    setIsCreditLedgerOpen(true);
    setIsLoadingLedger(true);
    try {
      const [ledgerRes, purchasesRes] = await Promise.all([
        sellerCreditService.getLedger(0, 30),
        sellerCreditService.getPurchases(0, 30),
      ]);
      const ledgerItems = (ledgerRes as any)?.items || (ledgerRes as any)?.content || (ledgerRes as any)?.data?.items || (ledgerRes as any)?.data || (Array.isArray(ledgerRes) ? ledgerRes : []);
      const purchaseItems = (purchasesRes as any)?.items || (purchasesRes as any)?.content || (purchasesRes as any)?.data?.items || (purchasesRes as any)?.data || (Array.isArray(purchasesRes) ? purchasesRes : []);
      setCreditLedgerItems(ledgerItems);
      setCreditPurchases(purchaseItems);
    } catch (err) {
      console.warn('Lỗi lấy dữ liệu credit:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'front' | 'back' | 'selfie') => {
    try {
      setIsUploading(true);
      const res = await mediaService.uploadImage(file, 'ekyc-resubmit');
      if (type === 'front') setResubmitFrontUrl(res.url);
      else if (type === 'back') setResubmitBackUrl(res.url);
      else setResubmitSelfieUrl(res.url);
    } catch (err: any) {
      dialogService.error('Tải ảnh thất bại: ' + (err.message || 'Lỗi hệ thống'), 'Lỗi Tải Ảnh');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myVerification?.id) return;
    try {
      setIsUploading(true);
      const updated = await sellerService.resubmitVerification(myVerification.id, {
        documentFrontUrl: resubmitFrontUrl,
        documentBackUrl: resubmitBackUrl,
        selfieUrl: resubmitSelfieUrl,
      });
      setMyVerification(updated);
      setResubmitMsg('Đã nộp lại hồ sơ eKYC thành công. Quản trị viên sẽ xem xét duyệt lại hồ sơ của bạn.');
      setIsResubmitModalOpen(false);
    } catch (err: any) {
      setResubmitMsg('Nộp lại thất bại: ' + (err.message || 'Đã có lỗi xảy ra'));
    } finally {
      setIsUploading(false);
    }
  };

  // Chỉ lấy bài đăng thuộc về chính tài khoản người bán hiện tại (tuyệt đối không lấy bài/bản nháp của người bán khác)
  const combinedListings = React.useMemo(() => {
    const savedAddr = getSavedSellerAddress();
    const currentSellerAddr = currentUser?.pickupAddress || currentUser?.address || savedAddr.address;
    const currentSellerWard = currentUser?.wardName || currentUser?.ward || savedAddr.wardName;
    const currentSellerProv = currentUser?.provinceName || currentUser?.province || savedAddr.provinceName;
    const latestLoc = currentSellerAddr ? extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv) : '';

    const list = [...myServerPosts];
    const existingIds = new Set(myServerPosts.map(p => p.id));
    for (const item of listings) {
      const isMine =
        Boolean(currentUser?.id && item.sellerId === currentUser.id) ||
        Boolean(currentUser?.name && item.sellerName?.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
        item.sellerId === 'me';

      if (isMine && !existingIds.has(item.id)) {
        list.push(item);
      }
    }
    // Lọc lại để đảm bảo 100% chỉ có bài đăng của chính tài khoản người bán này và luôn cập nhật địa chỉ theo profile mới nhất
    return list
      .filter(item => {
        const isMine =
          Boolean(currentUser?.id && item.sellerId === currentUser.id) ||
          Boolean(currentUser?.name && item.sellerName?.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
          item.sellerId === 'me';
        return isMine;
      })
      .map(item => {
        if (latestLoc || currentSellerAddr) {
          return {
            ...item,
            location: latestLoc || item.location,
            sellerAddress: cleanFullAddress(currentSellerAddr || item.sellerAddress || latestLoc),
          };
        }
        return item;
      });
  }, [
    myServerPosts,
    listings,
    currentUser?.id,
    currentUser?.name,
    currentUser?.address,
    currentUser?.pickupAddress,
    currentUser?.wardName,
    currentUser?.ward,
    currentUser?.provinceName,
    currentUser?.province,
  ]);

  const filteredListings = combinedListings.filter((l) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'draft') {
      return l.backendStatus === 'DRAFT' || l.status === 'draft';
    }
    if (filterStatus === 'pending') {
      return (
        (l.backendStatus === 'PENDING' || l.backendStatus === 'PENDING_INSPECTION' || l.backendStatus === 'PENDING_REVIEW') &&
        l.status !== 'draft'
      );
    }
    if (filterStatus === 'rejected') {
      return l.backendStatus === 'REJECTED';
    }
    if (filterStatus === 'active') {
      if (getBoughtListingIds().has(String(l.id)) || l.backendStatus === 'RESERVED' || l.backendStatus === 'SOLD' || l.status === 'reserved' || l.status === 'sold') {
        return false;
      }
      return l.backendStatus === 'ACTIVE' || l.status === 'active';
    }
    if (filterStatus === 'reserved') {
      return getBoughtListingIds().has(String(l.id)) || l.backendStatus === 'RESERVED' || l.status === 'reserved';
    }
    return l.status === filterStatus;
  });

  const totalEarnings = currentUser?.walletBalanceVnd ?? currentUser?.walletBalance ?? 0;
  const pendingEscrow = currentUser?.escrowLockedVnd ?? 0;

  const handleRequestPayout = () => {
    setIsPayoutModalOpen(false);
    setPayoutSuccessMsg(
      lang === 'vi'
        ? `Đã gửi lệnh rút ${formatVND(payoutAmount)} về tài khoản ${accountHolder} (${bankName.split('-')[0]}). Tiền sẽ về tài khoản trong 1-3 phút!`
        : `Withdrawal request for ${formatVND(payoutAmount)} sent to ${accountHolder} (${bankName.split('-')[0]}). Funds will arrive in 1-3 minutes!`
    );
    setTimeout(() => setPayoutSuccessMsg(null), 6000);
  };

  return (
    <div className="space-y-8 pb-16 text-[#24263e]">
      {/* eKYC Verification Status Banner */}
      {myVerification && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
          myVerification.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          myVerification.status === 'NEEDS_REVIEW' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          myVerification.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-50 border-orange-200 text-orange-950' :
          myVerification.status === 'REJECTED' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-3">
            {myVerification.status === 'APPROVED' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : myVerification.status === 'NEEDS_REVIEW' ? (
              <Clock className="w-6 h-6 text-amber-600 shrink-0" />
            ) : myVerification.status === 'RESUBMIT_REQUIRED' ? (
              <AlertCircle className="w-6 h-6 text-orange-600 shrink-0" />
            ) : myVerification.status === 'REJECTED' ? (
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-600 shrink-0 animate-spin" />
            )}
            <div>
              <div className="font-bold text-sm">
                {myVerification.status === 'APPROVED' && (lang === 'vi' ? 'Xác thực thành công! Tài khoản người bán đã kích hoạt.' : 'eKYC Verified! Seller account active.')}
                {myVerification.status === 'NEEDS_REVIEW' && (lang === 'vi' ? 'Đang chờ Quản trị viên duyệt' : 'Pending Admin Review')}
                {(myVerification.status === 'EKYC_PENDING' || myVerification.status === 'SUBMITTED' || myVerification.status === 'PENDING') && (lang === 'vi' ? 'Đang đối soát eKYC' : 'eKYC Verification In Progress')}
                {myVerification.status === 'RESUBMIT_REQUIRED' && (lang === 'vi' ? 'Cần chụp lại ảnh' : 'Resubmission Required')}
                {myVerification.status === 'REJECTED' && (lang === 'vi' ? 'Hồ sơ bị từ chối' : 'Verification Rejected')}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed">
                {myVerification.status === 'APPROVED' && (
                  <span>{lang === 'vi' ? 'Tất cả các tin đăng của bạn sẽ hiển thị huy hiệu Người Bán Uy Tín & Đã Kiểm Định.' : 'All your listings will display the Verified Seller badge.'}</span>
                )}
                {myVerification.status === 'NEEDS_REVIEW' && (
                  <span>{lang === 'vi' ? `Hồ sơ đang được chuyên viên thẩm định thủ công trong 24h. Mã CCCD: ${myVerification.documentNumber}` : `Application is under manual review within 24h. ID: ${myVerification.documentNumber}`}</span>
                )}
                {(myVerification.status === 'EKYC_PENDING' || myVerification.status === 'SUBMITTED' || myVerification.status === 'PENDING') && (
                  <span>{lang === 'vi' ? 'Hệ thống đang kết nối đối soát dữ liệu eKYC tự động. Vui lòng đợi trong giây lát...' : 'Connecting to automated eKYC system...'}</span>
                )}
                {myVerification.status === 'RESUBMIT_REQUIRED' && (
                  <span>{lang === 'vi' ? 'Lý do từ chối tạm thời: ' : 'Reason: '}<strong>{myVerification.rejectionReason || (lang === 'vi' ? 'Ảnh mờ hoặc bị chói sáng.' : 'Photos are blurry or glare.')}</strong></span>
                )}
                {myVerification.status === 'REJECTED' && (
                  <span>{lang === 'vi' ? 'Lý do từ chối: ' : 'Reason: '}<strong>{myVerification.rejectionReason || (lang === 'vi' ? 'Thông tin không hợp lệ.' : 'Information is invalid.')}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleOpenVerificationHistory}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs border border-slate-200"
              title="Xem lịch sử các lần nộp hồ sơ eKYC"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Lịch Sử eKYC' : 'eKYC History'}</span>
            </button>

            {myVerification.status === 'RESUBMIT_REQUIRED' && (
              <button
                type="button"
                onClick={() => setIsResubmitModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Chụp / Nộp Lại Ảnh' : 'Resubmit Photos'}</span>
              </button>
            )}

            {myVerification.status === 'REJECTED' && (
              <button
                type="button"
                onClick={() => setIsResubmitModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Tạo Hồ Sơ Xác Thực Mới' : 'Create New Verification'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {resubmitMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <span>{resubmitMsg}</span>
          <button onClick={() => setResubmitMsg(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#24263e]/15 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                alt="Seller Avatar"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#24263e]/20 shadow-md"
              />
              <div
                className="absolute -bottom-1 -right-1 bg-[#24263e] text-white p-1 rounded-full text-xs shadow-xs"
                title={lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#24263e]">
                  {currentUser?.name || currentUser?.email?.split('@')[0] || 'Người Bán SecondLife'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 border border-[#24263e]/15 text-[#24263e] text-[11px] font-bold shadow-xs">
                  <CheckCircle2 className={`w-3 h-3 ${myVerification?.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'}`} />
                  {myVerification?.status === 'APPROVED' ? (lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified') : (lang === 'vi' ? 'Chưa xác minh eKYC' : 'Unverified')}
                </span>
                <button
                  type="button"
                  onClick={handleOpenReputationHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-black shadow-xs transition cursor-pointer"
                  title="Bấm để xem lịch sử biến động điểm uy tín"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {myReputation?.score !== undefined && myReputation?.score !== null
                      ? `${myReputation.score} Điểm Uy Tín`
                      : currentUser?.trustScore
                      ? `${currentUser.trustScore} Điểm Uy Tín`
                      : '100 Điểm Uy Tín'}
                  </span>
                  <History className="w-3 h-3 text-slate-300 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenVerificationHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 hover:bg-white text-[#24263e] text-[11px] font-black shadow-xs transition cursor-pointer border border-[#24263e]/15"
                  title="Bấm để xem lịch sử nộp hồ sơ eKYC"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{lang === 'vi' ? 'Lịch Sử eKYC' : 'eKYC History'}</span>
                </button>
              </div>
              <p className="text-xs text-[#24263e]/80 mt-1 flex items-center gap-3 font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-[#24263e] font-bold">
                  <Star className="w-3.5 h-3.5 fill-[#c34c36] text-[#c34c36]" />
                  {currentUser?.sellerRating ? `${currentUser.sellerRating.toFixed(1)} / 5.0` : '5.0 / 5.0'}
                </span>
                <span>•</span>
                <span>{filteredListings.filter((l) => l.status === 'sold').length} {lang === 'vi' ? 'đơn hoàn thành' : 'completed orders'}</span>
                <span>•</span>
                <span>{lang === 'vi' ? 'Tỷ lệ phản hồi 100%' : '100% response rate'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onCreateListing()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white font-black text-xs shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Đăng Bán Đồ Gia Dụng Mới (AI)' : 'Post New Appliance (AI)'}</span>
            </button>
            <button
              onClick={() => setIsSellerReviewsOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>{lang === 'vi' ? 'Xem Đánh Giá Của Khách Hàng (48)' : 'Customer Reviews (48)'}</span>
            </button>
            {onViewOrders && (
              <button
                onClick={onViewOrders}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
              >
                <Clock className="w-4 h-4 text-emerald-800" />
                <span>{lang === 'vi' ? 'Quản Lý Đơn Bán Hàng' : 'Manage Sales Orders'}</span>
              </button>
            )}
            <button
              onClick={() => setIsPayoutModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Wallet className="w-4 h-4 text-[#24263e]" />
              <span>{lang === 'vi' ? 'Rút Tiền Ví Doanh Thu' : 'Withdraw Revenue'}</span>
            </button>
          </div>
        </div>

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#24263e]/15">
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Số dư ví khả dụng' : 'Available wallet balance'}</span>
              <Wallet className="w-4 h-4 text-[#24263e]" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              {formatVND(totalEarnings)}
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Có thể rút về Ngân hàng ngay' : 'Can withdraw to bank immediately'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Đang đóng băng Escrow' : 'Held in Escrow'}</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              {formatVND(pendingEscrow)}
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Giải ngân sau khi Buyer nhận hàng' : 'Released after buyer confirms delivery'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Điểm Tín Dụng (Credits)' : 'Active Credits'}</span>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black text-[#24263e]">
                {creditBalance ? creditBalance.postCredits : (currentUser as any)?.postCredits ?? 0}
              </span>
              <span className="text-xs font-bold text-slate-500">Đăng tin</span>
              <span className="text-slate-300">•</span>
              <span className="text-lg font-black text-emerald-600">
                {creditBalance ? creditBalance.valuationCredits : (currentUser as any)?.valuationCredits ?? 0}
              </span>
              <span className="text-xs font-bold text-slate-500">Định giá</span>
              <span className="text-slate-300">•</span>
              <span className="text-lg font-black text-blue-600">
                {creditBalance ? creditBalance.chatCredits : (currentUser as any)?.chatCredits ?? 0}
              </span>
              <span className="text-xs font-bold text-slate-500">Chat AI</span>
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleOpenCreditLedger}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
              >
                <History className="w-3 h-3" />
                <span>Xem sổ cái điểm</span>
              </button>
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-2xl p-4 border border-gray-200 shadow-sm space-y-1">
            <div className="text-xs text-[#24263e]/70 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Tỷ lệ Pass Kiểm Định Hub' : 'Hub Inspection Pass Rate'}</span>
              <TrendingUp className="w-4 h-4 text-[#c34c36]" />
            </div>
            <div className="text-2xl font-black text-[#24263e]">
              96.8%
            </div>
            <div className="text-[11px] text-[#24263e]/60">
              {lang === 'vi' ? 'Chỉ số uy tín tin đăng cao' : 'High listing trust score'}
            </div>
          </div>
        </div>
      </div>

      {payoutSuccessMsg && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-200 shadow-md flex items-center gap-3 animate-fadeIn font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs">{payoutSuccessMsg}</span>
        </div>
      )}

      {/* Seller Listings Management */}
      <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#24263e]" />
              <span>
                {lang === 'vi'
                  ? `Quản Lý Tin Đăng Cá Nhân (${filteredListings.length})`
                  : `My Listings Management (${filteredListings.length})`}
              </span>
            </h2>
            <p className="text-xs text-[#24263e]/70 mt-0.5">
              {lang === 'vi'
                ? 'Quản lý trạng thái niêm yết, theo dõi phản hồi đề xuất giá từ người mua và cập nhật thông tin.'
                : 'Manage listing status, monitor buyer price offers, and update item details.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={fetchSellerData}
              disabled={isLoadingPosts}
              className="p-1.5 px-2.5 rounded-xl border border-gray-200 bg-[#faf8f5] hover:bg-gray-100 text-[#24263e] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title={lang === 'vi' ? 'Làm mới dữ liệu từ server' : 'Refresh server data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-[#faf8f5] p-1 rounded-xl border border-gray-200">
              {(['ALL', 'active', 'draft', 'pending', 'rejected', 'reserved', 'sold'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer ${
                    filterStatus === st ? 'bg-[#24263e] text-white font-bold' : 'text-[#24263e]/70 hover:text-[#24263e] font-medium'
                  }`}
                >
                  {st === 'ALL'
                    ? (lang === 'vi' ? 'Tất cả' : 'All')
                    : st === 'active'
                    ? (lang === 'vi' ? 'Đang bán' : 'Active')
                    : st === 'draft'
                    ? (lang === 'vi' ? 'Bản nháp' : 'Drafts')
                    : st === 'pending'
                    ? (lang === 'vi' ? 'Chờ duyệt / Hub' : 'Pending')
                    : st === 'rejected'
                    ? (lang === 'vi' ? 'Bị từ chối' : 'Rejected')
                    : st === 'reserved'
                    ? (lang === 'vi' ? 'Đang giữ hàng' : 'Reserved')
                    : (lang === 'vi' ? 'Đã bán' : 'Sold')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 hover:border-[#c34c36] transition shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div className="flex gap-3">
                <img
                  src={item.photos.front}
                  alt={item.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-[#FFFFFF]"
                />
                <div className="space-y-1 overflow-hidden flex-1">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.backendStatus === 'REJECTED'
                      ? 'bg-rose-600 text-white'
                      : item.backendStatus === 'PENDING' || item.backendStatus === 'PENDING_INSPECTION'
                      ? 'bg-amber-500 text-white'
                      : item.backendStatus === 'DRAFT' || item.status === 'draft'
                      ? 'bg-slate-500 text-white'
                      : item.status === 'active'
                      ? 'bg-[#24263e] text-white'
                      : 'bg-[#c34c36] text-white'
                  }`}>
                    {item.backendStatus === 'REJECTED'
                      ? (lang === 'vi' ? '● Bị Từ Chối' : '● Rejected')
                      : item.backendStatus === 'PENDING' || item.backendStatus === 'PENDING_INSPECTION'
                      ? (lang === 'vi' ? '● Chờ Duyệt / Hub' : '● Pending Review')
                      : item.backendStatus === 'DRAFT' || item.status === 'draft'
                      ? (lang === 'vi' ? '● Bản Nháp' : '● Draft')
                      : item.status === 'active'
                      ? (lang === 'vi' ? '● Đang Niêm Yết' : '● Active')
                      : (lang === 'vi' ? '● Đã Cọc Ký Quỹ' : '● Escrow Deposited')}
                  </span>
                  {item.backendStatus === 'REJECTED' && item.rejectionReason && (
                    <div className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200 mt-1 leading-snug">
                      <span className="font-bold">{lang === 'vi' ? 'Lý do: ' : 'Reason: '}</span>
                      <span>{item.rejectionReason}</span>
                    </div>
                  )}
                  <h3 className="font-bold text-xs text-[#24263e] truncate" title={item.title}>
                    {item.title}
                  </h3>
                  <div className="text-sm font-extrabold text-[#24263e]">
                    {formatVND(item.priceVnd)}
                  </div>
                  <div className="text-[11px] text-[#24263e]/70 flex items-center justify-between">
                    <span>
                      {lang === 'vi' ? 'Độ mới: ' : 'Grade: '}
                      <span className="font-semibold text-[#24263e]">{item.conditionGrade}</span>
                    </span>
                    <span className="truncate max-w-[130px] text-slate-500 font-medium" title={item.sellerAddress || item.location}>
                      📍 {item.location || item.sellerAddress || 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectListing(item)}
                  className="flex-1 py-1.5 px-2 bg-[#24263e] hover:bg-black border border-[#24263e] rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Xem Chi Tiết' : 'View Details'}</span>
                </button>
                <button
                  onClick={() => onCreateListing(item)}
                  className="py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#faf8f5] border border-gray-200 text-[#24263e] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  title={
                    item.backendStatus === 'DRAFT' || item.status === 'draft'
                      ? (lang === 'vi' ? 'Tiếp tục soạn bản nháp' : 'Resume draft')
                      : (lang === 'vi' ? 'Sửa tin đăng' : 'Edit listing')
                  }
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#24263e]" />
                </button>
                {(item.backendStatus === 'DRAFT' || item.status === 'draft') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraftToDelete({ id: item.id, title: item.title });
                    }}
                    disabled={deletingDraftId === item.id}
                    className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-50"
                    title={lang === 'vi' ? 'Xóa bản nháp này' : 'Delete draft'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout / Withdrawal Modal */}
      <WithdrawalModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        availableBalance={sellerWalletBalance || totalEarnings}
        initialBankName={bankName}
        initialAccountNumber={accountNumber}
        initialAccountHolder={accountHolder}
        onSuccess={() => {
          fetchSellerData();
          setPayoutSuccessMsg(lang === 'vi' ? 'Đã tạo yêu cầu rút tiền thành công!' : 'Withdrawal request created successfully!');
          setTimeout(() => setPayoutSuccessMsg(null), 5000);
        }}
      />

      {/* ======================================================== */}
      {/* MODAL: RESUBMIT eKYC VERIFICATION                         */}
      {/* ======================================================== */}
      {isResubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Nộp Lại Hồ Sơ Xác Minh Định Danh (eKYC)
                </h3>
              </div>
              <button
                onClick={() => setIsResubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResubmit} className="space-y-4 text-xs">
              {myVerification?.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <strong className="block font-bold">Lý do từ chối trước đó:</strong>
                  <p className="mt-0.5">{myVerification.rejectionReason}</p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Số Căn Cước Công Dân (CCCD):</label>
                <input
                  type="text"
                  required
                  value={resubmitDocNum}
                  onChange={(e) => setResubmitDocNum(e.target.value)}
                  placeholder="Nhập 12 số CCCD"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-rose-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Front Image Upload */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold text-[11px]">Ảnh CCCD Mặt Trước *</label>
                  <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                    {resubmitFrontUrl ? (
                      <div className="relative group">
                        <img src={resubmitFrontUrl} alt="CCCD Mặt trước" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setResubmitFrontUrl('')}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-3 space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh mặt trước</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'front')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Back Image Upload */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold text-[11px]">Ảnh CCCD Mặt Sau *</label>
                  <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                    {resubmitBackUrl ? (
                      <div className="relative group">
                        <img src={resubmitBackUrl} alt="CCCD Mặt sau" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setResubmitBackUrl('')}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-3 space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh mặt sau</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'back')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Selfie Image Upload */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold text-[11px]">Ảnh Chân Dung Selfie (Tùy chọn)</label>
                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition">
                  {resubmitSelfieUrl ? (
                    <div className="relative group">
                      <img src={resubmitSelfieUrl} alt="Selfie" className="h-28 w-32 object-cover rounded-lg mx-auto" />
                      <button
                        type="button"
                        onClick={() => setResubmitSelfieUrl('')}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2 space-y-1">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                      <span className="text-[11px] text-slate-500 font-medium block">Tải ảnh chân dung khuôn mặt</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'selfie')}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !resubmitDocNum || !resubmitFrontUrl || !resubmitBackUrl}
                  className="px-5 py-2 rounded-xl bg-[#24263e] hover:bg-black disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {isUploading ? 'Đang Tải / Đang Xử Lý...' : 'Cập Nhật & Nộp Lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Reviews Modal */}
      {isSellerReviewsOpen && (
        <SellerReviewsModal
          sellerId="user-tuan-hcm"
          sellerName="Nguyễn Minh Tuấn"
          isOpen={isSellerReviewsOpen}
          onClose={() => setIsSellerReviewsOpen(false)}
          lang={lang}
        />
      )}

      {/* Credit Ledger Modal */}
      {isCreditLedgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900">
                  Quản Lý Tín Dụng & Lịch Sử Nạp (Seller Credits)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditLedgerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setCreditModalTab('ledger')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  creditModalTab === 'ledger'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Sổ Cái Biến Động ({creditLedgerItems.length})
              </button>
              <button
                onClick={() => setCreditModalTab('purchases')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  creditModalTab === 'purchases'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Lịch Sử Đơn Mua ({creditPurchases.length})
              </button>
              <button
                onClick={() => setCreditModalTab('buy')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  creditModalTab === 'buy'
                    ? 'bg-[#c34c36] text-white shadow-xs'
                    : 'text-[#c34c36] hover:bg-rose-50'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Mua Thêm Tín Dụng</span>
              </button>
            </div>

            {isLoadingLedger ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Đang tải lịch sử giao dịch credit...</span>
              </div>
            ) : creditModalTab === 'ledger' ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Loại Credit</th>
                      <th className="py-2.5 px-3">Nghiệp vụ</th>
                      <th className="py-2.5 px-3 text-right">Biến động</th>
                      <th className="py-2.5 px-3 text-right">Số dư sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creditLedgerItems.length > 0 ? (
                      creditLedgerItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.creditType === 'LISTING'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {item.creditType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.entryType === 'PURCHASE' ? 'Nạp gói Credit' :
                             item.entryType === 'CONSUMPTION' ? 'Tiêu trừ dịch vụ' :
                             item.entryType === 'REFUND' ? 'Hoàn trả điểm' : item.entryType}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                            item.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {item.quantityDelta > 0 ? `+${item.quantityDelta}` : item.quantityDelta}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.balanceAfter}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có lịch sử giao dịch credit nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : creditModalTab === 'purchases' ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-3">Mã đơn mua</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3 text-center">Gói mua</th>
                      <th className="py-2.5 px-3 text-right">Tổng tiền</th>
                      <th className="py-2.5 px-3 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creditPurchases.length > 0 ? (
                      creditPurchases.map((purchase, idx) => (
                        <tr key={purchase.id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-[11px]">
                            #{purchase.id.slice(0, 8)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {purchase.createdAt ? new Date(purchase.createdAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-slate-700 font-bold">
                              {purchase.snapshot?.listingQuantity || 0} tin • {purchase.snapshot?.valuationQuantity || 0} định giá
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-[#c34c36]">
                            {formatVND(purchase.snapshot?.finalFee || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              purchase.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : purchase.status === 'FAILED' || purchase.status === 'EXPIRED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {purchase.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có đơn hàng mua tín dụng nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Gói Tin Đăng */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">Lượt Đăng Bài (Listing)</span>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setBuyListingQty((q) => Math.max(1, q - 5))}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-base text-slate-900">{buyListingQty}</span>
                      <button
                        type="button"
                        onClick={() => setBuyListingQty((q) => q + 5)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex gap-1 justify-center">
                      {[5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBuyListingQty(num)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            buyListingQty === num ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gói Định Giá AI */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">Định Giá AI (Valuation)</span>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setBuyValuationQty((q) => Math.max(0, q - 5))}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-base text-slate-900">{buyValuationQty}</span>
                      <button
                        type="button"
                        onClick={() => setBuyValuationQty((q) => q + 5)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex gap-1 justify-center">
                      {[0, 5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBuyValuationQty(num)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            buyValuationQty === num ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gói AI Chat */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">Trợ Lý AI Chat</span>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setBuyChatQty((q) => Math.max(0, q - 5))}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-base text-slate-900">{buyChatQty}</span>
                      <button
                        type="button"
                        onClick={() => setBuyChatQty((q) => q + 5)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex gap-1 justify-center">
                      {[0, 5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBuyChatQty(num)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            buyChatQty === num ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bảng tạm tính */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Đơn giá niêm yết:</span>
                    <span className="font-mono">
                      {formatVND(
                        calculatedPricing?.quote?.totalBaseFee ||
                          buyListingQty * 5000 + buyValuationQty * 5000 + buyChatQty * 2000
                      )}
                    </span>
                  </div>
                  {calculatedPricing?.quote?.discountAmount ? (
                    <div className="flex justify-between items-center text-emerald-700 font-bold">
                      <span>Chiết khấu ưu đãi:</span>
                      <span className="font-mono">-{formatVND(calculatedPricing.quote.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center pt-2 border-t border-amber-200/80 font-black text-sm text-[#c34c36]">
                    <span>Tổng thanh toán:</span>
                    <span className="font-mono text-base">
                      {formatVND(
                        calculatedPricing?.quote?.finalFee ||
                          buyListingQty * 5000 + buyValuationQty * 5000 + buyChatQty * 2000
                      )}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateCreditPurchase}
                  disabled={isSubmittingPurchase || (buyListingQty <= 0 && buyValuationQty <= 0 && buyChatQty <= 0)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {isSubmittingPurchase ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo đơn mua...</span>
                    </>
                  ) : (
                    <span>Xác Nhận Tạo Đơn Mua Tín Dụng</span>
                  )}
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreditLedgerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Beautiful Confirmation Modal for Draft Deletion */}
      {draftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 flex flex-col items-center text-center animate-scaleUp">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 ring-8 ring-rose-50/50 shadow-inner">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-2">
              {lang === 'vi' ? 'Xác nhận xóa bản nháp' : 'Confirm Draft Deletion'}
            </h3>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {lang === 'vi'
                ? `Bạn có chắc chắn muốn xóa bản nháp "${draftToDelete.title || 'bài đăng'}" không? Thao tác này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.`
                : `Are you sure you want to delete draft "${draftToDelete.title || 'post'}"? This action is permanent and cannot be undone.`}
            </p>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setDraftToDelete(null)}
                disabled={deletingDraftId !== null}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={executeDeleteDraft}
                disabled={deletingDraftId !== null}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs shadow-md shadow-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deletingDraftId !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                <span>{lang === 'vi' ? 'Xóa vĩnh viễn' : 'Delete Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lịch Sử Điểm Uy Tín Người Bán (GET /api/v1/seller/reputation/me/history) */}
      {isReputationHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl text-[#24263e]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    {lang === 'vi' ? 'Hồ Sơ & Lịch Sử Điểm Uy Tín' : 'Seller Reputation & Trust Score History'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'vi' ? 'Đánh giá độ tin cậy dựa trên chất lượng đóng gói và thời gian giao hàng' : 'Trust metrics based on fulfillment quality and promptness'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReputationHistoryOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reputation Overview Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Điểm Hiện Tại</span>
                <span className="text-xl font-black text-[#c34c36] font-mono">
                  {myReputation?.score ?? 100}/100
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Đơn Hàng Tốt</span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  {myReputation?.goodTransactions ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">Trễ Hạn Bàn Giao</span>
                <span className="text-xl font-black text-amber-700 font-mono">
                  {myReputation?.lateHandoverOrders ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[10px] text-rose-800 font-bold block uppercase tracking-wider">Sự Cố Vi Phạm</span>
                <span className="text-xl font-black text-rose-700 font-mono">
                  {myReputation?.confirmedIncidents ?? 0}
                </span>
              </div>
            </div>

            {/* History Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                {lang === 'vi' ? 'Nhật Ký Biến Động Điểm (Mới nhất)' : 'Score Audit Trail'}
              </span>

              {isLoadingReputationHistory ? (
                <div className="py-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#c34c36]" />
                  <span className="text-xs">{lang === 'vi' ? 'Đang tải lịch sử...' : 'Loading history...'}</span>
                </div>
              ) : reputationHistoryItems.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <span className="text-xs font-bold text-slate-600 block">
                    {lang === 'vi' ? 'Chưa có biến động điểm nào' : 'No reputation score changes yet'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {lang === 'vi' ? 'Tài khoản của bạn giữ trọn vẹn 100 điểm uy tín khởi tạo.' : 'Your account maintains full 100 starting trust score.'}
                  </span>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
                  {reputationHistoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                            {item.eventType}
                          </span>
                          <span className="text-slate-600">{item.reason || 'Biến động theo đơn hàng'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      <div className="text-right shrink-0 font-mono font-bold">
                        {item.scoreBefore !== undefined && item.scoreAfter !== undefined && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400">{item.scoreBefore}</span>
                            <span className="text-slate-400">→</span>
                            <span className={item.scoreAfter >= (item.scoreBefore || 0) ? 'text-emerald-600' : 'text-rose-600'}>
                              {item.scoreAfter}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReputationHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lịch Sử Nộp eKYC (GET /api/v1/seller-verifications/me/history & /status/{status}) */}
      {isVerificationHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl text-[#24263e] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    {lang === 'vi' ? 'Lịch Sử Nộp Hồ Sơ Xác Minh eKYC' : 'Seller eKYC Verification History'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'vi'
                      ? 'Theo dõi toàn bộ lịch sử gửi hồ sơ định danh, đối soát VNPT eKYC và phê duyệt của hệ thống'
                      : 'Track all identity submissions, VNPT eKYC automated checks, and admin approvals'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVerificationHistoryOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 text-xs font-bold">
              {[
                { id: 'ALL', label: lang === 'vi' ? 'Tất Cả' : 'All' },
                { id: 'APPROVED', label: lang === 'vi' ? 'Đã Duyệt' : 'Approved' },
                { id: 'NEEDS_REVIEW', label: lang === 'vi' ? 'Chờ Thẩm Định' : 'Pending' },
                { id: 'RESUBMIT_REQUIRED', label: lang === 'vi' ? 'Yêu Cầu Nộp Lại' : 'Resubmit' },
                { id: 'REJECTED', label: lang === 'vi' ? 'Bị Từ Chối' : 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleFilterVerificationStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                    verificationFilterStatus === tab.id
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingVerificationHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                  <span className="text-xs">{lang === 'vi' ? 'Đang truy xuất hồ sơ eKYC...' : 'Loading eKYC records...'}</span>
                </div>
              ) : verificationHistoryList.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-600 block">
                    {lang === 'vi' ? 'Không tìm thấy hồ sơ nào phù hợp' : 'No verification records found'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {lang === 'vi'
                      ? 'Bạn chưa có hồ sơ xác minh nào trong danh mục trạng thái này.'
                      : 'You do not have any verification records under this filter.'}
                  </span>
                </div>
              ) : (
                verificationHistoryList.map((item, idx) => {
                  const statusInfo = getVerificationStatusInfo(item.status);
                  const StatusIcon = statusInfo.icon;
                  const maskedNumber =
                    item.documentNumberMasked ||
                    (item.documentNumber
                      ? item.documentNumber.length > 6
                        ? item.documentNumber.slice(0, 3) + '******' + item.documentNumber.slice(-3)
                        : item.documentNumber
                      : 'N/A');

                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-3 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${statusInfo.bg}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{statusInfo.label}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {item.verificationType === 'CITIZEN_ID'
                              ? (lang === 'vi' ? 'Căn cước công dân (CCCD)' : 'Citizen ID Card')
                              : (lang === 'vi' ? 'Hộ chiếu (Passport)' : 'Passport')}
                          </span>
                          {item.resubmissionCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {lang === 'vi' ? `Lần nộp ${item.resubmissionCount + 1}` : `Attempt #${item.resubmissionCount + 1}`}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.submittedAt
                            ? new Date(item.submittedAt).toLocaleString('vi-VN')
                            : item.reviewedAt
                            ? new Date(item.reviewedAt).toLocaleString('vi-VN')
                            : ''}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 text-[11px] block">Số định danh giấy tờ:</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">{maskedNumber}</span>
                        </div>

                        {(item.faceMatchScore !== undefined || item.livenessScore !== undefined) && (
                          <div>
                            <span className="text-slate-400 text-[11px] block">Độ khớp khuôn mặt & Liveness (AI):</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.faceMatchScore !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[11px]">
                                  Match: {Math.round(item.faceMatchScore * 100)}%
                                </span>
                              )}
                              {item.livenessScore !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[11px]">
                                  Liveness: {Math.round(item.livenessScore * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reason if rejected or needs resubmit */}
                      {(item.rejectionReason || item.reasonCodeDescription) && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                          <span className="font-bold block mb-0.5">
                            {lang === 'vi' ? 'Ghi chú thẩm định / Lý do:' : 'Review Note / Reason:'}
                          </span>
                          <span>{item.rejectionReason || item.reasonCodeDescription}</span>
                        </div>
                      )}

                      {/* Attached images toggle or preview */}
                      <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedVerificationPreview(
                              selectedVerificationPreview?.id === item.id ? null : item
                            )
                          }
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {selectedVerificationPreview?.id === item.id
                              ? (lang === 'vi' ? 'Thu gọn ảnh giấy tờ' : 'Hide documents')
                              : (lang === 'vi' ? 'Xem ảnh giấy tờ đã gửi' : 'View submitted documents')}
                          </span>
                        </button>

                        {(item.status === 'RESUBMIT_REQUIRED' || item.status === 'REJECTED') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsVerificationHistoryOpen(false);
                              setIsResubmitModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Nộp Lại Ngay' : 'Resubmit Now'}</span>
                          </button>
                        )}
                      </div>

                      {/* Photo preview drawer */}
                      {selectedVerificationPreview?.id === item.id && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 mt-2">
                          {item.documentFrontUrl && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block mb-1">Mặt trước CCCD:</span>
                              <img
                                src={item.documentFrontUrl}
                                alt="CCCD Front"
                                className="w-full h-28 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                          {item.documentBackUrl && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block mb-1">Mặt sau CCCD:</span>
                              <img
                                src={item.documentBackUrl}
                                alt="CCCD Back"
                                className="w-full h-28 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                          {item.selfieUrl && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block mb-1">Ảnh selfie chân dung:</span>
                              <img
                                src={item.selfieUrl}
                                alt="Selfie"
                                className="w-full h-28 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                {lang === 'vi'
                  ? `Tổng số: ${verificationHistoryList.length} hồ sơ`
                  : `Total: ${verificationHistoryList.length} records`}
              </span>
              <button
                type="button"
                onClick={() => setIsVerificationHistoryOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Toast Notification */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${
            toastNotice.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200/50'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-200/50'
          }`}>
            {toastNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toastNotice.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

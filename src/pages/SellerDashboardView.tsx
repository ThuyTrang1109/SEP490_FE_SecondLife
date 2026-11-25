import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Wallet,
  CheckCircle2,
  Clock,
  Tag,
  Eye,
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
  FileText,
  Sliders,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Package
} from 'lucide-react';
import { Listing, Language, UserProfile, ItemBackend, EscrowOrder } from '../types';
import { itemService } from '../services/itemService';
import { formatConditionGrade, formatVND } from '../utils/translations';
import { getSortablePostTimestamp } from '../utils/orderUtils';
import { sellerService, SellerVerificationResponseDto } from '../services/sellerService';
import { sellerCreditService, CreditBalanceResponseDto } from '../services/sellerCreditService';
import { mediaService } from '../services/mediaService';
import { postService } from '../services/postService';
import { walletService } from '../services/walletService';
import { reputationService, SellerReputationDto, ReputationHistoryDto, getAssessmentStatusMeta, getReputationWarningMeta, getReputationEventMeta, formatReputationReason, formatFormulaVersion } from '../services/reputationService';
import { reviewService } from '../data/mockReviews';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { WithdrawalModal } from '../components/modals/WithdrawalModal';
import { extractWardAndCity, cleanFullAddress } from '../utils/addressUtils';
import { dialogService } from '../utils/dialogService';
import { resolveCategoryAndItem } from '../utils/catalogCache';
import {
  isListingInspectionPassed,
  getListingInspectionBadgeText,
  resolveSellerListingInspectionState,
} from '../utils/listingInspection';
import { UserAvatar } from '../components/common/UserAvatar';
import { PreListingInspectionWorkflow } from '../components/listing/PreListingInspectionWorkflow';
import { SellerListingEditActions } from '../components/listing/SellerListingEditActions';
import { ListingShippingPackageModal } from '../components/listing/ListingShippingPackageModal';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { getSellerPreListingInspections, hasPreListingInspectionResult } from '../services/orderFeedService';
import { inspectorService, type InspectionOrderDto } from '../services/inspectorService';
import { notificationWsClient } from '../services/notificationWsClient';
import { getPreListingHomeAppointmentStage } from '../utils/inspectionTaskStatus';
import { formatInspectionFailureReason } from '../utils/inspectionPurchase';
import { getLatestInboundShipment } from '../utils/inspectionCenterData';
import { getSellerHubShipmentBadge, type SellerHubShipmentSnapshot } from '../utils/sellerHighValueInspection';
import { shippingService, type ShippingParcel } from '../services/shippingService';
import { getPostReturnStatus } from '../utils/orderUtils';
import { userReportService, type SellerOrderDisputeDto } from '../services/userReportService';

interface SellerDashboardViewProps {
  listings: Listing[];
  orders?: EscrowOrder[];
  onSelectListing: (listing: Listing) => void;
  onCreateListing: (draft?: Listing) => void;
  onViewOrders?: () => void;
  lang: Language;
  currentUser?: UserProfile | null;
  onDeleteListing?: (listingId: string) => void;
}

const homeAppointmentLabels = {
  awaiting_schedule: { vi: 'Chờ đặt lịch kiểm định tại nhà', en: 'Awaiting home inspection scheduling' },
  awaiting_center: { vi: 'Chờ trung tâm xác nhận lịch hẹn', en: 'Awaiting center approval of appointment' },
  countered: { vi: 'Trung tâm đề xuất lịch hẹn mới', en: 'Center proposed a new appointment' },
  scheduled: { vi: 'Đã đặt lịch kiểm định tại nhà', en: 'Home inspection scheduled' },
};

const ITEMS_PER_PAGE = 10;

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  listings,
  orders,
  onSelectListing,
  onCreateListing,
  onViewOrders,
  lang,
  currentUser,
  onDeleteListing,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'draft' | 'pending' | 'rejected' | 'reserved' | 'sold'>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sellerDisputes, setSellerDisputes] = useState<SellerOrderDisputeDto[]>([]);
  const [preListingPost, setPreListingPost] = useState<Listing | null>(null);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [resultListing, setResultListing] = useState<Listing | null>(null);
  const [inspectionFeed, setInspectionFeed] = useState<{
    sellerId: string;
    byPost: ReadonlyMap<string, InspectionOrderDto>;
  }>();
  const [inspectionRefresh, setInspectionRefresh] = useState(0);
  const sellerId = currentUser?.id;
  const inspectionByPost = inspectionFeed?.sellerId === sellerId ? inspectionFeed?.byPost : undefined;
  const resultInspection = resultListing ? inspectionByPost?.get(resultListing.id) : undefined;

  useEffect(() => {
    if (!sellerId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void getSellerPreListingInspections(controller.signal)
        .then((byPost) => {
          if (!controller.signal.aborted) setInspectionFeed({ sellerId, byPost });
        })
        .catch(() => { });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sellerId, inspectionRefresh]);

  const showToastNotice = (type: 'success' | 'error', message: string) => {
    setToastNotice({ type, message: translateSystemNotification(message) });
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

  // Credit Balance State
  const [creditBalance, setCreditBalance] = useState<CreditBalanceResponseDto | null>(null);

  // Real Backend Posts State
  const [myServerPosts, setMyServerPosts] = useState<Listing[]>([]);
  const [editingPackagePost, setEditingPackagePost] = useState<Listing | null>(null);

  const handlePackageSaved = (postId: string, parcel: ShippingParcel) => {
    setMyServerPosts((posts) => posts.map((post) => post.id === postId ? {
      ...post,
      shippingWeight: parcel.weight,
      shippingLength: parcel.length,
      shippingWidth: parcel.width,
      shippingHeight: parcel.height,
    } : post));
    setEditingPackagePost(null);
    showToastNotice('success', lang === 'vi' ? 'Đã cập nhật thông tin kiện hàng.' : 'Shipping package updated.');
  };
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Reclassify Item Modal State (chọn lại loại thiết bị khi danh mục tách item)
  const [reclassifyingPost, setReclassifyingPost] = useState<Listing | null>(null);
  const [reclassifyItems, setReclassifyItems] = useState<ItemBackend[]>([]);
  const [selectedReclassifyItemId, setSelectedReclassifyItemId] = useState<string>('');
  const [isLoadingReclassifyItems, setIsLoadingReclassifyItems] = useState(false);
  const [isSubmittingReclassify, setIsSubmittingReclassify] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

  const handleOpenReclassifyModal = async (item: Listing) => {
    setReclassifyingPost(item);
    setReclassifyItems([]);
    setSelectedReclassifyItemId(item.itemId || '');
    setReclassifyError(null);
    setIsLoadingReclassifyItems(true);
    try {
      const itms = await itemService.getItemsByCategory(item.categoryId || '');
      const selectable = itms.filter((item) => item.selectable !== false);
      setReclassifyItems(selectable);
      setSelectedReclassifyItemId(selectable[0]?.id ?? '');
    } catch (err: any) {
      setReclassifyError(err?.message || 'Không thể tải danh sách thiết bị');
    } finally {
      setIsLoadingReclassifyItems(false);
    }
  };

  const handleSubmitReclassify = async () => {
    if (!reclassifyingPost || !selectedReclassifyItemId) return;
    setIsSubmittingReclassify(true);
    setReclassifyError(null);
    try {
      await postService.reclassifyItem(reclassifyingPost.id, selectedReclassifyItemId);
      const chosenItem = reclassifyItems.find((i) => i.id === selectedReclassifyItemId);
      setMyServerPosts((prev) =>
        prev.map((p) => {
          if (p.id === reclassifyingPost.id) {
            return {
              ...p,
              itemId: selectedReclassifyItemId,
              itemName: chosenItem?.name || p.itemName,
              sellerActions: p.sellerActions && { ...p.sellerActions, reclassifyItem: false },
            };
          }
          return p;
        })
      );
      showToastNotice('success', lang === 'vi' ? 'Đã chọn lại loại thiết bị cho bài đăng thành công!' : 'Item reclassified successfully!');
      setReclassifyingPost(null);
    } catch (err: any) {
      console.error('Lỗi khi chọn lại loại thiết bị:', err);
      setReclassifyError(err?.message || (lang === 'vi' ? 'Không thể cập nhật loại thiết bị. Bài đăng có thể đang trong giao dịch.' : 'Failed to update item'));
    } finally {
      setIsSubmittingReclassify(false);
    }
  };

  const [sellerActiveTab, setSellerActiveTab] = useState<'listings' | 'high_value_inspections'>('listings');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('seller_tab') || params.get('tab');
      if (tab === 'high_value_inspections' || tab === 'pre_listing' || tab === 'inspections') {
        setSellerActiveTab('high_value_inspections');
      } else if (tab === 'listings') {
        setSellerActiveTab('listings');
      }

    }
  }, []);

  // Seller Reputation State (GET /api/v1/seller/reputation/me & /history)
  const [myReputation, setMyReputation] = useState<SellerReputationDto | null>(null);

  const sellerReviewCount = useMemo(() => {
    const sellerId = currentUser?.id;
    const directReviews = sellerId ? reviewService.getReviewsBySeller(sellerId).length : 0;
    const evaluatedFromRep = Number(myReputation?.evaluatedOrders ?? 0);
    if (evaluatedFromRep > 0 || directReviews > 0) {
      return Math.max(evaluatedFromRep, directReviews);
    }
    return Number((currentUser as any)?.reviewCount ?? 0);
  }, [currentUser?.id, (currentUser as any)?.reviewCount, myReputation?.evaluatedOrders]);

  const sellerAverageRatingText = useMemo(() => {
    const sellerId = currentUser?.id;
    const directReviews = sellerId ? reviewService.getReviewsBySeller(sellerId) : [];
    if (directReviews.length > 0) {
      const avg = directReviews.reduce((sum, r) => sum + r.rating, 0) / directReviews.length;
      return `${avg.toFixed(1)} / 5.0`;
    }
    const evaluated = Number(myReputation?.evaluatedOrders ?? 0);
    if (evaluated > 0) {
      const txScore =
        myReputation?.transactionScore !== undefined && myReputation?.transactionScore !== null
          ? Number(myReputation.transactionScore)
          : (Number(myReputation?.goodTransactions ?? 0) / evaluated) * 100;
      const starRating = Math.max(0, Math.min(5, txScore / 20));
      return `${starRating.toFixed(1)} / 5.0`;
    }
    if (currentUser?.sellerRating && currentUser.sellerRating > 0) {
      return `${currentUser.sellerRating.toFixed(1)} / 5.0`;
    }
    return lang === 'vi' ? 'Chưa có đánh giá' : 'No ratings yet';
  }, [currentUser?.id, currentUser?.sellerRating, myReputation, lang]);

  const [isReputationHistoryOpen, setIsReputationHistoryOpen] = useState(false);
  const [reputationHistoryItems, setReputationHistoryItems] = useState<ReputationHistoryDto[]>([]);
  const [isLoadingReputationHistory, setIsLoadingReputationHistory] = useState(false);
  const [isReloadingReputation, setIsReloadingReputation] = useState(false);
  const [showViolationWarning, setShowViolationWarning] = useState(true);
  const [showModalViolationWarning, setShowModalViolationWarning] = useState(true);
  const [reputationPage, setReputationPage] = useState(0);
  const REPUTATION_PAGE_SIZE = 10;

  const totalReputationPages = Math.max(1, Math.ceil(reputationHistoryItems.length / REPUTATION_PAGE_SIZE));
  const safeReputationPage = Math.min(reputationPage, totalReputationPages - 1);
  const paginatedReputationItems = useMemo(() => {
    const start = safeReputationPage * REPUTATION_PAGE_SIZE;
    return reputationHistoryItems.slice(start, start + REPUTATION_PAGE_SIZE);
  }, [reputationHistoryItems, safeReputationPage]);

  useEffect(() => {
    if (myReputation?.sellingRestricted || myReputation?.warningCode) {
      setShowViolationWarning(true);
      const timer = setTimeout(() => {
        setShowViolationWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [myReputation?.sellingRestricted, myReputation?.warningCode]);

  useEffect(() => {
    if (isReputationHistoryOpen && (myReputation?.sellingRestricted || myReputation?.warningCode)) {
      setShowModalViolationWarning(true);
      const timer = setTimeout(() => {
        setShowModalViolationWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isReputationHistoryOpen, myReputation?.sellingRestricted, myReputation?.warningCode]);

  const handleRefreshReputation = async () => {
    setIsReloadingReputation(true);
    setReputationPage(0);
    try {
      const [rep, historyRes] = await Promise.all([
        reputationService.getMyReputation(),
        reputationService.getMyReputationHistory(0, 100),
      ]);
      if (rep) setMyReputation(rep);
      setReputationHistoryItems(historyRes.items || []);
    } catch (err) {
      console.warn('Lỗi làm mới dữ liệu uy tín:', err);
    } finally {
      setIsReloadingReputation(false);
    }
  };

  const handleOpenReputationHistory = async () => {
    setIsReputationHistoryOpen(true);
    setIsLoadingReputationHistory(true);
    setReputationPage(0);
    try {
      const [rep, res] = await Promise.all([
        reputationService.getMyReputation(),
        reputationService.getMyReputationHistory(0, 100),
      ]);
      if (rep) setMyReputation(rep);
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
        .catch(() => { });

      sellerCreditService.getCredits()
        .then((bal) => {
          if (bal) setCreditBalance(bal);
        })
        .catch(() => { });

      walletService.getMyWallet()
        .then((w) => {
          if (w) setSellerWalletBalance(Number(w.balance || 0));
        })
        .catch(() => { });

      reputationService.getMyReputation()
        .then((rep) => {
          if (rep) setMyReputation(rep);
        })
        .catch(() => { });

      userReportService.getSellerDisputes(0, 50)
        .then((dispRes) => {
          const items = dispRes?.items || [];
          setSellerDisputes(items);
          try {
            localStorage.setItem('sl_seller_disputes', JSON.stringify(items));
          } catch {}
        })
        .catch(() => { });

      const res = await postService.getMyPosts(0, 50);
      const posts = (res as any)?.items || (res as any)?.data?.items || (res as any)?.content || (res as any)?.data || (Array.isArray(res) ? res : []);
      if (posts && posts.length > 0) {
        const mapped: Listing[] = posts.map((p: any) => {
          const rawImages: string[] = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
            ? p.imageUrls
            : (p.imageUrl ? [p.imageUrl] : []);
          const fallbackImage = 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800';
          const primaryImage = rawImages[0] || fallbackImage;

          const sellerAddr = cleanFullAddress(p.sellerAddress ?? p.pickupAddress ?? p.user?.address ?? '');
          const loc = extractWardAndCity(sellerAddr);

          const isDraft = p.status === 'DRAFT';
          const returnStatus = getPostReturnStatus(p, orders, sellerDisputes);
          const isReturning = Boolean(returnStatus?.isReturning);
          const isReturned = Boolean(returnStatus?.isReturned);
          const isSold = !isReturning && !isReturned && String(p.status || '').toUpperCase() === 'SOLD';
          const isAwaitingInspectionPublication = p.status === 'PENDING_INSPECTION' || p.status === 'READY_TO_PUBLISH';
          const draftTitle = p.title || (isDraft ? 'Bản nháp sản phẩm' : 'Thiết bị gia dụng SecondLife');
          const draftDesc = p.description || p.aiDescription || '';

          const resolved = resolveCategoryAndItem({
            postId: p.id || p.postId,
            categoryId: p.categoryId,
            itemId: p.itemId,
            title: draftTitle,
            description: draftDesc,
            category: p.category,
            brand: p.brand,
            model: p.model,
          });

          return {
            id: p.id || `post-${Date.now()}`,
            categoryId: p.categoryId || resolved.categoryId,
            itemId: p.itemId || resolved.itemId,
            categoryName: resolved.categoryName,
            itemName: resolved.itemName,
            title: draftTitle,
            category: (resolved.displayCategory || 'Đồ gia dụng') as any,
            brand: resolved.brand,
            model: p.model || resolved.model || '',
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
            sellerRating: (() => {
              const sId = p.user?.id || p.userId || currentUser?.id;
              const revs = sId ? reviewService.getReviewsBySeller(sId) : [];
              return revs.length > 0 ? (revs.reduce((sum, r) => sum + r.rating, 0) / revs.length) : 0;
            })(),
            sellerCompletedOrders: 0,
            sellerVerified: true,
            status: isAwaitingInspectionPublication ? 'pending_inspection'
              : isReturning ? 'reserved'
                : isReturned ? 'draft'
                  : isSold ? 'sold'
                    : p.status === 'ACTIVE' ? 'active'
                      : isDraft ? 'draft'
                        : p.status === 'REJECTED' ? 'rejected' : 'reserved',
            backendStatus: isReturning ? 'RETURNING'
              : isReturned ? 'RETURNED'
                : p.status,
            sellerActions: p.sellerActions,
            rejectionReason: p.rejectionReason,
            createdAt: p.createdAt || p.createdDate || p.created_at || p.publishedAt || p.updatedAt || new Date().toISOString(),
            isInspectionGuaranteed: true,
            requiresInspection: Number(p.price || 0) > 5000000,
            isInspected: typeof p.isInspected === 'boolean' ? p.isInspected : undefined,
            inspectionMethod: p.inspectionMethod || p.orderType || undefined,
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
          const timeA = getSortablePostTimestamp(a);
          const timeB = getSortablePostTimestamp(b);
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

  useEffect(() => {
    if (!sellerId) return;
    return notificationWsClient.subscribeListener((notification) => {
      const reference = notification.referenceType?.toUpperCase();
      if (reference === 'INSPECTION_ORDER' || reference === 'SHIPMENT') {
        setInspectionRefresh((previous) => previous + 1);
        void fetchSellerData();
      }
    });
  }, [sellerId, fetchSellerData]);

  const handlePublishInspectedPost = async (item: Listing) => {
    if (publishingPostId || item.backendStatus !== 'READY_TO_PUBLISH') return;
    setPublishingPostId(item.id);
    try {
      const published = await postService.publishInspectedPost(item.id);
      setMyServerPosts((posts) => posts.map((post) => post.id === item.id
        ? { ...post, status: 'active', backendStatus: published.status }
        : post));
      void fetchSellerData();
      showToastNotice('success', lang === 'vi' ? 'Đã đăng bán sản phẩm.' : 'Listing published.');
    } catch (error) {
      showToastNotice('error', error instanceof Error ? error.message : (lang === 'vi' ? 'Không thể đăng bán sản phẩm.' : 'Could not publish the listing.'));
    } finally {
      setPublishingPostId(null);
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
    const listingsById = new Map(listings.map((item) => [item.id, item]));
    const list = myServerPosts.map((post) => {
      const fromApp = listingsById.get(post.id);
      if (!fromApp) return post;
      return {
        ...post,
        isInspected: post.isInspected ?? fromApp.isInspected,
        inspectionMethod: post.inspectionMethod ?? fromApp.inspectionMethod,
      };
    });
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
    // Only show listings that belong to the active seller.
    return list
      .filter(item => {
        const isMine =
          Boolean(currentUser?.id && item.sellerId === currentUser.id) ||
          Boolean(currentUser?.name && item.sellerName?.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
          item.sellerId === 'me';
        return isMine;
      })
      .sort((a, b) => {
        const timeA = getSortablePostTimestamp(a);
        const timeB = getSortablePostTimestamp(b);
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [
    myServerPosts,
    listings,
    currentUser?.id,
    currentUser?.name,
  ]);

  // Đơn hoàn thành thực tế của người bán (đồng bộ từ myReputation.goodTransactions hoặc currentUser)
  const completedOrdersCount = useMemo(() => {
    if (myReputation?.goodTransactions !== undefined && myReputation?.goodTransactions !== null && myReputation.goodTransactions > 0) {
      return myReputation.goodTransactions;
    }
    if (currentUser?.completedOrdersCount !== undefined && currentUser?.completedOrdersCount !== null && currentUser.completedOrdersCount > 0) {
      return currentUser.completedOrdersCount;
    }
    const soldListingsCount = combinedListings.filter((l) =>
      (l.status === 'sold' || (l as any).backendStatus === 'SOLD') &&
      (l as any).backendStatus !== 'RETURNING' &&
      (l as any).backendStatus !== 'RETURNED'
    ).length;
    return soldListingsCount > 0 ? soldListingsCount : (myReputation?.goodTransactions ?? 0);
  }, [myReputation?.goodTransactions, currentUser?.completedOrdersCount, combinedListings]);

  // Ngưỡng giá trị cao bắt buộc kiểm định (mặc định 10.000.000 đ hoặc theo policy)
  const [highValueThreshold, setHighValueThreshold] = useState<number>(10000000);

  useEffect(() => {
    let isMounted = true;
    inspectorService.getHighValueInspectionPolicy()
      .then((policy) => {
        if (isMounted && policy && typeof policy.thresholdPrice === 'number' && policy.thresholdPrice > 0) {
          setHighValueThreshold(policy.thresholdPrice);
        }
      })
      .catch(() => { });
    return () => { isMounted = false; };
  }, []);

  // Kiểm tra bài đăng có thuộc diện Giá Trị Cao / Kiểm Định Trước Đăng hay không
  const isHighValueListing = React.useCallback((l: Listing): boolean => {
    // 1. Đang ở trạng thái PENDING_INSPECTION
    if (l.backendStatus === 'PENDING_INSPECTION' || l.backendStatus === 'READY_TO_PUBLISH') return true;
    // 2. Có bản ghi trong pre-listing inspection feed
    if (Boolean(inspectionByPost?.has(l.id))) return true;
    // 3. Có kết quả kiểm định trước đăng (PASSED / FAILED / REJECTED)
    if (hasPreListingInspectionResult(inspectionByPost?.get(l.id))) return true;
    // 4. Có cờ kiểm định bắt buộc từ backend
    if ((l as any).isMandatoryInspection === true || (l as any).mandatoryInspection === true) return true;
    // 5. Giá bán vượt ngưỡng giá trị cao (highValueThreshold, mặc định 10.000.000 đ)
    const threshold = highValueThreshold > 0 ? highValueThreshold : 10000000;
    if (Number(l.priceVnd || 0) > threshold) return true;
    return false;
  }, [inspectionByPost, highValueThreshold]);

  // Tin đăng thông thường và bản nháp (loại bỏ hoàn toàn các đơn giá trị cao)
  const normalListings = React.useMemo(() => {
    return combinedListings.filter((l) => !isHighValueListing(l));
  }, [combinedListings, isHighValueListing]);

  // Danh sách sản phẩm kiểm định giá trị cao
  const highValueListings = React.useMemo(() => {
    const list: Listing[] = [];
    const seenIds = new Set<string>();

    for (const l of combinedListings) {
      if (isHighValueListing(l)) {
        list.push(l);
        seenIds.add(l.id);
      }
    }

    if (inspectionByPost) {
      inspectionByPost.forEach((insp, pId) => {
        if (!seenIds.has(pId)) {
          list.push({
            id: pId,
            categoryId: (insp as any).categoryId || 'home_appliances',
            itemId: (insp as any).itemId || 'appliance',
            title: insp.postTitle || (lang === 'vi' ? 'Thiết bị kiểm định giá trị cao' : 'High-value inspected device'),
            category: 'Đồ gia dụng' as any,
            brand: 'Khác',
            model: '',
            purchaseYear: 2024,
            priceVnd: insp.postPrice ?? 0,
            conditionGrade: 'Good',
            declaredConditionText: 'Tình trạng tốt',
            description: '',
            location: insp.inspectionCenterAddress || 'Hà Nội',
            sellerAddress: insp.inspectionCenterAddress || 'Hà Nội',
            createdAt: (insp as any).createdAt || new Date().toISOString(),
            status: 'pending_inspection' as any,
            backendStatus: 'PENDING_INSPECTION',
            photos: {
              front: insp.postImageUrls?.[0] || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=800',
              back: insp.postImageUrls?.[1] || '',
              screenOrDetails: '',
              accessoriesOrBox: '',
              serialOrReceipt: '',
              extraDetail: '',
            },
            photoGallery: insp.postImageUrls || [],
            sellerId: currentUser?.id || 'me',
            sellerName: currentUser?.name || 'Tôi',
            sellerRating: 5,
            sellerCompletedOrders: 0,
            sellerVerified: true,
            isInspectionGuaranteed: true,
            requiresInspection: true,
          });
          seenIds.add(pId);
        }
      });
    }

    return list;
  }, [combinedListings, inspectionByPost, lang, currentUser]);

  const [highValueFilter, setHighValueFilter] = useState<'ALL' | 'pending_payment' | 'inspecting' | 'passed' | 'failed'>('ALL');

  const getItemInspectionOrder = React.useCallback((item: Listing): InspectionOrderDto | undefined => {
    return inspectionByPost?.get(item.id);
  }, [inspectionByPost]);

  const getHighValueItemStage = React.useCallback((item: Listing): 'pending_payment' | 'inspecting' | 'passed' | 'failed' => {
    const insp = inspectionByPost?.get(item.id);
    const inspStatus = String(insp?.status || '').toUpperCase();
    if (inspStatus === 'FAILED' || inspStatus === 'REJECTED') return 'failed';
    if (item.backendStatus === 'READY_TO_PUBLISH' || inspStatus === 'PASSED' || inspStatus === 'COMPLETED' || isListingInspectionPassed(item)) {
      return 'passed';
    }
    if (item.backendStatus === 'REJECTED') {
      return 'failed';
    }
    const appointmentStage = getPreListingHomeAppointmentStage(insp);
    if (appointmentStage === 'awaiting_schedule' || appointmentStage === 'countered') return 'pending_payment';
    if (appointmentStage) return 'inspecting';
    if (
      inspStatus === 'CONFIRMED_PENDING_DISPATCH' ||
      inspStatus === 'SCHEDULED' ||
      inspStatus === 'SHIPPING_TO_CENTER' ||
      inspStatus === 'INSPECTING' ||
      inspStatus === 'INSPECTION_IN_PROGRESS' ||
      inspStatus === 'CENTER_HOLDING'
    ) {
      return 'inspecting';
    }
    return 'pending_payment';
  }, [inspectionByPost]);

  const filteredNormalListings = React.useMemo(() => {
    const list = normalListings.filter((l) => {
      if (filterStatus === 'ALL') return true;
      if (filterStatus === 'draft') {
        return l.backendStatus === 'DRAFT' || l.status === 'draft';
      }
      if (filterStatus === 'pending') {
        return (l.backendStatus === 'PENDING' || l.backendStatus === 'PENDING_REVIEW') && l.status !== 'draft';
      }
      if (filterStatus === 'rejected') {
        return l.backendStatus === 'REJECTED';
      }
      if (filterStatus === 'active') return (l.backendStatus === 'ACTIVE' || l.status === 'active') && l.backendStatus !== 'RETURNING' && l.backendStatus !== 'RETURNED';
      if (filterStatus === 'reserved') return l.backendStatus === 'RESERVED' || l.status === 'reserved' || l.backendStatus === 'RETURNING';
      if (filterStatus === 'sold') {
        return (l.backendStatus === 'SOLD' || l.status === 'sold') && l.backendStatus !== 'RETURNING' && l.backendStatus !== 'RETURNED';
      }
      return l.status === filterStatus;
    });

    return [...list].sort((a, b) => {
      const timeA = getSortablePostTimestamp(a);
      const timeB = getSortablePostTimestamp(b);
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
    });
  }, [normalListings, filterStatus, sortOrder]);

  const filteredHighValueListings = React.useMemo(() => {
    const list = highValueListings.filter((l) => {
      if (highValueFilter === 'ALL') return true;
      return getHighValueItemStage(l) === highValueFilter;
    });

    return [...list].sort((a, b) => {
      const timeA = getSortablePostTimestamp(a);
      const timeB = getSortablePostTimestamp(b);
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
    });
  }, [highValueListings, highValueFilter, sortOrder, getHighValueItemStage]);

  const highValueFilterTabs = React.useMemo(() => [
    { key: 'ALL' as const, label: lang === 'vi' ? 'Tất cả' : 'All', count: highValueListings.length },
    { key: 'pending_payment' as const, label: lang === 'vi' ? 'Chờ nộp phí & đặt lịch' : 'Awaiting Fee / Schedule', count: highValueListings.filter(l => getHighValueItemStage(l) === 'pending_payment').length },
    { key: 'inspecting' as const, label: lang === 'vi' ? 'Đang xử lý kiểm định' : 'Inspection in progress', count: highValueListings.filter(l => getHighValueItemStage(l) === 'inspecting').length },
    { key: 'passed' as const, label: lang === 'vi' ? 'Đã đạt kiểm định' : 'Passed Inspection', count: highValueListings.filter(l => getHighValueItemStage(l) === 'passed').length },
    { key: 'failed' as const, label: lang === 'vi' ? 'Không đạt' : 'Failed', count: highValueListings.filter(l => getHighValueItemStage(l) === 'failed').length },
  ], [highValueListings, getHighValueItemStage, lang]);

  // Backward compatibility alias
  const filteredListings = filteredNormalListings;

  // Pagination State for Listings and High-Value Tabs (10 items per page)
  const [listingsPage, setListingsPage] = useState(1);
  const [highValuePage, setHighValuePage] = useState(1);

  useEffect(() => {
    setListingsPage(1);
  }, [filterStatus, sortOrder]);

  useEffect(() => {
    setHighValuePage(1);
  }, [highValueFilter, sortOrder]);

  const totalListingsPages = Math.ceil(filteredNormalListings.length / ITEMS_PER_PAGE) || 1;
  const currentListingsPage = Math.min(Math.max(1, listingsPage), totalListingsPages);
  const paginatedNormalListings = React.useMemo(() => {
    const start = (currentListingsPage - 1) * ITEMS_PER_PAGE;
    return filteredNormalListings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNormalListings, currentListingsPage]);

  const totalHighValuePages = Math.ceil(filteredHighValueListings.length / ITEMS_PER_PAGE) || 1;
  const currentHighValuePage = Math.min(Math.max(1, highValuePage), totalHighValuePages);
  const paginatedHighValueListings = React.useMemo(() => {
    const start = (currentHighValuePage - 1) * ITEMS_PER_PAGE;
    return filteredHighValueListings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHighValueListings, currentHighValuePage]);

  const handleListingsPageChange = (newPage: number) => {
    setListingsPage(newPage);
    const el = document.getElementById('seller-listings-container');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleHighValuePageChange = (newPage: number) => {
    setHighValuePage(newPage);
    const el = document.getElementById('seller-highvalue-container');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [hubShipmentFeed, setHubShipmentFeed] = useState<{
    sellerId: string;
    byInspection: ReadonlyMap<string, SellerHubShipmentSnapshot>;
  }>();
  const hubShipments = hubShipmentFeed?.sellerId === sellerId ? hubShipmentFeed?.byInspection : undefined;
  const hubInspectionIdsKey = Array.from(inspectionByPost?.values() ?? [])
    .filter((inspection) => inspection.id && inspection.orderType !== 'AT_HOME')
    .map((inspection) => inspection.id).sort().join(',');

  useEffect(() => {
    if (!sellerId || !hubInspectionIdsKey || sellerActiveTab !== 'high_value_inspections') return;
    const inspectionIds = new Set(hubInspectionIdsKey.split(','));
    const requests = new Map<string, AbortController>();
    const saveSnapshot = (id: string, snapshot: SellerHubShipmentSnapshot) => {
      setHubShipmentFeed((previous) => {
        const current = previous?.sellerId === sellerId ? previous.byInspection : undefined;
        if (snapshot === 'unavailable' && current?.has(id)) return previous;
        return { sellerId, byInspection: new Map(current).set(id, snapshot) };
      });
    };
    const refreshShipment = (id: string) => {
      if (!inspectionIds.has(id)) return;
      requests.get(id)?.abort();
      const controller = new AbortController();
      requests.set(id, controller);
      const { signal } = controller;
      void shippingService.getInspectionShipments(id, { signal, updateCache: false, isBackground: true })
        .then((shipments) => {
          if (!signal.aborted) saveSnapshot(id, getLatestInboundShipment(shipments));
        })
        .catch(() => {
          if (!signal.aborted) saveSnapshot(id, 'unavailable');
        })
        .finally(() => {
          if (requests.get(id) === controller) requests.delete(id);
        });
    };
    const handleShipmentUpdate = (event: Event) => {
      const id = (event as CustomEvent<{ orderId?: string }>).detail?.orderId;
      if (id) refreshShipment(id);
    };
    const handleStorageUpdate = (event: StorageEvent) => {
      const prefix = 'sl_insp_shipments_';
      if (event.key?.startsWith(prefix)) refreshShipment(event.key.slice(prefix.length));
    };

    window.addEventListener('secondlife_shipment_updated', handleShipmentUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    inspectionIds.forEach(refreshShipment);
    return () => {
      window.removeEventListener('secondlife_shipment_updated', handleShipmentUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
      requests.forEach((request) => request.abort());
    };
  }, [hubInspectionIdsKey, inspectionRefresh, sellerActiveTab, sellerId]);

  const getHighValueBadgeInfo = React.useCallback((item: Listing): { label: string; colorClass: string; isPassed?: boolean } => {
    const stage = getHighValueItemStage(item);
    const insp = getItemInspectionOrder(item);
    const appointmentStage = getPreListingHomeAppointmentStage(insp);
    const canPublish = item.backendStatus === 'READY_TO_PUBLISH';
    const vi = lang === 'vi';

    // 1. Kiểm định đạt chuẩn
    if (stage === 'passed') {
      let label = vi ? '● Đã Kiểm Định' : '● Inspected';
      if (canPublish) {
        label = vi ? '● Sẵn sàng đăng bán' : '● Ready to publish';
      } else if (item.status === 'active' || item.backendStatus === 'ACTIVE') {
        label = vi ? '● Đang bán' : '● Active';
      } else if (item.backendStatus === 'RESERVED' || item.backendStatus === 'PAYMENT_PENDING') {
        label = vi ? '● Đã Cọc Ký Quỹ' : '● Escrow Deposited';
      } else if (item.backendStatus === 'RETURNING') {
        label = vi ? '● Đang hoàn trả' : '● Returning';
      } else if (item.backendStatus === 'RETURNED') {
        label = vi ? '● Đã hoàn trả' : '● Returned';
      } else if (item.backendStatus === 'SOLD') {
        label = vi ? '● Đã bán' : '● Sold';
      } else if (item.backendStatus === 'PENDING_INSPECTION' && insp?.orderType === 'AT_CENTER') {
        label = vi ? '● Đạt kiểm định · Chờ nhận lại hàng' : '● Inspected · Awaiting return';
      }
      return {
        label,
        colorClass: 'bg-emerald-600 text-white shadow-2xs',
        isPassed: true,
      };
    }

    // 2. Kiểm định không đạt
    if (stage === 'failed') {
      return {
        label: vi ? '● Không Đạt Tiêu Chuẩn' : '● Inspection Failed',
        colorClass: 'bg-rose-600 text-white shadow-2xs',
      };
    }

    // 3. Kiểm định tại nhà (AT_HOME)
    if (insp?.orderType === 'AT_HOME') {
      if (appointmentStage) {
        const apptLabel = `● ${homeAppointmentLabels[appointmentStage][lang]}`;
        const colorClass = appointmentStage === 'scheduled'
          ? 'bg-teal-600 text-white shadow-2xs'
          : 'bg-amber-600 text-white shadow-2xs';
        return { label: apptLabel, colorClass };
      }
      if (stage === 'inspecting') {
        return {
          label: vi ? '● Đang kiểm định tại nhà' : '● Home inspection in progress',
          colorClass: 'bg-indigo-600 text-white shadow-2xs',
        };
      }
      return {
        label: vi ? '● Chờ Nộp Phí & Đặt Lịch' : '● Awaiting Fee / Schedule',
        colorClass: 'bg-amber-600 text-white shadow-2xs',
      };
    }

    // 4. Kiểm định tại Trung tâm / Hub (AT_CENTER)
    const inspStatus = String(insp?.status || '').toUpperCase();
    const isUnpaid = !insp || inspStatus === 'PENDING' || inspStatus === 'WAITING_FEE_PAYMENT';

    if (isUnpaid) {
      return {
        label: vi ? '● Chờ Nộp Phí & Đặt Lịch' : '● Awaiting Fee / Schedule',
        colorClass: 'bg-amber-600 text-white shadow-2xs',
      };
    }

    return getSellerHubShipmentBadge(inspStatus, hubShipments?.get(insp.id), lang);
  }, [getHighValueItemStage, getItemInspectionOrder, lang, hubShipments]);

  const formatPostDateTime = (item: any) => {
    const ts = getSortablePostTimestamp(item);
    if (!ts || isNaN(ts)) return '--';
    const d = new Date(ts);
    return `${d.toLocaleDateString('vi-VN')} lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  };

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
      {/* eKYC Verification Status Banner (Ẩn khi đã duyệt APPROVED thành công) */}
      {myVerification && myVerification.status !== 'APPROVED' && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${myVerification.status === 'NEEDS_REVIEW' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          myVerification.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-50 border-orange-200 text-orange-950' :
            myVerification.status === 'REJECTED' ? 'bg-rose-50 border-rose-200 text-rose-900' :
              'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
          <div className="flex items-center gap-3">
            {myVerification.status === 'NEEDS_REVIEW' ? (
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
                {myVerification.status === 'NEEDS_REVIEW' && (lang === 'vi' ? 'Đang chờ Quản trị viên duyệt' : 'Pending Admin Review')}
                {(myVerification.status === 'EKYC_PENDING' || myVerification.status === 'SUBMITTED' || myVerification.status === 'PENDING') && (lang === 'vi' ? 'Đang đối soát eKYC' : 'eKYC Verification In Progress')}
                {myVerification.status === 'RESUBMIT_REQUIRED' && (lang === 'vi' ? 'Cần chụp lại ảnh' : 'Resubmission Required')}
                {myVerification.status === 'REJECTED' && (lang === 'vi' ? 'Hồ sơ bị từ chối' : 'Verification Rejected')}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed">
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
      <div className="bg-[#fce5da] text-[#24263e] rounded-2xl p-4 sm:p-5 shadow-sm border border-[#24263e]/15 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <UserAvatar
                src={currentUser?.avatar}
                name={currentUser?.name}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border-2 border-[#24263e]/20 shadow-xs"
                role="seller"
              />
              <div
                className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full text-xs shadow-xs"
                title={lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified'}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-[#24263e] truncate">
                  {currentUser?.name || currentUser?.email?.split('@')[0] || 'Người Bán SecondLife'}
                </h1>
                <button
                  type="button"
                  onClick={handleOpenVerificationHistory}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold shadow-2xs transition cursor-pointer"
                  title={lang === 'vi' ? 'Đã xác minh eKYC - Bấm để xem lịch sử nộp hồ sơ' : 'eKYC Verified - Click to view history'}
                >
                  <CheckCircle2 className={`w-3 h-3 ${myVerification?.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <span>{myVerification?.status === 'APPROVED' ? (lang === 'vi' ? 'Đã xác minh eKYC' : 'eKYC Verified') : (lang === 'vi' ? 'Chưa xác minh eKYC' : 'Unverified')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenReputationHistory}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-bold shadow-2xs transition cursor-pointer"
                  title="Bấm để xem chi tiết bảng điểm và lịch sử uy tín"
                >
                  <Award className="w-3 h-3 text-amber-600" />
                  <span className="font-mono font-black">
                    {myReputation?.assessmentStatus === 'NO_TRANSACTIONS'
                      ? 'Chưa có đơn'
                      : myReputation?.score !== undefined && myReputation?.score !== null
                        ? `${myReputation.score}/100`
                        : currentUser?.trustScore
                          ? `${currentUser.trustScore}/100`
                          : '—'}
                  </span>
                  <span>Uy Tín</span>
                  {myReputation?.sellingRestricted && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500 text-white font-bold animate-pulse">
                      Hạn chế
                    </span>
                  )}
                  <ChevronRight className="w-2.5 h-2.5 text-amber-700/60" />
                </button>
              </div>

              {/* Dải chỉ số uy tín & bán hàng: Tinh gọn, chuyên nghiệp, không vỡ dòng */}
              <div className="flex items-center gap-2.5 text-xs text-[#24263e]/85 font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-[#24263e] font-bold">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{completedOrdersCount} {lang === 'vi' ? 'đơn hoàn thành' : 'completed orders'}</span>
                </span>
                <span className="text-slate-400">•</span>
                <button
                  type="button"
                  onClick={() => setIsSellerReviewsOpen(true)}
                  className="flex items-center gap-1 hover:text-[#c34c36] text-[#24263e] font-bold transition cursor-pointer"
                  title="Bấm để xem đánh giá khách hàng"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>
                    {sellerAverageRatingText}
                    {sellerReviewCount > 0 ? ` (${sellerReviewCount})` : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Cụm nút thao tác: phân cấp chính/phụ rõ ràng, bố cục cân đối */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <button
              onClick={() => onCreateListing()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white font-black text-xs shadow-sm hover:shadow transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Đăng Bán Đồ Gia Dụng Mới (AI)' : 'Post New Appliance (AI)'}</span>
            </button>

            <div className="flex items-center gap-1.5 flex-wrap">
              {onViewOrders && (
                <button
                  onClick={onViewOrders}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{lang === 'vi' ? 'Quản Lý Đơn' : 'Orders'}</span>
                </button>
              )}
              <button
                onClick={() => setIsPayoutModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-2xs"
              >
                <Wallet className="w-3.5 h-3.5 text-[#24263e]" />
                <span>{lang === 'vi' ? 'Rút Tiền Ví' : 'Withdraw'}</span>
              </button>
              <button
                onClick={() => setIsSellerReviewsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-[#24263e] border border-[#24263e]/15 font-bold text-xs transition cursor-pointer shadow-2xs"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>{lang === 'vi' ? `Đánh Giá (${sellerReviewCount})` : `Reviews (${sellerReviewCount})`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cảnh báo hạn chế bán hàng hoặc cảnh báo vi phạm uy tín theo tài liệu BE (tự động tắt sau 15s) */}
        {showViolationWarning && (myReputation?.sellingRestricted ? (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-fadeIn text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-rose-900 mr-2">
                  Tài khoản đang bị hạn chế bán hàng:
                </span>
                <span className="text-rose-700 text-[11px]">
                  Quyền đăng bán bị tạm khóa do vi phạm hoặc điểm phạt.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenReputationHistory}
                className="text-xs font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
              >
                Xem chi tiết
              </button>
              <button
                type="button"
                onClick={() => setShowViolationWarning(false)}
                className="text-rose-500 hover:text-rose-800 p-1 text-xs"
                title="Đóng thông báo"
              >
                ✕
              </button>
            </div>
          </div>
        ) : myReputation?.warningCode ? (
          (() => {
            const warnMeta = getReputationWarningMeta(myReputation.warningCode);
            if (!warnMeta) return null;
            return (
              <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 shadow-xs animate-fadeIn text-xs ${warnMeta.badgeClass}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold mr-2">{warnMeta.title}:</span>
                    <span className="opacity-90 text-[11px]">{warnMeta.desc}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenReputationHistory}
                    className="text-[11px] font-bold underline hover:opacity-80 cursor-pointer"
                  >
                    Chi tiết uy tín
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowViolationWarning(false)}
                    className="opacity-70 hover:opacity-100 p-1 text-xs"
                    title="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })()
        ) : null)}

        {/* Financial Metrics Cards (gọn gàng, thanh thoát) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#24263e]/15">
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between space-y-1">
            <div className="text-[11px] text-[#24263e]/70 flex items-center justify-between font-medium">
              <span>{lang === 'vi' ? 'Số dư ví khả dụng' : 'Available balance'}</span>
              <Wallet className="w-3.5 h-3.5 text-[#24263e]" />
            </div>
            <div className="text-xl font-black text-[#24263e] tracking-tight">
              {formatVND(totalEarnings)}
            </div>
            <div className="text-[10px] text-[#24263e]/60">
              {lang === 'vi' ? 'Có thể rút về Ngân hàng ngay' : 'Can withdraw to bank'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between space-y-1">
            <div className="text-[11px] text-[#24263e]/70 flex items-center justify-between font-medium">
              <span>{lang === 'vi' ? 'Đang đóng băng Escrow' : 'Held in Escrow'}</span>
              <Clock className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-xl font-black text-[#24263e] tracking-tight">
              {formatVND(pendingEscrow)}
            </div>
            <div className="text-[10px] text-[#24263e]/60">
              {lang === 'vi' ? 'Giải ngân khi Buyer nhận hàng' : 'Released after confirmation'}
            </div>
          </div>

          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between space-y-1">
            <div className="text-[11px] text-[#24263e]/70 flex items-center justify-between font-medium">
              <span>{lang === 'vi' ? 'Điểm Tín Dụng' : 'Active Credits'}</span>
              <Coins className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl font-black text-[#24263e]">
                {creditBalance ? creditBalance.postCredits : (currentUser as any)?.postCredits ?? 0}
              </span>
              <span className="text-[11px] font-bold text-slate-500">Đăng tin</span>
              <span className="text-slate-300">•</span>
              <span className="text-base font-black text-emerald-600">
                {creditBalance ? creditBalance.valuationCredits : (currentUser as any)?.valuationCredits ?? 0}
              </span>
              <span className="text-[11px] font-bold text-slate-500">Định giá</span>
              <span className="text-slate-300">•</span>
              <span className="text-base font-black text-blue-600">
                {creditBalance ? creditBalance.chatCredits : (currentUser as any)?.chatCredits ?? 0}
              </span>
              <span className="text-[11px] font-bold text-slate-500">Chat AI</span>
            </div>
          </div>

          <div
            onClick={handleOpenReputationHistory}
            className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between space-y-1 hover:border-[#c34c36]/40 transition cursor-pointer group"
            title="Bấm để xem bảng chỉ số uy tín và lịch sử"
          >
            <div className="text-[11px] text-[#24263e]/70 flex items-center justify-between font-medium">
              <span className="font-bold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'vi' ? 'Uy Tín Giao Dịch' : 'Seller Reputation'}</span>
              </span>
              {(() => {
                const statusMeta = getAssessmentStatusMeta(myReputation?.assessmentStatus);
                return (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${statusMeta.badgeClass}`}>
                    {statusMeta.shortLabel}
                  </span>
                );
              })()}
            </div>
            <div className="text-xl font-black text-[#24263e] flex items-baseline gap-1">
              <span>
                {myReputation?.score !== null && myReputation?.score !== undefined
                  ? myReputation.score
                  : myReputation?.assessmentStatus === 'NO_TRANSACTIONS'
                    ? 'Chưa có đơn'
                    : '—'}
              </span>
              {myReputation?.score !== null && myReputation?.score !== undefined && (
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              )}
            </div>
            <div className="text-[10px] text-[#24263e]/60 flex items-center justify-between pt-0.5">
              <span className="truncate">
                {myReputation?.evaluatedOrders
                  ? `${myReputation.goodTransactions} thành công • ${myReputation.badTransactions} lỗi thuộc về bạn`
                  : lang === 'vi'
                    ? 'Bấm xem chi tiết & lịch sử'
                    : 'Click to view audit trail'}
              </span>
              <span className="text-xs font-bold text-[#c34c36] group-hover:translate-x-0.5 transition-transform ml-1">→</span>
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

      {/* Seller Dashboard Sub-Navigation Tabs */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          onClick={() => {
            setSellerActiveTab('listings');
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'listings');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${sellerActiveTab === 'listings'
            ? 'bg-[#24263e] text-white shadow-md ring-2 ring-[#24263e]/20'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
            }`}
        >
          <Tag className="w-4 h-4" />
          <span>{lang === 'vi' ? 'Tin Đăng Bán & Bản Nháp' : 'Listings & Drafts'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${sellerActiveTab === 'listings' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
            {normalListings.length}
          </span>
        </button>

        <button
          onClick={() => {
            setSellerActiveTab('high_value_inspections');
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'high_value_inspections');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${sellerActiveTab === 'high_value_inspections'
            ? 'bg-[#24263e] text-white shadow-md ring-2 ring-[#24263e]/20'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
            }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>{lang === 'vi' ? 'Kiểm Định Giá Trị Cao' : 'High-Value Inspections'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${sellerActiveTab === 'high_value_inspections' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
            }`}>
            {highValueListings.length}
          </span>
        </button>

      </div>

      {sellerActiveTab === 'high_value_inspections' ? (
        /* Tab 2: High-Value Inspections Management */
        <div id="seller-highvalue-container" className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
          <div className="space-y-4 border-b border-gray-100 pb-4">
            {/* Top row: Section Title & Utility Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <span>
                    {lang === 'vi'
                      ? `Sản Phẩm Kiểm Định Giá Trị Cao (${filteredHighValueListings.length})`
                      : `High-Value Inspected Items (${filteredHighValueListings.length})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'vi'
                    ? 'Các thiết bị thuộc diện kiểm định giá trị cao tại SecondLife Hub trước khi chính thức niêm yết lên sàn.'
                    : 'Items subject to mandatory high-value inspection at SecondLife Hub prior to marketplace listing.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    void fetchSellerData();
                    setInspectionRefresh((previous) => previous + 1);
                  }}
                  disabled={isLoadingPosts}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={lang === 'vi' ? 'Làm mới dữ liệu từ server' : 'Refresh server data'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                </button>

                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={lang === 'vi' ? 'Sắp xếp theo thời gian đăng bài' : 'Sort by posting time'}
                >
                  <Clock className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>
                    {sortOrder === 'newest'
                      ? (lang === 'vi' ? 'Mới đăng nhất' : 'Newest first')
                      : (lang === 'vi' ? 'Cũ nhất trước' : 'Oldest first')}
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom row: Filter Segmented Bar */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none">
              {highValueFilterTabs.map((tab) => {
                const isActive = highValueFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setHighValueFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredHighValueListings.length === 0 ? (
            <div className="text-center py-12 bg-[#faf8f5] rounded-2xl border border-dashed border-gray-200 space-y-3">
              <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-[#24263e]">
                {lang === 'vi' ? 'Không có sản phẩm kiểm định giá trị cao nào phù hợp' : 'No high-value inspection items found'}
              </p>
              <p className="text-xs text-[#24263e]/70">
                {lang === 'vi'
                  ? 'Các sản phẩm đồ gia dụng giá trị cao cần kiểm định tại Hub trước khi niêm yết sẽ hiển thị tại đây.'
                  : 'High-value home appliances requiring inspection before publishing will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedHighValueListings.map((item) => {
                const stage = getHighValueItemStage(item);
                const insp = getItemInspectionOrder(item);
                const appointmentStage = getPreListingHomeAppointmentStage(insp);
                const canPublish = item.backendStatus === 'READY_TO_PUBLISH';
                const canTrackInspection = item.backendStatus === 'PENDING_INSPECTION' || canPublish
                  || (item.backendStatus === 'REJECTED' && stage === 'failed' && Boolean(insp));
                const badgeInfo = getHighValueBadgeInfo(item);
                const failureReason = stage === 'failed'
                  ? formatInspectionFailureReason(item.rejectionReason, lang) ||
                  formatInspectionFailureReason(insp?.note, lang) ||
                  formatInspectionFailureReason((insp as any)?.cancellationReason, lang)
                  : '';
                return (
                  <div
                    key={item.id}
                    className="bg-white hover:bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5 group"
                  >
                    {/* Left & Middle: Thumbnail & Details */}
                    <div className="flex items-start sm:items-center gap-4 sm:gap-5 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={item.photos.front}
                          alt={item.title}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-200/90 shadow-2xs bg-slate-50 group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      </div>

                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Badges line */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeInfo.colorClass}`}>
                            {badgeInfo.label}
                          </span>
                          {badgeInfo.isPassed && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>{getListingInspectionBadgeText(insp?.orderType || item.inspectionMethod, lang, true)}</span>
                            </span>
                          )}
                        </div>

                        {/* Rejection reason (if failed) */}
                        {failureReason && (
                          <div className="inline-flex items-start gap-1.5 text-xs text-rose-800 bg-rose-50/90 px-3 py-1.5 rounded-xl border border-rose-200/90 leading-snug w-fit max-w-full sm:max-w-xl">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 break-words">
                              <span className="font-bold text-rose-900">{lang === 'vi' ? 'Lý do: ' : 'Reason: '}</span>
                              <span>{failureReason}</span>
                            </div>
                          </div>
                        )}

                        {/* Title */}
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#c34c36] transition-colors line-clamp-1" title={item.title}>
                          {item.title}
                        </h3>

                        {/* Price & Meta info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                          <span className="text-base sm:text-lg font-black text-[#24263e] tracking-tight">
                            {formatVND(item.priceVnd)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {lang === 'vi' ? 'Độ mới: ' : 'Grade: '}
                            <strong className="text-slate-900">{formatConditionGrade(item.conditionGrade, lang)}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium truncate max-w-[200px]" title={item.sellerAddress || item.location}>
                            📍 {item.location || item.sellerAddress || 'Chưa cập nhật'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3 text-[#c34c36]" />
                            <span>{formatPostDateTime(item)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex items-center justify-end gap-2 flex-wrap lg:max-w-[55%] shrink-0 lg:self-center">
                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => void handlePublishInspectedPost(item)}
                          disabled={publishingPostId !== null}
                          className="h-9 px-3.5 rounded-xl bg-[#c34c36] hover:bg-[#ad432f] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-60"
                        >
                          {publishingPostId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                          {lang === 'vi' ? 'Đăng bán' : 'Publish listing'}
                        </button>
                      )}
                      <button
                        onClick={() => onSelectListing(item)}
                        className="h-9 px-3.5 w-[124px] bg-[#24263e] hover:bg-black border border-[#24263e] rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-60 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Chi tiết' : 'View Details'}</span>
                      </button>

                      {canTrackInspection && <button
                        type="button"
                        onClick={() => setPreListingPost(item)}
                        className={`h-9 px-3.5 min-w-[145px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs shrink-0 ${stage === 'passed'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : stage === 'failed'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white'
                          }`}
                        title={
                          stage === 'passed'
                            ? (lang === 'vi' ? 'Theo dõi quy trình hoàn tất & lên sàn' : 'Track Publish')
                            : stage === 'failed'
                              ? (lang === 'vi' ? 'Xem biên bản không đạt & thủ tục hoàn hàng' : 'Return Process')
                              : (lang === 'vi' ? 'Tiếp tục quy trình nộp phí / đặt lịch kiểm định' : 'Resume Inspection')
                        }
                      >
                        {stage === 'failed' ? (
                          <RotateCcw className="w-3.5 h-3.5 text-rose-100" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                        )}
                        <span>
                          {stage === 'passed'
                            ? (lang === 'vi' ? 'Theo dõi tiến trình' : 'Track Publish')
                            : stage === 'failed'
                              ? (lang === 'vi' ? 'Thủ tục hoàn hàng' : 'Return Process')
                              : (lang === 'vi' ? 'Tiếp tục kiểm định' : 'Resume Inspection')}
                        </span>
                      </button>}

                      {hasPreListingInspectionResult(insp) && (
                        <button
                          type="button"
                          onClick={() => setResultListing(item)}
                          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>{lang === 'vi' ? 'Xem kết quả' : 'Result'}</span>
                        </button>
                      )}

                      <SellerListingEditActions
                        actions={item.sellerActions}
                        lang={lang}
                        onEdit={() => onCreateListing(item)}
                        onUpdateShippingPackage={() => setEditingPackagePost(item)}
                        onReclassify={() => handleOpenReclassifyModal(item)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for High-Value Inspections */}
          {totalHighValuePages > 1 && (
            <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                {lang === 'vi' ? (
                  <>
                    Hiển thị <strong>{(currentHighValuePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentHighValuePage * ITEMS_PER_PAGE, filteredHighValueListings.length)}</strong> trong tổng số <strong>{filteredHighValueListings.length}</strong> sản phẩm
                  </>
                ) : (
                  <>
                    Showing <strong>{(currentHighValuePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentHighValuePage * ITEMS_PER_PAGE, filteredHighValueListings.length)}</strong> of <strong>{filteredHighValueListings.length}</strong> products
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleHighValuePageChange(Math.max(1, currentHighValuePage - 1))}
                  disabled={currentHighValuePage <= 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Trước' : 'Prev'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {getPaginationRange(currentHighValuePage, totalHighValuePages).map((p, idx) =>
                    p === '...' ? (
                      <span key={`hv-ellipsis-${idx}`} className="px-2 text-slate-400 font-bold">...</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleHighValuePageChange(Number(p))}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                          currentHighValuePage === p
                            ? 'bg-[#24263e] text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleHighValuePageChange(Math.min(totalHighValuePages, currentHighValuePage + 1))}
                  disabled={currentHighValuePage >= totalHighValuePages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <span>{lang === 'vi' ? 'Tiếp' : 'Next'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 1: Normal Seller Listings & Drafts Management */
        <div id="seller-listings-container" className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
          <div className="space-y-4 border-b border-gray-100 pb-4">
            {/* Top row: Section Title & Utility Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#24263e]" />
                  <span>
                    {lang === 'vi'
                      ? `Quản Lý Tin Đăng & Bản Nháp (${filteredNormalListings.length})`
                      : `My Listings & Drafts (${filteredNormalListings.length})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'vi'
                    ? 'Quản lý các sản phẩm đang bán, bản nháp soạn thảo và theo dõi phản hồi đề xuất giá từ người mua.'
                    : 'Manage active listings, draft posts, and monitor buyer price offers.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    void fetchSellerData();
                    setInspectionRefresh((previous) => previous + 1);
                  }}
                  disabled={isLoadingPosts}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={lang === 'vi' ? 'Làm mới dữ liệu từ server' : 'Refresh server data'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                </button>

                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={lang === 'vi' ? 'Sắp xếp theo thời gian đăng bài' : 'Sort by posting time'}
                >
                  <Clock className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>
                    {sortOrder === 'newest'
                      ? (lang === 'vi' ? 'Mới đăng nhất' : 'Newest first')
                      : (lang === 'vi' ? 'Cũ nhất trước' : 'Oldest first')}
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom row: Filter Segmented Bar */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none">
              {(['ALL', 'active', 'draft', 'reserved', 'sold', 'rejected'] as const).map((st) => {
                const isActive = filterStatus === st;
                const count = normalListings.filter(item => {
                  if (st === 'ALL') return true;
                  if (st === 'active') return (item.backendStatus === 'ACTIVE' || item.status === 'active') && item.backendStatus !== 'RETURNING' && item.backendStatus !== 'RETURNED';
                  if (st === 'draft') return item.backendStatus === 'DRAFT' || item.status === 'draft' || item.backendStatus === 'RETURNED';
                  if (st === 'reserved') return item.backendStatus === 'RESERVED' || item.status === 'reserved' || item.backendStatus === 'RETURNING';
                  if (st === 'sold') return (item.status === 'sold' || item.backendStatus === 'SOLD') && item.backendStatus !== 'RETURNING' && item.backendStatus !== 'RETURNED';
                  if (st === 'rejected') return item.backendStatus === 'REJECTED' || item.status === 'rejected';
                  return true;
                }).length;
                const label = st === 'ALL'
                  ? (lang === 'vi' ? 'Tất cả' : 'All')
                  : st === 'active'
                    ? (lang === 'vi' ? 'Đang bán' : 'Active')
                    : st === 'draft'
                      ? (lang === 'vi' ? 'Bản nháp' : 'Drafts')
                      : st === 'reserved'
                        ? (lang === 'vi' ? 'Đang giữ hàng' : 'Reserved')
                        : st === 'sold'
                          ? (lang === 'vi' ? 'Đã bán' : 'Sold')
                          : (lang === 'vi' ? 'Bị từ chối' : 'Rejected');
                return (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                  >
                    <span>{label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredNormalListings.length === 0 ? (
            <div className="text-center py-12 bg-[#faf8f5] rounded-2xl border border-dashed border-gray-200 space-y-3">
              <Package className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm font-bold text-[#24263e]">
                {lang === 'vi' ? 'Không tìm thấy tin đăng nào phù hợp' : 'No matching listings found'}
              </p>
              <p className="text-xs text-[#24263e]/70">
                {lang === 'vi'
                  ? 'Hãy thử thay đổi bộ lọc trạng thái hoặc tạo bài đăng bán mới.'
                  : 'Try changing your filter status or create a new listing.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedNormalListings.map((item) => {
                const sellerInspectionState = resolveSellerListingInspectionState(
                  item,
                  inspectionByPost?.get(item.id),
                  orders,
                );
                const detailListing = sellerInspectionState.passed
                  ? {
                      ...item,
                      isInspected: true,
                      inspectionMethod: sellerInspectionState.method ?? item.inspectionMethod,
                    }
                  : item;
                return (
                <div
                  key={item.id}
                  className="bg-white hover:bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5 group"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <img
                      src={item.photos.front}
                      alt={item.title}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-200/90 shadow-2xs shrink-0 bg-slate-50 group-hover:scale-[1.02] transition-transform duration-200"
                    />
                    <div className="space-y-1.5 overflow-hidden flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${item.backendStatus === 'REJECTED'
                          ? 'bg-rose-600 text-white'
                          : item.backendStatus === 'RETURNING'
                            ? 'bg-amber-600 text-white'
                            : item.backendStatus === 'RETURNED'
                              ? 'bg-purple-600 text-white'
                              : item.backendStatus === 'DRAFT' || item.status === 'draft'
                                ? 'bg-slate-500 text-white'
                                : item.status === 'sold' || item.backendStatus === 'SOLD'
                                  ? 'bg-slate-700 text-white'
                                  : item.status === 'active'
                                    ? 'bg-[#24263e] text-white'
                                    : 'bg-[#c34c36] text-white'
                          }`}>
                          {item.backendStatus === 'REJECTED'
                            ? (lang === 'vi' ? '● Bị Từ Chối' : '● Rejected')
                            : item.backendStatus === 'RETURNING'
                              ? (lang === 'vi' ? '● Đang hoàn trả' : '● Returning')
                              : item.backendStatus === 'RETURNED'
                                ? (lang === 'vi' ? '● Đã hoàn trả' : '● Returned')
                                : item.backendStatus === 'DRAFT' || item.status === 'draft'
                                  ? (lang === 'vi' ? '● Bản Nháp' : '● Draft')
                                  : item.status === 'sold' || item.backendStatus === 'SOLD'
                                    ? (lang === 'vi' ? '● Đã bán' : '● Sold')
                                    : item.status === 'active'
                                      ? (lang === 'vi' ? '● Đang bán' : '● Active')
                                      : (lang === 'vi' ? '● Đã Cọc Ký Quỹ' : '● Escrow Deposited')}
                        </span>
                        {sellerInspectionState.passed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
                            <ShieldCheck className="w-3 h-3 text-emerald-100" />
                            <span>{getListingInspectionBadgeText(sellerInspectionState.method, lang, true)}</span>
                          </span>
                        )}
                      </div>

                      {item.backendStatus === 'REJECTED' && item.rejectionReason && (
                        <div className="inline-flex items-start gap-1.5 text-xs text-rose-800 bg-rose-50/90 px-3 py-1.5 rounded-xl border border-rose-200/90 leading-snug w-fit max-w-full sm:max-w-xl">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-900">{lang === 'vi' ? 'Lý do: ' : 'Reason: '}</span>
                            <span>{item.rejectionReason}</span>
                          </div>
                        </div>
                      )}

                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#c34c36] transition-colors line-clamp-1" title={item.title}>
                        {item.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                        <span className="text-base sm:text-lg font-black text-[#24263e] tracking-tight">
                          {formatVND(item.priceVnd)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {lang === 'vi' ? 'Độ mới: ' : 'Grade: '}
                          <strong className="text-slate-900">{formatConditionGrade(item.conditionGrade, lang)}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-medium truncate max-w-[200px]" title={item.sellerAddress || item.location}>
                          📍 {item.location || item.sellerAddress || 'Chưa cập nhật'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3 text-[#c34c36]" />
                          <span>{formatPostDateTime(item)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex items-center justify-end gap-2 flex-wrap shrink-0 lg:max-w-[55%] lg:self-center">
                    <button
                      onClick={() => onSelectListing(detailListing)}
                      className="h-9 px-3.5 w-[124px] bg-[#24263e] hover:bg-black border border-[#24263e] rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-60 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Chi tiết' : 'View Details'}</span>
                    </button>
                    {hasPreListingInspectionResult(inspectionByPost?.get(item.id)) && (
                      <button
                        type="button"
                        onClick={() => setResultListing(item)}
                        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>{lang === 'vi' ? 'Xem kết quả' : 'Result'}</span>
                      </button>
                    )}
                    <SellerListingEditActions
                      actions={item.sellerActions}
                      lang={lang}
                      onEdit={() => onCreateListing(item)}
                      onUpdateShippingPackage={() => setEditingPackagePost(item)}
                      onReclassify={() => handleOpenReclassifyModal(item)}
                    />
                    {item.backendStatus === 'DRAFT' && item.sellerActions?.editContent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftToDelete({ id: item.id, title: item.title });
                        }}
                        disabled={deletingDraftId === item.id}
                        className="w-9 h-9 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition disabled:opacity-50 shadow-2xs shrink-0"
                        title={lang === 'vi' ? 'Xóa bản nháp này' : 'Delete draft'}
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for Normal Listings & Drafts */}
          {totalListingsPages > 1 && (
            <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                {lang === 'vi' ? (
                  <>
                    Hiển thị <strong>{(currentListingsPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentListingsPage * ITEMS_PER_PAGE, filteredNormalListings.length)}</strong> trong tổng số <strong>{filteredNormalListings.length}</strong> sản phẩm
                  </>
                ) : (
                  <>
                    Showing <strong>{(currentListingsPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentListingsPage * ITEMS_PER_PAGE, filteredNormalListings.length)}</strong> of <strong>{filteredNormalListings.length}</strong> products
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleListingsPageChange(Math.max(1, currentListingsPage - 1))}
                  disabled={currentListingsPage <= 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Trước' : 'Prev'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {getPaginationRange(currentListingsPage, totalListingsPages).map((p, idx) =>
                    p === '...' ? (
                      <span key={`listings-ellipsis-${idx}`} className="px-2 text-slate-400 font-bold">...</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleListingsPageChange(Number(p))}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                          currentListingsPage === p
                            ? 'bg-[#24263e] text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleListingsPageChange(Math.min(totalListingsPages, currentListingsPage + 1))}
                  disabled={currentListingsPage >= totalListingsPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <span>{lang === 'vi' ? 'Tiếp' : 'Next'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

      {editingPackagePost && (
        <ListingShippingPackageModal
          key={editingPackagePost.id}
          postId={editingPackagePost.id}
          title={editingPackagePost.title}
          lang={lang}
          onClose={() => setEditingPackagePost(null)}
          onSaved={(parcel) => handlePackageSaved(editingPackagePost.id, parcel)}
        />
      )}

      {/* Modal Chọn lại loại thiết bị (Reclassify Item Modal) */}
      {reclassifyingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Chọn Lại Loại Thiết Bị</h3>
                  <p className="text-[11px] text-slate-500">Cập nhật phân loại cho bài viết theo danh mục mới</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReclassifyingPost(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="text-slate-500">Bài đăng: <strong className="text-slate-800">{reclassifyingPost.title}</strong></div>
                <div className="text-slate-500">Loại hiện tại: <span className="font-semibold text-rose-700">{reclassifyingPost.itemName || 'Chưa xác định'}</span></div>
              </div>

              {reclassifyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{reclassifyError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Chọn Loại Thiết Bị Mới *
                </label>
                {isLoadingReclassifyItems ? (
                  <div className="flex items-center justify-center py-4 text-xs text-slate-500 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#c34c36]" />
                    <span>Đang tải danh sách thiết bị...</span>
                  </div>
                ) : (
                  <select
                    value={selectedReclassifyItemId}
                    onChange={(e) => setSelectedReclassifyItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#c34c36]"
                  >
                    {reclassifyItems.length > 0 ? (
                      reclassifyItems.map((itm) => (
                        <option key={itm.id} value={itm.id}>
                          {itm.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Không có loại thiết bị khả dụng</option>
                    )}
                  </select>
                )}
                <p className="text-[11px] text-slate-500 italic">
                  Chỉ áp dụng được khi bài chưa trong giao dịch hoặc kiểm định đang xử lý.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReclassifyingPost(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitReclassify}
                disabled={isSubmittingReclassify || !selectedReclassifyItemId}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#c34c36] hover:bg-[#a63f2d] text-white disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isSubmittingReclassify && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Cập Nhật Loại Thiết Bị</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
          sellerId={currentUser?.id || ''}
          sellerName={currentUser?.name || 'Người bán'}
          isOpen={isSellerReviewsOpen}
          onClose={() => setIsSellerReviewsOpen(false)}
          lang={lang}
        />
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

      {/* Modal: Uy Tín Của Tôi & Lịch Sử Biến Động (GET /api/v1/seller/reputation/me & /history) */}
      {isReputationHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl sm:max-w-4xl w-full p-6 sm:p-7 space-y-4 border border-slate-200 shadow-2xl text-[#24263e] max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shadow-xs">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-lg text-slate-900 tracking-tight">
                      {lang === 'vi' ? 'UY TÍN CỦA TÔI' : 'MY REPUTATION'}
                    </h4>
                    {(() => {
                      const statusMeta = getAssessmentStatusMeta(myReputation?.assessmentStatus);
                      return (
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'vi'
                      ? 'Đánh giá dựa trên tỷ lệ giao dịch thành công và trừ điểm vi phạm hoặc trễ hạn xác nhận'
                      : 'Evaluated on completed transaction success rate and penalty deductions'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshReputation}
                  disabled={isReloadingReputation}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Tải lại số liệu mới nhất từ server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloadingReputation ? 'animate-spin text-[#c34c36]' : ''}`} />
                  <span>{isReloadingReputation ? 'Đang tải...' : 'Tải lại'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReputationHistoryOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Cảnh báo ưu tiên nếu có (hiển thị 5 giây rồi tự ẩn) */}
              {showModalViolationWarning && (myReputation?.sellingRestricted ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Tài khoản đang bị hạn chế bán hàng</span>
                      <span className="text-[11px] text-rose-700">Quyền đăng tin đang tạm khóa. Vui lòng hoàn tất xử lý đơn và liên hệ Quản trị viên.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModalViolationWarning(false)}
                    className="text-rose-500 hover:text-rose-800 p-1 text-xs cursor-pointer"
                    title="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>
              ) : myReputation?.warningCode ? (
                (() => {
                  const warnMeta = getReputationWarningMeta(myReputation.warningCode);
                  if (!warnMeta) return null;
                  return (
                    <div className={`p-3.5 rounded-2xl border text-xs flex items-start justify-between gap-2.5 animate-fadeIn ${warnMeta.badgeClass}`}>
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">{warnMeta.title}</span>
                          <span className="text-[11px] opacity-90">{warnMeta.desc}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowModalViolationWarning(false)}
                        className="hover:opacity-80 p-1 text-xs cursor-pointer"
                        title="Đóng thông báo"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })()
              ) : null)}

              {/* Main Score Hero Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-[#24263e] text-white shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-300 font-bold block">
                      Điểm Uy Tín Tổng Kết
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-4xl sm:text-5xl font-black text-amber-300 font-mono">
                        {myReputation?.score !== null && myReputation?.score !== undefined
                          ? myReputation.score
                          : '—'}
                      </span>
                      <span className="text-base font-bold text-slate-300">/ 100</span>
                      {myReputation?.score === null && (
                        <span className="text-xs font-medium text-slate-300 ml-2">
                          (Chưa có đơn hàng kết thúc)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-right">
                    <div className="bg-white/10 px-3.5 py-2.5 rounded-xl backdrop-blur-xs">
                      <span className="text-[11px] text-slate-300 block font-semibold">Điểm giao dịch</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        {myReputation?.transactionScore !== null && myReputation?.transactionScore !== undefined
                          ? `${myReputation.transactionScore}`
                          : '—'}
                      </span>
                    </div>
                    <div className="bg-white/10 px-3.5 py-2.5 rounded-xl backdrop-blur-xs">
                      <span className="text-[11px] text-slate-300 block font-semibold">Điểm phạt tích lũy</span>
                      <span className={`text-lg font-black font-mono ${(myReputation?.confirmationPenaltyPoints || 0) > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {myReputation?.confirmationPenaltyPoints ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Pills: good / bad / evaluated */}
                <div className="flex flex-wrap items-center gap-2.5 mt-4 pt-3.5 border-t border-white/15 text-xs">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                    {myReputation?.goodTransactions ?? 0} đơn thành công
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold border border-rose-400/30">
                    {myReputation?.badTransactions ?? 0} đơn lỗi Người bán
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-bold border border-white/20">
                    {myReputation?.evaluatedOrders ?? 0} đơn được đánh giá
                  </span>
                </div>
              </div>

              {/* History Table */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 block uppercase tracking-wider">
                    {lang === 'vi' ? 'LỊCH SỬ BIẾN ĐỘNG ĐIỂM UY TÍN' : 'REPUTATION AUDIT TRAIL'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Tổng {reputationHistoryItems.length} sự kiện biến động
                  </span>
                </div>

                {isLoadingReputationHistory ? (
                  <div className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                    <span className="text-xs font-medium">{lang === 'vi' ? 'Đang tải lịch sử...' : 'Loading history...'}</span>
                  </div>
                ) : reputationHistoryItems.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Award className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <span className="text-xs font-bold text-slate-600 block">
                      {lang === 'vi' ? 'Chưa có biến động điểm nào' : 'No reputation score changes yet'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {lang === 'vi'
                        ? 'Tài khoản chưa có sự kiện phạt hoặc đánh giá giao dịch kết thúc.'
                        : 'No penalty or completed order evaluation events recorded yet.'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 text-xs">
                      {paginatedReputationItems.map((item) => {
                        const eventMeta = getReputationEventMeta(item.eventType);
                        const penaltyIncrease = (item.penaltyAfter || 0) - (item.penaltyBefore || 0);

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-3 transition shadow-xs"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${eventMeta.type === 'positive'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : eventMeta.type === 'negative'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                  {eventMeta.label}
                                </span>
                                {item.orderId && (
                                  <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                    Đơn #{item.orderId.substring(0, 8)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {formatReputationReason(item.reason || eventMeta.desc)}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium pt-0.5">
                                <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                                {(item.goodAfter !== undefined || item.badAfter !== undefined) && (
                                  <span>
                                    Mẫu giao dịch: <strong className="text-emerald-700 font-semibold">{item.goodAfter ?? 0} thành công</strong> | <strong className="text-rose-700 font-semibold">{item.badAfter ?? 0} lỗi</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono space-y-1.5 pl-2">
                              {item.scoreBefore !== undefined && item.scoreAfter !== undefined && (
                                <div className="flex items-center gap-1.5 text-xs justify-end font-bold">
                                  <span className="text-slate-400">{item.scoreBefore ?? '—'}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className={(item.scoreAfter || 0) >= (item.scoreBefore || 0) ? 'text-emerald-600' : 'text-rose-600'}>
                                    {item.scoreAfter ?? '—'}
                                  </span>
                                </div>
                              )}
                              {penaltyIncrease > 0 && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  +{penaltyIncrease} phạt
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {totalReputationPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div className="text-slate-500 font-medium">
                          Trang <span className="font-bold text-slate-800">{safeReputationPage + 1}</span> / <span className="font-bold text-slate-800">{totalReputationPages}</span>
                          <span className="text-slate-400 ml-1.5">(10 sự kiện / trang)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReputationPage((p) => Math.max(0, p - 1))}
                            disabled={safeReputationPage === 0}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-bold text-slate-700 cursor-pointer text-xs"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Trước</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalReputationPages }, (_, i) => i).map((pageNum) => {
                              if (
                                pageNum === 0 ||
                                pageNum === totalReputationPages - 1 ||
                                Math.abs(pageNum - safeReputationPage) <= 1
                              ) {
                                return (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setReputationPage(pageNum)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                      safeReputationPage === pageNum
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    {pageNum + 1}
                                  </button>
                                );
                              }
                              if (
                                (pageNum === 1 && safeReputationPage > 2) ||
                                (pageNum === totalReputationPages - 2 && safeReputationPage < totalReputationPages - 3)
                              ) {
                                return (
                                  <span key={pageNum} className="px-1 text-slate-400">
                                    ...
                                  </span>
                                );
                              }
                              return null;
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => setReputationPage((p) => Math.min(totalReputationPages - 1, p + 1))}
                            disabled={safeReputationPage >= totalReputationPages - 1}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-bold text-slate-700 cursor-pointer text-xs"
                          >
                            <span>Sau</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                {myReputation?.updatedAt ? `Cập nhật: ${new Date(myReputation.updatedAt).toLocaleTimeString('vi-VN')}` : ''}
              </span>
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
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${verificationFilterStatus === tab.id
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

      {/* Floating Modern Toast Notification (Positioned at top-right below navbar) */}
      {toastNotice && (
        <div className="fixed top-24 sm:top-28 right-4 sm:right-6 lg:right-8 z-50 animate-in fade-in slide-in-from-top-3">
          <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${toastNotice.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200/50'
            : 'bg-rose-600 text-white border-rose-500 shadow-rose-200/50'
            }`}>
            {toastNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{translateSystemNotification(toastNotice.message)}</span>
          </div>
        </div>
      )}

      {resultListing && resultInspection && hasPreListingInspectionResult(resultInspection) && (
        <DigitalInspectionCertificateModal
          key={`${resultInspection.id}-${resultInspection.status}`}
          order={{ id: resultInspection.id, listing: resultListing, sellerName: currentUser?.name }}
          initialDto={resultInspection}
          lang={lang}
          onClose={() => setResultListing(null)}
        />
      )}

      {/* Modal Tiếp tục Kiểm định bắt buộc trước khi đăng (Pre-Listing Workflow) */}
      {preListingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <PreListingInspectionWorkflow
              postId={preListingPost.id}
              postTitle={preListingPost.title}
              postPrice={preListingPost.priceVnd}
              initialInspectionOrderId={getItemInspectionOrder(preListingPost)?.id || inspectionByPost?.get(preListingPost.id)?.id}
              onClose={() => {
                setPreListingPost(null);
                setInspectionRefresh((previous) => previous + 1);
              }}
              onPostActivated={() => {
                fetchSellerData();
                setInspectionRefresh((previous) => previous + 1);
              }}
              lang={lang}
            />
          </div>
        </div>
      )}
    </div>
  );
};

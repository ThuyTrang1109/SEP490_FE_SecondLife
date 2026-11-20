import { usePanelTab, useBrowserLocation, navigatePath } from '../app/router/browser';
import { resolveAppRoute, panelPaths } from '../app/router/paths';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResizableSidebarControls } from '../components/common/ResizableSidebarControls';
import {
  LayoutDashboard,
  FileCheck,
  AlertTriangle,
  ShieldCheck,
  Flag,
  Scale,
  RotateCcw,
  Wallet,
  TrendingUp,
  UserX,
  LifeBuoy,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Menu,
  Plus,
  Minus,
  Home,
  ArrowRight,
  Send,
  Sparkles,
  ShoppingBag,
  DollarSign,
  AlertOctagon,
  FileText,
  UserCheck,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Listing, EscrowOrder, Language, UserProfile } from '../types';
import { UserAvatar } from '../components/common/UserAvatar';
import { formatVND } from '../utils/translations';
import { staffService, staffListingService, adminPostService, SellerVerificationResponseDto, staffReportService, ReportItemDto, StaffOrderConfirmationResponse, userReportService, reputationService, postService } from '../services';
import { dialogService } from '../utils/dialogService';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { ListingComparisonModal } from '../components/staff/ListingComparisonModal';
import { StaffDisputeManagement } from '../components/staff/StaffDisputeManagement';
import { InspectionCashReviewPanel } from '../components/inspection/InspectionCashReviewPanel';
import { canReviewInspectionCash } from '../utils/inspectionCashShipping';
import { MarkdownContent } from '../components/common/MarkdownDescription';
import logoImg from '../assets/logo.png';
import { User, LogOut } from 'lucide-react';

interface StaffWorkspaceViewProps {
  listings?: Listing[];
  orders?: EscrowOrder[];
  lang?: Language;
  onViewWebsite?: () => void;
  currentUser?: UserProfile | null;
  onOpenProfile?: () => void;
  onLogout?: () => void;
}

type StaffTab =
  | 'overview'
  | 'review-listings'
  | 'reports-support'
  | 'disputes'
  | 'refund-requests'
  | 'payouts'
  | 'monitor-transactions'
  | 'restrict-users';

export const VALID_STAFF_TABS: StaffTab[] = [
  'overview',
  'review-listings',
  'reports-support',
  'disputes',
  'refund-requests',
  'payouts',
  'monitor-transactions',
  'restrict-users'
];

export const STAFF_TAB_STORAGE_KEY = 'secondlife_staff_active_tab';

export function getInitialStaffTab(): StaffTab {
  if (typeof window === 'undefined') return 'overview';
  return (resolveAppRoute(window.location.href, 'staff').section || 'overview') as StaffTab;
}

const ReportEvidenceItem: React.FC<{
  url: string;
  index: number;
  reportId: string;
  onOpen: (src: string, title: string, kind?: 'IMAGE' | 'VIDEO') => void;
}> = ({ url, index, reportId, onOpen }) => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!url) return;

    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      setMediaSrc(url);
      return;
    }

    setLoading(true);
    setHasError(false);

    userReportService
      .getEvidenceBlobUrl(url)
      .then((blobUrl) => {
        if (isMounted) {
          setMediaSrc(blobUrl);
          setMediaKind('IMAGE');
        }
      })
      .catch((err) => {
        console.warn('getEvidenceBlobUrl error, trying loadPrivateEvidenceView:', err);
        userReportService
          .loadPrivateEvidenceView(url)
          .then((view) => {
            if (isMounted) {
              setMediaSrc(view.src);
              setMediaKind(view.kind);
            }
          })
          .catch((viewErr) => {
            console.error('All evidence loaders failed for:', url, viewErr);
            if (isMounted) setHasError(true);
          });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const title = `Bằng chứng ảnh #${index + 1} • Báo cáo #${reportId.slice(0, 8)}`;

  const handleClick = async () => {
    if (mediaSrc) {
      onOpen(mediaSrc, title, mediaKind);
      return;
    }

    setLoading(true);
    setHasError(false);
    try {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        onOpen(url, title, 'IMAGE');
        return;
      }
      try {
        const bUrl = await userReportService.getEvidenceBlobUrl(url);
        setMediaSrc(bUrl);
        setMediaKind('IMAGE');
        onOpen(bUrl, title, 'IMAGE');
        return;
      } catch (err) {
        const view = await userReportService.loadPrivateEvidenceView(url);
        setMediaSrc(view.src);
        setMediaKind(view.kind);
        onOpen(view.src, title, view.kind);
      }
    } catch (finalErr: any) {
      setHasError(true);
      dialogService.error(
        `Không thể tải file bằng chứng: ${finalErr?.message || 'Vui lòng kiểm tra kết nối mạng hoặc thử lại.'}`,
        'Lỗi Tải Bằng Chứng'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition cursor-pointer text-xs font-bold shadow-2xs group ${hasError
        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
        : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50/80 hover:border-indigo-400'
        }`}
      title={hasError ? 'Bấm để thử tải lại ảnh' : 'Bấm để xem ảnh phóng to'}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
      ) : mediaSrc && mediaKind === 'IMAGE' ? (
        <img
          src={mediaSrc}
          alt={title}
          className="w-5 h-5 rounded object-cover border border-slate-200 group-hover:scale-110 transition-transform"
        />
      ) : (
        <Eye className="w-3.5 h-3.5 text-indigo-600" />
      )}
      <span>{hasError ? `Thử lại [Ảnh ${index + 1}]` : `[Ảnh ${index + 1}]`}</span>
    </button>
  );
};

export const StaffWorkspaceView: React.FC<StaffWorkspaceViewProps> = ({
  listings = [],
  orders = [],
  lang = 'vi',
  onViewWebsite,
  currentUser,
  onOpenProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = usePanelTab<StaffTab>('staff', 'overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Evidence preview modal state
  const [evidencePreview, setEvidencePreview] = useState<{
    src: string;
    title: string;
    kind?: 'IMAGE' | 'VIDEO';
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && evidencePreview) {
        setEvidencePreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [evidencePreview]);

  // Trigger notice helper
  const triggerNotice = (msg: string) => {
    setActionNotice(translateSystemNotification(msg));
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Sub-tab filters
  const [listingFilter, setListingFilter] = useState<'ALL' | 'NORMAL' | 'SUSPICIOUS'>('ALL');
  const [reportSubTab, setReportSubTab] = useState<'REPORTS' | 'TICKETS'>('REPORTS');

  // Modals
  const [selectedListingModal, setSelectedListingModal] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Vi phạm giá niêm yết bất thường');

  // Request evidence form state
  const [evidenceTarget, setEvidenceTarget] = useState<'BUYER' | 'SELLER' | 'BOTH'>('BUYER');
  const [evidenceDeadline, setEvidenceDeadline] = useState('24 Giờ');
  const [evidenceContent, setEvidenceContent] = useState('');

  // User restriction form state
  const [restrictTargetUser, setRestrictTargetUser] = useState('hung.spam@gmail.com');
  const [restrictLevel, setRestrictLevel] = useState<'WARN' | 'LOCK_POST' | 'LOCK_ESCROW' | 'SUSPEND'>('LOCK_POST');
  const [restrictReason, setRestrictReason] = useState('Đăng lặp lại 15 tin rác phá giá thị trường');

  // Refund evaluation modal
  const [selectedRefundModal, setSelectedRefundModal] = useState<any | null>(null);
  const [refundDecisionType, setRefundDecisionType] = useState<'FULL' | 'PARTIAL' | 'REJECT'>('FULL');
  const [refundNote, setRefundNote] = useState('');

  // 1. Staff Listings & Moderation State
  const [staffListings, setStaffListings] = useState<any[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);
  const [selectedComparisonPostId, setSelectedComparisonPostId] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [queuePage, setQueuePage] = useState<number>(0);
  const [queueTotalPages, setQueueTotalPages] = useState<number>(1);

  const loadStaffQueue = async (page = 0) => {
    setIsLoadingQueue(true);
    try {
      const res = await staffListingService.getStaffQueue(page, 10);
      const items = res.content || [];

      const enriched = await Promise.all(
        items.map(async (it: any) => {
          const postId = String(it.postId || it.id || '');
          let resolvedSellerId: string = it.sellerId || it.user?.id || '';
          let resolvedSellerName: string =
            it.sellerName || it.user?.fullName || it.user?.email || '';

          if (!resolvedSellerId) {
            const matchedFromProp = listings.find(
              (l) => String(l.id) === postId || (Array.isArray(it.duplicateMatches) && it.duplicateMatches.includes(l.id))
            );
            if (matchedFromProp) {
              resolvedSellerId = matchedFromProp.sellerId || '';
              resolvedSellerName = resolvedSellerName || matchedFromProp.sellerName || '';
            }
          }

          if (!resolvedSellerId && Array.isArray(it.duplicateMatches) && it.duplicateMatches.length > 0) {
            try {
              const dupDetail = await postService.getListingDetail(String(it.duplicateMatches[0]));
              if (dupDetail) {
                resolvedSellerId = dupDetail.sellerId || '';
                resolvedSellerName = resolvedSellerName || dupDetail.sellerName || '';
              }
            } catch {
              // Ignore duplicate detail fetch error
            }
          }

          let sellerRating = Number(it.sellerRating ?? 0);
          let sellerReputationScore: number | null = null;
          let sellerEvaluatedOrders = 0;

          if (resolvedSellerId) {
            try {
              const rep = await reputationService.getSellerReputation(resolvedSellerId);
              if (rep) {
                sellerReputationScore = rep.score ?? null;
                sellerEvaluatedOrders = Number(rep.evaluatedOrders ?? 0);
                if (sellerEvaluatedOrders > 0) {
                  const txScore =
                    rep.transactionScore !== undefined && rep.transactionScore !== null
                      ? Number(rep.transactionScore)
                      : (Number(rep.goodTransactions ?? 0) / sellerEvaluatedOrders) * 100;
                  sellerRating = Math.max(0, Math.min(5, txScore / 20));
                }
              }
            } catch {
              // Ignore reputation fetch error
            }
          }

          const priceVnd = Number(it.price || 0);
          const hasAiSuggested = it.aiSuggestedPrice !== undefined && it.aiSuggestedPrice !== null && Number(it.aiSuggestedPrice) > 0;
          const aiEstimatedPrice = hasAiSuggested ? Number(it.aiSuggestedPrice) : priceVnd;
          const aiConfidence = hasAiSuggested
            ? Math.max(
                15,
                Math.min(
                  98,
                  Math.round((1 - Math.min(0.85, Math.abs(priceVnd - aiEstimatedPrice) / aiEstimatedPrice)) * 100)
                )
              )
            : null;

          return {
            id: postId,
            title: it.title || 'Bài đăng cần duyệt',
            category: it.category || 'Sản phẩm',
            sellerId: resolvedSellerId,
            sellerName:
              resolvedSellerName ||
              (resolvedSellerId ? `Người bán #${resolvedSellerId.slice(0, 8)}` : 'Người bán'),
            sellerRating,
            sellerReputationScore,
            sellerEvaluatedOrders,
            priceVnd,
            aiEstimatedPrice,
            aiConfidence,
            isSuspicious: Boolean(it.duplicateMatches && it.duplicateMatches.length > 0),
            duplicateMatches: it.duplicateMatches || [],
            suspiciousReason:
              it.reviewReason ||
              (it.duplicateMatches?.length
                ? `Phát hiện ${it.duplicateMatches.length} bài đối chiếu nghi trùng`
                : 'Chờ nhân viên duyệt'),
            status: it.status || 'PENDING',
            images: it.imageUrls?.length
              ? it.imageUrls
              : [it.imageUrl || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80'],
            description: it.description || 'Chưa có mô tả',
          };
        })
      );

      setStaffListings(enriched);
      setPendingReviewCount(res.totalElements ?? enriched.length);
      setQueuePage(res.number ?? page);
      setQueueTotalPages(res.totalPages ?? 1);
    } catch (err) {
      console.warn('Load staff queue error:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Fetch count on mount for badge and load on activeTab
  useEffect(() => {
    staffListingService.getStaffQueue(0, 1)
      .then((res) => {
        setPendingReviewCount(res.totalElements ?? 0);
      })
      .catch((err) => console.warn('Get pending review badge count error:', err));
  }, []);

  useEffect(() => {
    if (activeTab === 'review-listings') {
      loadStaffQueue(0);
    }
  }, [activeTab]);

  // 4. Reports & Support Tickets
  const [reports, setReports] = useState<any[]>([]);
  const [backendReports, setBackendReports] = useState<ReportItemDto[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // 9. Staff Orders Monitoring (GET /api/v1/staff/orders)
  const [monitoredOrders, setMonitoredOrders] = useState<StaffOrderConfirmationResponse[]>([]);
  const [isLoadingMonitoredOrders, setIsLoadingMonitoredOrders] = useState(false);

  const loadMonitoredOrders = async () => {
    setIsLoadingMonitoredOrders(true);
    try {
      const res = await staffService.getStaffOrderQueue({ page: 0, size: 50 });
      setMonitoredOrders(res?.items || []);
    } catch (err) {
      console.warn('Load staff monitored orders error:', err);
    } finally {
      setIsLoadingMonitoredOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitor-transactions') {
      loadMonitoredOrders();
    }
  }, [activeTab]);

  const loadBackendReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await staffReportService.getReportQueue();
      if (res?.items && Array.isArray(res.items)) {
        setBackendReports(res.items);
      }
    } catch (err) {
      console.warn('Load staff reports error:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleResolveBackendReport = async (reportId: string, decision: 'CONFIRMED' | 'DISMISSED') => {
    try {
      await staffReportService.resolveReport(reportId, {
        decision,
        responsibleParty: decision === 'CONFIRMED' ? 'SELLER' : 'NONE',
        reason: decision === 'CONFIRMED' ? 'Xử phạt vi phạm quy chế đăng bán của sàn SecondLife' : 'Bác bỏ do không đủ bằng chứng vi phạm',
      });
      triggerNotice(
        decision === 'CONFIRMED'
          ? `Đã xử phạt và xác nhận vi phạm báo cáo #${reportId.slice(0, 8)}`
          : `Đã bác bỏ báo cáo #${reportId.slice(0, 8)}`
      );
      loadBackendReports();
    } catch (err: any) {
      triggerNotice(err?.message || 'Xử lý báo cáo thất bại');
    }
  };

  const handleStartReviewReport = async (reportId: string) => {
    try {
      await staffReportService.startReview(reportId);
      triggerNotice(`Đã tiếp nhận và khóa thẩm định báo cáo #${reportId.slice(0, 8)}`);
      loadBackendReports();
    } catch (err: any) {
      triggerNotice(err?.message || 'Không thể bắt đầu xử lý báo cáo');
    }
  };

  useEffect(() => {
    loadBackendReports();
  }, []);

  // 5. Disputes & Evidence
  const [disputes, setDisputes] = useState<any[]>([]);

  // Synchronize disputes from backend reports queue
  useEffect(() => {
    if (backendReports && backendReports.length > 0) {
      const mappedDisputes = backendReports.map((r) => ({
        id: `DSP-${r.id.slice(0, 8)}`,
        reportId: r.id,
        orderId: r.orderId || `ORD-${r.id.slice(0, 6)}`,
        buyer: r.reporterId ? `Khách hàng #${r.reporterId.slice(0, 6)}` : 'Người mua',
        seller: r.sellerId ? `Người bán #${r.sellerId.slice(0, 6)}` : 'Người bán',
        reason: r.description || r.reasonCode || 'Khiếu nại sản phẩm không đúng mô tả',
        amount: 2500000,
        buyerEvidence: r.evidenceUrls?.[0] || 'evidence_unboxing.mp4',
        sellerEvidence: r.evidenceUrls?.[1] || 'seal_handover_report.pdf',
        status: r.status,
      }));
      setDisputes(mappedDisputes);
    } else {
      setDisputes([
        {
          id: 'DSP-882190',
          orderId: 'ORD-7721A',
          buyer: 'Lê Hoàng Nam (0912.888.xxx)',
          seller: 'Trần Thị Thu Thảo (0933.111.xxx)',
          amount: 4500000,
          reason: 'Máy lạnh có vết móp ở lốc tản nhiệt và thiếu ống đồng so với video niêm phong',
          buyerEvidence: 'unboxing_clip_video.mp4 (Đã tải)',
          sellerEvidence: 'seal_handover_report.pdf (Đã duyệt Hub)',
          status: 'OPEN',
        },
        {
          id: 'DSP-882191',
          orderId: 'ORD-9932B',
          buyer: 'Vũ Quốc Huy (0988.222.xxx)',
          seller: 'Nguyễn Văn Mạnh (0909.333.xxx)',
          amount: 1800000,
          reason: 'Nồi chiên không dầu không vào điện sau 2 ngày nhận hàng',
          buyerEvidence: 'power_plug_test.mp4',
          sellerEvidence: 'hub_test_report.pdf',
          status: 'IN_REVIEW',
        }
      ]);
    }
  }, [backendReports]);

  const handleResolveDispute = async (dsp: any, decision: 'BUYER' | 'SELLER') => {
    if (dsp.reportId) {
      try {
        await staffReportService.resolveReport(dsp.reportId, {
          decision: decision === 'BUYER' ? 'CONFIRMED' : 'DISMISSED',
          responsibleParty: decision === 'BUYER' ? 'SELLER' : 'NONE',
          reason: decision === 'BUYER' ? 'Phán quyết hoàn tiền cho người mua sau khi xác minh bằng chứng' : 'Phán quyết bác khiếu nại và giải ngân cho người bán',
        });
        triggerNotice(decision === 'BUYER' ? `Đã xử lý tranh chấp: Hoàn tiền Escrow cho Người mua đơn ${dsp.orderId}` : `Đã phán quyết bác khiếu nại & giải ngân cho Người bán đơn ${dsp.orderId}`);
        loadBackendReports();
        return;
      } catch (err: any) {
        console.warn('Resolve report via API error:', err);
      }
    }
    triggerNotice(decision === 'BUYER' ? `Đã phán quyết hoàn trả 100% tiền Escrow cho Người mua đơn ${dsp.orderId}` : `Đã phán quyết bác khiếu nại & giải ngân cho Người bán đơn ${dsp.orderId}`);
  };

  // 6. Refund Requests (Đồng bộ từ backendReports và orders thực tế)
  const [refundRequests, setRefundRequests] = useState<any[]>([]);

  useEffect(() => {
    const fromReports = (backendReports || [])
      .filter(
        (r) =>
          r.orderId ||
          r.targetType === 'ORDER' ||
          r.resolutionAction === 'RETURN_AND_REFUND' ||
          r.reasonCode === 'RETURN_NOT_AS_DESCRIBED' ||
          r.reasonCode === 'ITEM_NOT_RECEIVED'
      )
      .map((r) => {
        const relatedOrder = orders.find((o) => o.id === r.orderId);
        return {
          id: `REF-${r.id.slice(0, 8)}`,
          orderId: r.orderId || (relatedOrder ? relatedOrder.id : `ORD-${r.id.slice(0, 6)}`),
          productName: relatedOrder?.listing?.title || 'Sản phẩm khiếu nại hoàn tiền',
          buyerName: relatedOrder?.buyerName || (r.reporterId ? `Người mua #${r.reporterId.slice(0, 6)}` : 'Người mua'),
          amount: r.refundAmount || relatedOrder?.totalPaidVnd || relatedOrder?.itemPriceVnd || 0,
          reason: r.description || 'Yêu cầu trả hàng hoàn tiền do sản phẩm không đúng cam kết',
          status: r.status === 'CONFIRMED' ? 'APPROVED' : r.status === 'DISMISSED' ? 'REJECTED' : 'PENDING_APPROVAL',
          reportId: r.id,
        };
      });

    const fromOrders = (orders || [])
      .filter((o) => o.escrowStatus === 'REFUNDED_TO_BUYER' || o.escrowStatus === 'DISPUTED')
      .filter((o) => !fromReports.some((fr) => fr.orderId === o.id))
      .map((o) => ({
        id: `REF-${o.id.slice(0, 8)}`,
        orderId: o.id,
        productName: o.listing?.title || 'Đơn hàng yêu cầu hoàn tiền',
        buyerName: o.buyerName || 'Người mua',
        amount: o.totalPaidVnd || o.itemPriceVnd || 0,
        reason: 'Khiếu nại giao dịch cần hoàn tiền bảo lãnh Escrow',
        status: o.escrowStatus === 'REFUNDED_TO_BUYER' ? 'APPROVED' : 'PENDING_APPROVAL',
      }));

    setRefundRequests([...fromReports, ...fromOrders]);
  }, [backendReports, orders]);

  // 7. Payouts & Escrow Hold (Case có tranh chấp)
  const [payouts, setPayouts] = useState<any[]>([]);

  // 9. Realtime Transactions Monitoring - Tính toán động từ orders thực tế
  const [transactions, setTransactions] = useState<any[]>([]);
  const escrowStats = useMemo(() => {
    const heldOrders = orders.filter(
      (o) =>
        o.escrowStatus === 'HELD_IN_ESCROW' ||
        o.escrowStatus === 'AWAITING_INSPECTION' ||
        o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
        o.escrowStatus === 'INSPECTION_PASSED' ||
        o.escrowStatus === 'SHIPPED_TO_BUYER' ||
        o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
        o.escrowStatus === 'DISPUTED'
    );
    const totalHeld = heldOrders.reduce((acc, o) => acc + (o.totalPaidVnd || o.itemPriceVnd || 0), 0);

    const releasedOrders = orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED');
    const totalReleased = releasedOrders.reduce((acc, o) => acc + (o.totalPaidVnd || o.itemPriceVnd || 0), 0);

    const totalOrdersCount = orders.length;
    const disputedCount =
      orders.filter((o) => o.escrowStatus === 'DISPUTED').length + disputes.length;
    const safeRate =
      totalOrdersCount > 0
        ? Math.max(0, Math.min(100, ((totalOrdersCount - disputedCount) / totalOrdersCount) * 100)).toFixed(1)
        : '100';

    return {
      totalHeld: totalHeld > 0 ? formatVND(totalHeld) : (monitoredOrders.length > 0 ? formatVND(monitoredOrders.length * 1500000) : '0 ₫'),
      totalReleased: totalReleased > 0 ? formatVND(totalReleased) : '0 ₫',
      safeRate: `${safeRate}%`,
    };
  }, [orders, disputes, monitoredOrders]);

  // 10. Restricted & Warned Users
  const [restrictedUsers, setRestrictedUsers] = useState<any[]>([]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    return staffListings.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (listingFilter === 'NORMAL') return matchSearch && !item.isSuspicious;
      if (listingFilter === 'SUSPICIOUS') return matchSearch && item.isSuspicious;
      return matchSearch;
    });
  }, [staffListings, searchQuery, listingFilter]);

  // Navigation Items
  const navItems = [
    {
      id: 'overview' as StaffTab,
      label: 'DASHBOARD TỔNG QUAN',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'review-listings' as StaffTab,
      label: 'KIỂM DUYỆT TIN ĐĂNG',
      icon: FileCheck,
      badge: pendingReviewCount,
      badgeColor: 'bg-[#24263e] text-white'
    },
    {
      id: 'reports-support' as StaffTab,
      label: 'BÁO CÁO VI PHẠM & HỖ TRỢ',
      icon: Flag,
      badge: (backendReports.length > 0
        ? backendReports.filter((r) => r.status === 'OPEN' || r.status === 'IN_REVIEW').length
        : reports.filter((r) => r.status === 'PENDING').length) + supportTickets.filter((t) => t.status === 'OPEN').length,
      badgeColor: 'bg-indigo-600 text-white'
    },
    {
      id: 'disputes' as StaffTab,
      label: 'TRANH CHẤP & BẰNG CHỨNG',
      icon: Scale,
      badge: disputes.length,
      badgeColor: 'bg-[#c34c36] text-white'
    },
    {
      id: 'refund-requests' as StaffTab,
      label: 'YÊU CẦU HOÀN TIỀN',
      icon: RotateCcw,
      badge: refundRequests.filter((r) => r.status === 'PENDING_APPROVAL').length,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'payouts' as StaffTab,
      label: 'QUẢN LÝ THANH TOÁN & HOLD',
      icon: Wallet,
      badge: payouts.filter((p) => p.status === 'HOLD').length,
      badgeColor: 'bg-amber-700 text-white'
    },
    {
      id: 'monitor-transactions' as StaffTab,
      label: 'GIÁM SÁT GIAO DỊCH',
      icon: TrendingUp,
      badge: null
    },
    {
      id: 'restrict-users' as StaffTab,
      label: 'CẢNH BÁO & HẠN CHẾ USER',
      icon: UserX,
      badge: restrictedUsers.length,
      badgeColor: 'bg-slate-700 text-white'
    }
  ];

  // Actions
  const handleApproveListing = async (id: string) => {
    try {
      await staffListingService.approveStaffListing(id);
      triggerNotice(`Đã phê duyệt bài tin #${id} thành công!`);
      loadStaffQueue(queuePage);
    } catch (err: any) {
      console.warn('Backend approve post error:', err);
      const msg = err?.message || 'Có lỗi khi phê duyệt bài tin.';
      triggerNotice(`Lỗi duyệt tin #${id}: ${msg}`);
    }
    setSelectedListingModal(null);
  };

  const handleRejectListing = async (id: string) => {
    try {
      await staffListingService.rejectStaffListing(id, rejectReason);
      triggerNotice(`Đã từ chối duyệt bài tin #${id}. Lý do: ${rejectReason}`);
      loadStaffQueue(queuePage);
    } catch (err: any) {
      console.warn('Backend reject post error:', err);
      const msg = err?.message || 'Có lỗi khi từ chối bài tin.';
      triggerNotice(`Lỗi từ chối tin #${id}: ${msg}`);
    }
    setSelectedListingModal(null);
  };


  const handleSendEvidenceRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceContent.trim()) {
      dialogService.warning('Vui lòng nhập nội dung yêu cầu bổ sung bằng chứng', 'Thiếu Thông Tin');
      return;
    }
    triggerNotice(
      `Đã gửi yêu cầu bổ sung bằng chứng tới ${evidenceTarget === 'BUYER' ? 'Người mua' : evidenceTarget === 'SELLER' ? 'Người bán' : 'Cả hai bên'} (Hạn chót: ${evidenceDeadline}).`
    );
    setEvidenceContent('');
  };

  const handleApplyRestriction = (e: React.FormEvent) => {
    e.preventDefault();
    triggerNotice(`Đã áp dụng chế tài thành công đối với người dùng ${restrictTargetUser}.`);
  };

  const handleProcessRefund = async () => {
    if (!selectedRefundModal) return;
    try {
      if (selectedRefundModal.reportId) {
        await staffReportService.resolveReport(selectedRefundModal.reportId, {
          decision: refundDecisionType === 'REJECT' ? 'DISMISSED' : 'CONFIRMED',
          resolutionAction: refundDecisionType === 'REJECT' ? 'NONE' : 'RETURN_AND_REFUND',
          reason: refundNote || (refundDecisionType === 'REJECT' ? 'Từ chối yêu cầu hoàn tiền do không đủ căn cứ' : 'Chấp thuận hoàn tiền bảo lãnh Escrow cho người mua'),
          responsibleParty: refundDecisionType === 'REJECT' ? 'NONE' : 'SELLER',
        });
        loadBackendReports();
      }
      setRefundRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRefundModal.id
            ? {
              ...r,
              status: refundDecisionType === 'REJECT' ? 'REJECTED' : 'APPROVED'
            }
            : r
        )
      );
      triggerNotice(
        `Đã xử lý yêu cầu hoàn tiền #${selectedRefundModal.id}: ${refundDecisionType === 'FULL'
          ? 'Hoàn trả 100% tiền Escrow'
          : refundDecisionType === 'PARTIAL'
            ? 'Hoàn trả một phần (khấu trừ cước)'
            : 'Từ chối hoàn tiền'
        }.`
      );
    } catch (err: any) {
      triggerNotice(err?.message || 'Xử lý yêu cầu hoàn tiền thất bại');
    } finally {
      setSelectedRefundModal(null);
      setRefundNote('');
    }
  };

  const handleTogglePayoutHold = (payoutId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'HOLD' ? 'APPROVED' : 'HOLD';
    setPayouts((prev) =>
      prev.map((p) =>
        p.id === payoutId
          ? {
            ...p,
            status: nextStatus,
            holdReason:
              nextStatus === 'HOLD'
                ? 'Tạm giữ can thiệp bởi Staff do phát sinh khiếu nại mới'
                : 'Đã mở khóa tạm giữ & đủ điều kiện giải ngân'
          }
          : p
      )
    );
    triggerNotice(
      nextStatus === 'HOLD'
        ? `Đã TẠM GIỮ (HOLD) khoản thanh toán #${payoutId} để bảo toàn Escrow.`
        : `Đã GIẢI TỎA TẠM GIỮ cho khoản thanh toán #${payoutId}.`
    );
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm w-full">
        {/* Left: Brand Logo + Sidebar Toggle + Quick Home */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </div>
            <span className="font-black text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              STAFF WORKSPACE
            </span>
          </div>

          {/* Mobile navigation trigger */}
          <button
            type="button"
            onClick={() => {
              setIsSidebarCollapsed(false);
              setIsMobileSidebarOpen((open) => !open);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer md:hidden"
            aria-expanded={isMobileSidebarOpen}
            aria-label={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Right: Online status & Staff Profile */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{lang === 'vi' ? 'Trực Tuyến' : 'Online'}</span>
          </div>

          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title={lang === 'vi' ? 'Hồ sơ nhân viên' : 'Staff Profile'}
            >
              <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20">
                <UserAvatar
                  src={currentUser?.avatar}
                  name={currentUser?.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span className="text-xs font-black text-white hidden sm:inline">{currentUser?.name || 'Staff'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
            </button>

            {/* User Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-[#24263e] rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="font-black text-[#24263e] text-xs truncate">
                    {currentUser?.name || (lang === 'vi' ? 'Nhân Viên Vận Hành' : 'Staff Operator')}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium truncate">{currentUser?.email || 'staff@secondlife.vn'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#c34c36]/10 text-[#c34c36] font-extrabold text-[10px]">
                    {lang === 'vi' ? 'Quyền: Điều Phối & Kiểm Duyệt' : 'Role: Staff'}
                  </span>
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                  >
                    <User className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Hồ Sơ Cá Nhân' : 'Staff Profile'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onViewWebsite?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition sm:hidden"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Về Sàn Đồ Cũ' : 'Marketplace'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2 cursor-pointer font-bold transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Đăng Xuất' : 'Log Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE */}
      <div className="flex-1 flex relative">
        {/* LEFT SIDEBAR */}
        <aside
          style={{ width: isSidebarCollapsed ? 64 : sidebarWidth }}
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 max-w-[85vw] flex-col shrink-0 select-none z-30 top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] md:sticky md:flex ${isMobileSidebarOpen ? 'fixed left-0 flex shadow-2xl md:shadow-none' : 'hidden'
            }`}
        >
          {/* User Block */}
          <div
            onClick={() => onOpenProfile?.()}
            className={`p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition ${isSidebarCollapsed ? '' : 'md:pr-11'}`}
            title={lang === 'vi' ? 'Xem hồ sơ cá nhân' : 'View profile'}
          >
            <div className="relative shrink-0">
              <UserAvatar
                src={currentUser?.avatar}
                name={currentUser?.name}
                className="w-10 h-10 rounded-full border border-[#24263e]/20"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0"></span>
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">{currentUser?.name || 'Nhân Viên Vận Hành'}</h4>
              </div>
            )}
          </div>

          <ResizableSidebarControls
            width={sidebarWidth}
            collapsed={isSidebarCollapsed}
            onResize={setSidebarWidth}
            onToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            lang={lang}
          />

          {/* Section Label */}
          <div className="px-4 pt-3.5 pb-1.5 text-[10px] font-black text-[#24263e]/80 uppercase tracking-wider">
            {!isSidebarCollapsed ? 'DANH MỤC NGHIỆP VỤ STAFF' : '•••'}
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer group ${isActive
                    ? 'bg-white text-[#24263e] shadow-sm font-black'
                    : 'text-[#24263e]/80 hover:text-[#24263e] hover:bg-white/40 font-bold'
                    }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-[#24263e]' : 'text-[#24263e]/75 group-hover:text-[#24263e]'
                        }`}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-[#24263e] text-white'
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${isActive ? 'text-[#24263e] translate-x-0.5' : 'text-[#24263e]/50 group-hover:text-[#24263e]'
                          }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#24263e]/10 text-[10px] text-[#24263e]/70 text-center">
              <span className="font-semibold text-[#24263e]">SecondLife Staff Portal</span> v2.4
            </div>
          )}
        </aside>

        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
          ></div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          {/* Breadcrumbs Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'overview'
                  ? 'Dashboard Tổng Quan'
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h1>
              <span className="text-xs text-slate-500 font-normal">Staff Operational Workspace</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => setActiveTab('overview')}
                className="hover:text-[#24263e] transition cursor-pointer"
              >
                Trang Chủ
              </button>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-800 capitalize">
                {activeTab === 'overview' ? 'Dashboard' : navItems.find((n) => n.id === activeTab)?.label || activeTab}
              </span>
            </div>
          </div>

          {/* Action Notification Toast Banner */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-md flex items-center gap-3 animate-in fade-in font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs">{translateSystemNotification(actionNotice)}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}



          {/* ======================================================== */}
          {/* TAB 0: OVERVIEW                                          */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 4 Small Boxes AdminLTE style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e]">
                      {pendingReviewCount}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      TIN ĐĂNG CẦN DUYỆT
                    </div>
                  </div>
                  <ShoppingBag className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('review-listings')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#c34c36]">
                      {disputes.length}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      TRANH CHẤP MỞ
                    </div>
                  </div>
                  <Scale className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('disputes')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-amber-800">
                      {payouts.filter((p) => p.status === 'HOLD').length}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      ĐƠN ESCROW TẠM GIỮ
                    </div>
                  </div>
                  <Lock className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('payouts')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-indigo-900">
                      {supportTickets.filter((t) => t.status === 'OPEN').length + reports.filter((r) => r.status === 'PENDING').length}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      BÁO CÁO & TICKET
                    </div>
                  </div>
                  <Flag className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('reports-support')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Priority Operational Queue Table */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    HÀNG ĐỢI XỬ LÝ KHẨN CẤP (PRIORITY ACTION QUEUE)
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">Cần xử lý trong ca trực</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-4">Loại Nghiệp Vụ</th>
                        <th className="py-2.5 px-4">Mã Vụ Việc</th>
                        <th className="py-2.5 px-4">Đối Tượng / Người Liên Quan</th>
                        <th className="py-2.5 px-4">Nội Dung Cảnh Báo</th>
                        <th className="py-2.5 px-4 text-center">Ưu Tiên</th>
                        <th className="py-2.5 px-4 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-rose-700 whitespace-nowrap">Tranh Chấp Escrow</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">#DSP-501</td>
                        <td className="py-3 px-4 text-slate-700">Lê Văn An vs Hoàng Quốc Khang</td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">Tủ lạnh hỏng blốc nén khi giao tới nơi (14.500.000đ)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">KHẨN CẤP</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setActiveTab('disputes')}
                            className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Xử lý
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-amber-700 whitespace-nowrap">Tin Nghi Vấn AI</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">#POST-8891</td>
                        <td className="py-3 px-4 text-slate-700">Nguyễn Văn Đạt</td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">Giá rao 3.5Tr vs AI định giá 18.5Tr (lệch 81%)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">CAO</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setActiveTab('review-listings')}
                            className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Kiểm duyệt
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-sky-800 whitespace-nowrap">Cảnh Báo Gian Lận</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">#FRD-501</td>
                        <td className="py-3 px-4 text-slate-700">TuanStore</td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">Tin nhắn yêu cầu chuyển cọc ngoài Escrow qua ZaloPay</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">KHẨN CẤP</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setActiveTab('review-listings')}
                            className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Xử lý
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: REVIEW LISTINGS (XEM XÉT TIN ĐĂNG & NGHI VẤN)     */}
          {/* ======================================================== */}
          {activeTab === 'review-listings' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-[#fce5da] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                      XEM XÉT TIN ĐĂNG & TIN CÓ DẤU HIỆU NGHI VẤN
                    </h3>
                    <p className="text-xs text-slate-500">
                      Thẩm định tính xác thực thông tin, hình ảnh và cảnh báo bất thường giá định giá từ AI
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => loadStaffQueue(queuePage)}
                      disabled={isLoadingQueue}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      title="Tải lại danh sách"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
                      <span>Làm mới</span>
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => setListingFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${listingFilter === 'ALL' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                          }`}
                      >
                        Tất cả ({staffListings.length})
                      </button>
                      <button
                        onClick={() => setListingFilter('SUSPICIOUS')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${listingFilter === 'SUSPICIOUS' ? 'bg-rose-700 text-white shadow-xs font-black' : 'text-rose-700'
                          }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Nghi Vấn ({staffListings.filter((l) => l.isSuspicious).length})
                      </button>
                      <button
                        onClick={() => setListingFilter('NORMAL')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${listingFilter === 'NORMAL' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                          }`}
                      >
                        Tin Bình Thường
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo mã tin, tên sản phẩm hoặc tên người bán..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#24263e]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã Tin</th>
                        <th className="py-2.5 px-3">Sản Phẩm</th>
                        <th className="py-2.5 px-3">Người Bán</th>
                        <th className="py-2.5 px-3">Giá Rao Bán</th>
                        <th className="py-2.5 px-3">AI Gợi Ý & Tin Cậy</th>
                        <th className="py-2.5 px-3">Tình Trạng Rủi Ro</th>
                        <th className="py-2.5 px-3 text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredListings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                            {isLoadingQueue ? 'Đang tải hàng chờ duyệt...' : 'Hiện không có tin đăng nào cần kiểm duyệt.'}
                          </td>
                        </tr>
                      ) : (
                        filteredListings.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              #{item.id}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <img src={item.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover border shrink-0" />
                                <div>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                    {item.category}
                                  </span>
                                  <h4 className="font-bold text-slate-900 text-xs mt-0.5 line-clamp-1">{item.title}</h4>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-800 whitespace-nowrap">
                              <span className="font-bold">{item.sellerName}</span>
                              <span className="text-[10px] text-amber-600 font-bold block">
                                {item.sellerEvaluatedOrders > 0
                                  ? `★ ${item.sellerRating.toFixed(1)} / 5.0 (${item.sellerEvaluatedOrders} đơn)`
                                  : item.sellerRating > 0
                                  ? `★ ${item.sellerRating.toFixed(1)} / 5.0`
                                  : 'Chưa có đánh giá'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-black text-[#c34c36] whitespace-nowrap">
                              {formatVND(item.priceVnd)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-slate-700">{formatVND(item.aiEstimatedPrice)}</span>
                              {item.aiConfidence !== null && item.aiConfidence !== undefined && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                  <span>Tin cậy:</span>
                                  <span className={`font-black ${item.aiConfidence < 60 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {item.aiConfidence}%
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {item.isSuspicious ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                    <AlertTriangle className="w-3 h-3" />
                                    {item.duplicateMatches && item.duplicateMatches.length > 0
                                      ? `NGHI TRÙNG (${item.duplicateMatches.length})`
                                      : 'NGHI VẤN CAO'}
                                  </span>
                                  <p className="text-[10px] text-rose-700 max-w-xs line-clamp-1">{item.suspiciousReason}</p>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  Chờ duyệt
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => setSelectedComparisonPostId(item.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md"
                                title="Mở giao diện đối soát và kiểm định chi tiết tin đăng"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span>Xem chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {queueTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      Trang {queuePage + 1} / {queueTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadStaffQueue(Math.max(0, queuePage - 1))}
                        disabled={queuePage === 0 || isLoadingQueue}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Trang trước
                      </button>
                      <button
                        onClick={() => loadStaffQueue(Math.min(queueTotalPages - 1, queuePage + 1))}
                        disabled={queuePage >= queueTotalPages - 1 || isLoadingQueue}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* ======================================================== */}
          {/* TAB 4: REPORTS & SUPPORT (BÁO CÁO & HỖ TRỢ)              */}
          {/* ======================================================== */}
          {activeTab === 'reports-support' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-indigo-600 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                      XỬ LÝ CÁC BÁO CÁO & YÊU CẦU HỖ TRỢ
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tiếp nhận báo cáo vi phạm cộng đồng và giải đáp các ticket hỗ trợ của người dùng
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setReportSubTab('REPORTS')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${reportSubTab === 'REPORTS' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                        }`}
                    >
                      Báo Cáo Vi Phạm ({reports.length})
                    </button>
                    <button
                      onClick={() => setReportSubTab('TICKETS')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${reportSubTab === 'TICKETS' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                        }`}
                    >
                      Ticket Hỗ Trợ ({supportTickets.length})
                    </button>
                  </div>
                </div>

                {reportSubTab === 'REPORTS' && (
                  <div className="space-y-3">
                    {isLoadingReports ? (
                      <div className="py-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Đang tải danh sách báo cáo vi phạm...</span>
                      </div>
                    ) : backendReports.length > 0 ? (
                      backendReports.map((rep) => (
                        <div key={rep.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span className="font-mono text-indigo-900">
                              #{rep.id.slice(0, 8)} • Lý do: {rep.reasonCode}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">{new Date(rep.createdAt).toLocaleString('vi-VN')}</span>
                          </div>
                          <p className="text-slate-700">
                            Nội dung: <strong>{rep.description}</strong>
                          </p>
                          {rep.evidenceUrls && rep.evidenceUrls.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              <span className="text-slate-500 font-semibold text-xs">Bằng chứng:</span>
                              {rep.evidenceUrls.map((url, i) => (
                                <ReportEvidenceItem
                                  key={i}
                                  url={url}
                                  index={i}
                                  reportId={rep.id}
                                  onOpen={(src, title, kind) => setEvidencePreview({ src, title, kind })}
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rep.status === 'CONFIRMED'
                              ? 'bg-rose-100 text-rose-800'
                              : rep.status === 'DISMISSED'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                              }`}>
                              Trạng thái: {rep.status}
                            </span>
                            {rep.status !== 'CONFIRMED' && rep.status !== 'DISMISSED' && (
                              <div className="flex gap-2">
                                {rep.status === 'OPEN' ? (
                                  <button
                                    onClick={() => handleStartReviewReport(rep.id)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Bắt Đầu Xử Lý Khiếu Nại</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleResolveBackendReport(rep.id, 'CONFIRMED')}
                                      className="px-3 py-1.5 bg-[#24263e] text-white rounded-lg font-bold hover:bg-[#c34c36] transition cursor-pointer shadow-xs"
                                    >
                                      Xử Phạt & Khóa Tin
                                    </button>
                                    <button
                                      onClick={() => handleResolveBackendReport(rep.id, 'DISMISSED')}
                                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition cursor-pointer"
                                    >
                                      Bác Bỏ Báo Cáo
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      reports.map((rep) => (
                        <div key={rep.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span className="font-mono text-indigo-900">{rep.id} • {rep.target}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{rep.createdAt}</span>
                          </div>
                          <p className="text-slate-700">
                            Lý do tố cáo: <strong>{rep.reason}</strong> (Bởi {rep.reporter})
                          </p>
                          <div className="flex gap-2 pt-2 border-t border-slate-200">
                            <button
                              onClick={() => triggerNotice(`Đã xử lý phạt đối tượng theo báo cáo ${rep.id}`)}
                              className="px-3 py-1.5 bg-[#24263e] text-white rounded-lg font-bold hover:bg-[#c34c36] transition cursor-pointer"
                            >
                              Xử Phạt & Khóa Tin
                            </button>
                            <button
                              onClick={() => triggerNotice(`Đã bác bỏ báo cáo ${rep.id} do không đủ căn cứ`)}
                              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition cursor-pointer"
                            >
                              Bác Bỏ Báo Cáo
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {reportSubTab === 'TICKETS' && (
                  <div className="space-y-3">
                    {supportTickets.map((tck) => (
                      <div key={tck.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span className="font-mono text-indigo-900">{tck.id} • Khách hàng: {tck.user}</span>
                          <span className="text-slate-400 font-mono text-[11px]">{tck.updatedAt}</span>
                        </div>
                        <p className="text-slate-800 font-bold">{tck.subject}</p>
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => triggerNotice(`Đã gửi phản hồi hướng dẫn tới email ${tck.user}`)}
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition cursor-pointer"
                          >
                            Phản Hồi & Đóng Ticket
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: DISPUTES & REQUEST EVIDENCE                       */}
          {/* ======================================================== */}
          {activeTab === 'disputes' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36]">
                <div className="mb-4">
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    GIẢI QUYẾT TRANH CHẤP & VẬN HÀNH HOÀN HÀNG (DISPUTE WORKSPACE)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phân xử khiếu nại giữa Người Mua & Người Bán, đối chiếu bằng chứng hai bên, tạo chuyến hoàn Lalamove và quyết toán hoàn tiền/phí.
                  </p>
                </div>
                <StaffDisputeManagement currentUserId={currentUser?.id} />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: REFUND REQUESTS (XEM XÉT YÊU CẦU HOÀN TIỀN)        */}
          {/* ======================================================== */}
          {activeTab === 'refund-requests' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-rose-600 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    XEM XÉT CÁC YÊU CẦU HOÀN TIỀN (REFUND REQUESTS)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thẩm định yêu cầu hoàn tiền của người mua trong cửa sổ đổi trả/kiểm định và giải ngân hoàn tiền Escrow
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã Hoàn Tiền</th>
                        <th className="py-2.5 px-3">Mã Đơn Hàng</th>
                        <th className="py-2.5 px-3">Sản Phẩm</th>
                        <th className="py-2.5 px-3">Người Mua</th>
                        <th className="py-2.5 px-3">Số Tiền Yêu Cầu</th>
                        <th className="py-2.5 px-3">Lý Do Hoàn Tiền</th>
                        <th className="py-2.5 px-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {refundRequests.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Hiện không có yêu cầu hoàn tiền nào cần thẩm định.
                          </td>
                        </tr>
                      ) : (
                        refundRequests.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-rose-700">{item.id}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.orderId}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{item.productName}</td>
                            <td className="py-3 px-3 text-slate-800">{item.buyerName}</td>
                            <td className="py-3 px-3 font-black text-rose-700 whitespace-nowrap">{formatVND(item.amount)}</td>
                            <td className="py-3 px-3 text-slate-600 max-w-xs">{item.reason}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => setSelectedRefundModal(item)}
                                className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold transition cursor-pointer"
                              >
                                Thẩm Định Hoàn
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: PAYOUTS & HOLD (XEM XÉT / PHÊ DUYỆT / TẠM GIỮ)      */}
          {/* ======================================================== */}
          {activeTab === 'payouts' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-amber-600 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    XEM XÉT / PHÊ DUYỆT / TẠM GIỮ KHOẢN THANH TOÁN (CASE CÓ TRANH CHẤP)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kiểm soát dòng tiền giải ngân người bán, tạm giữ (HOLD) các đơn hàng phát sinh tranh chấp hoặc nghi vấn
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã Chi Trả</th>
                        <th className="py-2.5 px-3">Mã Đơn</th>
                        <th className="py-2.5 px-3">Người Nhận (Seller)</th>
                        <th className="py-2.5 px-3">Số Tiền Giải Ngân</th>
                        <th className="py-2.5 px-3">Tài Khoản Ngân Hàng</th>
                        <th className="py-2.5 px-3">Trạng Thái & Lý Do Giữ</th>
                        <th className="py-2.5 px-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.id}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">{item.orderId}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{item.sellerName}</td>
                          <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{formatVND(item.amount)}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{item.bank}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item.status === 'HOLD'
                                ? 'bg-rose-100 text-rose-900 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                }`}
                            >
                              {item.status === 'HOLD' ? 'ĐANG TẠM GIỮ (HOLD)' : 'ĐÃ DUYỆT GIẢI NGÂN'}
                            </span>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs">{item.holdReason}</p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleTogglePayoutHold(item.id, item.status)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${item.status === 'HOLD'
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-rose-700 hover:bg-rose-800 text-white'
                                }`}
                            >
                              {item.status === 'HOLD' ? 'Gỡ Tạm Giữ' : 'Tạm Giữ (Hold)'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {/* ======================================================== */}
          {/* TAB 9: MONITOR TRANSACTIONS (GIÁM SÁT GIAO DỊCH)          */}
          {/* ======================================================== */}
          {activeTab === 'monitor-transactions' && (
            <div className="space-y-4">
              {canReviewInspectionCash(currentUser) && <InspectionCashReviewPanel />}
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-sky-600 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    GIÁM SÁT CÁC GIAO DỊCH (REALTIME ESCROW MONITORING)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi lưu lượng ký quỹ, giải ngân và luồng tiền bảo lãnh thanh toán qua cổng ngân hàng
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Tổng Escrow Đang Bảo Chứng</span>
                    <span className="text-xl font-black text-[#24263e]">{escrowStats.totalHeld}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Giải Ngân Trong 24 Giờ</span>
                    <span className="text-xl font-black text-emerald-700">{escrowStats.totalReleased}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Tỷ Lệ Giao Dịch An Toàn</span>
                    <span className="text-xl font-black text-indigo-900">{escrowStats.safeRate}</span>
                  </div>
                </div>

                {/* Real Monitored Orders Queue from Backend */}
                <div className="overflow-x-auto">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-xs text-slate-800">
                      Hàng Đợi Đơn Hàng Cần Người Bán Xác Nhận ({monitoredOrders.length})
                    </span>
                    <button
                      onClick={loadMonitoredOrders}
                      disabled={isLoadingMonitoredOrders}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonitoredOrders ? 'animate-spin' : ''}`} />
                      <span>Làm mới hàng đợi</span>
                    </button>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold uppercase">
                        <th className="py-2.5 px-3">Mã Đơn & Bài Đăng</th>
                        <th className="py-2.5 px-3">Trạng Thái Đơn</th>
                        <th className="py-2.5 px-3">Xác Nhận Của Seller</th>
                        <th className="py-2.5 px-3">Hạn Chót Xác Nhận</th>
                        <th className="py-2.5 px-3">Điểm Phạt Quá Hạn</th>
                        <th className="py-2.5 px-3">Thời Điểm Trả Tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingMonitoredOrders ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                            <span>Đang kiểm tra hàng đợi đơn hàng từ máy chủ...</span>
                          </td>
                        </tr>
                      ) : monitoredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Hiện không có đơn hàng nào chờ seller xác nhận hoặc cần giám sát đặc biệt.
                          </td>
                        </tr>
                      ) : (
                        monitoredOrders.map((ord) => (
                          <tr key={ord.orderId} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-slate-900 text-[11px]">#{ord.orderId.slice(0, 8)}</div>
                              <div className="font-semibold text-slate-700 truncate max-w-xs">{ord.postTitle}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ord.confirmationStatus === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.confirmationStatus === 'PENDING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : ord.confirmationStatus === 'CANCELLED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                              >
                                {ord.confirmationStatus === 'CONFIRMED'
                                  ? 'Đã Xác Nhận'
                                  : ord.confirmationStatus === 'PENDING'
                                    ? 'Đang Chờ Seller'
                                    : ord.confirmationStatus === 'CANCELLED'
                                      ? 'Đã Hủy Đơn'
                                      : 'Không Yêu Cầu'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                              {ord.confirmationDeadline
                                ? new Date(ord.confirmationDeadline).toLocaleString('vi-VN')
                                : '—'}
                            </td>
                            <td className="py-3 px-3">
                              {ord.latePenaltyPoints ? (
                                <span className="font-bold text-rose-600">-{ord.latePenaltyPoints} điểm</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                              {ord.paidAt ? new Date(ord.paidAt).toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 10: RESTRICT USERS (CẢNH BÁO & HẠN CHẾ USER)          */}
          {/* ======================================================== */}
          {activeTab === 'restrict-users' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-slate-800 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    CẢNH BÁO NGƯỜI DÙNG VÀ ÁP DỤNG HẠN CHẾ TẠM THỜI (KHI ĐƯỢC CẤP QUYỀN)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Xử lý chế tài các tài khoản spam, cố tình giao dịch ngoài sàn hoặc vi phạm chính sách kiểm định
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã User</th>
                        <th className="py-2.5 px-3">Họ Tên</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Số Lần Vi Phạm</th>
                        <th className="py-2.5 px-3">Mức Chế Tài</th>
                        <th className="py-2.5 px-3">Lý Do</th>
                        <th className="py-2.5 px-3">Thời Hạn Đến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {restrictedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.id}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{u.name}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                          <td className="py-3 px-3 text-center font-bold text-rose-700">{u.violationCount}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200">
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 max-w-xs">{u.reason}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{u.expiresAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Form Áp Dụng Chế Tài */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <h4 className="font-black text-xs text-slate-900 uppercase">
                      ÁP DỤNG CHẾ TÀI HẠN CHẾ TẠM THỜI MỚI
                    </h4>
                    <form onSubmit={handleApplyRestriction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">Email / Tài khoản người dùng:</label>
                        <input
                          type="text"
                          value={restrictTargetUser}
                          onChange={(e) => setRestrictTargetUser(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#24263e]"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">Mức độ hạn chế:</label>
                        <select
                          value={restrictLevel}
                          onChange={(e) => setRestrictLevel(e.target.value as any)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#24263e]"
                        >
                          <option value="WARN">Gửi Cảnh Cáo Chính Thức</option>
                          <option value="LOCK_POST">Tạm Khóa Đăng Tin (7 Ngày)</option>
                          <option value="LOCK_ESCROW">Tạm Ngưng Rút Tiền Escrow</option>
                          <option value="SUSPEND">Tạm Đình Chỉ Tài Khoản (14 Ngày)</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">Lý do xử lý chế tài:</label>
                        <input
                          type="text"
                          value={restrictReason}
                          onChange={(e) => setRestrictReason(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#24263e]"
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-slate-900 hover:bg-[#c34c36] text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Áp Dụng Hạn Chế & Gửi Thông Báo
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: XEM CHI TIẾT TIN ĐĂNG                             */}
      {/* ======================================================== */}
      {selectedListingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  THẨM ĐỊNH BÀI ĐĂNG #{selectedListingModal.id}
                </h3>
                <p className="text-slate-500 text-[11px]">{selectedListingModal.title}</p>
              </div>
              <button
                onClick={() => setSelectedListingModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <img
                src={selectedListingModal.images[0]}
                alt=""
                className="w-full h-48 rounded-xl object-cover border"
              />
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">Người bán:</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {selectedListingModal.sellerName}{' '}
                    {selectedListingModal.sellerEvaluatedOrders > 0
                      ? `(Đánh giá: ★ ${selectedListingModal.sellerRating.toFixed(1)} / 5.0 • ${selectedListingModal.sellerEvaluatedOrders} đơn)`
                      : selectedListingModal.sellerRating > 0
                      ? `(Đánh giá: ★ ${selectedListingModal.sellerRating.toFixed(1)})`
                      : '(Chưa có đánh giá)'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">Giá rao bán:</span>
                  <span className="font-black text-base text-[#c34c36]">
                    {formatVND(selectedListingModal.priceVnd)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">AI Định giá thị trường:</span>
                  <span className="font-black text-base text-slate-800">
                    {formatVND(selectedListingModal.aiEstimatedPrice)}
                    {selectedListingModal.aiConfidence !== null && selectedListingModal.aiConfidence !== undefined
                      ? ` (Độ tin cậy: ${selectedListingModal.aiConfidence}%)`
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">Mô tả của người bán:</span>
              <MarkdownContent content={selectedListingModal.description} />
            </div>

            {selectedListingModal.isSuspicious && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>DẤU HIỆU NGHI VẤN TỪ AI:</span>
                </div>
                <p className="text-xs">{selectedListingModal.suspiciousReason}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full sm:w-auto p-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
              >
                <option value="Vi phạm giá niêm yết bất thường">Lý do từ chối: Giá bất thường</option>
                <option value="Hình ảnh mờ hoặc trùng lặp bản quyền">Lý do từ chối: Ảnh mờ/đạo nhái</option>
                <option value="Nghi vấn hàng nhái không rõ nguồn gốc">Lý do từ chối: Nghi vấn hàng nhái</option>
              </select>

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleRejectListing(selectedListingModal.id)}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  Từ Chối Tin
                </button>
                <button
                  onClick={() => handleApproveListing(selectedListingModal.id)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  Phê Duyệt Tin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: THẨM ĐỊNH HOÀN TIỀN                               */}
      {/* ======================================================== */}
      {selectedRefundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  THẨM ĐỊNH HOÀN TIỀN #{selectedRefundModal.id}
                </h3>
                <p className="text-slate-500 text-[11px]">Đơn hàng: #{selectedRefundModal.orderId}</p>
              </div>
              <button
                onClick={() => setSelectedRefundModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Số tiền yêu cầu hoàn:</span>
                <span className="font-black text-rose-700 text-sm">{formatVND(selectedRefundModal.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Người mua:</span>
                <span className="font-bold text-slate-800">{selectedRefundModal.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Lý do:</span>
                <span className="font-medium text-slate-700 max-w-xs text-right">{selectedRefundModal.reason}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-800 block">Quyết định thẩm định hoàn tiền:</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 font-bold text-slate-800">
                  <input
                    type="radio"
                    name="refundDecision"
                    checked={refundDecisionType === 'FULL'}
                    onChange={() => setRefundDecisionType('FULL')}
                  />
                  <span>Hoàn trả 100% qua Escrow ({formatVND(selectedRefundModal.amount)})</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 font-bold text-slate-800">
                  <input
                    type="radio"
                    name="refundDecision"
                    checked={refundDecisionType === 'PARTIAL'}
                    onChange={() => setRefundDecisionType('PARTIAL')}
                  />
                  <span>Hoàn trả một phần (Trừ phí vận chuyển 150.000đ)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 font-bold text-rose-700">
                  <input
                    type="radio"
                    name="refundDecision"
                    checked={refundDecisionType === 'REJECT'}
                    onChange={() => setRefundDecisionType('REJECT')}
                  />
                  <span>Bác bỏ yêu cầu hoàn tiền (Sản phẩm không có lỗi)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">Ghi chú quyết định:</label>
              <textarea
                rows={2}
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="Nhập căn cứ xử lý hoàn tiền..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedRefundModal(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleProcessRefund}
                className="px-5 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl font-black transition cursor-pointer"
              >
                Xác Nhận Xử Lý Hoàn Tiền
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ======================================================== */}
      {/* 2-COLUMN COMPARISON MODAL FOR STAFF LISTING REVIEW        */}
      {/* ======================================================== */}
      {selectedComparisonPostId && (
        <ListingComparisonModal
          postId={selectedComparisonPostId}
          onClose={() => setSelectedComparisonPostId(null)}
          onActionSuccess={(msg) => {
            triggerNotice(msg);
            loadStaffQueue(queuePage);
          }}
        />
      )}

      {/* ======================================================== */}
      {/* EVIDENCE MEDIA PREVIEW MODAL                             */}
      {/* ======================================================== */}
      {evidencePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEvidencePreview(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-slate-900 rounded-2xl p-4 shadow-2xl flex flex-col border border-slate-700 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-bold text-xs sm:text-sm truncate">{evidencePreview.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={evidencePreview.src}
                  target="_blank"
                  rel="noreferrer"
                  download={`evidence_${Date.now()}`}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition flex items-center gap-1.5 font-medium cursor-pointer"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở tab mới</span>
                </a>
                <button
                  type="button"
                  onClick={() => setEvidencePreview(null)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center cursor-pointer font-bold text-sm"
                  title="Đóng (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[220px] max-h-[75vh]">
              {evidencePreview.kind === 'VIDEO' ? (
                <video src={evidencePreview.src} controls autoPlay className="max-h-[72vh] max-w-full rounded-xl shadow-lg" />
              ) : (
                <img
                  src={evidencePreview.src}
                  alt={evidencePreview.title}
                  className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

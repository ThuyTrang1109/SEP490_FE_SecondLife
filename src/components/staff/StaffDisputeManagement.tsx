import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileText,
  DollarSign,
  User,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Send,
  Loader2,
  Package
} from 'lucide-react';
import {
  staffReportService,
  ReportItemDto,
  ReportStatus,
  userReportService,
  ReportSubmissionResponse,
  shippingService,
  returnShippingFeeService,
  ReturnShippingFeeResponse,
  ReturnShippingFeeStatus,
} from '../../services';
import { ShipmentBackend, ShipmentEventBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import { DisputeEvidenceThumbnail } from '../common/DisputeEvidenceThumbnail';
import {
  DISPUTE_REASON_MAP,
  RESPONSIBLE_PARTY_MAP,
  LALAMOVE_STATUS_MAP,
  formatDisputeReason
} from '../../utils/orders/orderDispute';

const DISPUTE_STATUS_MAP: Record<string, { label: string; bg: string }> = {
  ALL: { label: 'Tất cả', bg: '' },
  OPEN: { label: 'Chờ xử lý', bg: 'bg-rose-100 text-rose-800' },
  IN_REVIEW: { label: 'Đang xem xét', bg: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Đã chấp thuận', bg: 'bg-emerald-100 text-emerald-800' },
  DISMISSED: { label: 'Đã bác bỏ', bg: 'bg-slate-200 text-slate-700' },
};

interface StaffDisputeManagementProps {
  currentUserId?: string;
  canHandleReturns: boolean;
  initialReportId?: string;
  returnOnly?: boolean;
  onOpenOrderModal?: (orderId: string) => void;
}

export const StaffDisputeManagement: React.FC<StaffDisputeManagementProps> = ({
  currentUserId,
  canHandleReturns,
  initialReportId,
  returnOnly = false,
  onOpenOrderModal,
}) => {
  const [reports, setReports] = useState<ReportItemDto[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(returnOnly ? 'CONFIRMED' : 'ALL');
  const [queuePage, setQueuePage] = useState(0);
  const [queuePages, setQueuePages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Selected report detail state
  const [selectedReport, setSelectedReport] = useState<ReportItemDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [responses, setResponses] = useState<ReportSubmissionResponse[]>([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [, refreshDeadline] = useState(0);
  const responseDeadline = Date.parse(selectedReport?.sellerResponseDeadlineAt ?? '');
  const responseTime = Date.parse(selectedReport?.sellerRespondedAt ?? '');
  const sellerResponded = Number.isFinite(responseTime) &&
    (!Number.isFinite(responseDeadline) || responseTime < responseDeadline);
  const sellerMissedDeadline = Boolean(selectedReport?.orderId) && !sellerResponded && Date.now() >= responseDeadline;
  const canReview = !selectedReport?.orderId || sellerResponded || sellerMissedDeadline;
  const canRequestSellerResponse = Boolean(selectedReport?.orderId) && !sellerResponded && !Number.isFinite(responseDeadline)
    && (selectedReport?.status === 'OPEN' || (selectedReport?.status === 'IN_REVIEW' && selectedReport.reviewerId === currentUserId));

  useEffect(() => {
    const delay = responseDeadline - Date.now();
    if (!(delay > 0) || sellerResponded) return;
    const timeout = setTimeout(() => refreshDeadline((value) => value + 1), delay + 50);
    return () => clearTimeout(timeout);
  }, [responseDeadline, sellerResponded]);
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [feeAssessment, setFeeAssessment] = useState<ReturnShippingFeeResponse | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<ShipmentEventBackend[]>([]);

  // Action states
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveChoice, setResolveChoice] = useState<'RETURN' | 'DISMISS'>(canHandleReturns ? 'RETURN' : 'DISMISS');
  const detailVersion = React.useRef(0);
  const [resolveReason, setResolveReason] = useState('');

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileOrderCode, setReconcileOrderCode] = useState('');

  // Media preview state
  const [previewMedia, setPreviewMedia] = useState<{ kind: 'IMAGE' | 'VIDEO'; src: string } | null>(null);
  const [loadingMediaUrl, setLoadingMediaUrl] = useState<string | null>(null);

  // Fetch report queue
  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    setActionError(null);
    try {
      const statusParam = statusFilter === 'ALL' ? undefined : (statusFilter as ReportStatus);
      const res = await staffReportService.getReportQueue(statusParam, 'ORDER', queuePage, 50);
      setQueuePages(res.totalPages);
      setReports(returnOnly ? res.items.filter((item) => item.resolutionAction === 'RETURN_AND_REFUND') : res.items);
    } catch (err: any) {
      console.error('[StaffDisputeManagement] Failed to fetch queue:', err);
      setActionError(err?.message || 'Không thể tải danh sách khiếu nại.');
    } finally {
      setLoadingQueue(false);
    }
  }, [statusFilter, queuePage, returnOnly]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Load detailed report data
  const loadReportDetail = useCallback(async (reportId: string) => {
    const version = ++detailVersion.current;
    setLoadingDetail(true);
    setResponsesLoaded(false);
    setActionError(null);
    try {
      const rep = await staffReportService.getReportById(reportId);
      if (version !== detailVersion.current) return;
      if (!rep.orderId) throw new Error('Đây là báo cáo bài đăng. Xem tại tab Báo cáo vi phạm và hỗ trợ.');
      setSelectedReport(rep);

      const [proof, shipList] = await Promise.all([
        (async () => {
          const first = await userReportService.getReportResponses(reportId, 0, 100);
          const all = [...first.items];
          for (let page = 1; page < first.totalPages && version === detailVersion.current; page++) {
            all.push(...(await userReportService.getReportResponses(reportId, page, 100)).items);
          }
          return all;
        })(),
        rep.returnShipmentId ? shippingService.getOrderShipments(rep.orderId) : Promise.resolve([]),
      ]);
      if (version !== detailVersion.current) return;
      setResponses(proof);
      setResponsesLoaded(true);
      setShipments(shipList);

      const returnShip = shipList.find((item) => item.leg === 'BUYER_TO_SELLER' && item.shipmentId === rep.returnShipmentId);
      if (returnShip) {
        const [events, fee] = await Promise.all([
          shippingService.getShipmentEvents(returnShip.shipmentId).catch(() => []),
          canHandleReturns && rep.refundedAt && rep.responsibleParty === 'SELLER'
            ? returnShippingFeeService.getReturnShippingFee(returnShip.shipmentId).catch(() => null)
            : null,
        ]);
        if (version !== detailVersion.current) return;
        setShipmentEvents(events);
        setFeeAssessment(fee);
      }
    } catch (err: unknown) {
      if (version === detailVersion.current) {
        setActionError(err instanceof Error ? err.message : 'Không tải được chi tiết hồ sơ hoặc dữ liệu đối chiếu.');
      }
    } finally {
      if (version === detailVersion.current) setLoadingDetail(false);
    }
  }, [canHandleReturns]);

  const waitingReportId = selectedReport && !canReview &&
    (selectedReport.status === 'OPEN' || selectedReport.status === 'IN_REVIEW') ? selectedReport.id : null;

  const waitingDeadline = selectedReport?.sellerResponseDeadlineAt;
  useEffect(() => {
    if (!waitingReportId) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const updated = await staffReportService.getReportById(waitingReportId);
        if (active && (updated.sellerRespondedAt || updated.sellerResponseDeadlineAt !== waitingDeadline || updated.status === 'CONFIRMED' || updated.status === 'DISMISSED')) {
          void loadReportDetail(waitingReportId);
        }
      } catch {
        // The report remains locked until a fresh read succeeds.
      }
    }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [waitingReportId, waitingDeadline, loadReportDetail]);

  const pendingRefundId = selectedReport?.resolutionAction === 'RETURN_AND_REFUND' &&
    selectedReport.returnShipmentId && !selectedReport.refundedAt ? selectedReport.id : null;

  useEffect(() => {
    if (!pendingRefundId || isProcessing) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const checkRefund = async () => {
      if (!document.hidden) {
        try {
          const report = await staffReportService.getReportById(pendingRefundId);
          if (active && report.refundedAt) {
            void loadReportDetail(pendingRefundId);
            return;
          }
        } catch {
          // Retry on the next refresh.
        }
      }
      if (active) timer = setTimeout(checkRefund, 10000);
    };
    timer = setTimeout(checkRefund, 10000);
    return () => { active = false; clearTimeout(timer); };
  }, [pendingRefundId, isProcessing, loadReportDetail]);

  const openReport = useCallback((reportId: string) => {
    setSelectedReportId(reportId);
    setSelectedReport(null);
    setResponses([]);
    setShipments([]);
    setFeeAssessment(null);
    setShipmentEvents([]);
    setActionSuccess(null);
    void loadReportDetail(reportId);
  }, [loadReportDetail]);

  useEffect(() => {
    if (initialReportId) openReport(initialReportId);
  }, [initialReportId, openReport]);

  const handleSelectReport = (rep: ReportItemDto) => {
    if (!isProcessing) openReport(rep.id);
  };

  // Helper to load private media
  const handleOpenMedia = async (evidenceUrl: string) => {
    setLoadingMediaUrl(evidenceUrl);
    try {
      const view = await userReportService.loadPrivateEvidenceView(evidenceUrl);
      setPreviewMedia({ kind: view.kind, src: view.src });
    } catch (err: any) {
      alert(`Không thể tải bằng chứng: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setLoadingMediaUrl(null);
    }
  };

  const handleRequestSellerResponse = async () => {
    if (!selectedReport || !canRequestSellerResponse || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const updated = await staffReportService.requestSellerResponse(selectedReport.id);
      setSelectedReport(updated);
      setActionSuccess('Đã thông báo cho người bán. Hạn phản hồi là 24 giờ kể từ lúc gửi.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không gửi được yêu cầu phản hồi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Start Review
  const handleStartReview = async () => {
    if (!selectedReport || !canReview) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const updated = await staffReportService.startReview(selectedReport.id);
      setSelectedReport(updated);
      setActionSuccess('Đã tiếp nhận hồ sơ tranh chấp vào danh sách đang xem xét.');
      fetchQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể nhận xử lý báo cáo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Resolve Dispute
  const handleConfirmResolve = async () => {
    if (!selectedReport || !currentUserId || selectedReport.reviewerId !== currentUserId || !responsesLoaded || !canReview) return;
    if (resolveChoice === 'RETURN' && !canHandleReturns) return;
    if (!resolveReason.trim()) {
      alert('Vui lòng nhập lý do/căn cứ đưa ra phán quyết.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      const resolutionAction = resolveChoice === 'RETURN' ? 'RETURN_AND_REFUND' : 'NONE';
      const updated = await staffReportService.resolveReport(selectedReport.id, {
        decision: resolveChoice === 'DISMISS' ? 'DISMISSED' : 'CONFIRMED',
        reason: resolveReason.trim(),
        resolutionAction,
      });
      setSelectedReport(updated);
      setShowResolveModal(false);
      setActionSuccess(
        resolveChoice === 'RETURN' ? 'Đã duyệt trả hàng. Đang chờ người mua tạo vận đơn hoàn.'
          : updated.responsibleParty === 'SELLER'
            ? 'Đã bác yêu cầu trả hàng và ghi nhận người bán quá hạn phản hồi.'
            : 'Đã bác khiếu nại và đóng hồ sơ.'
      );
      fetchQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể lưu phán quyết tranh chấp.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Sync Return Shipment
  const handleSyncShipment = async (shipmentId: string) => {
    if (!selectedReport) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await shippingService.syncShipment(shipmentId);
      setActionSuccess('Đã đồng bộ trạng thái mới nhất từ hãng vận chuyển.');
      loadReportDetail(selectedReport.id);
    } catch (err: any) {
      setActionError(err?.message || 'Lỗi đồng bộ vận đơn.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Cancel Return Shipment
  const handleCancelShipment = async (shipmentId: string) => {
    if (!selectedReport) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy vận đơn hoàn này trước khi tài xế lấy hàng?')) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await shippingService.cancelShipment(shipmentId);
      setActionSuccess('Đã gửi yêu cầu hủy vận đơn hoàn hàng.');
      loadReportDetail(selectedReport.id);
    } catch (err: any) {
      setActionError(err?.message || 'Không thể hủy vận đơn.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Reconcile Shipment Creation
  const handleReconcileCreation = async (shipmentId: string) => {
    if (!selectedReport || !reconcileOrderCode.trim()) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await shippingService.reconcileCreation(shipmentId, reconcileOrderCode.trim());
      setShowReconcileModal(false);
      setActionSuccess('Đã đối soát vận đơn thành công.');
      loadReportDetail(selectedReport.id);
    } catch (err: any) {
      setActionError(err?.message || 'Đối soát vận đơn thất bại.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Chốt phí hoàn PENDING_FEE
  const handleFinalizePendingFee = async (returnShipmentId: string) => {
    if (!selectedReport || !canHandleReturns || selectedReturnShipment?.shipmentId !== returnShipmentId || selectedReturnShipment.status !== 'DELIVERED') return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await shippingService.refundShipment(returnShipmentId, {
        reason: 'Chốt phí hoàn hàng thực tế từ hãng vận chuyển vào công nợ seller.',
      });
      setActionSuccess('Đã chốt khoản phí hoàn hàng và thu/ghi nợ người bán thành công!');
      loadReportDetail(selectedReport.id);
    } catch (err: any) {
      setActionError(err?.message || 'Lỗi chốt phí hoàn hàng.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.orderId && r.orderId.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  // Selected return shipment logic
  const selectedReturnShipment = shipments.find(
    (s) =>
      s.leg === 'BUYER_TO_SELLER' &&
      s.shipmentId === selectedReport?.returnShipmentId
  );

  const buyerResponses = responses.filter((r) => r.authorRole === 'BUYER');
  const sellerResponses = responses.filter((r) => r.authorRole === 'SELLER');

  const isApproved =
    selectedReport?.status === 'CONFIRMED' &&
    selectedReport?.resolutionAction === 'RETURN_AND_REFUND';
  const isRefunded = !!selectedReport?.refundedAt;

  return (
    <div className="space-y-6">
      {queuePages > 1 && (
        <div className="flex justify-end gap-3 text-xs">
          <button disabled={loadingQueue || queuePage === 0} onClick={() => setQueuePage(queuePage - 1)}>Trang trước</button>
          <span>Trang {queuePage + 1} / {queuePages}</span>
          <button disabled={loadingQueue || queuePage + 1 >= queuePages} onClick={() => setQueuePage(queuePage + 1)}>Trang sau</button>
        </div>
      )}

      {/* Notifications / Alerts */}
      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {/* Main Workspace Layout: Queue on Left, Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Queue of Disputes */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[750px]">
          {/* Queue Header & Filters */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[#c34c36]" />
                <span>Hàng đợi tranh chấp ({filteredReports.length})</span>
              </h3>
              <button
                onClick={() => { void fetchQueue(); if (selectedReportId) void loadReportDetail(selectedReportId); }}
                disabled={loadingQueue}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
              {['ALL', 'OPEN', 'IN_REVIEW', 'CONFIRMED', 'DISMISSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => { setQueuePage(0); setStatusFilter(st); }}
                  className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${statusFilter === st
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                  {DISPUTE_STATUS_MAP[st]?.label || st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã vụ việc, đơn hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#c34c36] focus:outline-none"
              />
            </div>
          </div>

          {/* Queue Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingQueue ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#c34c36]" />
                <span>Đang tải hàng đợi tranh chấp...</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-1">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Không có khiếu nại nào phù hợp</p>
              </div>
            ) : (
              filteredReports.map((item) => {
                const isSelected = selectedReportId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectReport(item)}
                    className={`p-3.5 transition cursor-pointer text-xs space-y-1.5 ${isSelected ? 'bg-amber-50/70 border-l-4 border-l-[#c34c36]' : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">
                        #{item.id.substring(0, 8)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${DISPUTE_STATUS_MAP[item.status]?.bg || 'bg-slate-200 text-slate-700'
                          }`}
                      >
                        {DISPUTE_STATUS_MAP[item.status]?.label || item.status}
                      </span>
                    </div>

                    <p className="text-slate-700 line-clamp-2 text-[11px] leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Đơn #{item.orderId ? item.orderId.substring(0, 8) : 'N/A'}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Dispute Detail & Operations */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[750px]">
          {loadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
              <span>Đang tải thông tin chi tiết vụ việc...</span>
            </div>
          ) : !selectedReport ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
              <Scale className="w-12 h-12 text-slate-300" />
              <p className="text-slate-600 font-bold text-sm">Chưa chọn vụ việc nào</p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Vui lòng chọn một khiếu nại từ danh sách bên trái để xem bằng chứng đối chiếu và thực hiện vận hành phân xử.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-slate-900 text-base">
                      Hồ sơ tranh chấp #{selectedReport.id.substring(0, 8)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${DISPUTE_STATUS_MAP[selectedReport.status]?.bg || 'bg-slate-200 text-slate-700'
                        }`}
                    >
                      {DISPUTE_STATUS_MAP[selectedReport.status]?.label || selectedReport.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span>
                      Mã đơn:{' '}
                      <strong className="text-slate-800 font-mono">
                        #{selectedReport.orderId?.substring(0, 8) || 'N/A'}
                      </strong>
                    </span>
                    {selectedReport.orderId && onOpenOrderModal && (
                      <button
                        onClick={() => onOpenOrderModal(selectedReport.orderId!)}
                        className="text-[#c34c36] hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <span>Chi tiết đơn</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <span>
                      Ngày tạo: {new Date(selectedReport.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Top Action Button */}
                <div>
                  {canRequestSellerResponse && (
                    <button type="button" onClick={handleRequestSellerResponse} disabled={isProcessing}
                      className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">
                      Yêu cầu người bán phản hồi
                    </button>
                  )}
                  {selectedReport.status === 'OPEN' && (
                    <button
                      onClick={handleStartReview}
                      disabled={isProcessing || !canReview}
                      className="px-4 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Nhận xử lý hồ sơ</span>
                    </button>
                  )}

                  {selectedReport.status === 'IN_REVIEW' && currentUserId && selectedReport.reviewerId === currentUserId && (
                    <button
                      onClick={() => { setResolveChoice(canHandleReturns ? 'RETURN' : 'DISMISS'); setResolveReason(''); setShowResolveModal(true); }}
                      disabled={isProcessing || !responsesLoaded || !canReview}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Đưa ra phán quyết</span>
                    </button>
                  )}
                </div>
              </div>

              {['OPEN', 'IN_REVIEW'].includes(selectedReport.status) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  {sellerResponded
                    ? 'Người bán đã gửi phản hồi.'
                    : sellerMissedDeadline
                      ? 'Đã quá hạn phản hồi từ người bán.'
                      : Number.isFinite(responseDeadline)
                        ? 'Đang chờ người bán phản hồi trước ' + new Date(responseDeadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (giờ Việt Nam).'
                        : 'Người bán chưa phản hồi. Gửi yêu cầu để bắt đầu thời hạn 24 giờ.'}
                </div>
              )}

              {/* 2-COLUMN SIDE-BY-SIDE EVIDENCE COMPARISON */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#c34c36]" />
                  <span>Đối chiếu bằng chứng hai bên</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BUYER COLUMN */}
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <span className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>BẰNG CHỨNG NGƯỜI MUA</span>
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        Lý do: {formatDisputeReason(selectedReport.reasonCode)}
                      </span>
                    </div>

                    {/* Initial Description */}
                    <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs text-slate-700 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 block uppercase">
                        Mô tả khiếu nại ban đầu:
                      </span>
                      <p className="leading-relaxed font-normal">"{selectedReport.description}"</p>
                    </div>

                    {/* Initial Evidence URLs */}
                    {selectedReport.evidenceUrls && selectedReport.evidenceUrls.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            Ảnh/Video khui hàng ban đầu ({selectedReport.evidenceUrls.length}):
                          </span>
                          <span className="text-[10px] text-slate-400">Bấm để xem phóng to</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5 pt-0.5">
                          {selectedReport.evidenceUrls.map((url, idx) => (
                            <DisputeEvidenceThumbnail
                              key={`buyer-ev-${url}-${idx}`}
                              url={url}
                              idx={idx}
                              size="md"
                              labelPrefix="Bằng chứng khui hàng"
                              onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supplemental Buyer Responses */}
                    {buyerResponses.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-blue-200/60">
                        <span className="text-[10px] font-black text-blue-800 uppercase block">
                          Phản hồi bổ sung ({buyerResponses.length}):
                        </span>
                        {buyerResponses.map((br) => (
                          <div key={br.id} className="p-2.5 bg-white rounded-lg border border-blue-100 text-[11px] space-y-1.5">
                            <p className="text-slate-700">"{br.description}"</p>
                            {br.evidenceUrls && br.evidenceUrls.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {br.evidenceUrls.map((u, i) => (
                                  <DisputeEvidenceThumbnail
                                    key={`buyer-supp-${u}-${i}`}
                                    url={u}
                                    idx={i}
                                    size="sm"
                                    labelPrefix="Bằng chứng bổ sung"
                                    onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SELLER COLUMN */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <span className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-600" />
                        <span>BẰNG CHỨNG NGƯỜI BÁN</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        {sellerResponses.length} lượt phản hồi
                      </span>
                    </div>

                    {sellerResponses.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                        <Clock className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-500">Chưa có phản hồi từ người bán</p>
                        <p className="text-[10px] text-slate-400">
                          Người bán chưa tải video/ảnh quy trình đóng gói cho vụ việc này.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sellerResponses.map((sr) => (
                          <div key={sr.id} className="p-3 bg-white rounded-lg border border-amber-200/80 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-1">
                              <span>Tác giả: Người Bán</span>
                              <span>{new Date(sr.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-slate-700 text-[11px] leading-relaxed">
                              "{sr.description}"
                            </p>

                            {sr.evidenceUrls && sr.evidenceUrls.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-amber-900 uppercase">
                                    Video/Ảnh đóng gói đính kèm ({sr.evidenceUrls.length}):
                                  </span>
                                  <span className="text-[10px] text-slate-400">Bấm để xem phóng to</span>
                                </div>
                                <div className="flex flex-wrap gap-2.5 pt-0.5">
                                  {sr.evidenceUrls.map((u, i) => (
                                    <DisputeEvidenceThumbnail
                                      key={`seller-ev-${u}-${i}`}
                                      url={u}
                                      idx={i}
                                      size="md"
                                      labelPrefix="Bằng chứng đóng gói"
                                      onOpen={(view) => setPreviewMedia({ kind: view.kind, src: view.src })}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ARBITRATION DECISION DETAILS (IF RESOLVED) */}
              {selectedReport.status === 'CONFIRMED' || selectedReport.status === 'DISMISSED' ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 uppercase flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-[#c34c36]" />
                      <span>Kết luận trọng tài đã lưu</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Bên chịu trách nhiệm: <strong className="text-slate-800">{RESPONSIBLE_PARTY_MAP[String(selectedReport.responsibleParty || '').toUpperCase()] || selectedReport.responsibleParty || 'Chưa xác định'}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200">
                    "{selectedReport.decisionReason || 'Không có ghi chú'}"
                  </p>
                </div>
              ) : null}

              {/* RETURN SHIPMENT & LOGISTICS OPERATIONS */}
              {isApproved && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      <span>Vận hành chuyến hoàn hàng (Người Mua sang Người Bán)</span>
                    </span>

                    {/* Actions on return shipment */}
                    {selectedReturnShipment && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSyncShipment(selectedReturnShipment.shipmentId)}
                          disabled={isProcessing || !canHandleReturns}
                          className="px-2.5 py-1 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Đồng bộ</span>
                        </button>

                        {canHandleReturns && selectedReturnShipment.orderCode &&
                          ['ASSIGNING_DRIVER', 'ON_GOING'].includes(selectedReturnShipment.providerStatus ?? '') && (
                            <button
                              onClick={() => handleCancelShipment(selectedReturnShipment.shipmentId)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              Hủy chuyến
                            </button>
                          )}

                        {canHandleReturns && ['CREATING', 'CREATION_UNCERTAIN'].includes(selectedReturnShipment.status) && (
                          <button
                            onClick={() => setShowReconcileModal(true)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Đối soát
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!selectedReturnShipment ? (
                    <div className="text-center py-6 space-y-2">
                      <Package className="w-8 h-8 text-indigo-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        {selectedReport.returnShipmentId
                          ? 'Chưa tải được thông tin vận đơn hoàn.'
                          : 'Đang chờ người mua tạo vận đơn hoàn.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Mã vận đơn:</span>
                          <strong className="font-mono text-slate-800 text-[11px]">
                            {selectedReturnShipment.orderCode || selectedReturnShipment.shipmentId.substring(0, 8)}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Trạng thái hãng:</span>
                          <strong className="text-indigo-700 text-[11px] font-black">
                            {LALAMOVE_STATUS_MAP[selectedReturnShipment.status] || selectedReturnShipment.status}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Cước tạm tính:</span>
                          <strong className="text-slate-800 text-[11px]">
                            {selectedReturnShipment.quotedFee ? formatVND(selectedReturnShipment.quotedFee) : '0 đ'}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Cước thực tế:</span>
                          <strong className="text-emerald-700 text-[11px] font-black">
                            {selectedReturnShipment.actualFee != null ? formatVND(selectedReturnShipment.actualFee) : 'Chờ xác nhận'}
                          </strong>
                        </div>
                      </div>

                      {selectedReturnShipment.status === 'CANCELLED' && !isRefunded && (
                        <p className="text-xs font-medium text-slate-700">
                          Đang chờ người mua tạo vận đơn hoàn thay thế.
                        </p>
                      )}

                      {/* Driver Info if assigned */}
                      {selectedReturnShipment.driverName && (
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100 text-xs flex items-center justify-between">
                          <span>
                            Tài xế Lalamove: <strong>{selectedReturnShipment.driverName}</strong> ({selectedReturnShipment.driverPhone || 'N/A'})
                          </span>
                          <span className="font-mono font-bold text-slate-600">{selectedReturnShipment.driverPlateNumber}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* REFUND & SELLER DEBT FINALIZATION */}
              {isApproved && selectedReturnShipment && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Hoàn tiền cho người mua & quyết toán phí hoàn</span>
                    </span>

                    {/* Refund Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isRefunded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                      {isRefunded ? 'ĐÃ HOÀN TIỀN NGƯỜI MUA'
                        : selectedReturnShipment.status === 'DELIVERED' ? 'CHỜ HOÀN TỰ ĐỘNG' : 'CHỜ GIAO TRẢ'}
                    </span>
                  </div>

                  {!isRefunded ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-100 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">
                          {selectedReturnShipment.status === 'DELIVERED'
                            ? 'Hàng đã về người bán. Hệ thống đang xử lý hoàn tiền vào ví người mua.'
                            : 'Hệ thống sẽ tự hoàn tiền khi hãng vận chuyển xác nhận đã giao hàng về người bán.'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Trạng thái vận đơn hiện tại:{' '}
                          <strong className="text-slate-800">{LALAMOVE_STATUS_MAP[selectedReturnShipment.status] || selectedReturnShipment.status}</strong>
                        </p>
                      </div>

                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Refund Receipt */}
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Số tiền đã hoàn người mua:</span>
                          <strong className="text-emerald-700 text-sm font-black">
                            {selectedReport.refundAmount ? formatVND(selectedReport.refundAmount) : '100% tiền hàng'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Thời điểm hoàn:</span>
                          <strong className="text-slate-800 text-[11px]">
                            {selectedReport.refundedAt ? new Date(selectedReport.refundedAt).toLocaleString('vi-VN') : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Người thực hiện:</span>
                          <strong className="text-slate-800 font-mono text-[11px]">
                            {selectedReport.refundedBy ? selectedReport.refundedBy.substring(0, 8) : 'Hệ thống'}
                          </strong>
                        </div>
                      </div>

                      {/* Fee Assessment & Debt */}
                      {feeAssessment && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Khoản phí hoàn hàng của người bán:</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${feeAssessment.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : feeAssessment.status === 'OUTSTANDING'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                                }`}
                            >
                              {feeAssessment.status === 'PAID'
                                ? 'ĐÃ THU ĐỦ PHÍ'
                                : feeAssessment.status === 'OUTSTANDING'
                                  ? 'CÒN NỢ CÔNG NỢ'
                                  : 'CHỜ HÃNG CHỐT PHÍ'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                            <div>
                              <span className="text-slate-400 block">Tổng phí hoàn:</span>
                              <strong>{feeAssessment.feeAmount != null ? formatVND(feeAssessment.feeAmount) : 'N/A'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Đã thu từ ví:</span>
                              <strong className="text-emerald-700">
                                {feeAssessment.collectedAmount != null ? formatVND(feeAssessment.collectedAmount) : '0 đ'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Ghi nhận công nợ:</span>
                              <strong className="text-rose-700">
                                {feeAssessment.debtAmount != null ? formatVND(feeAssessment.debtAmount) : '0 đ'}
                              </strong>
                            </div>
                          </div>

                          {/* Finalize pending fee button if fee is pending and actual fee is now present */}
                          {canHandleReturns && feeAssessment.status === 'PENDING_FEE' && selectedReturnShipment.actualFee != null && (
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => handleFinalizePendingFee(selectedReturnShipment.shipmentId)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                              >
                                Chốt phí hoàn hàng người bán ({formatVND(selectedReturnShipment.actualFee)})
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RESOLVE DISPUTE MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#c34c36]" />
                <span>Đưa ra phán quyết tranh chấp</span>
              </h3>
              <button
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Quyết định phán quyết:</label>
                <div className={`grid gap-2 ${canHandleReturns ? 'sm:grid-cols-2' : ''}`}>
                  {([
                    { id: 'RETURN', label: 'Duyệt trả hàng và hoàn tiền' },
                    { id: 'DISMISS', label: 'Bác khiếu nại' },
                  ] as const).filter((option) => option.id !== 'RETURN' || canHandleReturns).map((option) => (
                    <button type="button" key={option.id} aria-pressed={resolveChoice === option.id}
                      onClick={() => setResolveChoice(option.id)}
                      className={'rounded-xl border px-3 py-2 text-xs font-bold ' +
                        (resolveChoice === option.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600')}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Căn cứ & Lý do phán quyết (Bắt buộc):</label>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  placeholder="Ghi rõ kết quả đối chiếu bằng chứng khui hàng và đóng gói giữa hai bên..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#c34c36] focus:outline-none"
                />
              </div>

              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {resolveChoice === 'RETURN'
                  ? 'Người bán chịu trách nhiệm. Tiền hàng được hoàn sau khi hãng vận chuyển xác nhận đã giao hàng về người bán.'
                  : sellerMissedDeadline
                    ? 'Người mua giữ hàng. Hệ thống ghi nhận người bán quá hạn phản hồi.'
                    : 'Người mua giữ hàng. Tiền hàng tiếp tục quy trình giải ngân khi đủ điều kiện.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isProcessing}
                className="px-5 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {isProcessing ? 'Đang lưu...' : 'Lưu phán quyết'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE SHIPMENT MODAL */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase">Đối soát vận đơn với hãng</h3>
            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Nhập mã đơn Lalamove (orderCode):</label>
              <input
                type="text"
                placeholder="Ví dụ: 1234567890..."
                value={reconcileOrderCode}
                onChange={(e) => setReconcileOrderCode(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReconcileModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => selectedReturnShipment && handleReconcileCreation(selectedReturnShipment.shipmentId)}
                disabled={isProcessing || !reconcileOrderCode.trim()}
                className="px-4 py-1.5 bg-[#24263e] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Đối soát ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA PREVIEW MODAL */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center font-bold transition cursor-pointer"
            >
              ×
            </button>
            <div className="p-2 flex items-center justify-center max-h-[80vh]">
              {previewMedia.kind === 'IMAGE' ? (
                <img src={previewMedia.src} alt="Bằng chứng" className="max-h-[75vh] w-auto object-contain rounded-lg" />
              ) : (
                <video src={previewMedia.src} controls autoPlay className="max-h-[75vh] w-full rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

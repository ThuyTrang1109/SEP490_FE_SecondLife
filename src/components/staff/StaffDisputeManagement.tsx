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
  ResponsibleParty,
  userReportService,
  ReportSubmissionResponse,
  shippingService,
  returnShippingFeeService,
  ReturnShippingFeeResponse,
  ReturnShippingFeeStatus,
} from '../../services';
import { ShipmentBackend, ShipmentEventBackend } from '../../types';
import { formatVND } from '../../utils/translations';

interface StaffDisputeManagementProps {
  currentUserId?: string;
  onOpenOrderModal?: (orderId: string) => void;
}

export const StaffDisputeManagement: React.FC<StaffDisputeManagementProps> = ({
  currentUserId,
  onOpenOrderModal,
}) => {
  const [reports, setReports] = useState<ReportItemDto[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Selected report detail state
  const [selectedReport, setSelectedReport] = useState<ReportItemDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [responses, setResponses] = useState<ReportSubmissionResponse[]>([]);
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [feeAssessment, setFeeAssessment] = useState<ReturnShippingFeeResponse | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<ShipmentEventBackend[]>([]);

  // Action states
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveDecision, setResolveDecision] = useState<'CONFIRMED' | 'DISMISSED'>('CONFIRMED');
  const [resolveResponsibleParty, setResolveResponsibleParty] = useState<ResponsibleParty>('SELLER');
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
      const res = await staffReportService.getReportQueue(statusParam, 'ORDER', 0, 50);
      setReports(res.items || []);
    } catch (err: any) {
      console.error('[StaffDisputeManagement] Failed to fetch queue:', err);
      setActionError(err?.message || 'Không thể tải danh sách khiếu nại.');
    } finally {
      setLoadingQueue(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Load detailed report data
  const loadReportDetail = useCallback(async (reportId: string) => {
    setLoadingDetail(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const rep = await staffReportService.getReportById(reportId);
      setSelectedReport(rep);

      // Load supplemental responses of both parties
      try {
        const respData = await userReportService.getReportResponses(reportId, 0, 100);
        setResponses(respData.items || []);
      } catch (err) {
        console.warn('Could not load report responses:', err);
        setResponses([]);
      }

      // Load shipments for this order
      if (rep.orderId) {
        try {
          const shipList = await shippingService.getOrderShipments(rep.orderId);
          setShipments(shipList || []);

          // If there is a return shipment, check events and return shipping fee
          const returnShip = shipList?.find(
            (s) => s.leg === 'BUYER_TO_SELLER' && (s.shipmentId === rep.returnShipmentId || !rep.returnShipmentId)
          );
          if (returnShip) {
            try {
              const evs = await shippingService.getShipmentEvents(returnShip.shipmentId);
              setShipmentEvents(evs || []);
            } catch {}

            try {
              const fee = await returnShippingFeeService.getReturnShippingFee(returnShip.shipmentId);
              setFeeAssessment(fee);
            } catch {
              setFeeAssessment(null);
            }
          } else {
            setShipmentEvents([]);
            setFeeAssessment(null);
          }
        } catch (err) {
          console.warn('Could not load shipments:', err);
          setShipments([]);
        }
      }
    } catch (err: any) {
      console.error('[StaffDisputeManagement] Failed to load report detail:', err);
      setActionError(err?.message || 'Không thể tải thông tin chi tiết vụ việc.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelectReport = (rep: ReportItemDto) => {
    setSelectedReportId(rep.id);
    loadReportDetail(rep.id);
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

  // 1. Start Review
  const handleStartReview = async () => {
    if (!selectedReport) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const updated = await staffReportService.startReview(selectedReport.id);
      setSelectedReport(updated);
      setActionSuccess('Đã tiếp nhận hồ sơ tranh chấp vào danh sách đang xử lý (IN_REVIEW).');
      fetchQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể nhận xử lý báo cáo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Resolve Dispute
  const handleConfirmResolve = async () => {
    if (!selectedReport) return;
    if (!resolveReason.trim()) {
      alert('Vui lòng nhập lý do/căn cứ đưa ra phán quyết.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      const resolutionAction = resolveDecision === 'CONFIRMED' ? 'RETURN_AND_REFUND' : 'NONE';
      const updated = await staffReportService.resolveReport(selectedReport.id, {
        decision: resolveDecision,
        responsibleParty: resolveResponsibleParty,
        reason: resolveReason.trim(),
        resolutionAction,
      });
      setSelectedReport(updated);
      setShowResolveModal(false);
      setActionSuccess(
        resolveDecision === 'CONFIRMED'
          ? 'Đã duyệt yêu cầu hoàn hàng. Chuyển sang bước tạo vận đơn hoàn hàng Lalamove.'
          : 'Đã bác khiếu nại. Hồ sơ đã được đóng.'
      );
      fetchQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể lưu phán quyết tranh chấp.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Create Return Shipment (BUYER_TO_SELLER)
  const handleCreateReturnShipment = async () => {
    if (!selectedReport || !selectedReport.orderId) return;
    if (!window.confirm('Xác nhận tạo vận đơn hoàn hàng (Lalamove chiều Người Mua -> Người Bán)?')) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ret_${Date.now()}`;
      await shippingService.createShipment(selectedReport.orderId, {
        requestId: reqId,
        leg: 'BUYER_TO_SELLER',
        reason: `Tạo chuyến hoàn theo phán quyết hồ sơ tranh chấp #${selectedReport.id.substring(0, 8)}`,
        reportId: selectedReport.id,
      });
      setActionSuccess('Đã tạo thành công vận đơn hoàn hàng Lalamove.');
      loadReportDetail(selectedReport.id);
    } catch (err: any) {
      setActionError(err?.message || 'Không thể tạo vận đơn hoàn hàng Lalamove.');
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

  // 7. Refund Buyer
  const handleRefundBuyer = async (returnShipmentId: string) => {
    if (!selectedReport) return;
    if (!window.confirm('Xác nhận hoàn tiền hàng về ví Người Mua? Sau khi hoàn, phí vận chuyển hoàn sẽ được thu hoặc ghi nợ vào Seller có lỗi.')) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await shippingService.refundShipment(returnShipmentId, {
        reason: 'Hàng hoàn đã giao về người bán thành công. Hoàn toàn bộ tiền hàng vào ví người mua theo phán quyết.',
      });
      setActionSuccess('Đã thực hiện hoàn tiền vào ví Người Mua thành công!');
      loadReportDetail(selectedReport.id);
      fetchQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Lỗi khi thực hiện hoàn tiền.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Chốt phí hoàn PENDING_FEE
  const handleFinalizePendingFee = async (returnShipmentId: string) => {
    if (!selectedReport) return;
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
      (selectedReport?.returnShipmentId ? s.shipmentId === selectedReport.returnShipmentId : true)
  );

  const buyerResponses = responses.filter((r) => r.authorRole === 'BUYER');
  const sellerResponses = responses.filter((r) => r.authorRole === 'SELLER');

  const isApproved =
    selectedReport?.status === 'CONFIRMED' &&
    selectedReport?.resolutionAction === 'RETURN_AND_REFUND';
  const isRefunded = !!selectedReport?.refundedAt;

  return (
    <div className="space-y-6">
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
                <span>Hàng Đợi Tranh Chấp ({filteredReports.length})</span>
              </h3>
              <button
                onClick={fetchQueue}
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
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'Tất cả' : st}
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
                    className={`p-3.5 transition cursor-pointer text-xs space-y-1.5 ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-l-[#c34c36]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">
                        #{item.id.substring(0, 8)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          item.status === 'OPEN'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'IN_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
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
                      Hồ Sơ Tranh Chấp #{selectedReport.id.substring(0, 8)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        selectedReport.status === 'OPEN'
                          ? 'bg-rose-100 text-rose-800'
                          : selectedReport.status === 'IN_REVIEW'
                          ? 'bg-amber-100 text-amber-800'
                          : selectedReport.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedReport.status}
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
                  {selectedReport.status === 'OPEN' && (
                    <button
                      onClick={handleStartReview}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Nhận Xử Lý Hồ Sơ</span>
                    </button>
                  )}

                  {selectedReport.status === 'IN_REVIEW' && (
                    <button
                      onClick={() => setShowResolveModal(true)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Đưa Ra Phán Quyết</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2-COLUMN SIDE-BY-SIDE EVIDENCE COMPARISON */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#c34c36]" />
                  <span>Đối Chiếu Bằng Chứng Hai Bên (Side-by-Side)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BUYER COLUMN */}
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <span className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>BẰNG CHỨNG NGƯỜI MUA (BUYER)</span>
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        Lý do: {selectedReport.reasonCode}
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
                        <span className="text-[10px] font-black text-slate-500 block uppercase">
                          Ảnh/Video khui hàng ban đầu ({selectedReport.evidenceUrls.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.evidenceUrls.map((url, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleOpenMedia(url)}
                              disabled={loadingMediaUrl === url}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 hover:border-blue-400 text-blue-800 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              {loadingMediaUrl === url ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>Bằng chứng #{idx + 1}</span>
                            </button>
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
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {br.evidenceUrls.map((u, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleOpenMedia(u)}
                                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer"
                                  >
                                    Tệp #{i + 1}
                                  </button>
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
                        <span>BẰNG CHỨNG NGƯỜI BÁN (SELLER)</span>
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
                                <span className="text-[10px] font-bold text-slate-500 block">
                                  Video/Ảnh đóng gói đính kèm:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {sr.evidenceUrls.map((u, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleOpenMedia(u)}
                                      disabled={loadingMediaUrl === u}
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:border-amber-400 text-amber-900 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                      {loadingMediaUrl === u ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Video className="w-3.5 h-3.5 text-amber-700" />
                                      )}
                                      <span>Bằng chứng đóng gói #{i + 1}</span>
                                    </button>
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
                      <span>Kết Luận Trọng Tài Đã Lưu</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Bên chịu trách nhiệm: <strong className="text-slate-800">{selectedReport.responsibleParty || 'N/A'}</strong>
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
                      <span>Vận Hành Chuyến Hoàn Hàng (Người Mua sang Người Bán)</span>
                    </span>

                    {/* Actions on return shipment */}
                    {selectedReturnShipment && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSyncShipment(selectedReturnShipment.shipmentId)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Đồng Bộ (Sync)</span>
                        </button>

                        {['READY_TO_PICK', 'ASSIGNED'].includes(selectedReturnShipment.status) && (
                          <button
                            onClick={() => handleCancelShipment(selectedReturnShipment.shipmentId)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Hủy Chuyến
                          </button>
                        )}

                        {['CREATING', 'CREATION_UNCERTAIN'].includes(selectedReturnShipment.status) && (
                          <button
                            onClick={() => setShowReconcileModal(true)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Đối Soát
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!selectedReturnShipment ? (
                    <div className="text-center py-6 space-y-2">
                      <Package className="w-8 h-8 text-indigo-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">Chưa tạo vận đơn hoàn hàng Lalamove</p>
                      <button
                        onClick={handleCreateReturnShipment}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Tạo Vận Đơn Hoàn Hàng Lalamove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Mã Vận Đơn:</span>
                          <strong className="font-mono text-slate-800 text-[11px]">
                            {selectedReturnShipment.orderCode || selectedReturnShipment.shipmentId.substring(0, 8)}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Trạng Thái Hãng:</span>
                          <strong className="text-indigo-700 text-[11px] font-black">
                            {selectedReturnShipment.status} ({selectedReturnShipment.providerStatus || 'N/A'})
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Cước Tạm Tính:</span>
                          <strong className="text-slate-800 text-[11px]">
                            {selectedReturnShipment.quotedFee ? formatVND(selectedReturnShipment.quotedFee) : '0 đ'}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                          <span className="text-[10px] text-slate-400 block font-bold">Cước Thực Tế:</span>
                          <strong className="text-emerald-700 text-[11px] font-black">
                            {selectedReturnShipment.actualFee != null ? formatVND(selectedReturnShipment.actualFee) : 'Chờ xác nhận'}
                          </strong>
                        </div>
                      </div>

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
                      <span>Hoàn Tiền Cho Người Mua & Quyết Toán Phí Hoàn</span>
                    </span>

                    {/* Refund Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        isRefunded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isRefunded ? 'ĐÃ HOÀN TIỀN BUYER' : 'CHỜ HOÀN TIỀN'}
                    </span>
                  </div>

                  {!isRefunded ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-100 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">
                          Điều kiện: Vận đơn hoàn hàng đã được bưu tá giao thành công (DELIVERED) về Seller.
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Trạng thái vận đơn hiện tại:{' '}
                          <strong className="text-slate-800">{selectedReturnShipment.status}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => handleRefundBuyer(selectedReturnShipment.shipmentId)}
                        disabled={isProcessing || selectedReturnShipment.status !== 'DELIVERED'}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Xác Nhận Hoàn Tiền Hàng
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Refund Receipt */}
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Số Tiền Đã Hoàn Buyer:</span>
                          <strong className="text-emerald-700 text-sm font-black">
                            {selectedReport.refundAmount ? formatVND(selectedReport.refundAmount) : '100% Tiền Hàng'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Thời Điểm Hoàn:</span>
                          <strong className="text-slate-800 text-[11px]">
                            {selectedReport.refundedAt ? new Date(selectedReport.refundedAt).toLocaleString('vi-VN') : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Người Thực Hiện:</span>
                          <strong className="text-slate-800 font-mono text-[11px]">
                            {selectedReport.refundedBy ? selectedReport.refundedBy.substring(0, 8) : 'Staff'}
                          </strong>
                        </div>
                      </div>

                      {/* Fee Assessment & Debt */}
                      {feeAssessment && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Khoản Phí Hoàn Hàng Của Seller:</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                feeAssessment.status === 'PAID'
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
                                : 'CHỜ HÃNG CHỐT PHÍ (PENDING_FEE)'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                            <div>
                              <span className="text-slate-400 block">Tổng Phí Hoàn:</span>
                              <strong>{feeAssessment.feeAmount != null ? formatVND(feeAssessment.feeAmount) : 'N/A'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Đã Thu Từ Ví:</span>
                              <strong className="text-emerald-700">
                                {feeAssessment.collectedAmount != null ? formatVND(feeAssessment.collectedAmount) : '0 đ'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Ghi Nhận Công Nợ:</span>
                              <strong className="text-rose-700">
                                {feeAssessment.debtAmount != null ? formatVND(feeAssessment.debtAmount) : '0 đ'}
                              </strong>
                            </div>
                          </div>

                          {/* Finalize pending fee button if fee is pending and actual fee is now present */}
                          {feeAssessment.status === 'PENDING_FEE' && selectedReturnShipment.actualFee != null && (
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => handleFinalizePendingFee(selectedReturnShipment.shipmentId)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                              >
                                Chốt Phí Hoàn Hàng Seller ({formatVND(selectedReturnShipment.actualFee)})
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
                <span>Đưa Ra Phán Quyết Tranh Chấp</span>
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResolveDecision('CONFIRMED');
                      setResolveResponsibleParty('SELLER');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      resolveDecision === 'CONFIRMED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Duyệt Hoàn Hàng (CONFIRMED)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResolveDecision('DISMISSED');
                      setResolveResponsibleParty('NONE');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      resolveDecision === 'DISMISSED'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Bác Khiếu Nại (DISMISSED)
                  </button>
                </div>
              </div>

              {resolveDecision === 'CONFIRMED' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bên có lỗi / Chịu phí hoàn hàng:</label>
                  <select
                    value={resolveResponsibleParty}
                    onChange={(e) => setResolveResponsibleParty(e.target.value as ResponsibleParty)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                  >
                    <option value="SELLER">Người Bán (SELLER - Chịu phí vận chuyển hoàn)</option>
                    <option value="BUYER">Người Mua (BUYER)</option>
                    <option value="CARRIER">Đơn vị vận chuyển (CARRIER)</option>
                    <option value="NONE">Không xác định (NONE)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Căn cứ & Lý do phán quyết (Bắt buộc):</label>
                <textarea
                  rows={4}
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  placeholder="Ghi rõ kết quả đối chiếu bằng chứng khui hàng và đóng gói giữa hai bên..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#c34c36] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Lưu ý:</strong> Khi duyệt hoàn hàng, quyết định này không thể hoàn tác. Tiền hàng sẽ được giữ an toàn và chỉ hoàn cho Người Mua khi kiện hàng hoàn đã về tay Người Bán.
              </div>
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
                {isProcessing ? 'Đang lưu...' : 'Lưu Phán Quyết'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE SHIPMENT MODAL */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase">Đối Soát Vận Đơn Với Hãng</h3>
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
                Đối Soát Ngay
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

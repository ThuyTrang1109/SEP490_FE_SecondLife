import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShoppingBag,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Package,
  Layers,
  Scale,
  Image as ImageIcon,
  Video,
  X,
  Truck,
  MapPin,
  User,
  Phone,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import {
  userReportService,
  type ReportReasonCode,
  type ReportStatus,
  type ResponsibleParty,
  type SellerOrderDisputeDto,
  type UserReportResponseDto
} from '../../services/userReportService';
import { SellerDisputeResponseModal } from './SellerDisputeResponseModal';
import { notificationWsClient } from '../../services/notificationWsClient';
import { getSellerDisputeResponseState, formatDisputeDateTime } from '../../utils/orders/orderDispute';
import { DisputeEvidenceThumbnail } from '../common/DisputeEvidenceThumbnail';
import { shippingService } from '../../services/shippingService';
import { formatVND } from '../../utils/translations';
import type { Language, ShipmentBackend } from '../../types';

interface Props {
  onOpenOrder?: (orderId: string) => void;
  onOpenPost?: (postId: string) => void;
  getReasonLabel: (reason: ReportReasonCode | string) => string;
  lang?: Language;
}

const returnStatusLabels: Record<string, string> = {
  PENDING: 'Chờ tạo vận đơn',
  CREATING: 'Đang tạo vận đơn',
  CREATED: 'Đã tạo vận đơn',
  CREATION_UNCERTAIN: 'Đang đối soát vận đơn',
  READY_TO_PICK: 'Đang tìm tài xế',
  PICKING: 'Tài xế đang tới lấy hàng',
  PICKED: 'Đã lấy hàng hoàn',
  DELIVERING: 'Đang chuyển về người bán',
  PICKED_UP: 'Đã lấy hàng hoàn',
  IN_TRANSIT: 'Đang chuyển về người bán',
  DELIVERED: 'Đã giao lại cho người bán',
  CANCELLED: 'Đã hủy vận đơn',
  FAILED: 'Giao hàng hoàn gặp sự cố',
  RETURNED: 'Hãng vận chuyển đã trả lại kiện hàng',
};

type EvidenceView = Awaited<ReturnType<typeof userReportService.loadPrivateEvidenceView>>;

function isOpenForResponses(report: SellerOrderDisputeDto) {
  return getSellerDisputeResponseState(report) === 'available';
}

export function SellerOrderDisputes({ onOpenOrder, onOpenPost, getReasonLabel, lang = 'vi' }: Props) {
  const [reports, setReports] = useState<SellerOrderDisputeDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SELLER_PAGE_SIZE = 5;

  // Response modal
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Timeline modal
  const [timelineReport, setTimelineReport] = useState<UserReportResponseDto | null>(null);
  const [timelineReportId, setTimelineReportId] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [returnShipment, setReturnShipment] = useState<ShipmentBackend | null>(null);

  // Media preview lightbox
  const [preview, setPreview] = useState<EvidenceView | null>(null);

  // Fetch disputes and enrich with buyer complaint details
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    userReportService
      .getSellerDisputes(page, SELLER_PAGE_SIZE)
      .then(async (result) => {
        if (!active) return;
        setTotalPages(result.totalPages);
        setTotalElements(result.totalElements ?? result.items.length);

        // Enrich items with description, evidenceUrls, etc. via getSellerDisputeDetail
        const enriched = await Promise.all(
          result.items.map(async (item) => {
            try {
              const detail = await userReportService.getSellerDisputeDetail(item.id);
              let returnShip: ShipmentBackend | null = null;
              if (item.orderId && (detail.returnShipmentId || detail.resolutionAction === 'RETURN_AND_REFUND')) {
                try {
                  const shipments = await shippingService.getOrderShipments(item.orderId);
                  returnShip = shipments.find((s) => s.leg === 'BUYER_TO_SELLER') ?? null;
                } catch { }
              }
              return {
                ...item,
                description: detail.description,
                evidenceUrls: detail.buyerEvidenceUrls || [],
                postId: detail.postId ?? item.postId,
                responsibleParty: detail.responsibleParty ?? item.responsibleParty,
                decisionReason: detail.decisionReason ?? item.decisionReason,
                resolvedAt: detail.resolvedAt ?? item.resolvedAt,
                status: detail.status ?? item.status,
                resolutionAction: detail.resolutionAction ?? item.resolutionAction,
                refundAmount: detail.refundAmount,
                refundedAt: detail.refundedAt ?? item.refundedAt,
                returnShipmentId: detail.returnShipmentId ?? returnShip?.shipmentId,
                returnShipment: returnShip,
                sellerResponseDeadlineAt: detail.sellerResponseDeadlineAt ?? item.sellerResponseDeadlineAt,
                sellerRespondedAt: detail.sellerRespondedAt ?? item.sellerRespondedAt,
              };
            } catch {
              return item;
            }
          })
        );

        if (active) {
          setReports(enriched);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Không tải được khiếu nại của người mua.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, refresh]);

  // Subscribe to real-time notification
  useEffect(() => {
    return notificationWsClient.subscribeListener((notification) => {
      if (notification.referenceType === 'REPORT') setRefresh((value) => value + 1);
    });
  }, []);

  // Handle timeline report modal loading
  useEffect(() => {
    if (!timelineReportId) {
      setTimelineReport(null);
      setReturnShipment(null);
      return;
    }

    let active = true;
    setTimelineLoading(true);
    setTimelineError(null);

    userReportService
      .getReportById(timelineReportId)
      .then(async (rep) => {
        if (!active) return;
        setTimelineReport(rep);
        if (rep.orderId && (rep.returnShipmentId || rep.resolutionAction === 'RETURN_AND_REFUND')) {
          try {
            let shipments = await shippingService.getOrderShipments(rep.orderId);
            if (!Array.isArray(shipments) || shipments.length === 0) {
              try {
                const raw = localStorage.getItem(`sl_order_shipments_${rep.orderId}`) || localStorage.getItem(`order_shipments_${rep.orderId}`);
                if (raw) shipments = JSON.parse(raw);
              } catch { }
            }
            if (active && Array.isArray(shipments)) {
              setReturnShipment(
                shipments.find(
                  (item) => (item.leg === 'BUYER_TO_SELLER' || item.leg === 'CENTER_TO_SELLER') && (rep.returnShipmentId ? item.shipmentId === rep.returnShipmentId : true)
                ) ?? shipments.find((item) => item.leg === 'BUYER_TO_SELLER' || item.leg === 'CENTER_TO_SELLER') ?? null
              );
            }
          } catch {
            // ignore shipment fetch failure
          }
        }
      })
      .catch((err) => {
        if (active) setTimelineError(err instanceof Error ? err.message : 'Không tải được tiến trình khiếu nại.');
      })
      .finally(() => {
        if (active) setTimelineLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timelineReportId]);

  // Esc key closes preview lightbox
  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      preview?.dispose?.();
    };
  }, [preview]);

  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const nextDeadline = Math.min(
    ...reports
      .filter((report) => !report.sellerRespondedAt && isOpenForResponses(report) && report.sellerResponseDeadlineAt)
      .map((report) => Date.parse(report.sellerResponseDeadlineAt ?? ''))
  );

  useEffect(() => {
    if (!Number.isFinite(nextDeadline)) return;
    const timeout = setTimeout(() => setRefresh((value) => value + 1), Math.max(0, nextDeadline - Date.now()) + 50);
    return () => clearTimeout(timeout);
  }, [nextDeadline]);

  const urgentCount = reports.filter((report) => !report.sellerRespondedAt && isOpenForResponses(report)).length;
  const displayedReports = reports.length > SELLER_PAGE_SIZE ? reports.slice(page * SELLER_PAGE_SIZE, (page + 1) * SELLER_PAGE_SIZE) : reports;
  const computedTotalPages = Math.max(totalPages, Math.ceil((totalElements || reports.length) / SELLER_PAGE_SIZE), 1);

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
            <span>{lang === 'vi' ? 'Chờ tiếp nhận' : 'Pending Review'}</span>
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
            <Scale className="w-3 h-3 text-blue-600" />
            <span>{lang === 'vi' ? 'Đang thẩm định' : 'In Arbitration'}</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{lang === 'vi' ? 'Đã xác nhận vi phạm' : 'Confirmed'}</span>
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-500" />
            <span>{lang === 'vi' ? 'Đã bác bỏ' : 'Dismissed'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getResponsiblePartyLabel = (party?: ResponsibleParty | null) => {
    switch (party) {
      case 'SELLER':
        return lang === 'vi' ? 'Người bán chịu trách nhiệm' : 'Seller responsible';
      case 'BUYER':
        return lang === 'vi' ? 'Người mua chịu trách nhiệm' : 'Buyer Fault';
      case 'CARRIER':
        return lang === 'vi' ? 'Đơn vị vận chuyển làm hư hại / chậm trễ' : 'Carrier Fault';
      case 'NONE':
        return lang === 'vi' ? 'Không xác định bên có lỗi' : 'No Party at Fault';
      default:
        return lang === 'vi' ? 'Chưa xác định' : 'Pending determination';
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs text-sm text-slate-800 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#c34c36] shrink-0 shadow-2xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {lang === 'vi' ? 'Khiếu nại từ người mua' : 'Buyer Complaints'}
              </h2>
              {(totalElements > 0 || reports.length > 0) && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700">
                  {totalElements || reports.length}
                </span>
              )}
              {urgentCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {urgentCount} {lang === 'vi' ? 'cần phản hồi' : 'response needed'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'Theo dõi và phản hồi các yêu cầu khiếu nại đơn hàng từ người mua trước phiên phân xử'
                : 'Monitor and respond to order complaints submitted by buyers before arbitration'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin text-[#c34c36]' : ''}`} />
            <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Body Content */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#c34c36]" />
          <span className="text-xs font-medium">
            {lang === 'vi' ? 'Đang tải danh sách khiếu nại từ người mua...' : 'Loading buyer complaints...'}
          </span>
        </div>
      ) : error ? (
        <div className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl bg-[#faf8f5]/80 border border-dashed border-slate-200 mt-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 shadow-xs">
            <PackageCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {lang === 'vi' ? 'Chưa có khiếu nại nào từ người mua' : 'No buyer disputes found'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {lang === 'vi'
              ? 'Các đơn hàng của bạn đang diễn ra thuận lợi. Uy tín bán hàng được đảm bảo an toàn.'
              : 'All your orders are running smoothly. Your seller reputation is protected.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {displayedReports.map((report) => {
            const responseState = getSellerDisputeResponseState(report);
            const canRespond = responseState === 'available';
            const hasResolvedDecision = report.status === 'CONFIRMED' || report.status === 'DISMISSED';

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-[#24263e] flex items-center justify-center text-white shadow-xs">
                      <Package className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#24263e] font-mono">
                          Mã vụ việc: #{report.id.substring(0, 8)}...
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                          ĐƠN HÀNG
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>
                          {new Date(report.createdAt).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(report.status)}
                  </div>
                </div>

                {/* Card Body */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left Column (8 cols): Reason, links, buyer quote, evidence gallery */}
                  <div className="md:col-span-8 space-y-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-black flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>{getReasonLabel(report.reasonCode)}</span>
                      </span>

                      {report.orderId && (
                        <button
                          type="button"
                          onClick={() => onOpenOrder?.(report.orderId)}
                          className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Đơn hàng #{report.orderId.substring(0, 8)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {report.postId && (
                        <button
                          type="button"
                          onClick={() => onOpenPost?.(report.postId!)}
                          className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Bài đăng #{report.postId.substring(0, 8)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-normal bg-[#faf8f5] p-3 rounded-xl border border-gray-100">
                      "{report.description || 'Tôi muốn hoàn hàng'}"
                    </p>

                    {/* Evidence Photo / Video Thumbnails */}
                    {report.evidenceUrls && report.evidenceUrls.length > 0 && (
                      <div className="space-y-2 pt-1.5">
                        <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lang === 'vi' ? 'Bằng chứng đã cung cấp' : 'Uploaded evidence'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({report.evidenceUrls.length} {lang === 'vi' ? 'tệp ảnh/video' : 'media files'})
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                          {report.evidenceUrls.map((url, idx) => (
                            <DisputeEvidenceThumbnail
                              key={`${url}-${idx}`}
                              url={url}
                              idx={idx}
                              onOpen={(view) => setPreview({ kind: view.kind, src: view.src, dispose: view.dispose || (() => { }) })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column (4 cols): Arbitration Resolution & CTAs */}
                  <div className="md:col-span-4 bg-[#faf8f5] rounded-xl p-3.5 border border-gray-200 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold text-[#24263e] flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-[#c34c36]" />
                        <span>{lang === 'vi' ? 'Quyết định' : 'Arbitration Outcome'}</span>
                      </div>

                      {hasResolvedDecision ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="text-[11px] text-slate-500">
                            {lang === 'vi' ? 'Bên có lỗi:' : 'Fault:'}
                            <strong className="block text-[#24263e] font-bold mt-0.5">
                              {getResponsiblePartyLabel(report.responsibleParty)}
                            </strong>
                          </div>

                          {report.decisionReason && (
                            <div className="p-2 rounded-lg bg-white border border-gray-200 text-[11px] text-slate-700 italic">
                              "{report.decisionReason}"
                            </div>
                          )}

                          {report.resolvedAt && (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>
                                {lang === 'vi' ? 'Ra quyết định: ' : 'Resolved: '}
                                {formatDisputeDateTime(report.resolvedAt)}
                              </span>
                            </div>
                          )}

                          {(report.returnShipment || report.returnShipmentId || report.resolutionAction === 'RETURN_AND_REFUND') && (
                            <div className="p-3 rounded-xl bg-indigo-50/90 border border-indigo-200 text-xs text-indigo-950 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-extrabold flex items-center gap-1.5 text-indigo-900">
                                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>
                                    {report.returnShipment?.status === 'DELIVERED'
                                      ? 'Kiện hàng đã hoàn về kho'
                                      : report.returnShipment?.status === 'IN_TRANSIT' || report.returnShipment?.status === 'DELIVERING'
                                        ? 'Đang giao hàng hoàn về cho bạn'
                                        : report.returnShipment?.orderCode
                                          ? 'Khách đã tạo vận đơn Lalamove'
                                          : 'Chờ tạo vận đơn hoàn hàng'}
                                  </span>
                                </div>
                                {report.returnShipment?.status && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    {returnStatusLabels[report.returnShipment.status] || report.returnShipment.status}
                                  </span>
                                )}
                              </div>
                              {report.returnShipment?.orderCode && (
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-200/60">
                                  <p className="text-[11px] text-slate-700">
                                    Mã vận đơn: <strong className="font-mono text-indigo-900">#{report.returnShipment.orderCode}</strong>
                                  </p>
                                  {report.orderId && onOpenOrder ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenOrder(report.orderId!);
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                                    >
                                      <span>Xem hành trình</span>
                                      <ChevronRight className="w-3 h-3" />
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : report.status === 'IN_REVIEW' ? (
                        <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <Scale className="w-3 h-3 text-blue-600" />
                            <span>Đang trong phiên phân xử</span>
                          </div>
                          <p className="text-[11px] text-blue-800 leading-tight">
                            Trọng tài viên SecondLife đang đối soát lời khai và video/ảnh bằng chứng của cả hai bên.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Đang chờ phân bổ</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-tight">
                            Yêu cầu khiếu nại đã được ghi nhận vào hàng đợi xử lý của nhân viên SecondLife.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      {/* Seller Response CTA Button */}
                      {canRespond ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReportId(report.id)}
                          className="w-full py-2 px-3 bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Phản hồi khiếu nại' : 'Respond to dispute'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedReportId(report.id)}
                          className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lang === 'vi' ? 'Xem chi tiết khiếu nại' : 'View case details'}</span>
                        </button>
                      )}

                      {/* Timeline Button */}
                      <button
                        type="button"
                        onClick={() => setTimelineReportId(report.id)}
                        className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-[#24263e] border border-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>{lang === 'vi' ? 'Xem toàn bộ tiến trình' : 'View Full Timeline'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {computedTotalPages > 1 && (
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Trang <strong className="text-slate-800">{page + 1}</strong> trên <strong className="text-slate-800">{computedTotalPages}</strong>
            {totalElements > 0 && <span className="ml-1 text-slate-400">({totalElements} khiếu nại)</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer font-bold transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Trang trước</span>
            </button>
            <button
              type="button"
              disabled={loading || page + 1 >= computedTotalPages}
              onClick={() => setPage((p) => Math.min(computedTotalPages - 1, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer font-bold transition"
            >
              <span>Trang sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Response Modal Dialog */}
      {selectedReport && (
        <SellerDisputeResponseModal
          key={selectedReport.id}
          isOpen
          reportId={selectedReport.id}
          orderId={selectedReport.orderId}
          responseState={getSellerDisputeResponseState(selectedReport)}
          complaintReasonLabel={getReasonLabel(selectedReport.reasonCode)}
          responseDeadline={selectedReport.sellerResponseDeadlineAt}
          onClose={() => setSelectedReportId(null)}
          onSuccess={() => setRefresh((value) => value + 1)}
        />
      )}

      {/* Detail Timeline Modal for Seller */}
      {typeof document !== 'undefined' && timelineReportId && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn"
          onClick={() => setTimelineReportId(null)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-xl w-full h-[88vh] max-h-[88vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden text-[#24263e]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Khóa cứng ở đỉnh */}
            <div className="h-14 px-5 bg-[#24263e] text-white border-b border-white/10 flex items-center justify-between shrink-0 select-none z-20">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#cea981]" />
                <h3 className="text-sm font-black text-white">
                  {lang === 'vi' ? 'Tiến trình trọng tài khiếu nại' : 'Dispute Arbitration Timeline'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimelineReportId(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center font-bold transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 subtle-scrollbar">
              {timelineLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#c34c36]" />
                  <span className="text-xs font-medium">Đang tải chi tiết tiến trình...</span>
                </div>
              ) : timelineError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {timelineError}
                </div>
              ) : timelineReport ? (
                <>
                  {/* Status Header */}
                  <div className="flex items-center justify-between bg-[#faf8f5] p-3 rounded-xl border border-gray-200">
                    <div>
                      <div className="text-[11px] text-slate-500 font-bold">Mã hồ sơ khiếu nại</div>
                      <div className="text-xs font-black font-mono text-[#24263e] mt-0.5">
                        #{timelineReport.id}
                      </div>
                    </div>
                    <div>{getStatusBadge(timelineReport.status)}</div>
                  </div>

                  {/* Step Timeline */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-black text-[#24263e] uppercase tracking-wider">
                      {lang === 'vi' ? 'Dòng thời gian xử lý' : 'Processing Timeline'}
                    </h4>

                    <div className="space-y-4 pl-2 border-l-2 border-[#c34c36]/40 ml-2">
                      {/* Step 1: Open */}
                      <div className="relative pl-5">
                        <div className="absolute -left-[15px] top-0.5 w-5 h-5 rounded-full bg-[#c34c36] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          1
                        </div>
                        <div className="text-xs font-black text-[#24263e]">
                          {lang === 'vi' ? 'Tiếp nhận khiếu nại & đóng băng Escrow' : 'Case Opened & Escrow Frozen'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(timelineReport.createdAt).toLocaleString('vi-VN')}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 bg-[#faf8f5] p-2.5 rounded-lg border border-gray-100">
                          Lý do: <strong>{getReasonLabel(timelineReport.reasonCode)}</strong>
                          <br />
                          Nội dung: "{timelineReport.description || 'Tôi muốn hoàn hàng'}"
                        </p>

                        {/* Bằng chứng */}
                        {timelineReport.evidenceUrls && timelineReport.evidenceUrls.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/70">
                            <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                              <span>{lang === 'vi' ? 'Bằng chứng đã cung cấp' : 'Uploaded evidence'}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({timelineReport.evidenceUrls.length} tệp)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {timelineReport.evidenceUrls.map((url, idx) => (
                                <DisputeEvidenceThumbnail
                                  key={`timeline-${url}-${idx}`}
                                  url={url}
                                  idx={idx}
                                  onOpen={(view) => setPreview({ kind: view.kind, src: view.src, dispose: view.dispose || (() => { }) })}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Step 2: In Review */}
                      <div className="relative pl-5">
                        <div
                          className={`absolute -left-[15px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${timelineReport.status === 'IN_REVIEW' ||
                            timelineReport.status === 'CONFIRMED' ||
                            timelineReport.status === 'DISMISSED'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                            }`}
                        >
                          2
                        </div>
                        <div className="text-xs font-black text-[#24263e]">
                          {lang === 'vi' ? 'Thẩm định chứng từ & đối soát bằng chứng' : 'Evidence Audit & Review'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {timelineReport.status === 'OPEN'
                            ? 'Đang chờ phân bổ nhân viên trọng tài hoặc người bán phản hồi'
                            : 'Trọng tài viên đang xem xét bằng chứng của hai bên'}
                        </div>
                      </div>

                      {/* Step 3: Resolved */}
                      <div className="relative pl-5">
                        <div
                          className={`absolute -left-[15px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${timelineReport.status === 'CONFIRMED'
                            ? 'bg-emerald-600 text-white'
                            : timelineReport.status === 'DISMISSED'
                              ? 'bg-slate-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                            }`}
                        >
                          3
                        </div>
                        <div className="text-xs font-black text-[#24263e]">
                          {lang === 'vi' ? 'Phán quyết trọng tài cuối cùng' : 'Final Arbitration Decision'}
                        </div>
                        {timelineReport.resolvedAt ? (
                          <div className="mt-1.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{getResponsiblePartyLabel(timelineReport.responsibleParty)}</span>
                            </div>
                            {timelineReport.decisionReason && (
                              <p className="text-[11px] text-emerald-800">
                                "{timelineReport.decisionReason}"
                              </p>
                            )}
                            <div className="text-[10px] text-slate-500 pt-1">
                              {lang === 'vi' ? 'Thời gian ra quyết định: ' : 'Decision time: '}
                              {formatDisputeDateTime(timelineReport.resolvedAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 mt-0.5">Chưa có phán quyết cuối cùng</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Return and Refund section if applicable */}
                  {timelineReport.orderId && timelineReport.resolutionAction === 'RETURN_AND_REFUND' && (
                    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 text-xs text-[#24263e] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Truck className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-indigo-950">
                              {lang === 'vi' ? 'Tiến trình hoàn trả hàng về cho người bán' : 'Return Shipment to Seller'}
                            </h4>
                            <p className="text-[10px] text-slate-500">Đối tác vận chuyển: <strong>Lalamove Logistics</strong></p>
                          </div>
                        </div>
                        {returnShipment?.status && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${returnShipment.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : returnShipment.status === 'IN_TRANSIT' || returnShipment.status === 'DELIVERING' || returnShipment.status === 'PICKED_UP'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}>
                            {returnStatusLabels[returnShipment.status] || returnShipment.status}
                          </span>
                        )}
                      </div>

                      {timelineReport.refundedAt ? (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-emerald-900">
                          <p className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Đã hoàn tiền cho người mua{timelineReport.refundAmount == null ? '' : ' · ' + formatVND(timelineReport.refundAmount)}</span>
                          </p>
                          <p className="text-[11px] text-slate-500">Thời gian hoàn tất: {new Date(timelineReport.refundedAt).toLocaleString('vi-VN')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {returnShipment ? (
                            <>
                              <div className="p-3 rounded-xl bg-white border border-indigo-100 shadow-3xs space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] border-b border-gray-100 pb-2">
                                  <span>Mã vận đơn Lalamove:</span>
                                  <strong className="font-mono text-xs bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                                    #{returnShipment.orderCode ?? returnShipment.shipmentId}
                                  </strong>
                                </div>

                                {/* Lộ trình giao nhận hoàn */}
                                <div className="space-y-2 pt-1 text-[11px]">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-bold text-slate-800">Điểm lấy hàng (Người mua hoàn trả): </span>
                                      <span className="text-slate-600">
                                        {returnShipment.senderName ? `${returnShipment.senderName} (${returnShipment.senderPhone || ''}) - ` : ''}
                                        {returnShipment.senderAddress || 'Địa chỉ người mua'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-bold text-slate-800">Điểm nhận hàng (Kho người bán): </span>
                                      <span className="text-slate-600">
                                        {returnShipment.receiverName ? `${returnShipment.receiverName} (${returnShipment.receiverPhone || ''}) - ` : ''}
                                        {returnShipment.receiverAddress || 'Địa chỉ kho của bạn'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Thông tin tài xế nếu đã có */}
                                {(returnShipment.driverName || (returnShipment as any).plateNumber) && (
                                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-slate-700">
                                    <div className="flex items-center gap-1.5 font-medium">
                                      <User className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Tài xế: <strong>{returnShipment.driverName || 'Lalamove Driver'}</strong> {returnShipment.driverPhone ? `(${returnShipment.driverPhone})` : ''}</span>
                                    </div>
                                    {(returnShipment as any).plateNumber && (
                                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {(returnShipment as any).plateNumber}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                <span className="text-[11px] text-indigo-900/80 font-medium">
                                  {returnShipment.status === 'DELIVERED'
                                    ? 'Kiện hàng đã chuyển về kho người bán. Hệ thống đang tiến hành đối soát và hoàn tiền.'
                                    : 'Kiện hàng đang được chuyển hoàn về kho của bạn. Bạn có thể theo dõi tiến trình trong mục Đơn hàng.'}
                                </span>
                                {onOpenOrder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTimelineReportId(null);
                                      onOpenOrder(timelineReport.orderId!);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-3xs transition cursor-pointer"
                                  >
                                    <Truck className="w-3.5 h-3.5 text-white" />
                                    <span>Theo dõi trong Đơn hàng</span>
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                              <p className="font-bold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Đã duyệt yêu cầu hoàn trả · Đang chờ người mua tạo vận đơn</span>
                              </p>
                              <p className="text-[11px] text-amber-800 leading-relaxed">
                                Người mua được yêu cầu đóng gói sản phẩm và khởi tạo vận đơn Lalamove để gửi trả về địa chỉ kho của bạn. Khi người mua đặt chuyến, thông tin mã vận đơn và vị trí tài xế sẽ hiển thị trực tiếp tại đây.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : null}
            </div>

            {/*  */}
          </div>
        </div>,
        document.body
      )}

      {/* Media Lightbox Preview */}
      {typeof document !== 'undefined' && preview && createPortal(
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md cursor-pointer animate-fadeIn overflow-hidden"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-slate-950/80 rounded-2xl p-2 sm:p-3 border border-white/10 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header thanh xem trước */}
            <div className="w-full flex items-center justify-between pb-2 px-1 text-white border-b border-white/10 mb-2">
              <div className="flex items-center gap-2">
                {preview.kind === 'VIDEO' ? (
                  <Video className="w-4 h-4 text-rose-500" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-bold">
                  {preview.kind === 'VIDEO' ? 'Xem video bằng chứng' : 'Xem ảnh bằng chứng'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1 text-xs"
                title="Đóng (phím Esc)"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Đóng</span>
              </button>
            </div>

            {/* Media Content */}
            <div className="w-full flex items-center justify-center overflow-hidden rounded-xl bg-black/40 min-h-[200px] max-h-[78vh]">
              {preview.kind === 'VIDEO' ? (
                <video
                  src={preview.src}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[75vh] rounded-xl object-contain"
                />
              ) : (
                <img
                  src={preview.src}
                  alt="Ảnh bằng chứng"
                  className="w-full max-h-[75vh] rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}

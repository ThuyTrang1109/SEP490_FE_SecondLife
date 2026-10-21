import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Plus,
  ExternalLink,
  ChevronRight,
  Package,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  ArrowLeft,
  X,
  User,
  ShieldAlert
} from 'lucide-react';
import { Language, UserProfile, EscrowOrder, UserRole } from '../types';
import {
  userReportService,
  UserReportResponseDto,
  ReportStatus,
  ReportReasonCode,
  ResponsibleParty
} from '../services/userReportService';
import { UserReportModal } from '../components/modals/UserReportModal';

interface MyDisputesViewProps {
  currentUser: UserProfile | null;
  lang: Language;
  onNavigateToOrder?: (orderId: string) => void;
  onNavigateToPost?: (postId: string) => void;
  orders?: EscrowOrder[];
  onBack?: () => void;
  currentRole?: UserRole;
}

export const MyDisputesView: React.FC<MyDisputesViewProps> = ({
  currentUser,
  lang,
  onNavigateToOrder,
  onNavigateToPost,
  orders = [],
  onBack,
  currentRole,
}) => {
  const isSeller = currentRole === 'seller' || currentUser?.role === 'seller';
  const [reports, setReports] = useState<UserReportResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [targetFilter, setTargetFilter] = useState<'ALL' | 'ORDER' | 'LISTING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedReport, setSelectedReport] = useState<UserReportResponseDto | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load user reports from BE: GET /api/v1/reports/me
  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await userReportService.getMyReports(0, 50);
      const items = res?.items || [];
      setReports(items);
    } catch (err: any) {
      console.error('[MyDisputesView] Failed to fetch reports:', err);
      setError(
        lang === 'vi'
          ? 'Không thể tải danh sách khiếu nại từ hệ thống. Vui lòng thử lại sau.'
          : 'Unable to load disputes from server. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Translations & Helpers
  const getReasonLabel = (code: ReportReasonCode | string) => {
    switch (code) {
      case 'MISLEADING_DESCRIPTION':
        return lang === 'vi' ? 'Mô tả sai lệch / Che giấu lỗi' : 'Misleading Description';
      case 'COUNTERFEIT':
        return lang === 'vi' ? 'Hàng giả / Hàng nhái' : 'Counterfeit Item';
      case 'FRAUD':
        return lang === 'vi' ? 'Dấu hiệu lừa đảo / Chuyển khoản ngoài' : 'Fraudulent Activity';
      case 'ITEM_NOT_RECEIVED':
        return lang === 'vi' ? 'Chưa nhận được hàng quá hạn' : 'Item Not Received';
      case 'RETURN_NOT_AS_DESCRIBED':
        return lang === 'vi' ? 'Hàng nhận được hư hỏng / Sai khác' : 'Damaged / Different Item';
      case 'LATE_HANDOVER':
        return lang === 'vi' ? 'Người bán chậm bàn giao hàng' : 'Late Handover by Seller';
      case 'SELLER_CANCELLATION':
        return lang === 'vi' ? 'Người bán tự ý hủy đơn hàng' : 'Seller Unilateral Cancellation';
      case 'DUPLICATE_LISTING':
        return lang === 'vi' ? 'Tin đăng trùng lặp / Spam' : 'Duplicate Listing';
      case 'OTHER':
      default:
        return lang === 'vi' ? 'Lý do khác' : 'Other Reason';
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
            <span>{lang === 'vi' ? 'Chờ Tiếp Nhận' : 'Pending Review'}</span>
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
            <Scale className="w-3 h-3 text-blue-600" />
            <span>{lang === 'vi' ? 'Đang Thẩm Định' : 'In Arbitration'}</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{lang === 'vi' ? 'Đã Xác Nhận Vi Phạm' : 'Confirmed / Resolved'}</span>
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-500" />
            <span>{lang === 'vi' ? 'Đã Bác Bỏ' : 'Dismissed'}</span>
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
        return lang === 'vi' ? 'Người bán chịu trách nhiệm (Hoàn tiền cho người mua)' : 'Seller Fault (Refund Buyer)';
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

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    // Target filter
    if (targetFilter === 'ORDER' && !r.orderId) return false;
    if (targetFilter === 'LISTING' && !r.postId) return false;

    // Status filter
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDesc = r.description?.toLowerCase().includes(q);
      const matchReason = r.reasonCode?.toLowerCase().includes(q);
      const matchId = r.id?.toLowerCase().includes(q);
      const matchOrder = r.orderId?.toLowerCase().includes(q);
      const matchPost = r.postId?.toLowerCase().includes(q);
      if (!matchDesc && !matchReason && !matchId && !matchOrder && !matchPost) {
        return false;
      }
    }

    return true;
  });

  // Statistics
  const totalCount = reports.length;
  const openCount = reports.filter((r) => r.status === 'OPEN').length;
  const inReviewCount = reports.filter((r) => r.status === 'IN_REVIEW').length;
  const resolvedCount = reports.filter((r) => r.status === 'CONFIRMED' || r.status === 'DISMISSED').length;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] pb-16">
      {/* Top Banner / Header */}
      <div className="bg-[#24263e] text-white pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-b border-black/10 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition cursor-pointer font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Quay lại' : 'Back'}</span>
                </button>
              )}
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e36a54] flex items-center justify-center text-white shadow-md">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {lang === 'vi' ? 'Khiếu Nại & Trọng Tài Escrow' : 'My Disputes & Arbitrations'}
                  </h1>
                  <p className="text-xs text-white/70 mt-0.5 font-medium">
                    {lang === 'vi'
                      ? 'Theo dõi minh bạch các yêu cầu khiếu nại đơn hàng & báo cáo vi phạm được bảo lãnh bởi SecondLife'
                      : 'Track all order dispute cases and violation reports protected by SecondLife Escrow'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => fetchReports(true)}
                disabled={refreshing}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1.5 border border-white/15"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
              </button>

              {!isSeller && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95 text-white transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Gửi Khiếu Nại Mới' : 'Open Dispute'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-8">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-white/70 text-xs font-bold">
                <span>{lang === 'vi' ? 'Tổng Khiếu Nại' : 'Total Cases'}</span>
                <FileText className="w-4 h-4 text-white/80" />
              </div>
              <div className="text-2xl font-black text-white mt-1.5 font-mono">{totalCount}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
                <span>{lang === 'vi' ? 'Chờ Tiếp Nhận' : 'Pending Review'}</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-300 mt-1.5 font-mono">{openCount}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-blue-300 text-xs font-bold">
                <span>{lang === 'vi' ? 'Đang Thẩm Định' : 'In Arbitration'}</span>
                <Scale className="w-4 h-4 text-blue-300" />
              </div>
              <div className="text-2xl font-black text-blue-300 mt-1.5 font-mono">{inReviewCount}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                <span>{lang === 'vi' ? 'Đã Giải Quyết' : 'Resolved / Closed'}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-1.5 font-mono">{resolvedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Target Type Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-[#faf8f5] p-1 rounded-xl border border-gray-200 overflow-x-auto">
              <button
                onClick={() => setTargetFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  targetFilter === 'ALL'
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#24263e]'
                }`}
              >
                {lang === 'vi' ? 'Tất cả đối tượng' : 'All Targets'}
              </button>
              <button
                onClick={() => setTargetFilter('ORDER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  targetFilter === 'ORDER'
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#24263e]'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đơn Hàng Escrow' : 'Orders'}</span>
              </button>
              <button
                onClick={() => setTargetFilter('LISTING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  targetFilter === 'LISTING'
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#24263e]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Bài Đăng Bán' : 'Listings'}</span>
              </button>
            </div>

            {/* Status Filter & Search Input */}
            <div className="flex items-center gap-2.5 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'vi'
                      ? 'Tìm theo mã khiếu nại, mã đơn, nội dung...'
                      : 'Search by case ID, order ID, description...'
                  }
                  className="w-full pl-9 pr-3 py-2 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36] cursor-pointer"
              >
                <option value="ALL">{lang === 'vi' ? 'Mọi trạng thái' : 'All Statuses'}</option>
                <option value="OPEN">{lang === 'vi' ? 'Chờ Tiếp Nhận' : 'Pending'}</option>
                <option value="IN_REVIEW">{lang === 'vi' ? 'Đang Thẩm Định' : 'In Review'}</option>
                <option value="CONFIRMED">{lang === 'vi' ? 'Đã Xác Nhận Vi Phạm' : 'Confirmed'}</option>
                <option value="DISMISSED">{lang === 'vi' ? 'Đã Bác Bỏ' : 'Dismissed'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Content List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-1/3 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-6 bg-slate-200 rounded-full" />
                </div>
                <div className="w-2/3 h-4 bg-slate-200 rounded" />
                <div className="w-full h-12 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800 space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="text-sm font-bold">{error}</p>
            <button
              onClick={() => fetchReports(true)}
              className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
            >
              {lang === 'vi' ? 'Thử lại' : 'Retry'}
            </button>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Scale className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-black text-[#24263e]">
                {lang === 'vi' ? 'Chưa Có Khiếu Nại Nào' : 'No Disputes Found'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {lang === 'vi'
                  ? 'Khi có sai khác về đơn hàng đã nhận hoặc phát hiện sản phẩm có dấu hiệu vi phạm, bạn có thể gửi yêu cầu để Ban Quản Trị SecondLife hỗ trợ bảo vệ quyền lợi.'
                  : 'When there are discrepancies with delivered orders or listings, you can file a dispute for SecondLife Arbitration.'}
              </p>
            </div>
            {!isSeller && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                {lang === 'vi' ? 'Tạo khiếu nại đầu tiên' : 'File a dispute now'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const isOrder = Boolean(report.orderId);
              const hasResolvedDecision = report.status === 'CONFIRMED' || report.status === 'DISMISSED';

              return (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
                          isOrder ? 'bg-[#24263e]' : 'bg-[#c34c36]'
                        }`}
                      >
                        {isOrder ? <Package className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#24263e] font-mono">
                            Mã vụ việc: #{report.id.substring(0, 8)}...
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                            {isOrder ? 'Đơn hàng' : 'Bài đăng'}
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
                    <div className="md:col-span-8 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-black flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>{getReasonLabel(report.reasonCode)}</span>
                        </span>

                        {report.orderId && (
                          <button
                            onClick={() => onNavigateToOrder?.(report.orderId!)}
                            className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Đơn hàng #{report.orderId.substring(0, 8)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}

                        {report.postId && (
                          <button
                            onClick={() => onNavigateToPost?.(report.postId!)}
                            className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Bài đăng #{report.postId.substring(0, 8)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-normal bg-[#faf8f5] p-3 rounded-xl border border-gray-100">
                        "{report.description}"
                      </p>

                      {/* Evidence Photo Thumbnails */}
                      {report.evidenceUrls && report.evidenceUrls.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Bằng chứng đã cung cấp:' : 'Uploaded Evidence:'}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {report.evidenceUrls.map((url, idx) => (
                              <button
                                key={idx}
                                onClick={() => setPreviewImage(url)}
                                className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 hover:ring-2 hover:ring-[#c34c36] transition cursor-pointer relative group bg-slate-50"
                              >
                                <img
                                  src={url}
                                  alt={`Evidence ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as any).src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&q=80&w=200';
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arbitration Resolution Column */}
                    <div className="md:col-span-4 bg-[#faf8f5] rounded-xl p-3.5 border border-gray-200 flex flex-col justify-between space-y-2">
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-[#24263e] flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-[#c34c36]" />
                          <span>{lang === 'vi' ? 'Phán Quyết Trọng Tài' : 'Arbitration Outcome'}</span>
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
                                  {lang === 'vi' ? 'Hoàn tất vào: ' : 'Resolved: '}
                                  {new Date(report.resolvedAt).toLocaleDateString('vi-VN')}
                                </span>
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
                              Yêu cầu khiếu nại đã được ghi nhận vào hàng đợi xử lý của Trọng tài SecondLife.
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedReport(report)}
                        className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-[#24263e] border border-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>{lang === 'vi' ? 'Xem Toàn Bộ Tiến Trình' : 'View Full Timeline'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Timeline Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col text-[#24263e]">
            {/* Modal Header */}
            <div className="bg-[#24263e] text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#cea981]" />
                <h3 className="text-sm font-black text-white">
                  {lang === 'vi' ? 'Tiến Trình Trọng Tài Khiếu Nại' : 'Dispute Arbitration Timeline'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 subtle-scrollbar">
              {/* Status Header */}
              <div className="flex items-center justify-between bg-[#faf8f5] p-3 rounded-xl border border-gray-200">
                <div>
                  <div className="text-[11px] text-slate-500 font-bold">Mã hồ sơ khiếu nại</div>
                  <div className="text-xs font-black font-mono text-[#24263e] mt-0.5">
                    #{selectedReport.id}
                  </div>
                </div>
                <div>{getStatusBadge(selectedReport.status)}</div>
              </div>

              {/* Step Timeline */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black text-[#24263e] uppercase tracking-wider">
                  {lang === 'vi' ? 'Dòng Thời Gian Xử Lý' : 'Processing Timeline'}
                </h4>

                <div className="space-y-4 pl-2 border-l-2 border-[#c34c36]/40 ml-2">
                  {/* Step 1: Open */}
                  <div className="relative pl-5">
                    <div className="absolute -left-[15px] top-0.5 w-5 h-5 rounded-full bg-[#c34c36] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      1
                    </div>
                    <div className="text-xs font-black text-[#24263e]">
                      {lang === 'vi' ? 'Tiếp Nhận Khiếu Nại & Đóng Băng Escrow' : 'Case Opened & Escrow Frozen'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(selectedReport.createdAt).toLocaleString('vi-VN')}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 bg-[#faf8f5] p-2.5 rounded-lg border border-gray-100">
                      Lý do: <strong>{getReasonLabel(selectedReport.reasonCode)}</strong>
                      <br />
                      Nội dung: "{selectedReport.description}"
                    </p>
                  </div>

                  {/* Step 2: In Review */}
                  <div className="relative pl-5">
                    <div
                      className={`absolute -left-[15px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                        selectedReport.status === 'IN_REVIEW' || selectedReport.status === 'CONFIRMED' || selectedReport.status === 'DISMISSED'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      2
                    </div>
                    <div className="text-xs font-black text-[#24263e]">
                      {lang === 'vi' ? 'Thẩm Định Chứng Từ & Đối Soát Bằng Chứng' : 'Evidence Audit & Review'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedReport.status === 'OPEN'
                        ? 'Đang chờ phân bổ nhân viên trọng tài'
                        : 'Trọng tài viên đang xem xét bằng chứng'}
                    </div>
                  </div>

                  {/* Step 3: Resolved */}
                  <div className="relative pl-5">
                    <div
                      className={`absolute -left-[15px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                        selectedReport.status === 'CONFIRMED'
                          ? 'bg-emerald-600 text-white'
                          : selectedReport.status === 'DISMISSED'
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      3
                    </div>
                    <div className="text-xs font-black text-[#24263e]">
                      {lang === 'vi' ? 'Phán Quyết Trọng Tài Cuối Cùng' : 'Final Arbitration Decision'}
                    </div>
                    {selectedReport.resolvedAt ? (
                      <div className="mt-1.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{getResponsiblePartyLabel(selectedReport.responsibleParty)}</span>
                        </div>
                        {selectedReport.decisionReason && (
                          <p className="text-[11px] text-emerald-800">
                            "{selectedReport.decisionReason}"
                          </p>
                        )}
                        <div className="text-[10px] text-slate-500 pt-1">
                          Hoàn tất ngày: {new Date(selectedReport.resolvedAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-0.5">Chưa có phán quyết cuối cùng</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Escrow Protection Promise */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Cam kết bảo lãnh Escrow:</strong> Tiền ký quỹ của giao dịch đang được đóng băng tuyệt đối an toàn trong Quỹ Tín Thác SecondLife. Không bên nào có thể rút tiền cho đến khi vụ việc được trọng tài giải quyết dứt điểm.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Evidence Preview"
              className="w-full h-full object-contain rounded-xl max-h-[80vh] mx-auto shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-white/20 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Create New Report / Dispute Modal (Chỉ dành cho người mua) */}
      {!isSeller && (
        <UserReportModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchReports(true);
          }}
        />
      )}
    </div>
  );
};

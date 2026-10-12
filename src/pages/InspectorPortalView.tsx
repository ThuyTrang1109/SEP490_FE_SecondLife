import React, { useState, useEffect } from 'react';
import { InspectionCenter, EscrowOrder, InspectionChecklistItem, Language, UserProfile } from '../types';
import { formatVND } from '../utils/translations';
import { mockInspectionCenters, mockStandardChecklist } from '../data/mockData';
import { ProductInspectionStationView } from './ProductInspectionStationView';
import {
  Building2,
  QrCode,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Printer,
  RefreshCw,
  Loader2,
  Users,
  UserPlus,
  ClipboardList,
  Search,
  Plus,
  X,
  UserCheck,
  Calendar,
  AlertCircle,
  DollarSign,
  Wallet,
  FileText,
  MapPin,
  Phone,
  Camera,
  Check,
  Download,
  Clock,
  Wrench,
  Sparkles,
  Navigation,
  Eye,
  Trash2,
  Share2
} from 'lucide-react';
import {
  inspectorService,
  InspectionOrderDto,
  InspectionStaffDto,
  CreateInspectionStaffRequest
} from '../services';

interface InspectorPortalViewProps {
  orders: EscrowOrder[];
  currentUser?: UserProfile | null;
  onCompleteInspection: (orderId: string, verdict: 'PASS' | 'FAIL', tamperSeal: string, summary: string) => void;
  lang: Language;
}

export type PortalTab = 'my_workbench' | 'center_dispatch' | 'center_staff' | 'center_finance';

export const InspectorPortalView: React.FC<InspectorPortalViewProps> = ({
  orders,
  currentUser,
  onCompleteInspection,
  lang,
}) => {
  const [activeCenter, setActiveCenter] = useState<InspectionCenter>(mockInspectionCenters[0]);
  const [portalTab, setPortalTab] = useState<PortalTab>('my_workbench');

  // --- TAB 1: WORKBENCH STATES ---
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [backendOrders, setBackendOrders] = useState<InspectionOrderDto[]>([]);
  const [isLoadingBackendOrders, setIsLoadingBackendOrders] = useState(false);

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>(
    mockStandardChecklist['Tủ lạnh & Tủ đông'] || mockStandardChecklist['Máy giặt & Máy sấy'] || []
  );
  const [overallVerdict, setOverallVerdict] = useState<'PASS' | 'FAIL'>('PASS');
  const [conditionScore, setConditionScore] = useState<number>(94);
  const [tamperSealInput, setTamperSealInput] = useState('SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000));
  const [inspectorNotes, setInspectorNotes] = useState(
    'Máy nén Compressor & Áp suất Gas R600a siêu êm, độ lạnh -19.2°C chuẩn xác, gioăng cửa hít nam châm nguyên bản. Đạt chuẩn Grade A (Like New).'
  );
  const [proofPhotos, setProofPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80'
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview / Print Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // --- TAB 2: DISPATCH QUEUE STATES (GET /inspector/orders/all & POST /assign) ---
  const [allOrdersList, setAllOrdersList] = useState<InspectionOrderDto[]>([]);
  const [isLoadingAllOrders, setIsLoadingAllOrders] = useState(false);
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME'>('ALL');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [assignEstimatedSlot, setAssignEstimatedSlot] = useState<string>('09:00 - 11:30 Sáng');
  const [assignNote, setAssignNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // --- TAB 3: STAFF MANAGEMENT STATES (GET /inspector-center/staff & POST /staff) ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState<CreateInspectionStaffRequest>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });

  // --- TAB 4: FINANCE & SPLIT STATES ---
  const [financeTimeRange, setFinanceTimeRange] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'ALL'>('THIS_MONTH');

  // Load My Orders
  const loadMyOrders = async () => {
    setIsLoadingBackendOrders(true);
    try {
      const data = await inspectorService.getMyOrders();
      if (data && Array.isArray(data)) {
        setBackendOrders(data);
      }
    } catch (err) {
      console.warn('Chưa có đơn kiểm định gán riêng cho tài khoản:', err);
    } finally {
      setIsLoadingBackendOrders(false);
    }
  };

  // Load All Orders (Hub Dispatch)
  const loadAllOrders = async () => {
    setIsLoadingAllOrders(true);
    try {
      const res = await inspectorService.getAllOrders(
        allOrdersStatusFilter === 'ALL' ? undefined : allOrdersStatusFilter
      );
      const items = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
      setAllOrdersList(items);
    } catch (err: any) {
      console.warn('Backend load all orders error:', err);
      setAllOrdersList([]);
    } finally {
      setIsLoadingAllOrders(false);
    }
  };

  // Load Staff
  const loadStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await inspectorService.getStaff();
      if (Array.isArray(data)) {
        setStaffList(data);
      } else {
        setStaffList([]);
      }
    } catch (err) {
      console.warn('Backend load staff error:', err);
      setStaffList([]);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadMyOrders();
    loadStaff();
  }, []);

  const triggerNotice = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const toggleCheckItem = (id: string, status: 'pass' | 'fail') => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  // Add proof photo
  const handleAddSamplePhoto = (url: string) => {
    if (!proofPhotos.includes(url)) {
      setProofPhotos([...proofPhotos, url]);
      triggerNotice(lang === 'vi' ? 'Đã thêm ảnh bằng chứng kiểm định' : 'Added proof photo');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setProofPhotos(proofPhotos.filter((_, i) => i !== index));
  };

  // Submit Result for current order
  const handleFinishInspection = async () => {
    if (!activeOrder?.id) return;
    setIsSubmitting(true);
    try {
      await inspectorService.submitResult(activeOrder.id, {
        status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
        note: `[Tem: ${tamperSealInput}][Điểm: ${conditionScore}/100] ${inspectorNotes}`,
      });
    } catch (err) {
      console.warn('Backend inspection submission fallback:', err);
    }

    onCompleteInspection(
      activeOrder.id,
      overallVerdict,
      tamperSealInput,
      `[Điểm: ${conditionScore}/100] ${inspectorNotes}`
    );
    setIsSubmitting(false);
    triggerNotice(
      lang === 'vi'
        ? `Đã nghiệm thu thành công đơn hàng #${activeOrder.id}! Báo cáo số đã được xuất và dán tem niêm phong ${tamperSealInput}.`
        : `Order #${activeOrder.id} successfully inspected! Digital report issued with seal ${tamperSealInput}.`
    );
  };

  // Assign Inspector Handler
  const handleConfirmAssign = async () => {
    if (!assignModalOrder || !selectedInspectorId) {
      triggerNotice(lang === 'vi' ? 'Vui lòng chọn kỹ thuật viên' : 'Please select an inspector', true);
      return;
    }
    setIsAssigning(true);
    try {
      await inspectorService.assignInspector(assignModalOrder.id, selectedInspectorId);
      const inspectorObj = staffList.find((s) => s.id === selectedInspectorId);
      triggerNotice(
        lang === 'vi'
          ? `Đã phân công đơn #${assignModalOrder.id} cho kỹ thuật viên ${inspectorObj?.fullName || selectedInspectorId} thành công!`
          : `Assigned order #${assignModalOrder.id} to inspector successfully!`
      );
      setAssignModalOrder(null);
      setSelectedInspectorId('');
      setAssignNote('');
      loadAllOrders();
    } catch (err: any) {
      triggerNotice(err?.message || (lang === 'vi' ? 'Phân công kỹ thuật viên thất bại' : 'Failed to assign inspector'), true);
    } finally {
      setIsAssigning(false);
    }
  };

  // Create Staff Handler
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.email || !newStaffForm.password || !newStaffForm.fullName) {
      triggerNotice(lang === 'vi' ? 'Vui lòng điền đầy đủ các trường bắt buộc' : 'Please fill all required fields', true);
      return;
    }
    setIsCreatingStaff(true);
    try {
      await inspectorService.createStaff(newStaffForm);
      triggerNotice(
        lang === 'vi'
          ? `Đã tạo tài khoản kiểm định viên ${newStaffForm.fullName} thành công!`
          : `Created inspector account for ${newStaffForm.fullName} successfully!`
      );
      setIsCreateStaffModalOpen(false);
      setNewStaffForm({ email: '', password: '', fullName: '', phone: '' });
      loadStaff();
    } catch (err: any) {
      triggerNotice(err?.message || (lang === 'vi' ? 'Không thể tạo nhân viên' : 'Failed to create staff'), true);
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Print Certificate Helper
  const handlePrintCertificate = () => {
    window.print();
  };

  // Finance calculations from real orders
  const completedOrders = orders.filter((o) =>
    Boolean(o.inspectionReport) ||
    (o.escrowStatus as string) === 'COMPLETED' ||
    o.escrowStatus === 'COMPLETED_RELEASED'
  );
  const totalCompletedOrders = completedOrders.length;
  const financeOrders = orders.map((o) => {
    const isAtHome = o.inspectionMethod === 'AT_HOME';
    const baseFee = isAtHome ? 200000 : 120000;
    const hubShare = isAtHome ? 170000 : 90000;
    const platformShare = baseFee - hubShare;
    return {
      orderId: o.id,
      title: o.listing?.title || 'Thiết bị gia dụng',
      method: (o.inspectionMethod || 'AT_CENTER') as 'AT_HOME' | 'AT_CENTER',
      totalFee: baseFee,
      hubShare,
      platformShare,
      splitRule: o.inspectionFeeSplit || 'SPLIT_50_50',
      status: ((o.escrowStatus as string) === 'COMPLETED' || o.escrowStatus === 'COMPLETED_RELEASED') ? 'PAID_OUT' : 'HELD_IN_ESCROW',
      date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo'
    };
  });

  const grossFees = financeOrders.reduce((sum, item) => sum + item.totalFee, 0);
  const netHubRevenue = financeOrders.reduce((sum, item) => sum + item.hubShare, 0);
  const platformRevenue = financeOrders.reduce((sum, item) => sum + item.platformShare, 0);

  return (
    <div className="space-y-6 pb-16 text-[#24263e]">
      {/* Top Header Banner */}
      <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#24263e]/15 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#24263e]/15 text-[#24263e] text-xs font-bold shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
              <span>
                {lang === 'vi'
                  ? 'Cổng Giám Định Viên & Quản Lý Trung Tâm Kiểm Định Chuẩn ISO/IEC 17025'
                  : 'Certified Inspection Center Portal & Hub Operations'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-[#24263e] flex items-center gap-2">
              <span>{activeCenter.name}</span>
              <span className="text-xs bg-[#c34c36] text-white px-2.5 py-0.5 rounded-full font-bold">
                {activeCenter.city} Hub
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#24263e]/80 mt-1 font-semibold flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                {activeCenter.address}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#24263e]" />
                {lang === 'vi' ? 'Hotline kỹ thuật: ' : 'Hotline: '}
                {activeCenter.phone}
              </span>
            </p>
          </div>

          <div className="bg-white/70 p-2.5 rounded-2xl border border-[#24263e]/15 flex flex-col gap-1.5 self-start md:self-auto shadow-xs">
            <span className="text-[11px] font-black text-[#24263e] px-2 flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-[#c34c36]" />
              {lang === 'vi' ? 'Đổi Cơ Sở / Chi Nhánh:' : 'Switch Hub Center:'}
            </span>
            <div className="flex flex-wrap gap-1">
              {mockInspectionCenters.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => setActiveCenter(hub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeCenter.id === hub.id
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-white/80 text-[#24263e] hover:bg-white'
                  }`}
                >
                  {hub.city}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#24263e]/15">
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Công suất Lab / ngày' : 'Daily Lab Capacity'}</span>
            </div>
            <div className="text-xl font-extrabold text-[#24263e] mt-0.5">
              {activeCenter.capacityPerDay} {lang === 'vi' ? 'máy' : 'units'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Hàng đợi đang xử lý' : 'Active Queue'}</span>
            </div>
            <div className="text-xl font-extrabold text-[#24263e] mt-0.5">
              {activeCenter.currentQueue} {lang === 'vi' ? 'đơn chờ' : 'orders'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Tỷ lệ đạt chuẩn Pass' : 'Pass Rate'}</span>
            </div>
            <div className="text-xl font-extrabold text-[#24263e] mt-0.5">{activeCenter.passRatePercentage}%</div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'vi' ? 'Doanh thu Hub tháng này' : 'Hub Revenue'}</span>
            </div>
            <div className="text-xl font-extrabold text-[#c34c36] mt-0.5 font-mono">
              {formatVND(netHubRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto bg-white p-2 rounded-2xl shadow-xs">
        <button
          onClick={() => setPortalTab('my_workbench')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            portalTab === 'my_workbench'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wrench className="w-4 h-4 text-[#fce5da]" />
          <span>{lang === 'vi' ? 'Bàn Kiểm Định Sản Phẩm (Nhân Viên)' : 'Product Inspection Station'}</span>
        </button>

        <button
          onClick={() => {
            setPortalTab('center_dispatch');
            loadAllOrders();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            portalTab === 'center_dispatch'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-[#fce5da]" />
          <span>{lang === 'vi' ? 'Điều Phối Đơn Kiểm Định (Hub Dispatch)' : 'Hub Dispatch Queue'}</span>
        </button>

        <button
          onClick={() => {
            setPortalTab('center_staff');
            loadStaff();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            portalTab === 'center_staff'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-[#fce5da]" />
          <span>{lang === 'vi' ? 'Đội Ngũ Kỹ Thuật Viên' : 'Inspectors & Staff'}</span>
        </button>

        <button
          onClick={() => setPortalTab('center_finance')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            portalTab === 'center_finance'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4 text-[#fce5da]" />
          <span>{lang === 'vi' ? 'Doanh Thu & Đối Soát Phí' : 'Revenue & Fee Split'}</span>
        </button>
      </div>

      {/* Alert Notices */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 font-bold text-sm flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PRODUCT INSPECTION STATION (BÀN KIỂM ĐỊNH SẢN PHẨM CHO NHÂN VIÊN) */}
      {/* ========================================================================= */}
      {portalTab === 'my_workbench' && (
        <ProductInspectionStationView
          orders={orders}
          currentUser={currentUser}
          onCompleteInspection={onCompleteInspection}
          lang={lang}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HUB ORDERS DISPATCH (GET /inspector/orders/all & POST /assign)    */}
      {/* ========================================================================= */}
      {portalTab === 'center_dispatch' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#24263e] flex items-center gap-2">
                <span>{lang === 'vi' ? 'Hàng Đợi Điều Phối & Phân Công Kiểm Định' : 'Hub Orders Dispatch & Assignment'}</span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                  {allOrdersList.length} đơn
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Quản lý toàn bộ đơn kiểm định tiếp nhận tại Hub, phân công kỹ thuật viên kiểm định tại lab hoặc kiểm định tận nơi.'
                  : 'Manage center inspection queue and dispatch technicians.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAllOrders}
                disabled={isLoadingAllOrders}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAllOrders ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={orderSearchTerm}
                onChange={(e) => setOrderSearchTerm(e.target.value)}
                placeholder={lang === 'vi' ? 'Tìm theo mã đơn, tiêu đề sản phẩm...' : 'Search by order ID, title...'}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Method filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs">
                <button
                  onClick={() => setMethodFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    methodFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tất cả HT
                </button>
                <button
                  onClick={() => setMethodFilter('AT_CENTER')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    methodFilter === 'AT_CENTER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tại Lab Hub
                </button>
                <button
                  onClick={() => setMethodFilter('AT_HOME')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    methodFilter === 'AT_HOME' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tại Nhà
                </button>
              </div>

              {/* Status filter */}
              <div className="flex flex-wrap gap-1 items-center">
                {['ALL', 'PENDING', 'ASSIGNED', 'PASSED', 'FAILED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setAllOrdersStatusFilter(st);
                      loadAllOrders();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      allOrdersStatusFilter === st
                        ? 'bg-[#24263e] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Tất cả TT'
                      : st === 'PENDING'
                      ? 'Chưa gán'
                      : st === 'ASSIGNED'
                      ? 'Đã gán'
                      : st === 'PASSED'
                      ? 'Đạt'
                      : 'Từ chối'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                  <th className="py-3 px-4">Mã Đơn (Order ID)</th>
                  <th className="py-3 px-4">Sản Phẩm & Giá Trị</th>
                  <th className="py-3 px-4">Hình Thức Kiểm Định</th>
                  <th className="py-3 px-4">Phí & Chia Phí</th>
                  <th className="py-3 px-4">Kỹ Thuật Viên Phụ Trách</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingAllOrders ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#c34c36]" />
                      <span>{lang === 'vi' ? 'Đang tải hàng đợi điều phối...' : 'Loading dispatch queue...'}</span>
                    </td>
                  </tr>
                ) : allOrdersList.filter(
                    (o) =>
                      (!orderSearchTerm ||
                        o.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                        (o.postTitle && o.postTitle.toLowerCase().includes(orderSearchTerm.toLowerCase())))
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {lang === 'vi' ? 'Không tìm thấy đơn kiểm định nào trong trạng thái này' : 'No inspection orders found'}
                    </td>
                  </tr>
                ) : (
                  allOrdersList
                    .filter(
                      (o) =>
                        !orderSearchTerm ||
                        o.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                        (o.postTitle && o.postTitle.toLowerCase().includes(orderSearchTerm.toLowerCase()))
                    )
                    .map((ord, idx) => {
                      const isAssigned = Boolean(ord.inspectorId || (ord.inspectorName && ord.inspectorName !== 'Chưa phân công'));
                      const isAtHome = idx % 2 === 1;

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">#{ord.id}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 line-clamp-1">
                              {ord.postTitle || 'Thiết bị kiểm định'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {formatVND(ord.postPrice || 0)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isAtHome ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <Navigation className="w-3 h-3 text-purple-600" />
                                Tại Nhà Khách
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <Building2 className="w-3 h-3 text-blue-600" />
                                Tại Lab Hub
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <div className="font-bold text-[#c34c36]">
                              {formatVND(isAtHome ? 200000 : 120000)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Hub: {formatVND(isAtHome ? 170000 : 90000)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isAssigned ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                                <UserCheck className="w-3 h-3" />
                                <span>{ord.inspectorName || ord.inspectorId}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Chưa phân công
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                ord.status === 'PASSED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'FAILED'
                                  ? 'bg-red-100 text-red-800'
                                  : isAssigned
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalOrder(ord);
                                setSelectedInspectorId(ord.inspectorId || (staffList[0]?.id || ''));
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#24263e] hover:bg-black text-white transition cursor-pointer flex items-center gap-1 ml-auto"
                            >
                              <UserPlus className="w-3 h-3 text-[#fce5da]" />
                              <span>{isAssigned ? (lang === 'vi' ? 'Đổi KTV' : 'Reassign') : (lang === 'vi' ? 'Điều Phối' : 'Dispatch')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CENTER STAFF MANAGEMENT (GET /inspector-center/staff & POST)     */}
      {/* ========================================================================= */}
      {portalTab === 'center_staff' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#24263e]">
                {lang === 'vi' ? 'Danh Sách Nhân Viên Giám Định Trung Tâm' : 'Inspection Center Staff Directory'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Quản lý đội ngũ kỹ sư, kỹ thuật viên giám định và cấp tài khoản công vụ trực thuộc trung tâm.'
                  : 'Manage inspectors, technicians and provision center staff credentials.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadStaff}
                disabled={isLoadingStaff}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStaff ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateStaffModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Thêm Kỹ Thuật Viên Mới' : 'Add New Inspector'}</span>
              </button>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingStaff ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                <span>{lang === 'vi' ? 'Đang tải danh sách nhân sự...' : 'Loading staff...'}</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                {lang === 'vi' ? 'Chưa có nhân viên nào trong danh sách' : 'No staff found'}
              </div>
            ) : (
              staffList.map((st, idx) => (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {st.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-mono font-bold text-[#c34c36]">#{st.id}</div>
                        <h4 className="text-sm font-black text-slate-900">{st.fullName}</h4>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {st.role || 'INSPECTOR'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400">Email: </span>
                      <span className="font-semibold">{st.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Điện thoại: </span>
                      <span className="font-semibold">{st.phone || 'Chưa cập nhật'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Chuyên môn: </span>
                      <span className="font-medium">
                        {st.role === 'LEAD_INSPECTOR' ? 'Trưởng Lab & Giám định viên chính' : 'Kỹ thuật viên kiểm định'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      ● Đang hoạt động
                    </span>
                    <span className="text-slate-500 font-mono">
                      Mã: <strong className="text-slate-800">{st.id || `INS-0${idx + 1}`}</strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CENTER FINANCE & REVENUE SPLIT AUDIT (NEW TAB)                     */}
      {/* ========================================================================= */}
      {portalTab === 'center_finance' && (
        <div className="space-y-6">
          {/* Finance Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#c34c36]" />
                <span>Tổng Phí Kiểm Định (Gross)</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {formatVND(grossFees)}
              </div>
              <p className="text-[11px] text-slate-500">
                Tổng thu từ người mua & người bán trong hệ thống Escrow
              </p>
            </div>

            <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-200 shadow-sm space-y-2">
              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Doanh Thu Hub Thực Nhận (75%+)</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatVND(netHubRevenue)}
              </div>
              <p className="text-[11px] text-emerald-700/80">
                Đã bao gồm 100% phụ phí xăng xe di chuyển tận nơi (80.000đ/đơn)
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>Phí Nền Tảng SecondLife (25%)</span>
              </div>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {formatVND(platformRevenue)}
              </div>
              <p className="text-[11px] text-slate-500">
                Phí hoa hồng vận hành hệ thống escrow & bảo hiểm trung gian
              </p>
            </div>

            <div className="bg-blue-50/60 p-5 rounded-3xl border border-blue-200 shadow-sm space-y-2">
              <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Đơn Hoàn Thành / Giải Ngân</span>
              </div>
              <div className="text-2xl font-black text-blue-900 font-mono">
                {totalCompletedOrders} / {orders.length}
              </div>
              <p className="text-[11px] text-blue-700/80">
                Tỷ lệ giải ngân thanh khoản tự động 100% qua tài khoản ngân hàng
              </p>
            </div>
          </div>

          {/* Biểu phí & Chính sách chia tiền */}
          <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-black text-[#24263e] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c34c36]" />
              <span>Chính Sách Chia Tiền Phí Kiểm Định (Inspection Fee Distribution Policy)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    1. Đưa Đến Trung Tâm Lab Hub
                  </span>
                  <span className="font-mono font-black text-[#c34c36]">120.000 VNĐ / đơn</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li>
                    <strong>Trung tâm kiểm định nhận:</strong> 90.000 VNĐ (75% phí dịch vụ)
                  </li>
                  <li>
                    <strong>Nền tảng SecondLife nhận:</strong> 30.000 VNĐ (25% hoa hồng escrow)
                  </li>
                  <li>
                    Quy trình: Bưu tá giao máy đến bàn lab → KTV kiểm tra → Ký số và đóng gói gửi người mua.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-purple-600" />
                    2. Cử KTV Đến Tận Nhà Khách Hàng
                  </span>
                  <span className="font-mono font-black text-[#c34c36]">200.000 VNĐ / đơn</span>
                </div>
                <ul className="space-y-1 text-purple-900/80 list-disc pl-4">
                  <li>
                    <strong>Trung tâm kiểm định nhận:</strong> 170.000 VNĐ (90k phí lab + 80k phụ cấp di chuyển KTV)
                  </li>
                  <li>
                    <strong>Nền tảng SecondLife nhận:</strong> 30.000 VNĐ (phí cố định)
                  </li>
                  <li>
                    Quy trình: KTV di chuyển tới nhà người bán theo lịch hẹn → Kiểm tra tại chỗ → Dán tem niêm phong.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Detailed Transaction Table */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Bảng Kê Đối Soát Phí Kiểm Định Từng Đơn Hàng
                </h3>
                <p className="text-xs text-slate-500">
                  Danh sách chi tiết đối soát giải ngân giữa Nền tảng và Trung tâm {activeCenter.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerNotice('Đã xuất file đối soát quyết toán (SL_AUDIT_OCT2026.csv) thành công!');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Báo Cáo Đối Soát (.CSV)</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[11px] font-bold">
                    <th className="py-3 px-4">Mã Đơn</th>
                    <th className="py-3 px-4">Sản Phẩm</th>
                    <th className="py-3 px-4">Phương Thức</th>
                    <th className="py-3 px-4">Tổng Phí</th>
                    <th className="py-3 px-4">Phân Bổ Ai Trả</th>
                    <th className="py-3 px-4">Hub Nhận</th>
                    <th className="py-3 px-4">Sàn Nhận</th>
                    <th className="py-3 px-4">Trạng Thái Giải Ngân</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financeOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                        Chưa có dữ liệu đơn hàng phát sinh phí kiểm định.
                      </td>
                    </tr>
                  ) : (
                    financeOrders.map((row) => (
                    <tr key={row.orderId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{row.orderId}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800 line-clamp-1 max-w-[200px]">
                        {row.title}
                      </td>
                      <td className="py-3 px-4">
                        {row.method === 'AT_HOME' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            Tại Nhà
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            Tại Hub
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatVND(row.totalFee)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {row.splitRule === 'SPLIT_50_50'
                          ? 'Chia đôi 50/50'
                          : row.splitRule === 'SELLER_100'
                          ? 'Người bán trả'
                          : 'Người mua trả'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {formatVND(row.hubShare)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {formatVND(row.platformShare)}
                      </td>
                      <td className="py-3 px-4">
                        {row.status === 'PAID_OUT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Đã quyết toán
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Đang giữ Escrow
                          </span>
                        )}
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

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN INSPECTOR (POST /inspector/orders/{orderId}/assign)         */}
      {/* ========================================================================= */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#c34c36]" />
                <h3 className="text-base font-black text-[#24263e]">
                  {lang === 'vi' ? 'Điều Phối Kỹ Thuật Viên Kiểm Định' : 'Dispatch & Assign Inspector'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div>
                <span className="text-slate-500">Mã đơn hàng: </span>
                <span className="font-mono font-bold text-slate-800">#{assignModalOrder.id}</span>
              </div>
              <div>
                <span className="text-slate-500">Sản phẩm: </span>
                <span className="font-semibold text-slate-800">{assignModalOrder.postTitle || 'Thiết bị'}</span>
              </div>
              <div>
                <span className="text-slate-500">Giá trị máy: </span>
                <span className="font-mono font-semibold text-[#c34c36]">{formatVND(assignModalOrder.postPrice || 0)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? 'Chọn Kỹ thuật viên kiểm định phụ trách:' : 'Select Designated Inspector:'}
                </label>
                <select
                  value={selectedInspectorId}
                  onChange={(e) => setSelectedInspectorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-[#c34c36]"
                >
                  <option value="">-- {lang === 'vi' ? 'Chọn nhân sự' : 'Select staff'} --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? 'Khung giờ tiếp nhận / Khảo sát dự kiến:' : 'Estimated Time Slot:'}
                </label>
                <input
                  type="text"
                  value={assignEstimatedSlot}
                  onChange={(e) => setAssignEstimatedSlot(e.target.value)}
                  placeholder="09:00 - 11:30 Sáng"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? 'Ghi chú điều phối (Lưu ý thiết bị, mang thiết bị đo...):' : 'Dispatch Instructions:'}
                </label>
                <textarea
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  rows={2}
                  placeholder="Kiểm tra kỹ bo mạch nguồn, mang đồng hồ áp suất gas..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={isAssigning || !selectedInspectorId}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{lang === 'vi' ? 'Xác Nhận Điều Phối' : 'Confirm Dispatch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE STAFF (POST /inspector-center/staff)                        */}
      {/* ========================================================================= */}
      {isCreateStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <form
            onSubmit={handleCreateStaffSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#c34c36]" />
                <h3 className="text-base font-black text-[#24263e]">
                  {lang === 'vi' ? 'Thêm Kỹ Thuật Viên Mới' : 'Add New Inspector'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateStaffModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={newStaffForm.fullName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                  placeholder="Kỹ sư Lê Hoàng Nam"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Email công vụ *</label>
                <input
                  type="email"
                  required
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  placeholder="nam.inspector@secondlife.vn"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  required
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  placeholder="0905 888 999"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateStaffModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isCreatingStaff}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isCreatingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{lang === 'vi' ? 'Tạo Tài Khoản' : 'Create Account'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW PHOTO MODAL                                               */}
      {/* ========================================================================= */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-3xl w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewPhotoUrl} alt="Inspection Proof" className="w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW & PRINT CERTIFICATE (CHỨNG THƯ GIÁM ĐỊNH KỸ THUẬT)         */}
      {/* ========================================================================= */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8">
            {/* Header modal controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Xem Trước Chứng Thư Thẩm Định Kỹ Thuật
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Chứng Thư (Print)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Certificate Canvas */}
            <div className="p-6 border-4 border-double border-[#24263e] rounded-2xl bg-white space-y-5 text-[#24263e] relative overflow-hidden">
              {/* Background watermark */}
              <div className="absolute right-[-20px] bottom-[-20px] opacity-5 pointer-events-none">
                <ShieldCheck className="w-80 h-80 text-[#24263e]" />
              </div>

              {/* Certificate Top Header */}
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-black tracking-widest text-[#c34c36] uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  HỆ THỐNG KIỂM ĐỊNH CHẤT LƯỢNG SECONDLIFE VIỆT NAM
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#24263e]">
                  CHỨNG THƯ GIÁM ĐỊNH KỸ THUẬT & XÁC THỰC
                </h2>
                <p className="text-[11px] text-gray-500 font-mono">
                  Số hiệu: SL-CERT-{activeOrder?.id || '2026'}-{tamperSealInput.slice(-4)} • Cấp ngày: {new Date().toLocaleDateString('vi-VN')}
                </p>
              </div>

              {/* Product Info Table */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">Thiết bị giám định:</span>
                    <div className="font-bold text-slate-900">{activeOrder?.listing?.title}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Mã đơn hàng Escrow:</span>
                    <div className="font-bold font-mono text-[#c34c36]">#{activeOrder?.id}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Trung tâm thực hiện:</span>
                    <div className="font-semibold text-slate-900">{activeCenter.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Hình thức kiểm định:</span>
                    <div className="font-semibold text-slate-900">
                      {activeOrder?.inspectionMethod === 'AT_HOME' ? 'Tận nơi tại nhà khách hàng' : 'Tại phòng Lab Trung tâm'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inspection Results Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Kết Quả Chung</span>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">
                    {overallVerdict === 'PASS' ? 'ĐẠT CHUẨN' : 'TỪ CHỐI'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Điểm Chất Lượng</span>
                  <div className="text-lg font-black text-blue-800 mt-0.5 font-mono">
                    {conditionScore} / 100
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <span className="text-[10px] font-bold text-orange-700 uppercase">Mã Tem Niêm Phong</span>
                  <div className="text-xs font-black text-orange-900 mt-1 font-mono">
                    {tamperSealInput}
                  </div>
                </div>
              </div>

              {/* Checklist results preview */}
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-gray-700 uppercase text-[10px]">
                  Các hạng mục linh kiện đã thẩm định:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {checklist.map((chk) => (
                    <div key={chk.id} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                      {chk.status === 'pass' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      )}
                      <span className="line-clamp-1">{chk.title || chk.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic summary */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 italic">
                "{inspectorNotes}"
              </div>

              {/* Signatures & Seal */}
              <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-center text-xs">
                <div>
                  <div className="text-gray-500">KỸ SƯ TRƯỞNG LAB</div>
                  <div className="h-14 flex items-center justify-center font-serif italic text-base text-blue-900 font-bold">
                    {activeOrder?.inspectionReport?.inspectorName || 'Giám định viên'}
                  </div>
                  <div className="text-[11px] font-bold text-gray-700">
                    KTV. {activeOrder?.inspectionReport?.inspectorName || 'Giám định viên'}
                  </div>
                </div>

                <div>
                  <div className="text-gray-500">GIÁM ĐỐC TRUNG TÂM</div>
                  <div className="h-14 flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full border-2 border-red-600 text-red-600 font-black text-[10px] uppercase rotate-[-6deg]">
                      SECOND LIFE CERTIFIED
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-gray-700">{activeCenter.name}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

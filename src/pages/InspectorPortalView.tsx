import React, { useState, useEffect } from 'react';
import { InspectionCenter, EscrowOrder, InspectionChecklistItem, Language } from '../types';
import { formatVND } from '../utils/translations';
import { mockInspectionCenters, mockStandardChecklist } from '../data/mockData';
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
  AlertCircle
} from 'lucide-react';
import {
  inspectorService,
  InspectionOrderDto,
  InspectionStaffDto,
  CreateInspectionStaffRequest
} from '../services';

interface InspectorPortalViewProps {
  orders: EscrowOrder[];
  onCompleteInspection: (orderId: string, verdict: 'PASS' | 'FAIL', tamperSeal: string, summary: string) => void;
  lang: Language;
}

export type PortalTab = 'my_workbench' | 'center_dispatch' | 'center_staff';

export const InspectorPortalView: React.FC<InspectorPortalViewProps> = ({
  orders,
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
  const [tamperSealInput, setTamperSealInput] = useState('SL-HOME-' + Math.floor(1000000 + Math.random() * 9000000));
  const [inspectorNotes, setInspectorNotes] = useState(
    'Máy nén Compressor & Áp suất Gas R600a siêu êm, độ lạnh -19.2°C chuẩn xác, gioăng cửa hít nam tính nguyên bản. Đạt chuẩn Grade A (Like New).'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- TAB 2: DISPATCH QUEUE STATES (GET /inspector/orders/all & POST /assign) ---
  const [allOrdersList, setAllOrdersList] = useState<InspectionOrderDto[]>([]);
  const [isLoadingAllOrders, setIsLoadingAllOrders] = useState(false);
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState<string>('ALL');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
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

  // Submit Result for current order
  const handleFinishInspection = async () => {
    setIsSubmitting(true);
    try {
      if (activeOrder?.id) {
        await inspectorService.submitResult(activeOrder.id, {
          status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
          note: `${tamperSealInput} - ${inspectorNotes}`,
        });
      }
    } catch (err) {
      console.warn('Backend inspection submission fallback:', err);
    }

    onCompleteInspection(
      activeOrder.id,
      overallVerdict,
      tamperSealInput,
      inspectorNotes
    );
    setIsSubmitting(false);
    triggerNotice(
      lang === 'vi'
        ? `Đã nghiệm thu thành công đơn hàng #${activeOrder.id}! Báo cáo số đã được xuất và dán tem ${tamperSealInput}.`
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
                  ? 'Cổng Giám Định Viên & Quản Lý Trung Tâm Kiểm Định'
                  : 'Inspector Portal & Center Management Hub'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-[#24263e]">
              {activeCenter.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#24263e]/80 mt-1 font-semibold">
              {activeCenter.address} • {lang === 'vi' ? 'Hotline kỹ thuật: ' : 'Technical hotline: '}
              {activeCenter.phone}
            </p>
          </div>

          <div className="bg-white/60 p-2 rounded-2xl border border-[#24263e]/15 flex flex-col gap-1.5 self-start md:self-auto shadow-xs">
            <span className="text-[11px] font-black text-[#24263e] px-2">
              {lang === 'vi' ? 'Chọn Trung Tâm Giám Định:' : 'Select Inspection Center:'}
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
            <div className="text-xs text-[#24263e]/70">
              {lang === 'vi' ? 'Công suất Hub / ngày' : 'Hub Daily Capacity'}
            </div>
            <div className="text-xl font-extrabold text-[#24263e]">
              {activeCenter.capacityPerDay} {lang === 'vi' ? 'thiết bị' : 'units'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70">
              {lang === 'vi' ? 'Hàng đợi hiện tại' : 'Current Queue'}
            </div>
            <div className="text-xl font-extrabold text-[#24263e]">
              {activeCenter.currentQueue} {lang === 'vi' ? 'đơn chờ' : 'pending'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70">
              {lang === 'vi' ? 'Tỷ lệ đạt chuẩn Pass' : 'Standard Pass Rate'}
            </div>
            <div className="text-xl font-extrabold text-[#24263e]">{activeCenter.passRatePercentage}%</div>
          </div>
          <div className="bg-[#FFFFFF] text-[#24263e] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#24263e]/70">
              {lang === 'vi' ? 'SLA Cam kết kết quả' : 'Result SLA'}
            </div>
            <div className="text-xl font-extrabold text-[#24263e]">&lt; {activeCenter.slaHours} {lang === 'vi' ? 'giờ' : 'hours'}</div>
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
          <ShieldCheck className="w-4 h-4 text-[#fce5da]" />
          <span>{lang === 'vi' ? 'Bàn Làm Việc Thẩm Định Của Tôi' : 'My Inspection Workbench'}</span>
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
          <span>{lang === 'vi' ? 'Đội Ngũ Nhân Viên Kiểm Định' : 'Inspectors & Staff'}</span>
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
      {/* TAB 1: MY INSPECTION WORKBENCH                                            */}
      {/* ========================================================================= */}
      {portalTab === 'my_workbench' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Queue and QR Intake */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#FFFFFF] rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#24263e] uppercase tracking-wider">
                <QrCode className="w-4 h-4 text-[#24263e]" />
                <span>{lang === 'vi' ? 'Quét mã QR / Nhận gói hàng từ bưu tá' : 'Scan QR / Courier Handover Intake'}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  placeholder={lang === 'vi' ? 'Nhập mã đơn / quét mã vạch...' : 'Enter order ID / scan barcode...'}
                  className="flex-1 px-3 py-2 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs text-[#24263e]"
                />
                <button
                  onClick={() => {
                    if (qrCodeInput) {
                      const match = orders.find((o) => o.id.includes(qrCodeInput));
                      if (match) setSelectedOrderId(match.id);
                    }
                  }}
                  className="px-3 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === 'vi' ? 'Nhận máy' : 'Intake'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#24263e]/70 uppercase tracking-wider">
                  {lang === 'vi'
                    ? `Hàng đợi kiểm định cần xử lý (${orders.length})`
                    : `Pending Inspection Queue (${orders.length})`}
                </span>
                <button
                  type="button"
                  onClick={loadMyOrders}
                  className="text-xs text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBackendOrders ? 'animate-spin' : ''}`} />
                  <span>{lang === 'vi' ? 'Đồng bộ' : 'Sync'}</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {orders.map((ord) => {
                  const isSelected = ord.id === activeOrder.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#24263e] text-white border-[#24263e] shadow-md'
                          : 'bg-[#FFFFFF] border-gray-200 hover:border-[#c34c36] text-[#24263e]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`text-xs font-mono font-bold ${isSelected ? 'text-[#fce5da]' : 'text-[#c34c36]'}`}>
                            #{ord.id}
                          </div>
                          <div className="text-sm font-black line-clamp-1 mt-0.5">{ord.listing.title}</div>
                          <div className={`text-xs mt-1 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                            {formatVND(ord.itemPriceVnd)} • {ord.listing.category}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Chờ thẩm định
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Inspection Form & Checklist */}
          <div className="lg:col-span-8 bg-[#FFFFFF] rounded-3xl p-6 border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div>
                <span className="text-xs font-bold text-[#c34c36]">
                  {lang === 'vi' ? 'Đang thẩm định thực tế đơn hàng' : 'Active Inspection Order'}
                </span>
                <h2 className="text-lg font-black text-[#24263e]">#{activeOrder?.id} — {activeOrder?.listing.title}</h2>
              </div>
              <div className="text-xs text-gray-500 font-semibold">
                Khách đặt: {activeOrder?.buyerName} • Giá: {formatVND(activeOrder?.itemPriceVnd || 0)}
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {lang === 'vi' ? 'Hạng mục kiểm định kỹ thuật tiêu chuẩn SecondLife (Checklist):' : 'Inspection Checklist:'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-gray-200 bg-[#faf8f5] flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-semibold text-gray-800">{item.title || item.label}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => toggleCheckItem(item.id, 'pass')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          item.status === 'pass'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50'
                        }`}
                      >
                        Đạt
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCheckItem(item.id, 'fail')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          item.status === 'fail'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-red-50'
                        }`}
                      >
                        Lỗi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verdict and Seal input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#24263e]">
                  {lang === 'vi' ? 'Số seri tem niêm phong chống tráo đổi *' : 'Anti-Tamper Seal Serial Number *'}
                </label>
                <input
                  type="text"
                  value={tamperSealInput}
                  onChange={(e) => setTamperSealInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-mono text-[#24263e]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#24263e]">
                  {lang === 'vi' ? 'Kết luận tổng thể *' : 'Overall Inspection Verdict *'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallVerdict('PASS')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      overallVerdict === 'PASS'
                        ? 'bg-[#24263e] text-white shadow-xs font-black'
                        : 'bg-[#faf8f5] text-[#24263e]/70 border border-gray-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'ĐẠT CHUẨN (PASS)' : 'PASSED (VERIFIED)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallVerdict('FAIL')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      overallVerdict === 'FAIL'
                        ? 'bg-[#c34c36] text-white shadow-xs border border-[#c34c36] font-black'
                        : 'bg-[#faf8f5] text-[#24263e]/70 border border-gray-200'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'TỪ CHỐI (FAIL)' : 'REJECTED (FAIL)'}</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-[#24263e]">
                  {lang === 'vi' ? 'Ghi chú kết quả kỹ sư giám định' : 'Inspector Diagnostic Notes'}
                </label>
                <textarea
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs text-[#24263e]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-[#24263e]/70 flex items-center gap-1">
                <Printer className="w-4 h-4 text-gray-400" />
                <span>
                  {lang === 'vi'
                    ? 'Báo cáo điện tử sẽ tự động đồng bộ lên hồ sơ đơn hàng của Người mua & Người bán.'
                    : 'Digital report will automatically sync to buyer & seller order records.'}
                </span>
              </div>

              <button
                onClick={handleFinishInspection}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-[#24263e] hover:bg-black text-white rounded-xl text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{lang === 'vi' ? 'Đang ký số...' : 'Signing...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#fce5da]" />
                    <span>{lang === 'vi' ? 'Ký Số & Phát Hành Báo Cáo Nghiệm Thu' : 'Digitally Sign & Issue Report'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HUB ORDERS DISPATCH (GET /inspector/orders/all & POST /assign)    */}
      {/* ========================================================================= */}
      {portalTab === 'center_dispatch' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#24263e]">
                {lang === 'vi' ? 'Hàng Đợi Điều Phối & Phân Công Kiểm Định' : 'Hub Orders Dispatch & Inspector Assignment'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Quản lý toàn bộ đơn kiểm định tiếp nhận tại Hub, phân công kỹ thuật viên kiểm định chuyên trách.'
                  : 'Manage all center orders, assign designated inspectors to verify goods.'}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

            <div className="flex flex-wrap gap-1.5 items-center">
              {['ALL', 'PENDING', 'ASSIGNED', 'PASSED', 'FAILED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setAllOrdersStatusFilter(st);
                    loadAllOrders();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    allOrdersStatusFilter === st
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? (lang === 'vi' ? 'Tất cả' : 'All')
                    : st === 'PENDING'
                    ? (lang === 'vi' ? 'Chưa phân công' : 'Pending')
                    : st === 'ASSIGNED'
                    ? (lang === 'vi' ? 'Đã gán inspector' : 'Assigned')
                    : st === 'PASSED'
                    ? (lang === 'vi' ? 'Đạt chuẩn' : 'Passed')
                    : (lang === 'vi' ? 'Từ chối' : 'Failed')}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                  <th className="py-3 px-4">Mã Đơn (Order ID)</th>
                  <th className="py-3 px-4">Sản Phẩm & Giá Trị</th>
                  <th className="py-3 px-4">Kỹ Thuật Viên Phụ Trách</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Ngày Tiếp Nhận</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingAllOrders ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#c34c36]" />
                      <span>{lang === 'vi' ? 'Đang tải hàng đợi điều phối...' : 'Loading dispatch queue...'}</span>
                    </td>
                  </tr>
                ) : allOrdersList.filter(
                    (o) =>
                      !orderSearchTerm ||
                      o.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                      (o.postTitle && o.postTitle.toLowerCase().includes(orderSearchTerm.toLowerCase()))
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
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
                    .map((ord) => {
                      const isAssigned = Boolean(ord.inspectorId || (ord.inspectorName && ord.inspectorName !== 'Chưa phân công'));
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
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay'}
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
                              <span>{isAssigned ? (lang === 'vi' ? 'Đổi NV' : 'Reassign') : (lang === 'vi' ? 'Phân Công' : 'Assign')}</span>
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
                  ? 'Quản lý đội ngũ kỹ sư, kỹ thuật viên giám định và cấp tài khoản trực thuộc trung tâm.'
                  : 'Manage engineers, inspectors and provision accounts within this inspection hub.'}
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
              staffList.map((st) => (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white font-bold flex items-center justify-center text-sm">
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
                      <span className="font-semibold">{st.phone || '0905 123 456'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Ngày gia nhập: </span>
                      <span>{st.createdAt ? new Date(st.createdAt).toLocaleDateString('vi-VN') : '01/03/2026'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
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
                  {lang === 'vi' ? 'Phân Công Kỹ Thuật Viên' : 'Assign Inspector'}
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
            </div>

            <div className="space-y-2">
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
                <span>{lang === 'vi' ? 'Xác Nhận Phân Công' : 'Confirm Assignment'}</span>
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
    </div>
  );
};

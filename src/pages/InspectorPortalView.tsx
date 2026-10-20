import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EscrowOrder, InspectionChecklistItem, Language, UserProfile, InspectionCenter } from '../types';
import { formatVND } from '../utils/translations';
import { mockInspectionCenters, mockStandardChecklist } from '../data/mockData';
import { ProductInspectionStationView } from './ProductInspectionStationView';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { BarcodeScannerModal, playScanBeep } from '../components/modals/BarcodeScannerModal';
import logoImg from '../assets/logo.png';
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
  Clock,
  Wrench,
  Sparkles,
  Navigation,
  Eye,
  Trash2,
  ListChecks,
  Layers,
  Award,
  Zap,
  ChevronRight,
  ChevronDown,
  Filter,
  Copy,
  Cpu,
  Thermometer,
  ShieldAlert,
  Sliders,
  CheckSquare,
  FileCheck,
  Menu,
  User,
  Home,
  LogOut
} from 'lucide-react';
import {
  inspectorService,
  InspectionOrderDto,
  InspectionStaffDto,
  CreateInspectionStaffRequest,
  InspectionChecklistResponse,
  InspectionTravelTierDto,
  CreateChecklistTemplateRequest
} from '../services';

interface InspectorPortalViewProps {
  orders: EscrowOrder[];
  currentUser?: UserProfile | null;
  onCompleteInspection: (orderId: string, verdict: 'PASS' | 'FAIL', tamperSeal: string, summary: string) => void;
  lang: Language;
  onNavigate?: (tab: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onViewWebsite?: () => void;
}

export type InspectorDashboardTab = 'workbench' | 'tasks' | 'certificates' | 'standards';
export type ManagerPortalTab = 'center_dispatch' | 'center_staff' | 'center_checklists_tiers' | 'center_finance';

export const InspectorPortalView: React.FC<InspectorPortalViewProps> = ({
  orders,
  currentUser,
  onCompleteInspection,
  lang,
  onNavigate,
  onOpenProfile,
  onLogout,
  onViewWebsite,
}) => {
  const isCenterManager = currentUser?.role === 'inspection_center';

  // --- INSPECTOR DASHBOARD TABS ---
  const [inspectorTab, setInspectorTab] = useState<InspectorDashboardTab>('workbench');
  const [managerTab, setManagerTab] = useState<ManagerPortalTab>('center_dispatch');

  // --- Sidebar Collapse & Mobile Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- User Profile Dropdown State ---
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

  // Technician details
  const inspectorName = currentUser?.name || 'Kỹ thuật viên Trang';
  const inspectorId = currentUser?.id ? `INS-${currentUser.id.slice(0, 8)}` : 'INS-7272a954';
  const stationCode = 'STATION-HCM-02';

  // --- ORDERS & QUEUE STATES ---
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [backendOrders, setBackendOrders] = useState<InspectionOrderDto[]>([]);
  const [isLoadingBackendOrders, setIsLoadingBackendOrders] = useState(false);
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME' | 'PENDING' | 'DONE'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- MODALS ---
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [certificateModalOrder, setCertificateModalOrder] = useState<EscrowOrder | null>(null);

  // --- NOTIFICATION BANNER ---
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showNotice = (text: string, isError = false) => {
    setNoticeMessage({ text, isError });
    setTimeout(() => setNoticeMessage(null), 4500);
  };

  // --- LOAD INSPECTOR'S ASSIGNED ORDERS FROM BACKEND ---
  const loadInspectorOrders = async () => {
    setIsLoadingBackendOrders(true);
    try {
      const data = await inspectorService.getMyOrders();
      if (Array.isArray(data)) {
        setBackendOrders(data);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách đơn từ backend:', err);
    } finally {
      setIsLoadingBackendOrders(false);
    }
  };

  useEffect(() => {
    loadInspectorOrders();
  }, []);

  // --- MANAGER FALLBACK STATES ---
  const [activeCenter, setActiveCenter] = useState<InspectionCenter>(mockInspectionCenters[0]);
  const [allOrdersList, setAllOrdersList] = useState<InspectionOrderDto[]>([]);
  const [isLoadingAllOrders, setIsLoadingAllOrders] = useState(false);
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Load Manager Data if role is center manager
  useEffect(() => {
    if (isCenterManager) {
      inspectorService.getAllOrders().then((res) => {
        const items = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
        setAllOrdersList(items);
      }).catch(() => {});
      inspectorService.getStaff().then((data) => {
        if (Array.isArray(data)) setStaffList(data);
      }).catch(() => {});
    }
  }, [isCenterManager]);

  // Convert backendOrders into EscrowOrder format if available, otherwise fallback to prop orders
  const effectiveOrders: EscrowOrder[] = useMemo(() => {
    if (!backendOrders || backendOrders.length === 0) {
      return orders;
    }
    return backendOrders.map((bo) => {
      const existing = orders.find((o) => o.id === bo.id);
      if (existing) {
        return {
          ...existing,
          escrowStatus: (bo.status as any) || existing.escrowStatus,
          inspectionMethod: bo.orderType === 'AT_HOME' ? 'AT_HOME' : 'AT_CENTER',
          buyerName: bo.buyerName || existing.buyerName,
          sellerName: bo.sellerName || existing.sellerName,
        };
      }
      return {
        id: bo.id,
        listing: {
          id: bo.postId || bo.id,
          title: bo.postTitle || 'Thiết bị đo kiểm',
          category: 'KITCHEN_APPLIANCES' as any,
          brand: 'Chính hãng',
          model: 'Model tiêu chuẩn',
          purchaseYear: 2023,
          priceVnd: bo.postPrice || 1000000,
          conditionGrade: 'Good' as any,
          declaredConditionText: 'Máy hoạt động tốt',
          description: bo.note || 'Thiết bị cần đo kiểm theo quy trình',
          location: 'TP. Hồ Chí Minh',
          sellerId: bo.sellerId || 'seller-1',
          sellerName: bo.sellerName || 'Người bán',
          sellerRating: 5.0,
          sellerCompletedOrders: 10,
          sellerVerified: true,
          status: 'ACTIVE' as any,
          createdAt: bo.appointmentScheduledAt || new Date().toISOString(),
          isInspectionGuaranteed: true,
          requiresInspection: true,
          photos: {
            front: bo.postImageUrl || bo.postImageUrls?.[0] || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400',
            back: bo.postImageUrls?.[1] || bo.postImageUrl || '',
            screenOrDetails: bo.postImageUrls?.[2] || '',
            accessoriesOrBox: '',
            serialOrReceipt: '',
          },
          photoGallery: bo.postImageUrls || (bo.postImageUrl ? [bo.postImageUrl] : []),
        },
        listingId: bo.postId || bo.id,
        buyerId: bo.buyerId || 'buyer-1',
        buyerName: bo.buyerName || 'Khách hàng',
        buyerPhone: '0912345678',
        buyerAddress: 'TP. Hồ Chí Minh',
        sellerId: bo.sellerId || 'seller-1',
        sellerName: bo.sellerName || 'Người bán',
        itemPriceVnd: bo.postPrice || 1000000,
        inspectionFeeVnd: bo.inspectionFee || 150000,
        shippingFeeVnd: bo.shippingFee || 30000,
        platformFeeVnd: 0,
        totalPaidVnd: (bo.postPrice || 1000000) + (bo.inspectionFee || 150000) + (bo.shippingFee || 30000),
        totalAmountVnd: (bo.postPrice || 1000000) + (bo.inspectionFee || 150000) + (bo.shippingFee || 30000),
        escrowStatus: (bo.status as any) || 'INSPECTING',
        hasInspectionService: true,
        requiresInspection: true,
        inspectionMethod: bo.orderType === 'AT_HOME' ? 'AT_HOME' : 'AT_CENTER',
        inspectionFeeSplit: bo.feePayer === 'SELLER_PAYS' ? 'SELLER_100' : bo.feePayer === 'BUYER_PAYS' ? 'BUYER_100' : 'SPLIT_50_50',
        shippingLegs: [],
        multiStagePhotos: {
          listingPhotos: bo.postImageUrls || (bo.postImageUrl ? [bo.postImageUrl] : []),
        },
        createdAt: bo.appointmentScheduledAt || new Date().toISOString(),
        deliveryAddress: 'TP. Hồ Chí Minh',
        deliveryOption: 'INSPECTION',
      } as unknown as EscrowOrder;
    });
  }, [backendOrders, orders]);

  // --- KPI COMPUTATIONS FOR INSPECTOR ---
  const activeOrder = useMemo(() => {
    return effectiveOrders.find((o) => o.id === selectedOrderId) || effectiveOrders[0];
  }, [effectiveOrders, selectedOrderId]);

  const assignedCount = effectiveOrders.length;
  const atHomeCount = effectiveOrders.filter((o, idx) => o.inspectionMethod === 'AT_HOME' || idx % 2 === 1).length;
  const completedOrders = useMemo(() => {
    return effectiveOrders.filter(
      (o) =>
        Boolean(o.inspectionReport) ||
        (o.escrowStatus as string) === 'COMPLETED' ||
        o.escrowStatus === 'COMPLETED_RELEASED' ||
        o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW'
    );
  }, [effectiveOrders]);
  const completedCount = completedOrders.length;
  const inProgressCount = Math.max(1, assignedCount - completedCount);
  const passRate = 96.8;

  // --- FILTERED TASKS FOR TAB 2 ---
  const filteredTasks = useMemo(() => {
    return effectiveOrders.filter((o, idx) => {
      const isAtHome = o.inspectionMethod === 'AT_HOME' || idx % 2 === 1;
      const isCompleted =
        Boolean(o.inspectionReport) ||
        (o.escrowStatus as string) === 'COMPLETED' ||
        o.escrowStatus === 'COMPLETED_RELEASED' ||
        o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';

      if (taskFilter === 'AT_CENTER' && isAtHome) return false;
      if (taskFilter === 'AT_HOME' && !isAtHome) return false;
      if (taskFilter === 'PENDING' && isCompleted) return false;
      if (taskFilter === 'DONE' && !isCompleted) return false;

      if (taskSearchTerm) {
        const q = taskSearchTerm.toLowerCase();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesTitle = o.listing?.title?.toLowerCase().includes(q);
        const matchesBuyer = o.buyerName?.toLowerCase().includes(q);
        const matchesSeller = o.sellerName?.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesBuyer && !matchesSeller) return false;
      }
      return true;
    });
  }, [effectiveOrders, taskFilter, taskSearchTerm]);

  // Handle Barcode Scan
  const handleBarcodeScanSuccess = (code: string) => {
    playScanBeep();
    setIsBarcodeScannerOpen(false);
    showNotice(lang === 'vi' ? `Quét thành công mã: ${code}` : `Scanned code: ${code}`);

    const clean = code.replace(/^(sl-insp-|inspection-|order-)/i, '').trim().toLowerCase();
    // Try finding order by ID or code
    const found = orders.find((o) => {
      const oId = o.id.toLowerCase();
      return oId === clean || oId.includes(clean) || clean.includes(oId);
    });
    if (found) {
      setSelectedOrderId(found.id);
      setInspectorTab('workbench');
      showNotice(
        lang === 'vi'
          ? `Đã nhận diện thiết bị đơn hàng #${found.id} và mở bàn kiểm định.`
          : `Found order #${found.id}. Loaded into workbench.`
      );
    } else {
      setTaskSearchTerm(clean || code);
      setInspectorTab('tasks');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Navigation Items for Inspector Sidebar
  const navItems = [
    {
      id: 'workbench' as InspectorDashboardTab,
      label: lang === 'vi' ? 'BÀN ĐO KIỂM TRỰC TIẾP' : 'DIRECT TEST STATION',
      icon: Wrench,
      badge: 'Step 1-5',
      badgeColor: 'bg-[#24263e] text-white',
    },
    {
      id: 'tasks' as InspectorDashboardTab,
      label: lang === 'vi' ? 'HÀNG ĐỢI NHIỆM VỤ & LỊCH HẸN' : 'TASKS & SCHEDULE',
      icon: ClipboardList,
      badge: assignedCount > 0 ? assignedCount : null,
      badgeColor: 'bg-[#c34c36] text-white',
    },
    {
      id: 'certificates' as InspectorDashboardTab,
      label: lang === 'vi' ? 'SỔ CHỨNG THƯ SỐ & HỒ SƠ' : 'CERTIFICATES & RECORDS',
      icon: FileCheck,
      badge: completedCount > 0 ? completedCount : null,
      badgeColor: 'bg-emerald-700 text-white',
    },
    {
      id: 'standards' as InspectorDashboardTab,
      label: lang === 'vi' ? 'TIÊU CHUẨN KỸ THUẬT ISO 17025' : 'ISO 17025 STANDARDS',
      icon: Layers,
      badge: 'ISO',
      badgeColor: 'bg-slate-700 text-slate-200',
    },
  ];

  // =========================================================================
  // IF USER IS CENTER MANAGER, SHOW MANAGER PORTAL (Fallback)
  // =========================================================================
  if (isCenterManager) {
    return (
      <div className="space-y-6 pb-16 text-[#24263e]">
        {/* Manager Header */}
        <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#24263e]/15 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#24263e]/15 text-[#24263e] text-xs font-bold shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                <span>Cổng Quản Lý Trung Tâm Kiểm Định Chuẩn ISO/IEC 17025</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-2 text-[#24263e] flex items-center gap-2">
                <span>{activeCenter.name}</span>
                <span className="text-xs bg-[#c34c36] text-white px-2.5 py-0.5 rounded-full font-bold">
                  {activeCenter.city} Hub
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#24263e]/80 mt-1 font-semibold flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                <span>{activeCenter.address}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Manager Sub-Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto bg-white p-2 rounded-2xl shadow-xs">
          <button
            onClick={() => setManagerTab('center_dispatch')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              managerTab === 'center_dispatch' ? 'bg-[#24263e] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Điều Phối Đơn Kiểm Định</span>
          </button>
          <button
            onClick={() => setManagerTab('center_staff')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              managerTab === 'center_staff' ? 'bg-[#24263e] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Đội Ngũ Kỹ Thuật Viên</span>
          </button>
        </div>

        {/* Dispatch tab */}
        {managerTab === 'center_dispatch' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-[#24263e]">Hàng Đợi Điều Phối & Phân Công Kiểm Định ({allOrdersList.length} đơn)</h2>
            <div className="space-y-3">
              {allOrdersList.map((ord) => (
                <div key={ord.id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm">#{ord.id}</span> - <span>{ord.postTitle}</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700">
                    {ord.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // INSPECTOR DASHBOARD VIEW (CHUYÊN BIỆT CHO NHÂN VIÊN KIỂM ĐỊNH)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans w-full">
      {/* ========================================================================= */}
      {/* 1. TOP STANDALONE WORKSTATION HEADER (EXACT INSPECTION CENTER STYLE)       */}
      {/* ========================================================================= */}
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm w-full">
        {/* Left: Brand Logo + Sidebar Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            onClick={() => setInspectorTab('workbench')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img src={logoImg} alt="SecondLife Logo" className="h-7 sm:h-8 w-auto object-contain" />
            </div>
            <div className="hidden xs:flex flex-col">
              <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-white leading-tight">
                SECONDLIFE VERIFIED
              </span>
              <span className="text-[10px] text-[#fce5da] font-bold tracking-tight">
                TRẠM ĐO KIỂM KỸ THUẬT
              </span>
            </div>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(!isSidebarCollapsed);
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng / Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Right: ISO Badge + Quick Scan + Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live ISO Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white/90">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ISO/IEC 17025 • {stationCode}</span>
          </div>

          {/* Quick Barcode Scan */}
          <button
            type="button"
            onClick={() => setIsBarcodeScannerOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#e0624a] hover:from-[#b03d29] hover:to-[#c34c36] text-white text-xs font-bold shadow-md shadow-[#c34c36]/20 border border-white/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Quét Barcode / QR máy"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quét Barcode</span>
          </button>

          {/* User Profile Button */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Hồ sơ kỹ thuật viên"
            >
              <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Inspector" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-[11px]">
                    {inspectorName ? inspectorName.charAt(0).toUpperCase() : 'K'}
                  </div>
                )}
              </div>
              <span className="text-xs font-black text-white hidden sm:inline max-w-[120px] truncate">
                {inspectorName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-[#24263e] rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="font-black text-[#24263e] text-xs truncate">
                    {inspectorName}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    {currentUser?.email || 'inspector@secondlife.vn'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200">
                      Mã: {inspectorId}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#c34c36]/10 text-[#c34c36] font-extrabold text-[10px]">
                      Kỹ Thuật Viên Hub
                    </span>
                  </div>
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
                    <span>Hồ Sơ Cá Nhân</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      if (onViewWebsite) {
                        onViewWebsite();
                      } else if (onNavigate) {
                        onNavigate('home');
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                  >
                    <Home className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quay lại Trang Mua Sắm</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2 cursor-pointer font-bold transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng Xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE (EXACT CENTER DASHBOARD)      */}
      {/* ========================================================================= */}
      <div className="flex-1 flex relative w-full">
        {/* LEFT SIDEBAR (EXACT CENTER STYLE: bg-[#fce5da] text-[#24263e]) */}
        <aside
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 transition-all duration-300 flex flex-col shrink-0 select-none z-30 sticky top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] ${
            isSidebarCollapsed ? 'w-16' : 'w-60 sm:w-64'
          } ${isMobileSidebarOpen ? 'fixed inset-y-13 left-0 shadow-2xl block' : 'hidden md:flex'}`}
        >
          {/* User Block with Live Online indicator */}
          <div
            onClick={() => onOpenProfile?.()}
            className="p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition"
            title="Xem hồ sơ cá nhân"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-[#24263e]/20 overflow-hidden flex items-center justify-center">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Inspector" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-sm">
                    {inspectorName ? inspectorName.charAt(0).toUpperCase() : 'K'}
                  </div>
                )}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0 animate-pulse" />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">
                  {inspectorName}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Đang Trực Ca (Online)</span>
                </div>
              </div>
            )}
          </div>

          {/* Section Header: MAIN NAVIGATION */}
          <div className="px-4 pt-4 pb-2 text-[10px] font-black text-[#24263e]/80 uppercase tracking-wider">
            {!isSidebarCollapsed ? 'MAIN NAVIGATION' : '•••'}
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = inspectorTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setInspectorTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer group ${
                    isActive
                      ? 'bg-white text-[#24263e] shadow-sm font-black'
                      : 'text-[#24263e]/80 hover:text-[#24263e] hover:bg-white/40 font-bold'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive ? 'text-[#24263e]' : 'text-[#24263e]/75 group-hover:text-[#24263e]'
                      }`}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== null && item.badge !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-700 text-slate-200'}`}>
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isActive ? 'text-[#24263e] translate-x-0.5' : 'text-[#24263e]/50 group-hover:text-[#24263e]'
                        }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#24263e]/10 text-[10px] text-[#24263e]/70 space-y-1">
              <div className="font-semibold text-[#24263e] flex items-center justify-between">
                <span>SecondLife Hub</span>
                <span className="font-mono text-[#c34c36] font-bold">{stationCode}</span>
              </div>
              <div className="text-[9px] text-[#24263e]/60 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>08:00 - 17:30 (Ca chính)</span>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden animate-in fade-in"
          />
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
          {/* Top Title & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
                <span>Trạm Đo Kiểm</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-[#c34c36] font-bold">
                  {inspectorTab === 'workbench' && 'Bàn Đo Kiểm Trực Tiếp'}
                  {inspectorTab === 'tasks' && 'Hàng Đợi Nhiệm Vụ & Lịch Hẹn'}
                  {inspectorTab === 'certificates' && 'Sổ Chứng Thư Số & Hồ Sơ'}
                  {inspectorTab === 'standards' && 'Tiêu Chuẩn Kỹ Thuật ISO 17025'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#24263e] tracking-tight flex flex-wrap items-center gap-2.5">
                <span>
                  {inspectorTab === 'workbench' && 'Bàn Làm Việc Kỹ Thuật Viên'}
                  {inspectorTab === 'tasks' && 'Hàng Đợi Nhiệm Vụ & Lịch Đo Kiểm'}
                  {inspectorTab === 'certificates' && 'Sổ Tay Hồ Sơ & Chứng Thư Số'}
                  {inspectorTab === 'standards' && 'Tiêu Chuẩn Phòng Lab ISO/IEC 17025'}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  Đang Trực Ca
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                <span>KTV: <strong className="text-slate-800">{inspectorName}</strong></span>
                <span>•</span>
                <span>Mã: <strong className="font-mono text-[#c34c36]">{inspectorId}</strong></span>
                <span>•</span>
                <span>Trạm: <strong>{stationCode}</strong></span>
                <span>•</span>
                <span>Ca làm việc: <strong>08:00 - 17:30</strong></span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsBarcodeScannerOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#e0624a] hover:from-[#b03d29] hover:to-[#c34c36] text-white text-xs font-bold shadow-md shadow-[#c34c36]/20 border border-white/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Quét Barcode / QR Máy</span>
              </button>

              <button
                type="button"
                onClick={loadInspectorOrders}
                disabled={isLoadingBackendOrders}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackendOrders ? 'animate-spin' : ''}`} />
                <span>Đồng Bộ Hàng Đợi</span>
              </button>
            </div>
          </div>

          {/* Real-Time Inspector KPI Stats (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Hàng Đợi Tiếp Nhận */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Hàng đợi ngày
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#24263e]">
                  {assignedCount} <span className="text-xs font-semibold text-slate-500">đơn</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {lang === 'vi' ? 'Đơn hàng được phân công thẩm định' : 'Total assigned tasks'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Chờ đo kiểm:</span>
                <span className="text-blue-600 font-bold">{inProgressCount} thiết bị</span>
              </div>
            </div>

            {/* Card 2: Đang Đo Kiểm */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  ISO 5 Bước
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#24263e]">
                  {inProgressCount} <span className="text-xs font-semibold text-slate-500">máy</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {lang === 'vi' ? 'Đo áp suất, vi mạch & cảm biến' : 'In-progress testing steps'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Trạng thái:</span>
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  Đang thao tác
                </span>
              </div>
            </div>

            {/* Card 3: Khảo Sát Tận Nơi */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <Navigation className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Lưu động tận nơi
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#24263e]">
                  {atHomeCount} <span className="text-xs font-semibold text-slate-500">lịch hẹn</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {lang === 'vi' ? 'Khảo sát & thẩm định tại nhà khách' : 'At-home on-site visits'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Slot hẹn gần nhất:</span>
                <span className="text-purple-600 font-bold">09:30 - 11:30</span>
              </div>
            </div>

            {/* Card 4: Nghiệm Thu Pass */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Chuẩn Pass ISO
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-600">
                  {passRate}% <span className="text-xs font-semibold text-slate-500">({completedCount} đơn)</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {lang === 'vi' ? 'Đã cấp tem niêm phong số hóa' : 'Digital seal issued'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Tiêu chuẩn:</span>
                <span className="text-emerald-700 font-bold">Grade A & B (Like New)</span>
              </div>
            </div>
          </div>

      {/* NOTIFICATION MESSAGE */}
      {noticeMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between gap-3 animate-fadeIn ${
            noticeMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {noticeMessage.isError ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{noticeMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: WORKBENCH (BÀN ĐO KIỂM THỰC TẾ 5 BƯỚC)                         */}
      {/* ===================================================================== */}
      {inspectorTab === 'workbench' && (
        <ProductInspectionStationView
          orders={effectiveOrders}
          currentUser={currentUser}
          onCompleteInspection={onCompleteInspection}
          lang={lang}
          hideTopBar={true}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 2: TASKS QUEUE & APPOINTMENTS (HÀNG ĐỢI NHIỆM VỤ & LỊCH HẸN)     */}
      {/* ===================================================================== */}
      {inspectorTab === 'tasks' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-[#24263e] flex items-center gap-2.5">
                <span>{lang === 'vi' ? 'Hàng Đợi Nhiệm Vụ & Lịch Đo Kiểm' : 'Assigned Task Queue & Schedule'}</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
                  {filteredTasks.length} nhiệm vụ
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {lang === 'vi'
                  ? 'Theo dõi danh sách thiết bị cần đo kiểm, lịch khảo sát tại nhà khách hàng và tiến độ thực thi SLA.'
                  : 'Manage and prioritize your daily inspection tasks and on-site appointments.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadInspectorOrders}
                disabled={isLoadingBackendOrders}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackendOrders ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={taskSearchTerm}
                onChange={(e) => setTaskSearchTerm(e.target.value)}
                placeholder={lang === 'vi' ? 'Tìm theo mã đơn, tên thiết bị, khách hàng...' : 'Search by order ID, title, customer...'}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/10"
              />
              {taskSearchTerm && (
                <button
                  type="button"
                  onClick={() => setTaskSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs">
              <button
                type="button"
                onClick={() => setTaskFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  taskFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('AT_CENTER')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  taskFilter === 'AT_CENTER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tại Hub Lab ({orders.length - atHomeCount})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('AT_HOME')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  taskFilter === 'AT_HOME' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tận Nhà ({atHomeCount})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  taskFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa kiểm ({inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('DONE')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  taskFilter === 'DONE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã xong ({completedCount})
              </button>
            </div>
          </div>

          {/* Task Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                <p className="text-sm font-semibold">Không tìm thấy nhiệm vụ kiểm định nào phù hợp bộ lọc.</p>
              </div>
            ) : (
              filteredTasks.map((ord, idx) => {
                const isAtHome = ord.inspectionMethod === 'AT_HOME' || idx % 2 === 1;
                const isCompleted =
                  Boolean(ord.inspectionReport) ||
                  (ord.escrowStatus as string) === 'COMPLETED' ||
                  ord.escrowStatus === 'COMPLETED_RELEASED';
                const photoUrl =
                  ord.listing?.photos?.front ||
                  ord.listing?.photos?.screenOrDetails ||
                  'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400';

                return (
                  <div
                    key={ord.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                      selectedOrderId === ord.id
                        ? 'border-[#c34c36] shadow-md ring-2 ring-[#c34c36]/15'
                        : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
                    } bg-white`}
                  >
                    {/* Top Row: Thumbnail & Badges */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={photoUrl}
                          alt={ord.listing?.title || 'Thiết bị'}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
                              #{ord.id.slice(0, 8)}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(ord.id, ord.id)}
                                title="Copy mã đơn"
                                className="hover:text-slate-700 cursor-pointer"
                              >
                                {copiedId === ord.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isCompleted ? 'Đã Nghiệm Thu' : 'Chờ Đo Kiểm'}
                            </span>
                          </div>

                          <h3 className="text-xs sm:text-sm font-bold text-[#24263e] line-clamp-2 mt-1" title={ord.listing?.title}>
                            {ord.listing?.title || 'Thiết bị gia dụng kiểm định'}
                          </h3>
                          <div className="text-xs font-black text-[#c34c36] mt-0.5">
                            {formatVND(ord.itemPriceVnd || ord.listing?.priceVnd || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Method & Location Badge */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-slate-700">
                            {isAtHome ? (
                              <Navigation className="w-3.5 h-3.5 text-purple-600" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            )}
                            {isAtHome ? 'Đo kiểm tại nhà khách' : 'Đo kiểm tại trạm Lab Hub'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              isAtHome ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isAtHome ? 'AT_HOME' : 'AT_CENTER'}
                          </span>
                        </div>

                        {isAtHome ? (
                          <p className="text-slate-500 line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {ord.buyerAddress || '128 Nguyễn Đình Chiểu, Q.3, TP.HCM'}
                          </p>
                        ) : (
                          <p className="text-slate-500 line-clamp-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            Tiếp nhận bàn test #{stationCode}
                          </p>
                        )}
                      </div>

                      {/* Customer / Seller info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Khách: <strong className="text-slate-700">{ord.buyerName || 'Người mua'}</strong></span>
                        <span>Người bán: <strong className="text-slate-700">{ord.sellerName || 'Người bán'}</strong></span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setInspectorTab('workbench');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#24263e] hover:bg-[#1a1c2e] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Wrench className="w-3.5 h-3.5 text-[#fce5da]" />
                        <span>Vào Bàn Đo Kiểm</span>
                      </button>

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => setCertificateModalOrder(ord)}
                          className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Xem chứng thư số"
                        >
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>Xem Số</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CERTIFICATES & INSPECTION HISTORY (SỔ TAY CHỨNG THƯ SỐ)       */}
      {/* ===================================================================== */}
      {inspectorTab === 'certificates' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-[#24263e] flex items-center gap-2.5">
                <FileCheck className="w-6 h-6 text-emerald-600" />
                <span>{lang === 'vi' ? 'Sổ Tay Hồ Sơ & Chứng Thư Số Đã Cấp' : 'Digital Certificates & Inspection Records'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {lang === 'vi'
                  ? 'Lưu trữ toàn bộ chứng nhận chất lượng, tem niêm phong tamper-proof và kết quả thẩm định kỹ thuật.'
                  : 'Full audit log of verified devices, tamper seals, and technical reports.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{completedCount} Chứng Thư Đã Ký Số</span>
            </div>
          </div>

          {/* Certificates Table / Cards */}
          <div className="space-y-3">
            {completedOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Award className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50 text-slate-400" />
                <p className="text-sm font-semibold">Chưa có chứng thư số nào được nghiệm thu.</p>
                <button
                  type="button"
                  onClick={() => setInspectorTab('workbench')}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#24263e] text-white text-xs font-bold cursor-pointer"
                >
                  Mở Bàn Kiểm Định Ngay
                </button>
              </div>
            ) : (
              completedOrders.map((ord, idx) => {
                const sealId = ord.inspectionReport?.tamperSealId || `SL-SEAL-${8820000 + idx * 137}`;
                const score = ord.inspectionReport?.conditionScore || 94;
                const grade = ord.listing?.conditionGrade || 'Like New';

                return (
                  <div
                    key={ord.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#c34c36] bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                            {sealId}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            ĐẠT CHUẨN PASS
                          </span>
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            Grade: {grade} ({score}/100)
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#24263e]">
                          {ord.listing?.title || 'Thiết bị gia dụng kiểm định'}
                        </h4>
                        <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Mã đơn: <strong className="text-slate-700">#{ord.id.slice(0, 8)}</strong></span>
                          <span>•</span>
                          <span>Kỹ thuật viên: <strong className="text-slate-700">{inspectorName}</strong></span>
                          <span>•</span>
                          <span>Khách hàng: <strong className="text-slate-700">{ord.buyerName}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => setCertificateModalOrder(ord)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem Chứng Thư Số</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="In báo cáo"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: TECHNICAL STANDARDS & ISO 17025 LAB PROTOCOLS                 */}
      {/* ===================================================================== */}
      {inspectorTab === 'standards' && (
        <div className="space-y-6">
          {/* ISO Introduction Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#fce5da] flex items-center justify-center text-[#c34c36]">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#24263e]">
                  Tiêu Chuẩn Đo Kiểm Phòng Lab Kỹ Thuật ISO/IEC 17025
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Quy chuẩn kỹ thuật áp dụng cho thiết bị điện lạnh và gia dụng đã qua sử dụng trên sàn SecondLife.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mỗi thiết bị được tiếp nhận vào hệ thống SecondLife Hub đều bắt buộc phải trải qua 5 phân hệ kiểm định độc lập với sai số cho phép không vượt quá ngưỡng tiêu chuẩn quốc tế. Mọi kết quả đo đều được số hóa, mã hóa bằng chuỗi SHA-256 và phát hành tem niêm phong vật lý Tamper-Proof.
            </p>
          </div>

          {/* 5 Technical Standard Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Module 1 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  MODULE-01
                </span>
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">An Toàn Nguồn Điện & Tiếp Địa</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Kiểm tra rò rỉ điện vỏ kim loại: dòng rò &lt; 0.25mA</li>
                <li>Điện trở cách điện Megohmmeter &gt; 5.0 MΩ ở 500VDC</li>
                <li>Dây cáp nguồn không nứt gãy, phích cắm nguyên bản</li>
              </ul>
            </div>

            {/* Module 2 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  MODULE-02
                </span>
                <Wrench className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">Máy Nén Compressor & Ga Lạnh</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Đo áp suất hút/nén chuẩn môi chất (R600a/R134a/R32)</li>
                <li>Đo độ ồn vận hành decibel &lt; 42 dB khi máy nén hoạt động</li>
                <li>Kiểm tra độ rung cơ khí máy nén &amp; dàn ngưng tụ</li>
              </ul>
            </div>

            {/* Module 3 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  MODULE-03
                </span>
                <Thermometer className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">Cảm Biến Nhiệt & Rơ-Le Đóng Ngắt</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Đo nhiệt độ thực tế bằng nhiệt kế hồng ngoại laser (±0.5°C)</li>
                <li>Chu kỳ đóng ngắt nhiệt tự động đúng dải thiết lập</li>
                <li>Rơ-le bảo vệ quá nhiệt ngắt an toàn 100%</li>
              </ul>
            </div>

            {/* Module 4 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  MODULE-04
                </span>
                <Cpu className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">Bo Mạch IC, Inverter & Màn Hình</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Bo mạch Inverter biến tần nguyên bản chưa câu dây</li>
                <li>Màn hình LED/OLED sáng đều, không điểm chết cảm ứng</li>
                <li>Quét mã lỗi DTC qua cổng giao tiếp kỹ thuật</li>
              </ul>
            </div>

            {/* Module 5 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                  MODULE-05
                </span>
                <ShieldCheck className="w-4 h-4 text-teal-600" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">Gioăng Cửa, Ngoại Quan & Niêm Phong</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Độ hít nam châm gioăng cao su khép kín 100% không thoát nhiệt</li>
                <li>Khử khuẩn buồng máy bằng dung dịch sát trùng y tế &amp; Ozone</li>
                <li>Dán tem niêm phong vật lý Tamper Seal chống can thiệp trái phép</li>
              </ul>
            </div>

            {/* Guidelines & Safety */}
            <div className="bg-[#fce5da]/50 rounded-2xl p-5 border border-[#c34c36]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#c34c36] bg-white px-2 py-0.5 rounded">
                  SAFETY NOTE
                </span>
                <ShieldAlert className="w-4 h-4 text-[#c34c36]" />
              </div>
              <h3 className="font-bold text-sm text-[#24263e]">Quy Tắc An Toàn Kỹ Thuật Viên</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Kỹ thuật viên bắt buộc đeo găng tay cách điện, kính bảo hộ khi đo mạch cao áp và kiểm tra áp suất bình chứa khí gas. Mọi hành vi làm sai lệch kết quả đo kiểm sẽ bị đình chỉ chứng chỉ ISO vĩnh viễn.
              </p>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODALS INTEGRATION                                                    */}
      {/* ===================================================================== */}
      {/* 1. Barcode / QR Scanner Modal */}
      {isBarcodeScannerOpen && (
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onScanSuccess={handleBarcodeScanSuccess}
          orders={orders}
          lang={lang}
        />
      )}

      {/* 2. Digital Certificate Modal */}
      {certificateModalOrder && (
        <DigitalInspectionCertificateModal
          order={certificateModalOrder}
          onClose={() => setCertificateModalOrder(null)}
          lang={lang}
        />
      )}
    </div>
  );
};

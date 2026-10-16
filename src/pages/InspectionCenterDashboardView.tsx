import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  ClipboardList,
  Users,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Search,
  Filter,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
  RefreshCw,
  Loader2,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Layers,
  Navigation,
  UserCheck,
  Activity,
  User,
  KeyRound,
  Mail,
  Briefcase,
  LayoutDashboard,
  Menu,
  Home,
  LogOut,
  Sliders,
  Plus,
  Trash2,
  Edit3,
  FileCheck
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import { Language, UserProfile, EscrowOrder } from '../types';
import { formatVND } from '../utils/translations';
import {
  inspectorService,
  InspectionOrderDto,
  InspectionStaffDto,
  InspectionChecklistResponse,
  InspectionTravelTierDto,
  InspectionFeeProposalResponse
} from '../services';

interface InspectionCenterDashboardViewProps {
  initialOrders?: EscrowOrder[];
  currentUser?: UserProfile | null;
  lang?: Language;
  onNavigate?: (tab: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onViewWebsite?: () => void;
}

export type CenterTab = 'overview' | 'dispatch' | 'staff' | 'orders' | 'checklists' | 'pricing';

export const InspectionCenterDashboardView: React.FC<InspectionCenterDashboardViewProps> = ({
  initialOrders = [],
  currentUser,
  lang = 'vi',
  onNavigate,
  onOpenProfile,
  onLogout,
  onViewWebsite,
}) => {
  // --- Active Sub-Tab (Default to overview like Admin Dashboard) ---
  const [activeTab, setActiveTab] = useState<CenterTab>('overview');

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

  // --- Action Notification Banner (Admin Style) ---
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4500);
  };

  // Convert initial escrow orders into InspectionOrderDto fallback
  const fallbackOrders: InspectionOrderDto[] = useMemo(() => {
    return initialOrders.map((o: any) => ({
      id: o.id,
      postId: o.listing?.id || o.id,
      postTitle: o.listing?.title || 'Thiết bị gia dụng kiểm định',
      postPrice: o.listing?.priceVnd || o.totalAmountVnd || o.amountVnd || 0,
      postImageUrls: o.listing?.photos
        ? [
            o.listing.photos.front,
            o.listing.photos.back,
            o.listing.photos.screenOrDetails,
          ].filter(Boolean) as string[]
        : ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400'],
      buyerName: o.buyerName || 'Khách hàng',
      buyerEmail: o.buyerId ? `buyer_${o.buyerId.slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
      sellerName: o.sellerName || 'Người bán',
      sellerEmail: o.sellerId ? `seller_${o.sellerId.slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
      inspectorId: o.inspectorId || undefined,
      inspectorName: o.inspectorName || undefined,
      orderType: o.inspectionMethod === 'AT_HOME' ? 'AT_HOME' : 'AT_CENTER',
      feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
      status: o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH',
      inspectionFee: o.inspectionMethod === 'AT_HOME' ? 200000 : 120000,
      createdAt: o.createdAt || new Date().toISOString(),
    }));
  }, [initialOrders]);

  // --- Orders State ---
  const [orders, setOrders] = useState<InspectionOrderDto[]>(fallbackOrders);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderMethodFilter, setOrderMethodFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  // --- Staff State ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // --- Assign Modal State ---
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [assignEstimatedSlot, setAssignEstimatedSlot] = useState<string>('09:00 - 11:30 Sáng');
  const [assignNote, setAssignNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // --- Create Staff Modal State ---
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [createStaffError, setCreateStaffError] = useState<string | null>(null);
  const [createdStaffSuccessData, setCreatedStaffSuccessData] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);

  // --- API Fetch: Orders ---
  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await inspectorService.getAllOrders(
        orderStatusFilter === 'ALL' ? undefined : orderStatusFilter,
        0,
        100
      );
      const items = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
      if (items.length > 0) {
        setOrders(items);
      } else if (fallbackOrders.length > 0) {
        setOrders(fallbackOrders);
      }
    } catch (err: any) {
      console.warn('Lỗi tải danh sách đơn kiểm định từ backend, sử dụng dữ liệu trạm:', err);
      if (fallbackOrders.length > 0) setOrders(fallbackOrders);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // --- API Fetch: Staff ---
  const loadStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await inspectorService.getStaff();
      if (Array.isArray(data) && data.length > 0) {
        setStaffList(data);
      } else {
        setStaffList([]);
      }
    } catch (err: any) {
      console.warn('Lỗi tải danh sách nhân viên KTV:', err);
      setStaffList([]);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadOrders();
    loadStaff();
  }, [orderStatusFilter]);

  // Checklists State
  const [checklists, setChecklists] = useState<InspectionChecklistResponse[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [isCreateChecklistModalOpen, setIsCreateChecklistModalOpen] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistCategory, setChecklistCategory] = useState('Đồ gia dụng');
  const [checklistDesc, setChecklistDesc] = useState('');
  const [checklistItems, setChecklistItems] = useState<{ title: string; desc: string; mandatory: boolean }[]>([
    { title: 'Kiểm tra nguồn & khởi động máy', desc: 'Kiểm tra bo nguồn, điện áp cấp và phản hồi khi bật nguồn', mandatory: true },
    { title: 'Kiểm tra ngoại quan & ốc vít', desc: 'Soi dấu hiệu cạy mở, trầy xước vỏ và chân đế', mandatory: false },
    { title: 'Test tải vận hành liên tục 30 phút', desc: 'Kiểm tra nhiệt độ, độ ồn và tính ổn định linh kiện', mandatory: true },
  ]);

  // Pricing & Travel Tiers State
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierProposals, setTierProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [proposeBaseFee, setProposeBaseFee] = useState<number>(250000);
  const [proposeTiers, setProposeTiers] = useState<{ tierNumber: number; name: string; fromKm: number; toKm: number; pricePerKm: number }[]>([
    { tierNumber: 1, name: 'Nội thành gần (0 - 5 km)', fromKm: 0, toKm: 5, pricePerKm: 10000 },
    { tierNumber: 2, name: 'Trung bình (5 - 15 km)', fromKm: 5, toKm: 15, pricePerKm: 15000 },
    { tierNumber: 3, name: 'Xa / Ngoại thành (> 15 km)', fromKm: 15, toKm: 35, pricePerKm: 20000 },
  ]);

  const loadChecklists = async () => {
    setIsLoadingChecklists(true);
    try {
      const data = await inspectorService.getChecklists();
      setChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi tải checklists:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const loadPricing = async () => {
    setIsLoadingPricing(true);
    try {
      const [tiers, props] = await Promise.allSettled([
        inspectorService.getTravelTiers(),
        inspectorService.getTierProposals(),
      ]);
      if (tiers.status === 'fulfilled') {
        setTravelTiers(Array.isArray(tiers.value) ? (tiers.value as any) : []);
      }
      if (props.status === 'fulfilled') {
        setTierProposals(Array.isArray(props.value) ? (props.value as any) : []);
      }
    } catch (err) {
      console.warn('Lỗi tải bảng cước:', err);
    } finally {
      setIsLoadingPricing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'checklists') {
      loadChecklists();
    } else if (activeTab === 'pricing') {
      loadPricing();
    }
  }, [activeTab]);

  // Refresh all data
  const handleRefreshAll = () => {
    loadOrders();
    loadStaff();
    if (activeTab === 'checklists') loadChecklists();
    if (activeTab === 'pricing') loadPricing();
    showNotice(lang === 'vi' ? 'Đã làm mới dữ liệu trung tâm kiểm định' : 'Center data refreshed successfully');
  };

  // Staff Workload Map (number of orders currently assigned to each inspector)
  const staffWorkloadMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.inspectorId) {
        map[o.inspectorId] = (map[o.inspectorId] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingDispatch = orders.filter(
      (o) => !o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING'
    ).length;
    const inspecting = orders.filter(
      (o) => o.status === 'INSPECTING' || o.status === 'DISPATCHED' || o.status === 'SCHEDULED'
    ).length;
    const passed = orders.filter((o) => o.status === 'PASSED' || o.status === 'COMPLETED').length;
    const failed = orders.filter((o) => o.status === 'FAILED').length;
    const passRate = total > 0 ? Math.round((passed / (passed + failed || 1)) * 100) : 95;
    const totalStaff = staffList.length;

    return { total, pendingDispatch, inspecting, passed, failed, passRate, totalStaff };
  }, [orders, staffList]);

  // Filtered Orders for Dispatch Tab
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Unassigned toggle
      const isAssigned = Boolean(ord.inspectorId && ord.inspectorName && ord.inspectorName !== 'Chưa phân công');
      if (onlyUnassigned && isAssigned) return false;

      // Method filter
      if (orderMethodFilter !== 'ALL' && ord.orderType !== orderMethodFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesId = ord.id?.toLowerCase().includes(q);
        const matchesTitle = ord.postTitle?.toLowerCase().includes(q);
        const matchesInspector = ord.inspectorName?.toLowerCase().includes(q);
        const matchesBuyer = ord.buyerName?.toLowerCase().includes(q) || ord.buyerEmail?.toLowerCase().includes(q);
        const matchesSeller = ord.sellerName?.toLowerCase().includes(q) || ord.sellerEmail?.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesInspector && !matchesBuyer && !matchesSeller) {
          return false;
        }
      }

      return true;
    });
  }, [orders, onlyUnassigned, orderMethodFilter, searchTerm]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    if (!staffSearchTerm.trim()) return staffList;
    const q = staffSearchTerm.toLowerCase().trim();
    return staffList.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchTerm]);

  // Helper: Open Assign Modal
  const handleOpenAssign = (order: InspectionOrderDto) => {
    setAssignModalOrder(order);
    setSelectedInspectorId(order.inspectorId || staffList[0]?.id || '');
    setAssignEstimatedSlot(
      order.appointmentScheduledAt
        ? new Date(order.appointmentScheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '09:00 - 11:30 Sáng'
    );
    setAssignNote(order.note || '');
  };

  // Action: Submit Assign Inspector
  const handleConfirmAssign = async () => {
    if (!assignModalOrder || !selectedInspectorId) {
      showNotice('Vui lòng chọn kỹ thuật viên kiểm định');
      return;
    }

    setIsAssigning(true);
    try {
      await inspectorService.assignInspector(assignModalOrder.id, selectedInspectorId);
      const inspectorObj = staffList.find((s) => s.id === selectedInspectorId);
      const inspectorName = inspectorObj?.fullName || 'Kỹ thuật viên';

      showNotice(`Đã phân công đơn #${assignModalOrder.id.slice(0, 8)} cho KTV ${inspectorName} thành công!`);

      setAssignModalOrder(null);
      setSelectedInspectorId('');
      setAssignNote('');
      loadOrders();
      loadStaff();
    } catch (err: any) {
      showNotice(err?.message || 'Giao task kiểm định thất bại. Vui lòng thử lại.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Action: Submit Create Inspector Staff
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStaffError(null);

    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      setCreateStaffError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    if (newStaffPassword.length < 6) {
      setCreateStaffError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsCreatingStaff(true);
    try {
      await inspectorService.createStaff({
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        fullName: newStaffName.trim(),
      });

      setCreatedStaffSuccessData({
        fullName: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
      });

      showNotice(`Đã cấp tài khoản kỹ thuật viên cho ${newStaffName.trim()} thành công!`);

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowStaffPassword(false);
      setHasCopiedCredentials(false);

      loadStaff();
    } catch (err: any) {
      setCreateStaffError(err?.message || 'Không thể tạo tài khoản nhân viên. Vui lòng kiểm tra lại email.');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Helper: Copy credentials to clipboard
  const handleCopyCredentials = () => {
    if (!createdStaffSuccessData) return;
    const text = `Tài khoản KTV SecondLife Hub:\n- Họ tên: ${createdStaffSuccessData.fullName}\n- Email: ${createdStaffSuccessData.email}\n- Mật khẩu: ${createdStaffSuccessData.password}\n- Link đăng nhập: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setHasCopiedCredentials(true);
    setTimeout(() => setHasCopiedCredentials(false), 3000);
  };

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewStaffPassword(pwd);
    setShowStaffPassword(true);
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Đạt Nghiệm Thu
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Từ Chối / Fail
          </span>
        );
      case 'INSPECTING':
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Wrench className="w-3 h-3 text-blue-600" />
            Đang Kiểm Tra
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <UserCheck className="w-3 h-3 text-indigo-600" />
            Đã Giao KTV
          </span>
        );
      case 'CONFIRMED_PENDING_DISPATCH':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Chờ Giao Việc
          </span>
        );
    }
  };

  // Navigation Items (Filtered ONLY to relevant tabs: Dashboard, Dispatch, Staff, All Orders)
  const navItems = [
    {
      id: 'overview' as CenterTab,
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'dispatch' as CenterTab,
      label: 'ĐIỀU PHỐI & GIAO TASK',
      icon: Briefcase,
      badge: stats.pendingDispatch > 0 ? stats.pendingDispatch : null,
      badgeColor: 'bg-[#c34c36] text-white',
    },
    {
      id: 'staff' as CenterTab,
      label: 'ĐỘI NGŨ KỸ THUẬT VIÊN',
      icon: Users,
      badge: stats.totalStaff > 0 ? stats.totalStaff : null,
      badgeColor: 'bg-slate-700 text-white',
    },
    {
      id: 'orders' as CenterTab,
      label: 'QUẢN LÝ ĐƠN KIỂM ĐỊNH',
      icon: ClipboardList,
      badge: stats.total > 0 ? stats.total : null,
      badgeColor: 'bg-[#24263e] text-white',
    },
    {
      id: 'checklists' as CenterTab,
      label: 'TIÊU CHUẨN & CHECKLIST',
      icon: Layers,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'pricing' as CenterTab,
      label: 'CƯỚC DI CHUYỂN & BẬC GIÁ',
      icon: Sliders,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans w-full">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (EXACT ADMIN STYLE: h-13 sm:h-14 bg-[#24263e])     */}
      {/* ========================================================================= */}
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm w-full">
        {/* Left: Brand Logo + Sidebar Toggle + Quick Home */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img src={logoImg} alt="SecondLife Logo" className="h-7 sm:h-8 w-auto object-contain" />
            </div>
            <span className="font-black text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              CENTER MANAGER
            </span>
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

        {/* Right: ISO Hub Badge & Manager Profile Dropdown */}
        <div className="flex items-center gap-3">
          {/* Live ISO Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white/90">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ISO/IEC 17025 Hub</span>
          </div>

          {/* User Profile Button */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Hồ sơ quản lý trung tâm"
            >
              <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Manager" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-[11px]">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </div>
              <span className="text-xs font-black text-white hidden sm:inline">
                {currentUser?.name || 'Trưởng Trung Tâm'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-[#24263e] rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="font-black text-[#24263e] text-xs truncate">
                    {currentUser?.name || 'Trưởng Trung Tâm Kiểm Định'}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    {currentUser?.email || 'center@secondlife.com'}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#c34c36]/10 text-[#c34c36] font-extrabold text-[10px]">
                    Vai trò: Trưởng Trung Tâm Kiểm Định
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
                    <span>Hồ Sơ Cá Nhân</span>
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
      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE (EXACT ADMIN STRUCTURE)       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex relative w-full">
        {/* LEFT SIDEBAR (EXACT ADMIN STYLE: bg-[#fce5da] text-[#24263e]) */}
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
                  <img src={currentUser.avatar} alt="Manager" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-sm">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0" />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">
                  {currentUser?.name || 'Trưởng Trung Tâm'}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Trạm Đang Mở (Online)</span>
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
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
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
            <div className="p-3 border-t border-[#24263e]/10 text-[10px] text-[#24263e]/70 text-center">
              <span className="font-semibold text-[#24263e]">SecondLife Platform</span> • Center Hub v2.4
            </div>
          )}
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden animate-in fade-in"
          />
        )}

        {/* MAIN WORKSPACE CONTENT (MATCHING ADMIN DASHBOARD EXACT FORMAT) */}
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] p-4 sm:p-6 space-y-5 min-w-0">
          {/* Page Title & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'overview'
                  ? 'Dashboard'
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>

            {/* Breadcrumbs & Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => setActiveTab('overview')}
                  className="hover:text-[#24263e] transition cursor-pointer"
                >
                  Trang chủ
                </button>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-800 capitalize">
                  {activeTab === 'overview' ? 'Dashboard' : navItems.find((n) => n.id === activeTab)?.label}
                </span>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={isLoadingOrders || isLoadingStaff}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders || isLoadingStaff ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              {/* Create Inspector Button */}
              <button
                type="button"
                onClick={() => {
                  setCreateStaffError(null);
                  setCreatedStaffSuccessData(null);
                  setIsCreateStaffModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cấp Tài Khoản KTV Mới</span>
              </button>
            </div>
          </div>

          {/* Action Notification Alert Banner (Admin Style) */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-3 animate-in fade-in font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-emerald-600 hover:text-emerald-800 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW (DASHBOARD - EXACT ADMIN DASHBOARD STYLE)                 */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fadeIn">
              {/* ROW 1: 4 KPI STAT BOXES (MATCHING ADMIN DASHBOARD EXACT STYLE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: TỔNG ĐƠN KIỂM ĐỊNH */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.total}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      TỔNG ĐƠN KIỂM ĐỊNH
                    </div>
                  </div>
                  <ClipboardList className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem lịch sử đơn</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 2: CHỜ GIAO TASK KTV */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#c34c36] font-mono">
                        {stats.pendingDispatch}
                      </div>
                      {stats.pendingDispatch > 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] animate-ping" />
                      )}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      CHỜ GIAO TASK KTV
                    </div>
                  </div>
                  <Clock className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => {
                      setOnlyUnassigned(true);
                      setActiveTab('dispatch');
                    }}
                    className="w-full bg-[#c34c36] hover:bg-[#a63f2d] text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Điều phối ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 3: ĐANG KIỂM ĐỊNH */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.inspecting}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      ĐANG KIỂM ĐỊNH (KTV)
                    </div>
                  </div>
                  <Wrench className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem tiến độ kiểm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 4: ĐỘI NGŨ KỸ THUẬT VIÊN */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.totalStaff}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      NHÂN SỰ KTV THUỘC TRẠM
                    </div>
                  </div>
                  <Users className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Quản lý KTV & Cấp tài khoản</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 2: WORKLOAD DISTRIBUTION & STATUS BREAKDOWN */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: Workload per Inspector */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#c34c36]" />
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        PHÂN BỔ TẢI CÔNG VIỆC KỸ THUẬT VIÊN
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                      {staffList.length} nhân sự
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {staffList.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p>Trạm chưa có kỹ thuật viên nào trực thuộc.</p>
                        <button
                          onClick={() => {
                            setCreateStaffError(null);
                            setCreatedStaffSuccessData(null);
                            setIsCreateStaffModalOpen(true);
                          }}
                          className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                        >
                          + Cấp tài khoản KTV ngay
                        </button>
                      </div>
                    ) : (
                      staffList.map((st) => {
                        const count = staffWorkloadMap[st.id] || 0;
                        const pct = Math.min(100, Math.round((count / 5) * 100));
                        return (
                          <div key={st.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div className="flex items-center gap-2 truncate">
                                <div className="w-6 h-6 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-[10px]">
                                  {st.fullName ? st.fullName.charAt(0).toUpperCase() : 'K'}
                                </div>
                                <span className="font-bold text-slate-800 truncate">{st.fullName}</span>
                                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">({st.email})</span>
                              </div>
                              <span className="font-bold font-mono text-slate-700 text-xs shrink-0">
                                {count} đơn đang nhận
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 rounded-full ${
                                  count >= 4
                                    ? 'bg-rose-500'
                                    : count >= 2
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.max(8, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Card: Status Structure */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#24263e]" />
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        CƠ CẤU TRẠNG THÁI KIỂM ĐỊNH CỦA TRẠM
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tỷ lệ đạt {stats.passRate}%
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-amber-900">Chờ điều phối giao task cho KTV</span>
                      </div>
                      <strong className="font-mono text-amber-700 text-sm font-black">{stats.pendingDispatch} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-blue-900">Đang thực hiện kiểm tra</span>
                      </div>
                      <strong className="font-mono text-blue-700 text-sm font-black">{stats.inspecting} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-900">Đạt tiêu chuẩn kiểm định (Pass)</span>
                      </div>
                      <strong className="font-mono text-emerald-700 text-sm font-black">{stats.passed} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span className="font-bold text-rose-900">Từ chối nghiệm thu (Fail)</span>
                      </div>
                      <strong className="font-mono text-rose-700 text-sm font-black">{stats.failed} đơn</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 3: RECENT ORDERS NEEDING DISPATCH (QUICK DISPATCH TABLE) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-amber-500 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                      HÀNG ĐỢI ĐƠN HÀNG CẦN GIAO TASK GẤP
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {stats.pendingDispatch} đơn chờ
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setOnlyUnassigned(true);
                      setActiveTab('dispatch');
                    }}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Vào bảng điều phối</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Mã Đơn & Sản Phẩm</th>
                        <th className="py-2.5 px-4">Hình Thức</th>
                        <th className="py-2.5 px-4">Người Bán / Mua</th>
                        <th className="py-2.5 px-4">Trạng Thái</th>
                        <th className="py-2.5 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders
                        .filter((o) => !o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING')
                        .slice(0, 5).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Tuyệt vời! Hiện tại không có đơn nào đang chờ phân công KTV.
                          </td>
                        </tr>
                      ) : (
                        orders
                          .filter((o) => !o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING')
                          .slice(0, 5)
                          .map((order, idx) => (
                            <tr key={order.id} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 truncate max-w-xs">{order.postTitle}</div>
                                <div className="text-[10px] font-mono text-slate-400">ID: #{order.id.slice(0, 8)}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                  {order.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[11px] text-slate-600">
                                <div>Bán: {order.sellerName || 'Người bán'}</div>
                                <div>Mua: {order.buyerName || 'Khách mua'}</div>
                              </td>
                              <td className="py-3 px-4">{renderStatusBadge(order.status)}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleOpenAssign(order)}
                                  className="px-3 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                >
                                  Giao Task Ngay
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

          {/* ========================================================================= */}
          {/* TAB 2: DISPATCH & ASSIGN TASKS                                            */}
          {/* ========================================================================= */}
          {activeTab === 'dispatch' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden space-y-4">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#c34c36]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    HÀNG ĐỢI ĐIỀU PHỐI & PHÂN CÔNG KỸ THUẬT VIÊN
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {filteredOrders.length} đơn
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      onlyUnassigned
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chỉ đơn chưa gán KTV ({stats.pendingDispatch})</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã đơn, tên sản phẩm, người mua, người bán..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={orderMethodFilter}
                    onChange={(e) => setOrderMethodFilter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  >
                    <option value="ALL">-- Tất cả phương thức --</option>
                    <option value="AT_CENTER">Tại Lab Hub (Trung tâm)</option>
                    <option value="AT_HOME">Tại Nhà Khách (Tận nơi)</option>
                  </select>
                </div>

                <div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  >
                    <option value="ALL">-- Tất cả trạng thái --</option>
                    <option value="CONFIRMED_PENDING_DISPATCH">Chờ phân công KTV</option>
                    <option value="DISPATCHED">Đã phân công KTV</option>
                    <option value="INSPECTING">Đang kiểm tra</option>
                    <option value="PASSED">Đạt chuẩn (Passed)</option>
                    <option value="FAILED">Từ chối (Failed)</option>
                    <option value="COMPLETED">Đã hoàn tất</option>
                  </select>
                </div>
              </div>

              {/* Table of Orders */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Sản Phẩm & Mã Đơn</th>
                      <th className="py-2.5 px-4">Hình Thức & Phí</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên Phụ Trách</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                      <th className="py-2.5 px-4 text-right">Thao Tác Giao Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingOrders ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                          <span>Đang tải danh sách đơn kiểm định...</span>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Không tìm thấy đơn kiểm định nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord, idx) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {ord.postImageUrls && ord.postImageUrls[0] ? (
                                <img
                                  src={ord.postImageUrls[0]}
                                  alt="Thumb"
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Layers className="w-4 h-4" />
                                </div>
                              )}
                              <div className="overflow-hidden max-w-xs">
                                <div className="font-bold text-slate-900 truncate">{ord.postTitle}</div>
                                <div className="text-[10px] font-mono text-slate-400">Mã đơn: #{ord.id}</div>
                                <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                                  {formatVND(ord.postPrice || 0)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            <div className="font-semibold text-slate-800">
                              {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                            </div>
                            <div className="text-slate-500 font-mono">
                              Phí: {formatVND(ord.inspectionFee || (ord.orderType === 'AT_HOME' ? 200000 : 120000))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {ord.inspectorName && ord.inspectorName !== 'Chưa phân công' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                                  {ord.inspectorName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-xs">{ord.inspectorName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {ord.inspectorId?.slice(0, 8)}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Chưa gán KTV
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">{renderStatusBadge(ord.status)}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenAssign(ord)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs ${
                                !ord.inspectorId
                                  ? 'bg-[#c34c36] hover:bg-[#a63f2d] text-white'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>{!ord.inspectorId ? 'Giao Task Ngay' : 'Đổi KTV'}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: STAFF MANAGEMENT & CREATE INSPECTOR ACCOUNTS                       */}
          {/* ========================================================================= */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden space-y-4">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#c34c36]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    DANH SÁCH KỸ THUẬT VIÊN TRỰC THUỘC TRẠM
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {filteredStaff.length} nhân sự
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={staffSearchTerm}
                      onChange={(e) => setStaffSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm KTV..."
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#c34c36] bg-slate-50/50 w-48 sm:w-60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStaffError(null);
                      setCreatedStaffSuccessData(null);
                      setIsCreateStaffModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Cấp Tài Khoản Mới</span>
                  </button>
                </div>
              </div>

              {/* Staff Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên</th>
                      <th className="py-2.5 px-4">Email Công Vụ</th>
                      <th className="py-2.5 px-4">Số Task Đang Nhận</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                      <th className="py-2.5 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingStaff ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                          <span>Đang tải danh sách nhân sự trạm...</span>
                        </td>
                      </tr>
                    ) : filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p>Chưa có kỹ thuật viên nào trong trạm.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateStaffError(null);
                              setCreatedStaffSuccessData(null);
                              setIsCreateStaffModalOpen(true);
                            }}
                            className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                          >
                            + Cấp tài khoản KTV mới ngay
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((staff, idx) => {
                        const count = staffWorkloadMap[staff.id] || 0;
                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {staff.fullName ? staff.fullName.charAt(0).toUpperCase() : 'K'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{staff.fullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {staff.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600 font-mono text-[11px]">
                              {staff.email}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                                  count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {count} đơn
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Hoạt động
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('dispatch');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                              >
                                Giao Task
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
          {/* TAB 4: ALL INSPECTION ORDERS                                              */}
          {/* ========================================================================= */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden space-y-4">
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#24263e]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    TOÀN BỘ LỊCH SỬ ĐƠN KIỂM ĐỊNH CỦA TRUNG TÂM
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {orders.length} đơn
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Mã Đơn & Sản Phẩm</th>
                      <th className="py-2.5 px-4">Người Bán / Khách Mua</th>
                      <th className="py-2.5 px-4">Hình Thức</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Chưa có đơn kiểm định nào trong lịch sử trạm.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord, idx) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 truncate max-w-xs">{ord.postTitle}</div>
                            <div className="text-[10px] font-mono text-slate-400">ID: #{ord.id}</div>
                            <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                              {formatVND(ord.postPrice || 0)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            <div>Bán: {ord.sellerName || 'Người bán'}</div>
                            <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                          </td>
                          <td className="py-3 px-4">
                            {ord.inspectorName ? (
                              <span className="font-bold text-slate-800">{ord.inspectorName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa phân công</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{renderStatusBadge(ord.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: CHECKLISTS & KỸ THUẬT TIÊU CHUẨN                            */}
          {/* =================================================================== */}
          {activeTab === 'checklists' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#c34c36]" />
                    <span>Bộ Tiêu Chuẩn Kỹ Thuật & Checklist Động</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quản lý quy trình kiểm định chuyên sâu từng dòng sản phẩm gia dụng theo chuẩn SecondLife Hub
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateChecklistModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tạo Bộ Tiêu Chuẩn Mới</span>
                </button>
              </div>

              {/* Checklists Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Tên Bộ Tiêu Chuẩn</th>
                        <th className="py-2.5 px-4">Danh Mục</th>
                        <th className="py-2.5 px-4 text-center">Số Tiêu Chí</th>
                        <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingChecklists ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#24263e] mb-2" />
                            <span>Đang tải danh sách bộ checklist...</span>
                          </td>
                        </tr>
                      ) : checklists.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Chưa có bộ tiêu chuẩn nào. Nhấn "+ Tạo Bộ Tiêu Chuẩn Mới" để thiết lập.
                          </td>
                        </tr>
                      ) : (
                        checklists.map((chk, idx) => (
                          <tr key={chk.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{chk.title}</div>
                              {chk.description && (
                                <div className="text-[11px] text-slate-500 line-clamp-1">{chk.description}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {chk.categoryName || chk.categoryCode || 'Tất cả danh mục'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              {chk.items?.length || 0} mục
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                chk.active !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {chk.active !== false ? 'Kích hoạt' : 'Tạm dừng'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Bạn có chắc muốn xóa bộ checklist "${chk.title}"?`)) {
                                    try {
                                      await inspectorService.deleteChecklist(chk.id);
                                      showNotice(`Đã xóa bộ tiêu chuẩn "${chk.title}" thành công!`);
                                      loadChecklists();
                                    } catch (err: any) {
                                      alert(err?.message || 'Không thể xóa checklist');
                                    }
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa bộ tiêu chuẩn"
                              >
                                <Trash2 className="w-4 h-4" />
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

          {/* =================================================================== */}
          {/* TAB 6: TRAVEL TIERS & BẢNG GIÁ DI CHUYỂN                            */}
          {/* =================================================================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#c34c36]" />
                    <span>Bảng Cước Phí Di Chuyển & Đề Xuất Giá</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu hình phụ phí di chuyển theo km cho kỹ thuật viên kiểm định tại nhà (AT_HOME) và gửi đề xuất duyệt lên Admin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProposeModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Đề Xuất Bậc Giá Mới</span>
                </button>
              </div>

              {/* Active Travel Tiers Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 1: Cự Ly Gần</span>
                  <div className="text-xl font-black text-slate-900">0 - 5 km</div>
                  <div className="text-xs font-bold text-emerald-600">10.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho các địa chỉ kiểm định nội thành liền kề trạm</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 2: Cự Ly Trung Bình</span>
                  <div className="text-xl font-black text-slate-900">5 - 15 km</div>
                  <div className="text-xs font-bold text-blue-600">15.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho các quận nội thành mở rộng</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 3: Cự Ly Xa</span>
                  <div className="text-xl font-black text-slate-900">&gt; 15 km</div>
                  <div className="text-xs font-bold text-amber-600">20.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho ngoại thành hoặc giáp ranh tỉnh lân cận</p>
                </div>
              </div>

              {/* Proposals History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800">Lịch Sử Các Đề Xuất Giá Đã Gửi Admin</h4>
                  <button
                    onClick={loadPricing}
                    disabled={isLoadingPricing}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPricing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Mã Đề Xuất</th>
                        <th className="py-2.5 px-4">Phí Kiểm Định Gốc</th>
                        <th className="py-2.5 px-4">Người Đề Xuất</th>
                        <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-4">Thời Gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingPricing ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                            <span>Đang tải lịch sử đề xuất...</span>
                          </td>
                        </tr>
                      ) : tierProposals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Chưa có đề xuất giá nào. Nhấn "+ Đề Xuất Bậc Giá Mới" để gửi biểu phí.
                          </td>
                        </tr>
                      ) : (
                        tierProposals.map((prop, idx) => (
                          <tr key={prop.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">#{prop.id.slice(0, 8)}</td>
                            <td className="py-3 px-4 font-bold text-[#c34c36]">
                              {formatVND(prop.baseInspectionFee || 0)}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {prop.proposedByName || prop.proposedByEmail || 'Trưởng trung tâm'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                prop.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : prop.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {prop.status === 'APPROVED' ? 'Đã Phê Duyệt' : prop.status === 'REJECTED' ? 'Bị Từ Chối' : 'Chờ Admin Duyệt'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {prop.createdAt ? new Date(prop.createdAt).toLocaleString('vi-VN') : '—'}
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
        </main>
      </div>

      {/* Modal Tạo Bộ Tiêu Chuẩn Checklist */}
      {isCreateChecklistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-black text-sm text-slate-900">Tạo Bộ Tiêu Chuẩn Kiểm Định Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateChecklistModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên bộ tiêu chuẩn *</label>
                <input
                  type="text"
                  required
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  placeholder="VD: Kiểm định Tủ Lạnh & Tủ Đông cao cấp..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Danh mục áp dụng</label>
                <input
                  type="text"
                  value={checklistCategory}
                  onChange={(e) => setChecklistCategory(e.target.value)}
                  placeholder="VD: Tủ lạnh, Máy giặt, Điều hòa..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả quy trình</label>
                <textarea
                  rows={2}
                  value={checklistDesc}
                  onChange={(e) => setChecklistDesc(e.target.value)}
                  placeholder="Mô tả tóm tắt quy trình kiểm tra bo mạch, máy nén, cảm biến..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Các hạng mục kiểm tra ({checklistItems.length})</span>
                  <button
                    type="button"
                    onClick={() => setChecklistItems((prev) => [...prev, { title: '', desc: '', mandatory: false }])}
                    className="text-[#c34c36] font-bold hover:underline cursor-pointer"
                  >
                    + Thêm mục
                  </button>
                </div>

                {checklistItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChecklistItems((prev) => prev.map((it, i) => i === idx ? { ...it, title: val } : it));
                        }}
                        placeholder={`Tiêu chí #${idx + 1}...`}
                        className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                      />
                      <label className="flex items-center gap-1 cursor-pointer shrink-0 text-[11px] font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={item.mandatory}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setChecklistItems((prev) => prev.map((it, i) => i === idx ? { ...it, mandatory: val } : it));
                          }}
                        />
                        <span>Bắt buộc</span>
                      </label>
                      {checklistItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateChecklistModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!checklistTitle.trim() || checklistItems.length === 0}
                onClick={async () => {
                  try {
                    await inspectorService.createChecklist({
                      title: checklistTitle.trim(),
                      categoryName: checklistCategory.trim(),
                      description: checklistDesc.trim(),
                      items: checklistItems.filter(i => i.title.trim()).map((it, idx) => ({
                        itemTitle: it.title.trim(),
                        description: it.desc.trim(),
                        mandatory: it.mandatory,
                        orderIndex: idx,
                      }))
                    });
                    showNotice(`Đã tạo bộ tiêu chuẩn "${checklistTitle}" thành công!`);
                    setIsCreateChecklistModalOpen(false);
                    setChecklistTitle('');
                    loadChecklists();
                  } catch (err: any) {
                    alert(err?.message || 'Không thể tạo bộ tiêu chuẩn');
                  }
                }}
                className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-black shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Lưu Bộ Tiêu Chuẩn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đề Xuất Bậc Giá Mới */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-black text-sm text-slate-900">Đề Xuất Biểu Phí Di Chuyển Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phí kiểm định cơ sở (VND) *</label>
                <input
                  type="number"
                  min={50000}
                  step={10000}
                  value={proposeBaseFee}
                  onChange={(e) => setProposeBaseFee(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Các bậc tính phí theo khoảng cách:</label>
                {proposeTiers.map((tier, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-800">{tier.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Đơn giá:</span>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={tier.pricePerKm}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setProposeTiers((prev) => prev.map((t, i) => i === idx ? { ...t, pricePerKm: val } : t));
                        }}
                        className="w-28 p-1 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                      />
                      <span className="text-[11px] text-slate-500">₫ / km</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await inspectorService.proposeTravelTiers({
                      baseInspectionFee: proposeBaseFee,
                      tiers: proposeTiers,
                    });
                    showNotice('Đã gửi đề xuất bảng giá lên Admin thành công!');
                    setIsProposeModalOpen(false);
                    loadPricing();
                  } catch (err: any) {
                    alert(err?.message || 'Gửi đề xuất giá thất bại');
                  }
                }}
                className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-black shadow-xs cursor-pointer"
              >
                Gửi Đề Xuất Duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: GIAO TASK CHO KỸ THUẬT VIÊN (ASSIGN TASK MODAL)                 */}
      {/* ========================================================================= */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Phân Công Kỹ Thuật Viên Kiểm Định</h3>
                  <p className="text-[11px] text-gray-400">Giao task kiểm tra và ấn định lịch hẹn khảo sát</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Brief Summary Card */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
              <div className="flex items-start gap-3">
                {assignModalOrder.postImageUrls && assignModalOrder.postImageUrls[0] ? (
                  <img
                    src={assignModalOrder.postImageUrls[0]}
                    alt="Item"
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="text-[10px] font-mono font-bold text-gray-400">
                    MÃ ĐƠN: #{assignModalOrder.id}
                  </div>
                  <h4 className="font-extrabold text-gray-900 truncate">
                    {assignModalOrder.postTitle || 'Thiết bị'}
                  </h4>
                  <div className="text-[#c34c36] font-mono font-bold text-xs">
                    {formatVND(assignModalOrder.postPrice || 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-[11px]">
                <div>
                  <span className="text-gray-400">Hình thức: </span>
                  <strong className="text-gray-800">
                    {assignModalOrder.orderType === 'AT_HOME' ? 'Tại Nhà Khách (Tận Nơi)' : 'Tại Lab Hub (Trung Tâm)'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400">Phí kiểm định: </span>
                  <strong className="text-[#c34c36] font-mono">
                    {formatVND(assignModalOrder.inspectionFee || (assignModalOrder.orderType === 'AT_HOME' ? 200000 : 120000))}
                  </strong>
                </div>
              </div>
            </div>

            {/* Assign Fields */}
            <div className="space-y-4">
              {/* Select Inspector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e] flex items-center justify-between">
                  <span>
                    Chọn Kỹ Thuật Viên Phụ Trách: <strong className="text-rose-500">*</strong>
                  </span>
                  <span className="text-[11px] font-normal text-gray-500">
                    ({staffList.length} nhân sự khả dụng)
                  </span>
                </label>

                {staffList.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                    Trung tâm chưa có kỹ thuật viên nào. Vui lòng bấm{' '}
                    <strong
                      className="underline cursor-pointer"
                      onClick={() => {
                        setAssignModalOrder(null);
                        setIsCreateStaffModalOpen(true);
                      }}
                    >
                      Cấp tài khoản KTV
                    </strong>{' '}
                    trước.
                  </div>
                ) : (
                  <select
                    value={selectedInspectorId}
                    onChange={(e) => setSelectedInspectorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-gray-50/50"
                  >
                    <option value="">-- Chọn kỹ thuật viên --</option>
                    {staffList.map((st) => {
                      const count = staffWorkloadMap[st.id] || 0;
                      return (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({st.email}) — Đang có {count} task
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Time slot */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e]">Khung Giờ Tiếp Nhận / Hẹn Khảo Sát:</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assignEstimatedSlot}
                    onChange={(e) => setAssignEstimatedSlot(e.target.value)}
                    placeholder="09:00 - 11:30 Sáng nay"
                    className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                  />
                </div>
              </div>

              {/* Dispatch note */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e]">Ghi Chú Hướng Dẫn Kỹ Thuật Cho KTV:</label>
                <textarea
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  rows={2}
                  placeholder="Lưu ý mang đồng hồ đo gas R600a, kiểm tra kỹ gioăng từ hít và bo mạch điều khiển..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={isAssigning || !selectedInspectorId}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác Nhận Giao Task Cho KTV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO TÀI KHOẢN KỸ THUẬT VIÊN MỚI (CREATE STAFF MODAL)             */}
      {/* ========================================================================= */}
      {isCreateStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Cấp Tài Khoản Kỹ Thuật Viên</h3>
                  <p className="text-[11px] text-gray-400">Tạo thông tin công vụ cho KTV trực thuộc trung tâm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateStaffModalOpen(false);
                  setCreatedStaffSuccessData(null);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Card view if created */}
            {createdStaffSuccessData ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Cấp tài khoản KTV thành công!</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Vui lòng bàn giao thông tin đăng nhập bên dưới cho kỹ thuật viên:
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 font-mono text-xs">
                  <div>
                    <span className="text-gray-500 font-sans">Họ và tên: </span>
                    <strong className="text-gray-900">{createdStaffSuccessData.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans">Email công vụ: </span>
                    <strong className="text-gray-900">{createdStaffSuccessData.email}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans">Mật khẩu khởi tạo: </span>
                    <strong className="text-[#c34c36] text-sm">{createdStaffSuccessData.password}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                  >
                    {hasCopiedCredentials ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{hasCopiedCredentials ? 'Đã Sao Chép!' : 'Sao Chép Thông Tin'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedStaffSuccessData(null);
                      setIsCreateStaffModalOpen(false);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleCreateStaffSubmit} className="space-y-4">
                {createStaffError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{createStaffError}</span>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#24263e]">
                    Họ Và Tên Kỹ Thuật Viên: <strong className="text-rose-500">*</strong>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Nguyễn Văn Kỹ Thuật"
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#24263e]">
                    Email Đăng Nhập Công Vụ: <strong className="text-rose-500">*</strong>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="ktv.nguyenvan@secondlife.com"
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#24263e]">
                      Mật Khẩu Khởi Tạo: <strong className="text-rose-500">*</strong>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Tạo Mật Khẩu Ngẫu Nhiên</span>
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateStaffModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={isCreatingStaff}
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isCreatingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Cấp Tài Khoản KTV</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

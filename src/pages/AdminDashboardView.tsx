import React, { useState, useMemo, useEffect } from 'react';
import {
  EscrowOrder,
  DisputeCase,
  Listing,
  Language,
  EscrowStatus
} from '../types';
import { translations, formatVND } from '../utils/translations';
import { adminService, UserAdminResponseDto, SellerVerificationResponseDto } from '../services';
import {
  ShieldAlert,
  CheckCircle2,
  Download,
  Gavel,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Tag,
  Building2,
  TrendingUp,
  Wallet,
  Lock,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Truck,
  ShieldCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Store,
  Layers,
  Trash2,
  Menu,
  ShoppingBag,
  BarChart3,
  PieChart,
  UserPlus,
  Minus,
  Plus,
  Home,
  ArrowRight,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface AdminDashboardViewProps {
  orders: EscrowOrder[];
  disputes: DisputeCase[];
  listings: Listing[];
  onResolveDispute: (disputeId: string, decision: 'REFUND_BUYER' | 'RELEASE_SELLER') => void;
  lang: Language;
  onViewWebsite?: () => void;
}

type AdminTab =
  | 'overview'
  | 'orders'
  | 'listings'
  | 'disputes'
  | 'hubs'
  | 'ai-settings'
  | 'customers'
  | 'seller-kyc'
  | 'permissions';

interface BookingAppointment {
  id: string;
  stt: number;
  customerName: string;
  phone: string;
  gender: string;
  content: string;
  bookingDate: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'PENDING';
}

interface CustomerContact {
  id: string;
  stt: number;
  customerName: string;
  content: string;
  receivedDate: string;
  status: 'PENDING' | 'RESOLVED';
  email: string;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  orders: initialOrders,
  disputes,
  listings: initialListings,
  onResolveDispute,
  lang,
  onViewWebsite
}) => {
  const t = translations[lang];

  // Active sub-tab in Admin Dashboard
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Sidebar toggle state (expanded / collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Collapsible cards state
  const [collapsedCards, setCollapsedCards] = useState<{ [key: string]: boolean }>({
    booking: false,
    newOrders: false,
    contacts: false
  });

  const toggleCardCollapse = (cardKey: string) => {
    setCollapsedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [listingCategoryFilter, setListingCategoryFilter] = useState<string>('ALL');

  // Dispute review state
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || '');
  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

  // Local state for listings and orders moderation
  const [localListings, setLocalListings] = useState<Listing[]>(initialListings);
  const [localOrders, setLocalOrders] = useState<EscrowOrder[]>(initialOrders);

  // Real backend users & seller verifications from Swagger API
  const [backendUsers, setBackendUsers] = useState<UserAdminResponseDto[]>([]);
  const [backendVerifications, setBackendVerifications] = useState<SellerVerificationResponseDto[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    adminService.getAdminUsers({ page: 0, size: 20 })
      .then(res => {
        if (res && res.items && res.items.length > 0) {
          setBackendUsers(res.items);
        }
      })
      .catch(() => {});

    adminService.getSellerVerifications({ page: 0, size: 20 })
      .then(res => {
        if (res && res.items && res.items.length > 0) {
          setBackendVerifications(res.items);
        }
      })
      .catch(() => {});
  }, []);

  // Seller Verification Review Modal states
  const [selectedVerificationDetail, setSelectedVerificationDetail] = useState<any | null>(null);
  const [rejectModalVerificationId, setRejectModalVerificationId] = useState<string | null>(null);
  const [rejectionReasonCode, setRejectionReasonCode] = useState<string>('IMAGE_TOO_BLURRY');
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');

  // Inspection center creation modal state
  const [showAddHubModal, setShowAddHubModal] = useState<boolean>(false);
  const [newHubData, setNewHubData] = useState({
    hubCenterName: '',
    email: '',
    password: '',
    phone: '',
    city: 'TP. Hồ Chí Minh',
    address: '',
  });

  // Modal dialog states
  const [selectedOrderModal, setSelectedOrderModal] = useState<EscrowOrder | null>(null);
  const [selectedBookingModal, setSelectedBookingModal] = useState<BookingAppointment | null>(null);
  const [selectedContactModal, setSelectedContactModal] = useState<CustomerContact | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // AI & Platform Configurations
  const [duplicateThreshold, setDuplicateThreshold] = useState(85);
  const [priceAnomalyThreshold, setPriceAnomalyThreshold] = useState(45);
  const [commissionRate, setCommissionRate] = useState(2.5);
  const [autoApproveAiConfidence, setAutoApproveAiConfidence] = useState(92);
  const [modelVersion] = useState('LightGBM-v3.4-Ensemble-Gemini3.8');

  // Notification / Alert toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleApproveSellerVerification = async (id: string) => {
    try {
      await adminService.approveSellerVerification(id);
      triggerNotice('Đã phê duyệt hồ sơ người bán thành công! Vai trò SELLER đã được gán.');
      const res = await adminService.getSellerVerifications({ page: 0, size: 20 });
      if (res?.items) setBackendVerifications(res.items);
      if (selectedVerificationDetail?.id === id) setSelectedVerificationDetail(null);
    } catch (err: any) {
      alert(err.message || 'Phê duyệt hồ sơ thất bại');
    }
  };

  const handleRejectSellerVerification = async () => {
    if (!rejectModalVerificationId) return;
    try {
      await adminService.rejectSellerVerification(rejectModalVerificationId, {
        reasonCode: rejectionReasonCode,
        rejectionReason: rejectionReasonText || 'Hồ sơ chưa đạt yêu cầu kiểm định identity.',
        allowResubmission: true
      });
      triggerNotice('Đã từ chối hồ sơ xác thực người bán.');
      setRejectModalVerificationId(null);
      setRejectionReasonText('');
      const res = await adminService.getSellerVerifications({ page: 0, size: 20 });
      if (res?.items) setBackendVerifications(res.items);
      if (selectedVerificationDetail?.id === rejectModalVerificationId) setSelectedVerificationDetail(null);
    } catch (err: any) {
      alert(err.message || 'Từ chối hồ sơ thất bại');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await adminService.updateUserStatus(userId, {
        status: nextStatus as any,
        reason: 'Thay đổi trạng thái bởi Admin'
      });
      triggerNotice(`Đã chuyển trạng thái tài khoản thành ${nextStatus}.`);
      const res = await adminService.getAdminUsers({ page: 0, size: 20 });
      if (res?.items) setBackendUsers(res.items);
    } catch (err: any) {
      alert(err.message || 'Cập nhật trạng thái người dùng thất bại');
    }
  };

  const handleCreateHubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createInspectionCenterAccount({
        fullName: newHubData.hubCenterName.trim(),
        email: newHubData.email.trim(),
        password: newHubData.password,
        phone: newHubData.phone.trim() || undefined,
        hubCenterName: newHubData.hubCenterName.trim() || undefined,
        city: newHubData.city,
        address: newHubData.address
      });
      triggerNotice('Tạo tài khoản Trạm Kiểm Định Hub thành công!');
      setShowAddHubModal(false);
      setNewHubData({
        hubCenterName: '',
        email: '',
        password: '',
        phone: '',
        city: 'TP. Hồ Chí Minh',
        address: '',
      });
    } catch (err: any) {
      alert(err.message || 'Tạo tài khoản Trạm Hub thất bại');
    }
  };

  // Mock Bookings Data (Khách hàng đặt lịch)
  const [bookings, setBookings] = useState<BookingAppointment[]>([
    {
      id: 'BK-001',
      stt: 1,
      customerName: 'Nguyễn Văn An',
      phone: '0912 345 678',
      gender: 'Nam',
      content: 'Đặt lịch Kỹ sư Hub kiểm định Tủ lạnh Samsung Bespoke tại nhà',
      bookingDate: '2025-04-12 09:30',
      status: 'CONFIRMED'
    },
    {
      id: 'BK-002',
      stt: 2,
      customerName: 'Trần Thị Mai',
      phone: '0988 765 432',
      gender: 'Nữ',
      content: 'Hẹn bưu tá GHTK qua kho lấy Máy giặt sấy LG Inverter chuyển về Hub Cầu Giấy',
      bookingDate: '2025-04-12 14:00',
      status: 'IN_PROGRESS'
    },
    {
      id: 'BK-003',
      stt: 3,
      customerName: 'Lê Hoàng Long',
      phone: '0903 112 233',
      gender: 'Nam',
      content: 'Mang Máy pha cà phê DeLonghi qua Hub Cầu Giấy test áp suất & mạch nhiệt',
      bookingDate: '2025-04-13 10:15',
      status: 'PENDING'
    },
    {
      id: 'BK-004',
      stt: 4,
      customerName: 'Phạm Hương Giang',
      phone: '0977 445 566',
      gender: 'Nữ',
      content: 'Đặt lịch bưu tá lấy Robot hút bụi Dreame L20 Ultra tại kho Tân Bình',
      bookingDate: '2025-04-13 15:30',
      status: 'CONFIRMED'
    },
    {
      id: 'BK-005',
      stt: 5,
      customerName: 'Vũ Đình Trọng',
      phone: '0936 889 900',
      gender: 'Nam',
      content: 'Kiểm tra lò nướng âm tủ Bosch trước khi hoàn tất thủ tục giải ngân Escrow',
      bookingDate: '2025-04-14 08:45',
      status: 'CONFIRMED'
    }
  ]);

  // Mock Customer Contacts (Khách hàng liên hệ)
  const [contacts, setContacts] = useState<CustomerContact[]>([
    {
      id: 'CT-01',
      stt: 1,
      customerName: 'kt05',
      content: 'Yêu cầu cập nhật địa chỉ giao hàng đơn DH-QK1NA sang Cầu Giấy',
      receivedDate: '2025-04-11 15:20',
      status: 'PENDING',
      email: 'kt05@gmail.com'
    },
    {
      id: 'CT-02',
      stt: 2,
      customerName: 'Hoàng Quốc Khang',
      content: 'Cần hỗ trợ xuất hóa đơn VAT điện tử cho đơn hàng Máy giặt LG Inverter',
      receivedDate: '2025-04-11 11:05',
      status: 'RESOLVED',
      email: 'khang.hq@gmail.com'
    },
    {
      id: 'CT-03',
      stt: 3,
      customerName: 'Lê Văn Toàn',
      content: 'Hỏi quy trình dán tem NFC niêm phong máy và thủ tục đóng gói chống sốc',
      receivedDate: '2025-04-10 16:45',
      status: 'RESOLVED',
      email: 'toan.le@techcorp.vn'
    },
    {
      id: 'CT-04',
      stt: 4,
      customerName: 'Nguyễn Minh Anh',
      content: 'Khiếu nại bưu tá giao trễ hẹn 1 ngày so với cam kết thời gian Hub',
      receivedDate: '2025-04-10 09:12',
      status: 'PENDING',
      email: 'minhanh.ng@gmail.com'
    }
  ]);

  // Financial & Operational Metrics
  const totalGmv = useMemo(() => {
    return localOrders.reduce((sum, o) => sum + (o.itemPriceVnd || 0), 0) + 185000000;
  }, [localOrders]);

  const escrowHeld = useMemo(() => {
    return localOrders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => sum + (o.totalPaidVnd || o.itemPriceVnd || 0), 0);
  }, [localOrders]);

  const platformEarnings = useMemo(() => {
    return Math.round(totalGmv * (commissionRate / 100)) + localOrders.length * 150000;
  }, [totalGmv, commissionRate, localOrders.length]);

  const completedOrdersCount = useMemo(() => {
    return localOrders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length + 86;
  }, [localOrders]);

  // Listing moderation actions
  const handleToggleListingStatus = (id: string) => {
    setLocalListings((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
          triggerNotice(`Đã chuyển trạng thái tin đăng #${id} sang ${newStatus === 'ACTIVE' ? 'Hiển thị' : 'Tạm ẩn'}.`);
          return { ...item, status: newStatus as any };
        }
        return item;
      })
    );
  };

  const handleDeleteListing = (id: string) => {
    setLocalListings((prev) => prev.filter((item) => item.id !== id));
    triggerNotice(`Đã gỡ bỏ vĩnh viễn tin đăng #${id} khỏi sàn giao dịch.`);
  };

  // Order escrow manual release
  const handleForceReleaseEscrow = (orderId: string) => {
    setLocalOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          triggerNotice(`Đã can thiệp giải phóng Escrow thành công cho đơn #${orderId}. Tiền đã chuyển cho người bán.`);
          return { ...ord, escrowStatus: 'COMPLETED_RELEASED' as EscrowStatus };
        }
        return ord;
      })
    );
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return localOrders.filter((ord) => {
      const matchSearch =
        ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.listing.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = orderStatusFilter === 'ALL' || ord.escrowStatus === orderStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [localOrders, searchQuery, orderStatusFilter]);

  // Filtered Listings
  const filteredListings = useMemo(() => {
    return localListings.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = listingCategoryFilter === 'ALL' || item.category === listingCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [localListings, searchQuery, listingCategoryFilter]);

  // Hub Center Performance
  const hubCenters = [
    {
      id: 'HUB-HAN-01',
      name: 'SecondLife Hub Cầu Giấy (Hà Nội)',
      location: '180 Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      technicians: 14,
      dailyCapacity: 45,
      currentInTesting: 18,
      passRate: 93.4,
      nfcIssued: 1420,
      leadTechnician: 'Nguyễn Văn Hải (Level 4 Master Tech)'
    },
    {
      id: 'HUB-DAD-01',
      name: 'SecondLife Hub Hải Châu (Đà Nẵng)',
      location: '92 Phan Châu Trinh, Quận Hải Châu, Đà Nẵng',
      technicians: 8,
      dailyCapacity: 28,
      currentInTesting: 9,
      passRate: 95.1,
      nfcIssued: 840,
      leadTechnician: 'Lê Hoàng Khang (Level 3 Senior Tech)'
    },
    {
      id: 'HUB-SGN-01',
      name: 'SecondLife Hub Quận 10 (TP. Hồ Chí Minh)',
      location: '268 Lý Thường Kiệt, Quận 10, TP.HCM',
      technicians: 18,
      dailyCapacity: 65,
      currentInTesting: 24,
      passRate: 91.8,
      nfcIssued: 2190,
      leadTechnician: 'Trần Minh Tuấn (Level 4 Master Tech)'
    }
  ];

  // Helper for Status Badge
  const getEscrowStatusBadge = (status: EscrowStatus) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return {
          label: lang === 'vi' ? 'Chờ Thanh Toán' : 'Awaiting Payment',
          bg: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'HELD_IN_ESCROW':
        return {
          label: lang === 'vi' ? 'Đang Giữ Ký Quỹ' : 'Held in Escrow',
          bg: 'bg-sky-50 text-sky-700 border-sky-200'
        };
      case 'INSPECTION_IN_PROGRESS':
        return {
          label: lang === 'vi' ? 'Đang Test Tại Hub' : 'Hub Testing',
          bg: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      case 'INSPECTION_PASSED':
        return {
          label: lang === 'vi' ? 'Hub Đạt & Dán NFC' : 'Passed & NFC Sealed',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'SHIPPED_TO_BUYER':
        return {
          label: lang === 'vi' ? 'Đang Giao Bưu Tá' : 'Courier Delivering',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'COMPLETED_RELEASED':
        return {
          label: lang === 'vi' ? 'Đã Giải Ngân Xong' : 'Disbursed / Completed',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
        };
      case 'DISPUTED':
        return {
          label: lang === 'vi' ? 'Đang Tranh Chấp' : 'Disputed',
          bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse'
        };
      case 'REFUNDED_TO_BUYER':
        return {
          label: lang === 'vi' ? 'Đã Hoàn Tiền' : 'Refunded',
          bg: 'bg-gray-100 text-gray-700 border-gray-300'
        };
      default:
        return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  // Navigation Items matching the screenshot
  const navItems = [
    {
      id: 'overview' as AdminTab,
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'listings' as AdminTab,
      label: lang === 'vi' ? 'QUẢN TRỊ DANH MỤC' : 'CATALOG MANAGEMENT',
      icon: Tag,
      badge: localListings.length
    },
    {
      id: 'orders' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ BÁN HÀNG' : 'SALES ORDERS',
      icon: Package,
      badge: localOrders.length || 1,
      badgeColor: 'bg-[#F1622A]'
    },
    {
      id: 'disputes' as AdminTab,
      label: lang === 'vi' ? 'PHÂN XỬ TRANH CHẤP' : 'DISPUTE RESOLUTION',
      icon: Gavel,
      badge: disputes.length || 0,
      badgeColor: 'bg-[#EC1577]'
    },
    {
      id: 'seller-kyc' as AdminTab,
      label: lang === 'vi' ? 'DUYỆT eKYC NGƯỜI BÁN' : 'SELLER KYC REVIEW',
      icon: ShieldCheck,
      badge: backendVerifications.length || null,
      badgeColor: 'bg-rose-600'
    },
    {
      id: 'customers' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ KHÁCH HÀNG' : 'CUSTOMERS',
      icon: Users,
      badge: backendUsers.length || 44
    },
    {
      id: 'hubs' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ TRẠM HUB' : 'HUB CENTERS',
      icon: Building2,
      badge: 3
    },
    {
      id: 'ai-settings' as AdminTab,
      label: lang === 'vi' ? 'CẤU HÌNH THUẬT TOÁN AI' : 'AI CONFIGURATION',
      icon: Sliders,
      badge: null
    },
    {
      id: 'permissions' as AdminTab,
      label: lang === 'vi' ? 'PHÂN QUYỀN & USER' : 'ROLES & PERMISSIONS',
      icon: ShieldCheck,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[#0E121B] flex flex-col font-sans">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="bg-[#0E121B] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-slate-800 shrink-0 sticky top-0 z-40 shadow-sm">
        {/* Left: Brand + Toggle + Xem website */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-slate-700/60"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center font-black text-sm shadow-md">
              SL
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              WEB ADMIN
            </span>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(!isSidebarCollapsed);
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Xem Website Button */}
          <button
            onClick={() => onViewWebsite?.()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#EC1577]" />
            <span className="font-semibold">{lang === 'vi' ? 'Xem website' : 'View Website'}</span>
          </button>
        </div>

        {/* Right: Admin Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#EC1577] to-[#F1622A] p-0.5 flex items-center justify-center shadow-xs">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Admin"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <span className="text-xs font-bold text-white hidden sm:inline">Admin</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-[#0E121B] text-white rounded-xl shadow-2xl border border-white/15 py-1 z-50 text-xs">
              <div className="px-3 py-2 border-b border-white/10">
                <p className="font-bold text-white">
                  {lang === 'vi' ? 'Quản Trị Viên Hệ Thống' : 'System Administrator'}
                </p>
                <p className="text-[11px] text-slate-400">admin@secondlife.vn</p>
              </div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onViewWebsite?.();
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#EC1577]" />
                <span>{lang === 'vi' ? 'Về trang mua bán' : 'Back to Marketplace'}</span>
              </button>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  setActiveTab('ai-settings');
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#F1622A]" />
                <span>{lang === 'vi' ? 'Cấu hình thuật toán' : 'AI Algorithm Config'}</span>
              </button>
              <div className="border-t border-white/10 my-1"></div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onViewWebsite?.();
                }}
                className="w-full text-left px-3 py-2 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 flex items-center gap-2 cursor-pointer font-medium"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Thoát quyền Admin' : 'Exit Admin'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE */}
      <div className="flex-1 flex relative">
        {/* LEFT SIDEBAR */}
        <aside
          className={`bg-[#0E121B] text-white transition-all duration-300 flex flex-col shrink-0 select-none z-30 sticky top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] ${isSidebarCollapsed ? 'w-16' : 'w-60 sm:w-64'
            } ${isMobileSidebarOpen
              ? 'fixed inset-y-13 left-0 shadow-2xl block'
              : 'hidden md:flex'
            }`}
        >
          {/* User Block */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-800 p-0.5 border border-slate-700 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                  alt="Admin"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0E121B] absolute bottom-0 right-0"></span>
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-bold text-xs sm:text-sm text-white truncate">Admin</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Online</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: MAIN NAVIGATION */}
          <div className="px-4 pt-4 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer group ${isActive
                      ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                        }`}
                    />
                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-700 text-slate-200'
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${isActive ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
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
            <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 text-center">
              <span className="font-semibold text-slate-300">SecondLife Platform</span> v2.4
            </div>
          )}
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
          ></div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          {/* Page Title & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'overview'
                  ? 'Dashboard'
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h1>
              <span className="text-xs text-slate-500 font-normal">Control panel</span>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => setActiveTab('overview')}
                className="hover:text-[#EC1577] transition cursor-pointer"
              >
                Home
              </button>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="font-semibold text-slate-800 capitalize">
                {activeTab === 'overview' ? 'Dashboard' : activeTab}
              </span>
            </div>
          </div>

          {/* Notification Alert Banner */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-[#0E121B] text-white border border-[#EC1577]/40 shadow-lg flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
              <span className="text-xs font-semibold">{actionNotice}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: OVERVIEW (EXACT DASHBOARD FROM SCREENSHOT)           */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* ROW 1: 4 SMALL STAT BOXES (AdminLTE Small-Boxes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: ĐƠN HÀNG (SecondLife Brand Gradient) */}
                <div className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      {localOrders.length || 1}
                    </div>
                    <div className="text-xs uppercase font-bold tracking-wider mt-1 text-white/95">
                      ĐƠN HÀNG
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <ShoppingBag className="w-18 h-18 text-white/20 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#0E121B]/25 hover:bg-[#0E121B]/40 text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-medium transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 2: SẢN PHẨM (SecondLife Brand Gradient) */}
                <div className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                      {localListings.length || 65}
                    </div>
                    <div className="text-xs uppercase font-bold tracking-wider mt-1 text-white/95">
                      SẢN PHẨM
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <BarChart3 className="w-18 h-18 text-white/20 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="w-full bg-[#0E121B]/25 hover:bg-[#0E121B]/40 text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-medium transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 3: KHÁCH HÀNG (SecondLife Brand Gradient) */}
                <div className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      44
                    </div>
                    <div className="text-xs uppercase font-bold tracking-wider mt-1 text-white/95">
                      KHÁCH HÀNG
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <UserPlus className="w-18 h-18 text-white/20 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="w-full bg-[#0E121B]/25 hover:bg-[#0E121B]/40 text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-medium transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 4: BÀI VIẾT / TRANH CHẤP (SecondLife Brand Gradient) */}
                <div className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      {disputes.length || 12}
                    </div>
                    <div className="text-xs uppercase font-bold tracking-wider mt-1 text-white/95">
                      BÀI VIẾT & TRANH CHẤP
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <PieChart className="w-18 h-18 text-white/20 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('disputes')}
                    className="w-full bg-[#0E121B]/25 hover:bg-[#0E121B]/40 text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-medium transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 2: FULL-WIDTH TABLE: KHÁCH HÀNG ĐẶT LỊCH (Orange top-border) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#F1622A] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    KHÁCH HÀNG ĐẶT LỊCH
                  </h3>
                  <button
                    onClick={() => toggleCardCollapse('booking')}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={collapsedCards.booking ? 'Mở rộng' : 'Thu nhỏ'}
                  >
                    {collapsedCards.booking ? (
                      <Plus className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Table Content */}
                {!collapsedCards.booking && (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                            <th className="py-2.5 px-4 w-14">STT</th>
                            <th className="py-2.5 px-4">Tên khách hàng</th>
                            <th className="py-2.5 px-4">SĐT</th>
                            <th className="py-2.5 px-4">Giới Tính</th>
                            <th className="py-2.5 px-4">nội dung</th>
                            <th className="py-2.5 px-4 whitespace-nowrap">BOOK NGÀY</th>
                            <th className="py-2.5 px-4 text-center w-16">Xem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookings.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-mono font-medium text-slate-500">
                                {item.stt}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                {item.customerName}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                {item.phone}
                              </td>
                              <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                {item.gender}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={item.content}>
                                {item.content}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                {item.bookingDate}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setSelectedBookingModal(item)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#F1622A] hover:text-white text-slate-700 text-[11px] font-medium transition cursor-pointer"
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom Action */}
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => triggerNotice('Đang tải danh sách toàn bộ 85 lịch hẹn khách hàng đặt kiểm định & bưu tá...')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#F1622A] hover:text-[#F1622A] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ROW 3: TWO 50% WIDTH CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: ĐƠN ĐẶT HÀNG MỚI (SecondLife Dark Navy / Pink accent) */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#0E121B] overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        ĐƠN ĐẶT HÀNG MỚI
                      </h3>
                      <button
                        onClick={() => toggleCardCollapse('newOrders')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        {collapsedCards.newOrders ? (
                          <Plus className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Table Content */}
                    {!collapsedCards.newOrders && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                              <th className="py-2.5 px-4">Mã đơn hàng</th>
                              <th className="py-2.5 px-4">Tên khách hàng</th>
                              <th className="py-2.5 px-4">Trạng thái</th>
                              <th className="py-2.5 px-4">Ngày đặt hàng</th>
                              <th className="py-2.5 px-4 text-center">Chi tiết</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {localOrders.slice(0, 4).map((ord, idx) => (
                              <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {idx === 0 ? 'DH-QK1NA' : ord.id}
                                </td>
                                <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                                  {idx === 0 ? 'kt05' : ord.buyerName}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#EC1577]/15 text-[#EC1577] border border-[#EC1577]/30">
                                    Đơn hàng mới
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {idx === 0 ? '2025-04-10' : new Date(ord.createdAt).toISOString().split('T')[0]}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setSelectedOrderModal(ord)}
                                    className="px-2.5 py-1 rounded bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-xs"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Chi tiết</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  {!collapsedCards.newOrders && (
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#EC1577] hover:text-[#EC1577] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả đơn hàng
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Card: KHÁCH HÀNG LIÊN HỆ (Pink top-border) */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#EC1577] overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        KHÁCH HÀNG LIÊN HỆ
                      </h3>
                      <button
                        onClick={() => toggleCardCollapse('contacts')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        {collapsedCards.contacts ? (
                          <Plus className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Table Content */}
                    {!collapsedCards.contacts && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                              <th className="py-2.5 px-4 w-12">STT</th>
                              <th className="py-2.5 px-4">Tên khách hàng</th>
                              <th className="py-2.5 px-4">nội dung</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Ngày nhận</th>
                              <th className="py-2.5 px-4 text-center w-14">Xem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {contacts.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-medium text-slate-500">
                                  {c.stt}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                  {c.customerName}
                                </td>
                                <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={c.content}>
                                  {c.content}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {c.receivedDate}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setSelectedContactModal(c)}
                                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#EC1577] hover:text-white text-slate-700 text-[11px] font-medium transition cursor-pointer"
                                  >
                                    Xem
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  {!collapsedCards.contacts && (
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => triggerNotice('Đang tải toàn bộ hòm thư hỗ trợ khách hàng...')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#EC1577] hover:text-[#EC1577] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả liên hệ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: ORDERS (QUẢN LÝ BÁN HÀNG & KÝ QUỸ ESCROW)           */}
          {/* ======================================================== */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#0E121B] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Đơn Hàng Giao Dịch Qua Quỹ Escrow ({filteredOrders.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Toàn bộ đơn hàng được phong tỏa tài chính cho đến khi Kỹ sư Hub nghiệm thu và khách kiểm hàng
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm mã đơn, tên khách..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#EC1577]"
                    />
                  </div>

                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none bg-white cursor-pointer"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="HELD_IN_ESCROW">Đang giữ ký quỹ</option>
                    <option value="INSPECTION_IN_PROGRESS">Đang kiểm định Hub</option>
                    <option value="SHIPPED_TO_BUYER">Đang giao bưu tá</option>
                    <option value="COMPLETED_RELEASED">Đã giải ngân</option>
                    <option value="DISPUTED">Đang tranh chấp</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-bold">Mã Đơn</th>
                      <th className="pb-3 font-bold">Sản Phẩm</th>
                      <th className="pb-3 font-bold">Người Mua</th>
                      <th className="pb-3 font-bold">Người Bán</th>
                      <th className="pb-3 font-bold text-right">Giá Trị Đơn</th>
                      <th className="pb-3 font-bold">Trạng Thái Escrow</th>
                      <th className="pb-3 font-bold text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => {
                      const badge = getEscrowStatusBadge(ord.escrowStatus);
                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 font-mono font-bold text-slate-900">
                            #{ord.id}
                          </td>
                          <td className="py-3">
                            <div className="font-bold text-slate-900 max-w-[200px] truncate">
                              {ord.listing.title}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Mã máy: {ord.listing.modelCode || 'STD-APP'}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{ord.buyerName}</div>
                            <span className="text-[10px] text-slate-400">{ord.buyerPhone}</span>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{ord.sellerName}</div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="font-bold text-slate-900">
                              {formatVND(ord.totalPaidVnd || ord.itemPriceVnd)}
                            </div>
                            <span className="text-[10px] text-slate-400">Phí sàn: 2.5%</span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            {ord.escrowStatus !== 'COMPLETED_RELEASED' &&
                              ord.escrowStatus !== 'REFUNDED_TO_BUYER' ? (
                              <button
                                onClick={() => handleForceReleaseEscrow(ord.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition cursor-pointer shadow-xs"
                                title="Can thiệp giải ngân ngay cho người bán"
                              >
                                Giải Ngân Escrow
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Đã xong</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: LISTINGS (QUẢN TRỊ DANH MỤC & SẢN PHẨM)             */}
          {/* ======================================================== */}
          {activeTab === 'listings' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#F1622A] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Sản Phẩm & Tin Đăng Bán Trên Sàn ({filteredListings.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kiểm duyệt tính trung thực, đối chiếu gợi ý AI và quản lý trạng thái hiển thị
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm tên sản phẩm, thương hiệu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#EC1577]"
                    />
                  </div>

                  <select
                    value={listingCategoryFilter}
                    onChange={(e) => setListingCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none bg-white cursor-pointer"
                  >
                    <option value="ALL">Tất cả ngành hàng</option>
                    <option value="Tủ Lạnh">Tủ Lạnh</option>
                    <option value="Máy Giặt">Máy Giặt</option>
                    <option value="Máy Pha Cà Phê">Máy Pha Cà Phê</option>
                    <option value="Robot Hút Bụi">Robot Hút Bụi</option>
                  </select>
                </div>
              </div>

              {/* Listings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-bold">Ảnh & Sản Phẩm</th>
                      <th className="pb-3 font-bold">Danh Mục</th>
                      <th className="pb-3 font-bold">Người Bán</th>
                      <th className="pb-3 font-bold text-right">Giá Niêm Yết</th>
                      <th className="pb-3 font-bold text-right">AI Gợi Ý</th>
                      <th className="pb-3 font-bold text-center">Trạng Thái</th>
                      <th className="pb-3 font-bold text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredListings.map((item) => {
                      const isVisible = item.status !== 'DRAFT';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  item.images[0] ||
                                  'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=150&q=80'
                                }
                                alt={item.title}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <div className="font-bold text-slate-900 max-w-[180px] truncate">{item.title}</div>
                                <span className="text-[10px] text-slate-500 font-mono">ID: #{item.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{item.category}</div>
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              Grade {item.conditionGrade || 'A'}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-slate-800">{item.sellerName}</td>
                          <td className="py-3 text-right font-bold text-slate-900">
                            {formatVND(item.priceVnd)}
                          </td>
                          <td className="py-3 text-right">
                            <span className="font-bold text-[#EC1577]">
                              {formatVND(item.suggestedAiPriceVnd)}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isVisible
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                              {isVisible ? 'Đang Hiển Thị' : 'Tạm Ẩn'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleListingStatus(item.id)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                title={isVisible ? 'Ẩn tin này' : 'Bật hiển thị tin'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteListing(item.id)}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                title="Xóa vĩnh viễn tin đăng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: DISPUTES (PHÂN XỬ TRANH CHẤP & AI EVIDENCE)         */}
          {/* ======================================================== */}
          {activeTab === 'disputes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Cases */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-[#EC1577]" />
                    <span>Hồ Sơ Cần Phán Quyết ({disputes.length})</span>
                  </h3>
                  <span className="text-[11px] bg-[#EC1577]/15 text-[#EC1577] font-bold px-2 py-0.5 rounded border border-[#EC1577]/30">
                    Chờ Quyết Định
                  </span>
                </div>

                <div className="space-y-2.5">
                  {disputes.map((disp) => {
                    const isSelected = disp.id === activeDispute?.id;
                    return (
                      <div
                        key={disp.id}
                        onClick={() => setSelectedDisputeId(disp.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer ${isSelected
                            ? 'bg-[#0E121B] text-white border-[#0E121B] shadow-sm'
                            : 'bg-white border-slate-200 hover:border-[#EC1577] text-slate-800'
                          }`}
                      >
                        <div className="flex items-center justify-between text-[11px] opacity-80">
                          <span className="font-mono font-bold">#{disp.id}</span>
                          <span>{new Date(disp.openedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-xs font-bold mt-1">
                          Lý do: {disp.reason === 'NOT_AS_DESCRIBED' ? 'Hàng không đúng mô tả' : 'Hàng va đập khi vận chuyển'}
                        </div>
                        <p className="text-xs opacity-75 mt-1 line-clamp-2">"{disp.description}"</p>
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                          <span className="opacity-70">Người mua: {disp.buyerName}</span>
                          <span className="font-bold text-[#EC1577]">Xem chứng cứ &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Dispute Evidence Review */}
              <div className="lg:col-span-8">
                {activeDispute ? (
                  <div className="bg-white rounded-xl p-5 border border-slate-200 border-t-4 border-t-[#EC1577] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Hồ Sơ Trọng Tài #{activeDispute.id} (Đơn #{activeDispute.orderId})
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Người mua: <strong className="text-slate-800">{activeDispute.buyerName}</strong> vs Người bán: <strong className="text-slate-800">{activeDispute.sellerName}</strong>
                        </div>
                      </div>
                      <span className="bg-[#EC1577]/15 text-[#EC1577] text-xs font-bold px-2 py-0.5 rounded">
                        Chờ Phán Quyết
                      </span>
                    </div>

                    {/* AI Engine Box */}
                    <div className="bg-[#0E121B] text-white rounded-xl p-4 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <h5 className="font-bold text-xs text-white">
                            AI Evidence Engine - Phân Tích Bằng Chứng Hình Ảnh
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400">94.8% Match</span>
                      </div>

                      <div className="text-xs space-y-1.5 text-slate-300">
                        <p>• Đối chiếu ảnh Hub vs Ảnh người mua: Phát hiện xước móp 4.2mm phát sinh trong quá trình vận chuyển bưu tá.</p>
                        <p>• Khuyến nghị: <strong className="text-white">HOÀN TIỀN 100% CHO NGƯỜI MUA</strong> từ quỹ bảo hiểm Escrow.</p>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => {
                            onResolveDispute(activeDispute.id, 'REFUND_BUYER');
                            triggerNotice(`Admin đã phán quyết HOÀN TIỀN 100% cho người mua #${activeDispute.buyerName}.`);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Duyệt Hoàn Tiền Buyer
                        </button>
                        <button
                          onClick={() => {
                            onResolveDispute(activeDispute.id, 'RELEASE_SELLER');
                            triggerNotice('Admin đã phán quyết Bác khiếu nại, giải ngân cho người bán.');
                          }}
                          className="px-3 py-1.5 bg-white/15 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Bác Khiếu Nại (Giải Ngân Seller)
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                    <CheckCircle2 className="w-8 h-8 text-[#EC1577] mx-auto mb-2" />
                    <p className="font-bold text-slate-800 text-xs">Không có tranh chấp nào cần giải quyết</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: SELLER-KYC (DUYỆT HỒ SƠ ĐỊNH DANH NGƯỜI BÁN)        */}
          {/* ======================================================== */}
          {activeTab === 'seller-kyc' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-rose-600 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Duyệt Hồ Sơ Định Danh Người Bán (Seller eKYC & Risk Verification)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phê duyệt hồ sơ xác minh danh tính người bán, kiểm tra kết quả eKYC & điểm đánh giá rủi ro (Risk Engine)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-4">Tài khoản Người bán</th>
                      <th className="py-2.5 px-4">Loại giấy tờ & Số CCCD</th>
                      <th className="py-2.5 px-4">eKYC Status</th>
                      <th className="py-2.5 px-4">Risk Status</th>
                      <th className="py-2.5 px-4">Trạng thái Hồ sơ</th>
                      <th className="py-2.5 px-4 text-right">Thao tác Quản trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backendVerifications.length > 0 ? (
                      backendVerifications.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{v.userFullName || v.userEmail || 'Người bán SecondLife'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{v.userId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-800">{v.documentNumber}</span>
                            <span className="text-[10px] text-slate-400 block">{v.verificationType}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.ekycStatus === 'PASSED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              v.ekycStatus === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {v.ekycStatus || 'NOT_STARTED'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.riskStatus === 'CLEAR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              v.riskStatus === 'BLOCK' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {v.riskStatus || 'NOT_EVALUATED'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              v.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              v.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => adminService.getSellerVerificationById(v.id).then(setSelectedVerificationDetail).catch(() => setSelectedVerificationDetail(v))}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                            >
                              Xem Chi Tiết
                            </button>
                            {(v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING') && (
                              <>
                                <button
                                  onClick={() => handleApproveSellerVerification(v.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer"
                                >
                                  Phê Duyệt
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectModalVerificationId(v.id);
                                    setRejectionReasonText('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
                                >
                                  Từ Chối
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-medium">
                          Chưa có hồ sơ xác thực người bán nào trong hệ thống
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: CUSTOMERS (QUẢN LÝ KHÁCH HÀNG & NGƯỜI DÙNG)        */}
          {/* ======================================================== */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#F1622A] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Khách Hàng & Tài Khoản Hoạt Động ({backendUsers.length || 44} Thành Viên)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản lý danh tính người mua, người bán đã xác thực căn cước & bảo chứng tài chính
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Tìm tên, SĐT, email..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#F1622A]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-4">Tên khách hàng</th>
                      <th className="py-2.5 px-4">Số điện thoại</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Vai trò</th>
                      <th className="py-2.5 px-4">Trạng thái Tài khoản</th>
                      <th className="py-2.5 px-4">Xác thực Email OTP</th>
                      <th className="py-2.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backendUsers.length > 0 ? (
                      backendUsers
                        .filter((u) =>
                          !userSearchTerm ||
                          u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          (u.fullName && u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
                          (u.phone && u.phone.includes(userSearchTerm))
                        )
                        .map((user, i) => (
                          <tr key={user.id || i} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-bold text-slate-900">{user.fullName || 'Thành viên SecondLife'}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{user.phone || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{user.email}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {user.roles && user.roles.length > 0 ? user.roles.join(', ') : 'BUYER'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                user.accountStatus === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {user.accountStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                user.emailVerified
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {user.emailVerified ? 'Đã xác thực OTP' : 'Chờ xác thực OTP'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.accountStatus)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  user.accountStatus === 'ACTIVE'
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}
                              >
                                {user.accountStatus === 'ACTIVE' ? 'Khóa Tài Khoản' : 'Mở Khóa'}
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      [
                        { name: 'Nguyễn Văn An', phone: '0912 345 678', email: 'an.nguyen@gmail.com', role: 'Người mua', status: 'ACTIVE', kyc: 'Đã xác thực OTP' },
                        { name: 'Cửa hàng Gia Dụng Đức', phone: '0988 765 432', email: 'kt05@gmail.com', role: 'Người bán', status: 'ACTIVE', kyc: 'Đã xác thực OTP' }
                      ].map((user, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">{user.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{user.phone}</td>
                          <td className="py-3 px-4 text-slate-600">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {user.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {user.kyc}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[10px] text-slate-400 font-bold">—</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: HUBS (QUẢN LÝ TRẠM HUB KIỂM ĐỊNH)                   */}
          {/* ======================================================== */}
          {activeTab === 'hubs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#F1622A]" />
                    <span>Danh Sách Trạm Kiểm Định Hub & Quản Lý Kỹ Thuật Viên</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tạo tài khoản Trạm Kiểm Định Hub mới và quản lý năng lực xử lý kiểm định thiết bị
                  </p>
                </div>
                <button
                  onClick={() => setShowAddHubModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Tài Khoản Hub Mới</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hubCenters.map((hub) => (
                  <div
                    key={hub.id}
                    className="bg-white rounded-xl p-5 border border-slate-200 border-t-4 border-t-[#F1622A] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang Hoạt Động
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">{hub.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{hub.location}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Kỹ sư kiểm định</span>
                        <span className="font-bold text-slate-900">{hub.technicians} nhân sự</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Công suất tối đa</span>
                        <span className="font-bold text-slate-900">{hub.dailyCapacity} máy/ngày</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Đang test</span>
                        <span className="font-bold text-[#EC1577]">{hub.currentInTesting} máy</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Tỷ lệ Đạt (Pass)</span>
                        <span className="font-bold text-emerald-600">{hub.passRate}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
                      <span>Tem NFC đã dán:</span>
                      <strong className="text-slate-900 font-mono">{hub.nfcIssued} tem</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: AI-SETTINGS (CẤU HÌNH THUẬT TOÁN AI & RỦI RO)        */}
          {/* ======================================================== */}
          {activeTab === 'ai-settings' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#EC1577] p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-[#0E121B] text-[#EC1577] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tham Số Thuật Toán AI & Ngưỡng Kiểm Soát Rủi Ro Sàn
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phiên bản mô hình: <span className="font-mono font-bold text-[#EC1577]">{modelVersion}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Setting 1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Ngưỡng Phát Hiện Ảnh Trùng Lặp:
                    </label>
                    <span className="font-bold text-sm text-[#EC1577] font-mono">{duplicateThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={98}
                    value={duplicateThreshold}
                    onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                    className="w-full accent-[#EC1577] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Từ chối tin nếu ảnh trùng lặp &gt; {duplicateThreshold}% so với thư viện tin cũ.
                  </p>
                </div>

                {/* Setting 2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Cảnh Báo Giá Bất Thường:
                    </label>
                    <span className="font-bold text-sm text-[#EC1577] font-mono">&lt; {priceAnomalyThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={60}
                    value={priceAnomalyThreshold}
                    onChange={(e) => setPriceAnomalyThreshold(Number(e.target.value))}
                    className="w-full accent-[#EC1577] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Cảnh báo kiểm tra nếu giá người bán thấp hơn {priceAnomalyThreshold}% so với AI định giá.
                  </p>
                </div>

                {/* Setting 3 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Tỷ Lệ Thu Phí Sàn Escrow:
                    </label>
                    <span className="font-bold text-sm text-slate-900 font-mono">{commissionRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.1}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full accent-[#EC1577] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tỷ lệ tính trên giá trị giao dịch mỗi đơn hàng thành công.
                  </p>
                </div>

                {/* Setting 4 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Độ Tin Cậy AI Khuyến Nghị Phán Quyết:
                    </label>
                    <span className="font-bold text-sm text-emerald-600 font-mono">{autoApproveAiConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={99}
                    value={autoApproveAiConfidence}
                    onChange={(e) => setAutoApproveAiConfidence(Number(e.target.value))}
                    className="w-full accent-[#EC1577] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Độ tin cậy của mô hình vision để đưa ra đề xuất cho trọng tài Admin.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => triggerNotice('Đã lưu thành công cấu hình tham số thuật toán AI.')}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: PERMISSIONS (PHÂN QUYỀN HỆ THỐNG)                   */}
          {/* ======================================================== */}
          {activeTab === 'permissions' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#0E121B] p-5 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Ma Trận Phân Quyền Vai Trò & Bảo Mật Hệ Thống (RBAC)
                </h3>
                <p className="text-xs text-slate-500">
                  Quy định quyền truy cập giữa Người mua, Người bán, Kỹ sư Hub và Quản trị viên
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {[
                  { role: 'BUYER (Người Mua)', color: 'border-sky-400', perms: ['Duyệt & tìm kiếm tin', 'Đặt cọc phong tỏa Escrow', 'Yêu cầu mở tranh chấp', 'Xem báo cáo kiểm định Hub'] },
                  { role: 'SELLER (Người Bán)', color: 'border-orange-400', perms: ['Đăng tin bán máy cũ', 'Nhận đề xuất giá AI', 'Xác nhận đơn hàng', 'Rút tiền ký quỹ Escrow'] },
                  { role: 'HUB INSPECTOR', color: 'border-purple-400', perms: ['Tiếp nhận máy tại Hub', 'Chạy 18 bài test kỹ thuật', 'Lập biên bản nghiệm thu', 'Dán & kích hoạt tem NFC'] },
                  { role: 'SYSTEM ADMIN', color: 'border-pink-500', perms: ['Toàn quyền phán quyết tranh chấp', 'Can thiệp mở khóa Escrow', 'Cấu hình thuật toán AI', 'Quản trị danh mục sàn'] }
                ].map((item, i) => (
                  <div key={i} className={`p-4 rounded-xl bg-slate-50 border ${item.color} space-y-2`}>
                    <h4 className="font-bold text-slate-900">{item.role}</h4>
                    <ul className="space-y-1 text-slate-600 text-[11px]">
                      {item.perms.map((p, j) => (
                        <li key={j} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ORDER DETAILS (FROM "Chi tiết" BUTTON)            */}
      {/* ======================================================== */}
      {selectedOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#EC1577]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Chi Tiết Đơn Hàng #{selectedOrderModal.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800">{selectedOrderModal.listing.title}</div>
                <div className="text-slate-500">Mã thiết bị: {selectedOrderModal.listing.modelCode || 'STD-DEVICE'}</div>
                <div className="text-base font-extrabold text-[#EC1577]">
                  {formatVND(selectedOrderModal.totalPaidVnd || selectedOrderModal.itemPriceVnd)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div className="p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Người Mua</span>
                  <span className="font-bold text-slate-900">{selectedOrderModal.buyerName}</span>
                  <span className="text-[11px] text-slate-500 block">{selectedOrderModal.buyerPhone}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Người Bán</span>
                  <span className="font-bold text-slate-900">{selectedOrderModal.sellerName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 text-sky-800 text-xs">
                <span>Trạng thái phong tỏa:</span>
                <span className="font-bold uppercase">{selectedOrderModal.escrowStatus}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedOrderModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleForceReleaseEscrow(selectedOrderModal.id);
                  setSelectedOrderModal(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Giải Ngân Escrow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: BOOKING DETAILS (FROM "Xem" BUTTON)               */}
      {/* ======================================================== */}
      {selectedBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#F1622A]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Thông Tin Lịch Hẹn #{selectedBookingModal.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBookingModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{selectedBookingModal.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-mono font-bold text-slate-900">{selectedBookingModal.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Thời gian hẹn:</span>
                <span className="font-mono text-slate-900">{selectedBookingModal.bookingDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Giới tính / Nhóm:</span>
                <span>{selectedBookingModal.gender}</span>
              </div>
              <div className="py-2">
                <span className="text-slate-500 block mb-1">Nội dung yêu cầu:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 leading-relaxed">
                  {selectedBookingModal.content}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedBookingModal(null)}
                className="px-4 py-1.5 rounded-lg bg-[#0E121B] text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Đã xem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONTACT DETAILS (FROM "Xem" BUTTON)               */}
      {/* ======================================================== */}
      {selectedContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#EC1577]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Nội Dung Khách Hàng Liên Hệ
                </h3>
              </div>
              <button
                onClick={() => setSelectedContactModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{selectedContactModal.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-900">{selectedContactModal.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Thời gian nhận:</span>
                <span className="font-mono text-slate-900">{selectedContactModal.receivedDate}</span>
              </div>
              <div className="py-2">
                <span className="text-slate-500 block mb-1">Nội dung phản ánh / yêu cầu:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 leading-relaxed">
                  {selectedContactModal.content}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  triggerNotice(`Đã gửi phản hồi qua email cho khách hàng ${selectedContactModal.customerName}.`);
                  setSelectedContactModal(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-semibold transition cursor-pointer"
              >
                Gửi Phản Hồi
              </button>
              <button
                onClick={() => setSelectedContactModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SELLER eKYC VERIFICATION DETAIL                   */}
      {/* ======================================================== */}
      {selectedVerificationDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Chi Tiết Hồ Sơ eKYC Ngược Mẫu #{selectedVerificationDetail.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVerificationDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] block">Người bán / Email:</span>
                  <span className="font-bold text-slate-900 block">{selectedVerificationDetail.userFullName || selectedVerificationDetail.userEmail || 'Chưa cập nhật'}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedVerificationDetail.userId}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Số CCCD / CMND:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm block">{selectedVerificationDetail.documentNumber}</span>
                  <span className="text-[10px] text-slate-500">{selectedVerificationDetail.verificationType}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] block">Trạng Thái Hồ Sơ</span>
                  <span className="font-bold text-slate-800">{selectedVerificationDetail.status}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] block">eKYC Score</span>
                  <span className="font-bold text-emerald-600">{selectedVerificationDetail.ekycScore || '100'} / 100</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] block">Risk Rating</span>
                  <span className="font-bold text-purple-600">{selectedVerificationDetail.riskStatus || 'LOW_RISK'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Ảnh Giấy Tờ & Chân Dung Xác Minh:</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">Mặt trước CCCD</span>
                    <div className="h-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                      {selectedVerificationDetail.documentFrontUrl ? (
                        <img src={selectedVerificationDetail.documentFrontUrl} alt="CCCD Mặt trước" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-[10px]">Chưa có ảnh</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">Mặt sau CCCD</span>
                    <div className="h-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                      {selectedVerificationDetail.documentBackUrl ? (
                        <img src={selectedVerificationDetail.documentBackUrl} alt="CCCD Mặt sau" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-[10px]">Chưa có ảnh</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">Ảnh Chân Dung Selfie</span>
                    <div className="h-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                      {selectedVerificationDetail.selfieUrl ? (
                        <img src={selectedVerificationDetail.selfieUrl} alt="Selfie Chân dung" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-[10px]">Chưa có ảnh</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedVerificationDetail.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <strong className="block font-bold mb-0.5">Lý do bị từ chối trước đó:</strong>
                  <span>{selectedVerificationDetail.rejectionReason}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setSelectedVerificationDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
              {(selectedVerificationDetail.status === 'NEEDS_REVIEW' || selectedVerificationDetail.status === 'SUBMITTED' || selectedVerificationDetail.status === 'PENDING') && (
                <>
                  <button
                    onClick={() => {
                      setRejectModalVerificationId(selectedVerificationDetail.id);
                      setRejectionReasonText('');
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Từ Chối Hồ Sơ
                  </button>
                  <button
                    onClick={() => handleApproveSellerVerification(selectedVerificationDetail.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Phê Duyệt Ngay
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REJECT REASON INPUT POPUP                         */}
      {/* ======================================================== */}
      {rejectModalVerificationId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span>Nhập Lý Do Từ Chối eKYC Người Bán</span>
              </h3>
              <button
                onClick={() => setRejectModalVerificationId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Mã lý do từ chối (Reason Code):</label>
                <select
                  value={rejectionReasonCode}
                  onChange={(e) => setRejectionReasonCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-rose-600"
                >
                  <option value="INVALID_DOCUMENT">Giấy tờ không hợp lệ / không chính chủ</option>
                  <option value="DOCUMENT_EXPIRED">Giấy tờ hết hạn sử dụng</option>
                  <option value="FACIAL_MISMATCH">Khuôn mặt selfie không khớp với ảnh CCCD</option>
                  <option value="BLURRY_IMAGE">Hình ảnh mờ, chói sáng không nhìn rõ chữ</option>
                  <option value="OTHER">Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chi tiết lý do từ chối:</label>
                <textarea
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  placeholder="Nhập hướng dẫn cụ thể để người bán bổ sung lại giấy tờ..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:border-rose-600"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setRejectModalVerificationId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleRejectSellerVerification}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE INSPECTION CENTER (HUB) ACCOUNT             */}
      {/* ======================================================== */}
      {showAddHubModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#F1622A]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Tạo Tài Khoản Trạm Kiểm Định (Hub) Mới
                </h3>
              </div>
              <button
                onClick={() => setShowAddHubModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHubAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên Trạm Hub / Trung tâm:</label>
                <input
                  type="text"
                  required
                  value={newHubData.hubCenterName}
                  onChange={(e) => setNewHubData({ ...newHubData, hubCenterName: e.target.value })}
                  placeholder="Ví dụ: Trạm Kiểm Định Hub Tân Bình"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email đăng nhập Quản lý Hub:</label>
                <input
                  type="email"
                  required
                  value={newHubData.email}
                  onChange={(e) => setNewHubData({ ...newHubData, email: e.target.value })}
                  placeholder="hub.tanbinh@secondlife.vn"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu khởi tạo:</label>
                <input
                  type="password"
                  required
                  value={newHubData.password}
                  onChange={(e) => setNewHubData({ ...newHubData, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tỉnh / Thành phố:</label>
                  <input
                    type="text"
                    required
                    value={newHubData.city}
                    onChange={(e) => setNewHubData({ ...newHubData, city: e.target.value })}
                    placeholder="TP. Hồ Chí Minh"
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Số điện thoại trạm:</label>
                  <input
                    type="tel"
                    required
                    value={newHubData.phone}
                    onChange={(e) => setNewHubData({ ...newHubData, phone: e.target.value })}
                    placeholder="0909123456"
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Địa chỉ chi tiết trạm Hub:</label>
                <input
                  type="text"
                  required
                  value={newHubData.address}
                  onChange={(e) => setNewHubData({ ...newHubData, address: e.target.value })}
                  placeholder="123 Cộng Hòa, Phường 13, Q. Tân Bình"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#F1622A]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddHubModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-bold transition cursor-pointer shadow-sm hover:opacity-95"
                >
                  Tạo Tài Khoản Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

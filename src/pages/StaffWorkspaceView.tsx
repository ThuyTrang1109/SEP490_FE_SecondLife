import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  FileCheck,
  AlertTriangle,
  Image,
  ShieldCheck,
  Flag,
  Scale,
  RotateCcw,
  Wallet,
  Truck,
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
import { Listing, EscrowOrder, Language } from '../types';
import { formatVND } from '../utils/translations';
import { staffService, staffListingService, adminPostService, SellerVerificationResponseDto } from '../services';
import logoImg from '../assets/logo.png';

interface StaffWorkspaceViewProps {
  listings?: Listing[];
  orders?: EscrowOrder[];
  lang?: Language;
  onViewWebsite?: () => void;
}

type StaffTab =
  | 'overview'
  | 'review-listings'
  | 'duplicate-images'
  | 'proof-possession'
  | 'reports-support'
  | 'disputes'
  | 'refund-requests'
  | 'payouts'
  | 'inspections'
  | 'monitor-transactions'
  | 'restrict-users';

export const StaffWorkspaceView: React.FC<StaffWorkspaceViewProps> = ({
  listings = [],
  orders = [],
  lang = 'vi',
  onViewWebsite,
}) => {
  const [activeTab, setActiveTab] = useState<StaffTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sub-tab filters
  const [listingFilter, setListingFilter] = useState<'ALL' | 'NORMAL' | 'SUSPICIOUS'>('ALL');
  const [reportSubTab, setReportSubTab] = useState<'REPORTS' | 'TICKETS'>('REPORTS');
  const [inspectionSubTab, setInspectionSubTab] = useState<'COORDINATE' | 'RESULTS'>('COORDINATE');

  // Modals
  const [selectedListingModal, setSelectedListingModal] = useState<any | null>(null);
  const [selectedProofModal, setSelectedProofModal] = useState<any | null>(null);
  const [selectedInspectionModal, setSelectedInspectionModal] = useState<any | null>(null);
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



  useEffect(() => {
    if (activeTab === 'review-listings' || activeTab === 'duplicate-images') {
      staffListingService.getQueue(0, 20)
        .then((data: any) => {
          const items = data?.items || data?.content || (Array.isArray(data) ? data : []);
          if (items && items.length > 0) {
            const mapped = items.map((it: any) => ({
              id: it.postId || it.id,
              title: it.title || 'Bài đăng cần duyệt',
              category: it.category || 'Thiết bị điện tử',
              sellerName: it.sellerName || 'Người bán ' + (it.sellerId?.slice(0, 8) || ''),
              sellerRating: 5.0,
              priceVnd: it.price || 0,
              aiEstimatedPrice: it.price || 0,
              aiConfidence: 85,
              isSuspicious: Boolean(it.duplicateMatches?.length) || it.status === 'PENDING',
              suspiciousReason: it.reviewReason || (it.duplicateMatches?.length ? `Phát hiện ${it.duplicateMatches.length} bài đối chiếu nghi trùng` : 'Chờ nhân viên duyệt'),
              status: it.status || 'PENDING',
              images: it.imageUrls?.length ? it.imageUrls : [it.imageUrl || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80'],
              description: it.description || 'Chưa có mô tả'
            }));
            setStaffListings(mapped);
          } else {
            adminPostService.getAdminPosts().then((res: any) => {
              const adminItems = res?.content || res?.items || (Array.isArray(res) ? res : []);
              if (adminItems && adminItems.length > 0) {
                const mapped = adminItems.map((it: any) => ({
                  id: it.id,
                  title: it.title || 'Bài đăng cần duyệt',
                  category: it.category || 'Thiết bị gia dụng',
                  sellerName: it.user?.fullName || it.user?.email || 'Người bán',
                  sellerRating: 5.0,
                  priceVnd: it.price || 0,
                  aiEstimatedPrice: it.aiSuggestedPrice || it.price || 0,
                  aiConfidence: 90,
                  isSuspicious: it.status === 'PENDING',
                  suspiciousReason: it.rejectionReason || 'Chờ nhân viên thẩm định',
                  status: it.status || 'PENDING',
                  images: [it.imageUrl || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80'],
                  description: it.description || 'Chưa có mô tả'
                }));
                setStaffListings(mapped);
              } else {
                setStaffListings([]);
              }
            }).catch(() => setStaffListings([]));
          }
        })
        .catch(() => {
          adminPostService.getAdminPosts().then((res: any) => {
            const adminItems = res?.content || res?.items || (Array.isArray(res) ? res : []);
            if (adminItems && adminItems.length > 0) {
              const mapped = adminItems.map((it: any) => ({
                id: it.id,
                title: it.title || 'Bài đăng cần duyệt',
                category: it.category || 'Thiết bị gia dụng',
                sellerName: it.user?.fullName || it.user?.email || 'Người bán',
                sellerRating: 5.0,
                priceVnd: it.price || 0,
                aiEstimatedPrice: it.aiSuggestedPrice || it.price || 0,
                aiConfidence: 90,
                isSuspicious: it.status === 'PENDING',
                suspiciousReason: it.rejectionReason || 'Chờ nhân viên thẩm định',
                status: it.status || 'PENDING',
                images: [it.imageUrl || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80'],
                description: it.description || 'Chưa có mô tả'
              }));
              setStaffListings(mapped);
            } else {
              setStaffListings([]);
            }
          }).catch(() => setStaffListings([]));
        });
    }
  }, [activeTab]);

  // Trigger notice helper
  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Staff Listings (Được tải trực tiếp từ Backend)
  const [staffListings, setStaffListings] = useState<any[]>([]);

  // 2. Duplicate Images & Fraud Alerts
  const [duplicateCases, setDuplicateCases] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);

  // 3. Proof of Possession (Xác minh sở hữu)
  const [proofList, setProofList] = useState<any[]>([]);

  // 4. Reports & Support Tickets
  const [reports, setReports] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // 5. Disputes & Evidence
  const [disputes, setDisputes] = useState<any[]>([]);

  // 6. Refund Requests (Chức năng hoàn tiền)
  const [refundRequests, setRefundRequests] = useState<any[]>([]);

  // 7. Payouts & Escrow Hold (Case có tranh chấp)
  const [payouts, setPayouts] = useState<any[]>([]);

  // 8. Inspections (Điều phối & kết quả kiểm định)
  const [inspectionOrders, setInspectionOrders] = useState<any[]>([]);
  const [inspectionResults, setInspectionResults] = useState<any[]>([]);

  // 9. Realtime Transactions Monitoring
  const [transactions, setTransactions] = useState<any[]>([]);

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
      badge: staffListings.filter((l) => l.status === 'PENDING_REVIEW').length,
      badgeColor: 'bg-[#24263e] text-white'
    },
    {
      id: 'duplicate-images' as StaffTab,
      label: 'ĐỐI SOÁT ẢNH & GIAN LẬN',
      icon: Image,
      badge: duplicateCases.length + fraudAlerts.filter((f) => f.status === 'PENDING').length,
      badgeColor: 'bg-rose-600 text-white'
    },
    {
      id: 'proof-possession' as StaffTab,
      label: 'XÁC MINH SỞ HỮU',
      icon: ShieldCheck,
      badge: proofList.filter((p) => p.status === 'PENDING').length,
      badgeColor: 'bg-amber-600 text-white'

    },


    {
      id: 'reports-support' as StaffTab,
      label: 'BÁO CÁO & HỖ TRỢ',
      icon: Flag,
      badge: reports.filter((r) => r.status === 'PENDING').length + supportTickets.filter((t) => t.status === 'OPEN').length,
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
      id: 'inspections' as StaffTab,
      label: 'ĐIỀU PHỐI KIỂM ĐỊNH HUB',
      icon: Truck,
      badge: inspectionOrders.length,
      badgeColor: 'bg-emerald-700 text-white'
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
      await staffListingService.approve(id).catch(() => adminPostService.approvePost(id));
    } catch (err) {
      console.warn('Backend approve post error:', err);
    }
    setStaffListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' } : item))
    );
    triggerNotice(`Đã phê duyệt công khai bài tin #${id} lên Sàn giao dịch thành công!`);
    setSelectedListingModal(null);
  };

  const handleRejectListing = async (id: string) => {
    try {
      await staffListingService.reject(id, rejectReason).catch(() => adminPostService.rejectPost(id, rejectReason));
    } catch (err) {
      console.warn('Backend reject post error:', err);
    }
    setStaffListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'REJECTED' } : item))
    );
    triggerNotice(`Đã từ chối duyệt bài tin #${id}. Lý do: ${rejectReason}`);
    setSelectedListingModal(null);
  };


  const handleSendEvidenceRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceContent.trim()) {
      alert('Vui lòng nhập nội dung yêu cầu bổ sung bằng chứng');
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

  const handleProcessRefund = () => {
    if (!selectedRefundModal) return;
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
    setSelectedRefundModal(null);
    setRefundNote('');
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
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm">
        {/* Left: Brand + Toggle + Xem website */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img src={logoImg} alt="SecondLife Logo" className="h-7 sm:h-8 w-auto object-contain" />
            </div>
            <span className="font-black text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              STAFF WORKSPACE
            </span>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(!isSidebarCollapsed);
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer"
            title={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Xem Website Button */}
          <button
            onClick={() => onViewWebsite?.()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white/80" />
            <span className="font-bold">{lang === 'vi' ? 'Xem website' : 'View Website'}</span>
          </button>
        </div>

        {/* Right: Staff Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Staff Avatar"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-black text-white block leading-tight">Staff Operator</span>
              <span className="text-[10px] text-emerald-400 font-bold block">Kiểm Duyệt Viên</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white text-[#24263e] rounded-xl shadow-2xl border border-gray-200 py-1 z-50 text-xs">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="font-black text-[#24263e]">Nhân Viên Kiểm Duyệt</p>
                <p className="text-[11px] text-gray-500 font-medium">staff.moderator@secondlife.vn</p>
              </div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onViewWebsite?.();
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 text-[#24263e] font-semibold cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#24263e]" />
                <span>Về trang mua bán sàn</span>
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onViewWebsite?.();
                }}
                className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-bold"
              >
                <X className="w-3.5 h-3.5" />
                <span>Thoát quyền Staff</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE */}
      <div className="flex-1 flex relative">
        {/* LEFT SIDEBAR */}
        <aside
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 transition-all duration-300 flex flex-col shrink-0 select-none z-30 sticky top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] ${isSidebarCollapsed ? 'w-16' : 'w-60 sm:w-64'
            } ${isMobileSidebarOpen ? 'fixed inset-y-13 left-0 shadow-2xl block' : 'hidden md:flex'}`}
        >
          {/* User Block */}
          <div className="p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-[#24263e]/20 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                  alt="Staff"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0"></span>
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">Staff Operator</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  <span>Đang Trực Tuyến</span>
                </div>
              </div>
            )}
          </div>

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
                {activeTab === 'overview' ? 'Dashboard' : activeTab}
              </span>
            </div>
          </div>

          {/* Action Notification Toast Banner */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-md flex items-center gap-3 animate-in fade-in font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs">{actionNotice}</span>
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
                      {staffListings.filter((l) => l.status === 'PENDING_REVIEW').length}
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
                            onClick={() => setActiveTab('duplicate-images')}
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
                      1. XEM XÉT TIN ĐĂNG & TIN CÓ DẤU HIỆU NGHI VẤN
                    </h3>
                    <p className="text-xs text-slate-500">
                      Thẩm định tính xác thực thông tin, hình ảnh và cảnh báo bất thường giá định giá từ AI
                    </p>
                  </div>

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
                      {filteredListings.map((item) => (
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
                            <span className="text-[10px] text-amber-600 font-bold block">★ {item.sellerRating} / 5.0</span>
                          </td>
                          <td className="py-3 px-3 font-black text-[#c34c36] whitespace-nowrap">
                            {formatVND(item.priceVnd)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-700">{formatVND(item.aiEstimatedPrice)}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                              <span>Tin cậy:</span>
                              <span className={`font-black ${item.aiConfidence < 60 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                {item.aiConfidence}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {item.isSuspicious ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  NGHI VẤN CAO
                                </span>
                                <p className="text-[10px] text-rose-700 max-w-xs line-clamp-1">{item.suspiciousReason}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                An toàn
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedListingModal(item)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#24263e] hover:text-white text-slate-800 text-[11px] font-bold transition cursor-pointer"
                              >
                                Xem Thẩm Định
                              </button>
                              <button
                                onClick={() => handleApproveListing(item.id)}
                                className="p-1 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white transition cursor-pointer"
                                title="Duyệt bài ngay"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
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
          {/* TAB 2: DUPLICATE IMAGES & FRAUD ALERTS                    */}
          {/* ======================================================== */}
          {activeTab === 'duplicate-images' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    2. KIỂM TRA HÌNH ẢNH TRÙNG LẶP & CÁC CẢNH BÁO GIAN LẬN
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thuật toán Image Hash đối soát ảnh lấy từ Shopee/Chợ Tốt & Hệ thống phát hiện hành vi ép cọc ngoài
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {duplicateCases.map((dup) => (
                    <div key={dup.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-rose-900 text-xs">Mã #{dup.id} • Tin {dup.listingId}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[10px] font-black">
                          {dup.similarityScore}% TRÙNG LẶP
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="block font-bold text-slate-700 mb-1">Ảnh người bán tải lên:</span>
                          <img src={dup.sellerImage} alt="" className="w-full h-28 rounded-lg object-cover border" />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-700 mb-1">Ảnh gốc trên mạng:</span>
                          <img src={dup.sellerImage} alt="" className="w-full h-28 rounded-lg object-cover border opacity-80" />
                        </div>
                      </div>

                      <p className="text-slate-700 text-[11px]">
                        <strong>Ghi chú:</strong> {dup.note}
                      </p>

                      <div className="flex justify-end gap-2 pt-2 border-t border-rose-200">
                        <button
                          onClick={() => triggerNotice(`Đã gửi cảnh báo bản quyền ảnh tới người bán ${dup.sellerName}`)}
                          className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                        >
                          Cảnh Báo Vi Phạm
                        </button>
                        <button
                          onClick={() => triggerNotice(`Đã khóa bài tin ${dup.listingId} do đạo nhái hình ảnh`)}
                          className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-bold hover:bg-rose-800 transition cursor-pointer"
                        >
                          Khóa Bài Đăng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide">
                    CẢNH BÁO HÀNH VI GIAN LẬN HỆ THỐNG (FRAUD ALERTS QUEUE)
                  </h4>
                  <div className="space-y-2">
                    {fraudAlerts.map((frd) => (
                      <div key={frd.id} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-900">{frd.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                              {frd.riskLevel === 'HIGH' ? 'RỦI RO CAO' : 'CẢNH BÁO'}
                            </span>
                            <span className="font-bold text-slate-800">{frd.user}</span>
                          </div>
                          <p className="text-slate-700">{frd.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => triggerNotice(`Đã đóng băng phiên chat và chuyển tài khoản ${frd.user} vào diện kiểm soát`)}
                            className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-bold hover:bg-rose-800 transition cursor-pointer"
                          >
                            Chặn Giao Dịch
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: PROOF OF POSSESSION (XÁC MINH SỞ HỮU)              */}
          {/* ======================================================== */}
          {activeTab === 'proof-possession' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-emerald-600 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    3. XÁC MINH BẰNG CHỨNG SỞ HỮU (PROOF OF POSSESSION)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đối chiếu ảnh chụp thiết bị cùng giấy note viết tay tên/ngày giờ và tem Serial Number sản phẩm
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã Hồ Sơ</th>
                        <th className="py-2.5 px-3">Người Bán</th>
                        <th className="py-2.5 px-3">Thiết Bị Rao Bán</th>
                        <th className="py-2.5 px-3">Số Serial / IMEI</th>
                        <th className="py-2.5 px-3">Bằng Chứng Đã Nộp</th>
                        <th className="py-2.5 px-3">Trạng Thái</th>
                        <th className="py-2.5 px-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proofList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.id}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{item.sellerName}</td>
                          <td className="py-3 px-3 text-slate-800">
                            <span className="font-bold block">{item.productTitle}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{formatVND(item.price)}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">{item.serialNumber}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                ✓ Note viết tay
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-bold border border-sky-200">
                                ✓ Tem Serial
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'VERIFIED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                                }`}
                            >
                              {item.status === 'VERIFIED' ? 'ĐÃ XÁC MINH' : 'CHỜ THẨM ĐỊNH'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedProofModal(item)}
                                className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold transition cursor-pointer"
                              >
                                Xem & Duyệt
                              </button>
                            </div>
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
          {/* TAB 4: REPORTS & SUPPORT (BÁO CÁO & HỖ TRỢ)              */}
          {/* ======================================================== */}
          {activeTab === 'reports-support' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-indigo-600 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                      4. XỬ LÝ CÁC BÁO CÁO & YÊU CẦU HỖ TRỢ
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
                    {reports.map((rep) => (
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
                    ))}
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
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    5. GIẢI QUYẾT TRANH CHẤP & YÊU CẦU CUNG CẤP THÊM BẰNG CHỨNG
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phân xử khiếu nại giữa Người Mua & Người Bán khi đơn hàng bị tạm giữ ký quỹ Escrow
                  </p>
                </div>

                <div className="space-y-4">
                  {disputes.map((dsp) => (
                    <div key={dsp.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            Mã Tranh Chấp: {dsp.id} (Đơn hàng #{dsp.orderId})
                          </span>
                          <p className="text-slate-600 mt-0.5">
                            Người mua: <strong>{dsp.buyer}</strong> vs Người bán: <strong>{dsp.seller}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block font-bold">Số tiền Escrow đóng băng:</span>
                          <span className="text-base font-black text-rose-700">{formatVND(dsp.amount)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="font-black text-slate-800 block text-[11px]">BẰNG CHỨNG PHÍA NGƯỜI MUA:</span>
                          <p className="text-rose-800 font-bold">Lý do: {dsp.reason}</p>
                          <p className="text-slate-600 font-mono text-[11px]">Tập tin: {dsp.buyerEvidence}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="font-black text-slate-800 block text-[11px]">BẰNG CHỨNG PHÍA NGƯỜI BÁN:</span>
                          <p className="text-slate-700 font-bold">Hồ sơ giao hàng: Đã gửi biên bản Hub</p>
                          <p className="text-slate-600 font-mono text-[11px]">Tập tin: {dsp.sellerEvidence}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
                        <span className="text-[11px] font-bold text-amber-900">
                          Trọng tài phán quyết:
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => triggerNotice(`Đã phán quyết hoàn trả 100% tiền Escrow cho Người mua đơn ${dsp.orderId}`)}
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition cursor-pointer"
                          >
                            Hoàn Tiền Cho Người Mua
                          </button>
                          <button
                            onClick={() => triggerNotice(`Đã phán quyết bác khiếu nại & giải ngân cho Người bán đơn ${dsp.orderId}`)}
                            className="px-3 py-1.5 bg-[#24263e] text-white rounded-lg font-bold hover:bg-[#c34c36] transition cursor-pointer"
                          >
                            Giải Ngân Cho Người Bán
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Yêu Cầu Bổ Sung Bằng Chứng (Theo đúng ảnh người dùng gửi) */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="p-5 rounded-2xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                        7. REQUEST ADDITIONAL EVIDENCE (YÊU CẦU BỔ SUNG BẰNG CHỨNG)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Gửi thông báo yêu cầu người mua / người bán quay video mở hộp / chụp lại tem mác
                      </p>
                    </div>

                    <form onSubmit={handleSendEvidenceRequest} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-800 block mb-1">Đối tượng cần yêu cầu:</label>
                          <select
                            value={evidenceTarget}
                            onChange={(e) => setEvidenceTarget(e.target.value as any)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#24263e]"
                          >
                            <option value="BUYER">Người Mua (Buyer)</option>
                            <option value="SELLER">Người Bán (Seller)</option>
                            <option value="BOTH">Cả Hai Bên (Both Parties)</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-800 block mb-1">Thời hạn bổ sung bằng chứng:</label>
                          <select
                            value={evidenceDeadline}
                            onChange={(e) => setEvidenceDeadline(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#24263e]"
                          >
                            <option value="12 Giờ">12 Giờ</option>
                            <option value="24 Giờ">24 Giờ</option>
                            <option value="48 Giờ">48 Giờ</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-800 block text-xs mb-1.5">
                          Nội dung yêu cầu bổ sung bằng chứng:
                        </label>
                        <textarea
                          rows={4}
                          value={evidenceContent}
                          onChange={(e) => setEvidenceContent(e.target.value)}
                          placeholder="VD: Yêu cầu người mua cung cấp video quay lại quá trình cắm điện tủ lạnh lần đầu..."
                          className="w-full p-3.5 bg-white border-2 border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#24263e] shadow-inner"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Gửi Yêu Cầu
                      </button>
                    </form>
                  </div>
                </div>
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
                    6. XEM XÉT CÁC YÊU CẦU HOÀN TIỀN (REFUND REQUESTS)
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
                      {refundRequests.map((item) => (
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
                      ))}
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
                    7. XEM XÉT / PHÊ DUYỆT / TẠM GIỮ KHOẢN THANH TOÁN (CASE CÓ TRANH CHẤP)
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
          {/* TAB 8: INSPECTIONS (ĐIỀU PHỐI & KẾT QUẢ KIỂM TRA)         */}
          {/* ======================================================== */}
          {activeTab === 'inspections' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-emerald-600 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                      8. ĐIỀU PHỐI QUY TRÌNH KIỂM TRA VÀ XEM KẾT QUẢ KIỂM TRA
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sắp xếp lịch kỹ sư kiểm định tại nhà / tại Hub và tra cứu biên bản 25 tiêu chí kỹ thuật
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setInspectionSubTab('COORDINATE')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${inspectionSubTab === 'COORDINATE' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                        }`}
                    >
                      Điều Phối Lịch ({inspectionOrders.length})
                    </button>
                    <button
                      onClick={() => setInspectionSubTab('RESULTS')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${inspectionSubTab === 'RESULTS' ? 'bg-white text-[#24263e] shadow-xs font-black' : 'text-slate-600'
                        }`}
                    >
                      Kết Quả Kiểm Tra ({inspectionResults.length})
                    </button>
                  </div>
                </div>

                {inspectionSubTab === 'COORDINATE' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                          <th className="py-2.5 px-3">Mã Lịch Hẹn</th>
                          <th className="py-2.5 px-3">Mã Đơn Hàng</th>
                          <th className="py-2.5 px-3">Thiết Bị</th>
                          <th className="py-2.5 px-3">Hình Thức Kiểm Tra</th>
                          <th className="py-2.5 px-3">Trạm Hub / Kỹ Sư Phụ Trách</th>
                          <th className="py-2.5 px-3">Thời Gian Hẹn</th>
                          <th className="py-2.5 px-3 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectionOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{ord.id}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{ord.orderId}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{ord.productName}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                                {ord.method === 'AT_HOME' ? 'Kỹ Sư Đến Tận Nhà' : 'Gửi Về Trạm Hub'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              <span className="font-bold block">{ord.hubCenter}</span>
                              <span className="text-[11px] text-slate-500">{ord.technician}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-700">{ord.appointmentDate}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => triggerNotice(`Đã xác nhận điều phối kỹ sư cho lịch hẹn ${ord.id}`)}
                                className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer"
                              >
                                Cập Nhật Lịch
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {inspectionSubTab === 'RESULTS' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                          <th className="py-2.5 px-3">Mã Biên Bản</th>
                          <th className="py-2.5 px-3">Sản Phẩm</th>
                          <th className="py-2.5 px-3">Kỹ Sư Kiểm Định</th>
                          <th className="py-2.5 px-3">Điểm Số (25 Tiêu Chí)</th>
                          <th className="py-2.5 px-3">Kết Luận & Mã NFC</th>
                          <th className="py-2.5 px-3">Ngày Lập</th>
                          <th className="py-2.5 px-3 text-center">Xem Chi Tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectionResults.map((rpt) => (
                          <tr key={rpt.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{rpt.id}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{rpt.productName}</td>
                            <td className="py-3 px-3 text-slate-700">{rpt.technician}</td>
                            <td className="py-3 px-3 font-black text-slate-900">{rpt.score}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${rpt.verdict === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                  }`}
                              >
                                {rpt.verdict === 'PASS' ? 'ĐẠT (PASS)' : 'KHÔNG ĐẠT (FAIL)'}
                              </span>
                              <span className="block font-mono text-[10px] text-slate-500 mt-0.5">
                                {rpt.nfcTamperSealId}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{rpt.date}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => setSelectedInspectionModal(rpt)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#24263e] hover:text-white text-slate-800 text-[11px] font-bold transition cursor-pointer"
                              >
                                Xem Biên Bản
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 9: MONITOR TRANSACTIONS (GIÁM SÁT GIAO DỊCH)          */}
          {/* ======================================================== */}
          {activeTab === 'monitor-transactions' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 border-t-4 border-t-sky-600 space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    9. GIÁM SÁT CÁC GIAO DỊCH (REALTIME ESCROW MONITORING)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi lưu lượng ký quỹ, giải ngân và luồng tiền bảo lãnh thanh toán qua cổng ngân hàng
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Tổng Escrow Đang Bảo Chứng</span>
                    <span className="text-xl font-black text-[#24263e]">66.200.000đ</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Giải Ngân Trong 24 Giờ</span>
                    <span className="text-xl font-black text-emerald-700">42.800.000đ</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block">Tỷ Lệ Giao Dịch An Toàn</span>
                    <span className="text-xl font-black text-indigo-900">99.8%</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Mã GD</th>
                        <th className="py-2.5 px-3">Thời Gian</th>
                        <th className="py-2.5 px-3">Loại Giao Dịch</th>
                        <th className="py-2.5 px-3">Cổng Thanh Toán</th>
                        <th className="py-2.5 px-3">Số Tiền</th>
                        <th className="py-2.5 px-3">Mức Độ An Toàn</th>
                        <th className="py-2.5 px-3">Nội Dung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{t.id}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{t.timestamp}</td>
                          <td className="py-3 px-3 font-bold text-slate-800">{t.type}</td>
                          <td className="py-3 px-3 text-slate-600">{t.gateway}</td>
                          <td className="py-3 px-3 font-black text-slate-900">{formatVND(t.amount)}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.riskLevel === 'SAFE' || t.riskLevel === 'LOW'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                            >
                              {t.riskLevel === 'SAFE' || t.riskLevel === 'LOW' ? '✓ An Toàn' : '⚠ Cần Lưu Ý'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{t.note}</td>
                        </tr>
                      ))}
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
                    10. CẢNH BÁO NGƯỜI DÙNG VÀ ÁP DỤNG HẠN CHẾ TẠM THỜI (KHI ĐƯỢC CẤP QUYỀN)
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
                          <option value="WARN">1. Gửi Cảnh Cáo Chính Thức</option>
                          <option value="LOCK_POST">2. Tạm Khóa Đăng Tin (7 Ngày)</option>
                          <option value="LOCK_ESCROW">3. Tạm Ngưng Rút Tiền Escrow</option>
                          <option value="SUSPEND">4. Tạm Đình Chỉ Tài Khoản (14 Ngày)</option>
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
                    {selectedListingModal.sellerName} (Đánh giá: ★ {selectedListingModal.sellerRating})
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
                    {formatVND(selectedListingModal.aiEstimatedPrice)} (Độ tin cậy: {selectedListingModal.aiConfidence}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">Mô tả của người bán:</span>
              <p className="text-slate-700">{selectedListingModal.description}</p>
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
      {/* MODAL: XEM BẰNG CHỨNG SỞ HỮU                            */}
      {/* ======================================================== */}
      {selectedProofModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  XÁC MINH SỞ HỮU #{selectedProofModal.id}
                </h3>
                <p className="text-slate-500 text-[11px]">{selectedProofModal.productTitle}</p>
              </div>
              <button
                onClick={() => setSelectedProofModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block font-bold text-slate-700 mb-1">Ảnh giấy note viết tay:</span>
                  <img src={selectedProofModal.handwrittenNotePhoto} alt="" className="w-full h-36 rounded-lg object-cover border" />
                </div>
                <div>
                  <span className="block font-bold text-slate-700 mb-1">Ảnh tem Serial/IMEI máy:</span>
                  <img src={selectedProofModal.serialPhoto} alt="" className="w-full h-36 rounded-lg object-cover border" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-[11px]">Số Serial khai báo:</span>
                <span className="font-mono font-black text-sm text-slate-900">{selectedProofModal.serialNumber}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => {
                  triggerNotice(`Đã yêu cầu người bán ${selectedProofModal.sellerName} chụp lại ảnh note viết tay rõ nét`);
                  setSelectedProofModal(null);
                }}
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Yêu Cầu Nộp Lại
              </button>
              <button
                onClick={() => {
                  setProofList((prev) =>
                    prev.map((p) => (p.id === selectedProofModal.id ? { ...p, status: 'VERIFIED' } : p))
                  );
                  triggerNotice(`Đã phê duyệt xác minh chính chủ cho sản phẩm ${selectedProofModal.productTitle}!`);
                  setSelectedProofModal(null);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition cursor-pointer"
              >
                Xác Nhận Hợp Lệ
              </button>
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
      {/* MODAL: XEM BIÊN BẢN KIỂM ĐỊNH HUB                        */}
      {/* ======================================================== */}
      {selectedInspectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  BIÊN BẢN KIỂM ĐỊNH #{selectedInspectionModal.id}
                </h3>
                <p className="text-slate-500 text-[11px]">{selectedInspectionModal.productName}</p>
              </div>
              <button
                onClick={() => setSelectedInspectionModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Kỹ sư kiểm tra:</span>
                <span className="font-bold text-slate-900">{selectedInspectionModal.technician}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Điểm số 25 tiêu chí:</span>
                <span className="font-black text-slate-900 text-sm">{selectedInspectionModal.score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Mã tem niêm phong NFC:</span>
                <span className="font-mono font-bold text-indigo-900">{selectedInspectionModal.nfcTamperSealId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Tình trạng linh kiện:</span>
                <span className="font-medium text-slate-800 text-right max-w-xs">{selectedInspectionModal.componentsStatus}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedInspectionModal(null)}
                className="px-4 py-2 bg-[#24263e] hover:bg-[#c34c36] text-white rounded-xl font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

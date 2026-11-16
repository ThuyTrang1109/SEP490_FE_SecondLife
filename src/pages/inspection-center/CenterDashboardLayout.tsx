import {
  Building2,
  ClipboardList,
  Users,
  UserPlus,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Layers,
  User,
  Briefcase,
  LayoutDashboard,
  Menu,
  Home,
  LogOut,
  Sliders,
  Wallet,
} from 'lucide-react';
import React, { useState, useEffect, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import logoImg from '../../assets/logo.png';
import { ResizableSidebarControls } from '../../components/common/ResizableSidebarControls';
import { Language, UserProfile } from '../../types';
import { translateSystemNotification } from '../../utils/systemNotificationTranslator';
import type { CenterTab } from './types';
import type { useCenterDispatchQueue } from './dispatch/useCenterDispatchQueue';
import type { useCenterOrders } from './orders/useCenterOrders';
import type { useCenterProfile } from './useCenterProfile';
import type { useCenterStaff } from './staff/useCenterStaff';

interface Props {
  actionNotice: string | null;
  activeTab: CenterTab;
  centerProfile: ReturnType<typeof useCenterProfile>['centerProfile'];
  currentUser: UserProfile | null | undefined;
  handleRefreshAll: () => void;
  isLoadingOrders: ReturnType<typeof useCenterOrders>['isLoadingOrders'];
  lang: Language;
  onLogout: (() => void) | undefined;
  onOpenProfile: (() => void) | undefined;
  setActionNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTab: (tab: CenterTab) => void;
  stats: ReturnType<typeof useCenterDispatchQueue>['stats'];
  staff: Pick<ReturnType<typeof useCenterStaff>,
    | 'isLoadingStaff'
    | 'setCreatedStaffSuccessData'
    | 'setCreateStaffError'
    | 'setIsCreateStaffModalOpen'
  >;
  children: React.ReactNode;
}

export function CenterDashboardLayout({
  actionNotice,
  activeTab,
  centerProfile,
  currentUser,
  handleRefreshAll,
  isLoadingOrders,
  lang,
  onLogout,
  onOpenProfile,
  setActionNotice,
  setActiveTab,
  stats,
  staff,
  children,
}: Props) {
  const { isLoadingStaff, setCreatedStaffSuccessData, setCreateStaffError, setIsCreateStaffModalOpen } = staff;

  // --- Sidebar Collapse & Mobile Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
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
    {
      id: 'profile' as CenterTab,
      label: 'THÔNG TIN TRUNG TÂM',
      icon: Building2,
      badge: centerProfile && !centerProfile.shippingAddressConfigured ? 'Cần cấu hình' : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'wallet' as CenterTab,
      label: 'VÍ TRUNG TÂM',
      icon: Wallet,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <>
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

          {/* Mobile navigation trigger */}
          <button
            type="button"
            onClick={() => {
              setIsSidebarCollapsed(false);
              setIsMobileSidebarOpen((open) => !open);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer md:hidden"
            aria-expanded={isMobileSidebarOpen}
            aria-label={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

        </div>

        {/* Right: ISO Hub Badge & Manager Profile Dropdown */}
        <div className="flex items-center gap-3">

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
                      setActiveTab('profile');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>Thông Tin Trung Tâm</span>
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
          style={{ width: isSidebarCollapsed ? 64 : sidebarWidth }}
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 max-w-[85vw] flex-col shrink-0 select-none z-30 top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] md:sticky md:flex ${isMobileSidebarOpen ? 'fixed left-0 flex shadow-2xl md:shadow-none' : 'hidden'}`}
        >
          {/* User Block with Live Online indicator */}
          <div
            onClick={() => onOpenProfile?.()}
            className={`p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition ${isSidebarCollapsed ? '' : 'md:pr-11'}`}
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

          <ResizableSidebarControls
            width={sidebarWidth}
            collapsed={isSidebarCollapsed}
            onResize={setSidebarWidth}
            onToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            lang={lang}
          />

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
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-700 text-slate-200'}`}>
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
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] p-3 sm:p-4 lg:p-5 space-y-4 sm:space-y-5 min-w-0">
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
              {activeTab !== 'dispatch' && <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
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
              </div>}

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
              {activeTab !== 'dispatch' && <button
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
              </button>}
            </div>
          </div>

          {/* Action Notification Alert Banner (Admin Style) */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-3 animate-in fade-in font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{translateSystemNotification(actionNotice)}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-emerald-600 hover:text-emerald-800 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}

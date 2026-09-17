import React from 'react';
import { ShieldCheck, Sparkles, ShoppingBag, PlusCircle, Clock, Globe, Building2, ShieldAlert, MessageSquare, Home, LogIn, UserPlus, LogOut } from 'lucide-react';
import { UserRole, Language } from '../types';
import { translations } from '../utils/translations';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeOrdersCount: number;
  unreadChatsCount?: number;
  currentUser?: { id: string; name: string; email: string; role: UserRole } | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  activeTab,
  onTabChange,
  activeOrdersCount,
  unreadChatsCount = 1,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
      {/* Top micro-bar: Subtle Trust Ribbon & Role Selector */}
      <div className="bg-stone-50 text-stone-600 text-[11px] px-4 sm:px-6 lg:px-8 py-1.5 border-b border-stone-200/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 bg-emerald-50/90 px-2.5 py-0.5 rounded-full border border-emerald-200/70 text-[11px]">
            <Sparkles className="w-3 h-3 text-emerald-700" />
            AI & Escrow Verification
          </span>
          <span className="hidden sm:inline text-stone-300">|</span>
          <span className="hidden md:inline text-stone-500 font-normal">
            {lang === 'vi'
              ? 'Bảo vệ tài chính 100% qua Quỹ tín thác & Kiểm định chuyên gia SecondLife Hub'
              : '100% Escrow buyer protection & Certified hardware inspection'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refined Role Switcher */}
          <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg border border-stone-300/60">
            <span className="text-stone-500 text-[10px] uppercase font-semibold px-1.5 hidden sm:inline">
              {lang === 'vi' ? 'Vai trò:' : 'Role:'}
            </span>
            <button
              onClick={() => onRoleChange('buyer')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-all font-medium cursor-pointer ${
                currentRole === 'buyer'
                  ? 'bg-white text-emerald-900 font-semibold shadow-xs border border-stone-200/70'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {lang === 'vi' ? 'Người Mua' : 'Buyer'}
            </button>
            <button
              onClick={() => onRoleChange('seller')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-all font-medium cursor-pointer ${
                currentRole === 'seller'
                  ? 'bg-white text-emerald-900 font-semibold shadow-xs border border-stone-200/70'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {lang === 'vi' ? 'Người Bán' : 'Seller'}
            </button>
            <button
              onClick={() => onRoleChange('inspector')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-all font-medium cursor-pointer ${
                currentRole === 'inspector'
                  ? 'bg-white text-emerald-900 font-semibold shadow-xs border border-stone-200/70'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {lang === 'vi' ? 'Kỹ Sư Hub' : 'Inspector'}
            </button>
            <button
              onClick={() => onRoleChange('admin')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-all font-medium cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-white text-emerald-900 font-semibold shadow-xs border border-stone-200/70'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1 px-2 py-0.5 bg-stone-100 hover:bg-stone-200/80 rounded-lg text-stone-600 border border-stone-200 text-[11px] font-medium transition cursor-pointer"
            title="Toggle Vietnamese / English"
          >
            <Globe className="w-3 h-3 text-emerald-700" />
            <span className="font-semibold uppercase">{lang}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none group"
          onClick={() => onTabChange('home')}
        >
          <div className="w-9 h-9 rounded-xl bg-[#1B4D3E] flex items-center justify-center text-white shadow-xs group-hover:bg-[#153e32] transition">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-stone-900 group-hover:text-[#1B4D3E] transition">
                SecondLife
              </span>
              <span className="bg-stone-100 text-stone-600 text-[10px] font-semibold px-1.5 py-0.2 rounded border border-stone-200 tracking-wider">
                VERIFIED
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-normal hidden sm:block">
              {lang === 'vi' ? 'Sàn đồ cũ kiểm định & AI định giá' : 'Certified Recommerce & AI Valuation'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs - Clean desktop layout */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Home Tab */}
          <button
            onClick={() => onTabChange('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Trang Chủ' : 'Home'}</span>
          </button>

          <button
            onClick={() => onTabChange('marketplace')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'marketplace'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Sàn Đồ Cũ' : 'Marketplace'}</span>
          </button>

          <button
            onClick={() => onTabChange('create-listing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'create-listing'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Đăng Bán AI' : 'Post Listing'}</span>
          </button>

          <button
            onClick={() => onTabChange('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer relative ${
              activeTab === 'orders'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Đơn Hàng' : 'My Orders'}</span>
            {activeOrdersCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-[#1B4D3E] text-white rounded-full text-[10px] font-semibold">
                {activeOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('inspection-hub')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'inspection-hub'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Kiểm Định Hub' : 'Inspection'}</span>
          </button>

          <button
            onClick={() => onTabChange('admin-dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'admin-dashboard'
                ? 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 font-semibold shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-800" />
            <span>{lang === 'vi' ? 'Quản Trị' : 'Admin'}</span>
          </button>
        </nav>

        {/* Quick action buttons & Auth/User Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('chat')}
            className={`p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 relative transition cursor-pointer ${
              activeTab === 'chat' ? 'bg-emerald-50 text-emerald-900' : ''
            }`}
            title="Chat & Smart Negotiation"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          <button
            onClick={() => onTabChange('create-listing')}
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#1B4D3E] hover:bg-[#153e32] text-white px-3 py-1.5 rounded-xl font-medium text-xs shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đăng Bán' : 'Post Listing'}</span>
          </button>

          {/* User Account / Auth Buttons */}
          {currentUser ? (
            /* Logged in User Profile */
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-[11px] border border-emerald-300">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-stone-800 leading-tight truncate max-w-[110px]">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-emerald-800 font-medium">
                  {currentRole === 'buyer' && 'Verified Buyer'}
                  {currentRole === 'seller' && 'Top Rated (4.9★)'}
                  {currentRole === 'inspector' && 'Inspector'}
                  {currentRole === 'admin' && 'Supervisor'}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                title={lang === 'vi' ? 'Đăng xuất tài khoản' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Guest Auth Buttons */
            <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Nhập' : 'Login'}</span>
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Ký' : 'Register'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar - Compact & Clean on mobile only */}
      <div className="md:hidden border-t border-stone-200/80 bg-stone-50/95 px-3 py-1.5 flex items-center justify-around text-[11px] font-medium text-stone-600">
        <button
          onClick={() => onTabChange('home')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'home' ? 'text-emerald-900 font-semibold bg-emerald-50' : ''
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
        <button
          onClick={() => onTabChange('marketplace')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'marketplace' ? 'text-emerald-900 font-semibold bg-emerald-50' : ''
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Sàn</span>
        </button>
        <button
          onClick={() => onTabChange('create-listing')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'create-listing' ? 'text-emerald-900 font-semibold bg-emerald-50' : ''
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Đăng tin</span>
        </button>
        <button
          onClick={() => onTabChange('orders')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md relative ${
            activeTab === 'orders' ? 'text-emerald-900 font-semibold bg-emerald-50' : ''
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Đơn hàng</span>
          {activeOrdersCount > 0 && (
            <span className="w-1.5 h-1.5 bg-[#1B4D3E] rounded-full" />
          )}
        </button>
        <button
          onClick={() => onTabChange('admin-dashboard')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'admin-dashboard' ? 'text-emerald-900 font-semibold bg-emerald-50' : ''
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Admin</span>
        </button>
      </div>
    </header>
  );
};

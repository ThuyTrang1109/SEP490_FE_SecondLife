import React from 'react';
import { ShieldCheck, Sparkles, ShoppingBag, PlusCircle, Clock, Globe, Building2, ShieldAlert, MessageSquare, Home, LogIn, UserPlus, LogOut, Sun, Moon, Phone } from 'lucide-react';
import { UserRole, Language, ThemeMode } from '../../types';
import { translations } from '../../utils/translations';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  theme: ThemeMode;
  onThemeToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeOrdersCount: number;
  unreadChatsCount?: number;
  currentUser?: { id: string; name: string; email: string; role: UserRole } | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  theme,
  onThemeToggle,
  activeTab,
  onTabChange,
  activeOrdersCount,
  unreadChatsCount = 1,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenProfile
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 bg-[#0E121B] text-white shadow-xl border-b border-white/10 transition-all">
      {/* Top micro-bar */}
      <div className="bg-[#0B0E15] text-slate-200 text-[11px] px-4 sm:px-6 lg:px-8 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-bold text-white bg-gradient-to-r from-[#EC1577]/20 to-[#F1622A]/20 px-3 py-0.5 rounded-full border border-[#EC1577]/50 text-[11px] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
            AI & Escrow Verification
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-200 font-medium">
            {lang === 'vi'
              ? 'Bảo vệ tài chính qua Quỹ tín thác & Kiểm định chuyên gia SecondLife Hub'
              : 'Escrow buyer protection & Certified hardware inspection'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Customer Hotline & Support */}
          <div className="hidden sm:flex items-center gap-2 text-slate-300 px-2 py-0.5 text-[11px]">
            <a
              href="tel:19008899"
              className="flex items-center gap-1 hover:text-white transition"
              title="Tổng đài CSKH SecondLife"
            >
              <Phone className="w-3 h-3 text-[#EC1577]" />
              <span>Hotline: <strong className="text-white font-bold">1900 8899</strong></span>
            </a>
            <span className="text-white/20 hidden md:inline">|</span>
            <span className="hidden md:flex items-center gap-1 text-slate-300">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{lang === 'vi' ? 'Bảo lãnh Escrow' : 'Escrow Protected'}</span>
            </span>
          </div>

          {/* Theme Mode Toggle */}
          <button
            onClick={onThemeToggle}
            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/20 text-[11px] font-bold transition cursor-pointer shadow-xs"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="font-bold">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-300 fill-indigo-300" />
                <span className="font-bold">Dark</span>
              </>
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/20 text-[11px] font-bold transition cursor-pointer"
            title="Toggle Vietnamese / English"
          >
            <Globe className="w-3.5 h-3.5 text-slate-200" />
            <span className="font-extrabold uppercase">{lang}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => onTabChange('home')}
        >
          <img
            src="/logo.png"
            alt="SecondLife Logo"
            className="h-10 w-auto object-contain rounded-xl bg-white p-1 shadow-md shadow-black/20 group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight text-white group-hover:text-slate-100 transition">
                SecondLife
              </span>
              <span className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-[10px] font-black px-1.5 py-0.2 rounded shadow-xs border border-white/20 tracking-wider">
                VERIFIED
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium hidden sm:block">
              {lang === 'vi' ? 'Sàn đồ cũ kiểm định & AI định giá' : 'Certified Recommerce & AI Valuation'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => onTabChange('home')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                : 'text-slate-200 hover:text-white hover:bg-white/15'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Trang Chủ' : 'Home'}</span>
          </button>

          <button
            onClick={() => onTabChange('marketplace')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'marketplace'
                ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                : 'text-slate-200 hover:text-white hover:bg-white/15'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Sàn Đồ Cũ' : 'Marketplace'}</span>
          </button>

          {currentUser && currentRole === 'seller' && (
            <button
              onClick={() => onTabChange('seller-dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'seller-dashboard'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                  : 'text-slate-200 hover:text-white hover:bg-white/15'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Kênh Người Bán' : 'Seller Hub'}</span>
            </button>
          )}

          {currentUser && currentRole === 'seller' && (
            <button
              onClick={() => onTabChange('create-listing')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'create-listing'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                  : 'text-slate-200 hover:text-white hover:bg-white/15'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng Bán AI' : 'Post Listing'}</span>
            </button>
          )}

          {currentUser && (currentRole === 'buyer' || currentRole === 'seller' || currentRole === 'admin') && (
            <button
              onClick={() => onTabChange('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer relative ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                  : 'text-slate-200 hover:text-white hover:bg-white/15'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? (currentRole === 'buyer' ? 'Đơn Hàng Ký Quỹ' : 'Quản Lý Đơn') : 'Orders'}</span>
              {activeOrdersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-white text-[#0E121B] rounded-full text-[10px] font-extrabold shadow-xs">
                  {activeOrdersCount}
                </span>
              )}
            </button>
          )}

          {currentUser && (currentRole === 'inspector' || currentRole === 'admin') && (
            <button
              onClick={() => onTabChange('inspection-hub')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'inspection-hub'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                  : 'text-slate-200 hover:text-white hover:bg-white/15'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Kiểm Định Home Hub' : 'Inspection Hub'}</span>
            </button>
          )}

          {currentUser && currentRole === 'admin' && (
            <button
              onClick={() => onTabChange('admin-dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'admin-dashboard'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md shadow-[#EC1577]/30 font-extrabold'
                  : 'text-slate-200 hover:text-white hover:bg-white/15'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Quản Trị Admin' : 'Admin'}</span>
            </button>
          )}
        </nav>

        {/* Action buttons & Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('chat')}
            className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 relative transition cursor-pointer ${
              activeTab === 'chat' ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white' : ''
            }`}
            title="Chat & Smart Negotiation"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EC1577] rounded-full ring-2 ring-[#0E121B]"></span>
            )}
          </button>

          <button
            onClick={() => onTabChange('create-listing')}
            className="hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white px-3.5 py-2 rounded-xl font-extrabold text-xs shadow-md transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>{lang === 'vi' ? 'Đăng Bán' : 'Post Listing'}</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 text-left hover:opacity-85 transition cursor-pointer p-1 rounded-xl hover:bg-white/10"
                title={lang === 'vi' ? 'Xem hồ sơ người dùng' : 'View User Profile'}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center font-bold text-[11px] shadow-sm ring-1 ring-white/20">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-bold text-white leading-tight truncate max-w-[110px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {currentRole === 'buyer' && 'Verified Buyer'}
                    {currentRole === 'seller' && 'Top Rated (4.9★)'}
                    {currentRole === 'inspector' && 'Inspector'}
                    {currentRole === 'admin' && 'Supervisor'}
                  </div>
                </div>
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title={lang === 'vi' ? 'Đăng xuất tài khoản' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Nhập' : 'Login'}</span>
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white hover:opacity-95 transition cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Ký' : 'Register'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden border-t border-white/10 bg-[#0B0E15] px-3 py-1.5 flex items-center justify-around text-[11px] font-medium text-slate-400">
        <button
          onClick={() => onTabChange('home')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'home' ? 'text-white font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : ''
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Trang chủ' : 'Home'}</span>
        </button>
        <button
          onClick={() => onTabChange('marketplace')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === 'marketplace' ? 'text-white font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : ''
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Sàn đồ cũ' : 'Market'}</span>
        </button>

        {currentUser ? (
          <>
            {currentRole === 'seller' && (
              <button
                onClick={() => onTabChange('create-listing')}
                className={`flex items-center gap-1 py-1 px-2 rounded-md ${
                  activeTab === 'create-listing' ? 'text-white font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : ''
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng tin' : 'Post Listing'}</span>
              </button>
            )}
            <button
              onClick={() => onTabChange('orders')}
              className={`flex items-center gap-1 py-1 px-2 rounded-md relative ${
                activeTab === 'orders' ? 'text-white font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : ''
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đơn hàng' : 'Orders'}</span>
            </button>
            {currentRole === 'admin' ? (
              <button
                onClick={() => onTabChange('admin-dashboard')}
                className={`flex items-center gap-1 py-1 px-2 rounded-md ${
                  activeTab === 'admin-dashboard' ? 'text-white font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : ''
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-1 py-1 px-2 rounded-md hover:text-white"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center font-bold text-[9px]">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="truncate max-w-[60px]">{currentUser.name.split(' ')[0]}</span>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onOpenAuth('login')}
            className="flex items-center gap-1 py-1 px-2 rounded-md text-[#EC1577] hover:text-white font-bold"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đăng nhập' : 'Login'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

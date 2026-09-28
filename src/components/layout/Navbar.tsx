import React from 'react';
import { ShieldCheck, Sparkles, ShoppingBag, PlusCircle, Clock, Globe, Building2, ShieldAlert, MessageSquare, Home, LogIn, UserPlus, LogOut, Sun, Moon, Phone, Coins } from 'lucide-react';
import { UserRole, Language, ThemeMode, UserCredit } from '../../types';
import { translations } from '../../utils/translations';
import logoImg from '../../assets/logo.png';

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
  onOpenTopUp?: () => void;
  userCreditBalance?: number;
  userCredit?: UserCredit;
  onOpenSellerRegister?: () => void;
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
  onOpenProfile,
  onOpenTopUp,
  userCreditBalance = 100,
  userCredit,
  onOpenSellerRegister,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 bg-[#cea981] text-[#2b1d16] shadow-xl border-b border-black/10 transition-all">
      {/* Top micro-bar */}
      <div className="bg-[#cea981]/95 text-[#2b1d16] text-[11px] border-b border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="inline-flex items-center gap-1.5 font-black text-[#2b1d16] bg-white/40 px-2.5 py-0.5 rounded-full border border-[#2b1d16]/20 text-[11px] shadow-xs shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#2b1d16]" />
              AI & Escrow
            </span>
            <span className="hidden sm:inline text-[#2b1d16]/30 shrink-0">|</span>
            <span className="hidden md:inline text-[#2b1d16]/80 font-bold truncate">
              {lang === 'vi'
                ? 'Bảo vệ tài chính qua Quỹ tín thác & Kiểm định chuyên gia SecondLife Hub'
                : 'Escrow buyer protection & Certified hardware inspection'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Customer Hotline & Support */}
            <div className="hidden sm:flex items-center gap-2 text-[#2b1d16]/80 px-1 text-[11px]">
              <a
                href="tel:19008899"
                className="flex items-center gap-1 hover:text-[#2b1d16] transition"
                title="Tổng đài CSKH SecondLife"
              >
                <Phone className="w-3 h-3 text-[#2b1d16]" />
                <span>Hotline: <strong className="text-[#2b1d16] font-black">1900 8899</strong></span>
              </a>
              <span className="text-[#2b1d16]/20 hidden md:inline">|</span>
              <span className="hidden md:flex items-center gap-1 text-[#2b1d16] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                <span>{lang === 'vi' ? 'Bảo lãnh Escrow' : 'Escrow Protected'}</span>
              </span>
            </div>

            {/* Theme Mode Toggle */}
            <button
              onClick={onThemeToggle}
              className="flex items-center gap-1 px-2 py-0.5 bg-white/40 hover:bg-white/60 rounded-lg text-[#2b1d16] border border-[#2b1d16]/20 text-[11px] font-bold transition cursor-pointer shadow-xs"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3 h-3 text-amber-700 fill-amber-700" />
                  <span className="font-bold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3 h-3 text-indigo-900 fill-indigo-900" />
                  <span className="font-bold">Dark</span>
                </>
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
              className="flex items-center gap-1 px-2 py-0.5 bg-white/40 hover:bg-white/60 rounded-lg text-[#2b1d16] border border-[#2b1d16]/20 text-[11px] font-bold transition cursor-pointer shadow-xs"
              title="Toggle Vietnamese / English"
            >
              <Globe className="w-3 h-3 text-[#2b1d16]" />
              <span className="font-extrabold uppercase">{lang}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          onClick={() => onTabChange('home')}
        >
          <img
            src={logoImg}
            alt="SecondLife Logo"
            className="h-11 sm:h-12 w-auto object-contain group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-[#2b1d16] group-hover:text-black transition">
                SecondLife
              </span>
              <span className="bg-white text-[#2b1d16] text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs border border-[#2b1d16]/20 tracking-wider">
                VERIFIED
              </span>
            </div>
            <p className="text-[10px] text-[#2b1d16]/80 font-bold hidden sm:block">
              {lang === 'vi' ? 'Sàn đồ cũ kiểm định & AI' : 'Certified Recommerce & AI'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => onTabChange('home')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Trang Chủ' : 'Home'}</span>
          </button>

          <button
            onClick={() => onTabChange('marketplace')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'marketplace'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Sàn Đồ Cũ' : 'Marketplace'}</span>
          </button>

          {currentUser && currentRole === 'seller' && (
            <button
              onClick={() => onTabChange('seller-dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'seller-dashboard'
                  ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                  : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Kênh Người Bán' : 'Seller Hub'}</span>
            </button>
          )}

          {currentUser && currentRole === 'seller' && (
            <button
              onClick={() => onTabChange('create-listing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'create-listing'
                  ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                  : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng Bán AI' : 'Post Listing'}</span>
            </button>
          )}

          {currentUser && (currentRole === 'buyer' || currentRole === 'seller' || currentRole === 'admin') && (
            <button
              onClick={() => onTabChange('orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer relative ${
                activeTab === 'orders'
                  ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                  : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? (currentRole === 'buyer' ? 'Đơn Ký Quỹ' : 'Quản Lý Đơn') : 'Orders'}</span>
              {activeOrdersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-[#2b1d16] text-white rounded-full text-[10px] font-extrabold shadow-xs">
                  {activeOrdersCount}
                </span>
              )}
            </button>
          )}

          {currentUser && (currentRole === 'inspector' || currentRole === 'admin') && (
            <button
              onClick={() => onTabChange('inspection-hub')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'inspection-hub'
                  ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                  : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Kiểm Định Hub' : 'Inspection Hub'}</span>
            </button>
          )}

          {currentUser && currentRole === 'admin' && (
            <button
              onClick={() => onTabChange('admin-dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'admin-dashboard'
                  ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                  : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Quản Trị Admin' : 'Admin'}</span>
            </button>
          )}
        </nav>

        {/* Action buttons & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* TopUp Credits Badge Button */}
          {currentUser && (
            <button
              onClick={onOpenTopUp}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/70 hover:bg-white text-[#2b1d16] border border-[#2b1d16]/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title={lang === 'vi' ? 'Click để nạp thêm lượt đăng tin & lượt tư vấn AI' : 'Click to top up post & AI credits'}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2b1d16] shrink-0" />
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-[#2b1d16] font-extrabold">{userCredit?.postCredits ?? (userCreditBalance ?? 0)} {lang === 'vi' ? 'tin' : 'posts'}</span>
                <span className="text-[#2b1d16]/40">•</span>
                <span className="text-[#2b1d16] font-extrabold">{userCredit?.chatCredits ?? 15} AI</span>
              </div>
              <span className="text-[9px] px-1 py-0.2 bg-[#2b1d16] text-white rounded font-black leading-none ml-0.5">+</span>
            </button>
          )}

          {/* Chat Button */}
          <button
            onClick={() => onTabChange('chat')}
            className={`p-2 rounded-xl text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40 relative transition cursor-pointer ${
              activeTab === 'chat' ? 'bg-white text-[#2b1d16] shadow-sm' : ''
            }`}
            title="Chat & Smart Negotiation"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#2b1d16] rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {/* Post Listing Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                onTabChange('create-listing');
              } else if (currentRole !== 'seller') {
                if (onOpenSellerRegister) {
                  onOpenSellerRegister();
                } else {
                  onTabChange('create-listing');
                }
              } else {
                onTabChange('create-listing');
              }
            }}
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#2b1d16] hover:bg-[#3d2a20] text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-md transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>{lang === 'vi' ? 'Đăng Bán' : 'Post Listing'}</span>
          </button>

          {/* Profile User Badge */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#2b1d16]/20">
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 text-left hover:opacity-90 transition cursor-pointer p-1 rounded-xl hover:bg-white/40"
                title={lang === 'vi' ? 'Xem hồ sơ người dùng' : 'View User Profile'}
              >
                <div className="w-7 h-7 rounded-full bg-[#2b1d16] text-white flex items-center justify-center font-bold text-[11px] shadow-xs shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden 2xl:block text-left max-w-[100px]">
                  <div className="text-xs font-bold text-[#2b1d16] leading-tight truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[9px] text-[#2b1d16]/70 font-semibold truncate">
                    {currentRole === 'buyer' && 'Buyer'}
                    {currentRole === 'seller' && 'Seller'}
                    {currentRole === 'inspector' && 'Inspector'}
                    {currentRole === 'admin' && 'Admin'}
                  </div>
                </div>
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-[#2b1d16]/70 hover:text-[#2b1d16] hover:bg-white/40 transition cursor-pointer"
                title={lang === 'vi' ? 'Đăng xuất tài khoản' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#2b1d16]/20">
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2b1d16] hover:bg-white/40 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Nhập' : 'Login'}</span>
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-[#2b1d16] hover:bg-[#3d2a20] text-white transition cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng Ký' : 'Register'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden border-t border-[#2b1d16]/15 bg-[#cea981]/95 px-3 py-1.5 flex items-center justify-around text-[11px] font-medium text-[#2b1d16]">
        <button
          onClick={() => onTabChange('home')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'home' ? 'text-[#2b1d16] font-bold bg-white shadow-xs' : 'text-[#2b1d16]/80'
            }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Trang chủ' : 'Home'}</span>
        </button>
        <button
          onClick={() => onTabChange('marketplace')}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'marketplace' ? 'text-[#2b1d16] font-bold bg-white shadow-xs' : 'text-[#2b1d16]/80'
            }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Sàn đồ cũ' : 'Market'}</span>
        </button>

        {currentUser ? (
          <>
            {currentRole === 'seller' ? (
              <button
                onClick={() => onTabChange('create-listing')}
                className={`flex items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'create-listing' ? 'text-[#2b1d16] font-bold bg-white shadow-xs' : 'text-[#2b1d16]/80'
                  }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Đăng tin' : 'Post Listing'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onOpenSellerRegister) {
                    onOpenSellerRegister();
                  } else {
                    onTabChange('create-listing');
                  }
                }}
                className="flex items-center gap-1 py-1 px-2 rounded-md text-[#2b1d16]/80 hover:text-[#2b1d16]"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#2b1d16]" />
                <span>{lang === 'vi' ? 'Đăng tin' : 'Post Listing'}</span>
              </button>
            )}
            <button
              onClick={() => onTabChange('orders')}
              className={`flex items-center gap-1 py-1 px-2 rounded-md relative ${activeTab === 'orders' ? 'text-[#2b1d16] font-bold bg-white shadow-xs' : 'text-[#2b1d16]/80'
                }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đơn hàng' : 'Orders'}</span>
            </button>
            {currentRole === 'admin' ? (
              <button
                onClick={() => onTabChange('admin-dashboard')}
                className={`flex items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'admin-dashboard' ? 'text-[#2b1d16] font-bold bg-white shadow-xs' : 'text-[#2b1d16]/80'
                  }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-1 py-1 px-2 rounded-md text-[#2b1d16]/80 hover:text-[#2b1d16]"
              >
                <div className="w-4 h-4 rounded-full bg-[#2b1d16] text-white flex items-center justify-center font-bold text-[9px]">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="truncate max-w-[60px] text-[#2b1d16] font-bold">{currentUser.name.split(' ')[0]}</span>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onOpenAuth('login')}
            className="flex items-center gap-1 py-1 px-2 rounded-md text-[#2b1d16] hover:bg-white/40 font-bold"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đăng nhập' : 'Login'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

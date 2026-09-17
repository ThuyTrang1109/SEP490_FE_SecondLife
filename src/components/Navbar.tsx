import React from 'react';
import { ShieldCheck, Sparkles, ShoppingBag, PlusCircle, Clock, Search, Globe, UserCheck, AlertCircle, Building2, ShieldAlert, MessageSquare } from 'lucide-react';
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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  activeTab,
  onTabChange,
  activeOrdersCount,
  unreadChatsCount = 1
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top micro-bar: Role Switcher & System notice */}
      <div className="bg-slate-900 text-slate-200 text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700/60 text-[11px] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            AI & Escrow Protection
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden md:inline text-slate-300 font-medium">
            {t.knowFairPrice}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Role selector dropdown/pills */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 text-[10px] uppercase font-bold px-1.5">
              {lang === 'vi' ? 'Vai trò:' : 'Role:'}
            </span>
            <button
              onClick={() => onRoleChange('buyer')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition-all font-bold ${currentRole === 'buyer' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
            >
              Người Mua
            </button>
            <button
              onClick={() => onRoleChange('seller')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition-all font-bold ${currentRole === 'seller' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
            >
              Người Bán
            </button>
            <button
              onClick={() => onRoleChange('inspector')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition-all font-bold ${currentRole === 'inspector' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
            >
              Kỹ Sư Hub
            </button>
            <button
              onClick={() => onRoleChange('admin')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition-all font-bold ${currentRole === 'admin' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
            >
              Quản Trị
            </button>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 border border-slate-700/80 transition"
            title="Toggle Vietnamese / English"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold uppercase text-xs">{lang}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('marketplace')}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/25">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight text-slate-900">SecondLife</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-300">
                VERIFIED
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {lang === 'vi' ? 'Sàn đồ cũ kiểm định & AI định giá' : 'AI Pricing & Inspected Marketplace'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1.5">
          <button
            onClick={() => onTabChange('marketplace')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'marketplace'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>{t.navMarketplace}</span>
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-md font-extrabold tracking-wider">
              3D
            </span>
          </button>

          <button
            onClick={() => onTabChange('create-listing')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'create-listing'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            {t.navCreateListing}
          </button>

          <button
            onClick={() => onTabChange('orders')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative ${activeTab === 'orders'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <Clock className="w-4 h-4 text-teal-600" />
            {t.navMyOrders}
            {activeOrdersCount > 0 && (
              <span className="ml-0.5 px-2 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold shadow-xs">
                {activeOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('inspection-hub')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'inspection-hub'
                ? 'bg-blue-50 text-blue-800 border border-blue-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            {t.navInspectionHub}
          </button>

          <button
            onClick={() => onTabChange('admin-dashboard')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'admin-dashboard'
                ? 'bg-purple-50 text-purple-800 border border-purple-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            {t.navAdminDashboard}
          </button>
        </nav>

        {/* Quick action buttons & User Profile */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onTabChange('chat')}
            className={`p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative transition ${activeTab === 'chat' ? 'bg-emerald-50 text-emerald-700' : ''
              }`}
            title="Chat & Smart Negotiation"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          <button
            onClick={() => onTabChange('create-listing')}
            className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-semibold text-sm shadow-sm transition hover:shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Đăng Bán + AI' : 'Post Listing'}</span>
          </button>

          {/* Current User Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-300">
              {currentRole === 'buyer' && 'KH'}
              {currentRole === 'seller' && 'TN'}
              {currentRole === 'inspector' && 'KD'}
              {currentRole === 'admin' && 'AD'}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {currentRole === 'buyer' && 'Hoàng Khang'}
                {currentRole === 'seller' && 'Minh Tuấn'}
                {currentRole === 'inspector' && 'KTV Hải Đăng'}
                {currentRole === 'admin' && 'Admin Điều Hành'}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                {currentRole === 'buyer' && 'Verified Buyer'}
                {currentRole === 'seller' && 'Top Rated Seller (4.9★)'}
                {currentRole === 'inspector' && 'Senior Inspector'}
                {currentRole === 'admin' && 'System Supervisor'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav Drawer / Quick bar */}
      <div className="lg:hidden border-t border-slate-100 bg-slate-50/90 px-4 py-2 flex items-center justify-around text-xs font-medium text-slate-600">
        <button
          onClick={() => onTabChange('marketplace')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'marketplace' ? 'text-emerald-600 font-bold' : ''}`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Sàn</span>
        </button>
        <button
          onClick={() => onTabChange('create-listing')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'create-listing' ? 'text-emerald-600 font-bold' : ''}`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Đăng Bán</span>
        </button>
        <button
          onClick={() => onTabChange('orders')}
          className={`flex flex-col items-center gap-1 relative ${activeTab === 'orders' ? 'text-emerald-600 font-bold' : ''}`}
        >
          <Clock className="w-4 h-4" />
          <span>Đơn Hàng</span>
          {activeOrdersCount > 0 && (
            <span className="absolute -top-1 right-2 w-2 h-2 bg-emerald-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => onTabChange('inspection-hub')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'inspection-hub' ? 'text-blue-600 font-bold' : ''}`}
        >
          <Building2 className="w-4 h-4" />
          <span>Kiểm Định</span>
        </button>
        <button
          onClick={() => onTabChange('admin-dashboard')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'admin-dashboard' ? 'text-purple-600 font-bold' : ''}`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Admin</span>
        </button>
      </div>
    </header>
  );
};

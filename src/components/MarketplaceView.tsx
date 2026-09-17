import React, { useState, useMemo } from 'react';
import { Search, Filter, ShieldCheck, Sparkles, MapPin, Star, Tag, CheckCircle2, ChevronRight, ArrowUpDown, Clock, AlertTriangle, Box, Eye, X } from 'lucide-react';
import { Listing, ItemCategory, ConditionGrade, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ShowroomLobby3D } from './ShowroomLobby3D';
import { ProductCard3D } from './ProductCard3D';
import { ProductViewer3D } from './ProductViewer3D';
import { soundFx } from '../utils/soundEffects';

interface MarketplaceViewProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  lang: Language;
  onPostClick: () => void;
}

const CATEGORIES: { id: ItemCategory | 'ALL'; nameVi: string; nameEn: string; icon: string }[] = [
  { id: 'ALL', nameVi: 'Tất cả danh mục', nameEn: 'All Categories', icon: '✨' },
  { id: 'Smartphones', nameVi: 'Điện thoại', nameEn: 'Smartphones', icon: '📱' },
  { id: 'Laptops & Computers', nameVi: 'Laptop & Máy tính', nameEn: 'Laptops & PC', icon: '💻' },
  { id: 'Cameras & Lens', nameVi: 'Máy ảnh & Ống kính', nameEn: 'Cameras & Lenses', icon: '📷' },
  { id: 'Watches & Smartwatches', nameVi: 'Đồng hồ thông minh', nameEn: 'Watches', icon: '⌚' },
  { id: 'Luxury & Bags', nameVi: 'Túi xách & Hàng hiệu', nameEn: 'Luxury & Bags', icon: '👜' },
  { id: 'Audio & Headphones', nameVi: 'Tai nghe & Âm thanh', nameEn: 'Audio', icon: '🎧' },
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  listings,
  onSelectListing,
  lang,
  onPostClick
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<ConditionGrade | 'ALL'>('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'priceAsc' | 'priceDesc' | 'newest'>('newest');
  const [viewer3DListing, setViewer3DListing] = useState<Listing | null>(null);

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesGrade = selectedGrade === 'ALL' || item.conditionGrade === selectedGrade;
      const matchesVerified = !verifiedOnly || item.isInspectionGuaranteed;

      return matchesSearch && matchesCat && matchesGrade && matchesVerified;
    }).sort((a, b) => {
      if (sortBy === 'priceAsc') return a.priceVnd - b.priceVnd;
      if (sortBy === 'priceDesc') return b.priceVnd - a.priceVnd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [listings, searchQuery, selectedCategory, selectedGrade, verifiedOnly, sortBy]);

  return (
    <div className="space-y-8 pb-16">
      {/* 3D Motion Showroom & Video Lobby */}
      <ShowroomLobby3D
        lang={lang}
        onExplore3DProduct={() => {
          setViewer3DListing(filteredListings[0] || listings[0]);
        }}
      />

      {/* 3D Inspection Viewer Modal Popup */}
      {viewer3DListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="max-w-4xl w-full max-h-[92vh] flex flex-col my-auto relative">
            <ProductViewer3D
              listing={viewer3DListing}
              lang={lang}
              onClose={() => setViewer3DListing(null)}
            />
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-11 pr-10 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-2xl border border-slate-200/90 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-200/80 hover:bg-slate-200 px-2 py-1 rounded-full"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Condition Grade Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline mr-1">
              Tình trạng:
            </span>
            {(['ALL', 'Like New', 'Good', 'Fair'] as const).map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${selectedGrade === grade
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                  }`}
              >
                {grade === 'ALL'
                  ? (lang === 'vi' ? 'Tất cả' : 'All')
                  : grade === 'Like New'
                    ? t.gradeLikeNew
                    : grade === 'Good'
                      ? t.gradeGood
                      : t.gradeFair}
              </button>
            ))}

            {/* Verified Inspection Only Toggle */}
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${verifiedOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <ShieldCheck className={`w-4 h-4 ${verifiedOnly ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{lang === 'vi' ? 'Có Kiểm Định Hub' : 'Inspected Hub'}</span>
            </button>
          </div>
        </div>

        {/* Category horizontal scrolling chips */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-sm">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition text-xs font-bold border ${isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-102'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                  }`}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{lang === 'vi' ? cat.nameVi : cat.nameEn}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Listings Grid Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {lang === 'vi' ? 'Sản Phẩm Đang Niêm Yết' : 'Active Listings'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {lang === 'vi'
              ? `Hiển thị ${filteredListings.length} sản phẩm đã qua xác thực & bảo lãnh Escrow`
              : `Showing ${filteredListings.length} items with Escrow buyer protection`}
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-4 h-4 text-emerald-600" />
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden shadow-xs cursor-pointer"
          >
            <option value="newest">{lang === 'vi' ? 'Mới đăng nhất' : 'Newest'}</option>
            <option value="priceAsc">{lang === 'vi' ? 'Giá thấp đến cao' : 'Price: Low to High'}</option>
            <option value="priceDesc">{lang === 'vi' ? 'Giá cao đến thấp' : 'Price: High to Low'}</option>
          </select>
        </div>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800">
            {lang === 'vi' ? 'Không tìm thấy sản phẩm phù hợp' : 'No listings found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {lang === 'vi'
              ? 'Hãy thử bỏ bớt bộ lọc hoặc tìm kiếm bằng từ khóa khác như "iPhone", "MacBook", "Sony"...'
              : 'Try clearing some filters or searching for "iPhone", "MacBook", "Sony"...'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedGrade('ALL');
              setVerifiedOnly(false);
            }}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
          >
            {lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset all filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <ProductCard3D
              key={item.id}
              item={item}
              lang={lang}
              onSelectListing={onSelectListing}
              onOpen3DViewer={(itm) => setViewer3DListing(itm)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

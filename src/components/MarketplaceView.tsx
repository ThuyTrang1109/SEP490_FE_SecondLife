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
  { id: 'ALL', nameVi: 'Tất cả sản phẩm', nameEn: 'All Categories', icon: '✦' },
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
    <div className="space-y-6 pb-16">
      {/* 3D Motion Showroom Studio */}
      <ShowroomLobby3D
        lang={lang}
        onExplore3DProduct={() => {
          setViewer3DListing(filteredListings[0] || listings[0]);
        }}
      />

      {/* 3D Inspection Viewer Modal Popup */}
      {viewer3DListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="max-w-4xl w-full max-h-[92vh] flex flex-col my-auto relative">
            <ProductViewer3D
              listing={viewer3DListing}
              lang={lang}
              onClose={() => setViewer3DListing(null)}
            />
          </div>
        </div>
      )}

      {/* Unified Search & Category Bar */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-3.5">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'vi' ? 'Tìm kiếm iPhone 15 Pro, MacBook, Sony A7 IV, Gucci, Apple Watch...' : 'Search for iPhone 15, MacBook, Sony, Gucci...'}
            className="w-full pl-10 pr-10 py-2.5 bg-stone-50/70 hover:bg-stone-50 focus:bg-white rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E] transition shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-stone-400 hover:text-stone-700 bg-stone-200/70 px-2 py-0.5 rounded-md cursor-pointer"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition text-xs font-medium cursor-pointer border ${
                  isSelected
                    ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-2xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200/70 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{lang === 'vi' ? cat.nameVi : cat.nameEn}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter & Sort Bar above grid */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
            {lang === 'vi' ? 'Danh Sách Sản Phẩm Niêm Yết' : 'Active Listings'}
          </h2>
          <p className="text-[11px] text-stone-500 font-normal">
            {lang === 'vi'
              ? `${filteredListings.length} sản phẩm sẵn sàng giao dịch & kiểm định bảo lãnh Escrow`
              : `${filteredListings.length} verified items with Escrow protection`}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Condition Filter */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/70">
            {(['ALL', 'Like New', 'Good', 'Fair'] as const).map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all font-medium cursor-pointer ${
                  selectedGrade === grade
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {grade === 'ALL'
                  ? (lang === 'vi' ? 'Tất cả' : 'All')
                  : grade === 'Like New'
                    ? 'Như mới'
                    : grade === 'Good'
                      ? 'Tốt'
                      : 'Khá'}
              </button>
            ))}
          </div>

          {/* Hub Verified Toggle */}
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition border cursor-pointer ${
              verifiedOnly
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifiedOnly ? 'text-emerald-700' : 'text-stone-400'}`} />
            <span>{lang === 'vi' ? 'Có Kiểm Định Hub' : 'Inspected Hub'}</span>
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-stone-700 text-[11px]">
            <ArrowUpDown className="w-3 h-3 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-stone-800 text-[11px] font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="newest">{lang === 'vi' ? 'Mới đăng nhất' : 'Newest'}</option>
              <option value="priceAsc">{lang === 'vi' ? 'Giá thấp đến cao' : 'Price: Low to High'}</option>
              <option value="priceDesc">{lang === 'vi' ? 'Giá cao đến thấp' : 'Price: High to Low'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-stone-200/80 space-y-3">
          <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-stone-800 text-sm">
            {lang === 'vi' ? 'Không tìm thấy sản phẩm phù hợp' : 'No listings found'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {lang === 'vi'
              ? 'Hãy thử điều chỉnh bộ lọc hoặc tìm kiếm tên thiết bị khác.'
              : 'Try clearing some filters or searching for another keyword.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedGrade('ALL');
              setVerifiedOnly(false);
            }}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 underline cursor-pointer"
          >
            {lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset all filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

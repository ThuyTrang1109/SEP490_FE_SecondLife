import React, { useState, useMemo } from 'react';
import { Search, ShieldCheck, ArrowUpDown } from 'lucide-react';
import { Listing, ItemCategory, ConditionGrade, Language } from '../types';
import { translations } from '../utils/translations';
import { ShowroomLobby3D } from '../components/3d/ShowroomLobby3D';
import { ProductCard3D } from '../components/3d/ProductCard3D';

interface MarketplaceViewProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  lang: Language;
  onPostClick: () => void;
}

const CATEGORIES: { id: ItemCategory | 'ALL'; nameVi: string; nameEn: string; icon: string }[] = [
  { id: 'ALL', nameVi: 'Tất cả đồ gia dụng', nameEn: 'All Home Goods', icon: '🏠' },
  { id: 'Tủ lạnh & Tủ đông', nameVi: 'Tủ lạnh & Tủ đông', nameEn: 'Refrigerators', icon: '🧊' },
  { id: 'Máy giặt & Máy sấy', nameVi: 'Máy giặt & Máy sấy', nameEn: 'Washing Machines', icon: '🧺' },
  { id: 'Điều hòa & Máy lọc', nameVi: 'Điều hòa & Máy lọc', nameEn: 'Air Conditioners', icon: '❄️' },
  { id: 'Robot & Máy hút bụi', nameVi: 'Robot & Hút bụi', nameEn: 'Robot Vacuums', icon: '🧹' },
  { id: 'Lò vi sóng & Lò nướng', nameVi: 'Lò vi sóng & Lò nướng', nameEn: 'Microwaves & Ovens', icon: '🍲' },
  { id: 'Nồi cơm & Bếp từ', nameVi: 'Nồi cơm & Bếp từ', nameEn: 'Rice Cookers & Stoves', icon: '🍳' },
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  listings,
  onSelectListing,
  lang,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<ConditionGrade | 'ALL'>('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'priceAsc' | 'priceDesc' | 'newest'>('newest');

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
    <div className="space-y-6 pb-16 text-[#24263e]">
      {/* 3D Motion Showroom Studio */}
      <ShowroomLobby3D lang={lang} />


      {/* Unified Search & Category Bar */}
      <section className="bg-[#FFFFFF] rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 space-y-3.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'vi' ? 'Tìm kiếm Tủ lạnh Hitachi, Máy giặt LG AI, Điều hòa Daikin, Robot Ecovacs, Nồi cơm Cuckoo...' : 'Search for Hitachi Refrigerator, LG Washer, Daikin AC, Ecovacs Robot...'}
            className="w-full pl-10 pr-10 py-2.5 bg-[#faf8f5] rounded-xl border border-slate-200 text-xs sm:text-sm text-[#24263e] placeholder-slate-400 focus:outline-none focus:border-[#c34c36] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 hover:text-[#24263e] bg-[#FFFFFF] px-2 py-0.5 rounded-md cursor-pointer border border-slate-200"
            >
              {lang === 'vi' ? 'Xóa' : 'Clear'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition text-xs font-bold cursor-pointer border ${
                  isSelected
                    ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                    : 'bg-[#faf8f5] text-[#24263e]/75 border-slate-200 hover:bg-[#FFFFFF] hover:text-[#24263e]'
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
          <h2 className="text-base sm:text-lg font-bold text-[#24263e] tracking-tight">
            {lang === 'vi' ? 'Danh Sách Sản Phẩm Niêm Yết' : 'Active Listings'}
          </h2>
          <p className="text-[11px] text-[#24263e]/70 font-normal">
            {lang === 'vi'
              ? `${filteredListings.length} sản phẩm sẵn sàng giao dịch & kiểm định bảo lãnh Escrow`
              : `${filteredListings.length} verified items with Escrow protection`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center bg-[#FFFFFF] p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'Like New', 'Good', 'Fair'] as const).map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                  selectedGrade === grade
                    ? 'bg-[#24263e] text-white font-black'
                    : 'text-[#24263e]/75 hover:text-[#24263e] font-medium'
                }`}
              >
                {grade === 'ALL'
                  ? (lang === 'vi' ? 'Tất cả' : 'All')
                  : grade === 'Like New'
                  ? (lang === 'vi' ? 'Như mới' : 'Like New')
                  : grade === 'Good'
                  ? (lang === 'vi' ? 'Tốt' : 'Good')
                  : (lang === 'vi' ? 'Khá' : 'Fair')}
              </button>
            ))}
          </div>

          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
              verifiedOnly
                ? 'bg-[#24263e] text-white border-[#24263e]'
                : 'bg-[#FFFFFF] text-[#24263e]/75 border-slate-200 hover:bg-[#faf8f5]'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifiedOnly ? 'text-white' : 'text-[#24263e]'}`} />
            <span>{lang === 'vi' ? 'Có Kiểm Định Hub' : 'Inspected Hub'}</span>
          </button>

          <div className="flex items-center gap-1 bg-[#FFFFFF] border border-slate-200 rounded-lg px-2.5 py-1 text-[#24263e] text-[11px]">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-[#24263e] text-[11px] font-medium focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-[#FFFFFF] text-[#24263e]">{lang === 'vi' ? 'Mới đăng nhất' : 'Newest'}</option>
              <option value="priceAsc" className="bg-[#FFFFFF] text-[#24263e]">{lang === 'vi' ? 'Giá thấp đến cao' : 'Price: Low to High'}</option>
              <option value="priceDesc" className="bg-[#FFFFFF] text-[#24263e]">{lang === 'vi' ? 'Giá cao đến thấp' : 'Price: High to Low'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#faf8f5] text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-[#24263e] text-sm">
            {lang === 'vi' ? 'Không tìm thấy sản phẩm phù hợp' : 'No listings found'}
          </h3>
          <p className="text-xs text-[#24263e]/70 max-w-sm mx-auto">
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
            className="text-xs font-semibold text-[#24263e] underline cursor-pointer"
          >
            {lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset all filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {filteredListings.map((item) => (
            <ProductCard3D
              key={item.id}
              item={item}
              lang={lang}
              onSelectListing={onSelectListing}
            />
          ))}
        </div>
      )}
    </div>
  );
};

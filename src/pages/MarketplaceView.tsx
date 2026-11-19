import React, { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  LayoutGrid,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { CategoryBackend, Language, Listing } from '../types';
import { categoryService } from '../services/categoryService';
import { postService } from '../services/postService';
import type {
  MarketplaceCondition,
  MarketplacePost,
  MarketplaceSearchPage,
  MarketplaceSearchQuery,
  MarketplaceSort,
} from '../services/postService';
import { ShowroomLobby3D } from '../components/3d/ShowroomLobby3D';
import { ProductCard3D } from '../components/3d/ProductCard3D';

interface MarketplaceViewProps {
  mapListing: (post: MarketplacePost) => Listing;
  onSelectListing: (listing: Listing) => void;
  lang: Language;
  refreshVersion: number;
}

const PAGE_SIZE = 20;
const INITIAL_QUERY: MarketplaceSearchQuery = { sort: 'newest', page: 0, size: PAGE_SIZE };
const SLIDER_MIN = 0;
const SLIDER_MAX = 100_000_000;
const SLIDER_STEP = 500_000;

const formatPriceVND = (price: number) => {
  return price.toLocaleString('vi-VN') + ' ₫';
};

const EMPTY_FILTERS = {
  q: '',
  categoryId: '',
  brand: '',
  condition: '' as MarketplaceCondition | '',
  minPrice: SLIDER_MIN,
  maxPrice: SLIDER_MAX,
  location: '',
  inspected: false,
};
const CONDITIONS: { value: MarketplaceCondition; vi: string; en: string; legacy?: string[] }[] = [
  { value: 'NEW', vi: 'Mới', en: 'New', legacy: ['BRAND NEW', 'MỚI'] },
  { value: 'LIKE_NEW', vi: 'Như mới', en: 'Like new', legacy: ['LIKE NEW', 'LIKE-NEW', 'NHƯ MỚI'] },
  { value: 'USED_GOOD', vi: 'Tốt', en: 'Good', legacy: ['GOOD', 'TỐT'] },
  { value: 'USED_FAIR', vi: 'Khá', en: 'Fair', legacy: ['FAIR', 'KHÁ'] },
  { value: 'USED', vi: 'Đã qua sử dụng', en: 'Used' },
];
const INPUT_CLASS = 'w-full min-w-0 rounded-xl border border-slate-200 bg-[#faf8f5] px-3 py-2 text-xs sm:text-sm font-medium text-[#24263e] hover:border-slate-300 focus:bg-white focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 focus:outline-none transition-all';

export function MarketplaceView({ mapListing, onSelectListing, lang, refreshVersion }: MarketplaceViewProps) {
  const vi = lang === 'vi';
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [categories, setCategories] = useState<CategoryBackend[]>();
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [result, setResult] = useState<MarketplaceSearchPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setCategoriesFailed(false);
    void categoryService.getCategories().then((items) => {
      if (!Array.isArray(items)) throw new Error('Invalid category response');
      if (active) setCategories([...items].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    }).catch(() => {
      if (active) setCategoriesFailed(true);
    });
    return () => { active = false; };
  }, [categoryRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setFailed(false);
    void postService.searchPublicListings(query, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(0, data.totalPages - 1);
      if (query.page > lastPage) {
        setQuery((current) => current === query ? { ...query, page: lastPage } : current);
        return;
      }
      setResult(data);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [query, revision, refreshVersion]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === 'secondlife_order_placed_signal' || event.key?.startsWith('listing_available_')) refresh();
    };
    window.addEventListener('storage', refreshFromStorage);
    window.addEventListener('secondlife_listing_status_changed', refresh);
    window.addEventListener('secondlife_inspection_completed', refresh);
    return () => {
      window.removeEventListener('storage', refreshFromStorage);
      window.removeEventListener('secondlife_listing_status_changed', refresh);
      window.removeEventListener('secondlife_inspection_completed', refresh);
    };
  }, []);

  const updateFilter = <Key extends keyof typeof EMPTY_FILTERS>(key: Key, value: typeof EMPTY_FILTERS[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleMinPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(event.target.value), filters.maxPrice - SLIDER_STEP);
    updateFilter('minPrice', Math.max(SLIDER_MIN, value));
  };

  const handleMaxPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(event.target.value), filters.minPrice + SLIDER_STEP);
    updateFilter('maxPrice', Math.min(SLIDER_MAX, value));
  };

  const minPercent = Math.min(100, Math.max(0, ((filters.minPrice - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));
  const maxPercent = Math.min(100, Math.max(0, ((filters.maxPrice - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));

  // Tự động tìm kiếm tức thì với Debounce 280ms khi người dùng thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    const timer = setTimeout(() => {
      const minPrice = filters.minPrice > SLIDER_MIN ? filters.minPrice : undefined;
      const maxPrice = filters.maxPrice < SLIDER_MAX ? filters.maxPrice : undefined;
      const trimmedQ = filters.q.trim() || undefined;
      const trimmedBrand = filters.brand.trim() || undefined;
      const trimmedLocation = filters.location.trim() || undefined;
      const selectedCategory = filters.categoryId || undefined;
      const selectedCondition = filters.condition || undefined;
      const isInspected = filters.inspected ? true : undefined;

      setQuery((prev) => {
        if (
          prev.q === trimmedQ &&
          prev.categoryId === selectedCategory &&
          prev.brand === trimmedBrand &&
          prev.condition === selectedCondition &&
          prev.minPrice === minPrice &&
          prev.maxPrice === maxPrice &&
          prev.location === trimmedLocation &&
          prev.inspected === isInspected &&
          prev.page === 0
        ) {
          return prev;
        }

        return {
          ...prev,
          page: 0,
          q: trimmedQ,
          categoryId: selectedCategory,
          brand: trimmedBrand,
          condition: selectedCondition,
          minPrice,
          maxPrice,
          location: trimmedLocation,
          inspected: isInspected,
        };
      });
    }, 280);

    return () => clearTimeout(timer);
  }, [filters]);

  const applyFilters = (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const minPrice = filters.minPrice > SLIDER_MIN ? filters.minPrice : undefined;
    const maxPrice = filters.maxPrice < SLIDER_MAX ? filters.maxPrice : undefined;

    setQuery((current) => ({
      ...INITIAL_QUERY,
      sort: current.sort,
      q: filters.q.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      brand: filters.brand.trim() || undefined,
      condition: filters.condition || undefined,
      minPrice,
      maxPrice,
      location: filters.location.trim() || undefined,
      inspected: filters.inspected ? true : undefined,
    }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQuery({ ...INITIAL_QUERY });
  };

  const loading = !result && !failed;
  const conditionLabel = (condition?: string) => {
    const value = condition?.trim().toUpperCase() ?? '';
    const match = CONDITIONS.find((option) => option.value === value || option.legacy?.includes(value));
    return match ? (vi ? match.vi : match.en) : condition?.trim();
  };

  return (
    <div className="space-y-6 pb-16 text-[#24263e]">
      <ShowroomLobby3D lang={lang} />

      <form onSubmit={applyFilters} className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        {/* 1. Primary Keyword Search */}
        <div className="space-y-1.5">
          <label htmlFor="marketplace-search-input" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            {vi ? 'Tìm kiếm sản phẩm' : 'Search products'}
          </label>
          <div className="relative flex items-center">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#c34c36]" />
            <input
              id="marketplace-search-input"
              type="search"
              maxLength={150}
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
              placeholder={vi ? 'Nhập tên thiết bị, model, thương hiệu hoặc từ khóa...' : 'Device name, model, brand or keyword...'}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-[#faf8f5] pl-10 pr-9 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-[#24263e] placeholder:text-slate-400 hover:border-slate-300 focus:bg-white focus:border-[#c34c36] focus:ring-4 focus:ring-[#c34c36]/10 focus:outline-none transition-all shadow-inner"
            />
            {filters.q && (
              <button
                type="button"
                onClick={() => updateFilter('q', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
                title={vi ? 'Xóa từ khóa' : 'Clear keyword'}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Structured Filters Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Danh mục */}
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="size-3.5 text-slate-400" />
              <span>{vi ? 'Danh mục' : 'Category'}</span>
            </span>
            <div className="relative">
              <select
                value={filters.categoryId}
                disabled={!categories}
                onChange={(event) => updateFilter('categoryId', event.target.value)}
                className={`${INPUT_CLASS} appearance-none pr-8 cursor-pointer disabled:opacity-60`}
              >
                <option value="">{vi ? 'Tất cả danh mục' : 'All categories'}</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>

          {/* Thương hiệu */}
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Tag className="size-3.5 text-slate-400" />
              <span>{vi ? 'Thương hiệu' : 'Brand'}</span>
            </span>
            <input
              maxLength={120}
              value={filters.brand}
              onChange={(event) => updateFilter('brand', event.target.value)}
              placeholder={vi ? 'Ví dụ: LG, Panasonic, Sony...' : 'E.g. LG, Panasonic, Sony...'}
              className={INPUT_CLASS}
            />
          </label>

          {/* Tình trạng */}
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-slate-400" />
              <span>{vi ? 'Tình trạng' : 'Condition'}</span>
            </span>
            <div className="relative">
              <select
                value={filters.condition}
                onChange={(event) => updateFilter('condition', event.target.value as typeof filters.condition)}
                className={`${INPUT_CLASS} appearance-none pr-8 cursor-pointer`}
              >
                <option value="">{vi ? 'Mọi tình trạng' : 'Any condition'}</option>
                {CONDITIONS.map(({ value, vi: labelVi, en }) => (
                  <option key={value} value={value}>
                    {vi ? labelVi : en}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>

          {/* Thanh trượt khoảng giá (chiếm 2 cột) */}
          <div className="sm:col-span-2 space-y-2 rounded-2xl border border-slate-200 bg-[#faf8f5] px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <CircleDollarSign className="size-3.5 text-[#c34c36]" />
                <span>{vi ? 'Khoảng giá' : 'Price range'}</span>
              </span>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#c34c36] bg-white px-2.5 py-1 rounded-lg border border-slate-200/90 shadow-2xs">
                <span>{formatPriceVND(filters.minPrice)}</span>
                <span className="text-slate-400 font-normal">→</span>
                <span>
                  {filters.maxPrice >= SLIDER_MAX
                    ? (vi ? '100.000.000 ₫ (Tối đa)' : '100,000,000 ₫ (Max)')
                    : formatPriceVND(filters.maxPrice)}
                </span>
              </div>
            </div>

            {/* Dual Slider Track Container */}
            <div className="relative flex items-center py-2.5">
              {/* Background Gray Track */}
              <div className="w-full h-2 rounded-full bg-slate-200" />

              {/* Highlight Track */}
              <div
                className="absolute h-2 rounded-full bg-gradient-to-r from-[#c34c36] to-[#e0634c]"
                style={{
                  left: `${minPercent}%`,
                  width: `${Math.max(0, maxPercent - minPercent)}%`,
                }}
              />

              {/* Min Thumb */}
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={filters.minPrice}
                onChange={handleMinPriceChange}
                aria-label={vi ? 'Giá tối thiểu' : 'Minimum price'}
                className={`pointer-events-none absolute w-full h-2 appearance-none bg-transparent ${filters.minPrice > SLIDER_MAX * 0.9 ? 'z-30' : 'z-10'
                  } focus:z-30 active:z-30
                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#c34c36] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:hover:scale-115 [&::-webkit-slider-thumb]:transition-transform
                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#c34c36] [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:active:cursor-grabbing`}
              />

              {/* Max Thumb */}
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={filters.maxPrice}
                onChange={handleMaxPriceChange}
                aria-label={vi ? 'Giá tối đa' : 'Maximum price'}
                className="pointer-events-none absolute w-full h-2 appearance-none bg-transparent z-20 focus:z-30 active:z-30
                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#c34c36] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:hover:scale-115 [&::-webkit-slider-thumb]:transition-transform
                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#c34c36] [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:active:cursor-grabbing"
              />
            </div>

            {/* Scale Markers */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-0.5">
              <span>0 ₫</span>
              <span>25 triệu</span>
              <span>50 triệu</span>
              <span>75 triệu</span>
              <span>100 triệu ₫</span>
            </div>
          </div>

          {/* Vị trí - CHỈ CHO CHỌN TP. HCM VÀ HÀ NỘI */}
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5 text-[#c34c36]">
              <MapPin className="size-3.5 text-[#c34c36]" />
              <span>{vi ? 'Vị trí (Khu vực)' : 'Location'}</span>
            </span>
            <div className="relative">
              <select
                value={filters.location}
                onChange={(event) => updateFilter('location', event.target.value)}
                className={`${INPUT_CLASS} appearance-none pr-8 cursor-pointer font-semibold text-slate-800`}
              >
                <option value="">{vi ? 'Tất cả vị trí (Toàn quốc)' : 'All locations (Nationwide)'}</option>
                <option value="Hồ Chí Minh">{vi ? 'TP. Hồ Chí Minh' : 'Ho Chi Minh City'}</option>
                <option value="Hà Nội">{vi ? 'Hà Nội' : 'Ha Noi'}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
        </div>

        {categoriesFailed && (
          <p role="alert" className="text-xs text-rose-700 font-semibold">
            {vi ? 'Không tải được danh mục.' : 'Could not load categories.'}{' '}
            <button type="button" onClick={() => setCategoryRetry((value) => value + 1)} className="cursor-pointer font-bold underline">
              {vi ? 'Thử lại' : 'Retry'}
            </button>
          </p>
        )}

        {/* 3. Action Row: Inspected toggle & Reset filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all select-none ${filters.inspected
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs'
                : 'border-slate-200 bg-[#faf8f5] text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
          >
            <input
              type="checkbox"
              checked={filters.inspected}
              onChange={(event) => updateFilter('inspected', event.target.checked)}
              className="sr-only"
            />
            <ShieldCheck className={`size-4 ${filters.inspected ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{vi ? 'Đã kiểm định tại Hub' : 'Hub Inspected Only'}</span>
            {filters.inspected && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </label>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
            >
              <RotateCcw className="size-3.5 text-slate-400" />
              <span>{vi ? 'Đặt lại bộ lọc' : 'Reset filters'}</span>
            </button>
          </div>
        </div>
      </form>

      <section className="space-y-4" aria-label={vi ? 'Kết quả tìm kiếm' : 'Search results'} aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{vi ? 'Danh sách sản phẩm' : 'Products'}</h2>
            {result && <p aria-live="polite" className="text-xs text-slate-600">
              {result.totalElements.toLocaleString(vi ? 'vi-VN' : 'en-US')} {vi ? 'sản phẩm' : 'products'}
            </p>}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
            <ArrowUpDown aria-hidden="true" className="size-3.5 text-slate-500" />
            <select aria-label={vi ? 'Sắp xếp sản phẩm' : 'Sort products'} value={query.sort}
              onChange={(event) => {
                const sort = event.target.value as MarketplaceSort;
                setQuery((current) => ({ ...current, sort, page: 0 }));
              }} className="cursor-pointer bg-white">
              <option value="newest">{vi ? 'Mới đăng nhất' : 'Newest'}</option>
              <option value="priceAsc">{vi ? 'Giá thấp đến cao' : 'Price: low to high'}</option>
              <option value="priceDesc">{vi ? 'Giá cao đến thấp' : 'Price: high to low'}</option>
            </select>
          </label>
        </div>

        {loading && <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          {vi ? 'Đang tải sản phẩm…' : 'Loading products…'}
        </p>}
        {failed && <div role="alert" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm">
          <p>{vi ? 'Không tải được danh sách sản phẩm.' : 'Could not load products.'}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="cursor-pointer font-semibold underline">
            {vi ? 'Thử lại' : 'Retry'}
          </button>
        </div>}
        {result && result.content.length === 0 && <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm">
          <p>{vi ? 'Không tìm thấy sản phẩm phù hợp.' : 'No matching products found.'}</p>
          <button type="button" onClick={resetFilters} className="cursor-pointer font-semibold underline">
            {vi ? 'Đặt lại bộ lọc' : 'Reset filters'}
          </button>
        </div>}
        {result && result.content.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 sm:gap-4 2xl:grid-cols-5">
            {result.content.map((post) => (
              <ProductCard3D key={post.postId} item={{ ...mapListing(post), status: 'active', backendStatus: post.status }}
                conditionLabel={conditionLabel(post.itemCondition)} sellerAddress={post.sellerAddress}
                lang={lang} onSelectListing={onSelectListing} />
            ))}
          </div>
        )}
        {result && result.totalPages > 1 && (
          <nav aria-label={vi ? 'Phân trang sản phẩm' : 'Product pagination'} className="flex items-center justify-center gap-3 text-sm">
            <button type="button" aria-label={vi ? 'Trang trước' : 'Previous page'} disabled={result.number === 0}
              onClick={() => setQuery((current) => ({ ...current, page: Math.max(0, result.number - 1) }))}
              className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span>{vi ? 'Trang' : 'Page'} {result.number + 1} / {result.totalPages}</span>
            <button type="button" aria-label={vi ? 'Trang sau' : 'Next page'} disabled={result.number >= result.totalPages - 1}
              onClick={() => setQuery((current) => ({ ...current, page: result.number + 1 }))}
              className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

import { CategoryBackend, ItemBackend } from '../types';
import { categoryService } from '../services/categoryService';
import { itemService } from '../services/itemService';

export interface PostMetadata {
  postId: string;
  categoryId?: string;
  itemId?: string;
  categoryName?: string;
  itemName?: string;
  brand?: string;
  model?: string;
  purchaseYear?: number;
  category?: string;
  originalPriceVnd?: number;
}

export interface ResolvedProductMeta {
  categoryId?: string;
  itemId?: string;
  categoryName: string;
  itemName: string;
  displayCategory: string;
  brand: string;
  model: string;
}

// In-memory caches for synchronous resolution
let memoryCategories: CategoryBackend[] = [];
let memoryItems: ItemBackend[] = [];
let isCatalogInitialized = false;

// Known brand lists
export const KNOWN_FURNITURE_BRANDS = [
  'Hàng nhập khẩu',
  'Nhập khẩu',
  'IKEA',
  'Hòa Phát',
  'Xuân Hòa',
  'An Cường',
  'JYSK',
  'Nhà Xinh',
  'Chilai',
  'Baya',
  'Hoàng Anh Gia Lai',
  'Duy Tân',
  'Đại Đồng Tiến',
  'Kymdan',
  'Liên Á',
  'Vạn Thành',
  'Everon',
  'Sông Hồng',
  'Hanvico',
  'Tuấn Long'
];

export const KNOWN_TECH_BRANDS = [
  'Panasonic',
  'Kaff',
  'LG',
  'Samsung',
  'Hitachi',
  'Daikin',
  'Electrolux',
  'Toshiba',
  'Sharp',
  'Casper',
  'Ecovacs',
  'Cuckoo',
  'Philips',
  'Bosch',
  'Xiaomi',
  'Tefal',
  'Sunhouse',
  'Kangaroo',
  'Midea',
  'Aqua',
  'Sony',
  'Mitsubishi',
  'Haier',
  'TCL',
  'Lock&Lock',
  'Sanaky',
  'Alaska',
  'Funiki',
  'Nagakawa'
];

// Fallback seed catalog definitions (guarantees synchronous instant lookup)
export const DEFAULT_CATALOG_CATEGORIES: { name: string; items: string[] }[] = [
  {
    name: 'Phòng ngủ',
    items: ['Tủ quần áo', 'Khung giường', 'Nệm / Đệm', 'Tủ đầu giường', 'Bàn làm việc', 'Bàn trang điểm', 'Ghế công thái học / Ghế xoay']
  },
  {
    name: 'Bếp & Phòng ăn',
    items: ['Lò vi sóng / Lò nướng', 'Bếp từ / Bếp hồng ngoại', 'Nồi cơm điện', 'Nồi chiên không dầu', 'Tủ lạnh', 'Bàn ăn', 'Máy xay sinh tố', 'Bình đun siêu tốc / Bình thủy điện']
  },
  {
    name: 'Ban công & Giặt giũ',
    items: ['Máy sấy', 'Máy giặt', 'Giỏ đựng đồ giặt', 'Bàn ban công', 'Bàn ủi / Bàn là', 'Giá phơi đồ']
  },
  {
    name: 'Phòng khách',
    items: ['Sofa / Ghế dài', 'Kệ Tivi', 'Đèn đứng', 'Giá sách / Kệ sách', 'Bàn trà / Bàn sofa', 'Ghế bành']
  },
  {
    name: 'Phòng tắm & Vệ sinh',
    items: ['Máy nước nóng', 'Tủ / Kệ phòng tắm', 'Bồn rửa mặt', 'Bồn cầu', 'Gương', 'Vòi hoa sen']
  },
  {
    name: 'Khác',
    items: ['Máy lạnh / Điều hòa', 'Quạt máy', 'Máy lọc nước gia đình', 'Máy hút bụi', 'Máy lọc không khí', 'Kệ để giày', 'Tủ đựng đồ']
  }
];

/**
 * Khởi tạo catalog cache: nạp từ localStorage trước, sau đó đồng bộ ngầm từ Backend
 */
export async function initCatalogCache(): Promise<void> {
  if (isCatalogInitialized && memoryCategories.length > 0 && memoryItems.length > 0) {
    return;
  }

  // 1. Load từ localStorage nếu có
  try {
    const rawCats = localStorage.getItem('secondlife_cached_categories');
    if (rawCats) {
      memoryCategories = JSON.parse(rawCats);
    }
    const rawItems = localStorage.getItem('secondlife_cached_items');
    if (rawItems) {
      memoryItems = JSON.parse(rawItems);
    }
  } catch {}

  // 2. Fetch danh mục & vật phẩm mới nhất từ Backend (chỉ thực hiện ngầm)
  try {
    const [cats, items] = await Promise.all([
      categoryService.getCategories().catch(() => []),
      itemService.getItems().catch(() => [])
    ]);

    if (Array.isArray(cats) && cats.length > 0) {
      memoryCategories = cats;
      try {
        localStorage.setItem('secondlife_cached_categories', JSON.stringify(cats));
      } catch {}
    }

    if (Array.isArray(items) && items.length > 0) {
      memoryItems = items;
      try {
        localStorage.setItem('secondlife_cached_items', JSON.stringify(items));
      } catch {}
    }
    isCatalogInitialized = true;
  } catch (err) {
    console.warn('Không tải được catalog mới nhất từ BE, dùng cache nội bộ:', err);
  }
}

/**
 * Lưu metadata của bài đăng vào cache localStorage
 */
export function savePostMetadata(meta: PostMetadata): void {
  if (!meta?.postId) return;
  try {
    localStorage.setItem(`post_meta_${meta.postId}`, JSON.stringify(meta));
    const rawDict = localStorage.getItem('secondlife_post_metadata_dict');
    const dict = rawDict ? JSON.parse(rawDict) : {};
    dict[meta.postId] = meta;
    localStorage.setItem('secondlife_post_metadata_dict', JSON.stringify(dict));
  } catch {}
}

/**
 * Đọc metadata của bài đăng từ cache
 */
export function getPostMetadata(postId: string): PostMetadata | null {
  if (!postId) return null;
  try {
    const raw = localStorage.getItem(`post_meta_${postId}`);
    if (raw) return JSON.parse(raw);

    const rawDict = localStorage.getItem('secondlife_post_metadata_dict');
    if (rawDict) {
      const dict = JSON.parse(rawDict);
      if (dict[postId]) return dict[postId];
    }
  } catch {}
  return null;
}

/**
 * Trích xuất chính xác giá lúc mua mà người bán đã nhập khi tạo bài đăng.
 * Ưu tiên:
 * 1. Thuộc tính trực tiếp trên object (originalPriceVnd, purchasePrice...)
 * 2. Lưu trữ cục bộ localStorage theo postId (post_original_price_*, post_meta_*)
 * 3. Trích xuất từ nội dung mô tả bài viết (VD: "• Giá lúc mua mới: 11.000.000 VNĐ")
 * Không tự động nhân hệ số giả tạo (* 1.4) nếu người bán không nhập.
 */
export function extractSellerOriginalPrice(postOrListing: any): number | null {
  if (!postOrListing) return null;

  // 1. Kiểm tra trường giá trị trực tiếp trên object
  const candidateDirect = [
    postOrListing.originalPriceVnd,
    postOrListing.originalPrice,
    postOrListing.purchasePrice,
    postOrListing.declaredOriginalPrice,
  ];
  for (const c of candidateDirect) {
    const num = Number(c);
    if (!isNaN(num) && num > 0 && num < 2_000_000_000) {
      return num;
    }
  }

  // 2. Tra cứu trong localStorage và metadata cache theo postId
  const idCandidates = [
    postOrListing.id,
    postOrListing.postId,
    postOrListing._id,
  ].filter(Boolean);

  if (typeof window !== 'undefined') {
    for (const rawId of idCandidates) {
      const id = String(rawId);
      const stored = Number(localStorage.getItem(`post_original_price_${id}`));
      if (!isNaN(stored) && stored > 0 && stored < 2_000_000_000) {
        return stored;
      }
      try {
        const meta = getPostMetadata(id);
        if (meta?.originalPriceVnd && meta.originalPriceVnd > 0 && meta.originalPriceVnd < 2_000_000_000) {
          return meta.originalPriceVnd;
        }
      } catch {}
    }
  }

  // 3. Trích xuất từ mô tả bài viết (Description) do người bán nhập
  const textSources = [
    postOrListing.description,
    postOrListing.aiDescription,
    postOrListing.declaredConditionText,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  const pricePatterns = [
    /<!--(?:sl_orig_price|ORIGINAL_PRICE):(\d+)-->/i,
    /(?:giá\s*(?:sản\s*phẩm\s*)?lúc\s*mua\s*mới|giá\s*(?:sản\s*phẩm\s*)?lúc\s*mua|giá\s*mua\s*mới|giá\s*mua\s*ban\s*đầu|giá\s*mua\s*gốc|giá\s*sản\s*phẩm\s*gốc|giá\s*gốc\s*(?:lúc\s*mua)?|giá\s*mua|mua\s*mới)\s*[:=–-]\s*([0-9.,\s]+?)(?:vnđ|vnd|đ|d|\n|$|\.|\))/i,
    /(?:original\s*purchase\s*price|original\s*price|purchase\s*price|bought\s*(?:new\s*)?at|bought\s*for)\s*[:=–-]\s*([0-9.,\s]+?)(?:vnđ|vnd|đ|d|\n|$|\.|\))/i,
  ];

  for (const text of textSources) {
    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const digitsOnly = match[1].replace(/[^\d]/g, '');
        const parsed = Number(digitsOnly);
        if (!isNaN(parsed) && parsed > 0 && parsed < 2_000_000_000) {
          if (idCandidates.length > 0 && typeof window !== 'undefined') {
            try {
              localStorage.setItem(`post_original_price_${String(idCandidates[0])}`, String(parsed));
            } catch {}
          }
          return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Tìm kiếm danh mục và loại sản phẩm theo từ khóa tiêu đề / mô tả
 */
export function detectCategoryAndItemFromText(text: string): { categoryName: string; itemName: string } | null {
  const t = (text || '').toLowerCase();

  // 1. Phòng ngủ
  if (t.includes('tủ quần áo') || t.includes('tủ áo') || t.includes('wardrobe') || t.includes('closet')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Tủ quần áo' };
  }
  if (t.includes('khung giường') || t.includes('giường ngủ') || t.includes('giường tầng') || t.includes('giường')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Khung giường' };
  }
  if (t.includes('nệm') || t.includes('đệm') || t.includes('mattress')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Nệm / Đệm' };
  }
  if (t.includes('tủ đầu giường') || t.includes('tab đầu giường')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Tủ đầu giường' };
  }
  if (t.includes('bàn trang điểm')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Bàn trang điểm' };
  }
  if (t.includes('bàn làm việc') || t.includes('bàn học')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Bàn làm việc' };
  }
  if (t.includes('ghế công thái học') || t.includes('ghế xoay') || t.includes('ghế văn phòng') || t.includes('ergonomic')) {
    return { categoryName: 'Phòng ngủ', itemName: 'Ghế công thái học / Ghế xoay' };
  }

  // 2. Phòng khách
  if (t.includes('bàn trà') || t.includes('bàn sofa') || t.includes('bàn cafe') || t.includes('coffee table') || t.includes('bàn tròn') || t.includes('bàn kính')) {
    return { categoryName: 'Phòng khách', itemName: 'Bàn trà / Bàn sofa' };
  }
  if (t.includes('sofa') || t.includes('ghế dài') || t.includes('salon') || t.includes('couch')) {
    return { categoryName: 'Phòng khách', itemName: 'Sofa / Ghế dài' };
  }
  if (t.includes('kệ tivi') || t.includes('kệ tv') || t.includes('tủ tivi')) {
    return { categoryName: 'Phòng khách', itemName: 'Kệ Tivi' };
  }
  if (t.includes('giá sách') || t.includes('kệ sách') || t.includes('bookshelf')) {
    return { categoryName: 'Phòng khách', itemName: 'Giá sách / Kệ sách' };
  }
  if (t.includes('đèn đứng') || t.includes('đèn cây')) {
    return { categoryName: 'Phòng khách', itemName: 'Đèn đứng' };
  }
  if (t.includes('ghế bành') || t.includes('armchair')) {
    return { categoryName: 'Phòng khách', itemName: 'Ghế bành' };
  }

  // 3. Bếp & Phòng ăn
  if (t.includes('tủ lạnh') || t.includes('tủ đông') || t.includes('refrigerator') || t.includes('fridge')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Tủ lạnh' };
  }
  if (t.includes('lò vi sóng') || t.includes('lò nướng') || t.includes('microwave') || t.includes('oven')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Lò vi sóng / Lò nướng' };
  }
  if (t.includes('bếp từ') || t.includes('bếp hồng ngoại') || t.includes('induction')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Bếp từ / Bếp hồng ngoại' };
  }
  if (t.includes('nồi cơm') || t.includes('nồi điện') || t.includes('rice cooker')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Nồi cơm điện' };
  }
  if (t.includes('nồi chiên') || t.includes('air fryer')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Nồi chiên không dầu' };
  }
  if (t.includes('bàn ăn') || t.includes('dining table')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Bàn ăn' };
  }
  if (t.includes('máy xay') || t.includes('blender')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Máy xay sinh tố' };
  }
  if (t.includes('bình đun') || t.includes('ấm siêu tốc') || t.includes('bình thủy')) {
    return { categoryName: 'Bếp & Phòng ăn', itemName: 'Bình đun siêu tốc / Bình thủy điện' };
  }

  // 4. Ban công & Giặt giũ
  if (t.includes('máy sấy') || t.includes('dryer')) {
    return { categoryName: 'Ban công & Giặt giũ', itemName: 'Máy sấy' };
  }
  if (t.includes('máy giặt') || t.includes('washing')) {
    return { categoryName: 'Ban công & Giặt giũ', itemName: 'Máy giặt' };
  }
  if (t.includes('bàn ủi') || t.includes('bàn là') || t.includes('iron')) {
    return { categoryName: 'Ban công & Giặt giũ', itemName: 'Bàn ủi / Bàn là' };
  }
  if (t.includes('giá phơi') || t.includes('giàn phơi') || t.includes('drying rack')) {
    return { categoryName: 'Ban công & Giặt giũ', itemName: 'Giá phơi đồ' };
  }
  if (t.includes('giỏ đựng đồ giặt') || t.includes('sọt quần áo')) {
    return { categoryName: 'Ban công & Giặt giũ', itemName: 'Giỏ đựng đồ giặt' };
  }

  // 5. Phòng tắm & Vệ sinh
  if (t.includes('máy nước nóng') || t.includes('bình nóng lạnh') || t.includes('water heater')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Máy nước nóng' };
  }
  if (t.includes('bồn rửa mặt') || t.includes('lavabo')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Bồn rửa mặt' };
  }
  if (t.includes('bồn cầu') || t.includes('toilet')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Bồn cầu' };
  }
  if (t.includes('vòi hoa sen') || t.includes('vòi sen') || t.includes('shower')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Vòi hoa sen' };
  }
  if (t.includes('gương') || t.includes('mirror')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Gương' };
  }
  if (t.includes('kệ phòng tắm') || t.includes('tủ phòng tắm')) {
    return { categoryName: 'Phòng tắm & Vệ sinh', itemName: 'Tủ / Kệ phòng tắm' };
  }

  // 6. Khác
  if (t.includes('điều hòa') || t.includes('máy lạnh') || t.includes('air conditioner')) {
    return { categoryName: 'Khác', itemName: 'Máy lạnh / Điều hòa' };
  }
  if (t.includes('quạt máy') || t.includes('quạt điện') || t.includes('quạt đứng') || t.includes('quạt trần') || t.includes('quạt')) {
    return { categoryName: 'Khác', itemName: 'Quạt máy' };
  }
  if (t.includes('lọc nước') || t.includes('water purifier')) {
    return { categoryName: 'Khác', itemName: 'Máy lọc nước gia đình' };
  }
  if (t.includes('lọc không khí') || t.includes('air purifier')) {
    return { categoryName: 'Khác', itemName: 'Máy lọc không khí' };
  }
  if (t.includes('robot hút bụi') || t.includes('máy hút bụi') || t.includes('vacuum')) {
    return { categoryName: 'Khác', itemName: 'Máy hút bụi' };
  }
  if (t.includes('kệ để giày') || t.includes('kệ giày') || t.includes('tủ giày') || t.includes('shoe rack')) {
    return { categoryName: 'Khác', itemName: 'Kệ để giày' };
  }
  if (t.includes('tủ đựng đồ') || t.includes('tủ ngăn kéo') || t.includes('tủ nhựa') || t.includes('cabinet')) {
    return { categoryName: 'Khác', itemName: 'Tủ đựng đồ' };
  }

  return null;
}

/**
 * Nhận diện thương hiệu từ text (tiêu đề, tên sản phẩm, cấu trúc title)
 */
export function detectBrandFromText(text: string, knownItemName?: string): string {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();

  // 1. Kiểm tra danh sách thương hiệu nội thất
  for (const b of KNOWN_FURNITURE_BRANDS) {
    if (lower.includes(b.toLowerCase())) {
      return b;
    }
  }

  // 2. Kiểm tra danh sách thương hiệu công nghệ / điện máy
  for (const b of KNOWN_TECH_BRANDS) {
    if (lower.includes(b.toLowerCase())) {
      return b;
    }
  }

  // 3. Phân tích tiêu đề dạng: "[Loại sản phẩm] [Thương hiệu] - [Tình trạng]"
  // Ví dụ: "Tủ quần áo Hàng nhập khẩu - Nguyên Bản Chạy Tốt"
  if (clean.includes('-')) {
    const leftPart = clean.split('-')[0].trim();
    if (knownItemName && leftPart.toLowerCase().startsWith(knownItemName.toLowerCase())) {
      const extractedBrand = leftPart.substring(knownItemName.length).trim();
      if (extractedBrand.length >= 2 && extractedBrand.length <= 30) {
        return extractedBrand;
      }
    }
  }

  return '';
}

/**
 * Giải quyết toàn diện thông tin danh mục, loại sản phẩm và thương hiệu cho một bài đăng
 */
export function resolveCategoryAndItem(params: {
  postId?: string;
  categoryId?: string;
  itemId?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
}): ResolvedProductMeta {
  const { postId, categoryId, itemId, title, description, category, brand, model } = params;
  const cleanTitle = (title || '').replace(/^Tiêu đề:\s*/i, '').trim();
  const fullText = `${cleanTitle} ${description || ''}`.trim();

  // 1. Quét từ khóa tiêu đề & mô tả trước để nhận diện chính xác loại sản phẩm thực tế
  const detected = detectCategoryAndItemFromText(fullText);

  // 2. Kiểm tra cache metadata từ quá trình đăng bài (nếu có và không mâu thuẫn)
  const cachedMeta = postId ? getPostMetadata(postId) : null;
  if (cachedMeta) {
    const isLegacyMismatch =
      (cachedMeta.categoryName === 'Tủ lạnh & Tủ đông' || cachedMeta.category === 'Tủ lạnh & Tủ đông') &&
      detected &&
      detected.categoryName !== 'Tủ lạnh & Tủ đông';

    const finalItem = (!isLegacyMismatch && cachedMeta.itemName) || detected?.itemName || '';
    const finalCat = (!isLegacyMismatch && cachedMeta.categoryName) || detected?.categoryName || '';
    const display = finalItem || finalCat || (!isLegacyMismatch ? cachedMeta.category : '') || detected?.itemName || 'Đồ gia dụng';
    return {
      categoryId: cachedMeta.categoryId || categoryId,
      itemId: cachedMeta.itemId || itemId,
      categoryName: finalCat || display,
      itemName: finalItem || display,
      displayCategory: display,
      brand: (brand && brand !== 'SecondLife' && brand !== 'Hãng' ? brand : cachedMeta.brand) || (detected ? detectBrandFromText(cleanTitle, finalItem) : '') || 'Chính hãng',
      model: cachedMeta.model || model || ''
    };
  }

  // 3. Sử dụng kết quả nhận diện từ text làm cơ sở vững chắc
  let foundItemName = detected?.itemName || '';
  let foundCategoryName = detected?.categoryName || '';

  // 4. Tìm kiếm trong danh sách items bộ nhớ (nếu có itemId và chưa có foundItemName)
  if (!foundItemName && itemId) {
    const itm = memoryItems.find((i) => i.id === itemId);
    if (itm) {
      foundItemName = itm.name;
      const cat = memoryCategories.find((c) => c.id === itm.categoryId);
      if (cat) foundCategoryName = cat.name;
    }
  }

  // 5. Tìm kiếm trong danh mục bộ nhớ (nếu có categoryId và chưa có foundCategoryName)
  if (!foundCategoryName && categoryId) {
    const cat = memoryCategories.find((c) => c.id === categoryId);
    if (cat) {
      foundCategoryName = cat.name;
    }
  }

  // 6. Nếu category là chuỗi hợp lệ (không phải UUID và không phải mismatch)
  if (!foundCategoryName && category && typeof category === 'string' && !category.includes('-')) {
    foundCategoryName = category;
  }

  // 7. Nhận diện thương hiệu
  let detectedBrand = brand && brand.trim() && brand !== 'SecondLife' && brand !== 'Hãng' ? brand.trim() : '';
  if (!detectedBrand) {
    detectedBrand = detectBrandFromText(cleanTitle, foundItemName);
  }
  if (!detectedBrand) {
    const isFurniture = /phòng ngủ|phòng khách|tủ|giường|nệm|sofa|bàn|ghế/i.test(`${foundCategoryName} ${foundItemName} ${cleanTitle}`);
    detectedBrand = isFurniture ? 'Hàng nhập khẩu' : 'Chính hãng';
  }

  const finalItemName = foundItemName || foundCategoryName || 'Đồ gia dụng';
  const finalCategoryName = foundCategoryName || 'Khác';
  // displayCategory: Ưu tiên tên loại sản phẩm (ví dụ "Bàn trà / Bàn sofa"), nếu không có thì lấy tên danh mục ("Phòng khách")
  const displayCategory = foundItemName || foundCategoryName || 'Đồ gia dụng';

  return {
    categoryId,
    itemId,
    categoryName: finalCategoryName,
    itemName: finalItemName,
    displayCategory,
    brand: detectedBrand,
    model: model || ''
  };
}

/**
 * Trả về tên danh mục hoặc tên loại sản phẩm chuẩn xác nhất để hiển thị trên UI (Badge, Card, Chi tiết đơn hàng)
 */
export function resolveListingCategory(listing: any): string {
  if (!listing) return 'Đồ gia dụng';
  const cleanTitle = (listing.title || '').replace(/^Tiêu đề:\s*/i, '').trim();
  const resolved = resolveCategoryAndItem({
    postId: listing.id || listing.postId,
    categoryId: listing.categoryId,
    itemId: listing.itemId,
    title: cleanTitle,
    description: listing.description,
    category: listing.category,
    brand: listing.brand,
    model: listing.model,
  });
  return resolved.displayCategory || resolved.itemName || resolved.categoryName || listing.category || 'Đồ gia dụng';
}

/**
 * Chuẩn hóa listing của đơn hàng: sửa lại category, itemName, brand bị sai lệch do legacy data hoặc BE default
 */
export function resolveOrderListing(listing: any): any {
  if (!listing) return listing;
  const cleanTitle = (listing.title || '').replace(/^Tiêu đề:\s*/i, '').trim();
  const resolved = resolveCategoryAndItem({
    postId: listing.id || listing.postId,
    categoryId: listing.categoryId,
    itemId: listing.itemId,
    title: cleanTitle,
    description: listing.description,
    category: listing.category,
    brand: listing.brand,
    model: listing.model,
  });

  const resolvedCat = resolved.displayCategory || resolved.itemName || resolved.categoryName || listing.category || 'Đồ gia dụng';
  const resolvedBrand =
    resolved.brand && resolved.brand !== 'SecondLife' && resolved.brand !== 'Hãng'
      ? resolved.brand
      : listing.brand && listing.brand !== 'SecondLife' && listing.brand !== 'Hãng'
      ? listing.brand
      : resolved.brand || 'Chính hãng';

  return {
    ...listing,
    title: cleanTitle || listing.title,
    category: resolvedCat,
    itemName: resolved.itemName || listing.itemName || resolvedCat,
    categoryName: resolved.categoryName || listing.categoryName,
    brand: resolvedBrand,
  };
}

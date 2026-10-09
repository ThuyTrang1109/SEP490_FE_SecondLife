import { request } from './apiClient';
import {
  ShippingQuoteRequestDto,
  ShippingQuoteResponseDto,
  CreateShipmentRequestDto,
  ShipmentBackend,
  ShipmentEventBackend,
} from '../types';

export interface ShippingParcel {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface GhnLocation {
  _id: number;
  name: string;
  type?: string;
  status?: number;
  parent_id?: number;
}

export interface ShippingAddressDto {
  name: string;
  phone: string;
  address: string;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
  districtId?: number;
  wardCode?: string;
  newAddress?: boolean;
}

export interface SellerOnboardingResponseDto {
  shopName?: string;
  pickupAddress?: ShippingAddressDto;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  canStartEkyc?: boolean;
  nextStep?: string;
  emailVerifiedAt?: string;
  provinceId?: number;
  wardId?: number;
}

export interface SellerPickupAddressRequestDto {
  name: string;
  phone: string;
  address: string;
  provinceId: number;
  wardId: number;
}

export interface SellerOnboardingRequestDto {
  shopName: string;
  email: string;
  phone: string;
  pickupAddress: SellerPickupAddressRequestDto;
}

// Full 63 provinces of Vietnam fallback
export const FALLBACK_PROVINCES: GhnLocation[] = [
  { _id: 1000001, name: 'TP. Hồ Chí Minh', type: 'province', status: 1 },
  { _id: 1000002, name: 'Hà Nội', type: 'province', status: 1 },
  { _id: 1000003, name: 'Đà Nẵng', type: 'province', status: 1 },
  { _id: 1000004, name: 'Hải Phòng', type: 'province', status: 1 },
  { _id: 1000005, name: 'Cần Thơ', type: 'province', status: 1 },
  { _id: 1000006, name: 'Bà Rịa - Vũng Tàu', type: 'province', status: 1 },
  { _id: 1000007, name: 'Bình Dương', type: 'province', status: 1 },
  { _id: 1000008, name: 'Đồng Nai', type: 'province', status: 1 },
  { _id: 1000009, name: 'Khánh Hòa', type: 'province', status: 1 },
  { _id: 1000010, name: 'Lâm Đồng', type: 'province', status: 1 },
  { _id: 1000011, name: 'Quảng Ninh', type: 'province', status: 1 },
  { _id: 1000012, name: 'Thừa Thiên Huế', type: 'province', status: 1 },
  { _id: 1000013, name: 'An Giang', type: 'province', status: 1 },
  { _id: 1000014, name: 'Bắc Giang', type: 'province', status: 1 },
  { _id: 1000015, name: 'Bắc Kạn', type: 'province', status: 1 },
  { _id: 1000016, name: 'Bạc Liêu', type: 'province', status: 1 },
  { _id: 1000017, name: 'Bắc Ninh', type: 'province', status: 1 },
  { _id: 1000018, name: 'Bến Tre', type: 'province', status: 1 },
  { _id: 1000019, name: 'Bình Định', type: 'province', status: 1 },
  { _id: 1000020, name: 'Bình Phước', type: 'province', status: 1 },
  { _id: 1000021, name: 'Bình Thuận', type: 'province', status: 1 },
  { _id: 1000022, name: 'Cà Mau', type: 'province', status: 1 },
  { _id: 1000023, name: 'Cao Bằng', type: 'province', status: 1 },
  { _id: 1000024, name: 'Đắk Lắk', type: 'province', status: 1 },
  { _id: 1000025, name: 'Đắk Nông', type: 'province', status: 1 },
  { _id: 1000026, name: 'Điện Biên', type: 'province', status: 1 },
  { _id: 1000027, name: 'Đồng Tháp', type: 'province', status: 1 },
  { _id: 1000028, name: 'Gia Lai', type: 'province', status: 1 },
  { _id: 1000029, name: 'Hà Giang', type: 'province', status: 1 },
  { _id: 1000030, name: 'Hà Nam', type: 'province', status: 1 },
  { _id: 1000031, name: 'Hà Tĩnh', type: 'province', status: 1 },
  { _id: 1000032, name: 'Hải Dương', type: 'province', status: 1 },
  { _id: 1000033, name: 'Hậu Giang', type: 'province', status: 1 },
  { _id: 1000034, name: 'Hòa Bình', type: 'province', status: 1 },
  { _id: 1000035, name: 'Hưng Yên', type: 'province', status: 1 },
  { _id: 1000036, name: 'Kiên Giang', type: 'province', status: 1 },
  { _id: 1000037, name: 'Kon Tum', type: 'province', status: 1 },
  { _id: 1000038, name: 'Lai Châu', type: 'province', status: 1 },
  { _id: 1000039, name: 'Lạng Sơn', type: 'province', status: 1 },
  { _id: 1000040, name: 'Lào Cai', type: 'province', status: 1 },
  { _id: 1000041, name: 'Long An', type: 'province', status: 1 },
  { _id: 1000042, name: 'Nam Định', type: 'province', status: 1 },
  { _id: 1000043, name: 'Nghệ An', type: 'province', status: 1 },
  { _id: 1000044, name: 'Ninh Bình', type: 'province', status: 1 },
  { _id: 1000045, name: 'Ninh Thuận', type: 'province', status: 1 },
  { _id: 1000046, name: 'Phú Thọ', type: 'province', status: 1 },
  { _id: 1000047, name: 'Phú Yên', type: 'province', status: 1 },
  { _id: 1000048, name: 'Quảng Bình', type: 'province', status: 1 },
  { _id: 1000049, name: 'Quảng Nam', type: 'province', status: 1 },
  { _id: 1000050, name: 'Quảng Ngãi', type: 'province', status: 1 },
  { _id: 1000051, name: 'Quảng Trị', type: 'province', status: 1 },
  { _id: 1000052, name: 'Sóc Trăng', type: 'province', status: 1 },
  { _id: 1000053, name: 'Sơn La', type: 'province', status: 1 },
  { _id: 1000054, name: 'Tây Ninh', type: 'province', status: 1 },
  { _id: 1000055, name: 'Thái Bình', type: 'province', status: 1 },
  { _id: 1000056, name: 'Thái Nguyên', type: 'province', status: 1 },
  { _id: 1000057, name: 'Thanh Hóa', type: 'province', status: 1 },
  { _id: 1000058, name: 'Tiền Giang', type: 'province', status: 1 },
  { _id: 1000059, name: 'Trà Vinh', type: 'province', status: 1 },
  { _id: 1000060, name: 'Tuyên Quang', type: 'province', status: 1 },
  { _id: 1000061, name: 'Vĩnh Long', type: 'province', status: 1 },
  { _id: 1000062, name: 'Vĩnh Phúc', type: 'province', status: 1 },
  { _id: 1000063, name: 'Yên Bái', type: 'province', status: 1 },
];

export const FALLBACK_WARDS: Record<string | number, GhnLocation[]> = {
  // TP. Hồ Chí Minh
  1000001: [
    { _id: 1003646, name: 'Phường Bến Nghé (Quận 1)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003647, name: 'Phường Bến Thành (Quận 1)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003648, name: 'Phường Tân Định (Quận 1)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003649, name: 'Phường Thảo Điền (TP. Thủ Đức)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003650, name: 'Phường An Phú (TP. Thủ Đức)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003651, name: 'Phường 1 (Quận 3)', type: 'ward', status: 1, parent_id: 1000001 },
    { _id: 1003652, name: 'Phường Tân Phong (Quận 7)', type: 'ward', status: 1, parent_id: 1000001 },
  ],
  // Hà Nội
  1000002: [
    { _id: 2003601, name: 'Phường Dịch Vọng (Cầu Giấy)', type: 'ward', status: 1, parent_id: 1000002 },
    { _id: 2003602, name: 'Phường Dịch Vọng Hậu (Cầu Giấy)', type: 'ward', status: 1, parent_id: 1000002 },
    { _id: 2003603, name: 'Phường Yên Hòa (Cầu Giấy)', type: 'ward', status: 1, parent_id: 1000002 },
    { _id: 2003604, name: 'Phường Hàng Trống (Hoàn Kiếm)', type: 'ward', status: 1, parent_id: 1000002 },
    { _id: 2003605, name: 'Phường Tràng Tiền (Hoàn Kiếm)', type: 'ward', status: 1, parent_id: 1000002 },
    { _id: 2003606, name: 'Phường Bách Khoa (Hai Bà Trưng)', type: 'ward', status: 1, parent_id: 1000002 },
  ],
  // Đà Nẵng
  1000003: [
    { _id: 3003601, name: 'Phường Hải Châu 1 (Hải Châu)', type: 'ward', status: 1, parent_id: 1000003 },
    { _id: 3003602, name: 'Phường Thạch Thang (Hải Châu)', type: 'ward', status: 1, parent_id: 1000003 },
    { _id: 3003603, name: 'Phường An Hải Bắc (Sơn Trà)', type: 'ward', status: 1, parent_id: 1000003 },
    { _id: 3003604, name: 'Phường Mỹ An (Ngũ Hành Sơn)', type: 'ward', status: 1, parent_id: 1000003 },
  ],
  // Bà Rịa - Vũng Tàu
  1000006: [
    { _id: 6003601, name: 'Phường 1 (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003602, name: 'Phường 2 (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003603, name: 'Phường 3 (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003604, name: 'Phường 7 (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003605, name: 'Phường Thắng Tam (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003606, name: 'Phường Thắng Nhất (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003607, name: 'Phường Thắng Nhì (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003608, name: 'Phường Rạch Dừa (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003609, name: 'Phường Nguyễn An Ninh (TP. Vũng Tàu)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003610, name: 'Phường Phước Trung (TP. Bà Rịa)', type: 'ward', status: 1, parent_id: 1000006 },
    { _id: 6003611, name: 'Phường Kim Dinh (TP. Bà Rịa)', type: 'ward', status: 1, parent_id: 1000006 },
  ],
  // Bình Dương
  1000007: [
    { _id: 7003601, name: 'Phường Phú Cường (Thủ Dầu Một)', type: 'ward', status: 1, parent_id: 1000007 },
    { _id: 7003602, name: 'Phường Dĩ An (TP. Dĩ An)', type: 'ward', status: 1, parent_id: 1000007 },
    { _id: 7003603, name: 'Phường Lái Thiêu (Thuận An)', type: 'ward', status: 1, parent_id: 1000007 },
  ],
  // Đồng Nai
  1000008: [
    { _id: 8003601, name: 'Phường Trảng Dài (Biên Hòa)', type: 'ward', status: 1, parent_id: 1000008 },
    { _id: 8003602, name: 'Phường Tân Phong (Biên Hòa)', type: 'ward', status: 1, parent_id: 1000008 },
    { _id: 8003603, name: 'Phường Thống Nhất (Biên Hòa)', type: 'ward', status: 1, parent_id: 1000008 },
  ],
  // Khánh Hòa
  1000009: [
    { _id: 9003601, name: 'Phường Lộc Thọ (Nha Trang)', type: 'ward', status: 1, parent_id: 1000009 },
    { _id: 9003602, name: 'Phường Vĩnh Hải (Nha Trang)', type: 'ward', status: 1, parent_id: 1000009 },
    { _id: 9003603, name: 'Phường Phước Hải (Nha Trang)', type: 'ward', status: 1, parent_id: 1000009 },
  ],
  // Lâm Đồng
  1000010: [
    { _id: 10003601, name: 'Phường 1 (TP. Đà Lạt)', type: 'ward', status: 1, parent_id: 1000010 },
    { _id: 10003602, name: 'Phường 2 (TP. Đà Lạt)', type: 'ward', status: 1, parent_id: 1000010 },
    { _id: 10003603, name: 'Phường 1 (TP. Bảo Lộc)', type: 'ward', status: 1, parent_id: 1000010 },
  ],
};

export const normalizeAddressText = (str: string): string =>
  (str || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(thanh pho|tinh|tp\.|tp|thi xa|tx\.|quan|huyen)\s+/i, '')
    .replace(/\bcity\b/i, '')
    .trim();

// Bản đồ nhận diện thành phố/thị xã thuộc tỉnh sang Tỉnh/Thành phố mẹ
// Khắc phục triệt để lỗi OpenStreetMap gán nhãn sai (ví dụ Vũng Tàu bị OSM gộp vào TP.HCM)
export const SPECIAL_CITY_TO_PROVINCE_MAP: Record<string, string> = {
  'vung tau': 'Bà Rịa - Vũng Tàu',
  'ba ria': 'Bà Rịa - Vũng Tàu',
  'bien hoa': 'Đồng Nai',
  'long khanh': 'Đồng Nai',
  'thu dau mot': 'Bình Dương',
  'di an': 'Bình Dương',
  'thuan an': 'Bình Dương',
  'ben cat': 'Bình Dương',
  'tan uyen': 'Bình Dương',
  'nha trang': 'Khánh Hòa',
  'cam ranh': 'Khánh Hòa',
  'ninh hoa': 'Khánh Hòa',
  'da lat': 'Lâm Đồng',
  'bao loc': 'Lâm Đồng',
  'ha long': 'Quảng Ninh',
  'cam pha': 'Quảng Ninh',
  'mong cai': 'Quảng Ninh',
  'uong bi': 'Quảng Ninh',
  'dong trieu': 'Quảng Ninh',
  'hoi an': 'Quảng Nam',
  'tam ky': 'Quảng Nam',
  'phu quoc': 'Kiên Giang',
  'rach gia': 'Kiên Giang',
  'ha tien': 'Kiên Giang',
  'buon ma thuot': 'Đắk Lắk',
  'quy nhon': 'Bình Định',
  'phan thiet': 'Bình Thuận',
  'la gi': 'Bình Thuận',
  'phan rang': 'Ninh Thuận',
  'tuy hoa': 'Phú Yên',
  'pleiku': 'Gia Lai',
  'an khe': 'Gia Lai',
  'kon tum': 'Kon Tum',
  'gia nghia': 'Đắk Nông',
  'my tho': 'Tiền Giang',
  'go cong': 'Tiền Giang',
  'tan an': 'Long An',
  'kien tuong': 'Long An',
  'ben tre': 'Bến Tre',
  'tra vinh': 'Trà Vinh',
  'vinh long': 'Vĩnh Long',
  'binh minh': 'Vĩnh Long',
  'cao lanh': 'Đồng Tháp',
  'sa dec': 'Đồng Tháp',
  'hong ngu': 'Đồng Tháp',
  'long xuyen': 'An Giang',
  'chau doc': 'An Giang',
  'tan chau': 'An Giang',
  'soc trang': 'Sóc Trăng',
  'nga nam': 'Sóc Trăng',
  'vinh chau': 'Sóc Trăng',
  'bac lieu': 'Bạc Liêu',
  'gia rai': 'Bạc Liêu',
  'ca mau': 'Cà Mau',
  'vi thanh': 'Hậu Giang',
  'nga bay': 'Hậu Giang',
  'long my': 'Hậu Giang',
  'tay ninh': 'Tây Ninh',
  'trang bang': 'Tây Ninh',
  'hoa thanh': 'Tây Ninh',
  'dong xoai': 'Bình Phước',
  'binh long': 'Bình Phước',
  'phuoc long': 'Bình Phước',
  'viet tri': 'Phú Thọ',
  'phu tho': 'Phú Thọ',
  'thai nguyen': 'Thái Nguyên',
  'song cong': 'Thái Nguyên',
  'pho yen': 'Thái Nguyên',
  'bac ninh': 'Bắc Ninh',
  'tu son': 'Bắc Ninh',
  'bac giang': 'Bắc Giang',
  'viet yen': 'Bắc Giang',
  'hai duong': 'Hải Dương',
  'chi linh': 'Hải Dương',
  'kinh mon': 'Hải Dương',
  'hung yen': 'Hưng Yên',
  'my hao': 'Hưng Yên',
  'nam dinh': 'Nam Định',
  'ninh binh': 'Ninh Bình',
  'tam diep': 'Ninh Bình',
  'phu ly': 'Hà Nam',
  'duy tien': 'Hà Nam',
  'thai binh': 'Thái Bình',
  'thanh hoa': 'Thanh Hóa',
  'sam son': 'Thanh Hóa',
  'bim son': 'Thanh Hóa',
  'nghi son': 'Thanh Hóa',
  'vinh': 'Nghệ An',
  'cua lo': 'Nghệ An',
  'thai hoa': 'Nghệ An',
  'ha tinh': 'Hà Tĩnh',
  'hong linh': 'Hà Tĩnh',
  'ky anh': 'Hà Tĩnh',
  'dong hoi': 'Quảng Bình',
  'ba don': 'Quảng Bình',
  'dong ha': 'Quảng Trị',
  'quang tri': 'Quảng Trị',
  'hue': 'Thừa Thiên Huế',
  'huong thuy': 'Thừa Thiên Huế',
  'huong tra': 'Thừa Thiên Huế',
  'hoa binh': 'Hòa Bình',
  'son la': 'Sơn La',
  'dien bien phu': 'Điện Biên',
  'muong lay': 'Điện Biên',
  'lao cai': 'Lào Cai',
  'sa pa': 'Lào Cai',
  'yen bai': 'Yên Bái',
  'nghia lo': 'Yên Bái',
  'tuyen quang': 'Tuyên Quang',
  'ha giang': 'Hà Giang',
  'cao bang': 'Cao Bằng',
  'lang son': 'Lạng Sơn',
  'bac kan': 'Bắc Kạn',
};

/**
 * Tìm Tỉnh/Thành phố phù hợp nhất từ các chuỗi địa chỉ do GPS / Geocoder trả về
 */
export function resolveProvinceFromText(
  detectedCandidates: string[],
  provinceList: GhnLocation[]
): GhnLocation | undefined {
  if (!Array.isArray(provinceList) || provinceList.length === 0) return undefined;

  // 1. Kiểm tra thành phố đặc biệt trước (ví dụ Vũng Tàu -> Bà Rịa - Vũng Tàu)
  for (const candidate of detectedCandidates) {
    if (!candidate) continue;
    const normCand = normalizeAddressText(candidate);
    for (const [cityName, provinceName] of Object.entries(SPECIAL_CITY_TO_PROVINCE_MAP)) {
      if (normCand.includes(cityName)) {
        const found = provinceList.find((p) => {
          const pNorm = normalizeAddressText(p.name);
          const targetNorm = normalizeAddressText(provinceName);
          return pNorm.includes(targetNorm) || targetNorm.includes(pNorm);
        });
        if (found) return found;
      }
    }
  }

  // 2. So khớp trực tiếp với danh sách tỉnh thành
  for (const candidate of detectedCandidates) {
    if (!candidate) continue;
    const normCand = normalizeAddressText(candidate);
    if (!normCand) continue;

    const directMatch = provinceList.find((p) => {
      const pNorm = normalizeAddressText(p.name);
      return (
        pNorm === normCand ||
        pNorm.includes(normCand) ||
        normCand.includes(pNorm) ||
        p.name.toLowerCase().includes(candidate.toLowerCase()) ||
        candidate.toLowerCase().includes(p.name.toLowerCase())
      );
    });
    if (directMatch) return directMatch;
  }

  return undefined;
}

export const shippingService = {
  /**
   * Lấy danh sách Tỉnh/Thành phố từ BE (GHN catalogue)
   * GET /api/v1/shipping/provinces
   */
  async getProvinces(): Promise<GhnLocation[]> {
    try {
      const res = await request<any>('/shipping/provinces', {
        method: 'GET',
        requiresAuth: false,
      });
      const raw = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
      if (raw && raw.length > 0) {
        return raw.map((item: any) => ({
          _id: item._id ?? item.ProvinceID ?? item.id,
          name: item.name ?? item.ProvinceName ?? item.nameExtension?.[0] ?? 'Tỉnh/Thành',
          type: item.type ?? 'province',
          status: item.status ?? 1,
        }));
      }
      return FALLBACK_PROVINCES;
    } catch (err) {
      console.warn('Backend /shipping/provinces failed, using fallback:', err);
      return FALLBACK_PROVINCES;
    }
  },

  /**
   * Lấy danh sách Phường/Xã từ BE theo provinceId
   * GET /api/v1/shipping/wards?provinceId={provinceId}
   */
  async getWards(provinceId: number | string): Promise<GhnLocation[]> {
    if (!provinceId) return [];
    const pIdNum = Number(provinceId) || 0;
    try {
      const res = await request<any>(`/shipping/wards?provinceId=${provinceId}`, {
        method: 'GET',
        requiresAuth: false,
      });
      const raw = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
      if (raw && raw.length > 0) {
        return raw.map((item: any) => ({
          _id: item._id ?? item.WardCode ?? item.id,
          name: item.name ?? item.WardName ?? 'Phường/Xã',
          type: item.type ?? 'ward',
          status: item.status ?? 1,
          parent_id: item.parent_id ?? pIdNum,
        }));
      }
      return FALLBACK_WARDS[provinceId] || FALLBACK_WARDS[pIdNum] || [
        { _id: pIdNum * 1000 + 1, name: 'Phường Trung Tâm 1', type: 'ward', status: 1, parent_id: pIdNum },
        { _id: pIdNum * 1000 + 2, name: 'Phường Trung Tâm 2', type: 'ward', status: 1, parent_id: pIdNum },
      ];
    } catch (err) {
      console.warn(`Backend /shipping/wards?provinceId=${provinceId} failed:`, err);
      return FALLBACK_WARDS[provinceId] || FALLBACK_WARDS[pIdNum] || [
        { _id: pIdNum * 1000 + 1, name: 'Phường Trung Tâm 1', type: 'ward', status: 1, parent_id: pIdNum },
        { _id: pIdNum * 1000 + 2, name: 'Phường Trung Tâm 2', type: 'ward', status: 1, parent_id: pIdNum },
      ];
    }
  },

  /**
   * Lấy thông tin Onboarding của Người Bán (bao gồm địa chỉ kho đã lưu từ BE)
   * GET /api/seller-onboarding/me
   */
  async getSellerOnboarding(): Promise<SellerOnboardingResponseDto | null> {
    try {
      const res = await request<SellerOnboardingResponseDto>('/seller-onboarding/me', {
        method: 'GET',
        requiresAuth: true,
      });
      return res.data;
    } catch (err) {
      console.warn('Backend /seller-onboarding/me not available:', err);
      return null;
    }
  },

  /**
   * Lấy địa chỉ lấy hàng đã lưu của người bán từ BE
   * GET /api/v1/shipping/pickup-address
   */
  async getPickupAddress(): Promise<ShippingAddressDto | null> {
    try {
      const res = await request<ShippingAddressDto>('/shipping/pickup-address', {
        method: 'GET',
        requiresAuth: true,
      });
      return res.data;
    } catch (err) {
      console.warn('Backend /shipping/pickup-address not available:', err);
      return null;
    }
  },

  /**
   * Lưu thông tin Onboarding và Địa chỉ kho lấy hàng bưu tá lên BE
   * PUT /api/seller-onboarding/me
   */
  async saveSellerOnboarding(data: SellerOnboardingRequestDto): Promise<SellerOnboardingResponseDto> {
    const res = await request<SellerOnboardingResponseDto>('/seller-onboarding/me', {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Gửi mã OTP 6 số đến email đăng ký Shop
   * POST /api/seller-onboarding/email/send-code
   */
  async sendSellerOnboardingEmailCode(): Promise<{ email: string; expiresAt: string; resendAvailableAt: string }> {
    const res = await request<{ email: string; expiresAt: string; resendAvailableAt: string }>(
      '/seller-onboarding/email/send-code',
      {
        method: 'POST',
        requiresAuth: true,
      }
    );
    return res.data;
  },

  /**
   * Xác thực mã OTP 6 số email Shop để kích hoạt quyền nộp eKYC
   * POST /api/seller-onboarding/email/verify
   */
  async verifySellerOnboardingEmailCode(otp: string): Promise<SellerOnboardingResponseDto> {
    const res = await request<SellerOnboardingResponseDto>('/seller-onboarding/email/verify', {
      method: 'POST',
      body: JSON.stringify({ otp: otp.trim() }),
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Lấy báo giá vận chuyển GHN (Tiền hàng, phí giao, tổng tiền, thời gian giao)
   * POST /api/v1/shipping/quotes
   */
  async getShippingQuote(body: ShippingQuoteRequestDto): Promise<ShippingQuoteResponseDto> {
    const res = await request<ShippingQuoteResponseDto>('/shipping/quotes', {
      method: 'POST',
      body: JSON.stringify(body),
      requiresAuth: true,
    });
    const quote = (res as any)?.data ?? res;
    return quote as ShippingQuoteResponseDto;
  },

  /**
   * Cập nhật thông tin kích thước, cân nặng của kiện hàng cho bài đăng
   * PUT /api/v1/posts/{postId}/shipping-package
   */
  async updateShippingPackage(postId: string, body: ShippingParcel): Promise<ShippingParcel> {
    const res = await request<ShippingParcel>(`/posts/${postId}/shipping-package`, {
      method: 'PUT',
      body: JSON.stringify(body),
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as ShippingParcel;
  },

  /**
   * Người bán hoặc Kỹ sư Hub tạo vận đơn GHN cho đơn hàng

   * POST /api/v1/orders/{orderId}/shipments
   */
  async createShipment(orderId: string, body: CreateShipmentRequestDto): Promise<ShipmentBackend> {
    const res = await request<ShipmentBackend>(`/orders/${orderId}/shipments`, {
      method: 'POST',
      body: JSON.stringify(body),
      requiresAuth: true,
    });
    const shipment = (res as any)?.data ?? res;
    return shipment as ShipmentBackend;
  },

  /**
   * Lấy danh sách vận đơn của đơn hàng
   * GET /api/v1/orders/{orderId}/shipments
   */
  async getOrderShipments(orderId: string): Promise<ShipmentBackend[]> {
    const res = await request<ShipmentBackend[]>(`/orders/${orderId}/shipments`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Lấy dòng thời gian các sự kiện vận chuyển từ GHN
   * GET /api/v1/shipments/{shipmentId}/events
   */
  async getShipmentEvents(shipmentId: string): Promise<ShipmentEventBackend[]> {
    const res = await request<ShipmentEventBackend[]>(`/shipments/${shipmentId}/events`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Đồng bộ trạng thái mới nhất từ GHN sang SecondLife
   * POST /api/v1/shipments/{shipmentId}/sync
   */
  async syncShipment(shipmentId: string): Promise<ShipmentBackend> {
    const res = await request<ShipmentBackend>(`/shipments/${shipmentId}/sync`, {
      method: 'POST',
      requiresAuth: true,
    });
    const shipment = (res as any)?.data ?? res;
    return shipment as ShipmentBackend;
  },

  /**
   * Hủy vận đơn GHN trước khi bưu tá lấy hàng
   * POST /api/v1/shipments/{shipmentId}/cancel
   */
  async cancelShipment(shipmentId: string): Promise<ShipmentBackend> {
    const res = await request<ShipmentBackend>(`/shipments/${shipmentId}/cancel`, {
      method: 'POST',
      requiresAuth: true,
    });
    const shipment = (res as any)?.data ?? res;
    return shipment as ShipmentBackend;
  },

  /**
   * Lấy nhãn bưu gửi GHN để in phiếu đóng gói
   * GET /api/v1/shipments/{shipmentId}/label
   */
  async getShipmentLabel(shipmentId: string): Promise<any> {
    const res = await request<any>(`/shipments/${shipmentId}/label`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data ?? res;
  },

  /**
   * Giả lập GHN Webhook callback cho localhost / môi trường test (Mục 10 Tracking Guide)
   * POST /api/v1/shipping/callback
   */
  async simulateWebhookCallback(
    body: {
      ShopID: number;
      OrderCode: string;
      Type: string;
      Status: string;
      Time: string;
    },
    secret: string = 'test-secret'
  ): Promise<any> {
    const res = await request<any>('/shipping/callback', {
      method: 'POST',
      headers: {
        'X-GHN-Secret': secret,
      },
      body: JSON.stringify(body),
      requiresAuth: false,
    });
    return res;
  },
};


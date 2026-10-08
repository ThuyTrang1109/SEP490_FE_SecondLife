/**
 * Service tích hợp Open API hành chính Việt Nam (provinces.open-api.vn)
 * Cung cấp dữ liệu Tỉnh/Thành phố, Quận/Huyện, Phường/Xã không cần API Key.
 */

export interface OpenApiProvince {
  name: string;
  code: number;
  division_type?: string;
  codename?: string;
  phone_code?: number;
}

export interface OpenApiDistrict {
  name: string;
  code: number;
  division_type?: string;
  codename?: string;
  province_code?: number;
}

export interface OpenApiWard {
  name: string;
  code: number;
  division_type?: string;
  codename?: string;
  district_code?: number;
}

const BASE_URL = 'https://provinces.open-api.vn/api';

let cachedProvinces: OpenApiProvince[] | null = null;
const cachedDistricts = new Map<number, OpenApiDistrict[]>();
const cachedWards = new Map<number, OpenApiWard[]>();

export const addressService = {
  /**
   * Lấy danh sách tất cả Tỉnh / Thành phố
   * GET https://provinces.open-api.vn/api/p/
   */
  async getProvinces(): Promise<OpenApiProvince[]> {
    if (cachedProvinces && cachedProvinces.length > 0) {
      return cachedProvinces;
    }
    try {
      const res = await fetch(`${BASE_URL}/p/`);
      if (!res.ok) {
        throw new Error(`Lỗi tải Tỉnh/Thành phố: ${res.status}`);
      }
      const data: OpenApiProvince[] = await res.json();
      cachedProvinces = data;
      return data;
    } catch (err) {
      console.error('addressService.getProvinces failed:', err);
      throw err;
    }
  },

  /**
   * Lấy danh sách Quận / Huyện theo mã Tỉnh
   * GET https://provinces.open-api.vn/api/p/{province_code}?depth=2
   */
  async getDistricts(provinceCode: number | string): Promise<OpenApiDistrict[]> {
    const code = Number(provinceCode);
    if (!code) return [];
    if (cachedDistricts.has(code)) {
      return cachedDistricts.get(code)!;
    }
    try {
      const res = await fetch(`${BASE_URL}/p/${code}?depth=2`);
      if (!res.ok) {
        throw new Error(`Lỗi tải Quận/Huyện: ${res.status}`);
      }
      const data = await res.json();
      const districts: OpenApiDistrict[] = data.districts || [];
      cachedDistricts.set(code, districts);
      return districts;
    } catch (err) {
      console.error(`addressService.getDistricts(${code}) failed:`, err);
      throw err;
    }
  },

  /**
   * Lấy danh sách Phường / Xã theo mã Quận / Huyện
   * GET https://provinces.open-api.vn/api/d/{district_code}?depth=2
   */
  async getWards(districtCode: number | string): Promise<OpenApiWard[]> {
    const code = Number(districtCode);
    if (!code) return [];
    if (cachedWards.has(code)) {
      return cachedWards.get(code)!;
    }
    try {
      const res = await fetch(`${BASE_URL}/d/${code}?depth=2`);
      if (!res.ok) {
        throw new Error(`Lỗi tải Phường/Xã: ${res.status}`);
      }
      const data = await res.json();
      const wards: OpenApiWard[] = data.wards || [];
      cachedWards.set(code, wards);
      return wards;
    } catch (err) {
      console.error(`addressService.getWards(${code}) failed:`, err);
      throw err;
    }
  },
};

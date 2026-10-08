/**
 * Tiện ích xử lý địa chỉ: Trích xuất và định dạng chỉ lấy Phường/Xã và Tỉnh/Thành phố
 * Dùng khi hiển thị địa chỉ người bán trên sản phẩm.
 */

export interface SavedSellerAddress {
  address: string;
  wardName: string;
  provinceName: string;
}

/**
 * Lấy địa chỉ người bán đã lưu từ localStorage / session
 */
export function getSavedSellerAddress(): SavedSellerAddress {
  try {
    const rawSaved = localStorage.getItem('secondlife_seller_profile_address');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (parsed && (parsed.address || parsed.wardName || parsed.provinceName)) {
        return {
          address: parsed.address || '',
          wardName: parsed.wardName || '',
          provinceName: parsed.provinceName || '',
        };
      }
    }
  } catch (_) {}

  try {
    const rawUser = localStorage.getItem('secondlife_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u) {
        return {
          address: u.pickupAddress || u.address || '',
          wardName: u.ward || u.wardName || '',
          provinceName: u.province || u.provinceName || '',
        };
      }
    }
  } catch (_) {}

  return { address: '', wardName: '', provinceName: '' };
}

/**
 * Lưu địa chỉ người bán vào bộ nhớ cục bộ
 */
export function saveSellerAddress(address: string, wardName?: string, provinceName?: string): void {
  try {
    localStorage.setItem(
      'secondlife_seller_profile_address',
      JSON.stringify({
        address: address || '',
        wardName: wardName || '',
        provinceName: provinceName || '',
      })
    );
  } catch (_) {}
}

/**
 * Trích xuất chỉ lấy Phường/Xã và Tỉnh/Thành phố từ địa chỉ đầy đủ
 */
export function extractWardAndCity(
  fullAddress?: string | null,
  wardName?: string | null,
  provinceName?: string | null
): string {
  // 1. Nếu đã có sẵn wardName và provinceName
  const cleanWard = (wardName || '').trim();
  const cleanProv = (provinceName || '').trim();

  if (cleanWard && cleanProv) {
    return `${cleanWard}, ${cleanProv}`;
  }

  // 2. Nếu không có địa chỉ truyền vào, thử kiểm tra địa chỉ đã lưu trong profile người bán
  if (!fullAddress || typeof fullAddress !== 'string' || !fullAddress.trim()) {
    const saved = getSavedSellerAddress();
    if (saved.wardName && saved.provinceName) {
      return `${saved.wardName}, ${saved.provinceName}`;
    }
    if (saved.address) {
      return extractWardAndCity(saved.address, saved.wardName, saved.provinceName);
    }
    if (cleanProv || cleanWard) {
      return cleanProv || cleanWard;
    }
    return '';
  }

  const raw = fullAddress.trim();

  // Bỏ qua giá trị chung chung 'Việt Nam' hoặc 'Toàn quốc'
  if (raw.toLowerCase() === 'việt nam' || raw.toLowerCase() === 'viet nam' || raw.toLowerCase() === 'toàn quốc') {
    const saved = getSavedSellerAddress();
    if (saved.wardName && saved.provinceName) {
      return `${saved.wardName}, ${saved.provinceName}`;
    }
    if (saved.address && saved.address.toLowerCase() !== 'việt nam') {
      return extractWardAndCity(saved.address, saved.wardName, saved.provinceName);
    }
    return '';
  }

  // Tách địa chỉ qua các dấu phân cách thông dụng
  const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return raw;
  }

  let foundWard = cleanWard;
  let foundCity = cleanProv;

  // Duyệt các phần tử để tìm Phường/Xã/Thị trấn và Tỉnh/Thành phố
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();

    // Nhận diện Phường / Xã / Thị trấn
    if (
      !foundWard &&
      (lower.startsWith('phường') ||
        lower.startsWith('phuong') ||
        lower.startsWith('p.') ||
        lower.startsWith('p ') ||
        lower.startsWith('xã') ||
        lower.startsWith('xa') ||
        lower.startsWith('x.') ||
        lower.startsWith('x ') ||
        lower.startsWith('thị trấn') ||
        lower.startsWith('thi tran') ||
        lower.startsWith('tt.') ||
        lower.startsWith('tt '))
    ) {
      foundWard = part;
      continue;
    }

    // Nhận diện Tỉnh / Thành phố
    if (
      !foundCity &&
      (lower.startsWith('thành phố') ||
        lower.startsWith('thanh pho') ||
        lower.startsWith('tp.') ||
        lower.startsWith('tp ') ||
        lower.startsWith('tỉnh') ||
        lower.startsWith('tinh') ||
        lower === 'hà nội' ||
        lower === 'ha noi' ||
        lower === 'hồ chí minh' ||
        lower === 'ho chi minh' ||
        lower === 'đà nẵng' ||
        lower === 'da nang' ||
        lower === 'hải phòng' ||
        lower === 'hai phong' ||
        lower === 'cần thơ' ||
        lower === 'can tho')
    ) {
      foundCity = part;
    }
  }

  // Nếu chưa tìm ra Thành phố, thường phần tử cuối cùng là Tỉnh/Thành phố
  if (!foundCity) {
    foundCity = parts[parts.length - 1];
  }

  // Nếu chưa tìm ra Phường, thử lấy phần tử thứ 2 (hoặc phần tử đầu nếu chỉ có 2)
  if (!foundWard) {
    if (parts.length >= 3) {
      foundWard = parts[1];
    } else if (parts.length === 2) {
      foundWard = parts[0];
    }
  }

  if (foundWard && foundCity && foundWard.toLowerCase() !== foundCity.toLowerCase()) {
    return `${foundWard}, ${foundCity}`;
  }

  return foundCity || foundWard || raw;
}

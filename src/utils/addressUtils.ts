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
    if (rawSaved && rawSaved !== 'undefined' && rawSaved !== 'null' && rawSaved.trim() !== '') {
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
    if (rawUser && rawUser !== 'undefined' && rawUser !== 'null' && rawUser.trim() !== '') {
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
    if (address !== undefined && address !== null && address !== 'undefined') {
      localStorage.setItem(
        'secondlife_seller_profile_address',
        JSON.stringify({
          address: address || '',
          wardName: wardName || '',
          provinceName: provinceName || '',
        })
      );
    }
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

  // 2. Nếu không có địa chỉ truyền vào
  if (!fullAddress || typeof fullAddress !== 'string' || !fullAddress.trim()) {
    if (cleanProv || cleanWard) {
      return cleanProv || cleanWard;
    }
    return '';
  }

  const raw = fullAddress.trim();

  // Bỏ qua giá trị chung chung 'Việt Nam' hoặc 'Toàn quốc'
  if (raw.toLowerCase() === 'việt nam' || raw.toLowerCase() === 'viet nam' || raw.toLowerCase() === 'toàn quốc') {
    return '';
  }

  // Tách địa chỉ qua các dấu phân cách thông dụng
  const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return raw;
  }

  let foundWard = cleanWard;
  let foundCity = cleanProv;

  // Kiểm tra phần tử cuối cùng: Trong chuẩn địa chỉ VN, phần tử cuối luôn là Tỉnh / Thành phố trực thuộc TW
  const lastPart = parts[parts.length - 1];
  const lastLower = lastPart.toLowerCase();
  const isLastPartCityOrProv =
    lastLower.startsWith('thành phố') ||
    lastLower.startsWith('thanh pho') ||
    lastLower.startsWith('tp.') ||
    lastLower.startsWith('tp ') ||
    lastLower.startsWith('tỉnh') ||
    lastLower.startsWith('tinh') ||
    lastLower === 'hà nội' ||
    lastLower === 'ha noi' ||
    lastLower === 'hồ chí minh' ||
    lastLower === 'ho chi minh' ||
    lastLower === 'đà nẵng' ||
    lastLower === 'da nang' ||
    lastLower === 'hải phòng' ||
    lastLower === 'hai phong' ||
    lastLower === 'cần thơ' ||
    lastLower === 'can tho';

  if (!foundCity && isLastPartCityOrProv) {
    foundCity = lastPart;
  }

  // Duyệt các phần tử trước đó để tìm Phường/Xã hoặc Quận/Huyện/TP thuộc tỉnh
  for (let i = 0; i < parts.length - (foundCity ? 1 : 0); i++) {
    const part = parts[i];
    const lower = part.toLowerCase();

    // Nhận diện Phường / Xã / Thị trấn (ưu tiên cao nhất cho Ward)
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

    // Nhận diện Tỉnh / Thành phố nếu chưa tìm thấy ở phần tử cuối
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

  // Nếu chưa có City, lấy phần tử cuối cùng
  if (!foundCity) {
    foundCity = parts[parts.length - 1];
  }

  // Nếu chưa có Phường/Xã, thử tìm Quận/Huyện/Thị xã/Thành phố thuộc tỉnh (ở vị trí kế cuối)
  if (!foundWard) {
    for (let i = parts.length - 2; i >= 0; i--) {
      const part = parts[i];
      const lower = part.toLowerCase();
      if (
        lower.startsWith('quận') ||
        lower.startsWith('quan') ||
        lower.startsWith('q.') ||
        lower.startsWith('q ') ||
        lower.startsWith('huyện') ||
        lower.startsWith('huyen') ||
        lower.startsWith('h.') ||
        lower.startsWith('h ') ||
        lower.startsWith('thị xã') ||
        lower.startsWith('thi xa') ||
        lower.startsWith('tx.') ||
        lower.startsWith('tx ') ||
        lower.startsWith('thành phố') ||
        lower.startsWith('thanh pho') ||
        lower.startsWith('tp.') ||
        lower.startsWith('tp ')
      ) {
        foundWard = part;
        break;
      }
    }
  }

  // Nếu vẫn chưa có Ward, lấy phần tử thứ 2 (hoặc phần tử đầu)
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

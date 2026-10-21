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
 * Kiểm tra xem một chuỗi địa chỉ đã là địa chỉ đầy đủ (có phường/xã và tỉnh/thành phố) hay chưa.
 */
export function isFullAddress(address?: string | null): boolean {
  if (!address || typeof address !== 'string') return false;
  const lower = address.toLowerCase();

  const hasWard =
    lower.includes('phường') ||
    lower.includes('phuong') ||
    lower.includes('p.') ||
    lower.includes('xã') ||
    lower.includes('xa') ||
    lower.includes('thị trấn') ||
    lower.includes('thi tran');

  const hasCityOrProv =
    lower.includes('thành phố') ||
    lower.includes('thanh pho') ||
    lower.includes('tp.') ||
    lower.includes('tp ') ||
    lower.includes('tỉnh') ||
    lower.includes('tinh') ||
    lower.includes('hà nội') ||
    lower.includes('hồ chí minh') ||
    lower.includes('đà nẵng') ||
    lower.includes('việt nam') ||
    lower.includes('vietnam');

  return hasWard && hasCityOrProv;
}

/**
 * Làm sạch chuỗi địa chỉ đầy đủ:
 * - Cắt bỏ phần đuôi bị lặp lại sau "Việt Nam" hoặc sau tên tỉnh/thành phố đã có
 *   (ví dụ "...Việt Nam, Phường Long Bình, Thành phố Thủ Đức, TP. Hồ Chí Minh" -> "...Thành phố Hồ Chí Minh")
 * - Loại bỏ từ "Việt Nam" thừa ở cuối nếu muốn hiển thị gọn gàng
 * - Khử trùng lặp các phân đoạn lặp lại
 */
export function cleanFullAddress(rawAddress?: string | null): string {
  if (!rawAddress || typeof rawAddress !== 'string' || !rawAddress.trim()) {
    return '';
  }

  const trimmed = rawAddress.trim();
  const parts = trimmed.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return trimmed;
  }

  // 1. Kiểm tra nếu có phân đoạn "Việt Nam" / "Vietnam"
  // Trong địa chỉ chuẩn, "Việt Nam" là cấp quốc gia. Mọi phân đoạn sau đó (như ", Phường Long Bình, Thành phố Thủ Đức...")
  // chắc chắn là phần đuôi ghép nối thừa từ form/api.
  const vnIndex = parts.findIndex((p) => {
    const l = p.toLowerCase();
    return l === 'việt nam' || l === 'viet nam' || l === 'vietnam';
  });

  let validParts = parts;
  if (vnIndex !== -1 && vnIndex < parts.length - 1) {
    // Cắt bỏ triệt để toàn bộ đuôi thừa sau "Việt Nam"
    validParts = parts.slice(0, vnIndex);
  } else if (vnIndex === parts.length - 1) {
    // Bỏ chữ "Việt Nam" ở cuối để hiển thị tự nhiên đến cấp Tỉnh/Thành phố
    validParts = parts.slice(0, vnIndex);
  }

  // 2. Kiểm tra nếu xuất hiện 2 lần Tỉnh/Thành phố (ví dụ có "Thành phố Hồ Chí Minh" rồi sau lại có "TP. Hồ Chí Minh")
  const isCityPart = (p: string) => {
    const l = p.toLowerCase();
    return (
      l.startsWith('thành phố') ||
      l.startsWith('thanh pho') ||
      l.startsWith('tp.') ||
      l.startsWith('tp ') ||
      l.startsWith('tỉnh') ||
      l.startsWith('tinh') ||
      l === 'hà nội' ||
      l === 'hồ chí minh' ||
      l === 'đà nẵng' ||
      l === 'hải phòng' ||
      l === 'cần thơ'
    );
  };

  let firstCityIdx = -1;
  for (let i = 0; i < validParts.length; i++) {
    if (isCityPart(validParts[i])) {
      if (firstCityIdx === -1) {
        firstCityIdx = i;
      } else {
        // Đã có 1 thành phố trước đó kèm phường -> cắt bỏ phần lặp lại đằng sau
        const hasWardBefore = validParts.slice(0, firstCityIdx).some((seg) => {
          const l = seg.toLowerCase();
          return l.includes('phường') || l.includes('xã') || l.includes('thị trấn') || l.includes('quận') || l.includes('huyện');
        });
        if (hasWardBefore) {
          validParts = validParts.slice(0, firstCityIdx + 1);
          break;
        }
      }
    }
  }

  // 3. Khử trùng lặp phân đoạn liên tiếp
  const deduped: string[] = [];
  for (const part of validParts) {
    const last = deduped[deduped.length - 1];
    if (!last || last.toLowerCase() !== part.toLowerCase()) {
      deduped.push(part);
    }
  }

  return deduped.join(', ');
}

/**
 * Ghép địa chỉ một cách thông minh:
 * Nếu streetAddress đã là địa chỉ đầy đủ (từ GPS / Map Picker), dùng luôn streetAddress sau khi làm sạch.
 * Chỉ nối thêm ward/district/province khi streetAddress chỉ là số nhà/tên đường ngắn.
 */
export function formatCombinedAddress(
  street?: string | null,
  ward?: string | null,
  district?: string | null,
  province?: string | null
): string {
  const cleanStreet = (street || '').trim();
  const cleanWard = (ward || '').trim();
  const cleanDist = (district || '').trim();
  const cleanProv = (province || '').trim();

  // Nếu street đã chứa cả phường và thành phố (đầy đủ từ map picker)
  if (isFullAddress(cleanStreet)) {
    return cleanFullAddress(cleanStreet);
  }

  const parts: string[] = [];
  if (cleanStreet) parts.push(cleanStreet);

  // Chỉ thêm ward nếu trong street chưa có ward này
  if (cleanWard && (!cleanStreet || !cleanStreet.toLowerCase().includes(cleanWard.toLowerCase()))) {
    parts.push(cleanWard);
  }

  // Chỉ thêm district nếu trong street chưa có district này
  if (cleanDist && (!cleanStreet || !cleanStreet.toLowerCase().includes(cleanDist.toLowerCase()))) {
    parts.push(cleanDist);
  }

  // Chỉ thêm province nếu trong street chưa có province này
  if (cleanProv && (!cleanStreet || !cleanStreet.toLowerCase().includes(cleanProv.toLowerCase()))) {
    parts.push(cleanProv);
  }

  return cleanFullAddress(parts.join(', '));
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
          address: cleanFullAddress(parsed.address) || parsed.address || '',
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
          address: cleanFullAddress(u.pickupAddress || u.address) || u.pickupAddress || u.address || '',
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
      const cleaned = cleanFullAddress(address);
      localStorage.setItem(
        'secondlife_seller_profile_address',
        JSON.stringify({
          address: cleaned || address || '',
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
  // Làm sạch địa chỉ trước khi trích xuất
  const cleanedAddress = cleanFullAddress(fullAddress);

  // 1. Nếu đã có sẵn wardName và provinceName
  const cleanWard = (wardName || '').trim();
  const cleanProv = (provinceName || '').trim();

  if (cleanWard && cleanProv) {
    return `${cleanWard}, ${cleanProv}`;
  }

  // 2. Nếu không có địa chỉ truyền vào
  if (!cleanedAddress || typeof cleanedAddress !== 'string' || !cleanedAddress.trim()) {
    if (cleanProv || cleanWard) {
      return cleanProv || cleanWard;
    }
    return '';
  }

  const raw = cleanedAddress.trim();

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

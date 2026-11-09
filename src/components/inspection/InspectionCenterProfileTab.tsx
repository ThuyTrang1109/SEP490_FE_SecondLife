import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Phone,
  Building2,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Edit3,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  Save,
  X,
  Compass,
  Lock,
  LocateFixed,
} from 'lucide-react';
import { InspectionCenterProfile, UpdateInspectionCenterProfileRequest, Language } from '../../types';
import { inspectorService } from '../../services/inspectorService';
import { shippingService } from '../../services/shippingService';

interface InspectionCenterProfileTabProps {
  profile: InspectionCenterProfile | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onProfileUpdated: (updated: InspectionCenterProfile) => void;
  lang?: Language;
}

export interface ParsedAdministrativeAddress {
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
}

/**
 * Trích xuất và phân tách địa chỉ trả về từ reverse-geocode (Geoapify/BE) thành 4 trường hành chính:
 * - province (Tỉnh/Thành phố)
 * - district (Quận/Huyện - nếu có)
 * - ward (Phường/Xã)
 * - streetAddress (Số nhà, Tên đường, Tòa nhà - KHÔNG lặp lại Phường/Xã/Tỉnh)
 */
export function parseReverseGeocodedAddress(
  fullAddress: string,
  cityHint?: string
): ParsedAdministrativeAddress {
  if (!fullAddress || typeof fullAddress !== 'string') {
    return { province: '', district: '', ward: '', streetAddress: '' };
  }

  // Phân tách theo dấu phẩy và làm sạch khoảng trắng
  let parts = fullAddress
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 1. Loại bỏ tên quốc gia ở cuối nếu có ("Việt Nam", "Vietnam", "VN")
  if (parts.length > 0 && /^(việt nam|vietnam|vn)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }

  let province = '';
  let district = '';
  let ward = '';

  // 2. Trích xuất Tỉnh / Thành phố (thường là phần tử cuối cùng sau khi bỏ Quốc gia)
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (
      /^(thành phố|tp\.?|tỉnh)\b/i.test(lastPart) ||
      /hồ chí minh|hà nội|đà nẵng|bình dương|bà rịa|quảng nam/i.test(lastPart) ||
      parts.length >= 3
    ) {
      province = lastPart;
      parts.pop();
    }
  }

  // 3. Quét các phần tử tiếp theo từ cuối lên để nhận diện Quận/Huyện và Phường/Xã
  while (parts.length > 0) {
    const candidate = parts[parts.length - 1];

    const isDistrict = /^(quận|huyện|thị xã|tp\.?|thành phố|district)\b/i.test(candidate);
    const isWard = /^(phường|xã|thị trấn|ward)\b/i.test(candidate);

    if (!district && isDistrict) {
      district = candidate;
      parts.pop();
    } else if (!ward && isWard) {
      ward = candidate;
      parts.pop();
    } else {
      break;
    }
  }

  // 4. Nếu Phường/Xã chưa được nhận diện từ cuối, kiểm tra xem có phần tử nào chứa tiền tố Phường/Xã
  if (!ward) {
    const wardIdx = parts.findIndex((p) => /^(phường|xã|thị trấn)\b/i.test(p));
    if (wardIdx !== -1) {
      ward = parts[wardIdx];
      parts.splice(wardIdx, 1);
    }
  }

  // 5. Nếu Quận/Huyện chưa được nhận diện từ cuối, kiểm tra xem có phần tử nào chứa tiền tố Quận/Huyện
  if (!district) {
    const distIdx = parts.findIndex((p) => /^(quận|huyện|thị xã)\b/i.test(p));
    if (distIdx !== -1) {
      district = parts[distIdx];
      parts.splice(distIdx, 1);
    }
  }

  // 6. Theo cấu trúc BE CurrentVietnameseAddress: [phần địa chỉ vật lý...], wardName, cityName, "Việt Nam"
  // Nếu ward vẫn trống nhưng còn từ 2 phần tử trở lên, phần tử sát tỉnh/thành phố chính là ward
  if (!ward && parts.length >= 2) {
    ward = parts.pop()!;
  }

  // 7. Tất cả phần còn lại ở đầu chính là Số nhà, Tên đường, Tòa nhà, Địa danh
  let streetAddress = parts.join(', ').trim();

  // Fallback: nếu streetAddress bị rỗng, lấy tạm ward làm địa chỉ vật lý
  if (!streetAddress && ward) {
    streetAddress = ward;
  }

  // 8. Chuẩn hóa tên Tỉnh / Thành phố theo 2 khu vực dịch vụ hỗ trợ của Lalamove:
  // "Thành phố Hồ Chí Minh" (kèm Bình Dương, Đồng Nai, Vũng Tàu), "Thành phố Hà Nội" (kèm Bắc Ninh, Hải Phòng, Hưng Yên, Ninh Bình)
  const checkCity = (province + ' ' + (cityHint || '')).toLowerCase();
  if (/hồ chí minh|hochiminh|hcm|sài gòn|saigon|bình dương|bà rịa|vũng tàu|đồng nai/i.test(checkCity)) {
    province = 'Thành phố Hồ Chí Minh';
  } else if (/hà nội|hanoi|bắc ninh|hải phòng|hưng yên|ninh bình/i.test(checkCity)) {
    province = 'Thành phố Hà Nội';
  }

  return {
    province,
    district,
    ward,
    streetAddress,
  };
}

export const InspectionCenterProfileTab: React.FC<InspectionCenterProfileTabProps> = ({
  profile,
  isLoading,
  error,
  onRefresh,
  onProfileUpdated,
  lang = 'vi',
}) => {
  // Form editing mode
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Form Fields: Thông tin liên hệ (người dùng nhập)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Form Fields: Địa chỉ hành chính (KHÔNG cho nhập tay, chỉ quy đổi từ GPS)
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  // Tọa độ GPS
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Map search & geocoding state
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isPinConfirmed, setIsPinConfirmed] = useState(false);
  const [geocodingNotice, setGeocodingNotice] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState<string | null>(null);

  // Leaflet map container and instances
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletMarkerRef = useRef<any>(null);

  // Sync state from profile
  const syncFormFromProfile = useCallback((p: InspectionCenterProfile | null) => {
    if (!p) return;
    setName(p.name || '');
    setPhone(p.phone || '');
    setProvince(p.province || '');
    setDistrict(p.district || '');
    setWard(p.ward || '');
    setStreetAddress(p.streetAddress || '');
    setLatitude(p.latitude ?? null);
    setLongitude(p.longitude ?? null);
    setIsPinConfirmed(Boolean(p.shippingAddressConfigured && p.latitude && p.longitude));
    setReverseGeocodedAddress(p.address || null);
    setGeocodingNotice(null);
    setSearchKeyword('');
    setSaveError(null);
    setSaveSuccess(null);

    // If center address is not configured yet, open edit mode automatically
    if (!p.shippingAddressConfigured) {
      setIsEditing(true);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      syncFormFromProfile(profile);
    }
  }, [profile, syncFormFromProfile]);

  // Quy đổi tọa độ GPS thành địa chỉ hành chính chi tiết
  const handleReverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    setGeocodingNotice(null);
    try {
      const res = await shippingService.reverseGeocode(lat, lng);
      if (res && res.address) {
        setReverseGeocodedAddress(res.address);
        const parsed = parseReverseGeocodedAddress(res.address, res.city);
        setProvince(parsed.province);
        setDistrict(parsed.district);
        setWard(parsed.ward);
        setStreetAddress(parsed.streetAddress);
        setIsPinConfirmed(true);
      }
    } catch (err: any) {
      console.warn('Reverse geocode error:', err);
      setIsPinConfirmed(false);
      setGeocodingNotice(
        err?.message ||
          'Không thể tra cứu địa chỉ từ tọa độ này. Quý trung tâm vui lòng chọn điểm trong khu vực phục vụ (Hà Nội và TP.HCM).'
      );
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Tìm kiếm địa điểm/địa chỉ trên bản đồ
  const handleSearchOnMap = async () => {
    const query = searchKeyword.trim();
    if (query.length < 3) {
      setGeocodingNotice('Vui lòng nhập từ khóa tìm kiếm (tên đường, tòa nhà, địa danh) từ 3 ký tự trở lên.');
      return;
    }

    setIsGeocoding(true);
    setGeocodingNotice(null);
    try {
      const result = await shippingService.geocode(query);
      if (result && typeof result.latitude === 'number' && typeof result.longitude === 'number') {
        const lat = Number(result.latitude.toFixed(6));
        const lng = Number(result.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);

        // Di chuyển bản đồ & điểm ghim
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lng], 16);
          if (leafletMarkerRef.current) {
            leafletMarkerRef.current.setLatLng([lat, lng]);
          }
        }

        // Gọi reverseGeocode để phân tách địa chỉ chuẩn xác
        await handleReverseGeocode(lat, lng);
      } else {
        setGeocodingNotice('Không tìm thấy tọa độ phù hợp. Quý trung tâm vui lòng click chọn điểm trực tiếp trên bản đồ.');
      }
    } catch (err: any) {
      console.warn('Geocoding search error:', err);
      setGeocodingNotice(err?.message || 'Lỗi tra cứu địa chỉ. Quý trung tâm vui lòng click chọn điểm trực tiếp trên bản đồ.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Leaflet map setup and lifecycle
  useEffect(() => {
    let isCancelled = false;

    const setupMap = () => {
      if (!mapContainerRef.current || isCancelled) return;
      const L = (window as any).L;
      if (!L) return;

      // Default to saved coordinates, or HCMC as visual fallback
      const initialLat = typeof latitude === 'number' && latitude !== 0 ? latitude : 10.7769;
      const initialLng = typeof longitude === 'number' && longitude !== 0 ? longitude : 106.7009;
      const hasRealCoords = typeof latitude === 'number' && latitude !== 0;

      if (!leafletMapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: hasRealCoords ? 16 : 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '&copy; Google Maps | SecondLife Hub Logistics',
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
            <div style="background: #c34c36; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 2px;">
              Cửa Tiếp Nhận Hub
            </div>
            <div style="width: 26px; height: 26px; background: #c34c36; border: 3px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 8px rgba(0,0,0,0.35);"></div>
          </div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 42],
        });

        const marker = L.marker([initialLat, initialLng], {
          draggable: isEditing,
          icon: pinIcon,
        }).addTo(map);

        marker.on('dragend', () => {
          if (!isEditing) return;
          const pos = marker.getLatLng();
          const lat = Number(pos.lat.toFixed(6));
          const lng = Number(pos.lng.toFixed(6));
          setLatitude(lat);
          setLongitude(lng);
          handleReverseGeocode(lat, lng);
        });

        map.on('click', (e: any) => {
          if (!isEditing) return;
          marker.setLatLng(e.latlng);
          const lat = Number(e.latlng.lat.toFixed(6));
          const lng = Number(e.latlng.lng.toFixed(6));
          setLatitude(lat);
          setLongitude(lng);
          handleReverseGeocode(lat, lng);
        });

        leafletMapRef.current = map;
        leafletMarkerRef.current = marker;
      } else {
        // Map instance exists, update view and marker
        leafletMapRef.current.setView([initialLat, initialLng], hasRealCoords ? 16 : 13);
        if (leafletMarkerRef.current) {
          leafletMarkerRef.current.setLatLng([initialLat, initialLng]);
          if (leafletMarkerRef.current.dragging) {
            isEditing
              ? leafletMarkerRef.current.dragging.enable()
              : leafletMarkerRef.current.dragging.disable();
          }
        }
      }
    };

    if ((window as any).L) {
      setupMap();
    } else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => setupMap();
        document.head.appendChild(script);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [isEditing, latitude, longitude, handleReverseGeocode]);

  // Form validation before submitting
  const validateForm = (): string | null => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return 'Tên trung tâm phải từ 2 đến 100 ký tự sau khi chuẩn hóa.';
    }

    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    const vnPhoneRegex = /^(?:0|\+?84)[0-9]{9,10}$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      return 'Số điện thoại hotline không hợp lệ. Vui lòng nhập số điện thoại Việt Nam bắt đầu bằng 0, 84 hoặc +84 (10-11 chữ số).';
    }

    if (latitude === null || isNaN(latitude) || latitude < -90 || latitude > 90 || latitude === 0) {
      return 'Tọa độ Vĩ độ (Latitude) không hợp lệ. Vui lòng chọn hoặc ghim điểm tiếp nhận trên bản đồ.';
    }

    if (longitude === null || isNaN(longitude) || longitude < -180 || longitude > 180 || longitude === 0) {
      return 'Tọa độ Kinh độ (Longitude) không hợp lệ. Vui lòng chọn hoặc ghim điểm tiếp nhận trên bản đồ.';
    }

    const trimmedProvince = province.trim();
    if (!trimmedProvince) {
      return 'Chưa xác định được Tỉnh / Thành phố từ GPS. Vui lòng chọn điểm tiếp nhận trên bản đồ.';
    }

    const trimmedWard = ward.trim();
    if (!trimmedWard) {
      return 'Chưa xác định được Phường / Xã từ GPS. Vui lòng chọn điểm tiếp nhận trên bản đồ.';
    }

    const trimmedStreet = streetAddress.trim();
    if (!trimmedStreet) {
      return 'Chưa xác định được Số nhà & Tên đường từ GPS. Vui lòng chọn điểm tiếp nhận trên bản đồ.';
    }

    if (!isPinConfirmed) {
      return 'Vui lòng xác nhận điểm tiếp nhận trên bản đồ bằng cách bấm "Xác nhận vị trí GPS này".';
    }

    const fullLen = [trimmedStreet, trimmedWard, district?.trim(), trimmedProvince].filter(Boolean).join(', ').length;
    if (fullLen > 500) {
      return 'Địa chỉ ghép hoàn chỉnh vượt quá 500 ký tự cho phép.';
    }

    return null;
  };

  // Submit profile update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const validationMsg = validateForm();
    if (validationMsg) {
      setSaveError(validationMsg);
      return;
    }

    setIsSaving(true);
    try {
      const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      const payload: UpdateInspectionCenterProfileRequest = {
        name: name.trim(),
        phone: cleanPhone,
        province: province.trim(),
        district: district.trim() || null,
        ward: ward.trim(),
        streetAddress: streetAddress.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
      };

      const updated = await inspectorService.updateCenterProfile(payload);
      setSaveSuccess('Cập nhật hồ sơ và địa chỉ tiếp nhận kiện hàng thành công!');
      setIsEditing(false);
      onProfileUpdated(updated);
    } catch (err: any) {
      console.error('Failed to update center profile:', err);
      const msg = err?.message || 'Không thể cập nhật hồ sơ trung tâm kiểm định.';
      const detailErrors = Array.isArray(err?.errors) ? `: ${err.errors.join(', ')}` : '';
      setSaveError(`${msg}${detailErrors}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview địa chỉ hoàn chỉnh sạch (ghép đúng thứ tự, không lặp lại)
  const previewAddress = [streetAddress.trim(), ward.trim(), district.trim(), province.trim()]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HEADER CARD                                                            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left Block: Icon + Center Name + Address */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#c34c36]/15 via-[#24263e]/10 to-[#c34c36]/5 border border-[#c34c36]/30 flex items-center justify-center shrink-0 text-[#c34c36] shadow-xs">
              <MapPin className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                  {profile?.name || name || 'Trung Tâm Kiểm Định'}
                </h2>
                {profile?.shippingAddressConfigured ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Đã cấu hình tiếp nhận hàng
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Chưa cấu hình địa chỉ & GPS
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 font-medium">
                <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {profile?.address || previewAddress || 'Chưa thiết lập địa chỉ tiếp nhận kiện hàng & tọa độ GPS'}
                </span>
              </p>
            </div>
          </div>

          {/* Right Block: Hotline + Edit Action Button */}
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-400 mr-1.5">Hotline:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {profile?.phone || phone || 'Chưa cấu hình'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  // Cancel / close form
                  setIsEditing(false);
                  syncFormFromProfile(profile);
                } else {
                  setIsEditing(true);
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isEditing
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  : 'bg-[#24263e] text-white hover:bg-[#1a1b2d]'
              }`}
            >
              {isEditing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Đóng Form Chỉnh Sửa</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh Sửa Thông Tin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global Load Error */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Unconfigured Warning Alert */}
      {!isLoading && profile && !profile.shippingAddressConfigured && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-2 text-xs shadow-xs">
          <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Yêu cầu cấu hình địa chỉ tiếp nhận & tọa độ GPS</span>
          </div>
          <p className="text-amber-800 leading-relaxed font-medium">
            Hồ sơ trung tâm kiểm định hiện chưa có địa chỉ chi tiết hoặc tọa độ GPS xác nhận. Hệ thống điều phối vận tải Lalamove (chặng Seller → Hub) và tính cước di chuyển KTV cần tọa độ GPS này để lấy giá và định tuyến chính xác. Vui lòng chọn vị trí trên bản đồ để hệ thống tự động quy đổi địa chỉ tiếp nhận.
          </p>
        </div>
      )}

      {/* Success Save Notice */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between font-bold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Save Error Notice */}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between font-medium shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-rose-700 hover:text-rose-900 text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#c34c36] mx-auto" />
          <p className="text-xs font-bold text-slate-700">Đang tải hồ sơ tự quản trung tâm kiểm định...</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN FORM: VIEW OR EDIT                                                */}
      {/* ========================================================================= */}
      {!isLoading && profile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#c34c36]" />
                <span>{isEditing ? 'Cập Nhật Hồ Sơ & Địa Chỉ Tiếp Nhận' : 'Chi Tiết Hồ Sơ & Địa Chỉ Tiếp Nhận'}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditing
                  ? 'Chọn điểm tiếp nhận trên bản đồ hoặc nhập tọa độ để hệ thống tự động quy đổi địa chỉ hành chính (không nhập tay).'
                  : 'Hồ sơ này dùng để hiển thị trên chứng thư, định vị trạm tiếp nhận kiện hàng và tính cước di chuyển.'}
              </p>
            </div>
            {profile.updatedAt && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Cập nhật lần cuối: {new Date(profile.updatedAt).toLocaleDateString('vi-VN')}{' '}
                {new Date(profile.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-7">
            {/* Section 1: Thông Tin Định Danh & Hotline Liên Hệ */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <span>1. Thông Tin Định Danh & Hotline Tiếp Nhận</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Tên Trung Tâm Kiểm Định <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isEditing || isSaving}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Trung tâm Kiểm định Quận 7"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                  />
                  <p className="text-[10px] text-slate-400">
                    Từ 2 đến 100 ký tự. Tên này đồng thời là tên hiển thị của tài khoản và tên Hub của các kỹ thuật viên.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Số Điện Thoại Hotline Tiếp Nhận <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      disabled={!isEditing || isSaving}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ví dụ: 02838229999 hoặc 0912345678"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Số điện thoại Việt Nam bắt đầu bằng 0, 84 hoặc +84 (10–11 chữ số). Không nhập dấu ngoặc hay khoảng trắng.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Chọn Điểm Tiếp Nhận Hàng & Định Vị Tọa Độ GPS Trên Bản Đồ (QUAN TRỌNG) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>2. Chọn Vị Trí Tiếp Nhận Trên Bản Đồ & Tọa Độ GPS</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEditing
                      ? 'Nhấp chuột vào bản đồ hoặc kéo ghim để định vị vị trí trạm tiếp nhận. Hệ thống sẽ tự động quy đổi ra địa chỉ hành chính tương ứng.'
                      : 'Vị trí trạm tiếp nhận đã được lưu để lấy giá và định tuyến các chuyến xe Lalamove.'}
                  </p>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPinConfirmed(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isPinConfirmed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 text-white ring-2 ring-amber-300 animate-pulse'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isPinConfirmed ? '✓ Vị trí GPS đã xác nhận' : 'Xác nhận vị trí GPS này'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tìm kiếm địa điểm để ghim */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchOnMap();
                        }
                      }}
                      placeholder="Tìm kiếm địa chỉ, tên đường, tòa nhà hoặc địa danh (VD: 1059 Nguyễn Văn Linh, Crescent Plaza hoặc Heart Lake)..."
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchOnMap}
                    disabled={isGeocoding || isSaving}
                    className="px-4 py-2.5 rounded-xl bg-[#24263e] hover:bg-[#1a1b2d] text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition cursor-pointer disabled:opacity-50"
                  >
                    {isGeocoding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="w-3.5 h-3.5" />
                    )}
                    <span>Tìm Trên Bản Đồ</span>
                  </button>
                </div>
              )}

              {/* Thông báo lỗi / trạng thái Geocoding */}
              {geocodingNotice && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{geocodingNotice}</span>
                </div>
              )}

              {/* Địa chỉ nhận diện từ GPS */}
              {reverseGeocodedAddress && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">
                      <strong>Địa chỉ nhận diện từ GPS:</strong> {reverseGeocodedAddress}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200/80 text-blue-800 px-2 py-0.5 rounded-md shrink-0">
                    Khớp bản đồ
                  </span>
                </div>
              )}

              {/* Khung bản đồ tương tác */}
              <div className="relative w-full h-[340px] sm:h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                <div ref={mapContainerRef} className="w-full h-full z-10" />

                {/* Map Floating Badge */}
                <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{isEditing ? 'Nhấp bản đồ hoặc kéo ghim để đổi vị trí' : 'Vị trí tiếp nhận Hub'}</span>
                </div>
              </div>

              {/* Nhập / Hiển thị Tọa Độ GPS (Vĩ Độ & Kinh Độ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Vĩ Độ (Latitude) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Hợp lệ: -90 đến 90</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    disabled={!isEditing || isSaving}
                    value={latitude !== null ? latitude : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLatitude(isNaN(val) ? null : val);
                      setIsPinConfirmed(false);
                    }}
                    placeholder="Ví dụ: 10.730000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Kinh Độ (Longitude) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Hợp lệ: -180 đến 180</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    disabled={!isEditing || isSaving}
                    value={longitude !== null ? longitude : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLongitude(isNaN(val) ? null : val);
                      setIsPinConfirmed(false);
                    }}
                    placeholder="Ví dụ: 106.705000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                  />
                </div>
              </div>

              {/* Nút quy đổi lại từ tọa độ nếu người dùng nhập số trực tiếp */}
              {isEditing && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isGeocoding || latitude === null || longitude === null}
                    onClick={() => {
                      if (latitude !== null && longitude !== null) {
                        if (leafletMapRef.current) {
                          leafletMapRef.current.setView([latitude, longitude], 16);
                          leafletMarkerRef.current?.setLatLng([latitude, longitude]);
                        }
                        handleReverseGeocode(latitude, longitude);
                      }
                    }}
                    className="text-xs font-bold text-[#c34c36] hover:text-[#9e3320] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeocoding ? 'animate-spin' : ''}`} />
                    <span>Quy đổi địa chỉ từ tọa độ này</span>
                  </button>
                </div>
              )}
            </div>

            {/* Section 3: Địa Chỉ Hành Chính Tiếp Nhận Kiện Hàng (HOÀN TOÀN TỰ ĐỘNG, KHÔNG CHO NHẬP TAY) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>3. Địa Chỉ Hành Chính Tiếp Nhận Kiện Hàng</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống trích xuất tự động từ tọa độ GPS và điểm ghim trên bản đồ để đảm bảo định tuyến Lalamove chính xác, không cho phép nhập tay.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0 self-start sm:self-auto">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Quy đổi tự động từ GPS (Không nhập tay)</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Tỉnh / Thành Phố <span className="text-rose-500">*</span>
                    </span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={province}
                    placeholder="Tự động từ GPS..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-100/80 text-slate-700 cursor-not-allowed select-none outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Thuộc khu vực phục vụ: Hà Nội và TP.HCM.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Quận / Huyện</span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={district}
                    placeholder="Tự động từ GPS (nếu có)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-100/80 text-slate-700 cursor-not-allowed select-none outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Có thể để trống theo mô hình hai cấp.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Phường / Xã <span className="text-rose-500">*</span>
                    </span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={ward}
                    placeholder="Tự động từ GPS..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-100/80 text-slate-700 cursor-not-allowed select-none outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Xác định theo ranh giới hành chính tọa độ.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>
                    Số Nhà, Tên Đường, Tòa Nhà <span className="text-rose-500">*</span>
                  </span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={streetAddress}
                  placeholder="Tự động từ GPS (không lặp lại phường, quận hay thành phố)..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-100/80 text-slate-700 cursor-not-allowed select-none outline-none"
                />
                <p className="text-[10px] text-slate-400">
                  Địa chỉ vật lý (số nhà, đường, tòa nhà) được tách riêng, không lặp lại phường và tỉnh/thành.
                </p>
              </div>

              {/* Chuỗi Địa Chỉ Ghép Preview */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-500 mr-1.5">Địa chỉ hoàn chỉnh xem trước:</span>
                  <span className="font-semibold text-slate-800 break-words">
                    {previewAddress || 'Vui lòng ghim vị trí trên bản đồ để xác định địa chỉ'}
                  </span>
                </div>
                {previewAddress && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0 border border-emerald-200 self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Địa chỉ hợp lệ
                  </span>
                )}
              </div>
            </div>

            {/* Section 4: Action Buttons */}
            {isEditing && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setIsEditing(false);
                    syncFormFromProfile(profile);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Lưu Hồ Sơ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu Thông Tin Hồ Sơ & Địa Chỉ</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

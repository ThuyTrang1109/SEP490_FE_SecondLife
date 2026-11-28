import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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

function isValidCoordinate(value: number | null, limit: number): value is number {
  return value !== null && Number.isFinite(value) && value !== 0 && Math.abs(value) <= limit;
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
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const lookupRef = useRef<AbortController | null>(null);
  const showProfileForm = !isLoading && profile !== null;
  const canEditLocation = isEditing && !isSaving;
  const hasCoordinates = isValidCoordinate(latitude, 90) && isValidCoordinate(longitude, 180);

  const cancelLocationLookup = useCallback(() => {
    lookupRef.current?.abort();
    lookupRef.current = null;
  }, []);

  useEffect(() => cancelLocationLookup, [cancelLocationLookup]);

  const startLocationLookup = useCallback(() => {
    cancelLocationLookup();
    const controller = new AbortController();
    lookupRef.current = controller;
    setIsGeocoding(true);
    setGeocodingNotice(null);
    return controller;
  }, [cancelLocationLookup]);

  const finishLocationLookup = useCallback((controller: AbortController) => {
    if (lookupRef.current !== controller) return;
    lookupRef.current = null;
    setIsGeocoding(false);
  }, []);

  const clearLocationAddress = useCallback(() => {
    setIsPinConfirmed(false);
    setReverseGeocodedAddress(null);
    setProvince('');
    setDistrict('');
    setWard('');
    setStreetAddress('');
  }, []);

  // Sync state from profile
  const syncFormFromProfile = useCallback((p: InspectionCenterProfile | null) => {
    if (!p) return;
    cancelLocationLookup();
    setIsGeocoding(false);
    setName(p.name || '');
    setPhone(p.phone || '');
    setProvince(p.province || '');
    setDistrict(p.district || '');
    setWard(p.ward || '');
    setStreetAddress(p.streetAddress || '');
    setLatitude(p.latitude ?? null);
    setLongitude(p.longitude ?? null);
    if (isValidCoordinate(p.latitude ?? null, 90) && isValidCoordinate(p.longitude ?? null, 180)) {
      leafletMapRef.current?.setView([p.latitude, p.longitude], 16, { animate: false });
    }
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
  }, [cancelLocationLookup]);

  useEffect(() => {
    if (profile) {
      syncFormFromProfile(profile);
    }
  }, [profile, syncFormFromProfile]);

  // Quy đổi tọa độ GPS thành địa chỉ hành chính chi tiết
  const handleReverseGeocode = useCallback(async (lat: number, lng: number) => {
    clearLocationAddress();
    const controller = startLocationLookup();
    try {
      const result = await shippingService.reverseGeocode(lat, lng, controller.signal);
      if (controller.signal.aborted) return;
      const parsed = parseReverseGeocodedAddress(result?.address, result?.city);
      if (!parsed.province || !parsed.ward || !parsed.streetAddress) {
        setGeocodingNotice('Chưa xác định được địa chỉ đầy đủ. Vui lòng chọn điểm khác trên bản đồ.');
        return;
      }
      setReverseGeocodedAddress(result.address);
      setProvince(parsed.province);
      setDistrict(parsed.district);
      setWard(parsed.ward);
      setStreetAddress(parsed.streetAddress);
      setIsPinConfirmed(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      setGeocodingNotice(
        error instanceof Error ? error.message : 'Không thể tra cứu địa chỉ từ tọa độ này. Vui lòng chọn điểm khác trên bản đồ.'
      );
    } finally {
      finishLocationLookup(controller);
    }
  }, [clearLocationAddress, finishLocationLookup, startLocationLookup]);

  const selectLocation = useCallback((latitude: number, longitude: number, recenter = false) => {
    const lat = Number(latitude.toFixed(6));
    const lng = Number(longitude.toFixed(6));
    if (!isValidCoordinate(lat, 90) || !isValidCoordinate(lng, 180)) return;
    setLatitude(lat);
    setLongitude(lng);
    if (recenter) leafletMapRef.current?.setView([lat, lng], 16, { animate: false });
    void handleReverseGeocode(lat, lng);
  }, [handleReverseGeocode]);

  const editCoordinates = () => {
    cancelLocationLookup();
    clearLocationAddress();
    setGeocodingNotice(null);
    setIsGeocoding(false);
  };

  const resolveEnteredCoordinates = () => {
    if (!canEditLocation || isGeocoding) return;
    if (isValidCoordinate(latitude, 90) && isValidCoordinate(longitude, 180)) {
      leafletMapRef.current?.setView([latitude, longitude], 16, { animate: false });
      void handleReverseGeocode(latitude, longitude);
    }
  };

  const selectMapCenter = () => {
    const map = leafletMapRef.current;
    if (!map || !canEditLocation) return;
    const { lat, lng } = map.wrapLatLng(map.getCenter());
    selectLocation(lat, lng);
  };

  // Tìm kiếm địa điểm/địa chỉ trên bản đồ
  const handleSearchOnMap = async () => {
    if (!canEditLocation || isGeocoding) return;
    const query = searchKeyword.trim();
    if (query.length < 3) {
      setGeocodingNotice('Vui lòng nhập từ khóa tìm kiếm (tên đường, tòa nhà, địa danh) từ 3 ký tự trở lên.');
      return;
    }

    const controller = startLocationLookup();
    try {
      const result = await shippingService.geocode(query, controller.signal);
      if (controller.signal.aborted) return;
      if (result && isValidCoordinate(result.latitude, 90) && isValidCoordinate(result.longitude, 180)) {
        selectLocation(result.latitude, result.longitude, true);
      } else {
        setGeocodingNotice('Không tìm thấy tọa độ phù hợp. Vui lòng chọn điểm trực tiếp trên bản đồ.');
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setGeocodingNotice(error instanceof Error ? error.message : 'Không thể tìm địa chỉ. Vui lòng chọn điểm trực tiếp trên bản đồ.');
    } finally {
      finishLocationLookup(controller);
    }
  };

  const mapState = useRef({ latitude, longitude, canEditLocation, selectLocation });
  useLayoutEffect(() => {
    mapState.current = { latitude, longitude, canEditLocation, selectLocation };
  }, [latitude, longitude, canEditLocation, selectLocation]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!showProfileForm || !container) return;
    setMapStatus('loading');
    let script: HTMLScriptElement | null = null;

    const onScriptError = () => {
      script?.remove();
      setMapStatus('unavailable');
    };

    const setupMap = () => {
      const L = (window as any).L;
      if (!L) {
        onScriptError();
        return;
      }
      const location = mapState.current;
      const hasRealCoords = isValidCoordinate(location.latitude, 90) && isValidCoordinate(location.longitude, 180);
      const initialLat = hasRealCoords ? location.latitude : 10.7769;
      const initialLng = hasRealCoords ? location.longitude : 106.7009;

      const map = L.map(container, {
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
        html: `<div style="position: relative; width: 100%; height: 100%;">
          <div style="position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); background: #c34c36; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); white-space: nowrap;">
            Cửa tiếp nhận Hub
          </div>
          <div style="position: absolute; bottom: 5px; left: 50%; box-sizing: border-box; width: 26px; height: 26px; background: #c34c36; border: 3px solid white; border-radius: 50% 50% 50% 0; transform: translateX(-50%) rotate(-45deg); box-shadow: 0 4px 8px rgba(0,0,0,0.35);"></div>
        </div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: location.canEditLocation,
        icon: pinIcon,
      }).addTo(map);

      const onLocationSelected = (point: { lat: number; lng: number }) => {
        if (!mapState.current.canEditLocation) return;
        const { lat, lng } = map.wrapLatLng(point);
        mapState.current.selectLocation(lat, lng);
      };
      marker.on('dragend', () => onLocationSelected(marker.getLatLng()));
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => onLocationSelected(e.latlng));

      leafletMapRef.current = map;
      leafletMarkerRef.current = marker;
      setMapStatus('ready');
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
      script = document.querySelector<HTMLScriptElement>('#leaflet-js');
      if (!script) {
        script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      }
      script.addEventListener('load', setupMap, { once: true });
      script.addEventListener('error', onScriptError, { once: true });
      if (!script.isConnected) document.head.appendChild(script);
    }

    return () => {
      script?.removeEventListener('load', setupMap);
      script?.removeEventListener('error', onScriptError);
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
    };
  }, [showProfileForm]);

  useEffect(() => {
    const dragging = leafletMarkerRef.current?.dragging;
    if (canEditLocation) dragging?.enable();
    else dragging?.disable();
  }, [canEditLocation]);

  useEffect(() => {
    if (!isValidCoordinate(latitude, 90) || !isValidCoordinate(longitude, 180)) return;
    leafletMarkerRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

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

    if (!isValidCoordinate(latitude, 90)) {
      return 'Tọa độ Vĩ độ (Latitude) không hợp lệ. Vui lòng chọn hoặc ghim điểm tiếp nhận trên bản đồ.';
    }

    if (!isValidCoordinate(longitude, 180)) {
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
      return 'Vui lòng quy đổi địa chỉ từ tọa độ đã chọn trước khi lưu.';
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
    if (!canEditLocation || isGeocoding) return;
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
                  {profile?.name || name || 'Trung tâm kiểm định'}
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
              disabled={isSaving}
              onClick={() => {
                if (isEditing) {
                  // Cancel / close form
                  setIsEditing(false);
                  syncFormFromProfile(profile);
                } else {
                  setIsEditing(true);
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${isEditing
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  : 'bg-[#24263e] text-white hover:bg-[#1a1b2d]'
                }`}
            >
              {isEditing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Đóng</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa thông tin</span>
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
      {showProfileForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#c34c36]" />
                <span>{isEditing ? 'Cập nhật hồ sơ & địa chỉ tiếp nhận' : 'Chi tiết hồ sơ & địa chỉ tiếp nhận'}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditing
                  ? 'Cập nhật thông tin liên hệ và vị trí tiếp nhận của trung tâm.'
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
                <span>1. Thông tin định danh & hotline tiếp nhận</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Tên trung tâm kiểm định <span className="text-rose-500">*</span>
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
                    Số điện thoại hotline tiếp nhận <span className="text-rose-500">*</span>
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

            <section aria-labelledby="center-location-heading" className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 id="center-location-heading" className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>2. Vị trí tiếp nhận & địa chỉ GPS</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEditing
                      ? 'Nhấp vào một điểm, kéo ghim hoặc di chuyển bản đồ rồi bấm Chọn tâm bản đồ.'
                      : 'Vị trí trạm tiếp nhận đã được lưu để lấy giá và định tuyến các chuyến xe Lalamove.'}
                  </p>
                </div>

                {isPinConfirmed && (
                  <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Vị trí GPS đã xác nhận
                  </span>
                )}
              </div>

              {/* Tìm kiếm địa điểm để ghim */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled={isSaving}
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchOnMap();
                        }
                      }}
                      placeholder="Tìm kiếm địa chỉ, tên đường, tòa nhà hoặc địa danh (VD: 1059 nguyễn văn linh, crescent plaza hoặc Heart Lake)..."
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchOnMap}
                    disabled={isGeocoding || !canEditLocation}
                    className="px-4 py-2.5 rounded-xl bg-[#24263e] hover:bg-[#1a1b2d] text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition cursor-pointer disabled:opacity-50"
                  >
                    {isGeocoding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="w-3.5 h-3.5" />
                    )}
                    <span>Tìm trên bản đồ</span>
                  </button>
                </div>
              )}

              <div className="relative w-full h-[340px] sm:h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                <div ref={mapContainerRef} className="w-full h-full z-10" />
                {mapStatus !== 'ready' && (
                  <div role="status" className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-slate-50 p-4 text-center text-xs text-slate-600">
                    {mapStatus === 'loading'
                      ? 'Đang tải bản đồ…'
                      : 'Không tải được bản đồ. Bạn có thể tìm địa chỉ hoặc nhập tọa độ để chọn vị trí.'}
                  </div>
                )}
                {mapStatus === 'ready' && canEditLocation && (
                  <LocateFixed aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 text-slate-900 shadow-sm" />
                )}
                {mapStatus === 'ready' && isEditing && (
                  <button
                    type="button"
                    disabled={!canEditLocation}
                    onClick={selectMapCenter}
                    className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-100 disabled:opacity-50"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-[#c34c36]" />
                    Chọn tâm bản đồ
                  </button>
                )}
              </div>

              {/* Nhập / Hiển thị Tọa Độ GPS (Vĩ Độ & Kinh Độ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="center-latitude" className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>
                      Vĩ Độ (Latitude) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Hợp lệ: -90 đến 90</span>
                  </label>
                  <input
                    id="center-latitude"
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    required
                    disabled={!isEditing || isSaving}
                    value={latitude !== null ? latitude : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLatitude(isNaN(val) ? null : val);
                      editCoordinates();
                    }}
                    placeholder="Ví dụ: 10.730000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="center-longitude" className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>
                      Kinh Độ (Longitude) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Hợp lệ: -180 đến 180</span>
                  </label>
                  <input
                    id="center-longitude"
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    required
                    disabled={!isEditing || isSaving}
                    value={longitude !== null ? longitude : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLongitude(isNaN(val) ? null : val);
                      editCoordinates();
                    }}
                    placeholder="Ví dụ: 106.705000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none disabled:bg-slate-50 disabled:text-slate-600 transition"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                    <MapPin className="h-4 w-4 text-[#c34c36]" />
                    Địa chỉ quy đổi từ GPS
                  </h5>
                  {isEditing && (
                    <button
                      type="button"
                      disabled={isGeocoding || !canEditLocation || !hasCoordinates}
                      onClick={resolveEnteredCoordinates}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#a63f2d] hover:bg-orange-50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Quy đổi từ vĩ độ và kinh độ
                    </button>
                  )}
                </div>

                <p role="status" className="break-words text-sm font-medium text-slate-800">
                  {isGeocoding
                    ? 'Đang tra địa chỉ…'
                    : reverseGeocodedAddress || previewAddress || 'Chọn điểm trên bản đồ hoặc nhập tọa độ rồi bấm Quy đổi từ vĩ độ và kinh độ.'}
                </p>
                {geocodingNotice && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{geocodingNotice}</span>
                  </div>
                )}

                {!isGeocoding && previewAddress && (
                  <dl className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Số nhà, đường, tòa nhà', value: streetAddress },
                      { label: 'Phường / Xã', value: ward },
                      { label: 'Quận / Huyện', value: district },
                      { label: 'Tỉnh / Thành phố', value: province },
                    ].map(({ label, value }) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs text-slate-600">{label}</dt>
                        <dd className="mt-0.5 break-words text-xs font-semibold text-slate-900">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </section>

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
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isGeocoding}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu hồ sơ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu thông tin hồ sơ & địa chỉ</span>
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

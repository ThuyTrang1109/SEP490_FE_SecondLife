import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Loader2, CheckCircle2, AlertCircle, Phone, User, Building2, Search } from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import { GeocodedAddressDto } from '../../types';

export interface SelectedLocationData {
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  placeId?: string;
}

interface LalamoveAddressPickerProps {
  initialName?: string;
  initialPhone?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  initialAddress?: string;
  sellerCity?: string;
  sellerLocation?: string;
  onAddressConfirmed: (data: SelectedLocationData) => void;
  onNameChange?: (name: string) => void;
  onPhoneChange?: (phone: string) => void;
  lang?: 'vi' | 'en';
  title?: string;
  description?: string;
}

// Preset supported cities in Vietnam according to Backend Lalamove Catalog Policy
export const ALLOWED_CITIES = [
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, label: 'Hà Nội (Trung tâm Ba Đình/Hoàn Kiếm)' },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, label: 'Đà Nẵng (Hải Châu)' },
  { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009, label: 'TP. Hồ Chí Minh (Quận 1 / Bến Nghé)' },
];

export const normalizeCityKey = (cityStr?: string): 'HANOI' | 'DANANG' | 'HO_CHI_MINH' | 'OTHER' => {
  if (!cityStr) return 'OTHER';
  const clean = cityStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (clean.includes('hanoi')) return 'HANOI';
  if (clean.includes('hochiminh') || clean.includes('saigon') || clean.includes('sgn') || clean.includes('hcm')) return 'HO_CHI_MINH';
  if (clean.includes('danang') || clean.includes('dad')) return 'DANANG';
  return 'OTHER';
};

export const getShortCityName = (fullName: string): string => {
  const key = normalizeCityKey(fullName);
  if (key === 'HANOI') return 'Hà Nội';
  if (key === 'HO_CHI_MINH') return 'TP. Hồ Chí Minh';
  if (key === 'DANANG') return 'Đà Nẵng';
  return fullName.replace(/\([^)]*\)/g, '').trim() || fullName;
};

export const detectCityFromCoords = (lat: number, lng: number): string => {
  if (lat >= 20.0 && lat <= 22.0 && lng >= 105.0 && lng <= 107.0) return 'Hà Nội';
  if (lat >= 15.5 && lat <= 16.8 && lng >= 107.5 && lng <= 109.0) return 'Đà Nẵng';
  if (lat >= 10.0 && lat <= 11.8 && lng >= 106.0 && lng <= 107.5) return 'TP. Hồ Chí Minh';
  return 'Hà Nội';
};

export const getCityCoordinates = (locationStr?: string) => {
  if (!locationStr) return ALLOWED_CITIES[0];
  const key = normalizeCityKey(locationStr);
  if (key === 'HO_CHI_MINH') return ALLOWED_CITIES[2]; // TP. Hồ Chí Minh
  if (key === 'DANANG') return ALLOWED_CITIES[1];      // Đà Nẵng
  return ALLOWED_CITIES[0];                            // Hà Nội
};

export const LalamoveAddressPicker: React.FC<LalamoveAddressPickerProps> = ({
  initialName = '',
  initialPhone = '',
  initialLatitude,
  initialLongitude,
  initialAddress = '',
  sellerCity,
  sellerLocation,
  onAddressConfirmed,
  onNameChange,
  onPhoneChange,
  lang = 'vi',
  title,
  description,
}) => {
  const defaultCityObj = sellerCity
    ? (ALLOWED_CITIES.find(c => c.name.toLowerCase().includes(sellerCity.toLowerCase())) || ALLOWED_CITIES[0])
    : (sellerLocation ? getCityCoordinates(sellerLocation) : ALLOWED_CITIES[0]);

  const [contactName, setContactName] = useState(initialName);
  const [contactPhone, setContactPhone] = useState(initialPhone);

  const [latitude, setLatitude] = useState<number | null>(initialLatitude ?? defaultCityObj.lat);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude ?? defaultCityObj.lng);

  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress);
  const [resolvedCity, setResolvedCity] = useState<string>(sellerCity || defaultCityObj.name);
  const [placeId, setPlaceId] = useState<string | undefined>();

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(Boolean(initialAddress && initialLatitude && initialLongitude));
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);

  // Dynamic Cities from Backend (GET /api/v1/shipping/cities)
  const [supportedCities, setSupportedCities] = useState(ALLOWED_CITIES);

  useEffect(() => {
    let active = true;
    shippingService.getCities().then((res: any) => {
      if (!active || !res) return;
      const rawList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.cities) ? res.cities : []));
      if (rawList && rawList.length > 0) {
        const parsed = rawList.map((c: any) => {
          const rawName = typeof c === 'string' ? c : (c.name || c.cityName || c.label || String(c));
          const coordFallback = getCityCoordinates(rawName);
          const lat = (typeof c === 'object' && typeof c.lat === 'number') ? c.lat 
            : (typeof c === 'object' && typeof c.latitude === 'number') ? c.latitude 
            : coordFallback.lat;
          const lng = (typeof c === 'object' && typeof c.lng === 'number') ? c.lng 
            : (typeof c === 'object' && typeof c.longitude === 'number') ? c.longitude 
            : coordFallback.lng;
          return { name: rawName, lat, lng, label: getShortCityName(rawName) };
        });
        setSupportedCities(parsed);
      }
    }).catch((err) => {
      console.warn('Cannot fetch dynamic /shipping/cities:', err);
    });
    return () => { active = false; };
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletMarkerRef = useRef<any>(null);
  const lookupSeqRef = useRef<number>(0);

  // Two-way synchronization with parent props
  useEffect(() => {
    if (initialName !== undefined && initialName !== contactName) {
      setContactName(initialName);
    }
  }, [initialName]);

  useEffect(() => {
    if (initialPhone !== undefined && initialPhone !== contactPhone) {
      setContactPhone(initialPhone);
    }
  }, [initialPhone]);

  // Address search with coordinate validation state
  const [searchAddressText, setSearchAddressText] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchValidationError, setSearchValidationError] = useState<string | null>(null);

  const handleSearchAddressToPin = async () => {
    const query = searchAddressText.trim();
    setSearchValidationError(null);

    // 1. Validate empty / length
    if (!query) {
      setSearchValidationError(lang === 'vi' ? 'Vui lòng nhập địa chỉ cần xác định vị trí trên bản đồ.' : 'Please enter an address to locate on the map.');
      return;
    }
    if (query.length < 4) {
      setSearchValidationError(lang === 'vi' ? 'Địa chỉ quá ngắn. Vui lòng nhập tối thiểu 4 ký tự.' : 'Address too short. Please enter at least 4 characters.');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=vn&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'vi,en;q=0.9' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error('Dịch vụ bản đồ tạm thời gián đoạn.');
      }

      const results = await res.json();

      // 2. Validate coordinates existence and structure
      if (!Array.isArray(results) || results.length === 0) {
        setSearchValidationError(
          lang === 'vi'
            ? 'Không tìm thấy tọa độ GPS cho địa chỉ này. Vui lòng nhập chi tiết hơn (số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành) hoặc nhấp trực tiếp trên bản đồ.'
            : 'Could not resolve GPS coordinates. Please be more specific with street, district, city or pick directly on map.'
        );
        return;
      }

      const item = results[0];
      const parsedLat = parseFloat(item.lat);
      const parsedLng = parseFloat(item.lon);

      // 3. Strict Coordinate Validation
      if (
        isNaN(parsedLat) ||
        isNaN(parsedLng) ||
        !isFinite(parsedLat) ||
        !isFinite(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180
      ) {
        setSearchValidationError(lang === 'vi' ? 'Tọa độ trả về không hợp lệ. Vui lòng thử lại với tên địa chỉ khác.' : 'Invalid coordinates returned. Please try another address.');
        return;
      }

      // Check Vietnam approximate bounding box
      if (parsedLat < 8.0 || parsedLat > 24.5 || parsedLng < 101.5 || parsedLng > 111.0) {
        setSearchValidationError(lang === 'vi' ? 'Tọa độ tìm thấy nằm ngoài lãnh thổ Việt Nam. Vui lòng nhập địa chỉ trong nước.' : 'Coordinates found outside Vietnam. Please enter an address in Vietnam.');
        return;
      }

      // 4. Update map, pin, coordinates and address state
      setLatitude(parsedLat);
      setLongitude(parsedLng);
      setResolvedAddress(item.display_name || query);
      const detectedCity = detectCityFromCoords(parsedLat, parsedLng);
      setResolvedCity(detectedCity);
      setIsConfirmed(false);
      setLookupError(null);

      // Move Leaflet map & marker
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([parsedLat, parsedLng]);
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.setView([parsedLat, parsedLng], 16);
      }
    } catch (err: any) {
      console.warn('Geocoding search error:', err);
      setSearchValidationError(
        err?.name === 'AbortError'
          ? (lang === 'vi' ? 'Quá thời gian tìm kiếm địa chỉ. Vui lòng kiểm tra mạng và thử lại.' : 'Search timeout. Please check network and retry.')
          : (err?.message || (lang === 'vi' ? 'Không thể xác định tọa độ từ địa chỉ đã nhập.' : 'Could not resolve coordinates.'))
      );
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Fallback reverse geocoding via OpenStreetMap Nominatim or heuristic
  const fallbackReverseGeocode = useCallback(async (lat: number, lng: number): Promise<{ address: string; city: string }> => {
    const detectedCity = detectCityFromCoords(lat, lng);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'vi,en;q=0.9' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.state || detectedCity;
          return { address: data.display_name, city };
        }
      }
    } catch (_) {}

    return {
      address: `Khu vực ${detectedCity} (Tọa độ GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      city: detectedCity,
    };
  }, []);

  // Reverse geocode via Backend API with seamless fallback
  const executeLookup = useCallback(async (lat: number, lng: number) => {
    const currentSeq = ++lookupSeqRef.current;
    setIsLookingUp(true);
    setLookupError(null);
    setIsConfirmed(false);

    try {
      const res: GeocodedAddressDto = await shippingService.reverseGeocode(lat, lng);
      // Discard stale responses if user moved pin again
      if (currentSeq !== lookupSeqRef.current) return;

      if (res && res.address) {
        setResolvedAddress(res.address);
        const cityCandidate = res.city ? getShortCityName(res.city) : detectCityFromCoords(lat, lng);
        setResolvedCity(cityCandidate);
        setPlaceId(res.placeId);
        setLookupError(null);
        return;
      }
    } catch (err: any) {
      if (currentSeq !== lookupSeqRef.current) return;
      console.warn('Reverse geocode error from BE, falling back to OSM Nominatim:', err);
      try {
        const fallback = await fallbackReverseGeocode(lat, lng);
        if (currentSeq !== lookupSeqRef.current) return;
        setResolvedAddress(fallback.address);
        setResolvedCity(fallback.city);
        setLookupError(null);
        return;
      } catch (fbErr) {
        console.warn('Fallback geocoding also failed:', fbErr);
        const city = detectCityFromCoords(lat, lng);
        setResolvedAddress(`Khu vực ${city} (Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        setResolvedCity(city);
        setLookupError(null);
      }
    } finally {
      if (currentSeq === lookupSeqRef.current) {
        setIsLookingUp(false);
      }
    }
  }, [fallbackReverseGeocode]);

  // Initialize or update Leaflet map
  useEffect(() => {
    let isCancelled = false;

    const setupMap = () => {
      if (!mapContainerRef.current || isCancelled) return;
      const L = (window as any).L;
      if (!L) return;

      const initialLat = latitude ?? ALLOWED_CITIES[0].lat;
      const initialLng = longitude ?? ALLOWED_CITIES[0].lng;

      if (!leafletMapRef.current) {
        // Create Leaflet map
        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 15,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '&copy; Google Maps | Lalamove Delivery',
        }).addTo(map);

        // Custom pin icon
        const pinIcon = L.divIcon({
          className: 'custom-lalamove-marker',
          html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
            <div style="background: #ea580c; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 2px;">
              Lalamove GPS
            </div>
            <div style="width: 28px; height: 28px; background: #ea580c; border: 3px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>
          </div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 42],
        });

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        // Marker drag end event
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setLatitude(pos.lat);
          setLongitude(pos.lng);
          executeLookup(pos.lat, pos.lng);
        });

        // Map click event
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          setLatitude(e.latlng.lat);
          setLongitude(e.latlng.lng);
          executeLookup(e.latlng.lat, e.latlng.lng);
        });

        leafletMapRef.current = map;
        leafletMarkerRef.current = marker;

        // Perform initial reverse-geocode if not already provided
        if (!initialAddress) {
          executeLookup(initialLat, initialLng);
        }
      } else {
        // Map already exists, update view & marker position
        leafletMapRef.current.setView([initialLat, initialLng], 15);
        if (leafletMarkerRef.current) {
          leafletMarkerRef.current.setLatLng([initialLat, initialLng]);
        }
      }
    };

    // Check if Leaflet is loaded in window
    if ((window as any).L) {
      setupMap();
    } else {
      // Dynamically load Leaflet script & CSS if not present
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
        script.onload = () => {
          if (!isCancelled) setupMap();
        };
        document.body.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if ((window as any).L) {
            clearInterval(interval);
            if (!isCancelled) setupMap();
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [executeLookup, initialAddress]);

  // Handle preset city click
  const handleSelectCityPreset = (city: { name: string; lat: number; lng: number; label?: string }) => {
    const shortName = getShortCityName(city.name);
    setResolvedCity(shortName);
    setLatitude(city.lat);
    setLongitude(city.lng);
    if (leafletMapRef.current && leafletMarkerRef.current) {
      leafletMapRef.current.setView([city.lat, city.lng], 15);
      leafletMarkerRef.current.setLatLng([city.lat, city.lng]);
    }
    executeLookup(city.lat, city.lng);
  };

  // Get current device location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLookupError(lang === 'vi' ? 'Trình duyệt không hỗ trợ Geolocation.' : 'Geolocation not supported.');
      return;
    }

    setIsLocatingDevice(true);
    setLookupError(null);

    const onLocationSuccess = ({ coords }: GeolocationPosition) => {
      setIsLocatingDevice(false);
      const lat = coords.latitude;
      const lng = coords.longitude;
      setLatitude(lat);
      setLongitude(lng);

      if (leafletMapRef.current && leafletMarkerRef.current) {
        leafletMapRef.current.setView([lat, lng], 16);
        leafletMarkerRef.current.setLatLng([lat, lng]);
      }
      executeLookup(lat, lng);
    };

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      () => {
        // Fallback with standard accuracy for desktop Wi-Fi / IP geocoding
        navigator.geolocation.getCurrentPosition(
          onLocationSuccess,
          (err) => {
            setIsLocatingDevice(false);
            console.warn('Geolocation error:', err);
            let msg = lang === 'vi' ? 'Không lấy được vị trí GPS. Bạn hãy nhấp chọn điểm trên bản đồ.' : 'Could not get device location. Please pick on the map.';
            if (err.code === 1) {
              msg = lang === 'vi' ? 'Quyền truy cập vị trí bị từ chối. Vui lòng chọn trên bản đồ.' : 'Location permission denied. Please choose on the map.';
            }
            setLookupError(msg);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  };

  // Confirm address button
  const handleConfirmLocation = () => {
    // Validate that coordinates are valid numbers before confirming
    const finalLat = latitude;
    const finalLng = longitude;
    if (finalLat === null || finalLng === null || isNaN(finalLat) || isNaN(finalLng) || !isFinite(finalLat) || !isFinite(finalLng)) {
      setLookupError(lang === 'vi' ? 'Vui lòng chọn vị trí trên bản đồ hoặc tìm kiếm địa chỉ để có tọa độ GPS hợp lệ.' : 'Please select a spot on the map or search address for valid GPS coordinates.');
      return;
    }
    const finalCity = resolvedCity || detectCityFromCoords(finalLat, finalLng);
    const finalAddr = (resolvedAddress || '').trim() || `Tọa độ GPS: ${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}`;

    setIsConfirmed(true);
    setLookupError(null);

    onAddressConfirmed({
      name: contactName.trim(),
      phone: contactPhone.trim(),
      address: finalAddr,
      latitude: finalLat,
      longitude: finalLng,
      city: finalCity,
      placeId,
    });
  };

  return (
    <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/90 text-xs text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-200/80">
        <div>
          <h4 className="font-extrabold text-[#24263e] text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse"></span>
            {title || (lang === 'vi' ? 'Địa Điểm Lấy / Nhận Hàng Lalamove' : 'Lalamove Pickup / Delivery Address')}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {description || (lang === 'vi' ? 'Hệ thống dùng GPS để tài xế Lalamove định vị chính xác và giao hàng tận nơi.' : 'Accurate GPS coordinates for Lalamove couriers.')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded-lg text-[10px] uppercase tracking-wider">
            Lalamove GPS
          </span>
          {isConfirmed && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {lang === 'vi' ? 'Đã xác nhận' : 'Confirmed'}
            </span>
          )}
        </div>
      </div>



      {/* Contact inputs: Name & Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            <User className="w-3 h-3 inline mr-1 text-slate-400" />
            {lang === 'vi' ? 'Tên Người Liên Hệ *' : 'Contact Name *'}
          </label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => {
              const val = e.target.value;
              setContactName(val);
              onNameChange?.(val);
              setIsConfirmed(false);
            }}
            placeholder={lang === 'vi' ? 'VD: Nguyễn Văn A' : 'Full name'}
            className="w-full h-9 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-orange-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            <Phone className="w-3 h-3 inline mr-1 text-slate-400" />
            {lang === 'vi' ? 'Số Điện Thoại Liên Hệ *' : 'Contact Phone *'}
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => {
              const val = e.target.value;
              setContactPhone(val);
              onPhoneChange?.(val);
              setIsConfirmed(false);
            }}
            placeholder={lang === 'vi' ? 'VD: 0912345678' : '0912345678'}
            className="w-full h-9 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-orange-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Current Location & Address Search Toolbar */}
      <div className="space-y-2.5">
        {/* Prominent GPS button */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocatingDevice}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        >
          {isLocatingDevice ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === 'vi' ? 'Đang dò tọa độ GPS thiết bị...' : 'Locating your device GPS...'}</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 fill-white" />
              <span>{lang === 'vi' ? '📍 Dùng Vị Trí Hiện Tại Của Tôi' : '📍 Use My Current Location'}</span>
            </>
          )}
        </button>

        {/* Search input to pinpoint location on map with coordinate validation */}
        <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-orange-600" />
              {lang === 'vi' ? 'Nhập địa chỉ để định vị trên bản đồ' : 'Search address to pin on map'}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {lang === 'vi' ? '(Hệ thống sẽ chuyển thành tọa độ GPS)' : '(Converts to GPS coordinates)'}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchAddressText}
                onChange={(e) => {
                  setSearchAddressText(e.target.value);
                  setSearchValidationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddressToPin();
                  }
                }}
                placeholder={lang === 'vi' ? 'Nhập số nhà, tên đường, phường, quận, tỉnh/thành...' : 'Enter street address, ward, district, city...'}
                className={`w-full h-10 px-3.5 pl-9 bg-slate-50/80 border rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none transition ${
                  searchValidationError ? 'border-rose-400 ring-2 ring-rose-100 bg-white' : 'border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:bg-white'
                }`}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              {searchAddressText && (
                <button
                  type="button"
                  onClick={() => setSearchAddressText('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchAddressToPin}
              disabled={isSearchingAddress}
              className="h-10 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isSearchingAddress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Đang tìm...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Tìm vị trí</span>
                </>
              )}
            </button>
          </div>
          {searchValidationError && (
            <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{searchValidationError}</span>
            </p>
          )}
        </div>
      </div>

      {/* Map container with draggable marker */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-300 shadow-xs bg-slate-100">
        <div
          ref={mapContainerRef}
          className="w-full h-56 sm:h-64 z-10"
          style={{ minHeight: '220px' }}
        />

        {/* Map instruction overlay badge */}
        <div className="absolute top-2.5 left-2.5 z-20 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-200 shadow-xs text-[10px] font-bold text-slate-700 flex items-center gap-1.5 pointer-events-none">
          <MapPin className="w-3.5 h-3.5 text-orange-600" />
          <span>{lang === 'vi' ? 'Kéo ghim hoặc nhấp vào bản đồ để chọn vị trí chính xác' : 'Drag pin or click map to select spot'}</span>
        </div>

        {/* Floating Quick GPS button directly on the map */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocatingDevice}
          title={lang === 'vi' ? 'Định vị lại vị trí hiện tại' : 'Recenter to current location'}
          className="absolute bottom-3 right-3 z-20 p-2.5 bg-white/95 hover:bg-orange-50 border border-gray-300 hover:border-orange-400 text-orange-600 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
        >
          {isLocatingDevice ? (
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          ) : (
            <Navigation className="w-4 h-4 fill-orange-600 text-orange-600" />
          )}
          <span className="hidden sm:inline">{lang === 'vi' ? 'Vị trí của tôi' : 'My location'}</span>
        </button>

        {/* Loading overlay during reverse geocoding */}
        {isLookingUp && (
          <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            <span>{lang === 'vi' ? 'Đang xác định địa chỉ từ tọa độ...' : 'Resolving address...'}</span>
          </div>
        )}
      </div>

      {/* Resolved address display with direct manual detail edit support */}
      <div className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            {lang === 'vi' ? 'Địa chỉ nhận hàng (Có thể chỉnh sửa bổ sung số nhà/tầng)' : 'Delivery Address (Editable details)'}
          </span>
          {latitude && longitude && (
            <span className="text-[10px] font-mono font-bold text-slate-400">
              GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={resolvedAddress}
            onChange={(e) => {
              setResolvedAddress(e.target.value);
              setIsConfirmed(false);
            }}
            placeholder={isLookingUp ? 'Đang tra cứu địa chỉ...' : 'Nhập hoặc bổ sung số nhà, tên đường, tòa nhà...'}
            className="w-full px-3 py-2 bg-slate-50/80 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500 transition"
          />
        </div>
      </div>

      {/* Error message */}
      {lookupError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{lookupError}</span>
        </div>
      )}

      {/* Confirm Button */}
      <div className="pt-1 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-500 italic">
          {isConfirmed
            ? (lang === 'vi' ? '✓ Vị trí đã được ghi nhận vào đơn hàng' : '✓ Location verified')
            : (lang === 'vi' ? '* Bấm xác nhận vị trí này để tính phí' : '* Confirm this spot to calculate quote')}
        </div>
        <button
          type="button"
          onClick={handleConfirmLocation}
          disabled={isLookingUp || (!latitude && !resolvedAddress)}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
            isConfirmed
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isConfirmed ? (lang === 'vi' ? 'Đã Chọn Vị Trí Này' : 'Location Confirmed') : (lang === 'vi' ? 'Xác Nhận Vị Trí Này' : 'Confirm Location')}</span>
        </button>
      </div>
    </div>
  );
};

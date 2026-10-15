import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Loader2, CheckCircle2, AlertCircle, Phone, User, Building2 } from 'lucide-react';
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

export const detectCityFromCoords = (lat: number, lng: number): string => {
  if (lat >= 20.0 && lat <= 22.0 && lng >= 105.0 && lng <= 107.0) return 'Hà Nội';
  if (lat >= 15.5 && lat <= 16.8 && lng >= 107.5 && lng <= 109.0) return 'Đà Nẵng';
  if (lat >= 10.0 && lat <= 11.8 && lng >= 106.0 && lng <= 107.5) return 'TP. Hồ Chí Minh';
  return 'Hà Nội';
};

export const getCityCoordinates = (locationStr?: string) => {
  if (!locationStr) return ALLOWED_CITIES[0];
  const lower = locationStr.toLowerCase();
  if (
    lower.includes('hồ chí minh') ||
    lower.includes('ho chi minh') ||
    lower.includes('sài gòn') ||
    lower.includes('sai gon') ||
    lower.includes('hcm') ||
    lower.includes('bình dương') ||
    lower.includes('binh duong')
  ) {
    return ALLOWED_CITIES[2]; // TP. Hồ Chí Minh
  }
  if (lower.includes('đà nẵng') || lower.includes('da nang') || lower.includes('huế') || lower.includes('quảng')) {
    return ALLOWED_CITIES[1]; // Đà Nẵng
  }
  return ALLOWED_CITIES[0]; // Hà Nội
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
        setResolvedCity(res.city || detectCityFromCoords(lat, lng));
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
  const handleSelectCityPreset = (city: typeof ALLOWED_CITIES[0]) => {
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

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
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
      },
      (err) => {
        setIsLocatingDevice(false);
        console.warn('Geolocation error:', err);
        let msg = lang === 'vi' ? 'Không lấy được vị trí. Bạn hãy chọn điểm trên bản đồ.' : 'Could not get device location. Please pick on the map.';
        if (err.code === 1) {
          msg = lang === 'vi' ? 'Quyền truy cập vị trí bị từ chối. Vui lòng chọn trên bản đồ.' : 'Location permission denied. Please choose on the map.';
        }
        setLookupError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm address button
  const handleConfirmLocation = () => {
    // Không validate số điện thoại: nhập 9 số hay bất kỳ số nào vẫn bình thường không báo lỗi
    const finalLat = latitude ?? defaultCityObj.lat;
    const finalLng = longitude ?? defaultCityObj.lng;
    const finalCity = resolvedCity || detectCityFromCoords(finalLat, finalLng);
    const finalAddr = (resolvedAddress || '').trim() || `Khu vực ${finalCity} (Tọa độ GPS: ${finalLat.toFixed(5)}, ${finalLng.toFixed(5)})`;

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

      {/* Seller warehouse city notice banner */}
      {sellerCity && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="leading-snug">
              Kho người bán tại: <strong className="text-slate-900 font-extrabold">{sellerCity}</strong>. Lalamove là dịch vụ giao nhanh nội thành, vui lòng chọn điểm giao trong cùng khu vực <strong>{sellerCity}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const matched = ALLOWED_CITIES.find(c => c.name.toLowerCase().includes(sellerCity.toLowerCase())) || ALLOWED_CITIES[0];
              handleSelectCityPreset(matched);
            }}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-[11px] shrink-0 cursor-pointer shadow-xs"
          >
            Đến {sellerCity}
          </button>
        </div>
      )}

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

      {/* Preset supported cities quick buttons */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>{lang === 'vi' ? 'Chọn nhanh thành phố được hỗ trợ:' : 'Supported cities:'}</span>
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLocatingDevice}
            className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
          >
            {isLocatingDevice ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Navigation className="w-3 h-3" />
            )}
            <span>{lang === 'vi' ? 'Dùng vị trí hiện tại' : 'Use Current Location'}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALLOWED_CITIES.map((c) => {
            const isMatchedSeller = sellerCity && c.name.toLowerCase().includes(sellerCity.toLowerCase());
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handleSelectCityPreset(c)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1 border ${
                  isMatchedSeller
                    ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400'
                    : 'bg-white hover:bg-orange-50 border-gray-200 hover:border-orange-300 text-slate-700'
                }`}
              >
                <Building2 className="w-3 h-3 text-orange-600" />
                <span>{c.name}</span>
                {isMatchedSeller && <span className="text-[9px] bg-amber-600 text-white px-1 rounded-sm">Kho người bán</span>}
              </button>
            );
          })}
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

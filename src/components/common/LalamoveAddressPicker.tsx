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
  onAddressConfirmed: (data: SelectedLocationData) => void;
  lang?: 'vi' | 'en';
  title?: string;
  description?: string;
}

// Preset supported cities in Vietnam according to Backend Lalamove Catalog Policy
const ALLOWED_CITIES = [
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, label: 'Hà Nội (Trung tâm Ba Đình/Hoàn Kiếm)' },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, label: 'Đà Nẵng (Hải Châu)' },
  { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009, label: 'TP. Hồ Chí Minh (Quận 1 / Bến Nghé)' },
];

export const LalamoveAddressPicker: React.FC<LalamoveAddressPickerProps> = ({
  initialName = '',
  initialPhone = '',
  initialLatitude,
  initialLongitude,
  initialAddress = '',
  onAddressConfirmed,
  lang = 'vi',
  title,
  description,
}) => {
  const [contactName, setContactName] = useState(initialName);
  const [contactPhone, setContactPhone] = useState(initialPhone);

  const [latitude, setLatitude] = useState<number | null>(initialLatitude ?? ALLOWED_CITIES[0].lat);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude ?? ALLOWED_CITIES[0].lng);

  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress);
  const [resolvedCity, setResolvedCity] = useState<string>('');
  const [placeId, setPlaceId] = useState<string | undefined>();

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(Boolean(initialAddress && initialLatitude && initialLongitude));
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletMarkerRef = useRef<any>(null);
  const lookupSeqRef = useRef<number>(0);

  // Sync prop changes
  useEffect(() => {
    if (initialName && !contactName) setContactName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialPhone && !contactPhone) setContactPhone(initialPhone);
  }, [initialPhone]);

  // Reverse geocode via Backend API: POST /api/v1/shipping/reverse-geocode
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
        setResolvedCity(res.city || '');
        setPlaceId(res.placeId);
        setLookupError(null);
      } else {
        setResolvedAddress('');
        setLookupError(
          lang === 'vi'
            ? 'Không tìm thấy địa chỉ tại tọa độ này. Vui lòng chọn điểm khác.'
            : 'No address found at these coordinates.'
        );
      }
    } catch (err: any) {
      if (currentSeq !== lookupSeqRef.current) return;
      console.warn('Reverse geocode error from BE:', err);
      setResolvedAddress('');
      let msg = err?.response?.data?.message || err?.message || 'Lỗi tra cứu địa chỉ từ tọa độ.';
      if (msg.includes('ngoài khu vực phục vụ')) {
        msg = lang === 'vi'
          ? 'Địa chỉ nằm ngoài khu vực phục vụ Lalamove (Hiện hỗ trợ Hà Nội, Đà Nẵng, TP.HCM).'
          : 'Address outside Lalamove supported service areas (Hanoi, Da Nang, HCMC).';
      } else if (msg.includes('đường hoặc tòa nhà')) {
        msg = lang === 'vi'
          ? 'Không tìm thấy địa chỉ đường hoặc tòa nhà. Vui lòng chọn tọa độ chi tiết hơn.'
          : 'Specific street or building address not resolved. Please select a clearer location.';
      }
      setLookupError(msg);
    } finally {
      if (currentSeq === lookupSeqRef.current) {
        setIsLookingUp(false);
      }
    }
  }, [lang]);

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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors | Lalamove Delivery',
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
    if (!contactName.trim()) {
      setLookupError(lang === 'vi' ? 'Vui lòng nhập tên người liên hệ.' : 'Please enter contact name.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 9) {
      setLookupError(lang === 'vi' ? 'Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số).' : 'Valid phone required (min 9 digits).');
      return;
    }
    if (!latitude || !longitude || !resolvedAddress) {
      setLookupError(lang === 'vi' ? 'Chưa xác định được địa chỉ hợp lệ từ bản đồ.' : 'Please select a valid location on the map.');
      return;
    }

    setIsConfirmed(true);
    setLookupError(null);

    onAddressConfirmed({
      name: contactName.trim(),
      phone: contactPhone.trim(),
      address: resolvedAddress,
      latitude,
      longitude,
      city: resolvedCity || 'Hà Nội',
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
            {description || (lang === 'vi' ? 'Hệ thống dùng GPS và Geoapify để tài xế Lalamove định vị chính xác điểm giao nhận.' : 'Accurate GPS coordinates for Lalamove couriers.')}
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
              setContactName(e.target.value);
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
              setContactPhone(e.target.value);
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
          {ALLOWED_CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => handleSelectCityPreset(c)}
              className="px-2.5 py-1 bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-300 text-[11px] font-bold text-slate-700 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <Building2 className="w-3 h-3 text-orange-600" />
              <span>{c.name}</span>
            </button>
          ))}
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

      {/* Resolved address display (Read-only as per section 3.1 & 3.2 of guide) */}
      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            {lang === 'vi' ? 'Địa chỉ do hệ thống xác định (Chỉ đọc)' : 'Resolved Address (Read-only)'}
          </span>
          {latitude && longitude && (
            <span className="text-[10px] font-mono text-slate-400">
              GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-900 min-h-6 flex items-center">
          {resolvedAddress ? (
            <span className="text-slate-900 leading-relaxed">{resolvedAddress}</span>
          ) : (
            <span className="text-slate-400 italic">
              {isLookingUp
                ? (lang === 'vi' ? 'Đang tra cứu địa chỉ...' : 'Resolving address...')
                : (lang === 'vi' ? 'Chưa chọn vị trí. Vui lòng chọn điểm trên bản đồ.' : 'Select a location on the map.')}
            </span>
          )}
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
            : (lang === 'vi' ? '* Bấm xác nhận vị trí này để tiếp tục' : '* Confirm this spot to proceed')}
        </div>
        <button
          type="button"
          onClick={handleConfirmLocation}
          disabled={isLookingUp || !resolvedAddress}
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

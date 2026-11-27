import { useState } from 'react';
import { LalamoveAddressPicker, type SelectedLocationData } from '../common/LalamoveAddressPicker';
import type { Language } from '../../types';

export interface InspectionDeliveryAddress {
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  initial: Partial<InspectionDeliveryAddress>;
  pickupLocation?: string;
  lang: Language;
  onClose: () => void;
  onSave: (address: InspectionDeliveryAddress) => Promise<void>;
}

export function InspectionDeliveryAddressModal({ initial, pickupLocation, lang, onClose, onSave }: Props) {
  const [name, setName] = useState(initial.name || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [location, setLocation] = useState<SelectedLocationData | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const vietnamese = lang === 'vi';

  const save = async () => {
    if (saving) return;
    const recipientName = name.trim();
    const recipientPhone = phone.replace(/[^\d+]/g, '');
    if (!recipientName || !/^(?:0|\+?84)\d{9,10}$/.test(recipientPhone)) {
      setError(vietnamese ? 'Vui lòng nhập tên và số điện thoại hợp lệ của người nhận.' : 'Enter a valid recipient name and phone number.');
      return;
    }
    if (!location) {
      setError(vietnamese ? 'Vui lòng chọn và xác nhận vị trí trên bản đồ.' : 'Select and confirm a location on the map.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: recipientName,
        phone: recipientPhone,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (vietnamese ? 'Chưa thể lưu địa chỉ nhận hàng.' : 'Could not save the delivery address.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="inspection-delivery-address-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-xl">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 id="inspection-delivery-address-title" className="font-extrabold text-slate-900">
            {vietnamese ? 'Địa chỉ nhận hàng' : 'Delivery address'}
          </h2>
        </header>
        <div className="space-y-3 p-5">
          <LalamoveAddressPicker
            initialName={initial.name}
            initialPhone={initial.phone}
            initialAddress={initial.address}
            initialLatitude={initial.latitude}
            initialLongitude={initial.longitude}
            sellerLocation={pickupLocation}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onAddressUnconfirmed={() => setLocation(null)}
            onAddressConfirmed={(point) => {
              setLocation(point);
              setError('');
            }}
            lang={lang}
          />
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
              {vietnamese ? 'Hủy' : 'Cancel'}
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? (vietnamese ? 'Đang lưu…' : 'Saving…') : (vietnamese ? 'Lưu địa chỉ' : 'Save address')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

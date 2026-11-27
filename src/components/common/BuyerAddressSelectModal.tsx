import React, { useState, useEffect } from 'react';
import { X, Plus, AlertTriangle, Home, Building2, MapPin } from 'lucide-react';
import { LalamoveAddressPicker, getCityCoordinates } from './LalamoveAddressPicker';
import { BuyerDeliveryAddress, saveBuyerAddressesToStorage } from '../../utils/buyerAddressStorage';
import { userService } from '../../services/userService';
import { shippingService } from '../../services/shippingService';
import type { Language, UserProfile } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses: BuyerDeliveryAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (address: BuyerDeliveryAddress) => void;
  onUpdateAddresses: (updatedList: BuyerDeliveryAddress[], newlySelectedId?: string) => void;
  sellerLocation?: string;
  sellerCity?: string;
  currentUser?: UserProfile | null;
  lang?: Language;
}

export function BuyerAddressSelectModal({
  isOpen,
  onClose,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
  onUpdateAddresses,
  sellerLocation,
  sellerCity,
  currentUser,
  lang = 'vi',
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedAddressId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<BuyerDeliveryAddress | null>(null);

  // Form temporary state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formLat, setFormLat] = useState<number | undefined>(undefined);
  const [formLng, setFormLng] = useState<number | undefined>(undefined);
  const [formType, setFormType] = useState<'home' | 'office'>('home');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);

  const sellerCityInfo = getCityCoordinates(sellerLocation || sellerCity);

  useEffect(() => {
    setSelectedId(selectedAddressId);
  }, [selectedAddressId, isOpen]);

  // Sync latest addresses from backend when modal opens
  useEffect(() => {
    if (isOpen && currentUser?.id) {
      shippingService.getDeliveryAddresses().then((backendList) => {
        if (Array.isArray(backendList) && backendList.length > 0) {
          saveBuyerAddressesToStorage(backendList, currentUser.id);
          onUpdateAddresses(backendList);
        } else if (Array.isArray(backendList) && backendList.length === 0 && savedAddresses.length > 0) {
          shippingService.syncDeliveryAddresses(savedAddresses).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setFormName(currentUser?.name || (currentUser as any)?.fullName || '');
    setFormPhone(currentUser?.phone || '');
    setFormEmail(currentUser?.email || '');
    setFormStreet('');
    setFormCity(sellerCityInfo.name);
    setFormLat(sellerCityInfo.lat);
    setFormLng(sellerCityInfo.lng);
    setFormType('home');
    setFormIsDefault(savedAddresses.length === 0);
    setFormErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleOpenEditAddress = (addr: BuyerDeliveryAddress) => {
    setEditingAddress(addr);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormEmail(addr.email || '');
    setFormStreet(addr.streetAddress);
    setFormCity(addr.city || sellerCityInfo.name);
    setFormLat(addr.latitude ?? sellerCityInfo.lat);
    setFormLng(addr.longitude ?? sellerCityInfo.lng);
    setFormType(addr.addressType === 'office' ? 'office' : 'home');
    setFormIsDefault(Boolean(addr.isDefault));
    setFormErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = () => {
    const trimmedName = formName.trim();
    const cleanPhone = formPhone.replace(/[^\d+]/g, '');
    const trimmedStreet = formStreet.trim();

    if (!trimmedName) {
      setFormErrorMsg(lang === 'vi' ? 'Vui lòng nhập họ tên người nhận.' : 'Please enter recipient name.');
      return;
    }
    if (!cleanPhone || !/^(?:0|\+?84)\d{9,10}$/.test(cleanPhone)) {
      setFormErrorMsg(lang === 'vi' ? 'Số điện thoại không hợp lệ (cần 10 số).' : 'Invalid phone number.');
      return;
    }
    if (!trimmedStreet) {
      setFormErrorMsg(lang === 'vi' ? 'Vui lòng xác nhận địa chỉ nhận hàng trên bản đồ.' : 'Please select and confirm address on map.');
      return;
    }

    let updatedList: BuyerDeliveryAddress[] = [];
    let targetId = '';

    if (editingAddress) {
      targetId = editingAddress.id;
      updatedList = savedAddresses.map((a) => {
        if (a.id === editingAddress.id) {
          return {
            ...a,
            name: trimmedName,
            phone: cleanPhone,
            email: formEmail.trim() || undefined,
            streetAddress: trimmedStreet,
            city: formCity || a.city,
            latitude: formLat,
            longitude: formLng,
            addressType: formType,
            isDefault: formIsDefault ? true : (savedAddresses.length === 1 ? true : a.isDefault),
          };
        }
        return formIsDefault ? { ...a, isDefault: false } : a;
      });
    } else {
      targetId = `addr-${Date.now()}`;
      const newAddr: BuyerDeliveryAddress = {
        id: targetId,
        name: trimmedName,
        phone: cleanPhone,
        email: formEmail.trim() || undefined,
        streetAddress: trimmedStreet,
        city: formCity || sellerCityInfo.name,
        latitude: formLat,
        longitude: formLng,
        addressType: formType,
        isDefault: formIsDefault || savedAddresses.length === 0,
      };
      if (newAddr.isDefault) {
        updatedList = [newAddr, ...savedAddresses.map((a) => ({ ...a, isDefault: false }))];
      } else {
        updatedList = [...savedAddresses, newAddr];
      }
    }

    saveBuyerAddressesToStorage(updatedList, currentUser?.id);
    onUpdateAddresses(updatedList, targetId);
    setSelectedId(targetId);
    setIsFormOpen(false);

    // Sync to backend so other devices keep all addresses
    shippingService.syncDeliveryAddresses(updatedList).catch(() => {});

    // Sync default address to user profile on backend so other machines also get it
    if (formIsDefault || savedAddresses.length === 0) {
      userService.updateMyProfile({
        streetAddress: trimmedStreet,
        latitude: formLat ?? null,
        longitude: formLng ?? null,
      }).catch(() => { });
    }

    const chosen = updatedList.find((a) => a.id === targetId);
    if (chosen) {
      onSelectAddress(chosen);
    }
  };

  const handleDeleteAddress = (idToDelete: string) => {
    if (savedAddresses.length <= 1) return;
    const remaining = savedAddresses.filter((a) => a.id !== idToDelete);
    if (!remaining.some((a) => a.isDefault)) {
      remaining[0].isDefault = true;
    }
    saveBuyerAddressesToStorage(remaining, currentUser?.id);
    const newSelectedId = selectedId === idToDelete ? remaining[0].id : selectedId;
    onUpdateAddresses(remaining, newSelectedId || undefined);
    if (selectedId === idToDelete) {
      setSelectedId(remaining[0].id);
      onSelectAddress(remaining[0]);
    }
    // Sync remaining addresses to backend
    shippingService.syncDeliveryAddresses(remaining).catch(() => {});
  };

  const handleSetDefaultAddress = (addrId: string) => {
    const updated = savedAddresses.map((a) => ({
      ...a,
      isDefault: a.id === addrId,
    }));
    saveBuyerAddressesToStorage(updated, currentUser?.id);
    onUpdateAddresses(updated, selectedId || addrId);
    shippingService.setDefaultDeliveryAddress(addrId).catch(() => {
      shippingService.syncDeliveryAddresses(updated).catch(() => {});
    });
    const target = updated.find((a) => a.id === addrId);
    if (target) {
      userService.updateMyProfile({
        streetAddress: target.streetAddress,
        latitude: target.latitude ?? null,
        longitude: target.longitude ?? null,
      }).catch(() => {});
    }
  };

  const handleConfirmSelection = () => {
    const chosen = savedAddresses.find((a) => a.id === selectedId) || savedAddresses[0];
    if (chosen) {
      onSelectAddress(chosen);
    }
    onClose();
  };

  return (
    <>
      {/* Address Selection List Modal */}
      {!isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#c34c36]" />
                {lang === 'vi' ? 'Địa Chỉ Của Tôi' : 'My Addresses'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Address List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {savedAddresses.map((addr) => {
                const isSelected = (selectedId || savedAddresses[0]?.id) === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedId(addr.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${isSelected
                      ? 'border-[#c34c36] bg-[#fdf8f6]/60 ring-1 ring-[#c34c36]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                  >
                    {/* Radio check indicator */}
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Address details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{addr.name}</span>
                        <span className="text-xs font-semibold text-slate-500">
                          | (+84) {addr.phone.replace(/^(?:0|\+?84)/, '')}
                        </span>
                        {addr.isDefault && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-[#c34c36] border border-[#c34c36]/40 rounded bg-red-50/70">
                            {lang === 'vi' ? 'Mặc định' : 'Default'}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 rounded">
                          {addr.addressType === 'office' ? (lang === 'vi' ? 'Văn Phòng' : 'Office') : (lang === 'vi' ? 'Nhà Riêng' : 'Home')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">
                        {addr.streetAddress}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditAddress(addr);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {lang === 'vi' ? 'Cập nhật' : 'Edit'}
                      </button>
                      {!addr.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefaultAddress(addr.id);
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {lang === 'vi' ? 'Thiết lập mặc định' : 'Set as default'}
                        </button>
                      )}
                      {savedAddresses.length > 1 && !addr.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(addr.id);
                          }}
                          className="text-[11px] font-medium text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          {lang === 'vi' ? 'Xóa' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Address Button */}
              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#c34c36] hover:bg-[#fdf8f6]/40 text-slate-700 hover:text-[#c34c36] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Thêm Địa Chỉ Mới' : 'Add New Address'}</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSelection}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83824] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Xác Nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopee-Style Modal: "Thêm / Cập Nhật Địa Chỉ" (Add/Edit Address Form Modal) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl sm:max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingAddress
                  ? (lang === 'vi' ? 'Cập Nhật Địa Chỉ Nhận Hàng' : 'Edit Delivery Address')
                  : (lang === 'vi' ? 'Thêm Địa Chỉ Nhận Hàng Mới' : 'New Delivery Address')}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {formErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formErrorMsg}</span>
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'vi' ? 'Họ và tên người nhận *' : 'Recipient Name *'}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'vi' ? 'Số điện thoại nhận hàng *' : 'Phone Number *'}
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => {
                      setFormPhone(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="0912 345 678"
                    maxLength={10}
                    className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                  />
                </div>
              </div>

              {/* Lalamove Address & Map Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Địa chỉ & Ghim vị trí Lalamove *' : 'Address & Map Pin *'}
                </label>
                <LalamoveAddressPicker
                  initialName={formName}
                  initialPhone={formPhone}
                  initialLatitude={formLat}
                  initialLongitude={formLng}
                  initialAddress={formStreet}
                  sellerCity={sellerCityInfo.name}
                  sellerLocation={sellerLocation}
                  onNameChange={(val) => {
                    setFormName(val);
                    if (formErrorMsg) setFormErrorMsg(null);
                  }}
                  onPhoneChange={(val) => {
                    setFormPhone(val);
                    if (formErrorMsg) setFormErrorMsg(null);
                  }}
                  onAddressConfirmed={(data) => {
                    setFormLat(data.latitude);
                    setFormLng(data.longitude);
                    setFormStreet(data.address);
                    setFormCity(data.city);
                    if (data.name && !formName) setFormName(data.name);
                    if (data.phone && !formPhone) setFormPhone(data.phone);
                    if (formErrorMsg) setFormErrorMsg(null);
                  }}
                  lang={lang}
                  title={lang === 'vi' ? 'Tìm địa chỉ & kéo ghim giao hàng' : 'Search address & drag pin'}
                  description={lang === 'vi' ? 'Lalamove sẽ dùng tọa độ ghim này để tính chính xác cước phí' : 'Coordinates will be used for shipping quote'}
                />
              </div>

              {/* Address Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  {lang === 'vi' ? 'Loại địa chỉ:' : 'Address Type:'}
                </label>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormType('home')}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${formType === 'home'
                      ? 'border-[#c34c36] bg-[#fdf8f6] text-[#c34c36]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Nhà Riêng' : 'Home'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('office')}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${formType === 'office'
                      ? 'border-[#c34c36] bg-[#fdf8f6] text-[#c34c36]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Văn Phòng' : 'Office'}</span>
                  </button>
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-[#c34c36] focus:ring-[#c34c36] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  {lang === 'vi' ? 'Thiết lập làm địa chỉ mặc định' : 'Set as default address'}
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Trở Lại' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83824] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hoàn Thành' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

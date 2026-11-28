export interface BuyerDeliveryAddress {
  id: string;
  name: string;
  phone: string;
  email?: string;
  streetAddress: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  addressType?: 'home' | 'office' | 'other';
  isDefault?: boolean;
}

export function getBuyerAddressStorageKey(userId?: string | null): string {
  return userId ? `secondlife_buyer_addresses_${userId}` : 'secondlife_buyer_addresses_guest';
}

export function loadSavedBuyerAddresses(
  userId?: string | null,
  currentUser?: {
    id?: string;
    name?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    streetAddress?: string;
    province?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null
): BuyerDeliveryAddress[] {
  const key = getBuyerAddressStorageKey(userId || currentUser?.id);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { }
  }

  // Fallback to profile address if user has saved one
  const profileAddress = (currentUser?.address || currentUser?.streetAddress || '').trim();
  if (profileAddress) {
    const lat = typeof currentUser?.latitude === 'number' && currentUser.latitude !== 0 ? currentUser.latitude : 10.762622;
    const lng = typeof currentUser?.longitude === 'number' && currentUser.longitude !== 0 ? currentUser.longitude : 106.660172;
    const defaultAddr: BuyerDeliveryAddress = {
      id: `addr-${Date.now()}`,
      name: currentUser?.name || (currentUser as any)?.fullName || 'Khách hàng',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
      streetAddress: profileAddress,
      city: currentUser?.province || 'Thành phố Hồ Chí Minh',
      latitude: lat,
      longitude: lng,
      addressType: 'home',
      isDefault: true,
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, JSON.stringify([defaultAddr]));
      } catch { }
    }
    return [defaultAddr];
  }

  return [];
}

export function saveBuyerAddressesToStorage(addresses: BuyerDeliveryAddress[], userId?: string | null): void {
  const key = getBuyerAddressStorageKey(userId);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(addresses));
    } catch { }
  }
}

export function findDefaultOrFirstAddress(addresses: BuyerDeliveryAddress[]): BuyerDeliveryAddress | null {
  return addresses.find((a) => a.isDefault) || addresses[0] || null;
}

export async function syncBuyerAddressesFromBackend(
  userId?: string | null,
  getAddressesFn?: () => Promise<BuyerDeliveryAddress[]>
): Promise<BuyerDeliveryAddress[]> {
  if (!getAddressesFn) return [];
  try {
    const list = await getAddressesFn();
    if (Array.isArray(list) && list.length > 0) {
      saveBuyerAddressesToStorage(list, userId);
      return list;
    }
  } catch (err) {
    console.warn('syncBuyerAddressesFromBackend notice:', err);
  }
  return [];
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBuyerAddressStorageKey,
  loadSavedBuyerAddresses,
  saveBuyerAddressesToStorage,
  findDefaultOrFirstAddress,
  type BuyerDeliveryAddress,
} from '../utils/buyerAddressStorage';

// Mock localStorage for node environment
const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, val),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

test('getBuyerAddressStorageKey formats user-scoped keys', () => {
  assert.equal(getBuyerAddressStorageKey('user-123'), 'secondlife_buyer_addresses_user-123');
  assert.equal(getBuyerAddressStorageKey(null), 'secondlife_buyer_addresses_guest');
  assert.equal(getBuyerAddressStorageKey(undefined), 'secondlife_buyer_addresses_guest');
});

test('loadSavedBuyerAddresses falls back to user profile when empty', () => {
  storage.clear();
  const profile = {
    id: 'user-456',
    name: 'Nguyen Hieu Tuan',
    phone: '0987894566',
    streetAddress: 'Dragon Capital Việt Nam, 2 Đường Ngô Đức Kế, Phường Sài Gòn, TP.HCM',
    latitude: 10.7769,
    longitude: 106.7009,
  };

  const addresses = loadSavedBuyerAddresses('user-456', profile);
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].name, 'Nguyen Hieu Tuan');
  assert.equal(addresses[0].phone, '0987894566');
  assert.equal(addresses[0].streetAddress, 'Dragon Capital Việt Nam, 2 Đường Ngô Đức Kế, Phường Sài Gòn, TP.HCM');
  assert.equal(addresses[0].isDefault, true);

  // Subsequent loads retrieve from localStorage
  const loaded = loadSavedBuyerAddresses('user-456', null);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Nguyen Hieu Tuan');
});

test('findDefaultOrFirstAddress picks default address', () => {
  const list: BuyerDeliveryAddress[] = [
    {
      id: 'addr-1',
      name: 'User 1',
      phone: '0901111111',
      streetAddress: '123 Le Loi',
      isDefault: false,
    },
    {
      id: 'addr-2',
      name: 'User 2',
      phone: '0902222222',
      streetAddress: '456 Nguyen Hue',
      isDefault: true,
    },
  ];

  const chosen = findDefaultOrFirstAddress(list);
  assert.equal(chosen?.id, 'addr-2');
  assert.equal(chosen?.name, 'User 2');
});

test('saveBuyerAddressesToStorage updates localStorage correctly', () => {
  storage.clear();
  const list: BuyerDeliveryAddress[] = [
    {
      id: 'addr-default',
      name: 'Nguyen Hieu Tuan',
      phone: '0987894566',
      streetAddress: 'Dragon Capital Việt Nam, 2 Đường Ngô Đức Kế, Phường Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam',
      addressType: 'home',
      isDefault: true,
      latitude: 10.7769,
      longitude: 106.7009,
    },
  ];

  saveBuyerAddressesToStorage(list, 'buyer-hieu');
  const loaded = loadSavedBuyerAddresses('buyer-hieu', null);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Nguyen Hieu Tuan');
  assert.equal(loaded[0].streetAddress, 'Dragon Capital Việt Nam, 2 Đường Ngô Đức Kế, Phường Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam');
  assert.equal(loaded[0].addressType, 'home');
});

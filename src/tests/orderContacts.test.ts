import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrderBuyerAddress,
  getOrderBuyerPhone,
  getOrderHubAddress,
  getOrderHubName,
  getOrderSellerAddress,
  getOrderSellerPhone,
  getOrderSellerName,
} from '../pages/inspection-center/dispatch/orderContacts';

test('getOrderBuyerAddress resolves from direct fields or shippingLegs destination', () => {
  const ordWithLegs = {
    id: 'test-1',
    shippingLegs: [
      { origin: 'Hà Nội', destination: 'Hub HCM' },
      { origin: 'Hub HCM', destination: '113 Thạnh Lộc 13, Quận 12, TP.HCM' },
    ],
  };
  assert.equal(getOrderBuyerAddress(ordWithLegs), '113 Thạnh Lộc 13, Quận 12, TP.HCM');

  const ordWithBuyerAddr = {
    id: 'test-2',
    buyerAddress: 'Tiệm làm tóc, 113 Thạnh Lộc 13, Phường An Phú Đông, TP.HCM',
  };
  assert.equal(getOrderBuyerAddress(ordWithBuyerAddr), 'Tiệm làm tóc, 113 Thạnh Lộc 13, Phường An Phú Đông, TP.HCM');
});

test('getOrderSellerAddress resolves real seller address and rejects hardcoded Cần Thơ dummy address', () => {
  // Empty or null order should never return Cần Thơ hardcode
  assert.equal(getOrderSellerAddress(null), 'Kho người bán (Đang cập nhật địa chỉ)');
  assert.equal(getOrderSellerAddress({}), 'Kho người bán (Đang cập nhật địa chỉ)');

  // Hardcoded Cần Thơ address should be filtered out
  const dummyOrd = {
    id: 'test-dummy',
    sellerAddress: '123 Nguyễn Văn Cừ, Phường An Khánh, Quận Ninh Kiều, TP. Cần Thơ',
  };
  assert.equal(getOrderSellerAddress(dummyOrd), 'Kho người bán (Đang cập nhật địa chỉ)');

  // Real address from direct field
  const realOrd = {
    id: 'test-real',
    sellerAddress: 'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam',
  };
  assert.equal(
    getOrderSellerAddress(realOrd),
    'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam'
  );

  // Address from shippingLegs origin
  const legOrd = {
    id: 'test-leg',
    shippingLegs: [
      { origin: 'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam' },
    ],
  };
  assert.equal(
    getOrderSellerAddress(legOrd),
    'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam'
  );

  // Must NEVER fall back to ord.address (personal address)
  const personalOrd = {
    id: 'test-personal',
    address: '574/10 Tô Ngọc Vân, Phường Tam Bình, TP. Thủ Đức, TP.HCM',
  };
  assert.equal(
    getOrderSellerAddress(personalOrd),
    'Kho người bán (Đang cập nhật địa chỉ)'
  );
});

test('getOrderSellerPhone and getOrderSellerName reject dummy mock values', () => {
  assert.equal(getOrderSellerPhone(null), 'Chưa cập nhật SĐT');
  assert.equal(getOrderSellerPhone({ sellerPhone: '0918 234 567' }), 'Chưa cập nhật SĐT');
  assert.equal(getOrderSellerPhone({ sellerPhone: '0987654321' }), '0987654321');

  assert.equal(getOrderSellerName(null), 'Người bán');
  assert.equal(getOrderSellerName({ sellerName: 'Thị Thùy Trang Nguyễn' }), 'Người bán');
  assert.equal(getOrderSellerName({ sellerName: 'Verified Seller' }), 'Verified Seller');
});

test('getOrderHubAddress and getOrderHubName resolve center information', () => {
  const currentUser = {
    centerName: 'Trung tâm kiểm định HCM',
    address: 'K&B Mini Mart, Đường Võ Thị Sáu, Xã Phước Hải, Thành phố Hồ Chí Minh',
  };
  const ord = { id: 'test-hub' };

  assert.equal(getOrderHubName(ord, currentUser), 'Trung tâm kiểm định HCM');
  assert.equal(getOrderHubAddress(ord, currentUser), 'K&B Mini Mart, Đường Võ Thị Sáu, Xã Phước Hải, Thành phố Hồ Chí Minh');
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNearestHubToSeller } from '../utils/orderUtils';

describe('resolveNearestHubToSeller tests', () => {
  const sampleHubs = [
    {
      id: 'hub-hcm-01',
      name: 'Trung tâm kiểm định HCM',
      city: 'Thành phố Hồ Chí Minh',
      address: 'K&B Mini Mart, Đường Võ Thị Sáu, Xã Phước Hải, Thành phố Hồ Chí Minh',
      latitude: 10.7769,
      longitude: 106.7009,
    },
    {
      id: 'hub-hn-01',
      name: 'Trung tâm kiểm định Hà Nội',
      city: 'Hà Nội',
      address: 'Tòa nhà FPT, Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
      latitude: 21.0285,
      longitude: 105.8542,
    },
    {
      id: 'hub-dn-01',
      name: 'Trung tâm kiểm định Đà Nẵng',
      city: 'Đà Nẵng',
      address: 'Đường Nguyễn Văn Linh, Quận Hải Châu, Đà Nẵng',
      latitude: 16.0544,
      longitude: 108.2022,
    },
  ];

  it('1. Seller in Hanoi (Cau Giay) should automatically select Hanoi Hub', () => {
    const sellerAddress = 'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam';
    const sellerLocation = 'Hà Nội';
    const sellerCoords = { lat: 21.0333, lng: 105.7925 };

    const selected = resolveNearestHubToSeller(sampleHubs, sellerAddress, sellerLocation, sellerCoords);
    assert.ok(selected);
    assert.equal(selected?.id, 'hub-hn-01');
    assert.equal(selected?.city, 'Hà Nội');
  });

  it('2. Seller in HCM (Quan 1 / Thu Duc) should automatically select HCM Hub', () => {
    const sellerAddress = '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh';
    const sellerLocation = 'Hồ Chí Minh';
    const sellerCoords = { lat: 10.7756, lng: 106.7019 };

    const selected = resolveNearestHubToSeller(sampleHubs, sellerAddress, sellerLocation, sellerCoords);
    assert.ok(selected);
    assert.equal(selected?.id, 'hub-hcm-01');
    assert.equal(selected?.city, 'Thành phố Hồ Chí Minh');
  });

  it('3. Seller in Da Nang should automatically select Da Nang Hub', () => {
    const sellerAddress = '45 Lê Duẩn, Quận Hải Châu, Đà Nẵng';
    const sellerLocation = 'Đà Nẵng';
    const sellerCoords = { lat: 16.068, lng: 108.212 };

    const selected = resolveNearestHubToSeller(sampleHubs, sellerAddress, sellerLocation, sellerCoords);
    assert.ok(selected);
    assert.equal(selected?.id, 'hub-dn-01');
  });

  it('4. GPS coordinates match closest hub even when text is ambiguous', () => {
    // Coords near Hanoi (Bac Ninh / Hung Yen)
    const sellerAddress = 'Thị trấn Chờ, Yên Phong';
    const sellerCoords = { lat: 21.18, lng: 105.97 };

    const selected = resolveNearestHubToSeller(sampleHubs, sellerAddress, '', sellerCoords);
    assert.ok(selected);
    assert.equal(selected?.id, 'hub-hn-01');
  });

  it('5. Fallback gracefully to first hub if hubs list has only 1 item or empty', () => {
    assert.equal(resolveNearestHubToSeller([], 'Hà Nội'), undefined);
    assert.equal(resolveNearestHubToSeller([sampleHubs[0]], 'Hà Nội')?.id, 'hub-hcm-01');
  });
});

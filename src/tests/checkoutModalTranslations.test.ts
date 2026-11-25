import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatLalamoveVehicle, formatShippingLeg } from '../utils/lalamoveVehicle';

test('1. formatShippingLeg converts all route codes to Vietnamese', () => {
  assert.equal(formatShippingLeg('SELLER_TO_BUYER'), 'Người bán → Người mua');
  assert.equal(formatShippingLeg('SELLER_TO_CENTER'), 'Người bán → Trung tâm kiểm định');
  assert.equal(formatShippingLeg('SELLER_TO_HUB'), 'Người bán → Trung tâm kiểm định');
  assert.equal(formatShippingLeg('CENTER_TO_BUYER'), 'Trung tâm kiểm định → Người mua');
  assert.equal(formatShippingLeg('HUB_TO_BUYER'), 'Trung tâm kiểm định → Người mua');
  assert.equal(formatShippingLeg('CENTER_TO_SELLER'), 'Trung tâm kiểm định → Người bán');
  assert.equal(formatShippingLeg('HUB_TO_SELLER'), 'Trung tâm kiểm định → Người bán');
  assert.equal(formatShippingLeg('BUYER_TO_SELLER'), 'Người mua → Người bán');
  assert.equal(formatShippingLeg(undefined), 'Người bán → Người mua');
});

test('2. formatLalamoveVehicle outputs Vietnamese names without English (Pick-up)', () => {
  const pickup = formatLalamoveVehicle('LD_PICKUP_TRUCK');
  assert.equal(pickup.name, 'Xe bán tải');
  assert.ok(!pickup.name.includes('Pick-up'));

  const pickup2 = formatLalamoveVehicle('PICK_UP_TRUCK');
  assert.equal(pickup2.name, 'Xe bán tải');

  const bike = formatLalamoveVehicle('MOTORCYCLE');
  assert.equal(bike.name, 'Xe máy');

  const van = formatLalamoveVehicle('VAN');
  assert.equal(van.name, 'Xe van');

  const fallback = formatLalamoveVehicle('UNKNOWN_CUSTOM_SERVICE');
  assert.equal(fallback.name, 'Phương tiện vận chuyển');
});

test('3. CheckoutModal UI verifies removed elements and pure Vietnamese labels', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/modals/CheckoutModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf-8');

  // Must NOT contain the removed driver note and escrow email labels
  assert.ok(!content.includes('Ghi chú cho tài xế Lalamove (tùy chọn)'));
  assert.ok(!content.includes('Ví dụ: Gọi trước 15 phút, nhà có thang máy...'));
  assert.ok(!content.includes('Email nhận chứng nhận Escrow & Hóa đơn'));

  // Must NOT contain "Thời gian dự kiến:" in quote box
  assert.ok(!content.includes('Thời gian dự kiến:'));

  // Must use formatShippingLeg
  assert.ok(content.includes('formatShippingLeg(ghnQuote.leg)'));

  // Must NOT render raw serviceType code badge next to vehicle name
  assert.ok(!content.includes('{ghnQuote.serviceType && (\n                                        <span className="font-mono text-[10px]'));
});

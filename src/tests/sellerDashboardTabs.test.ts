import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPreListingHomeAppointmentStage } from '../utils/inspectionTaskStatus';
import { getLatestInboundShipment } from '../utils/inspectionCenterData';
import { getSellerHubShipmentBadge, type SellerHubShipmentSnapshot } from '../utils/sellerHighValueInspection';

test('1. High-value detector identifies items exceeding threshold, pending inspection, or in inspection feed', () => {
  const threshold = 10_000_000;
  const inspectionByPost = new Map<string, any>([
    ['1', { id: 'insp-1', postId: '1', status: 'PASSED', inspectionScope: 'PRE_LISTING' }],
  ]);

  const isHighValueListing = (l: any): boolean => {
    if (l.backendStatus === 'PENDING_INSPECTION') return true;
    if (Boolean(inspectionByPost.has(l.id))) return true;
    if (l.isMandatoryInspection === true || l.mandatoryInspection === true) return true;
    if (Number(l.priceVnd || 0) > threshold) return true;
    return false;
  };

  assert.equal(isHighValueListing({ id: '1', priceVnd: 11_200_000, backendStatus: 'ACTIVE' }), true, '11.2M with inspection feed is high value');
  assert.equal(isHighValueListing({ id: '2', priceVnd: 18_200_000, backendStatus: 'PENDING_INSPECTION' }), true, '18.2M pending inspection is high value');
  assert.equal(isHighValueListing({ id: '3', priceVnd: 11_110_000, backendStatus: 'RESERVED' }), true, '11.11M (> 10M) is high value');
  assert.equal(isHighValueListing({ id: '4', priceVnd: 0, backendStatus: 'DRAFT' }), false, '0 VND draft is NOT high value');
  assert.equal(isHighValueListing({ id: '5', priceVnd: 2_200_000, backendStatus: 'ACTIVE' }), false, '2.2M active product is NOT high value');
  assert.equal(isHighValueListing({ id: '6', priceVnd: 350_000, backendStatus: 'RESERVED' }), false, '350k product is NOT high value');
});

test('2. Normal listings strictly exclude high-value products and only show regular products and drafts', () => {
  const threshold = 10_000_000;
  const inspectionByPost = new Map<string, any>([
    ['1', { id: 'insp-1', postId: '1', status: 'PASSED', inspectionScope: 'PRE_LISTING' }],
  ]);

  const isHighValueListing = (l: any): boolean => {
    if (l.backendStatus === 'PENDING_INSPECTION') return true;
    if (Boolean(inspectionByPost.has(l.id))) return true;
    if (l.isMandatoryInspection === true || l.mandatoryInspection === true) return true;
    if (Number(l.priceVnd || 0) > threshold) return true;
    return false;
  };

  const combinedListings = [
    { id: '1', title: 'Máy Lọc Không Khí Xiaomi', status: 'active', backendStatus: 'ACTIVE', priceVnd: 11_200_000 },
    { id: '2', title: 'Tủ Lạnh Hisense 260L', status: 'pending_inspection', backendStatus: 'PENDING_INSPECTION', priceVnd: 18_200_000 },
    { id: '3', title: 'Tủ Lạnh Hisense Inverter', status: 'reserved', backendStatus: 'RESERVED', priceVnd: 11_110_000 },
    { id: '4', title: 'Máy Lọc Không Khí Sunhouse', status: 'draft', backendStatus: 'DRAFT', priceVnd: 0 },
    { id: '5', title: 'Máy Nước Nóng ATMOR', status: 'active', backendStatus: 'ACTIVE', priceVnd: 2_200_000 },
    { id: '6', title: 'Quạt Đứng Lifan', status: 'reserved', backendStatus: 'RESERVED', priceVnd: 350_000 },
    { id: '7', title: 'Lò Vi Sóng Toshiba', status: 'sold', backendStatus: 'SOLD', priceVnd: 1_350_000 },
    { id: '8', title: 'Bàn Là Hơi Nước Bị Từ Chối', status: 'rejected', backendStatus: 'REJECTED', priceVnd: 200_000 },
  ];

  const normalListings = combinedListings.filter((l) => !isHighValueListing(l));
  const highValueListings = combinedListings.filter((l) => isHighValueListing(l));

  // Must separate cleanly
  assert.equal(normalListings.length, 5, 'Must contain only 5 normal listings (drafts and normal products under 10M)');
  assert.equal(highValueListings.length, 3, 'Must contain 3 high value listings (11.2M, 18.2M, 11.11M)');

  // Verify normalListings contains no high value items
  assert.ok(!normalListings.some(l => l.priceVnd > 10_000_000), 'Normal listings must NOT contain items > 10M');
  assert.ok(!normalListings.some(l => l.backendStatus === 'PENDING_INSPECTION'), 'Normal listings must NOT contain PENDING_INSPECTION');
  assert.ok(!normalListings.some(l => inspectionByPost.has(l.id)), 'Normal listings must NOT contain items with pre-listing inspection');

  // Verify highValueListings contains all high value items
  assert.ok(highValueListings.some(l => l.id === '1'), 'High-value tab contains item 1 (11.2M)');
  assert.ok(highValueListings.some(l => l.id === '2'), 'High-value tab contains item 2 (18.2M)');
  assert.ok(highValueListings.some(l => l.id === '3'), 'High-value tab contains item 3 (11.11M)');
});

test('3. High-value inspection stages categorization: pending_payment, inspecting, passed, failed', () => {
  const getStage = (status: string, backendStatus?: string): string => {
    if (status === 'PASSED' || status === 'COMPLETED') return 'passed';
    if (status === 'FAILED' || status === 'REJECTED' || backendStatus === 'REJECTED') return 'failed';
    if (['CONFIRMED_PENDING_DISPATCH', 'SCHEDULED', 'SHIPPING_TO_CENTER', 'INSPECTING', 'CENTER_HOLDING'].includes(status)) {
      return 'inspecting';
    }
    return 'pending_payment';
  };

  assert.equal(getStage('WAITING_FEE_PAYMENT'), 'pending_payment');
  assert.equal(getStage('PENDING'), 'pending_payment');
  assert.equal(getStage('SCHEDULED'), 'inspecting');
  assert.equal(getStage('SHIPPING_TO_CENTER'), 'inspecting');
  assert.equal(getStage('INSPECTING'), 'inspecting');
  assert.equal(getStage('PASSED'), 'passed');
  assert.equal(getStage('COMPLETED'), 'passed');
  assert.equal(getStage('FAILED'), 'failed');
  assert.equal(getStage('REJECTED'), 'failed');
});

test('paid home inspection is awaiting an appointment until the seller schedules it', () => {
  const order = { orderType: 'AT_HOME', status: 'CONFIRMED_PENDING_DISPATCH' };
  const appointmentScheduledAt = '2026-11-21T02:00:00Z';

  assert.equal(getPreListingHomeAppointmentStage(order), 'awaiting_schedule');
  assert.equal(getPreListingHomeAppointmentStage({ ...order, appointmentStatus: 'REJECTED' }), 'awaiting_schedule');
  assert.equal(getPreListingHomeAppointmentStage({ ...order, appointmentScheduledAt, appointmentStatus: 'PENDING_CENTER_CONFIRMATION' }), 'awaiting_center');
  assert.equal(getPreListingHomeAppointmentStage({ ...order, appointmentScheduledAt, appointmentStatus: 'COUNTERED_BY_CENTER' }), 'countered');
  assert.equal(getPreListingHomeAppointmentStage({ ...order, status: 'SCHEDULED', appointmentScheduledAt }), 'scheduled');
  assert.equal(getPreListingHomeAppointmentStage({ ...order, status: 'INSPECTING', appointmentScheduledAt }), null);
  assert.equal(getPreListingHomeAppointmentStage({ ...order, status: 'WAITING_FEE_PAYMENT' }), null);
  assert.equal(getPreListingHomeAppointmentStage({ ...order, orderType: 'AT_CENTER' }), null);
});

test('high-value Hub badges use the latest inbound shipment from the API', () => {
  const pending = {
    shipmentId: 'new', orderId: 'inspection-a', leg: 'SELLER_TO_CENTER', orderCode: 'new-code',
    status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER', expectedDeliveryTime: null, deliveredAt: null,
  };
  const rejected = { ...pending, shipmentId: 'old', status: 'FAILED', providerStatus: 'REJECTED' };
  const paid = 'CONFIRMED_PENDING_DISPATCH';
  const label = (inspectionStatus: string, shipment: SellerHubShipmentSnapshot | undefined) =>
    getSellerHubShipmentBadge(inspectionStatus, shipment, 'vi').label;

  assert.equal(label(paid, getLatestInboundShipment([rejected, pending])), '● Đã tạo vận đơn · Đang tìm tài xế');
  assert.equal(label(paid, undefined), '● Đang tải trạng thái vận đơn');
  assert.equal(label(paid, 'unavailable'), '● Chưa tải được trạng thái vận đơn');
  assert.equal(label(paid, null), '● Đã nộp phí · Chờ gửi hàng tới Hub');
  assert.equal(label(paid, { ...pending, status: 'ASSIGNED', providerStatus: 'ON_GOING' }), '● Tài xế đang đến lấy hàng');
  assert.equal(label(paid, pending), '● Đã tạo vận đơn · Đang tìm tài xế');
  assert.equal(label(paid, rejected), '● Vận đơn thất bại');
  assert.equal(label('SHIPPING_TO_CENTER', { ...pending, status: 'PICKED', providerStatus: 'PICKED_UP' }), '● Đang giao hàng đến Hub');
  const delivered = { ...pending, status: 'DELIVERED', providerStatus: 'COMPLETED' };
  assert.equal(label('RECEIVED_AT_CENTER', delivered), '● Đã đến Hub · Chờ kiểm định');
  assert.equal(label('INSPECTING', delivered), '● Đang Kiểm Định Tại Hub');
});

test('5. Seller dashboard listings pagination: 10 items per page and page range calculation', () => {
  const ITEMS_PER_PAGE = 10;
  const dummyListings = Array.from({ length: 30 }, (_, i) => ({ id: `listing-${i + 1}`, title: `Product ${i + 1}` }));

  const totalPages = Math.ceil(dummyListings.length / ITEMS_PER_PAGE);
  assert.equal(totalPages, 3, '30 items with 10 per page must equal 3 pages');

  // Page 1: items 1 - 10
  const page1 = dummyListings.slice(0, 10);
  assert.equal(page1.length, 10);
  assert.equal(page1[0].id, 'listing-1');
  assert.equal(page1[9].id, 'listing-10');

  // Page 2: items 11 - 20
  const page2 = dummyListings.slice(10, 20);
  assert.equal(page2.length, 10);
  assert.equal(page2[0].id, 'listing-11');
  assert.equal(page2[9].id, 'listing-20');

  // Page 3: items 21 - 30
  const page3 = dummyListings.slice(20, 30);
  assert.equal(page3.length, 10);
  assert.equal(page3[0].id, 'listing-21');
  assert.equal(page3[9].id, 'listing-30');

  // Pagination range helper
  function getPaginationRange(current: number, total: number): (number | '...')[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, '...', total];
    }
    if (current >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  assert.deepEqual(getPaginationRange(1, 3), [1, 2, 3]);
  assert.deepEqual(getPaginationRange(2, 3), [1, 2, 3]);
  assert.deepEqual(getPaginationRange(3, 3), [1, 2, 3]);
  assert.deepEqual(getPaginationRange(1, 10), [1, 2, 3, 4, '...', 10]);
  assert.deepEqual(getPaginationRange(5, 10), [1, '...', 4, 5, 6, '...', 10]);
  assert.deepEqual(getPaginationRange(9, 10), [1, '...', 7, 8, 9, 10]);
});

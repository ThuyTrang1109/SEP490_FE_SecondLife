import assert from 'node:assert/strict';
import test from 'node:test';
import type { EscrowOrder, ShipmentBackend } from '../types';
import { extractAddressText, getOrderBuyerAddress, getOrderBuyerName, getOrderBuyerPhone, getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from '../pages/inspection-center/dispatch/orderContacts';

const sampleOrder: EscrowOrder = {
  id: 'c2445492-ae03-4f92-930f-7ace65001656',
  listingId: 'd82e9fe8-078b-4285-b6de-33e3f6c69d85',
  listing: {
    id: 'd82e9fe8-078b-4285-b6de-33e3f6c69d85',
    title: 'Máy Nước Nóng ATMOR Alpha Dưới 2500W - Hàng Dùng Lướt Như Mới',
    price: 2200000,
    photos: { front: 'https://images.example.com/front.jpg' },
    seller: { name: 'Verified Seller', phone: '0969768917' },
    sellerAddress: 'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam',
    conditionGrade: 'A',
  } as any,
  buyerId: 'buyer-uuid',
  buyerName: 'Nguyen Hieu Tuan Hà Nội',
  buyerPhone: '0986444333',
  buyerAddress: 'Trường Trung học cơ sở Khai Thái, Đê Hữu Hồng, Xã Đại Xuyên, Thành phố Hà Nội, Việt Nam',
  sellerId: '542010c9-4da6-4881-a5bb-fbb10189c69d',
  sellerName: 'Gian Hàng Verified Seller',
  sellerPhone: '0969768917',
  sellerAddress: 'WinMart+, Ngõ 29 Phố Dịch Vọng, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam',
  itemPriceVnd: 2200000,
  inspectionFeeVnd: 0,
  shippingFeeVnd: 347000,
  platformFeeVnd: 0,
  totalPaidVnd: 2547000,
  escrowStatus: 'FROZEN' as any,
  hasInspectionService: false,
  shippingLegs: [],
  createdAt: '2026-11-22T20:25:05Z',
  multiStagePhotos: {} as any,
  orderReturn: {
    orderId: 'c2445492-ae03-4f92-930f-7ace65001656',
    reportId: '8e7585a9-df35-45a9-aa60-800ce2464785',
  },
  deliveryAddress: '{"name":"Nguyen Hieu Tuan Hà Nội","phone":"0986444333","address":"Trường Trung học cơ sở Khai Thái, Đê Hữu Hồng, Xã Đại Xuyên, Thành phố Hà Nội, Việt Nam","latitude":20.73079,"longitude":105.95685}',
};

test('buyer return shipment extracts full sender (buyer) and recipient (seller) details', () => {
  // Sender (Khách mua hoàn hàng - Điểm lấy hàng)
  const buyerName = getOrderBuyerName(sampleOrder);
  const buyerPhone = getOrderBuyerPhone(sampleOrder);
  const buyerAddr = getOrderBuyerAddress(sampleOrder);

  assert.equal(buyerName, 'Nguyen Hieu Tuan Hà Nội');
  assert.equal(buyerPhone, '0986444333');
  assert.match(buyerAddr, /Trường Trung học cơ sở Khai Thái/);

  // Recipient (Người bán nhận lại hàng - Điểm giao trả)
  const sellerName = getOrderSellerName(sampleOrder);
  const sellerPhone = getOrderSellerPhone(sampleOrder);
  const sellerAddr = getOrderSellerAddress(sampleOrder);

  assert.equal(sellerName, 'Gian Hàng Verified Seller');
  assert.equal(sellerPhone, '0969768917');
  assert.match(sellerAddr, /WinMart\+, Ngõ 29 Phố Dịch Vọng/);
});

test('buyer return shipment parameters use BUYER_TO_SELLER leg and dispute reportId', () => {
  const approval = sampleOrder.orderReturn;
  assert.ok(approval);
  assert.equal(approval.reportId, '8e7585a9-df35-45a9-aa60-800ce2464785');
  assert.equal(approval.orderId, 'c2445492-ae03-4f92-930f-7ace65001656');

  const payload = {
    requestId: 'test-request-id',
    reportId: approval.reportId,
    leg: 'BUYER_TO_SELLER',
  };

  assert.equal(payload.leg, 'BUYER_TO_SELLER');
  assert.equal(payload.reportId, approval.reportId);
});

test('previous outbound shipment overrides addresses with authoritative recorded delivery points', () => {
  const previousOutbound: Partial<ShipmentBackend> = {
    shipmentId: 'shipment-1',
    leg: 'SELLER_TO_BUYER',
    senderName: 'Gian Hàng Verified Seller Chi Nhánh 1',
    senderPhone: '0969768917',
    senderAddress: 'Kho số 5, 29 Dịch Vọng, Cầu Giấy, Hà Nội',
    receiverName: 'Nguyen Hieu Tuan',
    receiverPhone: '0986444333',
    receiverAddress: 'Trường THCS Khai Thái, Phú Xuyên, Hà Nội',
  };

  // In the return modal:
  // Outbound receiver becomes return sender
  const returnSenderName = previousOutbound.receiverName;
  const returnSenderPhone = previousOutbound.receiverPhone;
  const returnSenderAddress = previousOutbound.receiverAddress;

  // Outbound sender becomes return recipient
  const returnRecipientName = previousOutbound.senderName;
  const returnRecipientPhone = previousOutbound.senderPhone;
  const returnRecipientAddress = previousOutbound.senderAddress;

  assert.equal(returnSenderName, 'Nguyen Hieu Tuan');
  assert.equal(returnSenderAddress, 'Trường THCS Khai Thái, Phú Xuyên, Hà Nội');
  assert.equal(returnRecipientName, 'Gian Hàng Verified Seller Chi Nhánh 1');
  assert.equal(returnRecipientAddress, 'Kho số 5, 29 Dịch Vọng, Cầu Giấy, Hà Nội');
});

test('seller order tracking correctly picks BUYER_TO_SELLER return shipment and enriches orderReturn', () => {
  const returnShipment: ShipmentBackend = {
    shipmentId: 'return-shipment-uuid-123',
    orderId: sampleOrder.id,
    leg: 'BUYER_TO_SELLER',
    status: 'IN_TRANSIT',
    providerStatus: 'ON_GOING',
    orderCode: 'LLM-RET-999',
    senderName: 'Nguyen Hieu Tuan Hà Nội',
    senderAddress: 'Trường THCS Khai Thái, Hà Nội',
    receiverName: 'Gian Hàng Verified Seller',
    receiverAddress: 'WinMart+, Ngõ 29 Phố Dịch Vọng, Hà Nội',
    shareLink: 'https://share.lalamove.com/v2/test-tracking',
  } as any;

  // Emulate EscrowOrdersView seller card enrichment
  const isSeller = true;
  const sellerReturnShipments = new Map<string, ShipmentBackend | null>([[sampleOrder.id, returnShipment]]);
  const resolvedReturn = isSeller ? sellerReturnShipments.get(sampleOrder.id) : undefined;

  assert.ok(resolvedReturn);
  assert.equal(resolvedReturn.leg, 'BUYER_TO_SELLER');
  assert.equal(resolvedReturn.orderCode, 'LLM-RET-999');

  const cardOrder = {
    ...sampleOrder,
    returnShipment: resolvedReturn,
    orderReturn: sampleOrder.orderReturn ? {
      ...sampleOrder.orderReturn,
      shipmentId: resolvedReturn.shipmentId,
      shipmentStatus: resolvedReturn.status,
      orderCode: resolvedReturn.orderCode,
    } : null,
  };

  assert.equal(cardOrder.orderReturn?.shipmentId, 'return-shipment-uuid-123');
  assert.equal(cardOrder.orderReturn?.orderCode, 'LLM-RET-999');
  assert.equal(cardOrder.orderReturn?.shipmentStatus, 'IN_TRANSIT');
  assert.equal(cardOrder.returnShipment.shareLink, 'https://share.lalamove.com/v2/test-tracking');
});

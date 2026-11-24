import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSellerOrderActions } from '../actions/orders/createSellerOrderActions';
import { orderService } from '../services/orderService';
import { shippingService } from '../services/shippingService';

test('1. createSellerOrderActions handleSellerConfirmOrder does NOT automatically create Lalamove shipment', async () => {
  let confirmOrderCalled = false;
  let createShipmentCalled = false;
  let capturedNotice: string | null = null;
  let capturedDialog: any = null;

  // Mock orderService.confirmOrder
  const originalConfirmOrder = orderService.confirmOrder;
  const originalCreateShipment = shippingService.createShipment;

  orderService.confirmOrder = async (orderId: string) => {
    confirmOrderCalled = true;
    return { success: true };
  };

  shippingService.createShipment = async () => {
    createShipmentCalled = true;
    return {} as any;
  };

  try {
    const mockOrder: any = {
      id: 'order-direct-123',
      hasInspectionService: false,
      inspectionFeeVnd: 0,
      escrowStatus: 'AWAITING_SELLER_CONFIRMATION',
      backendStatus: 'CONFIRMED',
      status: 'CONFIRMED',
    };

    const actions = createSellerOrderActions({
      lang: 'vi',
      detailModalOrder: mockOrder,
      setDetailModalOrder: () => {},
      onRefreshOrders: () => {},
      setInspectionActionNotice: (msg) => { capturedNotice = msg; },
      setOrderActionLoading: () => {},
      findOrderForAction: () => mockOrder,
      getPartyInspectionFee: () => 0,
      handleRespondInspection: async () => {},
      getInspectionFeeSplit: () => 'NONE' as any,
      setConfirmDialog: (dialog) => { capturedDialog = dialog; },
      setLocalReadyOrderIds: () => {},
      setDetailShipments: () => {},
    });

    // Seller triggers confirmation flow
    actions.handleSellerConfirmOrder('order-direct-123');

    assert.ok(capturedDialog, 'Confirm dialog must open');
    assert.equal(capturedDialog.isOpen, true);

    // Seller confirms the dialog
    await capturedDialog.onConfirm();

    assert.equal(confirmOrderCalled, true, 'orderService.confirmOrder must be called');
    assert.equal(createShipmentCalled, false, 'shippingService.createShipment must NOT be called on order confirmation');
    assert.ok(capturedNotice?.includes('Đã gói hàng • Tạo đơn vận chuyển'), 'Notice must guide seller to pack and click create shipment button');
  } finally {
    orderService.confirmOrder = originalConfirmOrder;
    shippingService.createShipment = originalCreateShipment;
  }
});

test('2. Source verification: createSellerOrderActions does not contain auto-shipment creation in handleSellerConfirmOrder', () => {
  const filePath = path.resolve(process.cwd(), 'src/actions/orders/createSellerOrderActions.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify that handleSellerConfirmOrder no longer creates shipment
  const confirmOrderFn = content.substring(
    content.indexOf('const handleSellerConfirmOrder ='),
    content.indexOf('const handleSellerMarkReadyForPickup =')
  );

  assert.ok(!confirmOrderFn.includes('shippingService.createShipment'), 'handleSellerConfirmOrder must not call shippingService.createShipment');
  assert.ok(!confirmOrderFn.includes('Tự động tạo vận đơn Lalamove ngay khi người bán xác nhận'), 'Auto-create comment must be removed');
});

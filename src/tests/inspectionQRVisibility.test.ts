import test from 'node:test';
import assert from 'node:assert/strict';

interface MockOrder {
  id: string;
  hasInspectionService?: boolean;
  inspectionFeeVnd?: number;
  inspectionCenterId?: string;
  inspectionMethod?: 'AT_CENTER' | 'AT_HOME';
  orderType?: string;
  escrowStatus: string;
  backendStatus?: string;
  sellerId: string;
  buyerId: string;
}

// Logic extracted from EscrowOrdersView.tsx for showing At-Home QR button
function shouldShowAtHomeQrButton(
  order: MockOrder,
  currentUserId: string
): boolean {
  const isOrderSeller = order.sellerId === currentUserId;
  const isAtHome = order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME';
  const isCancelledOrRefunded =
    order.escrowStatus === 'CANCELLED' ||
    order.escrowStatus === 'REFUNDED_TO_BUYER' ||
    order.escrowStatus === 'CANCELED' ||
    order.backendStatus === 'CANCELLED';
  const isPassed = order.escrowStatus === 'INSPECTION_PASSED' || order.backendStatus === 'PASSED';

  // Seller NEVER has intake QR button
  if (isOrderSeller) {
    return false;
  }

  // Only Buyer has intake QR button, and ONLY for AT_HOME, when active and not completed
  return !isOrderSeller && isAtHome && !isCancelledOrRefunded && !isPassed;
}

test('Inspection QR Button Visibility Matrix', async (t) => {
  const sellerId = 'seller-123';
  const buyerId = 'buyer-456';

  await t.test('[TEST 1] Seller NEVER sees QR button for AT_HOME order', () => {
    const order: MockOrder = {
      id: 'ord-at-home-1',
      hasInspectionService: true,
      inspectionFeeVnd: 188150,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'HELD_IN_ESCROW',
      sellerId,
      buyerId
    };

    const sellerCanSee = shouldShowAtHomeQrButton(order, sellerId);
    assert.strictEqual(sellerCanSee, false, 'Seller must NOT see QR button for AT_HOME');
  });

  await t.test('[TEST 2] Seller NEVER sees QR button for AT_CENTER order', () => {
    const order: MockOrder = {
      id: 'ord-center-1',
      hasInspectionService: true,
      inspectionFeeVnd: 897000,
      inspectionCenterId: 'center-1',
      inspectionMethod: 'AT_CENTER',
      escrowStatus: 'HELD_IN_ESCROW',
      sellerId,
      buyerId
    };

    const sellerCanSee = shouldShowAtHomeQrButton(order, sellerId);
    assert.strictEqual(sellerCanSee, false, 'Seller must NOT see QR button for AT_CENTER');
  });

  await t.test('[TEST 3] Buyer DOES NOT see QR button for AT_CENTER order', () => {
    const order: MockOrder = {
      id: 'ord-center-2',
      hasInspectionService: true,
      inspectionFeeVnd: 897000,
      inspectionCenterId: 'center-1',
      inspectionMethod: 'AT_CENTER',
      escrowStatus: 'HELD_IN_ESCROW',
      sellerId,
      buyerId
    };

    const buyerCanSee = shouldShowAtHomeQrButton(order, buyerId);
    assert.strictEqual(buyerCanSee, false, 'Buyer must NOT see QR button when inspection is AT_CENTER');
  });

  await t.test('[TEST 4] Buyer DOES see QR button for AT_HOME active order', () => {
    const order: MockOrder = {
      id: 'ord-at-home-2',
      hasInspectionService: true,
      inspectionFeeVnd: 188150,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'HELD_IN_ESCROW',
      sellerId,
      buyerId
    };

    const buyerCanSee = shouldShowAtHomeQrButton(order, buyerId);
    assert.strictEqual(buyerCanSee, true, 'Buyer MUST see intake QR button for AT_HOME active order');
  });

  await t.test('[TEST 5] Buyer does not see QR button if order is cancelled or passed', () => {
    const cancelledOrder: MockOrder = {
      id: 'ord-at-home-3',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'CANCELLED',
      sellerId,
      buyerId
    };

    const passedOrder: MockOrder = {
      id: 'ord-at-home-4',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'INSPECTION_PASSED',
      sellerId,
      buyerId
    };

    assert.strictEqual(shouldShowAtHomeQrButton(cancelledOrder, buyerId), false);
    assert.strictEqual(shouldShowAtHomeQrButton(passedOrder, buyerId), false);
  });
});


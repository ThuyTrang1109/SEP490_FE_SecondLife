import test from 'node:test';
import assert from 'node:assert/strict';

test('Inbound delivery > 15 minutes logic behaves correctly', () => {
  const isDeliveredOver15Min = (deliveredAt: string | null | undefined, hasSubsequentLeg: boolean): boolean => {
    if (hasSubsequentLeg) return true;
    if (!deliveredAt) return false;
    const ts = new Date(deliveredAt).getTime();
    if (isNaN(ts)) return false;
    return Date.now() - ts > 15 * 60 * 1000;
  };

  // Case 1: Delivered 20 minutes ago -> should be over 15 min
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  assert.equal(isDeliveredOver15Min(twentyMinsAgo, false), true);

  // Case 2: Delivered 5 minutes ago -> should NOT be over 15 min
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.equal(isDeliveredOver15Min(fiveMinsAgo, false), false);

  // Case 3: Delivered recently or no timestamp, but subsequent leg (return/buyer) exists -> over 15 min / collapsed
  assert.equal(isDeliveredOver15Min(fiveMinsAgo, true), true);
  assert.equal(isDeliveredOver15Min(null, true), true);
});

test('Leg titles and routes distinguish Seller-to-Hub, Hub-to-Seller, and Hub-to-Buyer', () => {
  const getLegBadgeTitle = (leg: 'SELLER_TO_CENTER' | 'CENTER_TO_SELLER' | 'CENTER_TO_BUYER') => {
    switch (leg) {
      case 'SELLER_TO_CENTER':
        return 'Chặng 1: Người Bán → Hub';
      case 'CENTER_TO_SELLER':
        return 'Chặng Hoàn Trả: Hub → Người bán';
      case 'CENTER_TO_BUYER':
        return 'Chặng Giao Hàng: Hub → Người mua';
    }
  };

  assert.equal(getLegBadgeTitle('SELLER_TO_CENTER'), 'Chặng 1: Người Bán → Hub');
  assert.equal(getLegBadgeTitle('CENTER_TO_SELLER'), 'Chặng Hoàn Trả: Hub → Người bán');
  assert.equal(getLegBadgeTitle('CENTER_TO_BUYER'), 'Chặng Giao Hàng: Hub → Người mua');
});

test('Inspection decision button visibility on main card list vs detail modal', () => {
  const shouldShowInspectionDecisionButton = (
    decision: 'pending' | 'accepted' | 'rejected' | null,
    isSeller: boolean,
    isCancelledOrRefunded: boolean,
    isInsideDetailModal: boolean,
    hasHandler = true,
  ): boolean => {
    const canDecide = decision === 'pending' && !isSeller && !isCancelledOrRefunded;
    return isInsideDetailModal
      ? Boolean(hasHandler || canDecide)
      : canDecide;
  };

  // --- TRÊN THẺ DANH SÁCH CHÍNH (isInsideDetailModal: false) ---
  // Case 1: Đơn đang chờ người mua quyết định mua -> Hiện nút "Xem kết quả & quyết định mua"
  assert.equal(shouldShowInspectionDecisionButton('pending', false, false, false), true);

  // Case 2: Người bán xem đơn ngoài danh sách -> KHÔNG hiện nút
  assert.equal(shouldShowInspectionDecisionButton('pending', true, false, false), false);

  // Case 3: Đơn kiểm định thất bại / đã hủy / hoàn tiền ngoài danh sách -> KHÔNG hiện nút thừa "Xem kết quả kiểm định"
  assert.equal(shouldShowInspectionDecisionButton(null, false, true, false), false);
  assert.equal(shouldShowInspectionDecisionButton('pending', false, true, false), false);

  // --- TRONG MODAL XEM CHI TIẾT (isInsideDetailModal: true) ---
  // Case 4: Khi ấn vào "Xem chi tiết" của bất kỳ đơn nào có kết quả kiểm định -> PHẢI CÓ NÚT xem kết quả kiểm định
  assert.equal(shouldShowInspectionDecisionButton(null, false, true, true), true);
  assert.equal(shouldShowInspectionDecisionButton('pending', true, false, true), true);
  assert.equal(shouldShowInspectionDecisionButton('accepted', false, false, true), true);
  assert.equal(shouldShowInspectionDecisionButton('rejected', false, false, true), true);
});



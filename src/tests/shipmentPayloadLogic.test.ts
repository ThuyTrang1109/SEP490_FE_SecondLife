import test from 'node:test';
import assert from 'node:assert/strict';

export function buildShipmentPayload({
  requestId,
  isHubInspection,
  senderName,
  senderPhone,
  buyerName,
  buyerPhone,
  hubCenterName,
}: {
  requestId: string;
  isHubInspection: boolean;
  senderName: string;
  senderPhone: string;
  buyerName: string;
  buyerPhone: string;
  hubCenterName?: string;
}) {
  const payloadLeg = isHubInspection ? 'SELLER_TO_CENTER' : 'SELLER_TO_BUYER';

  const shipmentPayload: any = {
    requestId,
    leg: payloadLeg,
    reason: isHubInspection
      ? `Bàn giao kiện hàng đến ${hubCenterName || 'Trung tâm kiểm định'} thẩm định`
      : 'Giao hàng cho người mua qua Lalamove',
  };

  // Backend quy định (xem schema CreateShipmentRequest):
  // Đối với SELLER_TO_CENTER: Điểm lấy hàng và điểm đến đã được chốt và lưu trong báo giá / hồ sơ trung tâm.
  // Bỏ fromAddress và toAddress để BE tự động dùng dữ liệu đã chốt, tránh lỗi 409 Conflict.
  if (!isHubInspection) {
    shipmentPayload.fromAddress = {
      name: senderName,
      phone: senderPhone,
      latitude: 10.7769,
      longitude: 106.7009,
    };
    shipmentPayload.toAddress = {
      name: buyerName,
      phone: buyerPhone,
      latitude: 10.8012,
      longitude: 106.7123,
    };
  }

  return shipmentPayload;
}

test('Shipment Payload Contract Verification', async (t) => {
  await t.test('[TEST 1] SELLER_TO_CENTER must omit fromAddress and toAddress to comply with Backend inspection quote and center profile', () => {
    const payload = buildShipmentPayload({
      requestId: 'req-123',
      isHubInspection: true,
      senderName: 'Nguyen Van A',
      senderPhone: '0912345678',
      buyerName: 'Tran Thi B',
      buyerPhone: '0987654321',
      hubCenterName: 'Trung Tam Kiem Dinh Chinh Thanh pho Ho Chi minh',
    });

    assert.equal(payload.leg, 'SELLER_TO_CENTER');
    assert.equal(payload.fromAddress, undefined, 'fromAddress must be undefined for SELLER_TO_CENTER');
    assert.equal(payload.toAddress, undefined, 'toAddress must be undefined for SELLER_TO_CENTER');
    assert.match(payload.reason, /Trung Tam Kiem Dinh Chinh/);
  });

  await t.test('[TEST 2] SELLER_TO_BUYER must include toAddress for direct delivery', () => {
    const payload = buildShipmentPayload({
      requestId: 'req-456',
      isHubInspection: false,
      senderName: 'Nguyen Van A',
      senderPhone: '0912345678',
      buyerName: 'Tran Thi B',
      buyerPhone: '0987654321',
    });

    assert.equal(payload.leg, 'SELLER_TO_BUYER');
    assert.ok(payload.toAddress, 'toAddress must be present for SELLER_TO_BUYER');
    assert.equal(payload.toAddress.name, 'Tran Thi B');
    assert.equal(payload.toAddress.phone, '0987654321');
  });
});


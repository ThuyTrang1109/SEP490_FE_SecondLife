import test from 'node:test';
import assert from 'node:assert/strict';

// Logic tương ứng với getAtHomeStatus trong OrderStatusBadge
function resolveAtHomeStatusText({
  isSeller,
  isArrived = false,
  hasInspector = false,
  appointmentStatus = null,
  hasAppointment = false,
  isCountered = false,
  isPendingApproval = false,
  lang = 'vi',
}: {
  isSeller: boolean;
  isArrived?: boolean;
  hasInspector?: boolean;
  appointmentStatus?: string | null;
  hasAppointment?: boolean;
  isCountered?: boolean;
  isPendingApproval?: boolean;
  lang?: 'vi' | 'en';
}) {
  if (isArrived) {
    return lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting';
  }
  if (hasInspector) {
    return lang === 'vi' ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Inspector Assigned • Pending Survey';
  }
  if (appointmentStatus === 'CONFIRMED') {
    return lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch';
  }
  if (isSeller) {
    if (isCountered) {
      return lang === 'vi' ? 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi' : 'Hub Proposed New Time • Response Needed';
    }
    if (isPendingApproval || hasAppointment) {
      return lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval';
    }
    return lang === 'vi' ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Awaiting Schedule Visit';
  }
  // Buyer: Chỉ hiển thị lịch đầu tiên / trạng thái chờ KTV, không hiện các trạng thái đề xuất/đổi lịch nội bộ giữa Seller và Hub
  return lang === 'vi' ? 'Chờ Người Bán Hẹn Lịch KTV' : 'Awaiting Seller Schedule Visit';
}

test('At-home appointment status perspective separation between Seller and Buyer', async (t) => {
  await t.test('Khi Seller đề xuất lịch hẹn chờ Hub duyệt', () => {
    // Phía Seller: hiển thị Đã Đề Xuất Lịch • Chờ Hub Duyệt
    const sellerStatus = resolveAtHomeStatusText({
      isSeller: true,
      hasAppointment: true,
      isPendingApproval: true,
    });
    assert.equal(sellerStatus, 'Đã Đề Xuất Lịch • Chờ Hub Duyệt');

    // Phía Buyer: KHÔNG hiển thị Đã Đề Xuất Lịch • Chờ Hub Duyệt, mà hiển thị trạng thái chờ người bán hẹn lịch
    const buyerStatus = resolveAtHomeStatusText({
      isSeller: false,
      hasAppointment: true,
      isPendingApproval: true,
    });
    assert.equal(buyerStatus, 'Chờ Người Bán Hẹn Lịch KTV');
  });

  await t.test('Khi Hub đề xuất lịch mới (Countered by Center)', () => {
    // Phía Seller: hiển thị Hub Đề Xuất Lịch Mới • Cần Phản Hồi
    const sellerStatus = resolveAtHomeStatusText({
      isSeller: true,
      hasAppointment: true,
      isCountered: true,
    });
    assert.equal(sellerStatus, 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi');

    // Phía Buyer: không hiện trạng thái đổi lịch thương lượng của Seller, vẫn hiển thị Chờ Người Bán Hẹn Lịch KTV
    const buyerStatus = resolveAtHomeStatusText({
      isSeller: false,
      hasAppointment: true,
      isCountered: true,
    });
    assert.equal(buyerStatus, 'Chờ Người Bán Hẹn Lịch KTV');
  });

  await t.test('Khi lịch hẹn được xác nhận chốt (CONFIRMED)', () => {
    // Cả hai bên đều thấy lịch đã được chốt
    const sellerStatus = resolveAtHomeStatusText({
      isSeller: true,
      appointmentStatus: 'CONFIRMED',
    });
    assert.equal(sellerStatus, 'Đã Chốt Lịch • Chờ Giao KTV');

    const buyerStatus = resolveAtHomeStatusText({
      isSeller: false,
      appointmentStatus: 'CONFIRMED',
    });
    assert.equal(buyerStatus, 'Đã Chốt Lịch • Chờ Giao KTV');
  });

  await t.test('Khi KTV được phân công và khi KTV đến kiểm tra', () => {
    // Đã phân công KTV
    assert.equal(
      resolveAtHomeStatusText({ isSeller: true, hasInspector: true }),
      'Đã Phân Công KTV • Chờ Khảo Sát'
    );
    assert.equal(
      resolveAtHomeStatusText({ isSeller: false, hasInspector: true }),
      'Đã Phân Công KTV • Chờ Khảo Sát'
    );

    // KTV đã đến
    assert.equal(
      resolveAtHomeStatusText({ isSeller: true, isArrived: true }),
      'Kỹ thuật viên đã đến và đang kiểm tra'
    );
    assert.equal(
      resolveAtHomeStatusText({ isSeller: false, isArrived: true }),
      'Kỹ thuật viên đã đến và đang kiểm tra'
    );
  });
});

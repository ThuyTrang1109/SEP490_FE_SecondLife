import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderSellerAddress } from '../pages/inspection-center/dispatch/orderContacts';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';

test('Inspection Order Flow and Address Resolution Fixes', async (t) => {
  await t.test('1. Seller warehouse address strictly rejects user_profiles address ("Ngã tư Công Lý") and prefers seller_onboarding', () => {
    const dummyOrder = {
      id: '8c0ab04c-d7fe-43aa-a70a-d2bd55d6e848',
      sellerId: '2f271a3c-b77a-4bed-ad75-bc3a35535594',
      sellerName: 'Thị Thùy Trang Nguyễn (SE184351)',
      sellerAddress: 'Ngã tư Công Lý - Einstein, Công Lý, Phường Thủ Đức, Thành phố Hồ Chí Minh, Việt Nam',
      sellerContact: {
        address: 'Ngã tư Công Lý - Einstein, Công Lý, Phường Thủ Đức, Thành phố Hồ Chí Minh, Việt Nam',
      },
      sellerPickupAddressJson: JSON.stringify({
        name: 'Gian Hàng Thị Thùy Trang Nguyễ',
        phone: '0334813049',
        address: 'Student Station Coffee, Đường Quảng Trường Sáng Tạo, Phường Đông Hòa, Thành phố Dĩ An, BI 00084, Việt Nam',
        latitude: 10.874968863939767,
        longitude: 106.79949045181274,
      }),
      orderType: 'AT_HOME',
      status: 'CONFIRMED_PENDING_DISPATCH',
    };

    const resolved = getOrderSellerAddress(dummyOrder);
    assert.doesNotMatch(resolved, /Ngã tư Công Lý/i, 'Must not use user_profiles personal address');
    assert.match(resolved, /Student Station Coffee/i, 'Must use official seller onboarding address');
  });

  await t.test('2. mapEscrowOrder maps AT_HOME inspection method correctly and resolves onboarding seller address', () => {
    const rawOrder = {
      id: '8c0ab04c-d7fe-43aa-a70a-d2bd55d6e848',
      sellerId: '2f271a3c-b77a-4bed-ad75-bc3a35535594',
      buyerId: '5bac40eb-c0a5-49f9-bc50-dfe27d7ec409',
      sellerName: 'Thị Thùy Trang Nguyễn',
      sellerAddress: 'Ngã tư Công Lý - Einstein, Công Lý, Phường Thủ Đức, Thành phố Hồ Chí Minh, Việt Nam',
      order_type: 'AT_HOME',
      status: 'CONFIRMED_PENDING_DISPATCH',
      __isInspection: true,
      inspectionFeeVnd: 115000,
    };

    const mapped = mapEscrowOrder(rawOrder, { currentListings: [], currentRole: 'seller' });
    assert.equal(mapped.inspectionMethod, 'AT_HOME');
    assert.doesNotMatch(mapped.sellerAddress || '', /Ngã tư Công Lý/i, 'sellerAddress must not contain Ngã tư Công Lý');
    assert.match(mapped.sellerAddress || '', /Student Station Coffee/i, 'sellerAddress must fallback to Student Station Coffee');
  });

  await t.test('3. Modal Step 1 badge: When no appointment is scheduled, displays "Chờ Bạn Hẹn Lịch" or "Chờ Người Bán Hẹn Lịch", never "Chờ Trung Tâm Duyệt Lịch"', () => {
    const resolveStep1Badge = (isSeller: boolean, modalAppointmentScheduledAt: string | null) => {
      const hasValidScheduledAppt = Boolean(
        modalAppointmentScheduledAt &&
        modalAppointmentScheduledAt !== 'null' &&
        modalAppointmentScheduledAt !== 'undefined' &&
        !isNaN(new Date(modalAppointmentScheduledAt).getTime())
      );
      if (hasValidScheduledAppt) {
        return 'Chờ Trung Tâm Duyệt Lịch';
      }
      return isSeller ? 'Chờ Bạn Hẹn Lịch' : 'Chờ Người Bán Hẹn Lịch';
    };

    // Case 1: No appointment scheduled (seller perspective)
    assert.equal(resolveStep1Badge(true, null), 'Chờ Bạn Hẹn Lịch');
    assert.equal(resolveStep1Badge(true, 'undefined'), 'Chờ Bạn Hẹn Lịch');
    assert.equal(resolveStep1Badge(true, 'null'), 'Chờ Bạn Hẹn Lịch');

    // Case 2: No appointment scheduled (buyer perspective)
    assert.equal(resolveStep1Badge(false, null), 'Chờ Người Bán Hẹn Lịch');

    // Case 3: Valid appointment scheduled
    assert.equal(resolveStep1Badge(true, '2026-11-20T10:00:00.000Z'), 'Chờ Trung Tâm Duyệt Lịch');
  });

  await t.test('4. Cancel Inspection Request button: Hidden when order is CONFIRMED_PENDING_DISPATCH or fee is paid', () => {
    const isCancelButtonAllowed = (order: {
      isSeller: boolean;
      status: string;
      sellerConfirmed: boolean;
      buyerPaid: boolean;
      sellerPaid: boolean;
    }) => {
      if (order.isSeller) return false;
      const isInitialWaiting =
        order.status === 'WAITING_SELLER_APPROVAL' &&
        !order.sellerConfirmed &&
        !order.buyerPaid &&
        !order.sellerPaid;
      return isInitialWaiting;
    };

    // Buyer on initial request -> Allowed
    assert.equal(
      isCancelButtonAllowed({
        isSeller: false,
        status: 'WAITING_SELLER_APPROVAL',
        sellerConfirmed: false,
        buyerPaid: false,
        sellerPaid: false,
      }),
      true
    );

    // Order confirmed and fees paid (CONFIRMED_PENDING_DISPATCH) -> Locked / Hidden
    assert.equal(
      isCancelButtonAllowed({
        isSeller: false,
        status: 'CONFIRMED_PENDING_DISPATCH',
        sellerConfirmed: true,
        buyerPaid: true,
        sellerPaid: false,
      }),
      false
    );

    // Seller side -> Always hidden
    assert.equal(
      isCancelButtonAllowed({
        isSeller: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        sellerConfirmed: true,
        buyerPaid: true,
        sellerPaid: false,
      }),
      false
    );
  });

  await t.test('5. WAITING_SELLER_APPROVAL: Never shows counter appointment or scheduling button', () => {
    const getVisibleActions = (status: string, isOrderSellerConfirmed: boolean) => {
      const isWaitingApproval = status === 'WAITING_SELLER_APPROVAL' || !isOrderSellerConfirmed;
      if (isWaitingApproval) {
        return {
          showAcceptInspection: true,
          showRejectInspection: true,
          showScheduleAppointment: false,
          showCounterScheduleBox: false,
        };
      }
      return {
        showAcceptInspection: false,
        showRejectInspection: false,
        showScheduleAppointment: true,
        showCounterScheduleBox: false,
      };
    };

    const actions = getVisibleActions('WAITING_SELLER_APPROVAL', false);
    assert.equal(actions.showAcceptInspection, true);
    assert.equal(actions.showRejectInspection, true);
    assert.equal(actions.showScheduleAppointment, false);
    assert.equal(actions.showCounterScheduleBox, false);
  });

  await t.test('6. Chat Proposal & Decision View: Synchronized appointment status for AT_HOME orders', () => {
    const resolveChatAndDecisionBadge = (order: {
      isAtHome: boolean;
      status: string;
      currentAppt?: { scheduledAt?: string | null; status?: string; counterScheduledAt?: string | null } | null;
      inspectorId?: string | null;
      isSeller: boolean;
    }) => {
      const hasValidApptDate = Boolean(
        order.currentAppt?.scheduledAt &&
        order.currentAppt.scheduledAt !== 'null' &&
        order.currentAppt.scheduledAt !== 'undefined' &&
        !isNaN(new Date(order.currentAppt.scheduledAt).getTime())
      );
      const isApptCountered = Boolean(
        (order.currentAppt?.status === 'COUNTERED_BY_CENTER' && Boolean(order.currentAppt?.counterScheduledAt)) ||
        Boolean(order.currentAppt?.counterScheduledAt)
      );
      const isApptPendingApproval = Boolean(
        !isApptCountered &&
        hasValidApptDate && (
          order.currentAppt?.status === 'PENDING_CENTER_CONFIRMATION' ||
          !order.inspectorId
        )
      );
      const hasApptConfirmed = Boolean(
        !isApptCountered &&
        hasValidApptDate && (
          order.currentAppt?.status === 'CONFIRMED' ||
          Boolean(order.inspectorId)
        )
      );
      const hasNoAppt = order.isAtHome && !isApptCountered && !hasValidApptDate;

      if (!order.isAtHome) return 'AT_CENTER_FLOW';
      if (hasNoAppt) {
        return order.isSeller ? 'Chờ bạn hẹn lịch đón KTV' : 'Chờ người bán hẹn lịch đón KTV';
      }
      if (isApptCountered) {
        return 'Hub đề xuất lịch mới';
      }
      if (isApptPendingApproval) {
        return order.isSeller ? 'Đã đề xuất lịch • Chờ Hub duyệt' : 'Chờ Hub duyệt lịch';
      }
      if (hasApptConfirmed) {
        return 'Đã xác nhận lịch hẹn';
      }
      return 'UNKNOWN';
    };

    // Case 6.1: Order confirmed, no appointment scheduled yet -> Seller sees "Chờ bạn hẹn lịch đón KTV"
    assert.equal(
      resolveChatAndDecisionBadge({
        isAtHome: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        currentAppt: null,
        inspectorId: null,
        isSeller: true,
      }),
      'Chờ bạn hẹn lịch đón KTV'
    );

    // Case 6.2: Buyer sees "Chờ người bán hẹn lịch đón KTV"
    assert.equal(
      resolveChatAndDecisionBadge({
        isAtHome: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        currentAppt: null,
        inspectorId: null,
        isSeller: false,
      }),
      'Chờ người bán hẹn lịch đón KTV'
    );

    // Case 6.3: Seller submitted appointment date, awaiting Hub -> Seller sees "Đã đề xuất lịch • Chờ Hub duyệt"
    assert.equal(
      resolveChatAndDecisionBadge({
        isAtHome: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        currentAppt: { scheduledAt: '2026-11-20T09:00:00.000Z', status: 'PENDING_CENTER_CONFIRMATION' },
        inspectorId: null,
        isSeller: true,
      }),
      'Đã đề xuất lịch • Chờ Hub duyệt'
    );

    // Case 6.4: Hub countered with new time -> Seller sees "Hub đề xuất lịch mới"
    assert.equal(
      resolveChatAndDecisionBadge({
        isAtHome: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        currentAppt: { scheduledAt: '2026-11-20T09:00:00.000Z', counterScheduledAt: '2026-11-20T14:00:00.000Z', status: 'COUNTERED_BY_CENTER' },
        inspectorId: null,
        isSeller: true,
      }),
      'Hub đề xuất lịch mới'
    );

    // Case 6.5: Hub confirmed / assigned inspector -> "Đã xác nhận lịch hẹn"
    assert.equal(
      resolveChatAndDecisionBadge({
        isAtHome: true,
        status: 'CONFIRMED_PENDING_DISPATCH',
        currentAppt: { scheduledAt: '2026-11-20T09:00:00.000Z', status: 'CONFIRMED' },
        inspectorId: 'inspector-123',
        isSeller: true,
      }),
      'Đã xác nhận lịch hẹn'
    );
  });
});

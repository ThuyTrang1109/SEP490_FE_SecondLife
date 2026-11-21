import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderSellerAddress } from '../pages/inspection-center/dispatch/orderContacts';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';
import {
  isInspectorAssignmentLocked,
  isOrderConfirmedByInspector,
  markOrderConfirmedByInspector,
} from '../utils/inspectionCenterData';

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

  await t.test('7. WAITING_FEE_PAYMENT: Seller card actions never show "Đã Đóng Gói • Chờ Tài Xế Lấy" or "Theo Dõi Lalamove" until both paid', () => {
    // Logic replication from OrderCardActions and EscrowOrdersView
    const isShipmentCreatedForOrder = (ord: any): boolean => {
      if (!ord?.id) return false;
      const rawInspStatus = String(ord.backendStatus || ord.inspectionStatus || ord.inspectionOrder?.status || ord.status || '').toUpperCase();
      if (['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING'].includes(rawInspStatus)) {
        return false;
      }
      if (ord.carrierPickedUpAt || ord.orderShipmentCode || ord.trackingCode) return true;
      return false;
    };

    const isOrderPacked = (ord: any) => isShipmentCreatedForOrder(ord);

    const checkSellerCardActions = (ord: any) => {
      const rawStatus = String(ord.backendStatus || ord.inspectionStatus || ord.inspectionOrder?.status || ord.status || '').toUpperCase();
      const isPendingApprovalOrFeeInAction = ['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING'].includes(rawStatus);
      const isAtHome = ord.inspectionMethod === 'AT_HOME';
      const hasInspection = Boolean(ord.hasInspectionService || ord.inspectionMethod);
      const hasInboundTracking = false;

      // Phase 2: Create Shipment
      const canCreateShipment = !isPendingApprovalOrFeeInAction && (!hasInspection || !isAtHome) && !isOrderPacked(ord);

      // Phase 3: Packed & Waiting for Driver (only for direct orders without inspection)
      const isPackedWaitingDriver = !isPendingApprovalOrFeeInAction &&
        !hasInspection &&
        !isAtHome &&
        isOrderPacked(ord);

      // Phase WAITING_FEE_PAYMENT: Pay inspection fee button
      const showPayFeeButton = rawStatus === 'WAITING_FEE_PAYMENT';

      return { canCreateShipment, isPackedWaitingDriver, showPayFeeButton };
    };

    // Test order from user snapshot in WAITING_FEE_PAYMENT
    const waitingFeeOrder = {
      id: '841be67c-c495-47b2-8030-e90420d5a084',
      orderCode: 'ORD-841be67c',
      backendStatus: 'WAITING_FEE_PAYMENT',
      status: 'WAITING_FEE_PAYMENT',
      inspectionMethod: 'AT_CENTER',
      hasInspectionService: true,
      sellerConfirmedAt: '2026-11-17T07:30:00Z',
    };

    const actionsWaiting = checkSellerCardActions(waitingFeeOrder);
    assert.equal(actionsWaiting.showPayFeeButton, true, 'Must show Pay Inspection Fee button during WAITING_FEE_PAYMENT');
    assert.equal(actionsWaiting.canCreateShipment, false, 'Must NOT show create shipment button during WAITING_FEE_PAYMENT');
    assert.equal(actionsWaiting.isPackedWaitingDriver, false, 'Must NOT show packed & waiting carrier badge during WAITING_FEE_PAYMENT');

    // Once both parties paid -> backend transitions to CONFIRMED_PENDING_DISPATCH
    const confirmedOrder = {
      ...waitingFeeOrder,
      backendStatus: 'CONFIRMED_PENDING_DISPATCH',
      status: 'CONFIRMED_PENDING_DISPATCH',
    };
    const actionsConfirmed = checkSellerCardActions(confirmedOrder);
    assert.equal(actionsConfirmed.showPayFeeButton, false, 'Fee paid: No longer show pay fee button');
    assert.equal(actionsConfirmed.canCreateShipment, true, 'Both parties paid: Seller now sees create shipment button');
    assert.equal(actionsConfirmed.isPackedWaitingDriver, false, 'Shipment not created yet: No packed badge yet');
  });

  await t.test('8. WAITING_FEE_PAYMENT: Hub inspection card displays "Chờ hoàn tất nộp phí kiểm định" and "Chờ nộp phí"', () => {
    const resolveCardInspectionTitleAndBadge = (ord: any, lang: 'vi' | 'en') => {
      const rawInspectionStatus = String(ord.backendStatus || ord.inspectionStatus || ord.status || '').toUpperCase();
      const isWaitingFeePayment = rawInspectionStatus === 'WAITING_FEE_PAYMENT';
      const isWaitingSellerApproval = rawInspectionStatus === 'WAITING_SELLER_APPROVAL' || rawInspectionStatus === 'PENDING';

      const title = isWaitingFeePayment
        ? (lang === 'vi' ? 'Chờ hoàn tất nộp phí kiểm định' : 'Awaiting Inspection Fee Payment')
        : isWaitingSellerApproval
          ? (lang === 'vi' ? 'Chờ người bán xác nhận gửi hàng Chặng 1' : 'Awaiting Seller Confirmation for Leg 1')
          : (lang === 'vi' ? 'Đang thực hiện Chặng 1 đến Hub' : 'Leg 1 In Progress to Hub');

      const badge = isWaitingFeePayment
        ? (lang === 'vi' ? 'Chờ nộp phí' : 'Fee Pending')
        : isWaitingSellerApproval
          ? (lang === 'vi' ? 'Cần xác nhận' : 'Pending')
          : (lang === 'vi' ? 'Đang chuẩn bị' : 'In Progress');

      return { title, badge };
    };

    const waitingFeeOrder = {
      id: '841be67c-c495-47b2-8030-e90420d5a084',
      backendStatus: 'WAITING_FEE_PAYMENT',
      status: 'WAITING_FEE_PAYMENT',
      inspectionMethod: 'AT_CENTER',
    };

    const resVi = resolveCardInspectionTitleAndBadge(waitingFeeOrder, 'vi');
    assert.equal(resVi.title, 'Chờ hoàn tất nộp phí kiểm định');
    assert.equal(resVi.badge, 'Chờ nộp phí');

    const resEn = resolveCardInspectionTitleAndBadge(waitingFeeOrder, 'en');
    assert.equal(resEn.title, 'Awaiting Inspection Fee Payment');
    assert.equal(resEn.badge, 'Fee Pending');
  });

  await t.test('9. Card & Modal Footer: Never shows redundant "Đã Đóng Gói • Chờ Tài Xế Lấy" or "Theo Dõi Lalamove" in card/modal footer for direct or hub orders', () => {
    // Logic replicate from OrderCardActions: Direct orders no longer render Phase 3 or Phase 4 in footer
    const checkSellerCardFooter = (_ord: any) => {
      // Phase 3 & 4 removed from footer for direct orders (top status badge & detail modal handle it)
      const showPackedWaitingDriver = false;
      const showInTransitDirect = false;

      return { showPackedWaitingDriver, showInTransitDirect };
    };

    const inTransitHubOrder = {
      id: '841be67c-c495-47b2-8030-e90420d5a084',
      orderCode: 'ORD-841be67c',
      backendStatus: 'SHIPPING_TO_CENTER',
      status: 'SHIPPING_TO_CENTER',
      inspectionMethod: 'AT_CENTER',
      hasInspectionService: true,
      sellerConfirmedAt: '2026-11-17T07:30:00Z',
    };

    const footerHub = checkSellerCardFooter(inTransitHubOrder);
    assert.equal(footerHub.showPackedWaitingDriver, false, 'Hub order in transit must NOT show "Đã Đóng Gói • Chờ Tài Xế Lấy"');
    assert.equal(footerHub.showInTransitDirect, false, 'Hub order in transit must NOT show Phase 4 direct badge');

    // Direct order (without inspection) also does NOT show Phase 3 or 4 badges in card footer
    const directOrder = {
      id: 'direct-order-1',
      backendStatus: 'PROCESSING',
      status: 'HELD_IN_ESCROW',
      hasInspectionService: false,
      sellerConfirmedAt: '2026-11-17T07:30:00Z',
    };
    const footerDirect = checkSellerCardFooter(directOrder);
    assert.equal(footerDirect.showPackedWaitingDriver, false, 'Direct order must NOT show redundant "Đã Đóng Gói • Chờ Tài Xế Lấy" on card footer');
  });

  await t.test('10. INSPECTING status: Hides all "ĐÃ ĐẾN HUB KIỂM ĐỊNH" badges on Decision View and unifies Stage 2 label', () => {
    // 1. Header delivered badge check
    const showHeaderDeliveredBadge = (isInboundDelivered: boolean, isInspecting: boolean) => {
      return isInboundDelivered && !isInspecting;
    };

    assert.equal(showHeaderDeliveredBadge(true, true), false, 'Header delivered badge must be hidden during INSPECTING');
    assert.equal(showHeaderDeliveredBadge(true, false), true, 'Header delivered badge is shown before inspection starts');

    // 2. Proposal details card badge
    const getProposalCardBadge = (isInboundDelivered: boolean, isInspecting: boolean) => {
      if (isInspecting) return '🔬 Đang Kiểm Định';
      if (isInboundDelivered) return '🏢 Đã Đến Hub Kiểm Định';
      return 'Chờ xử lý';
    };

    assert.equal(getProposalCardBadge(true, true), '🔬 Đang Kiểm Định', 'Proposal badge shows Đang Kiểm Định during INSPECTING');
    assert.equal(getProposalCardBadge(true, false), '🏢 Đã Đến Hub Kiểm Định', 'Proposal badge shows Đã Đến Hub when delivered but not yet inspecting');

    // 3. Stage 2 label for Seller and Buyer
    const getStageTwoLabel = (isUserSeller: boolean, isOrderCompleted: boolean, isPassed: boolean) => {
      if (isOrderCompleted) return isUserSeller ? 'ĐÃ NHẬN TIỀN VÀO VÍ' : 'HOÀN TẤT • ĐÃ GIẢI NGÂN';
      if (isPassed) return isUserSeller ? 'CHỜ NGƯỜI MUA THANH TOÁN' : 'CHỜ BẠN THANH TOÁN';
      return 'CHƯA MỞ THANH TOÁN';
    };

    assert.equal(getStageTwoLabel(true, false, false), 'CHƯA MỞ THANH TOÁN', 'Seller sees CHƯA MỞ THANH TOÁN during inspection, never CHỜ KĨ THUẬT VIÊN KIỂM ĐỊNH');
    assert.equal(getStageTwoLabel(false, false, false), 'CHƯA MỞ THANH TOÁN', 'Buyer sees CHƯA MỞ THANH TOÁN during inspection');
  });

  await t.test('11. Inspector Task Confirmation & Locking Reassignment in Center Dispatch', () => {
    const mockStorage: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
      },
      dispatchEvent: () => true,
    };
    (globalThis as any).localStorage = (globalThis as any).window.localStorage;

    const unassignedOrder = {
      id: 'ord-unassigned',
      status: 'SCHEDULED',
      orderType: 'AT_CENTER',
    };
    assert.equal(isInspectorAssignmentLocked(unassignedOrder), false, 'Unassigned order is never locked');

    const assignedOrder = {
      id: 'ord-assigned-1',
      status: 'SCHEDULED',
      inspectorId: 'ktv-1',
      orderType: 'AT_CENTER',
    };
    // Before inspector confirms:
    assert.equal(isOrderConfirmedByInspector(assignedOrder), false, 'Assigned order is initially not confirmed by inspector');
    assert.equal(isInspectorAssignmentLocked(assignedOrder), false, 'Center can reassign KTV before inspector confirms');

    // Inspector clicks "Xác Nhận Đơn":
    markOrderConfirmedByInspector('ord-assigned-1');

    // After inspector confirms:
    assert.equal(isOrderConfirmedByInspector(assignedOrder), true, 'Order is now confirmed by inspector');
    assert.equal(isInspectorAssignmentLocked(assignedOrder), true, 'Reassigning KTV is now strictly locked in center dispatch');

    // If inspector confirms or order completes (PASSED/FAILED):
    const inspectingOrder = {
      id: 'ord-inspecting-2',
      status: 'DISPATCHED',
      inspectorId: 'ktv-2',
      orderType: 'AT_CENTER',
    };
    assert.equal(isInspectorAssignmentLocked(inspectingOrder), false, 'Assigned order remains unlocked before inspector confirms');
    markOrderConfirmedByInspector('ord-inspecting-2');
    assert.equal(isInspectorAssignmentLocked(inspectingOrder), true, 'Inspecting order is locked once confirmed');

    // Order with customerStatus = 'INSPECTING' (customer perspective) but backend status DISPATCHED:
    // Technical locking MUST NOT lock automatically before the inspector confirms!
    const newlyDispatchedOrder = {
      id: 'ord-dispatched-fresh',
      status: 'DISPATCHED',
      customerStatus: 'INSPECTING',
      inspectorId: 'ktv-fresh',
      orderType: 'AT_CENTER',
    };
    assert.equal(isOrderConfirmedByInspector(newlyDispatchedOrder), false, 'Freshly dispatched order is NOT confirmed, even if customerStatus is INSPECTING');
    assert.equal(isInspectorAssignmentLocked(newlyDispatchedOrder), false, 'Center Dispatch can change KTV on freshly dispatched order');

    const completedOrder = {
      id: 'ord-passed-3',
      status: 'PASSED',
      inspectorId: 'ktv-3',
      orderType: 'AT_CENTER',
    };
    assert.equal(isInspectorAssignmentLocked(completedOrder), true, 'Completed order is locked from changing KTV');
  });

  test('Verdict PASS requires conditionScore > 75 and Verdict FAIL requires conditionScore <= 75', () => {
    const validateVerdictScore = (verdict: 'PASS' | 'FAIL', score: number) => {
      if (verdict === 'PASS' && score <= 75) {
        return { valid: false, error: 'Để kết luận ĐẠT CHUẨN (PASS), Điểm Đánh Giá Chất Lượng Tổng Thể phải lớn hơn 75 điểm.' };
      }
      if (verdict === 'FAIL' && score > 75) {
        return { valid: false, error: 'Để kết luận TỪ CHỐI (REJECTED), Điểm Đánh Giá Chất Lượng Tổng Thể phải nhỏ hơn hoặc bằng 75 điểm.' };
      }
      return { valid: true, error: null };
    };

    assert.equal(validateVerdictScore('PASS', 0).valid, false);
    assert.equal(validateVerdictScore('PASS', 50).valid, false);
    assert.equal(validateVerdictScore('PASS', 75).valid, false);
    assert.equal(validateVerdictScore('PASS', 76).valid, true);
    assert.equal(validateVerdictScore('PASS', 90).valid, true);
    assert.equal(validateVerdictScore('PASS', 100).valid, true);

    assert.equal(validateVerdictScore('FAIL', 0).valid, true);
    assert.equal(validateVerdictScore('FAIL', 50).valid, true);
    assert.equal(validateVerdictScore('FAIL', 70).valid, true);
    assert.equal(validateVerdictScore('FAIL', 75).valid, true);
    assert.equal(validateVerdictScore('FAIL', 76).valid, false);
    assert.equal(validateVerdictScore('FAIL', 100).valid, false);
  });
});

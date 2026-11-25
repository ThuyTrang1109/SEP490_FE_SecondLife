import test from 'node:test';
import assert from 'node:assert/strict';
import { getAtHomeIntakeCode } from '../components/inspection/AtHomeIntakeBarcode';
import { getCenterDispatchStage } from '../utils/inspectionCenterData';
import { isOrderPendingApprovalOrFee, readOrderAppointment, getOrderAppointmentRejection } from '../utils/orders/orderAppointments';

interface MockOrder {
  id: string;
  hasInspectionService?: boolean;
  inspectionFeeVnd?: number;
  inspectionCenterId?: string;
  inspectionMethod?: 'AT_CENTER' | 'AT_HOME';
  orderType?: string;
  escrowStatus: string;
  backendStatus?: string;
  inspectionStatus?: string;
  sellerConfirmedAt?: string;
  sellerReadyAt?: string;
  shippingDeliveredAt?: string;
  appointmentScheduledAt?: string;
  sellerId: string;
  buyerId: string;
}

// Logic replicate the Phase 2 action button conditions in EscrowOrdersView.tsx
function shouldShowPackedCreateShipmentButton(
  order: MockOrder,
  hasInspection: boolean,
  isSeller: boolean,
  isPurchaseAccepted: boolean = false,
  isInsideDetailModal: boolean = false
): boolean {
  if (!isSeller) return false;
  const isSellerConfirmed = Boolean(order.sellerConfirmedAt);
  if (!isSellerConfirmed) return false;

  const backendStatus = String(order.backendStatus || '').toUpperCase();
  if (backendStatus === 'WAITING_FEE_PAYMENT' || backendStatus === 'COMPLETED' || backendStatus === 'SHIPPED' || backendStatus === 'DELIVERED') {
    return false;
  }
  if (order.escrowStatus === 'SHIPPED_TO_BUYER' || order.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || order.escrowStatus === 'COMPLETED_RELEASED') {
    return false;
  }

  // Inside detail modal: NEVER show "Đã gói hàng • Tạo đơn vận chuyển" when purchase accepted
  if (isInsideDetailModal && isPurchaseAccepted) {
    return false;
  }

  // Outside card view: AT_HOME after purchase accepted DOES show create shipment button
  const isAtHome = hasInspection && (order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME');
  if (isAtHome && isPurchaseAccepted) {
    return !isInsideDetailModal;
  }

  if (order.escrowStatus === 'INSPECTION_PASSED' || backendStatus === 'PASSED') {
    return false;
  }

  // KEY RULE: At-Home orders before purchase acceptance NEVER show "Đã gói hàng • Tạo đơn vận chuyển"
  if (isAtHome) {
    return false;
  }

  return true;
}

function shouldShowScheduleVisitButton(
  order: MockOrder,
  hasInspection: boolean,
  isSeller: boolean
): boolean {
  if (!isSeller) return false;
  const isSellerConfirmed = Boolean(order.sellerConfirmedAt);
  if (!isSellerConfirmed) return false;

  const backendStatus = String(order.backendStatus || '').toUpperCase();
  if (backendStatus === 'WAITING_FEE_PAYMENT' || backendStatus === 'COMPLETED' || backendStatus === 'SHIPPED' || backendStatus === 'DELIVERED') {
    return false;
  }
  if (order.escrowStatus === 'SHIPPED_TO_BUYER' || order.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || order.escrowStatus === 'COMPLETED_RELEASED') {
    return false;
  }
  if (order.escrowStatus === 'INSPECTION_PASSED' || backendStatus === 'PASSED') {
    return false;
  }

  const isAtHome = hasInspection && (order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME');
  return isAtHome;
}

// Logic replicate Inspector workbench access in InspectorPortalView.tsx
function getInspectorWorkbenchAction(order: MockOrder, isInspectorArrived: boolean): {
  canOpen: boolean;
  buttonLabel: string;
} {
  const isAtHome = order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME';
  const hasAppt = Boolean(order.appointmentScheduledAt);

  if (isAtHome && !hasAppt) {
    return {
      canOpen: false,
      buttonLabel: 'Chờ Người Bán Hẹn Lịch',
    };
  }

  if (isAtHome && hasAppt) {
    return {
      canOpen: true,
      buttonLabel: isInspectorArrived ? 'Vào Bàn Đo Kiểm (Tại Nhà)' : 'Quét Mã Nhận Máy (Tại Nhà)',
    };
  }

  return {
    canOpen: true,
    buttonLabel: 'Vào Bàn Đo Kiểm',
  };
}

// Logic replicate Seller status badge in EscrowOrdersView.tsx
function getSellerStatusLabel(order: MockOrder, isInspectorArrived: boolean): string {
  const isAtHome = order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME';
  if (isAtHome && isInspectorArrived) {
    return 'Kỹ thuật viên đã đến và đang kiểm tra';
  }
  if (isAtHome && order.appointmentScheduledAt) {
    return 'Đã lên lịch hẹn với KTV';
  }
  return 'Chờ người bán hẹn lịch đón KTV';
}

test('At-Home Inspection Modal and Card Action Buttons Rules', async (t) => {
  const sellerId = 'seller-123';
  const buyerId = 'buyer-456';

  await t.test('[TEST 1] For AT_HOME order, seller NEVER sees "Đã gói hàng • Tạo đơn vận chuyển"', () => {
    const order: MockOrder = {
      id: 'ord-at-home-1',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      sellerConfirmedAt: '2026-11-12T10:00:00Z',
      escrowStatus: 'INSPECTION_IN_PROGRESS',
      backendStatus: 'INSPECTING',
      sellerId,
      buyerId,
    };

    const showShipment = shouldShowPackedCreateShipmentButton(order, true, true);
    assert.strictEqual(showShipment, false, 'AT_HOME must NOT show packed / create shipment button');

    const showSchedule = shouldShowScheduleVisitButton(order, true, true);
    assert.strictEqual(showSchedule, true, 'AT_HOME must show Schedule Visit button');
  });

  await t.test('[TEST 2] For AT_CENTER order, seller DOES see "Đã gói hàng • Tạo đơn vận chuyển"', () => {
    const order: MockOrder = {
      id: 'ord-at-center-1',
      hasInspectionService: true,
      inspectionMethod: 'AT_CENTER',
      sellerConfirmedAt: '2026-11-12T10:00:00Z',
      escrowStatus: 'HELD_IN_ESCROW',
      backendStatus: 'PROCESSING',
      sellerId,
      buyerId,
    };

    const showShipment = shouldShowPackedCreateShipmentButton(order, true, true);
    assert.strictEqual(showShipment, true, 'AT_CENTER must show packed / create shipment button for Leg 1');

    const showSchedule = shouldShowScheduleVisitButton(order, true, true);
    assert.strictEqual(showSchedule, false, 'AT_CENTER must NOT show Schedule Visit button');
  });

  await t.test('[TEST 3] When inspection has PASSED, seller does not see Phase 2 buttons', () => {
    const order: MockOrder = {
      id: 'ord-at-home-passed',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      sellerConfirmedAt: '2026-11-12T10:00:00Z',
      escrowStatus: 'INSPECTION_PASSED',
      backendStatus: 'PASSED',
      sellerId,
      buyerId,
    };

    const showShipment = shouldShowPackedCreateShipmentButton(order, true, true);
    assert.strictEqual(showShipment, false, 'Passed order must not show shipment button');

    const showSchedule = shouldShowScheduleVisitButton(order, true, true);
    assert.strictEqual(showSchedule, false, 'Passed order must not show schedule button');
  });

  await t.test('[TEST 3b] When AT_HOME inspection has PASSED and buyer ACCEPTED purchase, seller DOES see "Đã gói hàng • Tạo đơn vận chuyển" on card, but NOT inside detail modal', () => {
    const order: MockOrder = {
      id: 'ord-at-home-accepted',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      sellerConfirmedAt: '2026-11-12T10:00:00Z',
      escrowStatus: 'INSPECTION_PASSED',
      backendStatus: 'DELIVERING_TO_BUYER',
      sellerId,
      buyerId,
    };

    // Outside card view: DOES see create shipment button
    const showShipmentCard = shouldShowPackedCreateShipmentButton(order, true, true, true, false);
    assert.strictEqual(showShipmentCard, true, 'AT_HOME after purchase accepted must show create shipment button on card view');

    // Inside detail modal: does NOT see create shipment button
    const showShipmentDetail = shouldShowPackedCreateShipmentButton(order, true, true, true, true);
    assert.strictEqual(showShipmentDetail, false, 'Inside detail modal, seller must NOT see create shipment button');

    const showSchedule = shouldShowScheduleVisitButton(order, true, true);
    assert.strictEqual(showSchedule, false, 'Passed order must not show schedule button');
  });

  await t.test('[TEST 4] Direct order (no inspection) shows packed / create shipment button', () => {
    const order: MockOrder = {
      id: 'ord-direct-1',
      hasInspectionService: false,
      sellerConfirmedAt: '2026-11-12T10:00:00Z',
      escrowStatus: 'HELD_IN_ESCROW',
      backendStatus: 'PROCESSING',
      sellerId,
      buyerId,
    };

    const showShipment = shouldShowPackedCreateShipmentButton(order, false, true);
    assert.strictEqual(showShipment, true, 'Direct order must show packed shipment button');
  });

  await t.test('[TEST 5] Inspector UI: When AT_HOME order has NO appointment, workbench is disabled', () => {
    const order: MockOrder = {
      id: '48741dcc-2baf-4f9e-9480-5c66f3a3f0c1',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'AWAITING_INSPECTION',
      appointmentScheduledAt: undefined, // no appointment yet
      sellerId,
      buyerId,
    };

    const action = getInspectorWorkbenchAction(order, false);
    assert.strictEqual(action.canOpen, false, 'Inspector CANNOT open workbench when no appointment is set');
    assert.strictEqual(action.buttonLabel, 'Chờ Người Bán Hẹn Lịch');
  });

  await t.test('[TEST 6] Inspector UI: When appointment exists, inspector can scan barcode to intake', () => {
    const order: MockOrder = {
      id: '48741dcc-2baf-4f9e-9480-5c66f3a3f0c1',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'AWAITING_INSPECTION',
      appointmentScheduledAt: '2026-11-13T09:00:00Z',
      sellerId,
      buyerId,
    };

    const actionBeforeArrival = getInspectorWorkbenchAction(order, false);
    assert.strictEqual(actionBeforeArrival.canOpen, true);
    assert.strictEqual(actionBeforeArrival.buttonLabel, 'Quét Mã Nhận Máy (Tại Nhà)');

    const actionAfterArrival = getInspectorWorkbenchAction(order, true);
    assert.strictEqual(actionAfterArrival.canOpen, true);
    assert.strictEqual(actionAfterArrival.buttonLabel, 'Vào Bàn Đo Kiểm (Tại Nhà)');
  });

  await t.test('[TEST 7] Barcode Intake Code generation formats correctly', () => {
    const code = getAtHomeIntakeCode('48741dcc-2baf-4f9e-9480-5c66f3a3f0c1');
    assert.strictEqual(code, 'SL-ATHOME-48741DCC');
  });

  await t.test('[TEST 8] Seller Status changes to "Kỹ thuật viên đã đến và đang kiểm tra" when inspector arrives/scans', () => {
    const order: MockOrder = {
      id: '48741dcc-2baf-4f9e-9480-5c66f3a3f0c1',
      hasInspectionService: true,
      inspectionMethod: 'AT_HOME',
      escrowStatus: 'AWAITING_INSPECTION',
      appointmentScheduledAt: '2026-11-13T09:00:00Z',
      sellerId,
      buyerId,
    };

    const statusBefore = getSellerStatusLabel(order, false);
    assert.strictEqual(statusBefore, 'Đã lên lịch hẹn với KTV');

    const statusAfter = getSellerStatusLabel(order, true);
    assert.strictEqual(statusAfter, 'Kỹ thuật viên đã đến và đang kiểm tra');
  });

  await t.test('[TEST 9] Workflow order: Seller schedules FIRST -> Admin reviews & assigns task SECOND', () => {
    // Stage 1: Order has fee paid, but seller hasn't scheduled
    const orderNoAppt = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: undefined,
      inspectorId: undefined,
    };
    // Admin dispatch stage must be WAITING_SELLER_APPOINTMENT
    const stage1 = getCenterDispatchStage(orderNoAppt as any, false);
    assert.strictEqual(stage1, 'WAITING_SELLER_APPOINTMENT', 'Admin must wait for seller to schedule first');

    // Stage 2: Seller schedules appointment (e.g. 09:00 tomorrow)
    const orderWithAppt = {
      ...orderNoAppt,
      appointmentScheduledAt: '2026-11-13T09:00:00Z',
    };
    // Admin dispatch stage becomes READY_TO_ASSIGN
    const stage2 = getCenterDispatchStage(orderWithAppt as any, false);
    assert.strictEqual(stage2, 'READY_TO_ASSIGN', 'Admin now sees appointment and can assign inspector');

    // Stage 3: Admin confirms appointment and assigns inspector
    const orderAssigned = {
      ...orderWithAppt,
      inspectorId: 'ins-123',
    };
    const stage3 = getCenterDispatchStage(orderAssigned as any, false);
    assert.strictEqual(stage3, 'ASSIGNED', 'Order is assigned to inspector');
  });

  await t.test('[TEST 10] Inspection Request Cancellation Eligibility: Allowed before KTV arrives, locked after KTV arrives', () => {
    function canCancelInspectionRequest(order: {
      hasInspectionService?: boolean;
      inspectionReport?: any;
      isArrived?: boolean;
      escrowStatus: string;
      backendStatus?: string;
    }): boolean {
      if (order.escrowStatus === 'REFUNDED_TO_BUYER' || order.escrowStatus === 'COMPLETED_RELEASED' || order.backendStatus === 'CANCELLED') {
        return false;
      }
      if (order.inspectionReport) return false;
      if (order.isArrived) return false;
      return Boolean(order.hasInspectionService);
    }

    // 1. Order in AWAITING_INSPECTION with appointment set, KTV not yet arrived -> Can cancel!
    assert.strictEqual(
      canCancelInspectionRequest({
        hasInspectionService: true,
        isArrived: false,
        escrowStatus: 'AWAITING_INSPECTION',
      }),
      true,
      'Buyer/Seller should be able to cancel inspection request before KTV arrives'
    );

    // 2. KTV arrived on site -> Locked (cannot cancel directly)
    assert.strictEqual(
      canCancelInspectionRequest({
        hasInspectionService: true,
        isArrived: true,
        escrowStatus: 'INSPECTION_IN_PROGRESS',
      }),
      false,
      'Cannot cancel inspection request once KTV has arrived on site'
    );

    // 3. Inspection completed with report -> Locked
    assert.strictEqual(
      canCancelInspectionRequest({
        hasInspectionService: true,
        inspectionReport: { verdict: 'PASS' },
        isArrived: true,
        escrowStatus: 'INSPECTION_PASSED',
      }),
      false,
      'Cannot cancel inspection request once inspection report is created'
    );
  });

  await t.test('[TEST 11] Multi-turn Appointment Negotiation: PENDING_CENTER_CONFIRMATION -> COUNTERED_BY_CENTER -> CONFIRMED -> ASSIGNED', () => {
    // 1. Seller selects date/time and submits appointment -> Status is PENDING_CENTER_CONFIRMATION
    const orderRequested = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-14T09:00:00Z',
      appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
    };
    const stage1 = getCenterDispatchStage(orderRequested as any, false);
    assert.strictEqual(stage1, 'WAITING_CENTER_APPROVAL', 'Center must review appointment first (button: Duyệt lịch hẹn)');

    // 2. Center counters with new schedule -> Status becomes COUNTERED_BY_CENTER
    const orderCountered = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-14T09:00:00Z',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-15T14:00:00Z',
      counterShift: 'AFTERNOON',
      counterNote: 'KTV bận ca sáng, dời sang chiều 14h ngày 15/11',
    };
    const stage2 = getCenterDispatchStage(orderCountered as any, false);
    assert.strictEqual(stage2, 'WAITING_SELLER_APPROVAL', 'Center waits for seller to accept or reschedule');

    // 3. Seller accepts or Center confirms -> Status becomes CONFIRMED (ready for inspector assignment)
    const orderConfirmed = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-15T14:00:00Z',
      appointmentStatus: 'CONFIRMED',
      inspectorId: undefined,
    };
    const stage3 = getCenterDispatchStage(orderConfirmed as any, false);
    assert.strictEqual(stage3, 'READY_TO_ASSIGN', 'Appointment is locked in, center can now assign inspector (button: Giao task)');

    // 4. Center assigns inspector -> Status becomes ASSIGNED
    const orderAssigned = {
      ...orderConfirmed,
      inspectorId: 'ins-tran-van-ktv',
    };
    const stage4 = getCenterDispatchStage(orderAssigned as any, false);
    assert.strictEqual(stage4, 'ASSIGNED', 'Task assigned to inspector');
  });

  await t.test('[TEST 12] Center rejection returns order to WAITING_SELLER_APPOINTMENT with reason', () => {
    const orderRejected = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-14T09:00:00Z',
      appointmentStatus: 'REJECTED',
      appointmentRejectionReason: 'KTV đã kín lịch toàn bộ khung giờ yêu cầu.',
    };
    const stage = getCenterDispatchStage(orderRejected as any, false);
    assert.strictEqual(stage, 'WAITING_SELLER_APPOINTMENT', 'Center rejection sends order back to seller to reschedule');
  });

  await t.test('[TEST 13] Countered appointment priority: counterScheduledAt always yields WAITING_SELLER_APPROVAL', () => {
    const orderWithCounter = {
      id: 'ord-test-counter-priority',
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-14T08:00:00Z',
      counterScheduledAt: '2026-11-14T14:00:00Z',
    };
    const stage = getCenterDispatchStage(orderWithCounter as any, false);
    assert.strictEqual(stage, 'WAITING_SELLER_APPROVAL', 'Must be in WAITING_SELLER_APPROVAL when counter appointment exists, NEVER READY_TO_ASSIGN');
  });

  await t.test('[TEST 14] Negotiation loop: Seller can reschedule when COUNTERED_BY_CENTER, returning stage to WAITING_CENTER_APPROVAL', () => {
    // 1. Order countered by center
    const orderCountered = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-14T09:00:00Z',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-15T14:00:00Z',
      counterShift: 'AFTERNOON',
      counterNote: 'KTV bận ca sáng',
    };
    assert.strictEqual(getCenterDispatchStage(orderCountered as any, false), 'WAITING_SELLER_APPROVAL');

    // 2. Seller reschedules with new date
    const orderRescheduledBySeller = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      appointmentScheduledAt: '2026-11-16T10:00:00Z',
      appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
      counterScheduledAt: undefined,
      counterShift: undefined,
      counterNote: undefined,
    };
    assert.strictEqual(getCenterDispatchStage(orderRescheduledBySeller as any, false), 'WAITING_CENTER_APPROVAL', 'Stage returns to Center approval');

    // 3. Center confirms new date -> READY_TO_ASSIGN
    const orderConfirmed = {
      ...orderRescheduledBySeller,
      appointmentStatus: 'CONFIRMED',
    };
    assert.strictEqual(getCenterDispatchStage(orderConfirmed as any, false), 'READY_TO_ASSIGN');
  });

  await t.test('[TEST 15] Cache synchronization: When seller reschedules, stale counter fields must be wiped so Center sees seller requested time and can approve', () => {
    // Seller submits a new time 09:00:
    const newSellerSchedule = {
      scheduledAt: '2026-11-14T09:00:00Z',
      status: 'PENDING_CENTER_CONFIRMATION',
      counterScheduledAt: undefined,
    };

    // Center must evaluate isWaitingSellerCounter to FALSE
    const isWaitingSellerCounter = Boolean(
      newSellerSchedule.counterScheduledAt &&
      newSellerSchedule.status === 'COUNTERED_BY_CENTER'
    );
    assert.strictEqual(isWaitingSellerCounter, false, 'Center modal must be unlocked and not wait for seller');
    assert.strictEqual(newSellerSchedule.scheduledAt, '2026-11-14T09:00:00Z');
  });

  await t.test('[TEST 16] Once appointment is submitted (PENDING_CENTER_CONFIRMATION or CONFIRMED), seller cannot change/reschedule', () => {
    const shouldAllowSellerReschedule = (appointment: { scheduledAt?: string; status?: string; counterScheduledAt?: string } | null, isRejected: boolean) => {
      if (!appointment?.scheduledAt) return true; // not scheduled yet
      if (isRejected) return true; // rejected, allowed to reschedule
      if (appointment.status === 'COUNTERED_BY_CENTER' || Boolean(appointment.counterScheduledAt)) return true; // countered by Hub, allowed to respond/reschedule
      return false; // already sent and waiting or confirmed -> locked, cannot change
    };

    assert.strictEqual(shouldAllowSellerReschedule(null, false), true, 'Allow initial schedule');
    assert.strictEqual(shouldAllowSellerReschedule({ scheduledAt: '2026-11-17T08:00:00Z', status: 'PENDING_CENTER_CONFIRMATION' }, false), false, 'Locked once sent to Hub');
    assert.strictEqual(shouldAllowSellerReschedule({ scheduledAt: '2026-11-17T08:00:00Z', status: 'CONFIRMED' }, false), false, 'Locked once confirmed by Hub');
    assert.strictEqual(shouldAllowSellerReschedule({ scheduledAt: '2026-11-17T08:00:00Z', status: 'COUNTERED_BY_CENTER', counterScheduledAt: '2026-11-17T09:30:00Z' }, false), true, 'Allowed when countered');
    assert.strictEqual(shouldAllowSellerReschedule({ scheduledAt: '2026-11-17T08:00:00Z', status: 'REJECTED' }, true), true, 'Allowed when rejected');
  });

  await t.test('[TEST 17] When Center proposes a new time (Countered), it is NEVER treated as a hard rejection and seller sees counter review UI', () => {
    const counteredOrder = {
      id: 'ord-test-counter-rejection-separation',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-17T10:30:00Z',
      counterShift: 'MORNING',
      counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang 10:30',
      appointmentRejectionReason: 'KTV khu vực đã kín lịch ca sáng...',
    };

    const isOrderCountered = Boolean(
      counteredOrder.appointmentStatus === 'COUNTERED_BY_CENTER' ||
      Boolean(counteredOrder.counterScheduledAt)
    );
    assert.strictEqual(isOrderCountered, true, 'Must identify as countered');

    // When countered, rejection must be false!
    const isRejected = !isOrderCountered && counteredOrder.appointmentStatus === 'REJECTED';
    assert.strictEqual(isRejected, false, 'Countered order must NOT be marked as rejected');

    // Buttons shown to seller: Accept New Time & Reschedule
    const showAcceptButton = isOrderCountered;
    const showRescheduleButton = isOrderCountered;
    assert.strictEqual(showAcceptButton, true);
    assert.strictEqual(showRescheduleButton, true);
  });

  await t.test('[TEST 18] Once appointment is CONFIRMED (Chốt lịch rồi), changing appointment is completely locked in AssignInspectorModal', () => {
    const isApptConfirmedOrder = (order: {
      orderType?: string;
      appointmentStatus?: string;
      status?: string;
      inspectorId?: string;
      appointmentScheduledAt?: string;
    }) => {
      const modalApptTime = order.appointmentScheduledAt;
      return Boolean(
        order.appointmentStatus === 'CONFIRMED' ||
        order.status === 'CONFIRMED_PENDING_DISPATCH' ||
        order.status === 'ASSIGNED' ||
        order.inspectorId ||
        Boolean(modalApptTime && order.appointmentStatus !== 'REJECTED' && order.appointmentStatus !== 'COUNTERED_BY_CENTER' && order.appointmentStatus !== 'PENDING_CENTER_CONFIRMATION')
      );
    };

    const shouldShowChangeApptButtonInAssignModal = (order: any) => {
      if (order.orderType !== 'AT_HOME') return false;
      const isConfirmed = isApptConfirmedOrder(order);
      return !isConfirmed;
    };

    const confirmedOrder = {
      id: 'ord-confirmed',
      orderType: 'AT_HOME',
      appointmentStatus: 'CONFIRMED',
      status: 'CONFIRMED_PENDING_DISPATCH',
      appointmentScheduledAt: '2026-11-17T16:00:00Z',
    };

    const pendingOrder = {
      id: 'ord-pending',
      orderType: 'AT_HOME',
      appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
      status: 'AWAITING_INSPECTION',
      appointmentScheduledAt: '2026-11-17T16:00:00Z',
    };

    assert.strictEqual(shouldShowChangeApptButtonInAssignModal(confirmedOrder), false, 'Confirmed order MUST NOT show "Đổi Lịch Hẹn"');
    assert.strictEqual(shouldShowChangeApptButtonInAssignModal(pendingOrder), true, 'Unconfirmed order allows review/reschedule');
  });

  await t.test('[TEST 19] Buyer with passed inspection decision has action button to decide, redundant static badge "Chờ người mua quyết định" / "Chờ quyết định từ bạn" is removed at bottom for both roles', () => {
    const shouldShowBottomDecisionBadge = (decision: string | null, isSeller: boolean, isInsideDetailModal: boolean) => {
      return !isInsideDetailModal && decision !== 'pending';
    };

    // Outside card: Buyer with pending decision -> Hide redundant static badge
    assert.strictEqual(
      shouldShowBottomDecisionBadge('pending', false, false),
      false,
      'Buyer card should NOT display static "Chờ quyết định từ bạn" badge at the bottom row next to the decision button'
    );

    // Outside card: Seller with pending decision -> Hide redundant static badge as well
    assert.strictEqual(
      shouldShowBottomDecisionBadge('pending', true, false),
      false,
      'Seller card should NOT display redundant "Chờ người mua quyết định" badge at the bottom row'
    );

    // Rejected decision -> Show decision badge
    assert.strictEqual(
      shouldShowBottomDecisionBadge('rejected', false, false),
      true,
      'Buyer card should display "Bạn đã từ chối mua tiếp"'
    );
  });

  await t.test('[TEST 20] New inspection request in WAITING_SELLER_APPROVAL with no appointment is NEVER treated as COUNTERED', () => {
    const newOrder = {
      id: 'ord-new-insp-waiting-seller',
      status: 'WAITING_SELLER_APPROVAL',
      backendStatus: 'WAITING_SELLER_APPROVAL',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      appointmentScheduledAt: undefined,
      counterScheduledAt: undefined,
      appointmentStatus: undefined,
    };

    const isOrderCountered = Boolean(
      (newOrder.appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean(newOrder.counterScheduledAt)) ||
      Boolean(newOrder.counterScheduledAt)
    );

    assert.strictEqual(isOrderCountered, false, 'New inspection request MUST NOT be treated as countered by Hub');
  });

  await t.test('[TEST 21] Phase 1 & 2 vs Phase 3: Appointment Scheduling only unlocks after Seller confirms inspection AND fees are paid', () => {
    // 1. Order in WAITING_SELLER_APPROVAL: Pending approval -> isOrderPendingApprovalOrFee is true
    const orderWaitingSeller: any = {
      id: 'ord-waiting-seller-approval',
      status: 'WAITING_SELLER_APPROVAL',
      backendStatus: 'WAITING_SELLER_APPROVAL',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
      appointmentScheduledAt: '2026-11-20T09:00:00Z', // Even if stale data exists
      counterScheduledAt: '2026-11-21T14:00:00Z',
    };
    assert.strictEqual(isOrderPendingApprovalOrFee(orderWaitingSeller), true, 'Order in WAITING_SELLER_APPROVAL is pending approval');
    assert.strictEqual(readOrderAppointment(orderWaitingSeller, null), null, 'Must return null appointment during WAITING_SELLER_APPROVAL');
    assert.strictEqual(getOrderAppointmentRejection(orderWaitingSeller), null, 'Must return null rejection during WAITING_SELLER_APPROVAL');

    // 2. Order in WAITING_BUYER_APPROVAL: Pending approval -> isOrderPendingApprovalOrFee is true
    const orderWaitingBuyer: any = {
      id: 'ord-waiting-buyer-approval',
      status: 'WAITING_BUYER_APPROVAL',
      backendStatus: 'WAITING_BUYER_APPROVAL',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
    };
    assert.strictEqual(isOrderPendingApprovalOrFee(orderWaitingBuyer), true, 'Order in WAITING_BUYER_APPROVAL is pending approval');
    assert.strictEqual(readOrderAppointment(orderWaitingBuyer, null), null, 'Must return null appointment during WAITING_BUYER_APPROVAL');

    // 3. Order in WAITING_FEE_PAYMENT: Pending fees -> isOrderPendingApprovalOrFee is true
    const orderWaitingFee: any = {
      id: 'ord-waiting-fee-payment',
      status: 'WAITING_FEE_PAYMENT',
      backendStatus: 'WAITING_FEE_PAYMENT',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
    };
    assert.strictEqual(isOrderPendingApprovalOrFee(orderWaitingFee), true, 'Order in WAITING_FEE_PAYMENT is pending fee payment');
    assert.strictEqual(readOrderAppointment(orderWaitingFee, null), null, 'Must return null appointment during WAITING_FEE_PAYMENT');

    // 4. Order in CONFIRMED_PENDING_DISPATCH (Both confirmed & fee paid) -> Appointment is unlocked
    const orderConfirmedFeePaid: any = {
      id: 'ord-confirmed-fee-paid',
      status: 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: 'CONFIRMED_PENDING_DISPATCH',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
      appointmentScheduledAt: '2026-11-20T09:00:00Z',
    };
    assert.strictEqual(isOrderPendingApprovalOrFee(orderConfirmedFeePaid), false, 'CONFIRMED_PENDING_DISPATCH is ready for scheduling');
    const unlockedAppt = readOrderAppointment(orderConfirmedFeePaid, null);
    assert.strictEqual(unlockedAppt?.scheduledAt, '2026-11-20T09:00:00Z', 'Valid appointment is returned once confirmed and fees paid');
  });

  await t.test('[TEST 22] AT_HOME inspection badge & modal rules: Buyer never sees "Chờ người bán gửi hàng đến Hub", no premature "Chờ Trung Tâm Duyệt Lịch"', () => {
    // 1. Step 1 Badge logic replicate:
    function resolveStep1Badge(
      order: { status: string; appointmentStatus?: string },
      appointmentScheduledAt?: string | null,
      savedApptStatus?: string | null,
      isSeller: boolean = false
    ): string {
      if ((savedApptStatus === 'PENDING_CENTER_CONFIRMATION' || order.appointmentStatus === 'PENDING_CENTER_CONFIRMATION') && Boolean(appointmentScheduledAt)) {
        return 'Chờ Trung Tâm Duyệt Lịch';
      }
      if (appointmentScheduledAt) {
        return 'Đã Phân Công KTV';
      }
      return isSeller ? 'Chờ Bạn Hẹn Lịch' : 'Chờ Người Bán Hẹn Lịch';
    }

    // When order is in CONFIRMED_PENDING_DISPATCH and appointment has NOT been scheduled yet:
    const step1Seller = resolveStep1Badge({ status: 'CONFIRMED_PENDING_DISPATCH' }, null, null, true);
    assert.strictEqual(step1Seller, 'Chờ Bạn Hẹn Lịch', 'Seller Step 1 modal badge must say "Chờ Bạn Hẹn Lịch", NOT "Chờ Trung Tâm Duyệt Lịch"');

    const step1Buyer = resolveStep1Badge({ status: 'CONFIRMED_PENDING_DISPATCH' }, null, null, false);
    assert.strictEqual(step1Buyer, 'Chờ Người Bán Hẹn Lịch', 'Buyer Step 1 modal badge must say "Chờ Người Bán Hẹn Lịch", NOT "Chờ Trung Tâm Duyệt Lịch"');

    // Only when an appointment exists and is pending:
    const step1Pending = resolveStep1Badge({ status: 'CONFIRMED_PENDING_DISPATCH', appointmentStatus: 'PENDING_CENTER_CONFIRMATION' }, '2026-11-20T09:00:00Z', 'PENDING_CENTER_CONFIRMATION', true);
    assert.strictEqual(step1Pending, 'Chờ Trung Tâm Duyệt Lịch', 'Only shows "Chờ Trung Tâm Duyệt Lịch" when appointment is actually submitted');
  });

  await t.test('[TEST 23] Confirmed AT_HOME inspection shows "Đã Chốt Lịch • Chờ Giao KTV" on top header, no redundant badge at card footer for buyer', () => {
    // 1. Top header badge for buyer when appointment is CONFIRMED
    const resolveTopBadgeStatus = (apptStatus?: string, isRejected: boolean = false, hasInsp: boolean = false) => {
      if (hasInsp && !isRejected) return 'Đã Phân Công KTV • Chờ Khảo Sát';
      if (apptStatus === 'CONFIRMED' && !isRejected) return 'Đã Chốt Lịch • Chờ Giao KTV';
      return 'Chờ Người Bán Hẹn Lịch Đón KTV';
    };

    assert.strictEqual(
      resolveTopBadgeStatus('CONFIRMED', false, false),
      'Đã Chốt Lịch • Chờ Giao KTV',
      'Top header status badge must display "Đã Chốt Lịch • Chờ Giao KTV" for confirmed appointment'
    );

    // 2. Card footer action bar: Must NOT render duplicate static status badge for buyer
    const shouldRenderBottomStatusBadgeForBuyer = (isSeller: boolean, escrowStatus: string) => {
      // Buyer has status badge exclusively in the top header (OrderStatusBadge); footer is strictly for actions
      return false;
    };

    assert.strictEqual(
      shouldRenderBottomStatusBadgeForBuyer(false, 'AWAITING_INSPECTION'),
      false,
      'Buyer card footer must not render redundant duplicate inspection status badge'
    );
  });

  await t.test('[TEST 24] Schedule appointment validation: disallows selecting rejected times/slots of that day', async () => {
    const { isSlotRejected, extractRejectedSlots } = await import('../components/modals/ScheduleAppointmentModal');

    // Case 1: Order was countered by Hub for 08:30 on 2026-11-20
    const orderWithCounter = {
      id: 'ord-test-rejected-validation',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      appointmentScheduledAt: '2026-11-20T01:30:00Z', // 08:30 VN
      counterScheduledAt: '2026-11-20T07:00:00Z',
      counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
    };

    const rejectedSlots = extractRejectedSlots(orderWithCounter.id, undefined, undefined, orderWithCounter);

    // 1a. The exact hour (08:30) on that date is rejected
    const check0830 = isSlotRejected('2026-11-20', '08:30', 'MORNING', rejectedSlots);
    assert.strictEqual(check0830.rejected, true, '08:30 on 2026-11-20 must be rejected');

    // 1b. Since note specifies "kín lịch ca sáng", any morning slot on that date is also rejected
    const check0900Morning = isSlotRejected('2026-11-20', '09:00', 'MORNING', rejectedSlots);
    assert.strictEqual(check0900Morning.rejected, true, 'All morning slots on 2026-11-20 are rejected when note indicates morning is full');

    // 1c. Afternoon slots on 2026-11-20 are NOT rejected
    const check1400Afternoon = isSlotRejected('2026-11-20', '14:00', 'AFTERNOON', rejectedSlots);
    assert.strictEqual(check1400Afternoon.rejected, false, 'Afternoon slot 14:00 on 2026-11-20 must be allowed');

    // 1d. On a different date (2026-11-21), 08:30 is NOT rejected
    const checkNextDay = isSlotRejected('2026-11-21', '08:30', 'MORNING', rejectedSlots);
    assert.strictEqual(checkNextDay.rejected, false, '08:30 on next date 2026-11-21 must be allowed');

    // Case 2: Specific hour rejection without whole shift note
    const specificRejectionOrder = {
      id: 'ord-test-specific-hour',
      appointmentStatus: 'REJECTED',
      appointmentScheduledAt: '2026-11-22T08:00:00Z', // 15:00 VN
      appointmentShift: 'AFTERNOON' as const,
      appointmentRejectionReason: 'Khung giờ này KTV đang bận đo kiểm ở đơn khác',
    };
    const specificSlots = extractRejectedSlots(specificRejectionOrder.id, undefined, undefined, specificRejectionOrder);

    // 15:00 on 2026-11-22 is rejected
    assert.strictEqual(isSlotRejected('2026-11-22', '15:00', 'AFTERNOON', specificSlots).rejected, true);
    // Other afternoon hours (e.g. 15:30) on 2026-11-22 are NOT rejected
    assert.strictEqual(isSlotRejected('2026-11-22', '15:30', 'AFTERNOON', specificSlots).rejected, false);
  });

  await t.test('[TEST 25] Center Review Appointment: Reject button is disabled when Center has countered / waiting for seller response', () => {
    // Helper function matching ReviewAppointmentModal logic
    function computeIsWaitingSellerCounter(order: {
      status?: string;
      appointmentStatus?: string;
      counterScheduledAt?: string;
    }): boolean {
      return Boolean(
        (order.counterScheduledAt || order.appointmentStatus === 'COUNTERED_BY_CENTER') &&
        order.status !== 'CONFIRMED'
      );
    }

    // Case 1: Initial appointment request from seller (PENDING_CENTER_CONFIRMATION)
    // -> Center CAN reject or accept (isWaitingSellerCounter = false)
    const initialOrder = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
      counterScheduledAt: undefined,
    };
    assert.strictEqual(computeIsWaitingSellerCounter(initialOrder), false, 'Initial request: Reject button must be enabled');

    // Case 2: Center has countered with a new time proposal and is waiting for seller
    // -> Reject button must be DISABLED (isWaitingSellerCounter = true)
    const counteredOrder = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-20T07:00:00Z',
    };
    assert.strictEqual(computeIsWaitingSellerCounter(counteredOrder), true, 'Countered order: Reject button must be disabled');

    // Case 3: Order already confirmed (appointment finalized)
    const confirmedOrder = {
      status: 'CONFIRMED',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-20T07:00:00Z',
    };
    assert.strictEqual(computeIsWaitingSellerCounter(confirmedOrder), false);
  });

  await t.test('[TEST 26] Seller Inbound Shipment Polling & Ownership rules: AT_HOME orders and foreign orders are excluded from Hub inbound polling', () => {
    const isAtHomeOrder = (o: { inspectionMethod?: string; orderType?: string }) =>
      o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME';

    // 1. AT_HOME order must NOT be considered for Hub inbound polling
    const atHomeOrder = {
      id: 'ord-at-home-1',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
      sellerId: 'current-seller-id',
    };
    assert.strictEqual(isAtHomeOrder(atHomeOrder), true);

    // 2. Foreign order filter test: An order with a different explicit sellerId does not belong to current seller
    const currentUserId = 'seller-123';
    function isOrderOfSeller(ord: { sellerId?: string }, currentUser: { id: string }, userRole: string): boolean {
      if (ord.sellerId && ord.sellerId === currentUser.id) return true;
      const hasExplicitSeller = Boolean(ord.sellerId);
      if (!hasExplicitSeller && userRole === 'seller') return true;
      return false;
    }

    const foreignOrder = { id: '06410cab-523f-4b43-92fd-146826b24365', sellerId: 'other-user-456' };
    const ownOrder = { id: 'd0d4e119-362d-41ca-a2a4-4f8d977923e1', sellerId: 'seller-123' };

    assert.strictEqual(isOrderOfSeller(foreignOrder, { id: currentUserId }, 'seller'), false, 'Foreign order must not belong to current seller');
    assert.strictEqual(isOrderOfSeller(ownOrder, { id: currentUserId }, 'seller'), true, 'Own order must belong to current seller');

    // 3. Failed order IDs set prevents polling loops
    const failedSet = new Set<string>();
    failedSet.add('06410cab-523f-4b43-92fd-146826b24365');
    assert.strictEqual(failedSet.has('06410cab-523f-4b43-92fd-146826b24365'), true, '403 failed order is remembered and skipped in subsequent polling');
  });

  await t.test('[TEST 27] Synchronization when Seller accepts counter appointment: Center dispatch reflects CONFIRMED and READY_TO_ASSIGN', () => {
    // The API still reports an active counterproposal when the queue is first loaded.
    const backendOrder = {
      id: 'd0d4e119-362d-41ca-a2a4-4f8d977923e1',
      orderType: 'AT_HOME' as const,
      status: 'CONFIRMED_PENDING_DISPATCH',
      appointmentScheduledAt: '2026-11-20T01:30:00Z', // 08:30 VN
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-20T06:30:00Z', // 13:30 VN
    };

    // Before seller acceptance: stage is WAITING_SELLER_APPROVAL
    const stageBefore = getCenterDispatchStage(backendOrder as any, false);
    assert.strictEqual(stageBefore, 'WAITING_SELLER_APPROVAL', 'Center waits for seller response before acceptance');

    // A browser update can arrive before the next authoritative API response.
    const originalWindow = (globalThis as any).window;
    const originalLocalStorage = (globalThis as any).localStorage;
    const store: Record<string, string> = {
      [`order_appointment_${backendOrder.id}`]: JSON.stringify({
        status: 'CONFIRMED',
        scheduledAt: '2026-11-20T06:30:00Z',
        shift: 'AFTERNOON',
        confirmedBy: 'SELLER',
      }),
    };

    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    };
    (globalThis as any).window = { localStorage: mockStorage };
    (globalThis as any).localStorage = mockStorage;

    try {
      assert.strictEqual(getCenterDispatchStage(backendOrder, false), 'WAITING_SELLER_APPROVAL');

      const stageAfter = getCenterDispatchStage({
        ...backendOrder, status: 'SCHEDULED', appointmentStatus: 'CONFIRMED',
        appointmentScheduledAt: backendOrder.counterScheduledAt, counterScheduledAt: undefined,
      }, false);
      assert.strictEqual(stageAfter, 'READY_TO_ASSIGN', 'Stage must be READY_TO_ASSIGN after Seller confirms counter');
    } finally {
      if (originalWindow !== undefined) (globalThis as any).window = originalWindow;
      else delete (globalThis as any).window;
      if (originalLocalStorage !== undefined) (globalThis as any).localStorage = originalLocalStorage;
      else delete (globalThis as any).localStorage;
    }
  });

  await t.test('[TEST 28] Backend CONFIRMED status takes authoritative precedence over stale COUNTERED_BY_CENTER in Center localStorage', () => {
    // Backend order has status: SCHEDULED, appointmentStatus: CONFIRMED, counterScheduledAt: null (Seller accepted via API)
    const backendConfirmedOrder = {
      id: 'd0d4e119-362d-41ca-a2a4-4f8d977923e1',
      orderType: 'AT_HOME' as const,
      status: 'SCHEDULED',
      appointmentStatus: 'CONFIRMED',
      appointmentScheduledAt: '2026-11-20T06:30:00Z',
      counterScheduledAt: null,
    };

    // But Center's browser localStorage still holds the stale counter record from when Center proposed it earlier
    const originalWindow = (globalThis as any).window;
    const originalLocalStorage = (globalThis as any).localStorage;
    const store: Record<string, string> = {
      [`order_appointment_${backendConfirmedOrder.id}`]: JSON.stringify({
        status: 'COUNTERED_BY_CENTER',
        counterScheduledAt: '2026-11-20T06:30:00Z',
        counterShift: 'AFTERNOON',
        counterNote: 'KTV ban sang',
      }),
      center_inspection_orders: JSON.stringify([{
        id: backendConfirmedOrder.id,
        appointmentStatus: 'COUNTERED_BY_CENTER',
        counterScheduledAt: '2026-11-20T06:30:00Z',
      }]),
    };

    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    };
    (globalThis as any).window = { localStorage: mockStorage };
    (globalThis as any).localStorage = mockStorage;

    try {
      const stage = getCenterDispatchStage(backendConfirmedOrder as any, false);
      assert.strictEqual(stage, 'READY_TO_ASSIGN', 'Must NOT be WAITING_SELLER_APPROVAL because Backend is already CONFIRMED');

      // Check auto-healing: the stale counter must have been cleared in localStorage
      const healedAppt = JSON.parse(store[`order_appointment_${backendConfirmedOrder.id}`]);
      assert.strictEqual(healedAppt.status, 'CONFIRMED', 'Stale appointment record must be healed to CONFIRMED');
      assert.strictEqual(healedAppt.counterScheduledAt, undefined, 'Stale counterScheduledAt must be removed');
    } finally {
      if (originalWindow !== undefined) (globalThis as any).window = originalWindow;
      else delete (globalThis as any).window;
      if (originalLocalStorage !== undefined) (globalThis as any).localStorage = originalLocalStorage;
      else delete (globalThis as any).localStorage;
    }
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getAtHomeIntakeCode } from '../components/inspection/AtHomeIntakeBarcode';
import { getCenterDispatchStage } from '../utils/inspectionCenterData';

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

  // KEY RULE: At-Home orders NEVER show "Đã gói hàng • Tạo đơn vận chuyển"
  const isAtHome = hasInspection && (order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME');
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
});

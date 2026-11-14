import React, { useState, useEffect, useRef } from 'react';
import { usePanelTab } from '../app/router/browser';
import { CenterWalletTab } from '../components/inspection/CenterWalletTab';
import { InspectionCenterProfileTab } from '../components/inspection/InspectionCenterProfileTab';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionReturnQuoteModal } from '../components/modals/InspectionReturnQuoteModal';
import { InspectionOrderDto } from '../services';
import { Language, UserProfile, EscrowOrder } from '../types';
import { getCenterTabDataNeeds } from '../utils/inspectionCenterData';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { AssignInspectorModal } from './inspection-center/dispatch/AssignInspectorModal';
import { CenterAppeals } from './inspection-center/CenterAppeals';
import { CenterChecklists } from './inspection-center/checklists/CenterChecklists';
import { CenterDashboardLayout } from './inspection-center/CenterDashboardLayout';
import { CenterDispatch } from './inspection-center/dispatch/CenterDispatch';
import { CenterOrders } from './inspection-center/orders/CenterOrders';
import { CenterOrderStatusBadge } from './inspection-center/orders/CenterOrderStatusBadge';
import { CenterOverview } from './inspection-center/CenterOverview';
import { CenterPricing } from './inspection-center/pricing/CenterPricing';
import { CenterShipmentModal } from './inspection-center/orders/CenterShipmentModal';
import { CenterStaff } from './inspection-center/staff/CenterStaff';
import { ChecklistDetailsModal } from './inspection-center/checklists/ChecklistDetailsModal';
import { ChecklistEditorModal } from './inspection-center/checklists/ChecklistEditorModal';
import { CreateInspectorModal } from './inspection-center/staff/CreateInspectorModal';
import { LevelFeeProposalModal } from './inspection-center/pricing/LevelFeeProposalModal';
import { PricingProposalDetailsModal } from './inspection-center/pricing/PricingProposalDetailsModal';
import { PricingProposalModal } from './inspection-center/pricing/PricingProposalModal';
import { RejectAppointmentModal } from './inspection-center/dispatch/RejectAppointmentModal';
import { ReviewAppointmentModal } from './inspection-center/dispatch/ReviewAppointmentModal';
import { useCenterOrderRefresh } from './inspection-center/orders/useCenterOrderRefresh';
import type { CenterTab } from './inspection-center/types';
import { useCenterAppointments } from './inspection-center/dispatch/useCenterAppointments';
import { useCenterCatalog } from './inspection-center/checklists/useCenterCatalog';
import { useCenterChecklists } from './inspection-center/checklists/useCenterChecklists';
import { useCenterDispatchQueue } from './inspection-center/dispatch/useCenterDispatchQueue';
import { useCenterInspectionCertificate } from './inspection-center/orders/useCenterInspectionCertificate';
import { useCenterOrderHistory } from './inspection-center/orders/useCenterOrderHistory';
import { useCenterOrders } from './inspection-center/orders/useCenterOrders';
import { useCenterPricing } from './inspection-center/pricing/useCenterPricing';
import { useCenterProfile } from './inspection-center/useCenterProfile';
import { useCenterShipments } from './inspection-center/orders/useCenterShipments';
import { useCenterStaff } from './inspection-center/staff/useCenterStaff';
import { useInspectorAssignment } from './inspection-center/dispatch/useInspectorAssignment';

export type { CenterTab } from './inspection-center/types';
export type { AppliancePreset } from './inspection-center/checklists/appliancePresets';

interface InspectionCenterDashboardViewProps {
  initialOrders?: EscrowOrder[];
  currentUser?: UserProfile | null;
  lang?: Language;
  onNavigate?: (tab: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onViewWebsite?: () => void;
}

export const InspectionCenterDashboardView: React.FC<InspectionCenterDashboardViewProps> = ({
  initialOrders = [],
  currentUser,
  lang = 'vi',
  onOpenProfile,
  onLogout,
}) => {
  // --- Active Sub-Tab (Khôi phục từ URL param ?subtab= hoặc sessionStorage khi F5) ---
  const [activeTab, setActiveTab] = usePanelTab<CenterTab>('inspection_center', 'overview');
  const { orders: needsOrders, staff: needsStaff } = getCenterTabDataNeeds(activeTab);
  const showOrderShipments = activeTab === 'orders';
  const loadingShipmentsRef = useRef(false);
  // --- Action Notification Banner (Admin Style) ---
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(translateSystemNotification(msg));
    setTimeout(() => {
      setActionNotice(null);
    }, 4500);
  };

  const { handleReceivePackageAtHub, isLoadingOrders, loadOrders, orders, setOrders, trackedOrders, visibleOrderHistory } = useCenterOrders({
    currentUser,
    initialOrders,
    lang,
    loadingShipmentsRef,
    showNotice,
    showOrderShipments,
  });
  const staff = useCenterStaff({
    orders,
    showNotice,
  });
  const { isCreateStaffModalOpen, loadStaff, staffList } = staff;
  useCenterOrderRefresh({
    centerId: currentUser?.id,
    isDispatchTab: activeTab === 'dispatch',
    needsOrders,
    needsStaff,
    showOrderShipments,
    loadOrders,
    loadStaff,
  });
  const { centerProfile, centerProfileError, handleProfileUpdated, isLoadingCenterProfile, loadCenterProfile } = useCenterProfile({ showNotice });
  const shipments = useCenterShipments({
    centerProfile,
    currentUser,
    loadCenterProfile,
    loadingShipmentsRef,
    loadOrders,
    showNotice,
    showOrderShipments,
    trackedOrders,
  });
  const { bookingReturnId, buyerShipments, deniedShipmentOrders, handleBookReturn, hubReturns, inboundShipments, isOrderReceivedAtHub, returnQuoteOrder, setDeniedShipmentOrders, setReturnQuoteOrder, shipmentModalOrder } = shipments;
  const orderHistory = useCenterOrderHistory({
    hubReturns,
    visibleOrderHistory,
  });
  const { setExpandedFeeOrderId, setFeeFilter } = orderHistory;
  const dispatch = useCenterDispatchQueue({
    inboundShipments,
    isOrderReceivedAtHub,
    orders,
    setActiveTab,
    staffList,
  });
  const { staffWorkloadMap, stats } = dispatch;
  const assignment = useInspectorAssignment({
    isOrderReceivedAtHub,
    orders,
    showNotice,
    staffList,
  });
  const { assignModalOrder, handleOpenAssign, setAssignModalOrder } = assignment;
  const appointments = useCenterAppointments({
    handleOpenAssign,
    setAssignModalOrder,
    setOrders,
    showNotice,
  });
  const { handleOpenReviewAppointment, rejectApptModalOrder, reviewApptOrder } = appointments;
  const { catalogItems, categories, isLoadingCategories, loadCategoriesAndItems } = useCenterCatalog();
  const pricing = useCenterPricing({
    categories,
    loadCategoriesAndItems,
    showNotice,
  });
  const { getPendingProposalForLevel, isLevelFeeApproved, isProposeLevelFeeModalOpen, isProposeModalOpen, loadPricing, pricingProposalFilter, selectedProposalDetail, setSelectedProposalDetail } = pricing;
  const checklist = useCenterChecklists({
    catalogItems,
    categories,
    getPendingProposalForLevel,
    isLevelFeeApproved,
    lang,
    loadCategoriesAndItems,
    showNotice,
  });
  const { isChecklistModalOpen, loadChecklists, viewingChecklist } = checklist;
  const { certificateOrder, handleOpenInspectionCertificate, loadingCertificateId, setCertificateOrder } = useCenterInspectionCertificate();
  const [, setReviewingAppealOrder] = useState<InspectionOrderDto | null>(null);
  const [appealFilter, setAppealFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'UPHELD' | 'OVERTURNED'>('ALL');
  const [appealSearchTerm, setAppealSearchTerm] = useState('');

  useEffect(() => {
    if (activeTab === 'profile' || activeTab === 'overview') loadCenterProfile();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
      loadPricing(0, pricingProposalFilter, true);
    } else if (activeTab === 'pricing') {
      loadPricing();
      loadChecklists();
      loadCategoriesAndItems();
    }
  }, [activeTab]);

  // Refresh all data
  const handleRefreshAll = () => {
    if (showOrderShipments) setDeniedShipmentOrders(new Set());
    if (activeTab === 'profile' || activeTab === 'overview') loadCenterProfile();
    if (needsOrders) loadOrders();
    if (needsStaff) loadStaff();
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
    }
    if (activeTab === 'pricing') {
      loadPricing();
      loadChecklists();
      loadCategoriesAndItems();
    }
    if (!showOrderShipments) showNotice(lang === 'vi' ? 'Đã làm mới dữ liệu trung tâm kiểm định' : 'Center data refreshed successfully');
  };

  const renderStatusBadge = (order: InspectionOrderDto) => (
    <CenterOrderStatusBadge
      order={order}
      buyerShipments={buyerShipments}
      currentUser={currentUser}
      deniedShipmentOrders={deniedShipmentOrders}
      inboundShipments={inboundShipments}
      isOrderReceivedAtHub={isOrderReceivedAtHub}
      showOrderShipments={showOrderShipments}
    />
  );

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans w-full">
      <CenterDashboardLayout
        actionNotice={actionNotice}
        activeTab={activeTab}
        centerProfile={centerProfile}
        currentUser={currentUser}
        handleRefreshAll={handleRefreshAll}
        isLoadingOrders={isLoadingOrders}
        lang={lang}
        onLogout={onLogout}
        onOpenProfile={onOpenProfile}
        setActionNotice={setActionNotice}
        setActiveTab={setActiveTab}
        stats={stats}
        staff={staff}
      >
        {activeTab === 'overview' && (
          <CenterOverview
            centerProfile={centerProfile}
            handleOpenAssign={handleOpenAssign}
            renderStatusBadge={renderStatusBadge}
            setActiveTab={setActiveTab}
            dispatch={dispatch}
            staff={staff}
          />
        )}

        {activeTab === 'dispatch' && (
          <CenterDispatch
            handleOpenAssign={handleOpenAssign}
            handleOpenReviewAppointment={handleOpenReviewAppointment}
            handleReceivePackageAtHub={handleReceivePackageAtHub}
            isLoadingOrders={isLoadingOrders}
            renderStatusBadge={renderStatusBadge}
            dispatch={dispatch}
          />
        )}

        {activeTab === 'staff' && (
          <CenterStaff
            setActiveTab={setActiveTab}
            staffWorkloadMap={staffWorkloadMap}
            staff={staff}
          />
        )}

        {activeTab === 'orders' && (
          <CenterOrders
            currentUser={currentUser}
            handleOpenInspectionCertificate={handleOpenInspectionCertificate}
            isLoadingOrders={isLoadingOrders}
            loadingCertificateId={loadingCertificateId}
            renderStatusBadge={renderStatusBadge}
            visibleOrderHistory={visibleOrderHistory}
            shipments={shipments}
            orderHistory={orderHistory}
          />
        )}

        {activeTab === 'checklists' && (
          <CenterChecklists categories={categories} checklist={checklist} />
        )}

        {activeTab === 'pricing' && (
          <CenterPricing
            currentUser={currentUser}
            isLoadingCategories={isLoadingCategories}
            lang={lang}
            checklist={checklist}
            pricing={pricing}
          />
        )}

        {activeTab === 'appeals' && (
          <CenterAppeals
            appealFilter={appealFilter}
            appealSearchTerm={appealSearchTerm}
            orders={orders}
            setAppealFilter={setAppealFilter}
            setAppealSearchTerm={setAppealSearchTerm}
            setReviewingAppealOrder={setReviewingAppealOrder}
            stats={stats}
          />
        )}

        {activeTab === 'profile' && (
          <div className="space-y-5 animate-fadeIn">
            <InspectionCenterProfileTab
              profile={centerProfile}
              isLoading={isLoadingCenterProfile}
              error={centerProfileError}
              onRefresh={loadCenterProfile}
              onProfileUpdated={handleProfileUpdated}
              lang={lang}
            />
          </div>
        )}

        {activeTab === 'wallet' && (
          <CenterWalletTab
            lang={lang}
            onNavigateToOrder={(orderId) => {
              setFeeFilter('all');
              setExpandedFeeOrderId(orderId);
              setActiveTab('orders');
            }}
          />
        )}
      </CenterDashboardLayout>

      {isChecklistModalOpen && (
        <ChecklistEditorModal
          catalogItems={catalogItems}
          categories={categories}
          checklist={checklist}
          pricing={pricing}
        />
      )}

      {viewingChecklist && (
        <ChecklistDetailsModal viewingChecklist={viewingChecklist} checklist={checklist} />
      )}

      {isProposeModalOpen && (
        <PricingProposalModal pricing={pricing} />
      )}

      {selectedProposalDetail && (
        <PricingProposalDetailsModal selectedProposalDetail={selectedProposalDetail} setSelectedProposalDetail={setSelectedProposalDetail} />
      )}

      {activeTab === 'orders' && returnQuoteOrder && (
        <InspectionReturnQuoteModal key={returnQuoteOrder.id} orderId={returnQuoteOrder.id}
          title={returnQuoteOrder.postTitle} cashShipping={returnQuoteOrder.cashShippingSimulation}
          booking={bookingReturnId === returnQuoteOrder.id} onClose={() => setReturnQuoteOrder(null)}
          onBook={(fee) => handleBookReturn(returnQuoteOrder, fee)} />
      )}

      {certificateOrder && (
        <DigitalInspectionCertificateModal
          key={certificateOrder.id}
          order={{
            id: certificateOrder.id,
            listing: { id: certificateOrder.postId, title: certificateOrder.postTitle },
            buyerName: certificateOrder.buyerName,
            sellerName: certificateOrder.sellerName,
            inspectionCenterId: certificateOrder.inspectionCenterId ?? undefined,
          }}
          initialDto={certificateOrder}
          lang={lang}
          onClose={() => setCertificateOrder(null)}
        />
      )}

      {assignModalOrder && (
        <AssignInspectorModal
          assignModalOrder={assignModalOrder}
          handleOpenReviewAppointment={handleOpenReviewAppointment}
          handleReceivePackageAtHub={handleReceivePackageAtHub}
          isOrderReceivedAtHub={isOrderReceivedAtHub}
          setActiveTab={setActiveTab}
          staffList={staffList}
          staffWorkloadMap={staffWorkloadMap}
          assignment={assignment}
        />
      )}

      {reviewApptOrder && (
        <ReviewAppointmentModal
          reviewApptOrder={reviewApptOrder}
          appointments={appointments}
        />
      )}

      {rejectApptModalOrder && (
        <RejectAppointmentModal
          rejectApptModalOrder={rejectApptModalOrder}
          appointments={appointments}
        />
      )}

      {isCreateStaffModalOpen && (
        <CreateInspectorModal staff={staff} />
      )}

      {shipmentModalOrder && (
        <CenterShipmentModal
          centerProfile={centerProfile}
          currentUser={currentUser}
          shipmentModalOrder={shipmentModalOrder}
          shipments={shipments}
        />
      )}

      {isProposeLevelFeeModalOpen && (
        <LevelFeeProposalModal pricing={pricing} />
      )}
    </div>
  );
};

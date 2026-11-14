import { useState } from 'react';
import { inspectorService, InspectionOrderDto } from '../../../services';
import { dialogService } from '../../../utils/dialogService';
import { getInspectionTaskStage } from '../../../utils/inspectionTaskStatus';

export function useCenterInspectionCertificate() {
  const [certificateOrder, setCertificateOrder] = useState<InspectionOrderDto | null>(null);
  const [loadingCertificateId, setLoadingCertificateId] = useState<string | null>(null);

  const handleOpenInspectionCertificate = async (orderId: string) => {
    setLoadingCertificateId(orderId);
    try {
      const result = await inspectorService.getOrder(orderId);
      if (getInspectionTaskStage(result.status) !== 'completed') {
        void dialogService.warning('Đơn này chưa có kết quả kiểm định chính thức.');
        return;
      }
      setCertificateOrder(result);
    } catch (error) {
      void dialogService.error(error instanceof Error ? error.message : 'Không thể tải biên bản kiểm định.');
    } finally {
      setLoadingCertificateId(null);
    }
  };

  return {
    certificateOrder,
    handleOpenInspectionCertificate,
    loadingCertificateId,
    setCertificateOrder,
  };
}

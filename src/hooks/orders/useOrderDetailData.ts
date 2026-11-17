import React, { useState, type Dispatch, type SetStateAction } from 'react';
import type { ShipmentBackend } from '../../types';
import { inspectorService, type InspectionOrderDto } from '../../services/inspectorService';
import { shippingService } from '../../services/shippingService';
import { getOrderAllShipments } from '../../utils/orders/shipmentCache';

export function useOrderDetailData(
  detailOrderId: string | undefined,
  detailIsInspection: boolean,
  setApptTick: Dispatch<SetStateAction<number>>,
  linkedOrderId?: string,
) {
  const [detailShipments, setDetailShipments] = useState<ShipmentBackend[]>(() =>
    detailOrderId ? getOrderAllShipments(detailOrderId, linkedOrderId) : []
  );
  const [isLoadingDetailShipments, setIsLoadingDetailShipments] = useState(false);
  const [detailInspectionDto, setDetailInspectionDto] = useState<InspectionOrderDto | null>(null);
  const [expandedDetailLeg1, setExpandedDetailLeg1] = useState(false);
  const [expandedDetailLeg2, setExpandedDetailLeg2] = useState(false);

  React.useEffect(() => {
    if (!detailOrderId) {
      setDetailShipments([]);
      setDetailInspectionDto(null);
      setIsLoadingDetailShipments(false);
      setExpandedDetailLeg1(false);
      setExpandedDetailLeg2(false);
      return;
    }

    const cachedShipments = getOrderAllShipments(detailOrderId, linkedOrderId);
    if (cachedShipments.length > 0) {
      setDetailShipments(cachedShipments);
    } else {
      setDetailShipments([]);
    }
    const existingCachedDto = inspectorService.getCachedOrder(detailOrderId) ||
      (linkedOrderId ? inspectorService.getCachedOrder(linkedOrderId) : null);
    if (existingCachedDto) {
      setDetailInspectionDto(existingCachedDto);
    } else {
      setDetailInspectionDto(null);
    }
    let active = true;
    setIsLoadingDetailShipments(true);

    const ids = [detailOrderId, linkedOrderId].filter(Boolean) as string[];

    if (detailIsInspection) {
      inspectorService.getOrder(detailOrderId)
        .catch(() => linkedOrderId ? inspectorService.getOrder(linkedOrderId) : null)
        .then((dto) => {
          if (active && dto) {
            setDetailInspectionDto(dto);
            if (dto.counterScheduledAt || dto.appointmentScheduledAt) {
              const allIds = [dto.id, dto.linkedOrderId, detailOrderId, linkedOrderId].filter(Boolean) as string[];
              const isCounter = Boolean(dto.counterScheduledAt || dto.appointmentStatus === 'COUNTERED_BY_CENTER');
              const apptRecord = {
                scheduledAt: dto.appointmentScheduledAt,
                note: dto.appointmentNote || '',
                shift: dto.counterShift || 'MORNING',
                status: isCounter ? 'COUNTERED_BY_CENTER' : (dto.appointmentStatus || (dto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
                counterScheduledAt: dto.counterScheduledAt,
                counterShift: dto.counterShift,
                counterNote: dto.counterNote,
              };
              allIds.forEach(id => {
                try {
                  localStorage.setItem(`order_appointment_${id}`, JSON.stringify(apptRecord));
                } catch { }
              });
              setApptTick(t => t + 1);
            }
          }
        })
        .catch(() => {
          if (active) setDetailInspectionDto(null);
        });
    }

    const fetchAllShipments = async (): Promise<ShipmentBackend[]> => {
      for (const id of ids) {
        try {
          const res = detailIsInspection
            ? await shippingService.getInspectionShipments(id).catch(() => shippingService.getOrderShipments(id))
            : await shippingService.getOrderShipments(id).catch(() => shippingService.getInspectionShipments(id));
          if (Array.isArray(res) && res.length > 0) {
            return res;
          }
        } catch { }
      }
      return [];
    };

    fetchAllShipments()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setDetailShipments(list);
          ids.forEach((id) => {
            try {
              localStorage.setItem(`sl_order_shipments_${id}`, JSON.stringify(list));
              localStorage.setItem(`order_shipments_${id}`, JSON.stringify(list));
              if (list.some((s) => s.status !== 'CANCELLED')) {
                localStorage.setItem(`order_shipment_created_${id}`, 'true');
              }
            } catch { }
          });
        }
      })
      .catch(() => {
        // Keep cached shipments if API fails
      })
      .finally(() => {
        if (active) setIsLoadingDetailShipments(false);
      });
    return () => { active = false; };
  }, [detailOrderId, detailIsInspection, linkedOrderId]);
  return {
    detailShipments, setDetailShipments, isLoadingDetailShipments,
    detailInspectionDto, setDetailInspectionDto,
    expandedDetailLeg1, setExpandedDetailLeg1, expandedDetailLeg2, setExpandedDetailLeg2,
  };
}

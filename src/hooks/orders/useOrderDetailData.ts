import React, { useState, type Dispatch, type SetStateAction } from 'react';
import type { ShipmentBackend } from '../../types';
import { inspectorService, type InspectionOrderDto } from '../../services/inspectorService';
import { shippingService } from '../../services/shippingService';
import { getOrderAllShipments } from '../../utils/orders/shipmentCache';

export function useOrderDetailData(
  detailOrderId: string | undefined,
  detailIsInspection: boolean,
  setApptTick: Dispatch<SetStateAction<number>>,
) {
  const [detailShipments, setDetailShipments] = useState<ShipmentBackend[]>(() =>
    detailOrderId ? getOrderAllShipments(detailOrderId) : []
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

    const cachedShipments = getOrderAllShipments(detailOrderId);
    if (cachedShipments.length > 0) {
      setDetailShipments(cachedShipments);
    } else {
      setDetailShipments([]);
    }
    setDetailInspectionDto(null);
    let active = true;
    setIsLoadingDetailShipments(true);

    if (detailIsInspection) {
      inspectorService.getOrder(detailOrderId)
        .then((dto) => {
          if (active && dto) {
            setDetailInspectionDto(dto);
            if (dto.counterScheduledAt || dto.appointmentScheduledAt) {
              const ids = [dto.id, dto.linkedOrderId, detailOrderId].filter(Boolean) as string[];
              const isLocallyRescheduled = ids.some((id) => {
                try {
                  const raw = localStorage.getItem(`order_appointment_${id}`);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
                      return true;
                    }
                  }
                } catch { }
                return false;
              });

              if (!isLocallyRescheduled) {
                const isCounter = Boolean(dto.counterScheduledAt || dto.appointmentStatus === 'COUNTERED_BY_CENTER' || dto.status === 'WAITING_SELLER_APPROVAL');
                const apptRecord = {
                  scheduledAt: dto.appointmentScheduledAt,
                  note: dto.appointmentNote || '',
                  shift: dto.counterShift || 'MORNING',
                  status: isCounter ? 'COUNTERED_BY_CENTER' : (dto.appointmentStatus || (dto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
                  counterScheduledAt: dto.counterScheduledAt,
                  counterShift: dto.counterShift,
                  counterNote: dto.counterNote,
                };
                ids.forEach(id => {
                  try {
                    localStorage.setItem(`order_appointment_${id}`, JSON.stringify(apptRecord));
                  } catch { }
                });
                setApptTick(t => t + 1);
              }
            }
          }
        })
        .catch(() => {
          if (active) setDetailInspectionDto(null);
        });
    }

    const read = detailIsInspection
      ? shippingService.getInspectionShipments(detailOrderId)
      : shippingService.getOrderShipments(detailOrderId);
    read
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setDetailShipments(list);
        if (list.length > 0) {
          try {
            localStorage.setItem(`sl_order_shipments_${detailOrderId}`, JSON.stringify(list));
            localStorage.setItem(`order_shipments_${detailOrderId}`, JSON.stringify(list));
          } catch { }
        }
        if (list.some((s) => s.status !== 'CANCELLED')) {
          try {
            localStorage.setItem(`order_shipment_created_${detailOrderId}`, 'true');
          } catch { }
        }
      })
      .catch(() => {
        // Keep cached shipments if API fails
      })
      .finally(() => {
        if (active) setIsLoadingDetailShipments(false);
      });
    return () => { active = false; };
  }, [detailOrderId, detailIsInspection]);
  return {
    detailShipments, setDetailShipments, isLoadingDetailShipments,
    detailInspectionDto, setDetailInspectionDto,
    expandedDetailLeg1, setExpandedDetailLeg1, expandedDetailLeg2, setExpandedDetailLeg2,
  };
}

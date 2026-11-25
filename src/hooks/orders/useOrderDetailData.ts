import React, { useState, type Dispatch, type SetStateAction } from 'react';
import type { ShipmentBackend } from '../../types';
import { inspectorService, type InspectionOrderDto } from '../../services/inspectorService';
import { postService } from '../../services/postService';
import { shippingService } from '../../services/shippingService';
import { getOrderAllShipments } from '../../utils/orders/shipmentCache';

export function useOrderDetailData(
  detailOrderId: string | undefined,
  detailIsInspection: boolean,
  setApptTick: Dispatch<SetStateAction<number>>,
  linkedOrderId?: string,
  sellerPostId?: string,
) {
  const [detailShipments, setDetailShipments] = useState<ShipmentBackend[]>(() =>
    detailOrderId ? getOrderAllShipments(detailOrderId, linkedOrderId) : []
  );
  const [isLoadingDetailShipments, setIsLoadingDetailShipments] = useState(false);
  const [detailInspectionDto, setDetailInspectionDto] = useState<InspectionOrderDto | null>(null);
  const [expandedDetailLeg1, setExpandedDetailLeg1] = useState(false);
  const [expandedDetailLeg2, setExpandedDetailLeg2] = useState(false);
  const [sellerPostGallery, setSellerPostGallery] = useState<{ postId: string; imageUrls: string[] } | null>(null);

  React.useEffect(() => {
    if (!sellerPostId) {
      setSellerPostGallery(null);
      return;
    }

    let active = true;
    void postService.getMyPostDetail(sellerPostId)
      .then((post) => {
        if (active && Array.isArray(post?.imageUrls)) {
          setSellerPostGallery({ postId: sellerPostId, imageUrls: post.imageUrls });
        }
      })
      .catch(() => {
        // The order's existing images are still available if the listing cannot be loaded.
      });
    return () => { active = false; };
  }, [sellerPostId]);

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
      const map = new Map<string, ShipmentBackend>();
      for (const id of ids) {
        try {
          const res1 = detailIsInspection
            ? await shippingService.getInspectionShipments(id).catch(() => shippingService.getOrderShipments(id))
            : await shippingService.getOrderShipments(id).catch(() => shippingService.getInspectionShipments(id));
          const res2 = detailIsInspection
            ? await shippingService.getOrderShipments(id).catch(() => [])
            : await shippingService.getInspectionShipments(id).catch(() => []);
          [...(Array.isArray(res1) ? res1 : []), ...(Array.isArray(res2) ? res2 : [])].forEach((s) => {
            if (s && s.shipmentId) {
              map.set(s.shipmentId, { ...map.get(s.shipmentId), ...s });
            }
          });
        } catch { }
      }
      return Array.from(map.values());
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
          setApptTick((t) => t + 1);
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

  // Real-time synchronization for appointment lifecycle events
  React.useEffect(() => {
    if (!detailOrderId) return;
    const targetIds = [detailOrderId, linkedOrderId].filter(Boolean) as string[];

    const handleScheduled = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      if (targetIds.includes(d.orderId) || (d.linkedOrderId && targetIds.includes(d.linkedOrderId)) || (d.inspectionOrderId && targetIds.includes(d.inspectionOrderId))) {
        setDetailInspectionDto((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            appointmentScheduledAt: d.scheduledAt,
            appointmentShift: d.shift || 'MORNING',
            appointmentNote: d.note || '',
            appointmentStatus: d.status || 'PENDING_CENTER_CONFIRMATION',
            counterScheduledAt: null,
            counterShift: null,
            counterNote: null,
          };
        });
      }
    };

    const handleRefresh = (e: any) => {
      const d = e?.detail;
      if (d?.orderId && !targetIds.includes(d.orderId) && !targetIds.includes(d.linkedOrderId)) return;
      if (detailIsInspection) {
        inspectorService.getOrder(detailOrderId, { bypassCache: true })
          .catch(() => linkedOrderId ? inspectorService.getOrder(linkedOrderId, { bypassCache: true }) : null)
          .then((dto) => {
            if (dto) setDetailInspectionDto(dto);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('secondlife_appointment_scheduled', handleScheduled);
    window.addEventListener('secondlife_appointment_confirmed', handleRefresh);
    window.addEventListener('secondlife_appointment_countered', handleRefresh);
    window.addEventListener('secondlife_appointment_rejected', handleRefresh);

    return () => {
      window.removeEventListener('secondlife_appointment_scheduled', handleScheduled);
      window.removeEventListener('secondlife_appointment_confirmed', handleRefresh);
      window.removeEventListener('secondlife_appointment_countered', handleRefresh);
      window.removeEventListener('secondlife_appointment_rejected', handleRefresh);
    };
  }, [detailOrderId, linkedOrderId, detailIsInspection]);
  return {
    detailShipments, setDetailShipments, isLoadingDetailShipments,
    detailInspectionDto, setDetailInspectionDto,
    expandedDetailLeg1, setExpandedDetailLeg1, expandedDetailLeg2, setExpandedDetailLeg2,
    sellerPostPhotos: sellerPostGallery && sellerPostGallery.postId === sellerPostId
      ? sellerPostGallery.imageUrls : undefined,
  };
}

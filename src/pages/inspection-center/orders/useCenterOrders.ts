import React, { useState, useMemo, useRef, type RefObject } from 'react';
import { inspectorService, InspectionOrderDto } from '../../../services';
import { Language, UserProfile, EscrowOrder } from '../../../types';
import { shouldTrackCenterInspectionShipments, isHubReturnCase } from '../../../utils/inspectionCenterData';

interface Options {
  currentUser: UserProfile | null | undefined;
  initialOrders: EscrowOrder[];
  lang: Language;
  loadingShipmentsRef: React.RefObject<boolean>;
  showNotice: (msg: string) => void;
  showOrderShipments: boolean;
}

export function useCenterOrders({ currentUser, initialOrders, lang, loadingShipmentsRef, showNotice, showOrderShipments }: Options) {
  const ordersRequestRef = useRef(0);
  const loadingOrdersRef = useRef(false);

  // Convert initial escrow orders into InspectionOrderDto fallback
  const fallbackOrders: InspectionOrderDto[] = useMemo(() => {
    return (initialOrders || [])
      .filter((o: any) =>
        o.hasInspectionService ||
        o.inspectionMethod ||
        (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) ||
        o.requiresInspection ||
        o.deliveryOption === 'INSPECTION' ||
        o.isInspectionGuaranteed ||
        o.escrowStatus === 'AWAITING_INSPECTION' ||
        o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
        o.escrowStatus === 'INSPECTION_PASSED' ||
        o.escrowStatus === 'AWAITING_PAYMENT' ||
        o.status === 'CONFIRMED_PENDING_DISPATCH' ||
        o.status === 'WAITING_SELLER_APPROVAL' ||
        o.status === 'WAITING_FEE_PAYMENT' ||
        o.status === 'WAITING_BUYER_APPROVAL' ||
        o.status === 'WAITING_INSPECTION' ||
        o.status === 'DISPATCHED' ||
        o.status === 'INSPECTING' ||
        o.status === 'PASSED' ||
        o.status === 'FAILED' ||
        o.status === 'COMPLETED' ||
        o.backendStatus === 'CONFIRMED_PENDING_DISPATCH' ||
        (o.id && (String(o.id).startsWith('ORD-') || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(o.id))))
      )
      .map((o: any) => {
        let assignedInspectorId = o.inspectorId;
        let assignedInspectorName = o.inspectorName;
        try {
          const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
          if (rawAssign) {
            const assignData = JSON.parse(rawAssign);
            assignedInspectorId = assignData.inspectorId || assignedInspectorId;
            assignedInspectorName = assignData.inspectorName || assignedInspectorName;
          }
        } catch { }

        let appointmentScheduledAt = o.appointmentScheduledAt;
        let appointmentNote = o.appointmentNote;
        let appointmentStatus = (o as any).appointmentStatus;
        let counterScheduledAt = (o as any).counterScheduledAt;
        let counterShift = (o as any).counterShift;
        let counterNote = (o as any).counterNote;
        let appointmentRejectionReason = (o as any).appointmentRejectionReason;

        const apptPossibleIds = [o.id, (o as any).linkedOrderId, (o as any).orderId, (o as any).inspectionOrderId].filter(Boolean) as string[];
        for (const pid of apptPossibleIds) {
          try {
            const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
            if (rawAppt) {
              const apptData = JSON.parse(rawAppt);
              appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
              appointmentNote = apptData.note || appointmentNote;
              appointmentStatus = apptData.status || appointmentStatus;
              counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
              counterShift = apptData.counterShift || counterShift;
              counterNote = apptData.counterNote || counterNote;
              break;
            }
          } catch { }
        }

        for (const pid of apptPossibleIds) {
          try {
            const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
            if (rawRej) {
              const rejData = JSON.parse(rawRej);
              if (rejData.reason) {
                appointmentRejectionReason = rejData.reason;
                break;
              }
            }
          } catch { }
        }

        if (counterScheduledAt) {
          appointmentStatus = 'COUNTERED_BY_CENTER';
        }

        const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');
        if (hasValidAssign && !appointmentStatus) {
          appointmentStatus = 'CONFIRMED';
        } else if (!appointmentStatus && appointmentScheduledAt) {
          appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
        }

        let resolvedStatus = o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH';
        if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || o.backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
          resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
        } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION' || resolvedStatus === 'AWAITING_INSPECTION')) {
          resolvedStatus = 'DISPATCHED';
        }

        return {
          id: o.id,
          postId: o.listing?.id || o.listingId || o.id,
          postTitle: o.listing?.title || o.postTitle || 'Thiết bị gia dụng kiểm định',
          postPrice: o.listing?.priceVnd || o.totalAmountVnd || o.amountVnd || 0,
          postImageUrls: o.listing?.photos
            ? [
              o.listing.photos.front,
              o.listing.photos.back,
              o.listing.photos.screenOrDetails,
            ].filter(Boolean) as string[]
            : ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400'],
          buyerName: o.buyerName || 'Khách hàng',
          buyerEmail: o.buyerId ? `buyer_${String(o.buyerId).slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
          sellerName: o.sellerName || o.seller?.fullName || 'Người bán',
          sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
          sellerPhone: o.sellerPhone || o.seller?.phone,
          sellerAddress: o.sellerAddress || o.listing?.sellerAddress || o.listing?.location || o.shippingLegs?.[0]?.origin || o.address,
          inspectorId: hasValidAssign ? assignedInspectorId : undefined,
          inspectorName: hasValidAssign ? assignedInspectorName : undefined,
          orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
          feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
          status: resolvedStatus,
          appointmentScheduledAt,
          appointmentNote,
          appointmentStatus,
          counterScheduledAt,
          counterShift,
          counterNote,
          appointmentRejectionReason,
          inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
          createdAt: o.createdAt || new Date().toISOString(),
        };
      });
  }, [initialOrders]);

  // --- Orders State ---
  const [orders, setOrders] = useState<InspectionOrderDto[]>(fallbackOrders);
  const [centerOrderHistory, setCenterOrderHistory] = useState<{
    centerId: string;
    items: InspectionOrderDto[];
    total: number;
    refreshFailed?: boolean;
  } | null>(null);
  const [trackedOrders, setTrackedOrders] = useState<InspectionOrderDto[]>([]);

  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const visibleOrderHistory = centerOrderHistory?.centerId === currentUser?.id ? centerOrderHistory : null;

  // Handler: Xác nhận đã tiếp nhận kiện hàng thực tế tại Hub
  const handleReceivePackageAtHub = (orderId: string, orderTitle?: string) => {
    try {
      localStorage.setItem(`hub_package_received_${orderId}`, 'true');
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: o.inspectorId ? 'DISPATCHED' : 'CONFIRMED_PENDING_DISPATCH',
              backendStatus: 'CONFIRMED_PENDING_DISPATCH',
            };
          }
          return o;
        })
      );
      window.dispatchEvent(new CustomEvent('secondlife_hub_package_received', { detail: { orderId } }));
      showNotice(
        lang === 'vi'
          ? `Đã xác nhận tiếp nhận kiện hàng "${orderTitle || orderId.slice(0, 8)}" tại Hub thành công! Đơn hiện đã sẵn sàng giao task cho KTV.`
          : `Package received at Hub successfully! Ready to dispatch to technician.`
      );
    } catch (e) {
      console.warn('Lỗi khi tiếp nhận hàng tại Hub:', e);
    }
  };

  // --- API Fetch: Orders ---
  const loadOrders = async (background = false) => {
    const centerId = currentUser?.id;
    if (showOrderShipments && !centerId) return;
    if (background && (loadingOrdersRef.current || loadingShipmentsRef.current)) return;
    const requestId = ++ordersRequestRef.current;
    loadingOrdersRef.current = true;
    if (!background) setIsLoadingOrders(true);
    try {
      if (showOrderShipments && centerId) {
        const result = await inspectorService.getCenterOrderHistory(background ? { isBackground: true } : undefined);
        if (requestId !== ordersRequestRef.current) return;
        if (!Array.isArray(result?.items)) throw new Error('Invalid center orders response');
        setCenterOrderHistory({ centerId, items: result.items, total: result.totalElements });
        setOrders(result.items);
        setTrackedOrders(result.items.filter((order) => shouldTrackCenterInspectionShipments(order, centerId, currentUser?.role)));
        return;
      }

      let backendItems: InspectionOrderDto[] = [];
      try {
        const res = await inspectorService.getAllOrders(
          undefined,
          0,
          100,
          background ? { isBackground: true } : undefined,
        );
        const extracted = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
        if (extracted && extracted.length > 0) {
          backendItems = extracted;
        }
      } catch (e) {
        if (background) return;
        console.warn('getAllOrders from backend error (falling back to storage/cache):', e);
      }

      if (requestId !== ordersRequestRef.current) return;

      // Read orders from localStorage (center_inspection_orders + recent_placed_orders)
      let localOrders: InspectionOrderDto[] = [];
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        const rawCenter = localStorage.getItem('center_inspection_orders');
        const listRecent = rawRecent ? JSON.parse(rawRecent) : [];
        const listCenter = rawCenter ? JSON.parse(rawCenter) : [];
        const combinedRaw = [
          ...(Array.isArray(listCenter) ? listCenter : []),
          ...(Array.isArray(listRecent) ? listRecent : [])
        ];

        const seenOrderIds = new Set<string>();
        const dedupedList: any[] = [];
        combinedRaw.forEach((item: any) => {
          if (item?.id && !seenOrderIds.has(item.id)) {
            seenOrderIds.add(item.id);
            dedupedList.push(item);
          }
        });

        localOrders = dedupedList
          .filter((o: any) =>
            o.hasInspectionService ||
            o.inspectionMethod ||
            (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) ||
            o.requiresInspection ||
            o.deliveryOption === 'INSPECTION' ||
            o.isInspectionGuaranteed ||
            o.escrowStatus === 'AWAITING_INSPECTION' ||
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            o.status === 'CONFIRMED_PENDING_DISPATCH' ||
            o.status === 'WAITING_SELLER_APPROVAL' ||
            o.status === 'WAITING_FEE_PAYMENT' ||
            o.status === 'WAITING_BUYER_APPROVAL' ||
            o.status === 'WAITING_INSPECTION' ||
            o.status === 'DISPATCHED' ||
            o.status === 'INSPECTING' ||
            o.backendStatus === 'CONFIRMED_PENDING_DISPATCH'
          )
          .map((o: any) => {
            let assignedInspectorId = o.inspectorId;
            let assignedInspectorName = o.inspectorName;
            try {
              const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
              if (rawAssign) {
                const assignData = JSON.parse(rawAssign);
                assignedInspectorId = assignData.inspectorId || assignedInspectorId;
                assignedInspectorName = assignData.inspectorName || assignedInspectorName;
              }
            } catch { }

            let appointmentScheduledAt = o.appointmentScheduledAt;
            let appointmentNote = o.appointmentNote;
            let appointmentStatus = (o as any).appointmentStatus;
            let counterScheduledAt = (o as any).counterScheduledAt;
            let counterShift = (o as any).counterShift;
            let counterNote = (o as any).counterNote;
            let appointmentRejectionReason = (o as any).appointmentRejectionReason;

            const apptPossibleIds = [o.id, (o as any).linkedOrderId, (o as any).orderId, (o as any).inspectionOrderId].filter(Boolean) as string[];
            for (const pid of apptPossibleIds) {
              try {
                const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
                if (rawAppt) {
                  const apptData = JSON.parse(rawAppt);
                  appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
                  appointmentNote = apptData.note || appointmentNote;
                  appointmentStatus = apptData.status || appointmentStatus;
                  if (apptData.status === 'PENDING_CENTER_CONFIRMATION' && !apptData.counterScheduledAt) {
                    counterScheduledAt = undefined;
                    counterShift = undefined;
                    counterNote = undefined;
                  } else {
                    counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
                    counterShift = apptData.counterShift || counterShift;
                    counterNote = apptData.counterNote || counterNote;
                  }
                  break;
                }
              } catch { }
            }

            for (const pid of apptPossibleIds) {
              try {
                const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
                if (rawRej) {
                  const rejData = JSON.parse(rawRej);
                  if (rejData.reason) {
                    appointmentRejectionReason = rejData.reason;
                    break;
                  }
                }
              } catch { }
            }

            if (appointmentStatus !== 'PENDING_CENTER_CONFIRMATION') {
              const idSet = new Set(apptPossibleIds);
              try {
                const rawCenter = localStorage.getItem('center_inspection_orders');
                if (rawCenter) {
                  const listCenter = JSON.parse(rawCenter);
                  if (Array.isArray(listCenter)) {
                    const m = listCenter.find((co: any) => idSet.has(co.id) || idSet.has(co.linkedOrderId) || idSet.has(co.orderId) || idSet.has(co.inspectionOrderId));
                    if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                      appointmentScheduledAt = m.appointmentScheduledAt || appointmentScheduledAt;
                      appointmentNote = m.appointmentNote || appointmentNote;
                      appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
                      counterScheduledAt = undefined;
                      counterShift = undefined;
                      counterNote = undefined;
                    }
                  }
                }
              } catch {}
              try {
                const rawSeller = localStorage.getItem('my_seller_inspection_orders');
                if (rawSeller && appointmentStatus !== 'PENDING_CENTER_CONFIRMATION') {
                  const listSeller = JSON.parse(rawSeller);
                  if (Array.isArray(listSeller)) {
                    const m = listSeller.find((so: any) => idSet.has(so.id) || idSet.has(so.linkedOrderId) || idSet.has(so.orderId) || idSet.has(so.inspectionOrderId));
                    if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                      appointmentScheduledAt = m.appointmentScheduledAt || appointmentScheduledAt;
                      appointmentNote = m.appointmentNote || appointmentNote;
                      appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
                      counterScheduledAt = undefined;
                      counterShift = undefined;
                      counterNote = undefined;
                    }
                  }
                }
              } catch {}
            }

            if (appointmentStatus === 'PENDING_CENTER_CONFIRMATION') {
              counterScheduledAt = undefined;
              counterShift = undefined;
              counterNote = undefined;
            } else if (counterScheduledAt) {
              appointmentStatus = 'COUNTERED_BY_CENTER';
            }

            const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');
            if (hasValidAssign && !appointmentStatus) {
              appointmentStatus = 'CONFIRMED';
            } else if (!appointmentStatus && appointmentScheduledAt) {
              appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
            }

            const savedStatus = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${o.id}`) : null;
            let resolvedStatus = savedStatus || o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH';
            if (savedStatus === 'PASSED' || o.status === 'PASSED' || o.escrowStatus === 'INSPECTION_PASSED' || (o as any).backendStatus === 'PASSED') {
              resolvedStatus = 'PASSED';
            } else if (savedStatus === 'FAILED' || o.status === 'FAILED' || o.escrowStatus === 'INSPECTION_FAILED') {
              resolvedStatus = 'FAILED';
            } else if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || o.backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
              resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
            } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION' || resolvedStatus === 'AWAITING_INSPECTION')) {
              resolvedStatus = 'DISPATCHED';
            }

            const realImg = (o as any).postImageUrl || (o as any).postImageUrls?.[0];
            const cleanFront = (o.listing?.photos?.front && !o.listing.photos.front.includes('photo-1584269600464') && !o.listing.photos.front.includes('photo-1555041469')) ? o.listing.photos.front : '';
            const fallbackFront = realImg || cleanFront || o.listing?.photos?.front || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400';
            const resolvedImageUrls = (o.postImageUrls && o.postImageUrls.length > 0)
              ? o.postImageUrls
              : (realImg ? [realImg] : (
                o.listing?.photos
                  ? [fallbackFront, o.listing.photos.back, o.listing.photos.screenOrDetails].filter(Boolean) as string[]
                  : (o.listing?.photoGallery || [fallbackFront])
              ));

            return {
              id: o.id,
              postId: o.listing?.id || o.listingId || o.id,
              postTitle: o.listing?.title || o.postTitle || 'Thiết bị gia dụng kiểm định',
              postPrice: o.listing?.priceVnd || o.totalPaidVnd || o.itemPriceVnd || o.amountVnd || 0,
              postImageUrls: resolvedImageUrls,
              buyerName: o.buyerName || 'Khách hàng',
              buyerEmail: o.buyerId ? `buyer_${String(o.buyerId).slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
              sellerName: o.sellerName || o.seller?.fullName || 'Người bán',
              sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
              sellerPhone: o.sellerPhone || o.seller?.phone,
              sellerAddress: o.sellerAddress || o.listing?.sellerAddress || o.listing?.location || o.shippingLegs?.[0]?.origin || o.address,
              inspectorId: hasValidAssign ? assignedInspectorId : undefined,
              inspectorName: hasValidAssign ? assignedInspectorName : undefined,
              orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
              feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
              status: resolvedStatus,
              appointmentScheduledAt,
              appointmentNote,
              appointmentStatus,
              counterScheduledAt,
              counterShift,
              counterNote,
              appointmentRejectionReason,
              inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
              createdAt: o.createdAt || new Date().toISOString(),
            };
          });
      } catch { }

      // Combine backendItems + localOrders + fallbackOrders
      const combinedMap = new Map<string, InspectionOrderDto>();
      [...fallbackOrders, ...localOrders, ...backendItems].forEach((ord) => {
        if (ord?.id) {
          let assignedInspectorId = ord.inspectorId;
          let assignedInspectorName = ord.inspectorName;
          if (!assignedInspectorId) {
            try {
              const rawAssign = localStorage.getItem(`order_assigned_inspector_${ord.id}`);
              if (rawAssign) {
                const assignData = JSON.parse(rawAssign);
                assignedInspectorId = assignData.inspectorId || assignedInspectorId;
                assignedInspectorName = assignData.inspectorName || assignedInspectorName;
              }
            } catch { }
          }

          const hasValidAssign = Boolean(assignedInspectorId);

          const savedInspectionStatus = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${ord.id}`) : null;
          let resolvedStatus = savedInspectionStatus || ord.status;
          if ((ord.finalPaymentPaidAt && ord.linkedOrderId) || isHubReturnCase(ord)) {
            resolvedStatus = ord.status;
          } else if (savedInspectionStatus === 'PASSED' || ord.status === 'PASSED' || (ord as any).backendStatus === 'PASSED' || (ord as any).escrowStatus === 'INSPECTION_PASSED') {
            resolvedStatus = 'PASSED';
          } else if (savedInspectionStatus === 'FAILED' || ord.status === 'FAILED' || (ord as any).backendStatus === 'FAILED' || (ord as any).escrowStatus === 'INSPECTION_FAILED') {
            resolvedStatus = 'FAILED';
          } else if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || (ord as any).backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
            resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
          } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION')) {
            resolvedStatus = 'DISPATCHED';
          }

          let appointmentScheduledAt = ord.appointmentScheduledAt;
          let appointmentNote = (ord as any).appointmentNote;
          let appointmentStatus = (ord as any).appointmentStatus;
          let counterScheduledAt = (ord as any).counterScheduledAt;
          let counterShift = (ord as any).counterShift;
          let counterNote = (ord as any).counterNote;
          let appointmentRejectionReason = (ord as any).appointmentRejectionReason;

          const apptPossibleIds = [ord.id, (ord as any).linkedOrderId, (ord as any).orderId, (ord as any).inspectionOrderId].filter(Boolean) as string[];
          for (const pid of apptPossibleIds) {
            try {
              const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
              if (rawAppt) {
                const apptData = JSON.parse(rawAppt);
                appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
                appointmentNote = apptData.note || appointmentNote;
                appointmentStatus = apptData.status || appointmentStatus;
                if (apptData.status === 'PENDING_CENTER_CONFIRMATION' && !apptData.counterScheduledAt) {
                  counterScheduledAt = undefined;
                  counterShift = undefined;
                  counterNote = undefined;
                } else {
                  counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
                  counterShift = apptData.counterShift || counterShift;
                  counterNote = apptData.counterNote || counterNote;
                }
                break;
              }
            } catch { }
          }

          for (const pid of apptPossibleIds) {
            try {
              const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
              if (rawRej) {
                const rejData = JSON.parse(rawRej);
                if (rejData.reason) {
                  appointmentRejectionReason = rejData.reason;
                  break;
                }
              }
            } catch { }
          }

          if (appointmentStatus !== 'PENDING_CENTER_CONFIRMATION') {
            const idSet = new Set(apptPossibleIds);
            try {
              const rawCenter = localStorage.getItem('center_inspection_orders');
              if (rawCenter) {
                const listCenter = JSON.parse(rawCenter);
                if (Array.isArray(listCenter)) {
                  const m = listCenter.find((co: any) => idSet.has(co.id) || idSet.has(co.linkedOrderId) || idSet.has(co.orderId) || idSet.has(co.inspectionOrderId));
                  if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                    appointmentScheduledAt = m.appointmentScheduledAt || appointmentScheduledAt;
                    appointmentNote = m.appointmentNote || appointmentNote;
                    appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
                    counterScheduledAt = undefined;
                    counterShift = undefined;
                    counterNote = undefined;
                  }
                }
              }
            } catch {}
            try {
              const rawSeller = localStorage.getItem('my_seller_inspection_orders');
              if (rawSeller && appointmentStatus !== 'PENDING_CENTER_CONFIRMATION') {
                const listSeller = JSON.parse(rawSeller);
                if (Array.isArray(listSeller)) {
                  const m = listSeller.find((so: any) => idSet.has(so.id) || idSet.has(so.linkedOrderId) || idSet.has(so.orderId) || idSet.has(so.inspectionOrderId));
                  if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                    appointmentScheduledAt = m.appointmentScheduledAt || appointmentScheduledAt;
                    appointmentNote = m.appointmentNote || appointmentNote;
                    appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
                    counterScheduledAt = undefined;
                    counterShift = undefined;
                    counterNote = undefined;
                  }
                }
              }
            } catch {}
          }

          if (appointmentStatus === 'PENDING_CENTER_CONFIRMATION') {
            counterScheduledAt = undefined;
            counterShift = undefined;
            counterNote = undefined;
            if (resolvedStatus === 'WAITING_SELLER_APPROVAL') {
              resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
            }
          } else if (counterScheduledAt) {
            appointmentStatus = 'COUNTERED_BY_CENTER';
          }

          if (hasValidAssign && !appointmentStatus) {
            appointmentStatus = 'CONFIRMED';
          } else if (!appointmentStatus && appointmentScheduledAt) {
            appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
          }

          const existing = combinedMap.get(ord.id);
          const resolvedSellerAddress = ord.sellerAddress || existing?.sellerAddress || (ord as any).listing?.location || (ord as any).listing?.sellerAddress;
          const resolvedSellerPhone = ord.sellerPhone || existing?.sellerPhone;
          const resolvedSellerName = ord.sellerName || existing?.sellerName;

          combinedMap.set(ord.id, {
            ...ord,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            inspectorId: hasValidAssign ? assignedInspectorId : undefined,
            inspectorName: hasValidAssign ? assignedInspectorName : undefined,
            appointmentScheduledAt,
            appointmentNote,
            appointmentStatus,
            counterScheduledAt,
            counterShift,
            counterNote,
            appointmentRejectionReason,
            status: resolvedStatus
          });
        }
      });

      const finalOrders = Array.from(combinedMap.values());
      finalOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(finalOrders);
      // Only fetch shipments for actual orders returned by the center API.
      setTrackedOrders(backendItems.filter((order) => shouldTrackCenterInspectionShipments(order, currentUser?.id, currentUser?.role)));
    } catch (err: any) {
      if (requestId !== ordersRequestRef.current) return;
      if (showOrderShipments && centerId) {
        if (!background) setCenterOrderHistory((previous) => previous?.centerId === centerId
          ? { ...previous, refreshFailed: true }
          : { centerId, items: [], total: 0, refreshFailed: true });
        return;
      }
      console.warn('Lỗi tải danh sách đơn kiểm định từ backend, sử dụng dữ liệu trạm:', err);
      if (!background && fallbackOrders.length > 0) setOrders(fallbackOrders);
    } finally {
      if (requestId === ordersRequestRef.current) {
        loadingOrdersRef.current = false;
        if (!background) setIsLoadingOrders(false);
      }
    }
  };

  return {
    handleReceivePackageAtHub,
    isLoadingOrders,
    loadOrders,
    orders,
    setOrders,
    trackedOrders,
    visibleOrderHistory,
  };
}

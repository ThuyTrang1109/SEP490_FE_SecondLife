import { useState, useEffect, useCallback } from 'react';
import type { EscrowOrder } from '../../types';
import { orderReviewService, OrderReviewDto, CreateOrderReviewRequest, UpdateOrderReviewRequest } from '../../services/orderReviewService';

export function useOrderReviews() {
  const [reviewModalOrder, setReviewModalOrder] = useState<EscrowOrder | null>(null);
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [existingReview, setExistingReview] = useState<OrderReviewDto | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('secondlife_reviewed_order_ids');
      if (saved && saved !== 'undefined' && saved !== 'null' && saved.trim() !== '') {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  // Tải đánh giá đã có từ Backend khi mở modal
  useEffect(() => {
    if (!reviewModalOrder) {
      setExistingReview(null);
      return;
    }

    let isMounted = true;
    setIsLoadingReview(true);

    orderReviewService
      .getOrderReview(reviewModalOrder.id)
      .then((review) => {
        if (!isMounted) return;
        setExistingReview(review);
        if (review) {
          setReviewedOrderIds((prev) => {
            if (prev.includes(reviewModalOrder.id)) return prev;
            const updated = [...prev, reviewModalOrder.id];
            try {
              localStorage.setItem('secondlife_reviewed_order_ids', JSON.stringify(updated));
            } catch { }
            return updated;
          });
        }
      })
      .catch((err) => {
        console.warn('Lỗi kiểm tra đánh giá đơn hàng:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingReview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reviewModalOrder]);

  const handleReviewSubmit = async (reviewData: CreateOrderReviewRequest) => {
    if (!reviewModalOrder) return;

    if (existingReview) {
      // Chỉnh sửa đánh giá hiện có (cho phép 1 lần trong 48h)
      const updated = await orderReviewService.updateReview(reviewModalOrder.id, reviewData);
      setExistingReview(updated);
    } else {
      // Tạo đánh giá mới (trong 48h từ khi nhận hàng)
      const created = await orderReviewService.createReview(reviewModalOrder.id, reviewData);
      setExistingReview(created);
    }

    const nextReviewed = Array.from(new Set([...reviewedOrderIds, reviewModalOrder.id]));
    setReviewedOrderIds(nextReviewed);
    try {
      localStorage.setItem('secondlife_reviewed_order_ids', JSON.stringify(nextReviewed));
    } catch { }

    setReviewModalOrder(null);
  };

  const handleReviewDelete = async () => {
    if (!reviewModalOrder) return;
    await orderReviewService.deleteReview(reviewModalOrder.id);
    const nextReviewed = reviewedOrderIds.filter((id) => id !== reviewModalOrder.id);
    setReviewedOrderIds(nextReviewed);
    try {
      localStorage.setItem('secondlife_reviewed_order_ids', JSON.stringify(nextReviewed));
    } catch { }
    setExistingReview(null);
    setReviewModalOrder(null);
  };

  return {
    reviewModalOrder,
    setReviewModalOrder,
    sellerReviewsModalData,
    setSellerReviewsModalData,
    existingReview,
    isLoadingReview,
    reviewedOrderIds,
    handleReviewSubmit,
    handleReviewDelete,
  };
}

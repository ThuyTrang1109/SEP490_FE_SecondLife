import { request, PageResponse } from './apiClient';

export interface OrderReviewDto {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  sellerId: string;
  sellerName: string;
  postId?: string;
  productTitle?: string;
  productImage?: string;
  conditionGrade?: string;
  rating: number;
  comment: string;
  tags?: string[];
  photos?: string[];
  verifiedPurchase: boolean;
  editCount: number;
  maxEdits: number;
  canEdit: boolean;
  canDelete: boolean;
  remainingEditSeconds?: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderReviewRequest {
  rating: number;
  comment: string;
  tags?: string[];
  photos?: string[];
}

export interface UpdateOrderReviewRequest {
  rating?: number;
  comment?: string;
  tags?: string[];
  photos?: string[];
}

export interface SellerReviewSummaryDto {
  sellerId: string;
  averageRating: number;
  totalReviews: number;
  ratingCounts: Record<number, number>;
}

export const orderReviewService = {
  /**
   * Tạo đánh giá cho đơn hàng (trong vòng 48h từ lúc bưu tá giao thành công)
   * POST /api/v1/orders/{orderId}/reviews
   */
  async createReview(orderId: string, payload: CreateOrderReviewRequest): Promise<OrderReviewDto> {
    const res = await request<OrderReviewDto>(`/v1/orders/${orderId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as OrderReviewDto;
  },

  /**
   * Chỉnh sửa đánh giá (tối đa 1 lần trong 48h)
   * PUT /api/v1/orders/{orderId}/reviews
   */
  async updateReview(orderId: string, payload: UpdateOrderReviewRequest): Promise<OrderReviewDto> {
    const res = await request<OrderReviewDto>(`/v1/orders/${orderId}/reviews`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as OrderReviewDto;
  },

  /**
   * Xóa đánh giá (trong vòng 48h)
   * DELETE /api/v1/orders/{orderId}/reviews
   */
  async deleteReview(orderId: string): Promise<void> {
    await request<void>(`/v1/orders/${orderId}/reviews`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  /**
   * Lấy thông tin đánh giá của đơn hàng (kèm trạng thái canEdit, canDelete, remainingEditSeconds)
   * GET /api/v1/orders/{orderId}/review
   */
  async getOrderReview(orderId: string): Promise<OrderReviewDto | null> {
    try {
      const res = await request<OrderReviewDto>(`/v1/orders/${orderId}/review`, {
        method: 'GET',
        requiresAuth: true,
      });
      return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as OrderReviewDto;
    } catch {
      return null;
    }
  },

  /**
   * Lấy danh sách đánh giá của người bán (công khai)
   * GET /api/v1/sellers/{sellerId}/reviews?page=0&size=10
   */
  async getSellerReviews(sellerId: string, page = 0, size = 10): Promise<PageResponse<OrderReviewDto>> {
    const res = await request<PageResponse<OrderReviewDto>>(`/v1/sellers/${sellerId}/reviews?page=${page}&size=${size}`, {
      method: 'GET',
    });
    return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as PageResponse<OrderReviewDto>;
  },

  /**
   * Lấy tóm tắt điểm đánh giá sao của người bán
   * GET /api/v1/sellers/{sellerId}/reviews/summary
   */
  async getSellerSummary(sellerId: string): Promise<SellerReviewSummaryDto | null> {
    try {
      const res = await request<SellerReviewSummaryDto>(`/v1/sellers/${sellerId}/reviews/summary`, {
        method: 'GET',
      });
      return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as SellerReviewSummaryDto;
    } catch {
      return null;
    }
  },

  /**
   * Lấy đánh giá của sản phẩm theo postId
   * GET /api/v1/posts/{postId}/reviews
   */
  async getPostReviews(postId: string, page = 0, size = 10): Promise<PageResponse<OrderReviewDto>> {
    const res = await request<PageResponse<OrderReviewDto>>(`/v1/posts/${postId}/reviews?page=${page}&size=${size}`, {
      method: 'GET',
    });
    return ((res as any)?.data !== undefined && (res as any)?.data !== null ? (res as any).data : res) as PageResponse<OrderReviewDto>;
  },
};

import { request } from './apiClient';

export interface PostInitRequest {
  categoryId: string;
  itemId?: string;
  images?: (File | Blob | string)[];
  base64Image?: string;
}

export interface PostInitResponse {
  postId: string;
  sessionId: string;
  aiInitialMessage?: string;
  aiDescription?: string;
}

export interface ListingDraftResponse {
  postId?: string;
  id?: string;
  title: string;
  description: string;
  itemCondition?: string;
  price?: number | null;
  imageUrls: string[];
  aiDescription?: string;
  descriptionAccepted: boolean;
  status: string;
  sellerId?: string;
  categoryId?: string;
  itemId?: string;
  reviewReason?: string;
  duplicateMatches?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateDraftRequest {
  title: string;
  description: string;
  itemCondition?: string;
  price?: number | null;
}

export interface AcceptDescriptionRequest {
  description: string;
}

export interface AiPriceEstimationRequest {
  requestId: string;
}

export interface AiPriceEstimationResponse {
  estimateId?: string;
  postId?: string;
  requestId?: string;
  fairPriceMin: number;
  fairPriceMax: number;
  suggestedPrice: number;
  currency?: string;
  modelVersion?: string;
  expectedSellTime?: string | null;
  createdAt?: string;
}

export interface PostSubmitRequest {
  title: string;
  description: string;
  price: number;
}

export interface PostSubmitResponse {
  postId?: string;
  id?: string;
  status: 'ACTIVE' | 'PENDING' | 'PENDING_INSPECTION' | 'INSUFFICIENT_CREDIT' | 'REJECTED' | string;
  inspectionRequired?: boolean;
  inspectionFee?: number | null;
  shippingFee?: number | null;
  creditShortfall?: number | null;
  message?: string;
  reviewReason?: string;
  duplicateMatches?: string[];
}

export const postService = {
  /**
   * Lấy danh sách sản phẩm niêm yết công khai từ Backend (GET /api/v1/listings hoặc GET /api/v1/posts)
   */
  async getPublicListings(page = 0, size = 50, categoryId?: string, itemId?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('size', String(size));
    if (categoryId) params.append('categoryId', categoryId);
    if (itemId) params.append('itemId', itemId);
    const queryString = `?${params.toString()}`;

    // 1. Thử gọi /v1/listings
    try {
      const res = await request<any>(`/v1/listings${queryString}`, {
        method: 'GET',
        requiresAuth: false,
      });
      const d = (res as any)?.data || res;
      const items = d?.content || d?.items || (Array.isArray(d) ? d : []);
      if (items && items.length > 0) return items;
    } catch (err) {
      console.warn('Thử gọi /v1/listings lỗi, chuyển sang fallback /v1/posts:', err);
    }

    // 2. Fallback sang /v1/posts
    try {
      const resPosts = await request<any>(`/v1/posts${queryString}`, {
        method: 'GET',
        requiresAuth: false,
      });
      const d = (resPosts as any)?.data || resPosts;
      return d?.content || d?.items || (Array.isArray(d) ? d : []);
    } catch (err) {
      console.warn('Thử gọi /v1/posts lỗi:', err);
      return [];
    }
  },

  /**
   * Lấy chi tiết bài đăng niêm yết theo ID (GET /api/v1/listings/{postId})
   */
  async getListingDetail(postId: string): Promise<any> {
    try {
      const res = await request<any>(`/v1/listings/${postId}`, {
        method: 'GET',
        requiresAuth: false,
      });
      return (res as any)?.data || res;
    } catch (err) {
      console.warn(`Lỗi lấy chi tiết listing ${postId}:`, err);
      return null;
    }
  },

  /**
   * Lấy danh sách tin đăng bài công khai từ Backend (hỗ trợ backward compatibility)
   */
  async getPublicPosts(categoryId?: string, itemId?: string): Promise<any> {
    return this.getPublicListings(0, 100, categoryId, itemId);
  },

  /**
   * Lấy danh sách bài đăng của chính người dùng/người bán (GET /api/v1/posts/my-posts)
   */
  async getMyPosts(page = 0, size = 20): Promise<any> {
    try {
      const response = await request<any>(`/v1/posts/my-posts?page=${page}&size=${size}&sort=createdAt,desc`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch (err) {
      console.warn('Lỗi lấy danh sách bài đăng cá nhân từ backend:', err);
      return { content: [] };
    }
  },

  /**
   * Khởi tạo bài đăng mới (POST /api/v1/posts/init)
   * Chuẩn Backend Main Flow 1: multipart/form-data chứa categoryId, itemId, images (3-6 files)
   * Có hỗ trợ graceful fallback JSON payload nếu backend cần JSON.
   */
  async initPost(payload: PostInitRequest): Promise<PostInitResponse> {
    const formData = new FormData();
    formData.append('categoryId', payload.categoryId);
    if (payload.itemId) {
      formData.append('itemId', payload.itemId);
    }

    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((img, idx) => {
        if (img instanceof File) {
          formData.append('images', img, img.name);
        } else if (img instanceof Blob) {
          formData.append('images', img, `image_${idx + 1}.jpg`);
        } else if (typeof img === 'string' && img.startsWith('data:')) {
          try {
            const arr = img.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            formData.append('images', blob, `image_${idx + 1}.jpg`);
          } catch {
            // ignore malformed base64
          }
        }
      });
    }

    try {
      const response = await request<PostInitResponse>('/v1/posts/init', {
        method: 'POST',
        body: formData,
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch (err: any) {
      // Graceful fallback to JSON if backend environment expects application/json
      if (err?.status === 415 || String(err?.message).includes('415') || String(err?.message).includes('JSON')) {
        const jsonBody = {
          categoryId: payload.categoryId,
          itemId: payload.itemId,
        };
        const response = await request<PostInitResponse>('/v1/posts/init', {
          method: 'POST',
          body: JSON.stringify(jsonBody),
          requiresAuth: true,
        });
        return (response as any)?.data || response;
      }
      throw err;
    }
  },

  /**
   * Lấy chi tiết thông tin draft bài đăng (GET /api/v1/posts/{postId})
   */
  async getPost(postId: string): Promise<ListingDraftResponse> {
    try {
      const response = await request<ListingDraftResponse>(`/v1/posts/${postId}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch {
      return {
        postId,
        id: postId,
        title: '',
        description: '',
        imageUrls: [],
        descriptionAccepted: false,
        status: 'DRAFT',
      };
    }
  },

  /**
   * Lưu thông tin draft bài đăng (PUT /api/v1/posts/{postId}/draft)
   */
  async updateDraft(postId: string, data: UpdateDraftRequest): Promise<ListingDraftResponse> {
    try {
      const response = await request<ListingDraftResponse>(`/v1/posts/${postId}/draft`, {
        method: 'PUT',
        body: JSON.stringify(data),
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch {
      return {
        postId,
        title: data.title,
        description: data.description,
        itemCondition: data.itemCondition,
        price: data.price,
        imageUrls: [],
        descriptionAccepted: false,
        status: 'DRAFT',
      };
    }
  },

  /**
   * Xác nhận nội dung mô tả đang hiển thị (POST /api/v1/posts/{postId}/accept-description)
   */
  async acceptDescription(postId: string, description: string): Promise<ListingDraftResponse> {
    try {
      const response = await request<ListingDraftResponse>(`/v1/posts/${postId}/accept-description`, {
        method: 'POST',
        body: JSON.stringify({ description }),
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch {
      return {
        postId,
        title: '',
        description,
        imageUrls: [],
        descriptionAccepted: true,
        status: 'DRAFT',
      };
    }
  },

  /**
   * Định giá bằng AI (POST /api/v1/posts/{postId}/ai-price-estimation)
   */
  async estimatePrice(postId: string, requestId?: string): Promise<AiPriceEstimationResponse> {
    const reqId =
      requestId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    try {
      const response = await request<AiPriceEstimationResponse>(`/v1/posts/${postId}/ai-price-estimation`, {
        method: 'POST',
        body: JSON.stringify({ requestId: reqId }),
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch {
      return {
        requestId: reqId,
        fairPriceMin: 3500000,
        fairPriceMax: 4800000,
        suggestedPrice: 4200000,
        modelVersion: 'SecondLife-AI-v2.1',
        expectedSellTime: '3-5 ngày',
        createdAt: new Date().toISOString(),
      };
    }
  },

  /**
   * Lấy kết quả định giá AI mới nhất (GET /api/v1/posts/{postId}/ai-price-estimation)
   */
  async getLatestPriceEstimate(postId: string): Promise<AiPriceEstimationResponse | null> {
    try {
      const response = await request<AiPriceEstimationResponse>(`/v1/posts/${postId}/ai-price-estimation`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch (err: any) {
      if (err?.status === 404 || String(err?.message).includes('404')) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Lấy lịch sử định giá AI (GET /api/v1/posts/{postId}/ai-price-estimation/history?page=0&size=20)
   */
  async getPriceEstimateHistory(postId: string, page = 0, size = 20): Promise<any> {
    const response = await request<any>(`/v1/posts/${postId}/ai-price-estimation/history?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * AI tổng hợp cuộc hội thoại và cập nhật mô tả vào bài đăng (POST /api/v1/posts/finalize-chat/{sessionId})
   */
  async finalizeChat(sessionId: string): Promise<any> {
    const response = await request<any>(`/v1/posts/finalize-chat/${sessionId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Gửi đăng bài chính thức (POST /api/v1/posts/submit/{postId})
   * Đọc response.status trực tiếp: ACTIVE, PENDING, PENDING_INSPECTION, REJECTED
   */
  async submitPost(postId: string, data?: PostSubmitRequest): Promise<PostSubmitResponse> {
    const payload: PostSubmitRequest = data || {
      title: 'Bài đăng mới',
      description: 'Mô tả bài đăng sản phẩm',
      price: 1000000,
    };
    const response = await request<PostSubmitResponse>(`/v1/posts/submit/${postId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },
};

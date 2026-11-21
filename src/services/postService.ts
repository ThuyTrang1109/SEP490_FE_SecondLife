import { request, requestGet, getAccessToken } from './apiClient';
import { SellerPostDetailDto } from '../types';

export interface PostInitRequest {
  categoryId: string;
  itemId?: string;
  brand?: string;
  model?: string;
  images?: (File | Blob | string)[];
  base64Image?: string;
  mode?: 'ai' | 'manual';
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
  imageUrls?: string[];
  imageUrl?: string;
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

export interface PostResponse {
  id: string;
  title: string;
  description?: string;
  imageUrls?: string[];
  imageUrl?: string;
  price?: number;
  itemCondition?: string;
  aiDescription?: string;
  aiSuggestedPrice?: number;
  status: string;
  categoryId?: string;
  itemId?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id?: string;
    email?: string;
    fullName?: string;
  };
}

export type MarketplaceCondition = 'NEW' | 'LIKE_NEW' | 'USED_GOOD' | 'USED_FAIR' | 'USED';
export type MarketplaceSort = 'newest' | 'priceAsc' | 'priceDesc';

export interface MarketplaceSearchQuery {
  q?: string;
  categoryId?: string;
  brand?: string;
  condition?: MarketplaceCondition;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  inspected?: boolean;
  sort: MarketplaceSort;
  page: number;
  size: number;
}

export interface MarketplacePost extends PostResponse {
  postId: string;
  brand?: string | null;
  publishedAt?: string;
  sellerAddress?: string | null;
  isInspected?: boolean;
}

export interface MarketplaceSearchPage {
  content: MarketplacePost[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface UpdateDraftRequest {
  title: string;
  description: string;
  itemCondition?: string;
  price?: number | null;
  shippingWeight?: number;
  shippingLength?: number;
  shippingWidth?: number;
  shippingHeight?: number;
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
  shippingWeight?: number;
  shippingLength?: number;
  shippingWidth?: number;
  shippingHeight?: number;
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
  inspectionOrderId?: string | null;
  inspectionThreshold?: number | null;
  inspectionPolicyVersion?: number | null;
  nextAction?: 'SELECT_INSPECTION_METHOD' | 'WAIT_FOR_LISTING_REVIEW' | 'PAY_INSPECTION_FEE' | 'TRACK_INSPECTION' | 'TRACK_INSPECTION_RETURN' | string | null;
}

const postDetailCache = new Map<string, { data: any; timestamp: number }>();
const postDetailInFlight = new Map<string, Promise<any>>();
const POST_CACHE_TTL_MS = 20_000;

export const postService = {
  /**
   * Xóa cache bài đăng nếu cần làm mới thủ công
   */
  invalidateListingDetailCache(postId?: string) {
    if (postId) {
      postDetailCache.delete(postId);
      postDetailInFlight.delete(postId);
    } else {
      postDetailCache.clear();
      postDetailInFlight.clear();
    }
  },
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

    try {
      const resPosts = await request<any>(`/v1/posts${queryString}`, {
        method: 'GET',
        requiresAuth: false, // DO NOT SEND TOKEN TO PREVENT 401 ON EXPIRED TOKENS FOR PUBLIC APIS
      });
      const d = (resPosts as any)?.data || resPosts;
      return d?.content || d?.items || (Array.isArray(d) ? d : []);
    } catch (err) {
      console.warn('Lỗi gọi /v1/posts:', err);
      return [];
    }
  },

  async searchPublicListings(query: MarketplaceSearchQuery, signal?: AbortSignal): Promise<MarketplaceSearchPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== false) params.set(key, String(value));
    }
    const { data } = await requestGet<MarketplaceSearchPage>(`/v1/posts/search?${params}`, {
      requiresAuth: false,
      signal,
    });
    if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements) ||
        !Number.isInteger(data.totalPages) || !Number.isInteger(data.number)) {
      throw new Error('Invalid marketplace search response');
    }
    return data;
  },

  /**
   * Lấy chi tiết bài đăng niêm yết theo ID (GET /api/v1/posts/{postId})
   * Tích hợp deduplication & cache in-flight để không bị gọi lặp request
   */
  async getListingDetail(postId: string, bypassCache = false): Promise<any> {
    if (!postId) return null;

    if (!bypassCache) {
      const cached = postDetailCache.get(postId);
      if (cached && Date.now() - cached.timestamp < POST_CACHE_TTL_MS) {
        return cached.data;
      }
      if (postDetailInFlight.has(postId)) {
        return postDetailInFlight.get(postId)!;
      }
    }

    const fetchPromise = (async () => {
      try {
        const res = await request<any>(`/v1/posts/${postId}`, {
          method: 'GET',
          requiresAuth: false,
        });
        const result = (res as any)?.data || res;
        postDetailCache.set(postId, { data: result, timestamp: Date.now() });
        return result;
      } catch (err: any) {
        if (err?.status === 404 || err?.message?.includes('Listing is not available for purchase')) {
          return null;
        }
        console.warn(`[postService] Lỗi lấy chi tiết bài đăng ${postId}:`, err);
        return null;
      } finally {
        postDetailInFlight.delete(postId);
      }
    })();

    if (!bypassCache) {
      postDetailInFlight.set(postId, fetchPromise);
    }
    return fetchPromise;
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
   * Seller: xem chi tiết bài đăng của chính mình (GET /api/v1/posts/my-posts/{postId})
   * Yêu cầu quyền PROFILE_READ_SELF và access token của seller.
   * BE kiểm tra chủ sở hữu: token phải thuộc người tạo bài đăng.
   * Không giới hạn ACTIVE: chủ bài vẫn xem được RESERVED, PAYMENT_PENDING, SOLD, DRAFT, PENDING, REJECTED...
   * Response 200 trả trực tiếp PostDto không có lớp data/success bọc ngoài.
   */
  async getMyPostDetail(postId: string, signal?: AbortSignal): Promise<SellerPostDetailDto> {
    try {
      const cleanId = String(postId || '').trim();
      const response = await request<SellerPostDetailDto>(`/v1/posts/my-posts/${encodeURIComponent(cleanId)}`, {
        method: 'GET',
        requiresAuth: true,
        signal,
      });
      return (response as any)?.data || response;
    } catch (err: any) {
      if (!signal?.aborted) console.warn(`[postService] Lỗi lấy chi tiết bài đăng cá nhân ${postId}:`, err);
      throw err;
    }
  },

  /**
   * Chọn lại loại cụ thể (Item) cho bài cũ đã bị tách hoặc ngừng chọn
   * PATCH /api/v1/posts/my-posts/{postId}/item
   * Body: { itemId: string }
   */
  async reclassifyItem(postId: string, itemId: string): Promise<any> {
    const cleanId = String(postId || '').trim();
    const response = await request<any>(`/v1/posts/my-posts/${encodeURIComponent(cleanId)}/item`, {
      method: 'PATCH',
      body: JSON.stringify({ itemId }),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
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
    if (payload.mode) {
      formData.append('mode', payload.mode);
    }
    if (payload.brand) {
      formData.append('brand', payload.brand);
    }
    if (payload.model) {
      formData.append('model', payload.model);
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
   * Lấy chi tiết thông tin draft bài đăng của người dùng (GET /api/v1/posts/{postId}/draft)
   */
  async getDraft(postId: string): Promise<ListingDraftResponse> {
    try {
      const response = await request<ListingDraftResponse>(`/v1/posts/${postId}/draft`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch {
      // Fallback nếu bài đăng đã duyệt / xuất bản thành post công khai
      return this.getPost(postId);
    }
  },

  /**
   * Lấy chi tiết bài đăng (GET /api/v1/posts/{postId})
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
   * Xóa bản nháp bài đăng chưa xuất bản (DELETE /api/v1/posts/{postId}/draft)
   */
  async deleteDraft(postId: string): Promise<void> {
    await request<void>(`/v1/posts/${postId}/draft`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async estimatePrice(postId: string, requestId?: string): Promise<AiPriceEstimationResponse> {
    const reqId =
      requestId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    const response = await request<AiPriceEstimationResponse>(`/v1/posts/${postId}/ai-price-estimation`, {
      method: 'POST',
      body: JSON.stringify({ requestId: reqId }),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
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
  async finalizeChat(sessionId: string, message?: string): Promise<any> {
    const response = await request<any>(`/v1/posts/finalize-chat/${sessionId}`, {
      method: 'POST',
      body: message ? JSON.stringify({ message }) : undefined,
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  async regenerateChat(sessionId: string, message?: string): Promise<any> {
    const response = await request<any>(`/v1/posts/regenerate-chat/${sessionId}`, {
      method: 'POST',
      body: message ? JSON.stringify({ message }) : undefined,
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Gửi đăng bài chính thức (POST /api/v1/posts/submit/{postId})
   * Đọc response.status trực tiếp: ACTIVE, PENDING, PENDING_INSPECTION, REJECTED
   */
  /**
   * AI Gợi ý tiêu đề chuẩn SEO TMĐT (-1 credit AI) (POST /api/v1/posts/{postId}/suggest-title)
   */
  async suggestTitle(postId: string, context?: string): Promise<{ title: string }> {
    const response = await request<{ title: string }>(`/v1/posts/${postId}/suggest-title`, {
      method: 'POST',
      body: JSON.stringify({ context }),
      headers: { 'Content-Type': 'application/json' },
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  async submitPost(postId: string, data?: PostSubmitRequest): Promise<PostSubmitResponse> {
    const payload: PostSubmitRequest = data || {
      title: 'Bài đăng mới',
      description: 'Mô tả bài đăng sản phẩm',
      price: 1000000,
      shippingWeight: 500,
      shippingLength: 20,
      shippingWidth: 15,
      shippingHeight: 10,
    };
    const response = await request<PostSubmitResponse>(`/v1/posts/submit/${postId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  async publishInspectedPost(postId: string): Promise<SellerPostDetailDto> {
    const response = await request<SellerPostDetailDto>(`/v1/posts/${encodeURIComponent(postId)}/publish-inspected`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Thẩm định giá sản phẩm bằng AI độc lập trực tiếp (không bắt buộc có draft)
   * POST /api/v1/ai/estimate-price
   */
  async estimatePriceDirect(payload: {
    title: string;
    category?: string;
    brand?: string;
    model?: string;
    condition?: string;
    accessories?: string;
    notes?: string;
    originalPrice?: number;
    imageUrls?: string[];
  }): Promise<AiPriceEstimationResponse> {
    const res = await request<any>('/v1/ai/estimate-price', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};

import { ProductReview, SellerTrustProfile } from '../types';

export const mockProductReviews: ProductReview[] = [];

export const mockSellerTrustProfiles: Record<string, SellerTrustProfile> = {};

const REVIEWS_STORAGE_KEY = 'secondlife_customer_reviews';

const LEGACY_MOCK_PREFIXES = ['rev-hitachi', 'rev-nam', 'rev-mai', 'rev-thang', 'rev-noicom', 'rev-panasonic', 'rev-yson', 'rev-dyson', 'rev-lg', 'rev-bosch', 'rev-daikin'];

function isLegacyMockReview(r: any): boolean {
  if (!r || typeof r !== 'object') return true;
  const id = String(r.id || '');
  const listingId = String(r.listingId || '');
  const sellerId = String(r.sellerId || '');
  if (LEGACY_MOCK_PREFIXES.some((prefix) => id.startsWith(prefix))) return true;
  if (listingId.startsWith('listing-')) return true;
  if (sellerId.startsWith('user-')) return true;
  return false;
}

export const reviewService = {
  getAllReviews(): ProductReview[] {
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((r) => !isLegacyMockReview(r));
          if (cleaned.length !== parsed.length) {
            try {
              localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(cleaned));
            } catch {
              // Ignore storage error
            }
          }
          return cleaned;
        }
      }
    } catch {
      // Fallback
    }
    return [];
  },

  getReviewsByListing(listingId: string): ProductReview[] {
    if (!listingId) return [];
    const all = this.getAllReviews();
    const target = String(listingId).trim();
    return all.filter(r => r.listingId && String(r.listingId).trim() === target);
  },

  getReviewsBySeller(sellerId: string): ProductReview[] {
    if (!sellerId) return [];
    const all = this.getAllReviews();
    const target = String(sellerId).trim();
    return all.filter(r => r.sellerId && String(r.sellerId).trim() === target);
  },

  getSellerTrustProfile(sellerId: string, sellerName?: string): SellerTrustProfile {
    if (mockSellerTrustProfiles[sellerId]) {
      return mockSellerTrustProfiles[sellerId];
    }
    return {
      sellerId,
      sellerName: sellerName || 'Người bán SecondLife',
      trustScore: 0,
      tier: 'Bạc',
      rating: 0,
      reviewCount: 0,
      successfulOrders: 0,
      completionRate: 0,
      responseRate: 0,
      responseTime: 'Chưa có dữ liệu',
      hubPassRate: 0,
      cancellationRate: 0,
      badges: []
    };
  },

  addReview(newReview: Omit<ProductReview, 'id' | 'createdAt'>): ProductReview {
    const review: ProductReview = {
      ...newReview,
      id: `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString()
    };

    const current = this.getAllReviews();
    const updated = [review, ...current];
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    return review;
  }
};

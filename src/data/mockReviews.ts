import { ProductReview, SellerTrustProfile } from '../types';

export const mockProductReviews: ProductReview[] = [];

export const mockSellerTrustProfiles: Record<string, SellerTrustProfile> = {};

const REVIEWS_STORAGE_KEY = 'secondlife_customer_reviews';

export const reviewService = {
  getAllReviews(): ProductReview[] {
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
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

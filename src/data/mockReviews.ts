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
    const all = this.getAllReviews();
    return all.filter(r => r.listingId === listingId);
  },

  getReviewsBySeller(sellerId: string): ProductReview[] {
    const all = this.getAllReviews();
    return all.filter(r => r.sellerId === sellerId);
  },

  getSellerTrustProfile(sellerId: string, sellerName?: string): SellerTrustProfile {
    if (mockSellerTrustProfiles[sellerId]) {
      return mockSellerTrustProfiles[sellerId];
    }
    return {
      sellerId,
      sellerName: sellerName || 'Người bán SecondLife',
      trustScore: 100,
      tier: 'Bạc',
      rating: 5.0,
      reviewCount: 0,
      successfulOrders: 0,
      completionRate: 100,
      responseRate: 100,
      responseTime: 'N/A',
      hubPassRate: 100,
      cancellationRate: 0,
      badges: [
        '100% Giao dịch qua Escrow'
      ]
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

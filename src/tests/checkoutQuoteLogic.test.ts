import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCityKey } from '../components/common/LalamoveAddressPicker';

// Helper types mirroring CheckoutModal quote management
interface ShippingQuote {
  quoteId: string;
  shippingFee: number;
  productPrice: number;
  expiresAt: string;
}

interface QuoteManagerConfig {
  postId: string;
  negotiationId?: string;
  mockGetShippingQuote: (body: any, options?: { signal?: AbortSignal }) => Promise<ShippingQuote>;
  mockVerifyNegotiation?: (negotiationId: string) => Promise<{ valid: boolean; verifiedNegotiation?: any; error?: string }>;
}

class TestQuoteManager {
  private config: QuoteManagerConfig;
  public ghnQuote: ShippingQuote | null = null;
  public quoteLoading: boolean = false;
  public quoteError: string | null = null;
  public quoteErrorCode: string | null = null;
  public orderError: string | null = null;

  public quoteRequestId = 0;
  public activeAbortController: AbortController | null = null;
  public inFlightPromise: Promise<ShippingQuote | null> | null = null;
  public inFlightKey: string = '';
  public cachedKey: string = '';

  public verifyingNegotiation: boolean;
  public negotiationValid: boolean;
  public negotiationError?: string;
  public verifiedNegotiationId?: string;

  public requestCallHistory: any[] = [];
  public abortedRequestIds: number[] = [];

  constructor(config: QuoteManagerConfig) {
    this.config = config;
    this.verifyingNegotiation = Boolean(config.negotiationId);
    this.negotiationValid = !config.negotiationId;
  }

  async verifyNegotiationIfNeeded() {
    if (!this.config.negotiationId) return;
    this.verifyingNegotiation = true;
    if (this.config.mockVerifyNegotiation) {
      const res = await this.config.mockVerifyNegotiation(this.config.negotiationId);
      this.negotiationValid = res.valid;
      this.negotiationError = res.error;
      this.verifiedNegotiationId = res.verifiedNegotiation?.id || (res.valid ? this.config.negotiationId : undefined);
    } else {
      this.negotiationValid = true;
      this.verifiedNegotiationId = this.config.negotiationId;
    }
    this.verifyingNegotiation = false;
  }

  async getOrFetchQuote(opts: {
    lat: number;
    lng: number;
    city: string;
    addr?: string;
    name?: string;
    phone?: string;
    forceRefresh?: boolean;
  }): Promise<ShippingQuote | null> {
    const { lat, lng, city, addr = '', name = 'Khách Hàng', phone = '0986444333', forceRefresh = false } = opts;

    // 1. Kiểm tra tọa độ GPS
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      this.ghnQuote = null;
      this.quoteLoading = false;
      return null;
    }

    // 2. Kiểm tra khu vực được hỗ trợ dùng chính xác normalizeCityKey
    const regionKey = normalizeCityKey(city || addr);
    if (regionKey === 'OTHER') {
      this.ghnQuote = null;
      this.quoteLoading = false;
      this.quoteError = 'Hệ thống hiện chỉ hỗ trợ giao hàng tại khu vực Hà Nội và TP. Hồ Chí Minh.';
      this.quoteErrorCode = 'UNSUPPORTED_REGION';
      return null;
    }

    // 3. Kiểm tra thương lượng
    if (this.config.negotiationId && this.verifyingNegotiation) {
      return null;
    }
    if (this.config.negotiationId && !this.negotiationValid) {
      this.ghnQuote = null;
      this.quoteLoading = false;
      this.quoteError = this.negotiationError || 'Thương lượng không hợp lệ hoặc đã hết hạn.';
      return null;
    }

    const negId = this.verifiedNegotiationId;
    const targetKey = `${this.config.postId}|${negId || ''}|${lat.toFixed(5)}|${lng.toFixed(5)}|${phone}|${name}`;

    // 4. Tái sử dụng cache hoặc in-flight promise nếu không forceRefresh
    if (!forceRefresh) {
      if (this.ghnQuote && this.cachedKey === targetKey) {
        const isExpired = new Date(this.ghnQuote.expiresAt).getTime() <= Date.now();
        if (!isExpired) {
          this.quoteLoading = false;
          return this.ghnQuote;
        }
      }
      if (this.inFlightPromise && this.inFlightKey === targetKey) {
        return this.inFlightPromise;
      }
    }

    // 5. Khởi tạo request mới
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    const currentRequestId = ++this.quoteRequestId;
    const controller = new AbortController();
    this.activeAbortController = controller;
    this.inFlightKey = targetKey;

    this.ghnQuote = null;
    this.quoteLoading = true;
    this.quoteError = null;
    this.quoteErrorCode = null;

    const promise = (async (): Promise<ShippingQuote | null> => {
      try {
        const payload = {
          postId: this.config.postId,
          ...(negId ? { negotiationId: negId } : {}),
          deliveryAddress: { name, phone, latitude: lat, longitude: lng, address: addr },
        };
        this.requestCallHistory.push({ requestId: currentRequestId, payload });

        const result = await this.config.mockGetShippingQuote(payload, { signal: controller.signal });

        if (currentRequestId !== this.quoteRequestId) {
          return null;
        }

        this.ghnQuote = result;
        this.cachedKey = targetKey;
        this.quoteError = null;
        return result;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          this.abortedRequestIds.push(currentRequestId);
          return null;
        }
        if (currentRequestId === this.quoteRequestId) {
          this.ghnQuote = null;
          this.cachedKey = '';
          this.quoteError = err?.message || 'Không thể tính phí vận chuyển Lalamove.';
        }
        return null;
      } finally {
        if (currentRequestId === this.quoteRequestId) {
          this.quoteLoading = false;
          this.inFlightPromise = null;
        }
      }
    })();

    this.inFlightPromise = promise;
    return promise;
  }

  handleUnmount() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.inFlightPromise = null;
  }

  async handleConfirmOrder(opts: {
    lat: number;
    lng: number;
    city: string;
    addr?: string;
    name?: string;
    phone?: string;
  }) {
    let activeQuote = this.ghnQuote;
    const isQuoteExpired = activeQuote?.expiresAt ? new Date(activeQuote.expiresAt).getTime() <= Date.now() : false;

    if (!activeQuote || isQuoteExpired || this.quoteLoading) {
      const prevTotal = activeQuote ? activeQuote.productPrice + activeQuote.shippingFee : 0;
      activeQuote = await this.getOrFetchQuote({
        ...opts,
        forceRefresh: isQuoteExpired,
      });

      if (!activeQuote) {
        return { success: false, reason: 'QUOTE_FAILED' };
      }

      const newTotal = activeQuote.productPrice + activeQuote.shippingFee;
      if (prevTotal > 0 && Math.abs(newTotal - prevTotal) >= 1) {
        this.orderError = `Cước phí Lalamove đã được làm mới (${activeQuote.shippingFee} đ). Tổng tiền thay đổi từ ${prevTotal} thành ${newTotal}. Vui lòng xác nhận lại.`;
        return { success: false, reason: 'PRICE_CHANGED', prevTotal, newTotal };
      }
    }

    return { success: true, quoteId: activeQuote.quoteId, finalTotal: activeQuote.productPrice + activeQuote.shippingFee };
  }
}

describe('CheckoutModal Quotation Flow Logic Verification', () => {
  const TEST_POST_ID = '7900c193-c59e-4781-a954-ba199e434f8e';
  const DEFAULT_LAT = 10.8697884487954;
  const DEFAULT_LNG = 106.684428566599;
  const DEFAULT_CITY = 'Thành phố Hồ Chí Minh';

  it('[TEST 1] Mở modal với bài đăng 7900c193... và địa chỉ mặc định: Lấy giá thành công và tắt spinner', async () => {
    let callCount = 0;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async () => {
        callCount++;
        return {
          quoteId: 'quote-test-1',
          shippingFee: 35000,
          productPrice: 300000,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    assert.equal(manager.quoteLoading, false);
    assert.equal(manager.ghnQuote, null);

    // Kích hoạt lấy báo giá
    const quotePromise = manager.getOrFetchQuote({
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
      city: DEFAULT_CITY,
      addr: '113 Thạnh Lộc 13, Phường An Phú Đông, Quận 12',
    });

    assert.equal(manager.quoteLoading, true, 'Spinner phải bật khi đang tính giá');
    const quote = await quotePromise;

    assert.equal(callCount, 1, 'Chỉ gửi đúng 1 request lên API');
    assert.ok(quote !== null, 'Phải nhận được báo giá hợp lệ');
    assert.equal(quote?.quoteId, 'quote-test-1');
    assert.equal(quote?.shippingFee, 35000);
    assert.equal(manager.quoteLoading, false, 'Spinner phải tắt sau khi nhận được báo giá');
    assert.equal(manager.quoteError, null, 'Không có lỗi');
  });

  it('[TEST 2] Xử lý React Strict Mode (Mount -> Unmount -> Mount): Request cũ được hủy sạch và Request mới hoàn tất tắt spinner', async () => {
    let calls = 0;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async (_body, options) => {
        calls++;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 20);
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        return {
          quoteId: `quote-strict-${calls}`,
          shippingFee: 32000,
          productPrice: 300000,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    // Mount 1
    const promise1 = manager.getOrFetchQuote({
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
      city: DEFAULT_CITY,
    });
    assert.equal(manager.quoteLoading, true);

    // Strict Mode: Unmount giữa chừng
    manager.handleUnmount();

    // Mount 2 ngay lập tức
    const promise2 = manager.getOrFetchQuote({
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
      city: DEFAULT_CITY,
    });

    await promise1;
    const res2 = await promise2;

    assert.ok(manager.abortedRequestIds.includes(1), 'Request 1 phải bị hủy bằng AbortError');
    assert.ok(res2 !== null, 'Request 2 phải hoàn tất');
    assert.equal(manager.quoteLoading, false, 'Spinner phải tắt, không được kẹt');
    assert.equal(manager.ghnQuote?.quoteId, 'quote-strict-2');
  });

  it('[TEST 3] Đổi địa chỉ nhanh: Request của địa chỉ cũ bị hủy, chỉ áp dụng kết quả của địa chỉ mới nhất', async () => {
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async (payload, options) => {
        const isAddr1 = payload.deliveryAddress.latitude === DEFAULT_LAT;
        const delay = isAddr1 ? 30 : 10;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        return {
          quoteId: isAddr1 ? 'quote-addr-1' : 'quote-addr-2',
          shippingFee: isAddr1 ? 30000 : 50000,
          productPrice: 300000,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    // Người dùng chọn địa chỉ 1
    const p1 = manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });
    // Ngay sau đó đổi nhanh sang địa chỉ 2
    const p2 = manager.getOrFetchQuote({ lat: 10.7769, lng: 106.7009, city: 'TP. Hồ Chí Minh' });

    await Promise.all([p1, p2]);

    assert.equal(manager.ghnQuote?.quoteId, 'quote-addr-2', 'Chỉ lưu báo giá của địa chỉ cuối cùng');
    assert.equal(manager.ghnQuote?.shippingFee, 50000);
    assert.equal(manager.quoteLoading, false);
  });

  it('[TEST 4] Vào từ Chat có negotiationId: Chờ xác thực thương lượng thành công rồi mới lấy báo giá', async () => {
    let quoteCalled = false;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      negotiationId: 'neg-uuid-1234',
      mockVerifyNegotiation: async (negId) => {
        await new Promise(r => setTimeout(r, 15));
        return { valid: true, verifiedNegotiation: { id: negId, offeredPrice: 280000 } };
      },
      mockGetShippingQuote: async (payload) => {
        quoteCalled = true;
        assert.equal(payload.negotiationId, 'neg-uuid-1234', 'Payload phải chứa negotiationId');
        return {
          quoteId: 'quote-neg-ok',
          shippingFee: 25000,
          productPrice: 280000,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    // Thử gọi lấy giá khi chưa verify xong
    const earlyCall = await manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });
    assert.equal(earlyCall, null, 'Không được gọi API khi chưa verify xong thương lượng');
    assert.equal(quoteCalled, false);

    // Hoàn tất xác thực thương lượng
    await manager.verifyNegotiationIfNeeded();
    assert.equal(manager.negotiationValid, true);

    // Giờ mới gọi lấy báo giá
    const res = await manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });
    assert.equal(quoteCalled, true);
    assert.equal(res?.quoteId, 'quote-neg-ok');
    assert.equal(manager.quoteLoading, false);
  });

  it('[TEST 5] Vào từ Chat với negotiationId KHÔNG hợp lệ / hết hạn: Không gọi Lalamove và hiện lỗi thương lượng', async () => {
    let quoteCalled = false;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      negotiationId: 'neg-expired-999',
      mockVerifyNegotiation: async () => {
        return { valid: false, error: 'Thương lượng giá này đã hết hạn.' };
      },
      mockGetShippingQuote: async () => {
        quoteCalled = true;
        throw new Error('Should not call Lalamove API for invalid negotiation');
      },
    });

    await manager.verifyNegotiationIfNeeded();
    const res = await manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });

    assert.equal(res, null);
    assert.equal(quoteCalled, false, 'Tuyệt đối không gọi Lalamove');
    assert.equal(manager.quoteLoading, false);
    assert.equal(manager.quoteError, 'Thương lượng giá này đã hết hạn.');
  });

  it('[TEST 6] Bấm “Đặt hàng” khi báo giá đang tải: Chờ chung request in-flight và hoàn tất đặt hàng với quoteId đó', async () => {
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async () => {
        await new Promise(r => setTimeout(r, 20));
        return {
          quoteId: 'quote-shared-in-flight',
          shippingFee: 30000,
          productPrice: 300000,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    // 1. Hệ thống bắt đầu tự động lấy báo giá
    const autoQuotePromise = manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });
    assert.equal(manager.quoteLoading, true);

    // 2. Người dùng bấm ngay nút "Xác Nhận Đặt Hàng" trong lúc quote vẫn đang tải
    const orderPromise = manager.handleConfirmOrder({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });

    const [quoteResult, orderResult] = await Promise.all([autoQuotePromise, orderPromise]);

    assert.equal(quoteResult?.quoteId, 'quote-shared-in-flight');
    assert.equal(orderResult.success, true);
    assert.equal(orderResult.quoteId, 'quote-shared-in-flight');
    assert.equal(manager.requestCallHistory.length, 1, 'Chỉ 1 request HTTP duy nhất được gửi, dùng chung cho cả đặt hàng');
    assert.equal(manager.quoteLoading, false);
  });

  it('[TEST 7] Báo giá đã hết hạn khi bấm “Đặt hàng”: Tự động cập nhật báo giá mới và yêu cầu xác nhận nếu tổng tiền thay đổi', async () => {
    let call = 0;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async () => {
        call++;
        return {
          quoteId: `quote-v${call}`,
          shippingFee: call === 1 ? 30000 : 45000, // Cước thay đổi từ 30k -> 45k
          productPrice: 300000,
          expiresAt: call === 1
            ? new Date(Date.now() - 1000).toISOString() // Báo giá cũ đã hết hạn
            : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      },
    });

    // Đã có báo giá cũ nhưng đã hết hạn
    await manager.getOrFetchQuote({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });

    // Bấm đặt hàng
    const orderRes = await manager.handleConfirmOrder({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, city: DEFAULT_CITY });

    assert.equal(orderRes.success, false);
    assert.equal(orderRes.reason, 'PRICE_CHANGED');
    assert.ok(manager.orderError?.includes('Tổng tiền thay đổi từ 330000 thành 345000'));
    assert.equal(call, 2, 'Phải gọi lại API để lấy giá mới nhất');
  });

  it('[TEST 8] Tọa độ hoặc tỉnh thành ngoài khu vực hỗ trợ (ví dụ Đà Nẵng): Thoát rõ ràng, tắt spinner', async () => {
    let called = false;
    const manager = new TestQuoteManager({
      postId: TEST_POST_ID,
      mockGetShippingQuote: async () => {
        called = true;
        throw new Error('Should not call');
      },
    });

    const res = await manager.getOrFetchQuote({
      lat: 16.0544,
      lng: 108.2022,
      city: 'Đà Nẵng',
    });

    assert.equal(res, null);
    assert.equal(called, false);
    assert.equal(manager.quoteLoading, false, 'Spinner phải tắt');
    assert.equal(manager.quoteErrorCode, 'UNSUPPORTED_REGION');
  });
});

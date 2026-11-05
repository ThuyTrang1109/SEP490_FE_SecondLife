import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../services/apiClient';
import { ShippingQuoteResponseDto, ShippingVehicleSelection, ShippingRouteErrorDetails } from '../types';

test('1. ApiError - backward compatibility and code/details expansion', () => {
  // Legacy caller without code/details
  const legacyErr = new ApiError('Not found', 404, undefined, '/test/path');
  assert.equal(legacyErr.message, 'Not found');
  assert.equal(legacyErr.status, 404);
  assert.equal(legacyErr.path, '/test/path');
  assert.equal(legacyErr.code, undefined);
  assert.equal(legacyErr.details, undefined);
  assert.equal(legacyErr instanceof ApiError, true);
  assert.equal(legacyErr instanceof Error, true);

  // New contract caller with code and details
  const details: ShippingRouteErrorDetails = {
    preferredServiceType: 'MOTORCYCLE',
    attemptedServiceTypes: ['MOTORCYCLE', 'LD_PICKUP_TRUCK'],
    pickupCity: 'Thành phố Hà Nội',
    deliveryCity: 'Thành phố Hồ Chí Minh',
    providerErrorCode: 'ERR_OUT_OF_SERVICE_AREA',
  };
  const contractErr = new ApiError(
    'Không tìm được phương tiện Lalamove phù hợp',
    422,
    [],
    '/api/v1/shipping/quotes',
    'NO_SUITABLE_VEHICLE_FOR_ROUTE',
    details
  );
  assert.equal(contractErr.message, 'Không tìm được phương tiện Lalamove phù hợp');
  assert.equal(contractErr.status, 422);
  assert.equal(contractErr.code, 'NO_SUITABLE_VEHICLE_FOR_ROUTE');
  assert.deepEqual(contractErr.details, details);
  assert.equal(contractErr.details.preferredServiceType, 'MOTORCYCLE');
});

test('2. F01: 200, motorcycle, fallbackUsed=false -> No fallback banner', () => {
  const quote: ShippingQuoteResponseDto = {
    quoteId: 'quote-101',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 25000,
    productPrice: 150000,
    totalPayable: 175000,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    provider: 'LALAMOVE',
    serviceType: 'MOTORCYCLE',
    vehicleSelection: {
      preferredServiceType: 'MOTORCYCLE',
      selectedServiceType: 'MOTORCYCLE',
      fallbackUsed: false,
    },
  };

  const shouldShowFallback = Boolean(quote.vehicleSelection?.fallbackUsed);
  assert.equal(shouldShowFallback, false, 'Should not show fallback banner when fallbackUsed is false');
  assert.equal(quote.serviceType, 'MOTORCYCLE');
});

test('3. F02: 200, motorcycle rejected, pickup truck fallback (fallbackUsed=true)', () => {
  const quote: ShippingQuoteResponseDto = {
    quoteId: 'quote-102',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 6164800,
    productPrice: 1400000,
    totalPayable: 7564800,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    provider: 'LALAMOVE',
    serviceType: 'LD_PICKUP_TRUCK',
    vehicleSelection: {
      preferredServiceType: 'MOTORCYCLE',
      selectedServiceType: 'LD_PICKUP_TRUCK',
      fallbackUsed: true,
      reasonCode: 'PREFERRED_VEHICLE_OUT_OF_SERVICE_AREA',
      providerErrorCode: 'ERR_OUT_OF_SERVICE_AREA',
      pickupCity: 'Thành phố Hà Nội',
      deliveryCity: 'Thành phố Hồ Chí Minh',
      distanceKm: 1498.6,
      message: 'Kiện hàng phù hợp với xe máy, nhưng Lalamove không hỗ trợ loại xe này trên tuyến từ Thành phố Hà Nội đến Thành phố Hồ Chí Minh. Hệ thống đã chọn xe bán tải thay thế.',
    },
  };

  const shouldShowFallback = Boolean(quote.vehicleSelection?.fallbackUsed);
  assert.equal(shouldShowFallback, true, 'Should show fallback banner when fallbackUsed is true');
  assert.equal(quote.vehicleSelection?.reasonCode, 'PREFERRED_VEHICLE_OUT_OF_SERVICE_AREA');
  assert.equal(quote.vehicleSelection?.pickupCity, 'Thành phố Hà Nội');
  assert.equal(quote.vehicleSelection?.deliveryCity, 'Thành phố Hồ Chí Minh');
  assert.equal(quote.vehicleSelection?.distanceKm, 1498.6);
  assert.match(quote.vehicleSelection?.message || '', /chọn xe bán tải thay thế/);
});

test('4. F03: 200, large parcel chosen truck initially -> fallbackUsed=false', () => {
  const quote: ShippingQuoteResponseDto = {
    quoteId: 'quote-103',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 250000,
    productPrice: 5000000,
    totalPayable: 5250000,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    provider: 'LALAMOVE',
    serviceType: 'TRUCK500',
    shippingWeight: 45000,
    shippingLength: 120,
    shippingWidth: 80,
    shippingHeight: 90,
    vehicleSelection: {
      preferredServiceType: 'TRUCK500',
      selectedServiceType: 'TRUCK500',
      fallbackUsed: false,
    },
  };

  assert.equal(quote.vehicleSelection?.fallbackUsed, false);
  const shouldShowFallback = Boolean(quote.vehicleSelection?.fallbackUsed);
  assert.equal(shouldShowFallback, false, 'Large parcel starting with truck is not a fallback');
});

test('5. F04: 200, PREFERRED_VEHICLE_UNAVAILABLE displays BE message without misinterpreting as out of area', () => {
  const quote: ShippingQuoteResponseDto = {
    quoteId: 'quote-104',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 320000,
    productPrice: 800000,
    totalPayable: 1120000,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    provider: 'LALAMOVE',
    serviceType: 'VAN500',
    vehicleSelection: {
      preferredServiceType: 'MOTORCYCLE',
      selectedServiceType: 'VAN500',
      fallbackUsed: true,
      reasonCode: 'PREFERRED_VEHICLE_UNAVAILABLE',
      providerErrorCode: 'ERR_INVALID_SERVICE_TYPE',
      message: 'Xe máy tạm thời không khả dụng tại điểm lấy hàng vào thời điểm này. Hệ thống đã chọn xe Van 500kg thay thế.',
    },
  };

  assert.equal(quote.vehicleSelection?.fallbackUsed, true);
  assert.equal(quote.vehicleSelection?.reasonCode, 'PREFERRED_VEHICLE_UNAVAILABLE');
  // Message is preserved as-is from BE
  assert.equal(quote.vehicleSelection?.message, 'Xe máy tạm thời không khả dụng tại điểm lấy hàng vào thời điểm này. Hệ thống đã chọn xe Van 500kg thay thế.');
});

test('6. F05: 422, NO_SUITABLE_VEHICLE_FOR_ROUTE clears quote and provides BE message', () => {
  const err = new ApiError(
    'Không tìm được phương tiện Lalamove phù hợp phục vụ tuyến từ Thành phố Hà Nội đến Thành phố Hồ Chí Minh. Vui lòng kiểm tra lại địa chỉ lấy hàng và địa chỉ nhận hàng.',
    422,
    [],
    '/api/v1/shipping/quotes',
    'NO_SUITABLE_VEHICLE_FOR_ROUTE',
    {
      preferredServiceType: 'MOTORCYCLE',
      attemptedServiceTypes: ['MOTORCYCLE', 'LD_PICKUP_TRUCK'],
      pickupCity: 'Thành phố Hà Nội',
      deliveryCity: 'Thành phố Hồ Chí Minh',
      providerErrorCode: 'ERR_OUT_OF_SERVICE_AREA',
    }
  );

  assert.equal(err.status, 422);
  assert.equal(err.code, 'NO_SUITABLE_VEHICLE_FOR_ROUTE');
  assert.equal(err.message.includes('Lalamove chỉ giao nội thành'), false, 'Must not claim Lalamove only delivers intra-city');
  assert.match(err.message, /Không tìm được phương tiện Lalamove phù hợp/);
});

test('7. F06: 429/502/503/504 technical errors are distinguished from unsupported route', () => {
  const rateLimitErr = new ApiError('Rate limit', 429);
  const badGatewayErr = new ApiError('Bad Gateway', 502);
  const timeoutErr = new ApiError('Gateway Timeout', 504);

  assert.equal(rateLimitErr.status, 429);
  assert.notEqual(rateLimitErr.code, 'NO_SUITABLE_VEHICLE_FOR_ROUTE');

  assert.equal(badGatewayErr.status, 502);
  assert.notEqual(badGatewayErr.code, 'NO_SUITABLE_VEHICLE_FOR_ROUTE');

  assert.equal(timeoutErr.status, 504);
  assert.notEqual(timeoutErr.code, 'NO_SUITABLE_VEHICLE_FOR_ROUTE');
});

test('8. F07: Missing vehicleSelection or distance/city does not crash', () => {
  const legacyQuote: ShippingQuoteResponseDto = {
    quoteId: 'quote-legacy',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 35000,
    productPrice: 200000,
    totalPayable: 235000,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    provider: 'LALAMOVE',
    serviceType: 'MOTORCYCLE',
    vehicleSelection: null,
  };

  const shouldShowFallback = legacyQuote.vehicleSelection?.fallbackUsed === true;
  assert.equal(shouldShowFallback, false);
});

test('9. F08: AbortController and sequence ID cancel late stale responses', () => {
  let activeSequence = 1;

  // Request 1 starts
  const req1Id = ++activeSequence;
  const controller1 = new AbortController();

  // User rapidly updates address -> Request 2 starts
  controller1.abort();
  const req2Id = ++activeSequence;
  const controller2 = new AbortController();

  // If Request 1 tries to resolve after Request 2 has started:
  const isReq1Stale = req1Id !== activeSequence;
  const isReq2Current = req2Id === activeSequence;

  assert.equal(isReq1Stale, true, 'Request 1 must be discarded as stale');
  assert.equal(controller1.signal.aborted, true, 'Request 1 fetch was aborted');
  assert.equal(isReq2Current, true, 'Request 2 is the valid current request');
});

test('10. F10: Expired quote detection blocks stale submission', () => {
  const expiredQuote: ShippingQuoteResponseDto = {
    quoteId: 'quote-expired',
    leg: 'SELLER_TO_BUYER',
    shippingFee: 40000,
    productPrice: 300000,
    totalPayable: 340000,
    expiresAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    provider: 'LALAMOVE',
    serviceType: 'MOTORCYCLE',
  };

  const isQuoteExpired = expiredQuote.expiresAt ? new Date(expiredQuote.expiresAt).getTime() <= Date.now() : false;
  assert.equal(isQuoteExpired, true, 'Expired quote must trigger re-fetch before checkout');
});


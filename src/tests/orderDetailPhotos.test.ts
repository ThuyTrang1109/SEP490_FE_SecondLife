import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderDetailPhotos } from '../components/orders/detail/OrderDetailPhotos';
import { orderFeedItemToRaw } from '../services/orderFeedService';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';

test('direct sale photo history uses the complete seller listing gallery when it loads', () => {
  const cover = '/images/product-front.jpg';
  const back = '/images/product-back.jpg';
  const closeup = '/images/product-details.jpg';
  const order = mapEscrowOrder(orderFeedItemToRaw({
    order: {
      id: 'direct-order', postId: 'post', sellerId: 'seller', buyerId: 'buyer',
      finalPrice: 280_000,
      status: 'PROCESSING', escrowStatus: 'HELD', createdAt: '2026-11-20T10:00:00Z',
    },
    inspection: null, postImageUrl: cover, buyerName: null, sellerName: null,
    categoryId: null, itemId: null, itemCondition: null,
  }), { currentListings: [], currentRole: 'seller', authoritative: true });
  const render = (sellerPostPhotos?: string[]) => renderToStaticMarkup(createElement(OrderDetailPhotos, {
    order, sellerPostPhotos, detailInspectionDto: null, activePhotoStage: 'listing',
    setActivePhotoStage: () => {}, lang: 'vi',
  }));

  const fallback = render();
  assert.match(fallback, /Người bán \(1\)/);
  assert.ok(fallback.includes(`src="${cover}"`));
  assert.equal(render([' ']), fallback);

  const gallery = render([cover, ` ${back} `, back, '', closeup]);
  assert.match(gallery, /Người bán \(3\)/);
  assert.deepEqual(Array.from(gallery.matchAll(/<img[^>]+src="([^"]+)"/g), ([, url]) => url), [cover, back, closeup]);
});

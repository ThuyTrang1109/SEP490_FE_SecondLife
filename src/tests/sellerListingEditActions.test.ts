import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SellerListingEditActions } from '../components/listing/SellerListingEditActions';
import type { SellerListingActions } from '../types';

function renderActions(actions?: SellerListingActions) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(SellerListingEditActions, {
    actions,
    lang: 'vi',
    onEdit: noop,
    onUpdateShippingPackage: noop,
    onReclassify: noop,
  }));
}

test('draft editing is offered independently of shipping package updates', () => {
  const html = renderActions({ editContent: true, updateShippingPackage: false, reclassifyItem: false });
  assert.match(html, /Sửa tin đăng/);
  assert.doesNotMatch(html, /Cập nhật kiện hàng|Chọn lại loại thiết bị/);
});

test('published listing can update its package and only shows reclassification when the server allows it', () => {
  const actions = { editContent: false, updateShippingPackage: true, reclassifyItem: false };
  const html = renderActions(actions);
  assert.match(html, /Cập nhật kiện hàng/);
  assert.doesNotMatch(html, /Sửa tin đăng|Chọn lại loại thiết bị/);
  assert.match(renderActions({ ...actions, reclassifyItem: true }), /Chọn lại loại thiết bị/);
});

test('locked and unverified listings have no edit buttons', () => {
  assert.equal(renderActions({ editContent: false, updateShippingPackage: false, reclassifyItem: false }), '');
  assert.equal(renderActions(), '');
});

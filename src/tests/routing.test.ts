import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole } from '../types';
import {
  getRoleLandingPath, getRouteAccess, getUserRoles, panelPaths, pathForTab,
  paths, resolveAppRoute, routes, safeReturnPath,
} from '../app/router/paths';
import { navigatePath, NAVIGATION_EVENT } from '../app/router/browser';

test('every registered path is unique and resolves back to its existing feature', () => {
  assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
  for (const route of routes) {
    const url = route.path.replace(/:[^/]+/g, 'test-id');
    const resolved = resolveAppRoute(url, route.role || 'buyer');
    assert.equal(resolved.tab, route.tab, url);
    assert.equal(resolved.role, route.role, url);
    assert.equal(resolved.section, route.section, url);
  }
});

for (const path of ['/', '/products', '/products/product-1', '/login', '/register', '/unauthorized']) {
  test(`anonymous users may open public route ${path}`, () => {
    assert.equal(getRouteAccess(resolveAppRoute(path), null), 'allowed');
  });
}

for (const role of ['buyer', 'seller', 'staff', 'inspector', 'inspection_center', 'admin'] as UserRole[]) {
  test(`${role} landing page requires authentication and accepts the authenticated role`, () => {
    const route = resolveAppRoute(getRoleLandingPath(role), role);
    assert.equal(getRouteAccess(route, null), 'login');
    assert.equal(getRouteAccess(route, { role }), 'allowed');
    assert.equal(getRouteAccess(route, null, true), 'loading');
    assert.equal(getRouteAccess(route, { role }, true), 'loading');
  });
}

test('buyer cannot obtain admin, staff, seller or inspector permissions from a URL', () => {
  for (const role of ['admin', 'staff', 'seller', 'inspector', 'inspection_center'] as UserRole[]) {
    assert.equal(getRouteAccess(resolveAppRoute(getRoleLandingPath(role)), { role: 'buyer' }), 'unauthorized');
  }
  assert.equal(getRouteAccess(resolveAppRoute('/seller/products'), { role: 'buyer' }), 'unauthorized');
  assert.equal(getRouteAccess(resolveAppRoute('/buyer/orders'), { role: 'buyer' }), 'allowed');
  assert.equal(getRouteAccess(resolveAppRoute('/admin/products/product-1'), { role: 'buyer' }), 'unauthorized');
});

test('role grants come from the authenticated role list rather than the displayed role', () => {
  assert.equal(getRouteAccess(resolveAppRoute('/admin/dashboard'), { role: 'admin', roles: ['BUYER'] }), 'unauthorized');
  const user = { role: 'buyer' as const, roles: ['ROLE_BUYER', 'ROLE_STAFF'] };
  assert.equal(getRouteAccess(resolveAppRoute('/staff/reports'), user), 'allowed');
  assert.equal(getRouteAccess(resolveAppRoute('/admin/dashboard'), user), 'unauthorized');
  assert.deepEqual(getUserRoles({ role: 'inspector', roles: ['HUB_INSPECTOR'] }), ['inspector']);
});

test('sellers retain their existing buyer capabilities without granting internal roles', () => {
  assert.equal(getRouteAccess(resolveAppRoute('/buyer/chat/room-1'), { role: 'seller' }), 'allowed');
  assert.equal(getRouteAccess(resolveAppRoute('/seller/products'), { role: 'seller' }), 'allowed');
  assert.equal(getRouteAccess(resolveAppRoute('/admin/users'), { role: 'seller' }), 'unauthorized');
});

test('dynamic routes preserve the exact product, order, conversation, inspection and user IDs', () => {
  for (const [url, key, expected] of [
    ['/products/product-1', 'productId', 'product-1'],
    ['/seller/products/product-1/edit', 'productId', 'product-1'],
    ['/buyer/orders/order-1', 'orderId', 'order-1'],
    ['/seller/chat/room-1', 'conversationId', 'room-1'],
    ['/inspector/inspections/inspection-1', 'inspectionId', 'inspection-1'],
    ['/buyer/inspections/inspection-1/decision', 'inspectionId', 'inspection-1'],
    ['/seller/inspections/inspection-1/decision', 'inspectionId', 'inspection-1'],
    ['/seller/inspections/23570df2-d237-4696-abda-7a0fa515ce36', 'inspectionId', '23570df2-d237-4696-abda-7a0fa515ce36'],
    ['/buyer/inspections/23570df2-d237-4696-abda-7a0fa515ce36', 'inspectionId', '23570df2-d237-4696-abda-7a0fa515ce36'],
    ['/admin/users/user-1', 'userId', 'user-1'],
  ]) assert.equal(resolveAppRoute(url).params[key], expected, url);
  assert.equal(resolveAppRoute(paths.product('space id')).params.productId, 'space id');
  assert.equal(resolveAppRoute('/seller/chat?postId=product-1').url, '/seller/chat?postId=product-1');
  assert.equal(new URL(resolveAppRoute(paths.chat('seller', 'room-1')).url, 'http://localhost').searchParams.has('postId'), false);
});

test('panel navigation maps existing sidebar sections without adding missing features', () => {
  for (const [role, panels] of Object.entries(panelPaths)) {
    for (const [section, path] of Object.entries(panels)) {
      assert.equal(resolveAppRoute(path, role as UserRole).section, section);
    }
  }
  assert.equal(resolveAppRoute('/admin/settings').tab, 'not-found');
  assert.equal(resolveAppRoute('/admin/reports').tab, 'not-found');
});

test('ambiguous legacy customer routes follow the authenticated role', () => {
  assert.equal(resolveAppRoute('/orders', 'buyer').url, '/buyer/orders');
  assert.equal(resolveAppRoute('/orders', 'seller').url, '/seller/orders');
  assert.equal(resolveAppRoute('/chat', 'seller').url, '/seller/chat');
  assert.equal(resolveAppRoute('/orders', 'inspection_center').url, '/inspection-center/orders');
});

test('legacy dynamic parameters and unrelated query strings survive canonical redirects', () => {
  assert.equal(resolveAppRoute('/orders?orderId=order-1&order_tab=shipping&ref=email', 'seller').url,
    '/seller/orders/order-1?order_tab=shipping&ref=email');
  assert.equal(resolveAppRoute('/chat?roomId=room-1&ref=email', 'buyer').url, '/buyer/chat/room-1?ref=email');
  assert.equal(resolveAppRoute('/buyer-inspection-decision?orderId=inspection-1').url,
    '/buyer/inspections/inspection-1/decision');
  assert.equal(resolveAppRoute('/seller/posts/product-1/edit').url, '/seller/products/product-1/edit');
});

test('legacy tab, hash and panel links resolve to canonical URL sections', () => {
  assert.equal(resolveAppRoute('/?tab=admin-dashboard&subtab=credit-pricing', 'admin').url, '/admin/credit-pricing');
  assert.equal(resolveAppRoute('/?tap=staff_workspace&subtab=reports-support', 'staff').url, '/staff/reports');
  assert.equal(resolveAppRoute('/#seller-dashboard', 'seller').url, '/seller/dashboard');
  assert.equal(resolveAppRoute('/?tab=buyer-inspection-decision&orderId=inspection-1').url,
    '/buyer/inspections/inspection-1/decision');
});

test('canonicalization is idempotent, including detail URLs and order filters', () => {
  const legacy = ['/orders?orderId=id&order_tab=shipping', '/chat?roomId=id', '/marketplace',
    '/?tab=orders', '/?tab=admin-dashboard&subtab=permissions', '/buyer-inspection-decision?orderId=id',
    '/buyer/orders/id?filter=inspecting', '/inspector/inspections/id'];
  for (const role of ['buyer', 'seller', 'admin', 'inspection_center'] as UserRole[]) {
    for (const url of legacy) {
      const first = resolveAppRoute(url, role);
      assert.equal(resolveAppRoute(first.url, role).url, first.url, `${role} ${url}`);
    }
  }
});

test('login return destinations retain queries but reject external and recursive auth URLs', () => {
  assert.equal(safeReturnPath('/buyer/orders/order-1?filter=shipping'), '/buyer/orders/order-1?filter=shipping');
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/login/', '/register', null]) {
    assert.equal(safeReturnPath(path), null);
  }
});

test('an anonymous legacy URL can be resolved after login using the authenticated role', () => {
  const saved = safeReturnPath('/orders?orderId=order-1&filter=shipping');
  assert.equal(resolveAppRoute(saved!, 'seller').url, '/seller/orders/order-1?filter=shipping');
  assert.equal(resolveAppRoute(saved!, 'buyer').url, '/buyer/orders/order-1?filter=shipping');
});

test('navigation pushes history, supports replacement, and ignores duplicate or foreign URLs', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events = new EventTarget();
  let url = new URL('http://localhost:3000/products');
  const entries = [url.href];
  let index = 0;
  let notifications = 0;
  events.addEventListener(NAVIGATION_EVENT, () => notifications++);
  const fakeWindow = {
    get location() { return url; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    history: {
      pushState(_state: unknown, _title: string, path: string) {
        url = new URL(path, url); entries.splice(++index); entries.push(url.href);
      },
      replaceState(_state: unknown, _title: string, path: string) {
        url = new URL(path, url); entries[index] = url.href;
      },
      back() { url = new URL(entries[--index]); events.dispatchEvent(new Event('popstate')); },
      forward() { url = new URL(entries[++index]); events.dispatchEvent(new Event('popstate')); },
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    navigatePath('/buyer/orders/order-1?filter=shipping');
    assert.equal(url.pathname, '/buyer/orders/order-1');
    assert.equal(entries.length, 2);
    navigatePath('/buyer/orders/order-1?filter=shipping');
    navigatePath('https://evil.example/admin');
    assert.equal(notifications, 1);
    navigatePath('/buyer/chat/room-1', { replace: true });
    assert.equal(entries.length, 2);
    fakeWindow.history.back();
    assert.equal(url.pathname, '/products');
    fakeWindow.history.forward();
    assert.equal(url.pathname, '/buyer/chat/room-1');
    assert.equal(resolveAppRoute(url.pathname).params.conversationId, 'room-1');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

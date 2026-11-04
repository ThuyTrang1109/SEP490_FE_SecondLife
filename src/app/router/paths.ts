import type { UserRole } from '../../types';

export interface AppRoute {
  path: string;
  tab: string;
  role?: UserRole;
  allowedRoles?: UserRole[];
  section?: string;
  modal?: 'login' | 'register' | 'forgot' | 'profile' | 'product';
}

export const panelPaths: Partial<Record<UserRole, Record<string, string>>> = {
  admin: {
    overview: '/admin/dashboard', customers: '/admin/users', 'catalog-ai': '/admin/catalog-ai',
    orders: '/admin/orders', listings: '/admin/products', withdrawals: '/admin/withdrawals',
    hubs: '/admin/hubs', 'seller-kyc': '/admin/seller-kyc', permissions: '/admin/permissions',
    'credit-pricing': '/admin/credit-pricing', 'system-wallet': '/admin/system-wallet',
    'commission-rules': '/admin/commission-rules', 'inspection-governance': '/admin/inspection-governance',
  },
  staff: {
    overview: '/staff/dashboard', 'review-listings': '/staff/products', 'proof-possession': '/staff/proof-possession',
    'reports-support': '/staff/reports', disputes: '/staff/disputes', 'refund-requests': '/staff/refunds',
    payouts: '/staff/payouts', 'monitor-transactions': '/staff/transactions', 'restrict-users': '/staff/restrictions',
  },
  inspection_center: {
    overview: '/inspection-center/dashboard', dispatch: '/inspection-center/dispatch', staff: '/inspection-center/staff',
    orders: '/inspection-center/orders', checklists: '/inspection-center/checklists', pricing: '/inspection-center/pricing',
    appeals: '/inspection-center/appeals',
  },
  inspector: {
    workbench: '/inspector/dashboard', tasks: '/inspector/inspections',
    certificates: '/inspector/certificates', standards: '/inspector/standards',
  },
};

const panelTabs: Partial<Record<UserRole, string>> = {
  admin: 'admin-dashboard', staff: 'staff-workspace', inspector: 'inspection-hub', inspection_center: 'inspection-center',
};

const customerRoutes = (role: 'buyer' | 'seller'): AppRoute[] => [
  { path: `/${role}/dashboard`, role, tab: role === 'seller' ? 'seller-dashboard' : 'home' },
  { path: `/${role}/orders`, role, tab: 'orders' },
  { path: `/${role}/orders/:orderId`, role, tab: 'orders' },
  { path: `/${role}/chat`, role, tab: 'chat' },
  { path: `/${role}/chat/:conversationId`, role, tab: 'chat' },
  { path: `/${role}/disputes`, role, tab: 'disputes' },
  { path: `/${role}/inspections`, role, tab: 'orders' },
  { path: `/${role}/inspections/:inspectionId/decision`, role, tab: 'buyer-inspection-decision' },
];

export const routeGroups: Record<string, AppRoute[]> = {
  public: [
    { path: '/', tab: 'home' }, { path: '/products', tab: 'marketplace' },
    { path: '/products/:productId', tab: 'marketplace', modal: 'product' },
    { path: '/login', tab: 'home', modal: 'login' }, { path: '/register', tab: 'home', modal: 'register' },
    { path: '/forgot-password', tab: 'home', modal: 'forgot' },
    { path: '/unauthorized', tab: 'unauthorized' }, { path: '/404', tab: 'not-found' },
  ],
  buyer: customerRoutes('buyer'),
  seller: [
    ...customerRoutes('seller'),
    { path: '/seller/products', role: 'seller', tab: 'seller-dashboard' },
    { path: '/seller/products/create', role: 'seller', tab: 'create-listing' },
    { path: '/seller/products/:productId/edit', role: 'seller', tab: 'create-listing' },
    { path: '/seller/products/:productId', role: 'seller', tab: 'seller-dashboard', modal: 'product' },
  ],
};

for (const [role, sections] of Object.entries(panelPaths)) {
  routeGroups[role] = Object.entries(sections).map(([section, path]) => ({
    path, role: role as UserRole, tab: panelTabs[role as UserRole]!, section,
  }));
}
routeGroups.admin.push({ path: '/admin/users/:userId', role: 'admin', tab: 'admin-dashboard', section: 'customers' });
routeGroups.admin.push({ path: '/admin/products/:productId', role: 'admin', tab: 'admin-dashboard', section: 'listings', modal: 'product' });
routeGroups.staff.push({ path: '/staff/products/create', role: 'staff', tab: 'create-listing' });
routeGroups.inspector.push({ path: '/inspector/inspections/:inspectionId', role: 'inspector', tab: 'inspection-hub', section: 'workbench' });
for (const role of ['buyer', 'seller', 'staff', 'inspector', 'inspection_center', 'admin'] as UserRole[]) {
  const prefix = role.replace('_', '-');
  routeGroups[role].push(
    { path: `/${prefix}/profile`, role, tab: panelTabs[role] || (role === 'seller' ? 'seller-dashboard' : 'home'), modal: 'profile' },
    { path: `/${prefix}/notifications`, role, tab: 'notifications' },
  );
}
export const routes = Object.values(routeGroups).flat();

export const paths = {
  home: '/', products: '/products', login: '/login', register: '/register', unauthorized: '/unauthorized',
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
  profile: (role: UserRole) => `/${role.replace('_', '-')}/profile`,
  chat: (role: UserRole, id?: string) => `/${role === 'seller' ? 'seller' : 'buyer'}/chat${id ? `/${encodeURIComponent(id)}` : ''}`,
  orders: (role: UserRole, id?: string) => `/${role === 'seller' ? 'seller' : 'buyer'}/orders${id ? `/${encodeURIComponent(id)}` : ''}`,
  decision: (role: UserRole, id: string) => `/${role === 'seller' ? 'seller' : 'buyer'}/inspections/${encodeURIComponent(id)}/decision`,
  editProduct: (id: string) => `/seller/products/${encodeURIComponent(id)}/edit`,
};

export function getRoleLandingPath(role: UserRole = 'buyer'): string {
  return panelPaths[role]?.[role === 'inspector' ? 'workbench' : 'overview'] || `/${role}/dashboard`;
}

export function pathForTab(tab: string, role: UserRole = 'buyer'): string {
  const map: Record<string, string> = {
    home: '/', marketplace: '/products', 'seller-dashboard': '/seller/dashboard',
    'create-listing': role === 'staff' ? '/staff/products/create' : '/seller/products/create',
    orders: role === 'inspection_center' ? '/inspection-center/orders'
      : role === 'inspector' ? '/inspector/inspections'
      : role === 'admin' ? '/admin/orders' : role === 'staff' ? '/staff/transactions' : paths.orders(role),
    chat: paths.chat(role), notifications: `/${role.replace('_', '-')}/notifications`,
    disputes: role === 'staff' ? '/staff/disputes' : `/${role === 'seller' ? 'seller' : 'buyer'}/disputes`,
    'inspection-center': '/inspection-center/dashboard',
    'inspection-hub': role === 'inspection_center' ? '/inspection-center/dashboard' : '/inspector/dashboard',
    'staff-workspace': '/staff/dashboard', 'admin-dashboard': '/admin/dashboard',
    'buyer-inspection-decision': `/${role === 'seller' ? 'seller' : 'buyer'}/inspections`,
  };
  return map[tab] || '/404';
}

export interface RouteMatch extends AppRoute {
  params: Record<string, string>;
  url: string;
}

function matchRoute(url: URL): RouteMatch | null {
  for (const route of routes) {
    const keys: string[] = [];
    const pattern = route.path.split('/').map((part) => {
      if (!part.startsWith(':')) return part;
      keys.push(part.slice(1));
      return '([^/]+)';
    }).join('/');
    const match = url.pathname.match(new RegExp(`^${pattern}/?$`));
    if (!match) continue;
    try {
      const params = Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
      return { ...route, params, url: `${url.pathname.replace(/\/$/, '') || '/'}${url.search}${url.hash}` };
    } catch { return null; }
  }
  return null;
}

export function resolveAppRoute(input: string, role: UserRole = 'buyer'): RouteMatch {
  const url = new URL(input, 'http://secondlife.local');
  const params = url.searchParams;
  const legacyTab = params.get('tab') || params.get('tap') || url.hash.replace(/^#\/?/, '');
  const rootLegacyTab = url.pathname === '/' && Boolean(legacyTab);
  let target: string | undefined;
  if (url.pathname === '/' && legacyTab) {
    target = pathForTab(legacyTab.replace(/_/g, '-'), role);
    if (legacyTab.replace(/_/g, '-') === 'buyer-inspection-decision' && params.get('orderId')) {
      target = paths.decision(role, params.get('orderId')!);
    }
  }
  const decodePart = (part: string) => { try { return decodeURIComponent(part); } catch { return part; } };
  const aliases: Record<string, string> = {
    '/marketplace': '/products', '/home': '/', '/orders': pathForTab('orders', role),
    '/chat': pathForTab('chat', role), '/negotiations': pathForTab('chat', role),
    '/notifications': pathForTab('notifications', role), '/disputes': pathForTab('disputes', role),
    '/seller-dashboard': '/seller/dashboard', '/seller/posts': '/seller/products',
    '/create-listing': pathForTab('create-listing', role), '/admin-dashboard': '/admin/dashboard',
    '/staff-workspace': '/staff/dashboard', '/inspection-hub': pathForTab('inspection-hub', role),
    '/inspector': '/inspector/dashboard', '/inspections': pathForTab('inspection-hub', role),
    '/inspector-center': '/inspection-center/dashboard', '/inspection-center': '/inspection-center/dashboard',
    '/buyer': '/buyer/dashboard', '/seller': '/seller/dashboard', '/staff': '/staff/dashboard', '/admin': '/admin/dashboard',
    '/buyer-inspection-decision': params.get('orderId') || params.get('id')
      ? paths.decision(role, params.get('orderId') || params.get('id')!) : pathForTab('orders', role),
  };
  target ||= aliases[url.pathname.replace(/\/$/, '')];
  const oldOrder = url.pathname.match(/^\/orders?\/([^/]+)$/);
  if (oldOrder) target = paths.orders(role, decodePart(oldOrder[1]));
  const oldInspection = url.pathname.match(/^\/(?:buyer\/inspections|inspections|inspection\/orders|inspector\/orders)\/([^/]+)$/);
  if (oldInspection) {
    const id = decodePart(oldInspection[1]);
    target = role === 'inspector' ? `/inspector/inspections/${encodeURIComponent(id)}`
      : role === 'inspection_center' ? '/inspection-center/orders' : paths.decision(role, id);
  }
  const oldEdit = url.pathname.match(/^\/seller\/posts\/([^/]+)\/edit$/);
  if (oldEdit) target = paths.editProduct(decodePart(oldEdit[1]));
  const oldSellerPost = url.pathname.match(/^\/seller\/posts\/([^/]+)$/);
  if (oldSellerPost) target = `/seller/products/${encodeURIComponent(decodePart(oldSellerPost[1]))}`;
  if (/^\/(posts|listing)\/[^/]+$/.test(url.pathname)) target = paths.product(decodePart(url.pathname.split('/')[2]));
  if (target) {
    url.pathname = target;
    if (rootLegacyTab) {
      params.delete('tab'); params.delete('tap'); url.hash = '';
    }
  }
  let route = matchRoute(url);
  // Legacy deep links carried selected rows and panel tabs in their query string.
  if (route?.role && panelPaths[route.role] && params.get('subtab')) {
    const subtab = params.get('subtab')!.replace(/_/g, '-');
    const sectionPath = panelPaths[route.role]?.[subtab];
    if (sectionPath) { url.pathname = sectionPath; params.delete('subtab'); route = matchRoute(url); }
  }
  if (route?.tab === 'orders' && params.get('orderId') && !route.params.orderId) {
    url.pathname = paths.orders(route.role || role, params.get('orderId')!);
    params.delete('orderId');
    route = matchRoute(url);
  }
  if (route?.tab === 'chat' && (params.get('roomId') || params.get('conversationId')) && !route.params.conversationId) {
    url.pathname = paths.chat(route.role || role, params.get('roomId') || params.get('conversationId')!);
    params.delete('roomId'); params.delete('conversationId');
    route = matchRoute(url);
  }
  if (route?.tab === 'buyer-inspection-decision') {
    params.delete('orderId'); params.delete('id');
    route = matchRoute(url);
  }
  if (route?.params.orderId) { params.delete('orderId'); route = matchRoute(url); }
  if (route?.params.conversationId) {
    params.delete('roomId'); params.delete('conversationId'); route = matchRoute(url);
  }
  return route || { path: '/404', tab: 'not-found', params: {}, url: `${url.pathname}${url.search}${url.hash}` };
}

export function getUserRoles(user: { role: UserRole; roles?: string[] } | null): UserRole[] {
  if (!user) return [];
  const knownRoles: UserRole[] = ['buyer', 'seller', 'staff', 'inspector', 'inspection_center', 'admin'];
  const actual = (user.roles?.length ? user.roles : [user.role]).map((value) =>
    value.toLowerCase().replace(/^role_/, '').replace(/^hub_inspector$/, 'inspector'));
  const roles = knownRoles.filter((value) => actual.includes(value));
  // Sellers already participate as buyers in the existing marketplace and chat.
  if (roles.includes('seller') && !roles.includes('buyer')) roles.push('buyer');
  return roles;
}

export function getRouteAccess(route: RouteMatch, user: { role: UserRole; roles?: string[] } | null, restoring = false) {
  if (restoring && route.role) return 'loading';
  if (!route.role) return 'allowed';
  if (!user) return 'login';
  return (route.allowedRoles || [route.role]).some((role) => getUserRoles(user).includes(role)) ? 'allowed' : 'unauthorized';
}

export function safeReturnPath(input: string | null): string | null {
  if (!input || !input.startsWith('/') || input.startsWith('//') || input.includes('\\')) return null;
  const url = new URL(input, 'http://secondlife.local');
  return url.origin === 'http://secondlife.local' && !['/login', '/register', '/forgot-password'].includes(url.pathname.replace(/\/+$/, ''))
    ? `${url.pathname}${url.search}${url.hash}` : null;
}

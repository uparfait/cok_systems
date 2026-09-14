import { getStoredNavigation } from './navigationService';
import { getNavigationByPermissions, getRoleSlug, type NavItem } from '../components/Layout/layoutUtils';
import type { User } from '../contexts/AuthContext';

export const UI_FORBIDDEN_MESSAGE = 'UI::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE';
export const BC_FORBIDDEN_MESSAGE = 'BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE';
export const SESSION_EXPIRED_MESSAGE = 'YOUR SESSION HAS EXPIRED. LOGIN AGAIN.';
export const SESSION_REJECTED_MESSAGE = 'YOUR SESSION WAS NOT ACCEPTED. LOGIN AGAIN.';

export const FORCED_LOGOUT_NOTICE_KEY = 'forced_logout_notice';
export const FORCED_LOGOUT_EVENT = 'auth:forced-logout';

const AUTH_STORAGE_KEYS = ['userData', 'accessToken', 'refreshToken', 'navData', 'isAuthenticated', 'pendingUserId', 'pendingEmail'];

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/dcs-form/',
  '/dcs-approval/',
  '/dcs-batch-approval/',
  '/upcoming',
  '/book-a-room',
  '/live/',
  '/event/',
  '/feedback',
];

const DEFAULT_ROLE_SLUGS = ['system-admin', 'receptionist', 'employee', 'department-manager', 'gate-officer', 'event-manager', 'mayor'];

export const isPublicPath = (pathname: string): boolean => {
  if (pathname === '/' || pathname === '') return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
};

export const isForbiddenResponse = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  if (data.forbidden_resource === true) return true;
  return typeof data.message === 'string' && data.message.startsWith('BC:::');
};

const readTokenExpiry = (token: string | null): number | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const isStoredTokenExpired = (): boolean => {
  try {
    const expiry = readTokenExpiry(localStorage.getItem('accessToken'));
    return expiry === null || expiry <= Date.now();
  } catch {
    return true;
  }
};

export const sessionEndedNotice = (data: any): string => {
  if (isStoredTokenExpired()) return SESSION_EXPIRED_MESSAGE;
  const detail = [data?.message, data?.error]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' - ');
  return detail ? `${SESSION_REJECTED_MESSAGE} ${detail}` : SESSION_REJECTED_MESSAGE;
};

export const consumeForcedLogoutNotice = (): string | null => {
  try {
    const notice = sessionStorage.getItem(FORCED_LOGOUT_NOTICE_KEY);
    if (notice) sessionStorage.removeItem(FORCED_LOGOUT_NOTICE_KEY);
    return notice;
  } catch {
    return null;
  }
};

export const clearClientAuth = (): void => {
  try {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch { /* storage unavailable */ }
  try {
    const notice = sessionStorage.getItem(FORCED_LOGOUT_NOTICE_KEY);
    sessionStorage.clear();
    if (notice) sessionStorage.setItem(FORCED_LOGOUT_NOTICE_KEY, notice);
  } catch { /* storage unavailable */ }
};

let forcedLogoutInFlight = false;

export const forceLogout = (notice: string): void => {
  if (forcedLogoutInFlight) return;
  forcedLogoutInFlight = true;
  try { sessionStorage.setItem(FORCED_LOGOUT_NOTICE_KEY, notice); } catch { /* ignore */ }
  clearClientAuth();
  window.dispatchEvent(new CustomEvent(FORCED_LOGOUT_EVENT, { detail: { notice } }));
  window.setTimeout(() => {
    forcedLogoutInFlight = false;
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, 400);
};

const collectTokens = (items: NavItem[], tokens: Set<string>): void => {
  items.forEach((item) => {
    tokens.add(`link:${item.id}`);
    (item.children || []).forEach((child) => tokens.add(`child:${item.id}:${child.id}`));
  });
};

export const buildAccessTokens = (user: User | null): { tokens: Set<string>; slug: string } | null => {
  const nav = getStoredNavigation();
  if (!nav || !user) return null;
  const slug = (nav.role_slug || getRoleSlug(user.role)).toLowerCase();
  const tokens = new Set<string>(['auth', `slug:${slug}`]);
  collectTokens(getNavigationByPermissions(user), tokens);
  return { tokens, slug };
};

const ADMIN_FALLBACK = 'slug:system-admin';

const SECTION_REQUIREMENTS: Record<string, string[]> = {
  overview: ['child:admin:overview', 'slug:mayor', ADMIN_FALLBACK],
  departments: ['child:admin:departments', ADMIN_FALLBACK],
  employees: ['child:admin:employees', ADMIN_FALLBACK],
  'user-management': ['child:admin:user-management', ADMIN_FALLBACK],
  'roles-management': ['child:admin:roles-management', ADMIN_FALLBACK],
  'system-audit': ['child:admin:system-audit', ADMIN_FALLBACK],
  'storage-management': ['child:admin:storage-management', ADMIN_FALLBACK],
  analytics: ['link:admin', 'link:service-delivery', ADMIN_FALLBACK],
  feedback: ['link:admin', 'link:service-delivery', ADMIN_FALLBACK],
  'smart-parking': ['link:smart-parking', 'slug:gate-officer', ADMIN_FALLBACK],
  'checkin-vehicle': ['link:check-in', 'link:check-out', 'link:smart-parking', 'slug:gate-officer'],
  'checkout-vehicle': ['link:check-in', 'link:check-out', 'link:smart-parking', 'slug:gate-officer'],
  'checkin-person': ['link:check-in', 'link:check-out', 'slug:gate-officer'],
  'checkout-person': ['link:check-in', 'link:check-out', 'slug:gate-officer'],
  'service-delivery': ['link:service-delivery', 'link:admin', ADMIN_FALLBACK],
  tasks: ['link:task-manager'],
  followups: ['link:task-manager'],
  rooms: ['link:rooms'],
  events: ['link:events', 'slug:mayor'],
  'booking-requests': ['link:booking-requests'],
  actions: ['slug:mayor'],
  'feedback-analysis': ['link:feedback-analysis', 'slug:mayor'],
  visitors: ['link:visitors', 'link:assigned-visitors', 'link:my-employees', 'link:service-delivery', 'slug:receptionist', 'slug:employee', 'slug:department-manager', ADMIN_FALLBACK],
  assigned: ['link:assigned-visitors', 'link:visitors', 'slug:receptionist'],
  'all-visitors': ['link:visitors', 'slug:employee'],
  requests: ['link:requests', 'slug:receptionist', 'slug:department-manager', ADMIN_FALLBACK],
  hod: ['link:my-employees', 'link:hod-feedback', 'slug:department-manager'],
};

export interface RouteAccessResult {
  allowed: boolean;
  reason?: string;
}

export const evaluateRouteAccess = (pathname: string, user: User | null): RouteAccessResult => {
  if (isPublicPath(pathname)) return { allowed: true };
  if (!user) return { allowed: false, reason: 'not_authenticated' };

  const access = buildAccessTokens(user);
  if (!access) return { allowed: true };

  const has = (requirements: string[]) => requirements.some((requirement) => access.tokens.has(requirement));
  const segments = pathname.split('/').filter(Boolean);
  const [first, second] = segments;

  if (!first) return { allowed: true };
  if (first === 'calendar' || first === 'dcs-my-approvals') return { allowed: true };
  if (first === 'dcs-system') {
    return has(['link:dcs']) ? { allowed: true } : { allowed: false, reason: 'dcs' };
  }

  if (DEFAULT_ROLE_SLUGS.includes(first) && first !== access.slug) {
    return { allowed: false, reason: `role:${first}` };
  }

  if (!second) return { allowed: true };
  const requirements = SECTION_REQUIREMENTS[second];
  if (!requirements) return { allowed: true };
  return has(requirements) ? { allowed: true } : { allowed: false, reason: second };
};

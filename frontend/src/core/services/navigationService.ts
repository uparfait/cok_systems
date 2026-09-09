import { get } from './apiClient';

// Navigation payload served by the backend: the sidebar links for the
// user's role, the role slug used in routes, and the landing route.

export interface NavLink {
  id: string;
  label: string;
  path: string;
  icon: string;
  permission?: string;
  children?: NavLink[];
}

export interface StoredNavigation {
  role_name: string;
  role_slug: string;
  is_default: boolean;
  default_route: string;
  links: NavLink[];
  nav_version: string;
}

const NAV_KEY = 'navData';
export const NAV_UPDATED_EVENT = 'nav:updated';

export const getStoredNavigation = (): StoredNavigation | null => {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.links)) return null;
    return parsed as StoredNavigation;
  } catch {
    return null;
  }
};

export const saveNavigation = (nav: StoredNavigation | null | undefined): void => {
  if (!nav || !Array.isArray(nav.links)) return;
  try {
    const previous = localStorage.getItem(NAV_KEY);
    const next = JSON.stringify(nav);
    localStorage.setItem(NAV_KEY, next);
    if (previous !== next) {
      window.dispatchEvent(new CustomEvent(NAV_UPDATED_EVENT, { detail: nav }));
    }
  } catch {
    // storage unavailable: the sidebar falls back to the built-in role links
  }
};

export const clearNavigation = (): void => {
  try { localStorage.removeItem(NAV_KEY); } catch { /* ignore */ }
};

// Fetches the caller's navigation from the backend and stores it. Called on
// every page load so a changed role (or edited custom role) takes effect
// without re-login.
export const refreshNavigation = async (): Promise<StoredNavigation | null> => {
  try {
    const res: any = await get('/roles/navigation');
    const nav = res?.data;
    if (nav && Array.isArray(nav.links)) {
      saveNavigation(nav);
      return nav as StoredNavigation;
    }
    return null;
  } catch (err) {
    console.error('Navigation refresh failed:', err);
    return null;
  }
};

export const navigationCatalogService = {
  getDefaults: () => get('/roles/defaults'),
  getLinksCatalog: () => get('/roles/links-catalog'),
};

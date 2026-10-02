import { useEffect, useMemo, useState } from 'react';
import { get } from '../../services/apiClient';
import type { SidebarLink } from './layoutUtils';

const CHANGED_EVENT = 'cok:legacy-data-changed';
const RECHECK_MS = 5 * 60 * 1000;

let known: { exists: boolean; at: number } | null = null;
let pending: Promise<boolean> | null = null;

const isLegacyLink = (link: SidebarLink) => link.id === 'legacy-data' || /\/legacy-data$/.test(link.path || '');

const containsLegacyLink = (links: SidebarLink[]): boolean =>
  links.some((link) => isLegacyLink(link) || containsLegacyLink(link.children || []));

const withoutLegacyLink = (links: SidebarLink[]): SidebarLink[] =>
  links
    .filter((link) => !isLegacyLink(link))
    .map((link) => (link.children ? { ...link, children: withoutLegacyLink(link.children) } : link));

const checkLegacyData = (): Promise<boolean> => {
  if (known && Date.now() - known.at < RECHECK_MS) return Promise.resolve(known.exists);
  if (!pending) {
    pending = get('/legacy-data/exists')
      .then((response: any) => {
        known = { exists: !!response?.exists, at: Date.now() };
        return known.exists;
      })
      .catch(() => false)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
};

export const rememberLegacyData = (exists: boolean) => {
  known = { exists, at: Date.now() };
  window.dispatchEvent(new Event(CHANGED_EVENT));
};

export function useLegacyDataLink(links: SidebarLink[]): SidebarLink[] {
  const hasLink = useMemo(() => containsLegacyLink(links), [links]);
  const [exists, setExists] = useState<boolean>(() => !!known?.exists);

  useEffect(() => {
    if (!hasLink) return undefined;
    let alive = true;
    const refresh = () => {
      checkLegacyData().then((value) => {
        if (alive) setExists(value);
      });
    };
    refresh();
    window.addEventListener(CHANGED_EVENT, refresh);
    const timer = window.setInterval(refresh, RECHECK_MS);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [hasLink]);

  return useMemo(() => (hasLink && !exists ? withoutLegacyLink(links) : links), [links, hasLink, exists]);
}

export default useLegacyDataLink;

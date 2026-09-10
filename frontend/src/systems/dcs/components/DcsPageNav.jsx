import React, { useLayoutEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const EDGE_KEEP_VISIBLE_PX = 16;

export function find_active_nav_key(items, base_path, pathname, fallback_key) {
  const match = items.find((item) => {
    if (!item.path) return false;
    const item_path = `${base_path}/${item.path}`;
    return pathname === item_path || pathname.startsWith(`${item_path}/`);
  });
  return match ? match.key : fallback_key;
}

export default function DcsPageNav({ items, activeKey, labelKey, onSelect }) {
  const { translate } = useDcsLanguage();
  const list_ref = useRef(null);
  const link_refs = useRef(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const list = list_ref.current;
      const active_link = link_refs.current.get(activeKey);
      if (!list || !active_link) return;

      const next_left = active_link.offsetLeft;
      const next_width = active_link.offsetWidth;
      setIndicator((previous) =>
        previous.left === next_left && previous.width === next_width
          ? previous
          : { left: next_left, width: next_width },
      );

      const visible_start = list.scrollLeft;
      const visible_end = visible_start + list.clientWidth;
      if (next_left < visible_start) {
        list.scrollTo({ left: Math.max(next_left - EDGE_KEEP_VISIBLE_PX, 0), behavior: "smooth" });
      } else if (next_left + next_width > visible_end) {
        list.scrollTo({
          left: next_left + next_width - list.clientWidth + EDGE_KEEP_VISIBLE_PX,
          behavior: "smooth",
        });
      }
    };

    measure();

    const list = list_ref.current;
    if (!list || typeof window.ResizeObserver !== "function") return undefined;
    const observer = new window.ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeKey, items]);

  const register_link = (key) => (element) => {
    if (element) {
      link_refs.current.set(key, element);
    } else {
      link_refs.current.delete(key);
    }
  };

  return (
    <nav className="dcs-page-nav" aria-label={translate(labelKey)}>
      <div className="dcs-page-nav-list" ref={list_ref}>
        {items.map((item) => {
          const is_active = item.key === activeKey;
          return (
            <button
              key={item.key}
              ref={register_link(item.key)}
              type="button"
              aria-current={is_active ? "page" : undefined}
              className={`dcs-page-nav-link${is_active ? " is-active" : ""}`}
              onClick={() => onSelect(item)}
            >
              {translate(item.labelKey)}
            </button>
          );
        })}
        <span className="dcs-page-nav-indicator" style={{ left: indicator.left, width: indicator.width }} />
      </div>
    </nav>
  );
}

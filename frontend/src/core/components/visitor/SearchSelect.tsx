import React, { useEffect, useRef, useState } from 'react';

export interface SearchSelectOption {
  id: string;
  name: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
}

const SearchSelect: React.FC<SearchSelectProps> = ({ options, value, onChange, placeholder = 'Type to search', disabled = false, loading = false, emptyText = 'No options' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const byKeyboard = useRef(false);

  const chosen = options.find((o) => o.id === value) || null;
  const needle = query.trim().toLowerCase();
  const matches = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;
  const activeIndex = matches.length ? Math.min(active, matches.length - 1) : 0;

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled]);

  useEffect(() => {
    if (!open || !byKeyboard.current || !listRef.current) return;
    byKeyboard.current = false;
    const row = listRef.current.children[activeIndex] as HTMLElement | undefined;
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    setActive(Math.max(options.findIndex((o) => o.id === value), 0));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (option: SearchSelectOption | null) => {
    onChange(option ? option.id : '');
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      byKeyboard.current = true;
      if (!open) {
        openList();
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(matches.length ? Math.min(Math.max(activeIndex + step, 0), matches.length - 1) : 0);
      return;
    }
    if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (matches[activeIndex]) pick(matches[activeIndex]);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  const showClear = !!chosen && !disabled && !loading;

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={`cok-auth-input w-full py-2.5 px-3 text-sm ${showClear || loading ? 'pr-16!' : ''}`}
        value={open ? query : chosen ? chosen.name : ''}
        placeholder={open && chosen ? chosen.name : placeholder}
        disabled={disabled || loading}
        onFocus={openList}
        onClick={openList}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {loading ? <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[#056daa] border-t-transparent" /> : null}
      {showClear ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#056daa] hover:underline cursor-pointer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(null)}
        >
          Clear
        </button>
      ) : null}
      {open ? (
        <ul ref={listRef} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto border border-gray-300 bg-white shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{needle ? `No match for "${query.trim()}"` : emptyText}</li>
          ) : matches.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              className={`px-3 py-2 text-sm cursor-pointer ${i === activeIndex ? 'bg-[#056daa]/10 text-[#056daa]' : 'text-gray-900'} ${o.id === value ? 'font-semibold' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              {o.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default SearchSelect;

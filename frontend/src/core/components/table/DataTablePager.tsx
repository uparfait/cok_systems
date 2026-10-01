import React, { useEffect, useState } from 'react';

interface DataTablePagerProps {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}

const BUTTON = 'px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide border border-gray-300 bg-white text-gray-700 hover:border-[#056daa] hover:text-[#056daa] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

const DataTablePager: React.FC<DataTablePagerProps> = ({ page, pages, onPage, disabled = false }) => {
  const [draft, setDraft] = useState(String(page));

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  const jump = (raw: string) => {
    const target = Math.min(pages, Math.max(1, parseInt(raw, 10) || 1));
    setDraft(String(target));
    if (target !== page) onPage(target);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={BUTTON} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <div className="flex items-center gap-1.5 text-[12px] text-gray-600 font-medium">
        <span>Page</span>
        <input
          type="number"
          min={1}
          max={pages}
          value={draft}
          aria-label="Page number"
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => jump(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              jump((e.target as HTMLInputElement).value);
            }
          }}
          className="w-14 text-center border border-gray-300 px-1 py-1 text-[12px]"
        />
        <span>of {pages}</span>
      </div>
      <button type="button" className={BUTTON} disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
};

export default DataTablePager;

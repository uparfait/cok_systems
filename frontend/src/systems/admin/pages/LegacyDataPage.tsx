import React, { useCallback, useEffect, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import apiClient from '../../../core/services/apiClient';
import { useToast } from '../../../core/contexts/ToastContext';
import { failureOf, formatDateTime } from '../../../core/components/visitor/visitorApi';
import { rememberLegacyData } from '../../../core/components/Layout/useLegacyDataLink';

interface LegacyCollection {
  key: string;
  label: string;
  count: number;
  sample: Record<string, unknown>[];
}

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
};

const LegacyDataPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<LegacyCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, number> | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/legacy-data/scan');
      const data = (response.data?.data || []) as LegacyCollection[];
      setItems(data);
      rememberLegacyData(data.some((d) => d.count > 0));
      setSelected(new Set(data.filter((d) => d.count > 0).map((d) => d.key)));
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const total = items.reduce((sum, item) => sum + item.count, 0);
  const chosenCount = items.filter((i) => selected.has(i.key)).reduce((sum, i) => sum + i.count, 0);

  const remove = async () => {
    setDeleting(true);
    try {
      const response = await apiClient.post('/legacy-data/delete', { collections: [...selected], confirm });
      setLastResult(response.data?.data?.deleted || null);
      showSuccess(response.data?.message || 'Old records deleted');
      setConfirm('');
      await scan();
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setDeleting(false);
    }
  };

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className="p-3 sm:p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Legacy Data</h1>
          <p className="text-xs text-gray-500 max-w-3xl">
            Records saved before visitors had their own registry keep personal details inside visits and parking records instead of a visitor reference. They do not appear correctly in the new screens. Review them here and delete them.
          </p>
        </div>
        <button type="button" className="cok-btn-outlined" disabled={loading || deleting} onClick={scan}>{loading ? 'Scanning...' : 'Scan again'}</button>
      </div>

      {lastResult ? (
        <div className="border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          Deleted: {Object.entries(lastResult).map(([key, n]) => `${key.replace(/_/g, ' ')} ${n}`).join(', ')}. Parking counters and in-house flags were recalculated.
        </div>
      ) : null}

      {loading && items.length === 0 ? <p className="text-sm text-gray-500">Scanning the database...</p> : null}
      {!loading && total === 0 ? (
        <div className="border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">No record of the old structure was found. Everything uses the new visitor registry.</div>
      ) : null}

      {items.filter((item) => item.count > 0).map((item) => {
        const keys = Array.from(new Set(item.sample.flatMap((row) => Object.keys(row)).filter((k) => k !== '_id')));
        return (
          <section key={item.key} className="bg-white border border-gray-200 p-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.has(item.key)} disabled={deleting} onChange={() => toggle(item.key)} />
              <span className="text-sm font-semibold text-gray-900">{item.label}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 border border-red-200 bg-red-50 text-red-700">{item.count}</span>
            </label>
            {item.sample.length > 0 ? (
              <div className="cok-table-scroll border border-gray-100" style={{ ['--cok-table-max-h' as string]: '220px' } as React.CSSProperties}>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {keys.map((k) => <th key={k} className="px-3 py-2 font-semibold uppercase tracking-wide text-gray-600">{k.replace(/_/g, ' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {item.sample.map((row, index) => (
                      <tr key={String(row._id || index)} className="border-t border-gray-100">
                        {keys.map((k) => <td key={k} className="px-3 py-1.5 text-gray-700">{show(row[k])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {item.count > item.sample.length ? <p className="text-xs text-gray-500">Showing {item.sample.length} of {item.count}.</p> : null}
          </section>
        );
      })}

      {total > 0 ? (
        <section className="bg-white border border-red-200 p-3 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-red-700">Delete the selected old records ({chosenCount})</h2>
          <p className="text-xs text-gray-600">This cannot be undone. Type DELETE to confirm.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              disabled={deleting}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              className="border border-gray-300 px-3 py-2 text-sm w-48"
            />
            <button
              type="button"
              disabled={deleting || confirm.trim() !== 'DELETE' || selected.size === 0}
              onClick={remove}
              className="cok-btn-outlined-danger inline-flex items-center gap-2"
              aria-label="Delete the selected old records"
            >
              <FiTrash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default LegacyDataPage;

import React from 'react';
import { useVisitorPanel, visitorIdOf } from '../../../../core/components/visitor/VisitorPanelProvider';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';

export interface WaitingVisit {
  _id: string;
  visitor_id?: string | null;
  visitor?: { _id?: string } | string | null;
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  identification?: { id_type?: string; number?: string } | null;
  N_visits?: number;
  entry_date?: string;
  current_duration?: string;
  is_near_limit?: boolean;
  is_over_limit?: boolean;
  vehicle_storage?: { has_vehicle?: boolean; vehicle_details?: { plate_number?: string } } | null;
}

interface ReceptionistWaitingVisitorsProps {
  rows: WaitingVisit[];
  total: number;
  loading: boolean;
  onOpenVisitorsPage: () => void;
}

const HEADERS = ['Full name', 'ID type', 'ID number', 'Telephone', 'Email', 'Gender', 'Visits', 'Entered', 'Time inside', 'Vehicle'];

const durationClass = (row: WaitingVisit): string => {
  if (row.is_over_limit) return 'text-red-600 font-semibold';
  if (row.is_near_limit) return 'text-amber-600 font-semibold';
  return 'text-gray-700';
};

const ReceptionistWaitingVisitors: React.FC<ReceptionistWaitingVisitorsProps> = ({ rows, total, loading, onOpenVisitorsPage }) => {
  const { openVisitor } = useVisitorPanel();

  return (
    <div className="bg-white border border-gray-200" style={{ borderRadius: 0, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Waiting for a department ({total})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Click a visitor to see their details and send them to a department. Register new visitors on the Visitors page.
          </p>
        </div>
        <button type="button" className="cok-btn-outlined" onClick={onOpenVisitorsPage}>
          Visitors page
        </button>
      </div>
      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: '#056daa', borderTopColor: 'transparent' }}></div>
        </div>
      ) : rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-xs text-gray-500">No visitor is waiting for a department.</div>
      ) : (
        <div className="cok-table-scroll" style={{ ['--cok-table-max-h' as string]: '50vh' } as React.CSSProperties}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {HEADERS.map((header) => (
                  <th key={header} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 border-b border-gray-200">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const plate = row.vehicle_storage?.has_vehicle ? row.vehicle_storage?.vehicle_details?.plate_number : '';
                return (
                  <tr
                    key={row._id}
                    onClick={() => openVisitor(visitorIdOf(row))}
                    className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
                  >
                    <td className="px-3 py-2 font-semibold text-gray-900">{row.full_name || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.identification?.id_type || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.identification?.number || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.telephone || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.email || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.gender || '-'}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{row.N_visits ?? 0}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDateTime(row.entry_date)}</td>
                    <td className={`px-3 py-2 ${durationClass(row)}`}>{row.current_duration || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{plate || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && total > rows.length ? (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
          Showing the latest {rows.length} of {total}. Open the Visitors page to see everyone.
        </div>
      ) : null}
    </div>
  );
};

export default ReceptionistWaitingVisitors;

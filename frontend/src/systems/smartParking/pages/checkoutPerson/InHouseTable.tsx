import React from 'react';
import { FiClock, FiLogOut, FiSearch, FiUser } from 'react-icons/fi';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import type { GateAction, InHouseVisit } from './types';
import { ACTION_LABEL, actionFor, dash, hasVehicle, plateOf } from './types';

const PRIMARY = '#056daa';
const SUCCESS = '#4CAF50';
const DANGER = '#E74C3C';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const GRAY_DISABLED = '#9E9E9E';
const TEXT = '#555555';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const COLUMNS = [
  'Action',
  'Full name',
  'Badge',
  'ID type',
  'ID number',
  'Telephone',
  'Email',
  'Gender',
  'Visits',
  'Entry time',
  'Vehicle plate',
  'Status',
  'Duration',
];

const ACTION_CLASS: Record<GateAction, string> = {
  checkout: 'cok-btn-outlined-danger',
  leave: 'cok-btn-outlined',
  return: 'cok-btn-primary w-auto!',
};

const headStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: WHITE,
};

interface InHouseTableProps {
  rows: InHouseVisit[];
  loading: boolean;
  searching: boolean;
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  onAction: (row: InHouseVisit) => void;
}

const MessageRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr>
    <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
      {children}
    </td>
  </tr>
);

const StatusBadge: React.FC<{ out: boolean }> = ({ out }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${out ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}
    style={{ borderRadius: 0 }}
  >
    {out ? 'Stepped out' : 'Inside'}
  </span>
);

const InHouseTable: React.FC<InHouseTableProps> = ({ rows, loading, searching, total, page, pages, onPage, onAction }) => {
  const renderBody = () => {
    if (loading) {
      return (
        <MessageRow>
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
            {searching ? 'Searching...' : 'Loading...'}
          </div>
        </MessageRow>
      );
    }
    if (rows.length === 0) {
      return (
        <MessageRow>
          <div className="flex flex-col items-center gap-1">
            <FiSearch className="w-6 h-6" style={{ color: GRAY_DISABLED }} />
            <span>{searching ? 'No records found' : 'No visitors in house'}</span>
          </div>
        </MessageRow>
      );
    }
    return rows.map((row, index) => {
      const action = actionFor(row);
      const vehicle = hasVehicle(row);
      return (
        <tr key={row._id || index} className="hover:bg-[rgba(5,109,170,0.06)] transition-colors duration-200">
          <td className="px-3 py-2.5">
            <button
              type="button"
              onClick={() => onAction(row)}
              className={`${ACTION_CLASS[action]} inline-flex items-center gap-1 px-3! py-1!`}
            >
              <FiLogOut className="w-3.5 h-3.5" />
              {ACTION_LABEL[action]}
            </button>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 0 }}>
                <FiUser className="w-4 h-4" style={{ color: SUCCESS }} />
              </div>
              <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{dash(row.full_name)}</span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{row.badge_number || '_____'}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{dash(row.identification?.id_type)}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{dash(row.identification?.number)}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{dash(row.telephone)}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{dash(row.email)}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{dash(row.gender)}</td>
          <td className="px-3 py-2.5 text-sm text-center" style={{ color: TEXT }}>{row.N_visits ?? 0}</td>
          <td className="px-3 py-2.5 text-sm" style={{ color: TEXT }}>{formatDateTime(row.entry_date)}</td>
          <td className="px-3 py-2.5">
            <span className="font-medium text-sm" style={{ color: vehicle ? PRIMARY : GRAY_DISABLED }}>
              {vehicle ? plateOf(row) || '-' : 'No vehicle'}
            </span>
          </td>
          <td className="px-3 py-2.5">
            <StatusBadge out={!!row.marked_as_out} />
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-medium px-2 py-0.5"
                style={row.is_over_limit
                  ? { backgroundColor: 'rgba(231,76,60,0.1)', color: DANGER, borderRadius: 0 }
                  : { backgroundColor: NEUTRAL_LIGHT, color: TEXT, borderRadius: 0 }}
              >
                {dash(row.current_duration)}
              </span>
              {row.is_over_limit ? <FiClock className="w-3.5 h-3.5" style={{ color: DANGER }} title="Over time" /> : null}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="flex flex-col" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
      <div className="cok-table-scroll" style={{ ['--cok-table-max-h' as string]: 'calc(100vh - 230px)' } as React.CSSProperties}>
        <table className="w-full min-w-[1200px]">
          <thead style={{ backgroundColor: PRIMARY }}>
            <tr>
              {COLUMNS.map((label) => (
                <th key={label} className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ ...headStyle, backgroundColor: PRIMARY }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">{renderBody()}</tbody>
        </table>
      </div>

      <div className="px-2 py-2 flex flex-wrap justify-between items-center gap-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderTop: `1px solid ${BORDER}` }}>
        <p className="text-xs" style={{ color: TEXT }}>
          Showing {rows.length} of {total} results
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1 || loading}
            className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm py-1 px-3" style={{ color: TEXT }}>
            Page {page} of {pages || 1}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages || loading}
            className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default InHouseTable;

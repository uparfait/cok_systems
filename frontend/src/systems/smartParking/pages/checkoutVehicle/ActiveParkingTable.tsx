import React from 'react';
import { FiClock, FiLogOut } from 'react-icons/fi';
import DriverTypeBadge from './DriverTypeBadge';
import type { ParkingRow } from './parkingRows';
import { formatParkingDate, idNumberOf, idTypeOf } from './parkingRows';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const TEXT = '#555555';
const GRAY_DISABLED = '#9E9E9E';
const WHITE = '#FFFFFF';
const fontHeading = "'Montserrat', sans-serif";

const HEADERS = ['Action', 'Plate Number', 'Badge', 'Full name', 'ID type', 'ID number', 'Telephone', 'Email', 'Gender', 'Visits', 'Type', 'Check-in', 'Duration'];

interface ActiveParkingTableProps {
  rows: ParkingRow[];
  loading: boolean;
  loadingText: string;
  onCheckout: (row: ParkingRow) => void;
}

const MessageRow: React.FC<{ text: string; color?: string }> = ({ text, color = GRAY_DISABLED }) => (
  <tr>
    <td colSpan={HEADERS.length} className="px-3 py-8 text-center text-sm" style={{ color }}>
      {text}
    </td>
  </tr>
);

const ActiveParkingTable: React.FC<ActiveParkingTableProps> = ({ rows, loading, loadingText, onCheckout }) => (
  <div className="cok-table-scroll" style={{ ['--cok-table-max-h' as string]: 'calc(100vh - 230px)' } as React.CSSProperties}>
    <table className="w-full min-w-[1100px]">
      <thead className="shadow-sm cok-bg-primary">
        <tr>
          {HEADERS.map((header) => (
            <th
              key={header}
              className="cok-bg-primary px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider"
              style={{ fontFamily: fontHeading, color: WHITE }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <MessageRow text={loadingText} color={loadingText === 'Searching...' ? PRIMARY : GRAY_DISABLED} />
        ) : rows.length === 0 ? (
          <MessageRow text="No records found" />
        ) : (
          rows.map((row, index) => (
            <tr key={row._id || `${row.plate_number}-${index}`} className="hover:bg-gray-50 transition-colors duration-200 *:border-b *:border-gray-200">
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onCheckout(row)}
                  className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 transition-colors"
                  style={{
                    backgroundColor: DANGER,
                    color: WHITE,
                    borderRadius: 0,
                    fontFamily: fontHeading,
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                >
                  <FiLogOut className="w-4 h-4" />
                  Checkout
                </button>
              </td>
              <td className="px-3 py-3">
                <span className="font-medium text-sm" style={{ color: row.is_flagged ? DANGER : PRIMARY }}>
                  {row.plate_number || '-'}
                </span>
              </td>
              <td className="px-3 py-3 text-sm font-medium" style={{ color: TEXT }}>{row.badge_number || '_____'}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{row.driver_name || '-'}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{idTypeOf(row)}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{idNumberOf(row)}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{row.driver_telephone || '-'}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{row.driver_email || '-'}</td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{row.driver_gender || '-'}</td>
              <td className="px-3 py-3 text-sm text-center" style={{ color: TEXT }}>{row.N_visits ?? 0}</td>
              <td className="px-3 py-3">
                <DriverTypeBadge type={row.driver_type} />
              </td>
              <td className="px-3 py-3 text-sm" style={{ color: TEXT }}>{formatParkingDate(row.check_in, true)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1">
                  <span className={`text-xs ${row.is_over_limit ? 'font-medium' : ''}`} style={{ color: row.is_over_limit ? DANGER : TEXT }}>
                    {row.current_duration || '-'}
                  </span>
                  {row.is_over_limit ? <FiClock className="w-3 h-3" style={{ color: DANGER }} title="Over time" /> : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export default ActiveParkingTable;

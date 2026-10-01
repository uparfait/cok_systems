import React from 'react';
import { useVisitorPanel, visitorIdOf } from '../../../../core/components/visitor/VisitorPanelProvider';
import DriverTypeBadge from '../checkoutVehicle/DriverTypeBadge';
import type { ParkingRow } from '../checkoutVehicle/parkingRows';
import { formatParkingDate, idNumberOf, idTypeOf } from '../checkoutVehicle/parkingRows';
import { DANGER, fontHeading } from './dashboardTheme';

const HEADERS = ['Plate No.', 'Full name', 'ID type', 'ID number', 'Telephone', 'Email', 'Gender', 'Visits', 'Type', 'Entry Time', 'Duration', 'Status', 'Action'];

const durationClass = (hours?: number): string => {
  const value = Number(hours) || 0;
  if (value >= 9) return 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C] border border-[#E0E0E0]';
  if (value >= 5) return 'bg-[rgba(243,156,18,0.12)] text-[#F39C12] border border-[#E0E0E0]';
  return 'bg-[rgba(51,51,51,0.08)] text-[#555555] border border-[#E0E0E0]';
};

interface FlaggedVehiclesTableProps {
  rows: ParkingRow[];
  onCheckout: (row: ParkingRow) => void;
  maxHeight?: string;
}

const FlaggedVehiclesTable: React.FC<FlaggedVehiclesTableProps> = ({ rows, onCheckout, maxHeight }) => {
  const { openVisitor } = useVisitorPanel();
  const scrollStyle = maxHeight ? ({ ['--cok-table-max-h' as string]: maxHeight } as React.CSSProperties) : undefined;

  return (
    <div className="cok-table-scroll" style={scrollStyle}>
      <table className="w-full text-sm">
        <thead className="bg-[#FEF4F3]">
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header}
                className={`bg-[#FEF4F3] py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide ${header === 'Action' ? 'text-right' : 'text-left'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row._id || `${row.plate_number}-${index}`}
              className="hover:bg-[#F7F9FB] cursor-pointer transition-colors *:border-b *:border-[#E0E0E0]"
              onClick={() => openVisitor(visitorIdOf(row))}
            >
              <td className="py-3 px-4 font-mono font-bold text-[#E74C3C] text-sm">{row.plate_number || '-'}</td>
              <td className="py-3 px-4 text-[#333333] text-sm">{row.driver_name || '-'}</td>
              <td className="py-3 px-4 text-[#555555] text-sm">{idTypeOf(row)}</td>
              <td className="py-3 px-4 text-[#555555] text-sm">{idNumberOf(row)}</td>
              <td className="py-3 px-4 text-[#555555] text-sm">{row.driver_telephone || '-'}</td>
              <td className="py-3 px-4 text-[#555555] text-sm">{row.driver_email || '-'}</td>
              <td className="py-3 px-4 text-[#555555] text-sm">{row.driver_gender || '-'}</td>
              <td className="py-3 px-4 text-[#555555] text-sm text-center">{row.N_visits ?? 0}</td>
              <td className="py-3 px-4">
                <DriverTypeBadge type={row.driver_type} />
              </td>
              <td className="py-3 px-4 text-[#555555] text-xs">{formatParkingDate(row.check_in)}</td>
              <td className="py-3 px-4">
                <span className={`px-2.5 py-1 text-xs font-medium ${durationClass(row.current_duration_hours)}`}>
                  {row.current_duration || '-'}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`px-2.5 py-1 text-xs font-medium ${row.status === 'active' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}
                >
                  {row.status === 'active' ? 'Inside' : 'Out'}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                {row.status === 'active' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckout(row);
                    }}
                    className="px-3 py-1.5 text-xs text-white transition-colors cursor-pointer"
                    style={{ backgroundColor: DANGER, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                  >
                    Checkout
                  </button>
                ) : (
                  <span className="text-xs text-[#9E9E9E]">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FlaggedVehiclesTable;

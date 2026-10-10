import React from 'react';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import { useVisitorPanel, visitorIdOf } from '../../../../core/components/visitor/VisitorPanelProvider';
import PastFlagPanel from './PastFlagPanel';
import type { PastFlagInfo, VerifyResult } from './vehicleCheckin';
import { categoryText, formatMinutes, minutesSince } from './vehicleCheckin';

interface VerifyResultCardProps {
  result: VerifyResult;
  pastFlag: PastFlagInfo | null;
  pastFlagLoading: boolean;
  onCheckIn: () => void;
}

const CATEGORY_TAG: Record<string, string> = {
  Staff: 'bg-[#056daa]/10 text-[#056daa]',
  Visitor: 'bg-violet-100 text-violet-800',
  Regular: 'bg-gray-100 text-gray-700',
};

const Tag: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>{children}</span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 min-w-28">{label}</span>
    <span className="text-gray-900">{children}</span>
  </div>
);

const VerifyResultCard: React.FC<VerifyResultCardProps> = ({ result, pastFlag, pastFlagLoading, onCheckIn }) => {
  const { openVisitor } = useVisitorPanel();
  const { data, found } = result;
  const category = data.vehicle_category || 'Regular';
  const parked = data.is_currently_parked ? data.parking_details : null;
  const parkedVisitorId = parked ? visitorIdOf(parked) : null;
  const parkedMinutes = minutesSince(parked?.check_in);
  const staff = data.staff_details;
  const reservation = data.emergency_reservation_details;
  const last = data.last_driver;

  const visitorName = (id: string | null, name: string) => (
    id ? (
      <button type="button" className="cok-primary-color font-semibold underline cursor-pointer" onClick={() => openVisitor(id)}>
        {name || 'Unknown'}
      </button>
    ) : (
      <span className="font-semibold">{name || 'Unknown'}</span>
    )
  );

  return (
    <div className="bg-white border border-gray-200 flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Plate number</p>
          <p className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{data.plate_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className={CATEGORY_TAG[category] || CATEGORY_TAG.Regular}>{category}</Tag>
          {data.is_reserved ? <Tag className="bg-green-100 text-green-800">Reserved</Tag> : null}
          {data.is_currently_parked ? <Tag className="bg-amber-100 text-amber-900">Inside</Tag> : null}
          {data.is_flagged ? <Tag className="bg-red-100 text-red-700">Flagged</Tag> : null}
        </div>
      </div>

      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
        <Row label="Category">{categoryText(data)}</Row>

        {staff ? (
          <Row label="Staff owner">
            <span className="font-semibold">{staff.owner_name || 'Not specified'}</span>
            {staff.department_name ? <span className="text-gray-600"> - {staff.department_name}</span> : null}
          </Row>
        ) : null}

        {reservation ? (
          <Row label="Reservation">
            <span className="font-semibold">{reservation.driver_name || 'Visitor'}</span>
            {reservation.slot_number && reservation.slot_number !== 'Not Specified' ? <span className="text-gray-600"> - slot {reservation.slot_number}</span> : null}
            {reservation.valid_until ? <span className="text-gray-600"> - valid until {formatDateTime(reservation.valid_until)}</span> : null}
          </Row>
        ) : null}

        {!found ? (
          <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This vehicle is not registered. Register the driver details to grant one-time access.
          </div>
        ) : null}

        {parked ? (
          <div className="border border-amber-300 bg-amber-50 px-3 py-2 flex flex-col gap-1 text-sm text-amber-900">
            <p className="font-semibold">This vehicle is already checked in.</p>
            <p>
              Inside since {formatDateTime(parked.check_in)}
              {parkedMinutes != null ? ` (${formatMinutes(parkedMinutes)})` : ''}
              {parked.slot_number && parked.slot_number !== 'Not Specified' ? `, slot ${parked.slot_number}` : ''}
            </p>
            <p>
              Came with {visitorName(parkedVisitorId, parked.driver_name || '')}
              {parked.driver_telephone ? <span> - {parked.driver_telephone}</span> : null}
            </p>
            {parked.is_flagged ? <p className="text-red-700 font-semibold">Flagged: it is over its allowed parking time.</p> : null}
          </div>
        ) : null}

        {last && !parked ? (
          <div className="border border-[#056daa]/30 bg-[#056daa]/5 px-3 py-2 text-sm text-gray-800">
            Last time this car came with {visitorName(last._id, last.full_name)}
            {last.telephone ? <span className="text-gray-600"> - {last.telephone}</span> : null}
            <span className="text-gray-600"> - visits: {last.N_visits || 0}</span>
          </div>
        ) : null}

        {data.was_ever_flagged || pastFlag ? <PastFlagPanel pastFlag={pastFlag} loading={pastFlagLoading} /> : null}
      </div>

      <div className="px-4 sm:px-5 pb-4">
        <button
          type="button"
          className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={data.is_currently_parked}
          onClick={onCheckIn}
        >
          {data.is_currently_parked ? 'Already checked in' : 'Check in'}
        </button>
      </div>
    </div>
  );
};

export default VerifyResultCard;

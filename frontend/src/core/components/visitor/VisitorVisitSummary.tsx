import React from 'react';
import { formatDateTime } from './visitorApi';
import type { Visit } from './visitorTypes';

const STATUS_STYLE: Record<string, string> = {
  'Not started': 'bg-amber-50 text-amber-800 border-amber-200',
  Inprogress: 'bg-blue-50 text-blue-800 border-blue-200',
  Completed: 'bg-green-50 text-green-800 border-green-200',
  Transfered: 'bg-gray-50 text-gray-700 border-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
  'Not started': 'Waiting',
  Inprogress: 'Being served',
  Completed: 'Completed',
  Transfered: 'Transferred',
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 break-words">{value || '-'}</span>
  </div>
);

const VisitorVisitSummary: React.FC<{ visit: Visit; title: string }> = ({ visit, title }) => {
  const vehicle = visit.vehicle_storage?.has_vehicle ? visit.vehicle_storage?.vehicle_details : null;
  return (
    <section className="border border-gray-200 p-3 flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Row label="Entered" value={formatDateTime(visit.entry_date)} />
        <Row label="Left" value={visit.is_still_inhouse ? 'Still in house' : formatDateTime(visit.exist_date)} />
        <Row label="Vehicle" value={vehicle ? vehicle.plate_number : 'On foot'} />
        <Row label="Registered by" value={visit.registered_by} />
        {visit.marked_as_out ? <Row label="Status" value="Stepped out to the car" /> : null}
        {visit.durations?.entry_and_leave_duration ? <Row label="Time in house" value={visit.durations.entry_and_leave_duration} /> : null}
      </div>

      {visit.services_status && visit.services_status.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Departments and services</span>
          {visit.services_status.map((service, index) => {
            const assignment = (visit.departments_assigned || []).find((d) => d.department_id === service.department_id);
            return (
              <div key={service._id || `${service.department_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 px-2.5 py-1.5">
                <div className="text-sm text-gray-900">
                  {service.department_name}
                  {service.provider_name && service.provider_name !== 'Not specified' ? <span className="text-gray-500"> - {service.provider_name}</span> : null}
                  {assignment?.assigned_by?.name ? <span className="text-xs text-gray-400"> (sent by {assignment.assigned_by.name}, {formatDateTime(assignment.assigned_time)})</span> : null}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 border ${STATUS_STYLE[service.s_type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {STATUS_LABEL[service.s_type] || service.s_type}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Not sent to any department yet.</p>
      )}

      {visit.notes && visit.notes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Notes</span>
          {visit.notes.map((note, index) => (
            <p key={`${note.timestamp}-${index}`} className="text-xs text-gray-700">
              <strong>{note.writter_name || 'Someone'}</strong> ({formatDateTime(note.timestamp)}): {note.message}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default VisitorVisitSummary;

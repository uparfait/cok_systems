import { useNavigate } from 'react-router-dom';

const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'name', label: 'Name' },
  { key: 'mode', label: 'Mode' },
  { key: 'room', label: 'Room' },
  { key: 'organizerName', label: 'Organizer Name' },
  { key: 'organizerEmail', label: 'Organizer Email' },
  { key: 'organizerTel', label: 'Organizer Tel' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time (From — To)' },
];

const toDateStr = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toTimeStr = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getEventDate = (event) => {
  const startIso = event.startedAt || event.willStartAt;
  if (startIso) return toDateStr(startIso);
  if (event.eventRecurring) {
    const rec = event.eventRecurring;
    return `${rec.recurringType} (until ${toDateStr(rec.recurringEndDate)})`;
  }
  return '—';
};

const getEventTimeRange = (event) => {
  const startIso = event.startedAt || event.willStartAt;
  const endIso = event.willEndAt || event.endedAt;
  if (startIso && endIso) return `${toTimeStr(startIso)} — ${toTimeStr(endIso)}`;
  if (event.eventRecurring) {
    const rec = event.eventRecurring;
    return `${rec.eventStartTime || '--:--'} — ${rec.eventEndTime || '--:--'}`;
  }
  return '—';
};

const getOrganizer = (event) => {
  const org = event.eventOrganizer;
  if (org && typeof org === 'object') return org;
  return { fullNames: typeof org === 'string' ? org : '', email: '', phone: '' };
};

const getMeetingTypeBadge = (eventMeetingType) => {
  if (eventMeetingType === 'meet') {
    return <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Meeting</span>;
  }
  return <span className="inline-block bg-blue-50 cok-primary-color border border-blue-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Event</span>;
};

const getModeBadge = (type) => {
  switch (type) {
    case 'Special':
    case 'External':
      return <span className="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">{type}</span>;
    case 'Joint':
      return <span className="inline-block bg-teal-50 text-teal-800 border border-teal-300 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">{type}</span>;
    default:
      return <span className="inline-block bg-indigo-50 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">{type || '—'}</span>;
  }
};

export default function TableContainer({ data }) {
  const navigate = useNavigate();

  const handleRowClick = (event) => {
    const specialId = event.eventSpecialId || event._id;
    navigate(`/event-manager/events/${specialId}/details`);
  };

  const renderCell = (event, columnKey) => {
    const org = getOrganizer(event);
    switch (columnKey) {
      case 'type':
        return getMeetingTypeBadge(event.eventMeetingType);
      case 'name':
        return <span className="font-bold text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{event.eventName || '—'}</span>;
      case 'mode':
        return getModeBadge(event.eventType);
      case 'room':
        return <span className="text-sm font-medium capitalize whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{event.eventRoom || '—'}</span>;
      case 'organizerName':
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.fullNames || '—'}</span>;
      case 'organizerEmail':
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.email || '—'}</span>;
      case 'organizerTel':
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.phone || '—'}</span>;
      case 'date':
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{getEventDate(event)}</span>;
      case 'time':
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{getEventTimeRange(event)}</span>;
      default:
        return '—';
    }
  };

  return (
    <div className="h-full w-full overflow-auto" style={{ border: `1px solid ${BORDER}`, WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                className="cok-primary-bg text-white px-3 py-3 sm:px-4 sm:py-3.5 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                style={{ fontFamily: fontHeading }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-24 text-center bg-white">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-12 h-12" style={{ color: BORDER }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium uppercase tracking-wide" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No events found</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((event, rowIndex) => (
              <tr
                key={event._id}
                onClick={() => handleRowClick(event)}
                className={`cursor-pointer transition-colors duration-100 ${rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
              >
                {COLUMNS.map((column, colIndex) => (
                  <td
                    key={`${event._id}-${column.key}`}
                    className={`px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap ${colIndex === 0 ? '' : 'border-l'} ${rowIndex < data.length - 1 ? 'border-b' : ''}`}
                    style={{ borderColor: BORDER }}
                  >
                    {renderCell(event, column.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

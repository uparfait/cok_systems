import { FiFilter, FiSearch, FiX } from 'react-icons/fi';
import SpiralLoader from './SpiralLoader';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';

const STATUS_META = {
  Pending:       { color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200' },
  Completed:     { color: 'bg-green-100 text-green-700 border-green-200' },
  Cancelled:     { color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function EventActionsEventPanel({ allEvents, eventsLoading, eventSearch, setEventSearch, eventStatusTab, setEventStatusTab, selectedEvent, setSelectedEvent, setPage }) {
  const filteredEvents = allEvents.filter(ev => {
    const q = eventSearch.trim().toLowerCase();
    const matchSearch = !q || ev.eventName.toLowerCase().includes(q) || ev.eventDescription.toLowerCase().includes(q);
    const matchTab = eventStatusTab === 'all' || ev.status === eventStatusTab;
    return matchSearch && matchTab;
  });

  return (
    <div className="w-full lg:w-72 shrink-0 bg-white border overflow-hidden" style={{ borderColor: '#E0E0E0' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#E0E0E0' }}>
        <FiFilter className="w-4 h-4" style={{ color: PRIMARY }} />
        <span className="text-sm font-semibold text-zinc-700" style={{ fontFamily: "'Montserrat', sans-serif" }}>Filter by Event</span>
        {selectedEvent && (
          <button onClick={() => { setSelectedEvent(null); setPage(1); }} className="ml-auto text-xs flex items-center gap-1" style={{ color: DANGER }}>
            <FiX className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="p-3 border-b" style={{ borderColor: '#E0E0E0' }}>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9E9E9E' }} />
          <input
            type="text"
            placeholder="Search events…"
            value={eventSearch}
            onChange={e => setEventSearch(e.target.value)}
            className="w-full cok-auth-input pr-8 py-2 text-sm"
            style={{ minHeight: '40px' }}
          />
          {eventSearch && (
            <button onClick={() => setEventSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#9E9E9E' }}>
              <FiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 border-b text-[11px] font-medium" style={{ borderColor: '#E0E0E0' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'Pending', label: 'Pending' },
          { key: 'In Progress', label: 'Active' },
          { key: 'Completed', label: 'Done' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setEventStatusTab(tab.key)}
            className="py-2 transition-colors"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: eventStatusTab === tab.key ? PRIMARY : '#666666',
              borderBottom: eventStatusTab === tab.key ? `2px solid ${PRIMARY}` : '2px solid transparent',
              backgroundColor: eventStatusTab === tab.key ? '#E3F2FD' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
        {eventsLoading ? (
          <div className="flex justify-center py-8"><SpiralLoader color="#056daa" /></div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>No events found</p>
          </div>
        ) : (
          filteredEvents.map(ev => {
            const isActive = selectedEvent?.eventSpecialId === ev.eventSpecialId;
            return (
              <button
                key={ev.eventSpecialId}
                onClick={() => { setSelectedEvent({ eventSpecialId: ev.eventSpecialId, eventName: ev.eventName }); setPage(1); }}
                className="w-full text-left px-4 py-3 border-b transition-colors"
                style={{
                  borderColor: '#E0E0E0',
                  backgroundColor: isActive ? '#E3F2FD' : '#FFFFFF',
                  borderLeft: isActive ? '4px solid #056daa' : '4px solid transparent',
                }}
              >
                <p className="text-sm font-medium truncate" style={{ fontFamily: "'Montserrat', sans-serif", color: isActive ? PRIMARY : '#333333' }}>
                  {ev.eventName}
                </p>
                {ev.eventDescription && (
                  <p className="text-xs truncate mt-0.5" style={{ color: '#888888' }}>{ev.eventDescription}</p>
                )}
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-none text-[10px] font-medium border ${STATUS_META[ev.status]?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {ev.status}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

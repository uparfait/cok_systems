import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2, FiInfo, FiX } from 'react-icons/fi';

export default function TableContainer({ data, onDelete, eventType }) {
  const navigate = useNavigate();
  const [mobileDescEvent, setMobileDescEvent] = useState(null);

  const columns = [
    { key: 'eventMeetingType', label: 'Type' },
    { key: 'eventName', label: 'Event/Meet Name' },
    { key: 'eventType', label: 'Mode' },
    { key: 'eventRoom', label: 'Room' },
    { key: 'expectedAudience', label: 'Audience' },
    { key: 'eventOrganizer', label: 'Organizer' },
    { key: 'status', label: 'Status' },
    { key: 'time', label: 'Time' },
    { key: 'actions', label: 'Actions' },
  ];

  const truncateDescription = (text, maxLength = 80) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const getOrganizerDisplay = (organizer) => {
    if (typeof organizer === 'string') return organizer;
    if (organizer && typeof organizer === 'object') {
      return (
        <div className="text-sm leading-snug">
          <div className="font-semibold text-gray-900">{organizer.fullNames}</div>
          <div className="text-gray-500 text-xs">{organizer.email}</div>
          {organizer.phone && <div className="text-gray-500 text-xs">{organizer.phone}</div>}
          {organizer.institution && <div className="text-gray-400 text-xs italic">{organizer.institution}</div>}
        </div>
      );
    }
    return <span className="text-gray-400">N/A</span>;
  };

  const getEventTimeDisplay = (event) => {
    if (event.startedAt && event.willEndAt) {
      return (
        <div className="text-sm leading-snug">
          <div className="text-gray-700">{new Date(event.startedAt).toLocaleDateString()}</div>
          <div className="text-gray-500 text-xs">
            {new Date(event.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.willEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      );
    }
    if (event.willStartAt && event.willEndAt) {
      return (
        <div className="text-sm leading-snug">
          <div className="text-gray-700">{new Date(event.willStartAt).toLocaleDateString()}</div>
          <div className="text-gray-500 text-xs">
            {new Date(event.willStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.willEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      );
    }
    if (event.eventRecurring) {
      const rec = event.eventRecurring;
      return (
        <div className="text-sm leading-snug">
          <div className="font-medium text-gray-700">{rec.recurringType}</div>
          <div className="text-gray-500 text-xs">{rec.eventStartTime} - {rec.eventEndTime}</div>
          <div className="text-gray-400 text-xs">Until {new Date(rec.recurringEndDate).toLocaleDateString()}</div>
        </div>
      );
    }
    if (event.startedAt && event.endedAt) {
      return (
        <div className="text-sm leading-snug">
          <div className="text-gray-700">{new Date(event.startedAt).toLocaleDateString()}</div>
          <div className="text-gray-500 text-xs">
            {new Date(event.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      );
    }
    return <span className="text-gray-400 text-sm">N/A</span>;
  };

  const getEventStatus = () => {
    switch (eventType) {
      case 'live': return 'Live';
      case 'upcoming': return 'Upcoming';
      case 'recurring': return 'Recurring';
      case 'past': return 'Past';
      default: return 'Unknown';
    }
  };

  const getStatusBadge = () => {
    switch (eventType) {
      case 'live':
        return <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">Live</span>;
      case 'upcoming':
        return <span className="inline-block bg-sky-100 text-sky-800 border border-sky-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">Upcoming</span>;
      case 'recurring':
        return <span className="inline-block bg-violet-100 text-violet-800 border border-violet-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">Recurring</span>;
      case 'past':
        return <span className="inline-block bg-gray-100 text-gray-500 border border-gray-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">Past</span>;
      default:
        return <span className="inline-block bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">Unknown</span>;
    }
  };

  const getEventTypeBadge = (type) => {
    switch (type) {
      case 'Special':
      case 'External':
        return <span className="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold">{type}</span>;
      case 'Joint':
        return <span className="inline-block bg-teal-50 text-teal-800 border border-teal-300 px-2.5 py-0.5 text-xs font-semibold">{type}</span>;
      default:
        return <span className="inline-block bg-indigo-50 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 text-xs font-semibold">{type}</span>;
    }
  };

  const getEventMeetingTypeBadge = (eventMeetingType) => {
    if (!eventMeetingType) return null;
    if (eventMeetingType === 'meet') {
      return <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mr-1">Meet</span>;
    }
    return <span className="inline-block bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mr-1">Event</span>;
  };

  const handleRowClick = (event) => {
    const specialId = event.eventSpecialId || event._id;
    navigate(`/event-manager/events/${specialId}/details`);
  };

  const handleDeleteClick = (e, eventId) => {
    e.stopPropagation();
    onDelete(eventId, getEventStatus());
  };

  const renderDesktopCell = (event, column) => {
    switch (column.key) {
      case 'eventMeetingType':
        return (
          <div className="min-w-[200px]">
            <div className="font-bold text-gray-900 text-sm mb-1">
              {getEventMeetingTypeBadge(event.eventMeetingType)}
            </div>
          </div>
        );
      case 'eventName':
        return (
          <div className="min-w-[200px]">
            <div className="font-bold text-gray-900 text-sm mb-1">
              {event.eventName}
            </div>
            {event.eventDescription && (
              <div className="relative group/desc inline-block">
                <p className="text-xs text-gray-500 leading-relaxed cursor-help border-b border-dotted border-gray-300 hover:border-gray-500 transition-colors">
                  {truncateDescription(event.eventDescription, 60)}
                </p>
                <div className="absolute left-0 top-full mt-2 z-50 opacity-0 invisible group-hover/desc:opacity-100 group-hover/desc:visible transition-all duration-200 pointer-events-none min-w-[280px]">
                  <div className="bg-gray-900 text-white text-xs ppp shadow-xl p-4">
                    <div className="absolute -top-1.5 left-4 w-3 h-3 bg-gray-900 rotate-45"></div>
                    <p className="font-semibold text-gray-300 mb-1 text-[10px] uppercase tracking-wider">Full Description</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{event.eventDescription}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'eventType':
        return getEventTypeBadge(event.eventType);
      case 'eventRoom':
        return <span className="text-sm text-gray-700 font-medium">{event.eventRoom}</span>;
      case 'eventOrganizer':
        return getOrganizerDisplay(event.eventOrganizer);
      case 'status':
        return getStatusBadge();
      case 'time':
        return getEventTimeDisplay(event);
      case 'actions':
        return (
          <div className="flex items-center justify-center">
            {eventType !== 'past' && (
              <button
                onClick={(e) => handleDeleteClick(e, event._id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all duration-150"
                title="Delete event"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      default:
        return event[column.key] || <span className="text-gray-400">—</span>;
    }
  };

  // Mobile Card Component
  const MobileEventCard = ({ event }) => (
    <div
      onClick={() => handleRowClick(event)}
      className="bg-white border-2 border-gray-200 p-4 cursor-pointer hover:border-gray-400 transition-colors active:bg-gray-50"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm truncate">{event.eventName}</h3>
          {event.eventDescription && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
              {truncateDescription(event.eventDescription, 100)}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">{getStatusBadge()}</div>
      </div>

      {/* Details Grid */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Type</span>
          <span>{getEventTypeBadge(event.eventType)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Room</span>
          <span className="text-gray-900 font-semibold">{event.eventRoom}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Time</span>
          <span className="text-gray-700 text-right">{getEventTimeDisplay(event)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Organizer</span>
          <span className="text-gray-900 font-semibold text-right">
            {typeof event.eventOrganizer === 'object' ? event.eventOrganizer.fullNames : event.eventOrganizer || 'N/A'}
          </span>
        </div>
      </div>

      {/* Description Overlay for Mobile */}
      {event.eventDescription && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMobileDescEvent(event);
          }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <FiInfo className="w-3.5 h-3.5" />
          View Full Description
        </button>
      )}

      {/* Delete */}
      {eventType !== 'past' && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={(e) => handleDeleteClick(e, event._id)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors font-medium"
          >
            <FiTrash2 className="w-4 h-4" />
            Delete Event
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block h-full w-full">
        <div className="h-full w-full overflow-auto border-2 border-gray-300">
          <table className="w-full border-collapse table-auto">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`
                      bg-[#1255e5] text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest
                      ${index === 0 ? '' : ''}
                    `}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-24 text-center bg-white">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No events found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((event, rowIndex) => (
                  <tr
                    key={event._id}
                    onClick={() => handleRowClick(event)}
                    className={`
                      cursor-pointer transition-colors duration-100
                      ${rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}
                    `}
                  >
                    {columns.map((column, colIndex) => (
                      <td
                        key={`${event._id}-${column.key}`}
                        className={`
                          
                          px-4 py-3 
                          ${colIndex === 0 ? '' : 'border-l border-gray-200'}
                          ${rowIndex < data.length - 1 ? 'border-b border-gray-200' : ''}
                        `}
                      >
                        {renderDesktopCell(event, column)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 p-3 h-full overflow-auto">
        {data.length === 0 ? (
          <div className="py-24 text-center">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No events found</span>
            </div>
          </div>
        ) : (
          data.map((event) => (
            <MobileEventCard key={event._id} event={event} />
          ))
        )}
      </div>

      {/* Mobile Description Modal */}
      {mobileDescEvent && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 md:hidden"
          onClick={() => setMobileDescEvent(null)}
        >
          <div
            className="bg-white border-2 border-gray-300 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-gray-200">
              <div>
                <h3 className="font-bold text-gray-900">{mobileDescEvent.eventName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Event Description</p>
              </div>
              <button
                onClick={() => setMobileDescEvent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {mobileDescEvent.eventDescription}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
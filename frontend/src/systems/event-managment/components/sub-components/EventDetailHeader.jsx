import { FiArrowLeft } from 'react-icons/fi';

export default function EventDetailHeader({ event, eventMode, navigate }) {
  const badgeColors = {
    live: 'bg-green-100 text-green-700',
    upcoming: 'bg-blue-100 text-blue-700',
    recurring: 'bg-purple-100 text-purple-700',
    past: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 cok-btn-outlined"
        >
          <FiArrowLeft className="w-5 h-5 " />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 truncate">{event.eventName}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`px-2 py-0.5 ppp text-xs font-medium ${badgeColors[eventMode] || 'bg-gray-100 text-gray-600'}`}>
              {eventMode.charAt(0).toUpperCase() + eventMode.slice(1)}
            </span>
            {event.isCancelled && (
              <span className="px-2 py-0.5 ppp text-xs font-medium bg-red-100 text-red-700">
                Cancelled
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
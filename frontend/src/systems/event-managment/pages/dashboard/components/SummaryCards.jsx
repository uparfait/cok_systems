import { FiCalendar, FiClipboard, FiXCircle, FiLoader } from 'react-icons/fi';

const cards = [
  {
    key: 'totalEventsHeld',
    label: 'Total Events Held',
    icon: FiCalendar,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    key: 'totalMeetingsHeld',
    label: 'Total Meetings Held',
    icon: FiClipboard,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  {
    key: 'totalEventsCanceled',
    label: 'Total Events Canceled',
    icon: FiXCircle,
    color: 'text-red-600',
    bg: 'bg-red-50'
  },
  {
    key: 'totalMeetingsCanceled',
    label: 'Total Meetings Canceled',
    icon: FiXCircle,
    color: 'text-amber-600',
    bg: 'bg-amber-50'
  }
];

export default function SummaryCards({ summary, loading }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = summary ? summary[card.key] : 0;
        return (
          <div
            key={card.key}
            className="bg-white border border-gray-200 p-5 transition-shadow duration-200 hover:shadow-md relative"
          >
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <FiLoader className="w-5 h-5 cok-primary-color animate-spin" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {value.toLocaleString()}
                </p>
              </div>
              <div className={`w-12 h-12 flex items-center justify-center ${card.bg}`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

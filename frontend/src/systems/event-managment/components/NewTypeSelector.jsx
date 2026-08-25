import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiUsers, FiArrowRight } from 'react-icons/fi';

const PRIMARY = '#056daa';

export default function NewTypeSelector() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <p className="text-gray-500 mt-2">Choose what you want to create</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Event Card */}
          <button
            onClick={() => navigate('/event-manager/events/new/event')}
            className="group relative bg-white border-2 border-gray-200 hover:border-[#056daa] hover:shadow-lg transition-all duration-200 p-8 text-left cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-[#056daa]/10 flex items-center justify-center mb-5 group-hover:bg-[#056daa] transition-colors duration-200">
              <FiCalendar className="w-7 h-7 text-[#056daa] group-hover:text-white transition-colors duration-200" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Event</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Create and manage events with full scheduling capabilities and attendance tracking.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: PRIMARY }}></span>
                Event scheduling & room booking
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: PRIMARY }}></span>
                QR code attendance tracking
              </li>
            </ul>
            <div className="flex items-center gap-1 text-sm font-semibold text-[#056daa] group-hover:text-[#045d94]">
              Create Event <FiArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Meeting Card */}
          <button
            onClick={() => navigate('/event-manager/events/new/meet')}
            className="group relative bg-white border-2 border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 p-8 text-left cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5 group-hover:bg-emerald-600 transition-colors duration-200">
              <FiUsers className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors duration-200" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Meeting</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Schedule and manage meetings with agenda planning, action items, and minutes documentation.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Meeting scheduling & room booking
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Activity agenda planning
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Action items & follow-ups
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Meeting minutes documentation
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                QR code attendance tracking
              </li>
            </ul>
            <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600 group-hover:text-emerald-700">
              Create Meeting <FiArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

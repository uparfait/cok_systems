import { FiCheckCircle, FiXCircle, FiAlertCircle, FiCalendar, FiMapPin, FiChevronDown, FiChevronUp } from 'react-icons/fi';

export default function DateCheckResults({ result, expandedRoom, setExpandedRoom }) {
  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className={`bg-white border ppp-lg p-4 ${result.availableCount > 0 ? 'border-green-200' : 'border-red-200'}`}>
        <div className="flex items-start gap-3">
          {renderSummaryIcon(result.availableCount, result.unavailableCount)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{result.summary}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <FiCalendar className="w-3.5 h-3.5" />
                {new Date(result.requestedPeriod.start).toLocaleString()} - {new Date(result.requestedPeriod.end).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                Mode: <span className="font-medium capitalize">{result.eventMode}</span>
              </span>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 ppp-lg font-medium">{result.availableCount} Available</span>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 ppp-lg font-medium">{result.unavailableCount} Unavailable</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 ppp-lg font-medium">{result.totalRooms} Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Available Rooms */}
      {result.availableRooms?.length > 0 && (
        <div className="bg-white border border-gray-200 ppp-lg divide-y divide-gray-100">
          <div className="px-4 py-3 bg-green-50">
            <h3 className="text-sm font-bold text-green-700">Available Rooms ({result.availableRooms.length})</h3>
          </div>
          {result.availableRooms.map((item, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiCheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{item.room.roomName}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <FiMapPin className="w-3 h-3" />
                    {item.room.roomLocation} &middot; Capacity: {item.room.roomCapacity}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unavailable Rooms */}
      {result.unavailableRooms?.length > 0 && (
        <div className="bg-white border border-gray-200 ppp-lg divide-y divide-gray-100">
          <div className="px-4 py-3 bg-orange-50">
            <h3 className="text-sm font-bold text-orange-700">Unavailable Rooms ({result.unavailableRooms.length})</h3>
          </div>
          {result.unavailableRooms.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() => setExpandedRoom(expandedRoom === idx ? null : idx)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <FiXCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{item.room.roomName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <FiMapPin className="w-3 h-3" />
                      {item.room.roomLocation} &middot; Capacity: {item.room.roomCapacity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-600">{item.conflicts?.length || 0} conflict(s)</span>
                  {expandedRoom === idx ? <FiChevronUp className="w-4 h-4 text-gray-400" /> : <FiChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {expandedRoom === idx && (
                <div className="px-4 pb-3 space-y-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mt-2">{item.message}</p>

                  {item.unavailableDates?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Unavailable Dates:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {item.unavailableDates.map((ud, udIdx) => (
                          <div key={udIdx} className="text-xs bg-orange-50 border border-red-100 p-2 ppp-lg">
                            <span className="font-medium text-orange-700">{new Date(ud.date).toLocaleDateString()}</span>
                            <span className="text-orange-500"> ({new Date(ud.startTime).toLocaleTimeString()} - {new Date(ud.endTime).toLocaleTimeString()})</span>
                            {ud.conflicts?.map((c, cIdx) => (
                              <p key={cIdx} className="text-orange-600 mt-0.5">&middot; {c.type}: {c.eventName}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.conflicts?.length > 0 && !item.unavailableDates && (
                    <div className="space-y-1 mt-1">
                      {item.conflicts.map((conflict, cIdx) => (
                        <div key={cIdx} className="flex items-start gap-2 text-xs bg-orange-50 border border-red-100 p-2 ppp-lg">
                          <FiXCircle className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-orange-700">{conflict.eventName}</p>
                            <p className="text-orange-500">{conflict.type}</p>
                            {conflict.startTime && conflict.endTime && (
                              <p className="text-orange-400">
                                {new Date(conflict.startTime).toLocaleString()} - {new Date(conflict.endTime).toLocaleString()}
                              </p>
                            )}
                            <p className="text-orange-400">Organizer: {conflict.organizer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.availableDates?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-green-700 mb-1">Available Dates ({item.availableDates.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {item.availableDates.map((ad, adIdx) => (
                          <span key={adIdx} className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 ppp-lg">
                            {new Date(ad.date).toLocaleDateString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderSummaryIcon(availableCount, unavailableCount) {
  if (availableCount > 0 && unavailableCount === 0) {
    return (
      <div className="w-10 h-10 bg-green-100 ppp-full flex items-center justify-center flex-shrink-0">
        <FiCheckCircle className="w-5 h-5 text-green-600" />
      </div>
    );
  }
  if (availableCount > 0) {
    return (
      <div className="w-10 h-10 bg-yellow-100 ppp-full flex items-center justify-center flex-shrink-0">
        <FiAlertCircle className="w-5 h-5 text-yellow-600" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 bg-orange-100 ppp-full flex items-center justify-center flex-shrink-0">
      <FiXCircle className="w-5 h-5 text-orange-600" />
    </div>
  );
}
import { useState } from 'react';
import { FiX, FiAlertTriangle, FiClock } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function CancelPostponeModal({
  isOpen,
  onClose,
  action, // 'cancel' or 'postpone'
  event,
  eventMode,
  onSuccess,
}) {
  const [reason, setReason] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newRecurringEnd, setNewRecurringEnd] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const isCancel = action === 'cancel';
  const isPostpone = action === 'postpone';

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/cancel`, {
        eventId: event._id,
        eventType: eventMode,
        reason: reason.trim(),
      });
      if (res.data.success) {
        onSuccess?.(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel event');
    } finally {
      setLoading(false);
    }
  };

  const handlePostpone = async () => {
    setLoading(true);
    setError(null);
    try {
      const newSchedule = {};

      if (eventMode === 'live') {
        if (newStart) newSchedule.startedAt = new Date(newStart).toISOString();
        if (newEnd) newSchedule.willEndAt = new Date(newEnd).toISOString();
      } else if (eventMode === 'upcoming') {
        if (newStart) newSchedule.willStartAt = new Date(newStart).toISOString();
        if (newEnd) newSchedule.willEndAt = new Date(newEnd).toISOString();
      } else if (eventMode === 'recurring') {
        if (newStartTime) newSchedule.eventStartTime = newStartTime;
        if (newEndTime) newSchedule.eventEndTime = newEndTime;
        if (newRecurringEnd) newSchedule.recurringEndDate = new Date(newRecurringEnd).toISOString();
      }

      if (Object.keys(newSchedule).length === 0) {
        setError('Please provide at least one new date/time.');
        setLoading(false);
        return;
      }

      const res = await axios.put(`${BASE_URL}/events/postpone`, {
        eventId: event._id,
        eventType: eventMode,
        newSchedule,
      });
      if (res.data.success) {
        onSuccess?.(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to postpone event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white ppp-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {isCancel ? (
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <FiClock className="w-5 h-5 text-blue-500" />
            )}
            <h2 className="text-lg font-bold text-gray-900">
              {isCancel ? 'Cancel Event' : 'Postpone Event'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 ppp-lg transition-colors">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 ppp-lg p-3">
            <p className="text-xs text-amber-700">
              {isCancel
                ? `This will mark the ${eventMode} event as cancelled and move it to past events.`
                : `Set new future dates/times for this ${eventMode} event. Room availability will be checked.`}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 ppp-lg p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {isCancel && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                Cancellation Reason <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Venue maintenance, scheduling conflict..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              />
            </div>
          )}

          {isPostpone && (
            <div className="space-y-4">
              {eventMode === 'live' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New Start Time</label>
                    <input
                      type="datetime-local"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      min={getMinDateTime()}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New End Time</label>
                    <input
                      type="datetime-local"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      min={newStart || getMinDateTime()}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {eventMode === 'upcoming' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New Start Time</label>
                    <input
                      type="datetime-local"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      min={getMinDateTime()}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New End Time</label>
                    <input
                      type="datetime-local"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      min={newStart || getMinDateTime()}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {eventMode === 'recurring' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New Start Time</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New End Time</label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">New Recurring End Date</label>
                    <input
                      type="date"
                      value={newRecurringEnd}
                      onChange={(e) => setNewRecurringEnd(e.target.value)}
                      min={getMinDate()}
                      className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6"><SpiralLoader /></div>
              <span className="ml-2 text-sm text-gray-500">
                {isCancel ? 'Cancelling...' : 'Postponing...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 ppp-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={isCancel ? handleCancel : handlePostpone}
            disabled={loading}
            className={`flex-1 py-2.5 ppp-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isCancel
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : isCancel ? 'Confirm Cancel' : 'Confirm Postpone'}
          </button>
        </div>
      </div>
    </div>
  );
}
// src/components/rooms/RoomDetails.jsx
import { useState, useEffect } from 'react';
import { FiX, FiEdit2, FiArrowLeft } from 'react-icons/fi';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

export default function RoomDetails({ roomId, onClose, onEdit }) {
  const [room, setRoom] = useState(null);
  const [liveEvent, setLiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRoomDetails();
  }, [roomId]);

  const fetchRoomDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomRes, liveRes] = await Promise.all([
        axios.get(`${BASE_URL}/rooms/${roomId}`),
        axios.get(`${BASE_URL}/rooms/${roomId}/live-event`).catch(() => null)
      ]);

      setRoom(roomRes.data.data || roomRes.data);
      
      if (liveRes?.data?.data?.liveEvent) {
        setLiveEvent(liveRes.data.data.liveEvent);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch room details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white ppp-xl shadow-xl p-8">
          <div className="animate-spin ppp-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-3">Loading room details...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white ppp-xl shadow-xl p-6 max-w-md w-full">
          <div className="bg-red-50 border border-red-200 ppp-lg p-4">
            <p className="text-sm text-red-600">{error || 'Room not found'}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 ppp-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white ppp-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 ppp-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">Room Details</h2>
          <button
            onClick={() => onEdit(roomId)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 ppp-lg transition-colors"
          >
            <FiEdit2 className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Room Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{room.roomName}</h3>
              <p className="text-sm text-gray-500 mt-1">{room.roomDescription}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 ppp-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Capacity</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{room.roomCapacity}</p>
              </div>
              <div className="bg-gray-50 ppp-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                <span className={`inline-flex px-2.5 py-0.5 ppp-full text-xs font-medium mt-1 ${
                  room.isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {room.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 ppp-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Location</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{room.roomLocation}</p>
            </div>
          </div>

          {/* Live Event */}
          {liveEvent && (
            <div className="border border-blue-200 bg-blue-50 ppp-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Current Live Event</h4>
              <div className="space-y-2">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Event:</span> {liveEvent.eventName}
                </p>
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Type:</span> {liveEvent.eventType}
                </p>
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Organizer:</span> {liveEvent.eventOrganizer}
                </p>
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Time:</span>{' '}
                  {new Date(liveEvent.startedAt).toLocaleString()} - {new Date(liveEvent.willEndAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
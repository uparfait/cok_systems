import { useState, useEffect, useCallback } from 'react';
import { FiX, FiDownload, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function RoomQrCodeModal({ isOpen, onClose, room }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrData, setQrData] = useState(null);

  const fetchQrCode = useCallback(async () => {
    if (!room?.roomName) return;
    setLoading(true);
    setError(null);
    setQrData(null);
    try {
      const res = await axios.get(`${BASE_URL}/rooms/${encodeURIComponent(room.roomName)}/qrcode`);
      if (res.data?.success) {
        setQrData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to generate QR code');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to generate QR code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [room?.roomName]);

  useEffect(() => {
    if (!isOpen) return;
    fetchQrCode();
  }, [isOpen, fetchQrCode]);

  const handleDownload = () => {
    if (!qrData?.qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-${qrData.roomName.replace(/\s+/g, '-')}.png`;
    link.href = qrData.qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white ppp-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 cok-primary-color" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h1v1h-1zM14 14h3v3h-3zM20 14h1v1h-1zM14 17h1v1h-1zM17 17h4v4h-4zM10 7h1v1h-1zM7 10h1v1H7zM19 10h1v1h-1zM10 19h1v1h-1z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">
              Room QR Code
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 ppp-lg transition-colors">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8"><SpiralLoader /></div>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 ppp-lg p-4 flex items-start gap-3">
                <FiAlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={fetchQrCode}
                className="w-full py-2.5 border border-blue-300 cok-btn-outlined text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <FiRefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          )}

          {qrData && !loading && (
            <>
              {/* Room Info */}
              <div className="bg-blue-50 border border-blue-200 ppp-lg p-3 text-center">
                <p className="text-sm font-bold text-blue-800 uppercase tracking-wide">{qrData.roomName}</p>
                <p className="text-xs text-blue-600 mt-0.5">{qrData.roomLocation}</p>
                {qrData.roomCapacity && (
                  <p className="text-xs text-blue-500 mt-0.5">Capacity: {qrData.roomCapacity}</p>
                )}
              </div>

              {/* QR Code Image */}
              <div className="flex justify-center py-3">
                <div className="border-2 border-gray-200 p-3 ppp-lg bg-white">
                  <img
                    src={qrData.qrCodeDataUrl}
                    alt={`QR Code for ${qrData.roomName}`}
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>

              {/* Attendance URL */}
              <div className="bg-gray-50 border border-gray-200 ppp-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Attendance URL</p>
                <p className="text-xs text-gray-400 break-all select-all">{qrData.attendanceUrl}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="flex-1 py-2.5 border cok-btn-outlined text-sm font-medium   ">
            Close
          </button>
          {qrData && !loading && (
            <button onClick={handleDownload}
              className="flex-1 py-2.5 cok-btn-primary text-white ppp-lg text-sm font-semibold  transition-all flex items-center justify-center gap-2">
              <FiDownload className="w-4 h-4" /> Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
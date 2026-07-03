// Logout Component - Confirmation dialog before logout
import React from 'react';
import { FiLogOut, FiAlertTriangle } from 'react-icons/fi';

interface LogoutProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const Logout: React.FC<LogoutProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-[400px] max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#fff3e0] rounded-full flex items-center justify-center mb-4">
              <FiAlertTriangle className="w-8 h-8 text-[#f57c00]" />
            </div>
            <h2 className="text-[#1a2744] text-[20px] font-bold">Confirm Logout</h2>
            <p className="text-[#666] text-[13px] mt-2">
              Are you sure you want to logout? Any unsaved changes will be lost.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 border border-[#e0e0e0] text-[#333] text-[14px] font-medium rounded-[8px] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 bg-[#e53935] text-white text-[14px] font-medium rounded-[8px] hover:bg-[#c62828]"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logout;

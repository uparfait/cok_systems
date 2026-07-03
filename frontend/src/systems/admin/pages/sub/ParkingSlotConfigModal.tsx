import React from 'react';
import { FiX, FiEdit } from 'react-icons/fi';

interface SlotConfig { totalSlots: number; staffReservedSlots: number; visitorReservedSlots: number; }

interface ParkingSlotConfigModalProps {
  show: boolean; slotConfig: SlotConfig; saving: boolean;
  onClose: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onSave: () => void;
}

const ParkingSlotConfigModal: React.FC<ParkingSlotConfigModalProps> = ({ show, slotConfig, saving, onClose, onChange, onSave }) => {
  if (!show) return null;
  const calculateRegularSlots = () => Math.max(0, slotConfig.totalSlots - slotConfig.staffReservedSlots - slotConfig.visitorReservedSlots);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white shadow-2xl w-full max-w-md mx-2 overflow-hidden border border-white/50">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <h3 className="text-sm font-bold text-gray-900">Parking Slot Configuration</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20"><FiX className="w-4 h-4 text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Total Slots</label><input type="number" name="totalSlots" value={slotConfig.totalSlots || ''} onChange={onChange} className="w-full px-3 py-2.5 border border-gray-200 text-sm" min={0} /><p className="text-xs text-gray-500 mt-1">Total parking capacity</p></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Staff Reserved Slots</label><input type="number" name="staffReservedSlots" value={slotConfig.staffReservedSlots || ''} onChange={onChange} className="w-full px-3 py-2.5 border border-gray-200 text-sm" min={0} /><p className="text-xs text-gray-500 mt-1">Slots reserved for staff</p></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Visitor Reserved Slots</label><input type="number" name="visitorReservedSlots" value={slotConfig.visitorReservedSlots || ''} onChange={onChange} className="w-full px-3 py-2.5 border border-gray-200 text-sm" min={0} /><p className="text-xs text-gray-500 mt-1">Slots reserved for visitors</p></div>
          <div className="p-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100"><div className="flex justify-between items-center"><span className="text-xs font-medium text-gray-700">Regular Available Slots:</span><span className="text-base font-bold text-blue-600">{calculateRegularSlots()}</span></div><p className="text-xs text-gray-500 mt-0.5">Total - Staff - Visitor Reserved</p></div>
        </div>
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 px-3 bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 px-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <><div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>Saving...</> : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingSlotConfigModal;
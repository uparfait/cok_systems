import React from 'react';
import { FiLoader } from 'react-icons/fi';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';

interface SlotConfig { totalSlots: number; staffReservedSlots: number; visitorReservedSlots: number; }

interface ParkingSlotConfigModalProps {
  show: boolean; slotConfig: SlotConfig; saving: boolean;
  onClose: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onSave: () => void;
}

const ParkingSlotConfigModal: React.FC<ParkingSlotConfigModalProps> = ({ show, slotConfig, saving, onClose, onChange, onSave }) => {
  const regularSlots = Math.max(0, slotConfig.totalSlots - slotConfig.staffReservedSlots - slotConfig.visitorReservedSlots);
  return (
    <OverlayShell
      open={show}
      title="Parking Slot Configuration"
      onClose={onClose}
      busy={saving}
      width="sm"
      footer={
        <button type="button" onClick={onSave} disabled={saving} className="cok-btn-primary flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <><FiLoader className="h-3.5 w-3.5 text-white animate-spin" />Saving...</> : 'Save Configuration'}
        </button>
      }
    >
      <div className="space-y-5">
        <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Total Slots</label><input type="number" name="totalSlots" value={slotConfig.totalSlots || ''} onChange={onChange} disabled={saving} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '12px' }} min={0} /><p className="text-xs text-gray-500 mt-1">Total parking capacity</p></div>
        <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Staff Reserved Slots</label><input type="number" name="staffReservedSlots" value={slotConfig.staffReservedSlots || ''} onChange={onChange} disabled={saving} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '12px' }} min={0} /><p className="text-xs text-gray-500 mt-1">Slots reserved for staff</p></div>
        <div><label className="text-xs font-semibold text-gray-700 mb-1.5 block">Visitor Reserved Slots</label><input type="number" name="visitorReservedSlots" value={slotConfig.visitorReservedSlots || ''} onChange={onChange} disabled={saving} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '12px' }} min={0} /><p className="text-xs text-gray-500 mt-1">Slots reserved for visitors</p></div>
        <div className="p-3 bg-[rgba(5,109,170,0.06)] border border-[#E0E0E0]"><div className="flex justify-between items-center"><span className="text-xs font-medium text-gray-700">Regular Available Slots:</span><span className="text-base font-bold text-[#056daa]">{regularSlots}</span></div></div>
      </div>
    </OverlayShell>
  );
};

export default ParkingSlotConfigModal;

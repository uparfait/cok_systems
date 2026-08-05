// Parking lot map — one cell per slot: red = occupied (hover shows plate), yellow = reserved, green = available
// Shared by the mayor overview dashboard and the gate registrar (smart parking) dashboard
import React, { useMemo, useState } from 'react';

const SLOT_COLORS = { occupied: 'rgb(246, 59, 59)', reserved: '#F5C542', available: '#4CAF50' } as const;
type SlotState = { id: string; status: keyof typeof SLOT_COLORS; plate?: string; who?: string };

const ParkingLotMap: React.FC<{ totalSlots: number; vehicles: any[]; reservations: any[] }> = ({ totalSlots, vehicles, reservations }) => {
  const slots = useMemo<SlotState[]>(() => {
    const n = Math.max(totalSlots, vehicles.length + reservations.length, 1);
    // Slots numbered COK1, COK2, ... shown in bays of 20
    const list: SlotState[] = Array.from({ length: n }, (_, i) => ({
      id: `COK${i + 1}`,
      status: 'available',
    }));
    const byId = new Map(list.map(s => [s.id, s]));
    const unplaced: any[] = [];
    // Vehicles whose recorded slot matches a COK number (e.g. "COK12" or "12") land exactly; the rest fill from the front
    vehicles.forEach(v => {
      const raw = String(v?.slot_number || '').replace(/\s+/g, '').toUpperCase();
      const target = byId.get(/^\d+$/.test(raw) ? `COK${raw}` : raw);
      if (target && target.status === 'available') Object.assign(target, { status: 'occupied', plate: v.plate_number, who: v.driver_name });
      else unplaced.push(v);
    });
    let head = 0;
    unplaced.forEach(v => {
      while (head < list.length && list[head].status !== 'available') head++;
      if (head < list.length) Object.assign(list[head], { status: 'occupied', plate: v.plate_number, who: v.driver_name });
    });
    // Reservations fill from the back so they cluster away from parked cars
    let tail = list.length - 1;
    reservations.forEach(r => {
      while (tail >= 0 && list[tail].status !== 'available') tail--;
      if (tail >= 0) Object.assign(list[tail], { status: 'reserved', plate: r.plate_number, who: r.visitor_name });
    });
    return list;
  }, [totalSlots, vehicles, reservations]);

  const hoverText = (s: SlotState) =>
    s.status === 'occupied' ? `${s.id} · Occupied ${s.plate || 'plate not recorded'}`
    : s.status === 'reserved' ? `${s.id} · Reserved${s.plate ? ` ${s.plate}` : ''}`
    : `${s.id} · Available`;

  const sections: SlotState[][] = [];
  for (let i = 0; i < slots.length; i += 20) sections.push(slots.slice(i, i + 20));
  const counts = {
    occupied: slots.filter(s => s.status === 'occupied').length,
    reserved: slots.filter(s => s.status === 'reserved').length,
    available: slots.filter(s => s.status === 'available').length,
  };

  // The lot renders as two pages of bays: the first half shows by default,
  // the second half after clicking Next
  const [page, setPage] = useState(0);
  const half = Math.ceil(sections.length / 2);
  const pageSections = page === 0 ? sections.slice(0, half) : sections.slice(half);
  const hasTwoPages = sections.length > 1;
  const firstSlot = (page === 0 ? 0 : half * 20) + 1;
  const lastSlot = Math.min((page === 0 ? half : sections.length) * 20, slots.length);

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.occupied }}></div>Occupied {counts.occupied}</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.reserved }}></div>Reserved {counts.reserved}</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.available }}></div>Available {counts.available}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {pageSections.map((sec, si) => (
          <div key={sec[0]?.id || si} className="bg-gray-100 p-1.5 grid grid-cols-10 gap-1">
            {sec.map(s => (
              <div key={s.id} className="relative group">
                <div className="w-3 h-6 cursor-pointer" style={{ backgroundColor: SLOT_COLORS[s.status] }}></div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[10px] px-2 py-1 z-20 pointer-events-none">
                  {hoverText(s)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {hasTwoPages && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">Section {page + 1} of 2 · slots COK{firstSlot}–COK{lastSlot}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(0)}
              className={`px-2.5 py-1 border text-xs ${page === 0 ? 'text-gray-300 border-gray-200 cursor-default' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
               Previous
            </button>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(1)}
              className={`px-2.5 py-1 border text-xs ${page === 1 ? 'text-gray-300 border-gray-200 cursor-default' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingLotMap;

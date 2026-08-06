// Parking lot map — one cell per slot: red = occupied (hover shows plate), yellow = reserved, green = available
// Shared by the mayor overview dashboard and the gate registrar (smart parking) dashboard
import React, { useMemo, useState } from 'react';

const SLOT_COLORS = { occupied: 'rgb(246, 59, 59)', reserved: '#F5C542', available: '#4CAF50' } as const;
type SlotState = { id: string; status: keyof typeof SLOT_COLORS; plate?: string; who?: string };

// compact renders smaller slot cells inside a capped, scrollable area so the map fits in a stat-card grid cell
const ParkingLotMap: React.FC<{ totalSlots: number; vehicles: any[]; reservations: any[]; compact?: boolean }> = ({ totalSlots, vehicles, reservations, compact }) => {
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

  // The lot renders paginated: full size shows the bays in two halves; compact shows
  // 2 bays (40 slots) per page so the card keeps the same height as its neighbors
  const [page, setPage] = useState(0);
  const baysPerPage = compact ? 2 : Math.ceil(sections.length / 2);
  const pageCount = Math.max(1, Math.ceil(sections.length / baysPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageSections = sections.slice(safePage * baysPerPage, (safePage + 1) * baysPerPage);
  const hasPages = pageCount > 1;
  const firstSlot = safePage * baysPerPage * 20 + 1;
  const lastSlot = Math.min((safePage * baysPerPage + pageSections.length) * 20, slots.length);

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.occupied }}></div>Occupied {counts.occupied}</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.reserved }}></div>Reserved {counts.reserved}</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5" style={{ backgroundColor: SLOT_COLORS.available }}></div>Available {counts.available}</div>
      </div>
      <div className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
        {pageSections.map((sec, si) => (
          <div key={sec[0]?.id || si} className={`bg-gray-100 grid grid-cols-10 ${compact ? 'p-1 gap-0.5' : 'p-1.5 gap-1'}`}>
            {sec.map(s => (
              <div key={s.id} className="relative group">
                <div className={`cursor-pointer ${compact ? 'w-2 h-4' : 'w-3 h-6'}`} style={{ backgroundColor: SLOT_COLORS[s.status] }}></div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[10px] px-2 py-1 z-20 pointer-events-none">
                  {hoverText(s)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {hasPages && (
        <div className={`flex items-center justify-between gap-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
          <span className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {compact ? `COK${firstSlot}–${lastSlot} · ${safePage + 1}/${pageCount}` : `Section ${safePage + 1} of ${pageCount} · slots COK${firstSlot}–COK${lastSlot}`}
          </span>
          <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(Math.max(0, safePage - 1))}
              className={`border ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${safePage === 0 ? 'text-gray-300 border-gray-200 cursor-default' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              {compact ? 'Prev' : 'Previous'}
            </button>
            <button
              type="button"
              disabled={safePage === pageCount - 1}
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              className={`border ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${safePage === pageCount - 1 ? 'text-gray-300 border-gray-200 cursor-default' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
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

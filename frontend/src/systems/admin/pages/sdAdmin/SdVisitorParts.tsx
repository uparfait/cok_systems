import React from 'react';
import { initialsOf, visitorValues } from './sdVisits';
import type { SdVisit, VisitorFigures } from './sdVisits';

const fontHeading = "'Montserrat', sans-serif";

export const VisitorCells: React.FC<{ visit: SdVisit }> = ({ visit }) => {
  const [name, idType, idNumber, telephone, email, gender, visits] = visitorValues(visit);
  return (
    <>
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 cok-bg-primary" style={{ fontFamily: fontHeading }}>
            {initialsOf(visit.full_name || '')}
          </div>
          <span className="text-[13px] font-medium cok-primary-color">{name}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-[#555555] text-[13px]">{idType}</td>
      <td className="py-3 px-3 text-[#555555] text-[13px] font-mono">{idNumber}</td>
      <td className="py-3 px-3 text-[#555555] text-[13px]">{telephone}</td>
      <td className="py-3 px-3 text-[#555555] text-[13px]">{email}</td>
      <td className="py-3 px-3 text-[#555555] text-[13px]">{gender}</td>
      <td className="py-3 px-3 text-[#333333] text-[13px] font-semibold">{visits}</td>
    </>
  );
};

interface VisitorFiguresRowProps {
  figures: VisitorFigures;
  loading?: boolean;
  uniqueHint?: string;
}

export const VisitorFiguresRow: React.FC<VisitorFiguresRowProps> = ({ figures, loading = false, uniqueHint = 'Today' }) => {
  const items = [
    { label: 'Registered Visitors', value: figures.registered_visitors, hint: 'People registered' },
    { label: 'Visitors In House', value: figures.visitors_in_house, hint: 'People inside now' },
    { label: 'Returning Visitors', value: figures.returning_visitors, hint: 'More than one visit' },
    { label: 'Unique Visitors', value: figures.unique_visitors, hint: uniqueHint },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-white border border-[#E0E0E0] p-4">
          <p className="text-xs text-[#9E9E9E]">{item.label}</p>
          {loading ? (
            <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" />
          ) : (
            <p className="text-xl font-bold text-[#333333] mt-0.5">{item.value ?? 0}</p>
          )}
          <p className="text-[11px] text-[#9E9E9E] mt-0.5">{item.hint}</p>
        </div>
      ))}
    </div>
  );
};

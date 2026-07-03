import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="bg-white border border-gray-200 p-5 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="flex-1"><div className="h-4 bg-gray-200 w-3/4 mb-3"></div><div className="h-8 bg-gray-200 w-1/2"></div></div>
      <div className="p-3 bg-gray-200 w-12 h-12"></div>
    </div>
  </div>
);

export const SkeletonTableRow: React.FC = () => (
  <tr className="border-b border-gray-50">
    {[1,2,3,4,5,6,7].map(i => <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 animate-pulse w-16"></div></td>)}
  </tr>
);
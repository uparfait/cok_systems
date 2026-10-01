import React from 'react';
import { driverTypeStyle } from './parkingRows';

const DriverTypeBadge: React.FC<{ type?: string | null }> = ({ type }) => {
  const style = driverTypeStyle(type);
  return (
    <span
      className="px-2.5 py-1 text-xs font-medium"
      style={{ borderRadius: 0, backgroundColor: style.background, color: style.color }}
    >
      {style.label}
    </span>
  );
};

export default DriverTypeBadge;

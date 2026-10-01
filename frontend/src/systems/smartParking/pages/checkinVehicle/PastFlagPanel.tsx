import React from 'react';
import { FiFlag } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import type { PastFlagInfo } from './vehicleCheckin';
import { DEFAULT_FLAG_REASON, formatFlagDate, formatFlagTime, formatMinutes } from './vehicleCheckin';

const DANGER = '#E74C3C';
const SUCCESS = '#4CAF50';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

interface PastFlagPanelProps {
  pastFlag: PastFlagInfo | null;
  loading: boolean;
}

const PastFlagPanel: React.FC<PastFlagPanelProps> = ({ pastFlag, loading }) => {
  const steps = pastFlag
    ? [
        { label: 'Entered', value: pastFlag.check_in, color: SUCCESS, fallback: '-' },
        { label: 'Flagged', value: pastFlag.flagged_at, color: DANGER, fallback: '-' },
        { label: 'Left', value: pastFlag.check_out, color: GRAY, fallback: 'Never checked out' },
      ]
    : [];

  return (
    <div className="bg-white" style={{ border: '1px solid rgba(231,76,60,0.35)', borderLeft: `4px solid ${DANGER}` }}>
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5" style={{ backgroundColor: 'rgba(231,76,60,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(231,76,60,0.14)' }}>
            <FiFlag className="w-4 h-4" style={{ color: DANGER }} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: DANGER, fontFamily: fontHeading, letterSpacing: '1px' }}>Previously flagged</p>
            <p className="text-xs text-gray-600">{pastFlag?.flag_reason || DEFAULT_FLAG_REASON}</p>
          </div>
        </div>
        {pastFlag && pastFlag.count > 0 ? (
          <span className="shrink-0 px-2 py-1 text-xs font-bold whitespace-nowrap text-white" style={{ backgroundColor: DANGER, fontFamily: fontHeading }}>
            {pastFlag.count}x flagged
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 text-xs text-gray-600">
          <SpiralLoader color={DANGER} padded={false} size={14} />
          Loading flag details...
        </div>
      ) : pastFlag && (pastFlag.flagged_at || pastFlag.total_duration_minutes != null) ? (
        <div className="px-3 sm:px-4 py-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5" style={{ backgroundColor: NEUTRAL_LIGHT }}>
              <p className="text-[10px] uppercase font-semibold" style={{ color: GRAY, letterSpacing: '0.5px' }}>Time parked</p>
              <p className="text-base sm:text-lg font-bold leading-tight" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{formatMinutes(pastFlag.total_duration_minutes)}</p>
            </div>
            <div className="p-2.5" style={{ backgroundColor: 'rgba(231,76,60,0.08)' }}>
              <p className="text-[10px] uppercase font-semibold" style={{ color: DANGER, letterSpacing: '0.5px' }}>Overstayed by</p>
              <p className="text-base sm:text-lg font-bold leading-tight" style={{ color: DANGER, fontFamily: fontHeading }}>{formatMinutes(pastFlag.overstay_minutes)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-center relative">
            <div className="absolute left-[16%] right-[16%] top-1.25 h-px" style={{ backgroundColor: BORDER }} />
            {steps.map((step) => (
              <div key={step.label} className="relative">
                <span className="block w-2.5 h-2.5 rounded-full mx-auto mb-1.5 relative z-10" style={{ backgroundColor: step.color, boxShadow: '0 0 0 2px #FFFFFF' }} />
                <p className="text-[10px] uppercase font-semibold" style={{ color: step.color, letterSpacing: '0.5px' }}>{step.label}</p>
                {step.value ? (
                  <>
                    <p className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{formatFlagDate(step.value)}</p>
                    <p className="text-[11px] text-gray-600">{formatFlagTime(step.value)}</p>
                  </>
                ) : (
                  <p className="text-[11px] italic text-gray-600">{step.fallback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-3 sm:px-4 py-3 text-xs text-gray-600">It overstayed its allowed parking time on a previous visit. Please verify the driver before allowing entry.</p>
      )}
    </div>
  );
};

export default PastFlagPanel;

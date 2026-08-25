import { useEffect, useRef } from "react";
import { FiCheckCircle } from "react-icons/fi";
import {
  PRIMARY, SUCCESS, BORDER, GRAY_DISABLED, fontHeading,
} from "./TrackShared";

const buildSteps = (eventMeetingType) => [
  { step: 1, label: `${eventMeetingType === "meet" ? "Meeting" : "Event"} Info` }, { step: 2, label: "Organizer" },
  { step: 3, label: "Schedule" }, { step: 4, label: "Location" }, { step: 5, label: "Agenda" },
];

export default function EventStepper({ currentStep, eventMeetingType, onStepClick, completedSteps }) {
  const showAgenda = eventMeetingType === "meet";
  const steps = buildSteps(eventMeetingType);
  const activeSteps = showAgenda ? steps : steps.filter((s) => s.step < 5);
  const scrollRef = useRef(null);
  const stepRefs = useRef({});

  useEffect(() => {
    const el = stepRefs.current[currentStep];
    const container = scrollRef.current;
    if (el && container) {
      const scrollLeft = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentStep, activeSteps.length]);

  return (
    <div
      ref={scrollRef}
      className="cok-stepper-scroll flex items-center justify-start sm:justify-center gap-1 sm:gap-0 overflow-x-auto touch-pan-x px-3 sm:px-6 py-3"
      style={{ backgroundColor: '#FFFFFF', borderBottom: `1px solid ${BORDER}`, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
    >
      {activeSteps.map((s, idx) => {
        const done = currentStep > s.step;
        const active = currentStep === s.step;
        const canClick = completedSteps.includes(s.step) || done;
        return (
          <div key={s.step} ref={(el) => (stepRefs.current[s.step] = el)} className="flex items-center shrink-0">
            <button type="button" disabled={!canClick} onClick={() => canClick && onStepClick(s.step)}
              className="flex flex-col items-center justify-center gap-1 transition-all cursor-pointer">
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : '#E0E0E0', color: done || active ? '#FFFFFF' : GRAY_DISABLED, borderRadius: '50%' }}>
                {done ? <FiCheckCircle className="w-4 h-4" /> : s.step}
              </div>
              <span className="block text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap mt-1"
                style={{ color: done ? SUCCESS : active ? PRIMARY : GRAY_DISABLED, fontFamily: fontHeading }}>{s.label}</span>
            </button>
            {idx < activeSteps.length - 1 && (
              <div className="h-0.5 w-4 sm:w-12 mx-1 mb-4 transition-all duration-300"
                style={{ backgroundColor: currentStep > s.step ? SUCCESS : BORDER }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

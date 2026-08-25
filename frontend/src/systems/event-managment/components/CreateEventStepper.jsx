import { FiCheck } from "react-icons/fi";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

export default function CreateEventStepper({
  currentStep,
  eventMeetingType,
  eventMode,
  onStepClick,
  completedSteps = [],
}) {
  const typeLabel = eventMeetingType === "meet" ? "Meeting" : "Event";
  const STEPS = [
    { step: 1, label: `${typeLabel} Info` },
    { step: 2, label: "Organizer" },
    { step: 3, label: "Schedule" },
    { step: 4, label: "Location" },
    { step: 5, label: "Agenda" },
  ];
  const showAgenda = eventMeetingType === "meet";
  const activeSteps = showAgenda ? STEPS : STEPS.filter((s) => s.step < 5);

  return (
    <div className="flex items-center justify-center px-6 py-5 bg-white border-b border-gray-200">
      {activeSteps.map((s, idx) => {
        const done = currentStep > s.step;
        const active = currentStep === s.step;
        const canClick = !!onStepClick && (completedSteps.includes(s.step) || done);
        return (
          <div key={s.step} className="flex items-center">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(s.step)}
              className="flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : BORDER, color: done || active ? WHITE : GRAY_DISABLED, borderRadius: '50%' }}
              >
                {done ? <FiCheck className="w-4 h-4" /> : s.step}
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                style={{ color: done ? SUCCESS : active ? PRIMARY : GRAY_DISABLED, fontFamily: fontHeading }}
              >
                {s.label}
              </span>
            </button>
            {idx < activeSteps.length - 1 && (
              <div
                className="h-0.5 w-6 sm:w-12 mx-1 mb-4 transition-all duration-300"
                style={{ backgroundColor: currentStep > s.step ? SUCCESS : BORDER }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

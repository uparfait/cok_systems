import { FiCheck } from "react-icons/fi";

export default function CreateEventStepper({
  currentStep,
  eventMeetingType,
  eventMode,
}) {
  const STEPS = [
    { step: 1, label: `${eventMeetingType} Info` },
    { step: 2, label: "Organizer" },
    { step: 3, label: "Schedule" },
    { step: 4, label: "Room" },
    { step: 5, label: "Agenda" },
  ];
  const showAgenda = eventMeetingType === "meet";
  const activeSteps = showAgenda ? STEPS : STEPS.filter((s) => s.step < 5);

  return (
    <div className="flex items-center justify-center px-6 py-5 bg-white border-b border-gray-200">
      {activeSteps.map((s, idx) => {
        const done = currentStep > s.step;
        const active = currentStep === s.step;
        return (
          <div key={s.step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all duration-300
                ${done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}
              >
                {done ? <FiCheck className="w-4 h-4" /> : s.step}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap
                ${done ? "text-green-600" : active ? "text-blue-600" : "text-gray-400"}`}
              >
                {s.label}
              </span>
            </div>
            {idx < activeSteps.length - 1 && (
              <div
                className={`h-0.5 w-6 sm:w-12 mx-1 mb-4 transition-all duration-300
                ${currentStep > s.step ? "bg-green-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

import React, { useState } from "react";
import { FiX, FiHelpCircle } from "react-icons/fi";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

interface VisitorCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (helpGiven: string) => void;
  visitorName?: string;
  completing: boolean;
}

const VisitorCompleteModal: React.FC<VisitorCompleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  visitorName,
  completing,
}) => {
  const [helpGiven, setHelpGiven] = useState("");

  const handleConfirm = () => {
    onConfirm(helpGiven);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center cok-logout-overlay">
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl flex flex-col"
        style={{ borderRadius: 0 }}
      >
        <div
          className="sticky top-0 z-20 cok-bg-primary px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between"
          style={{ borderRadius: 0 }}
        >
          <h2
            className="text-white font-bold text-lg sm:text-xl uppercase tracking-wide"
            style={{
              fontFamily: "var(--cok-font-heading)",
              letterSpacing: "1px",
            }}
          >
            Complete Visit
          </h2>
          <button
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: "0.4rem 0.8rem" }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="cok-auth-label">Visitor</label>
            <div className="flex items-center gap-2 mt-1">
              <FiHelpCircle
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "#9CA3AF" }}
              />
              <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                {visitorName || "---"}
              </span>
            </div>
          </div>

          <div>
            <label className="cok-auth-label">Help Given</label>
            <textarea
              value={helpGiven}
              onChange={(e) => setHelpGiven(e.target.value)}
              placeholder="Describe the help provided to this visitor..."
              className="cok-auth-input w-full min-h-[100px] resize-y"
              style={{ fontFamily: fontHeading, fontSize: "14px", color: NEUTRAL_DARK }}
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: "#E0E0E0" }}>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cok-btn-outlined w-full sm:w-auto"
              style={{ padding: "0.7rem 1.2rem" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={completing}
              className="cok-btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{ padding: "0.7rem 1.2rem" }}
            >
              {completing ? <SpiralLoader color="#FFFFFF" /> : null}
              {completing ? "Completing..." : "Confirm Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitorCompleteModal;

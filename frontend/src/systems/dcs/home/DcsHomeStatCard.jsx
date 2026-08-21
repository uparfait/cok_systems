import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useCountUp } from "./useCountUp.js";

function OfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.2" style={{ flexShrink: 0 }}>
      <path d="M2 8.5a15 15 0 0120 0" />
      <path d="M5.5 12.5a10 10 0 0113 0" />
      <path d="M9 16.5a5 5 0 016 0" />
      <circle cx="12" cy="20" r="1" fill="#4CAF50" stroke="none" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

// Eight sparks fired outward in a full circle, three alternating colors so
// it reads as a small firework rather than a single-color blip.
const SPARK_COLORS = ["#056daa", "#F5A623", "#4CAF50"];
const SPARK_COUNT = 8;
const SPARK_RADIUS_PX = 34;

function StatSparkBurst() {
  return (
    <span className="dcs-home-stat-spark-wrap" aria-hidden="true">
      {Array.from({ length: SPARK_COUNT }).map((_, index) => {
        const angle = (index / SPARK_COUNT) * Math.PI * 2;
        const tx = Math.round(Math.cos(angle) * SPARK_RADIUS_PX);
        const ty = Math.round(Math.sin(angle) * SPARK_RADIUS_PX);
        return (
          <span
            key={index}
            className="dcs-home-stat-spark"
            style={{
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
              "--sd": `${index * 0.03}s`,
              backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length],
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * One About-section stat - a numeric value (20+, 100%) counts up from 0
 * the moment the section drops into view over several seconds; a
 * non-numeric one (e.g. "Versioned") just renders as-is, unanimated. The
 * instant it finishes counting, a small one-off spark burst fires around
 * it, then it settles - no ongoing animation afterward. showOffline adds a
 * small wifi-off badge next to the label, for the one stat that's actually
 * claiming offline capability rather than just saying the word.
 */
export default function DcsHomeStatCard({ valueKey, labelKey, isActive, showOffline, className }) {
  const { translate } = useDcsLanguage();
  const { text, done } = useCountUp(translate(valueKey), isActive);

  return (
    <div className={className}>
      <span className="dcs-home-stat-value font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontSize: "1.8rem" }}>
        {text}
        {done && <StatSparkBurst />}
      </span>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
        {showOffline && <OfflineIcon />}
        {translate(labelKey)}
      </span>
    </div>
  );
}

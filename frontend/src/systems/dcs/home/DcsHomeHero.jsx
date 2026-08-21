import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import heroBackground from "../../../assets/fixed-bg.jpg";

const ROTATOR_KEYS = ["DCS_HOME_HERO_LINE_1", "DCS_HOME_HERO_LINE_2", "DCS_HOME_HERO_LINE_3", "DCS_HOME_HERO_LINE_4"];
const ROTATE_INTERVAL_MS = 3200;

function WaveDivider() {
  return (
    <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none" style={{ height: 90 }}>
      <svg className="dcs-home-wave-layer dcs-home-wave-layer--back" viewBox="0 0 1600 90" preserveAspectRatio="none">
        <path
          d="M0 45 C 100 90, 200 0, 300 45 S 500 90, 600 45 S 700 0, 800 45 L 800 90 L 0 90 Z
             M800 45 C 900 90, 1000 0, 1100 45 S 1300 90, 1400 45 S 1500 0, 1600 45 L 1600 90 L 800 90 Z"
          fill="#FFFFFF"
        />
      </svg>
      <svg className="dcs-home-wave-layer dcs-home-wave-layer--front" viewBox="0 0 1600 90" preserveAspectRatio="none">
        <path
          d="M0 60 C 120 10, 220 100, 340 55 S 520 10, 640 55 S 720 100, 800 60 L 800 90 L 0 90 Z
             M800 60 C 920 10, 1020 100, 1140 55 S 1320 10, 1440 55 S 1520 100, 1600 60 L 1600 90 L 800 90 Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

/**
 * Full-viewport-height opener: the fixed illustration behind everything,
 * a translated headline that cycles through the system's four pillars,
 * and a water-like wave strip that hands off cleanly into the next
 * section's white background.
 */
export default function DcsHomeHero() {
  const { translate } = useDcsLanguage();
  const [active_index, setActiveIndex] = useState(0);
  // The line that just stopped being active keeps rendering (with the
  // is-leaving class) for exactly as long as its own CSS transition takes,
  // so it visibly sinks and fades out below instead of snapping straight
  // to the same "waiting above" position the next-up line starts from.
  const [leaving_index, setLeavingIndex] = useState(null);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      setActiveIndex((previous) => {
        setLeavingIndex(previous);
        window.setTimeout(() => setLeavingIndex((current) => (current === previous ? null : current)), 750);
        return (previous + 1) % ROTATOR_KEYS.length;
      });
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
  }, []);

  return (
    <section
      className="dcs-home-hero relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: "82vh", "--dcs-home-hero-image": `url(${heroBackground})` }}
    >
      <div className="dcs-home-hero-overlay absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 sm:px-8" style={{ maxWidth: 900 }}>
        <span
          className="text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase"
          style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Montserrat', sans-serif" }}
        >
          {translate("DCS_HEADER_TITLE")}
        </span>

        <div className="dcs-home-rotator w-full" style={{ height: "clamp(120px, 22vw, 190px)" }}>
          {ROTATOR_KEYS.map((key, index) => (
            <h1
              key={key}
              className={`dcs-home-rotator-line text-center font-bold px-2 ${
                index === active_index ? "is-active" : index === leaving_index ? "is-leaving" : ""
              }`}
              style={{
                color: "#FFFFFF",
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "clamp(1.6rem, 4.4vw, 3.1rem)",
                lineHeight: 1.15,
              }}
            >
              {translate(key)}
            </h1>
          ))}
        </div>

        <p
          className="text-center max-w-xl"
          style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'Montserrat', sans-serif", fontSize: "1rem" }}
        >
          {translate("DCS_HOME_HERO_SUBTITLE")}
        </p>
      </div>

      <div className="absolute z-10 flex flex-col items-center gap-1" style={{ bottom: 96, color: "rgba(255,255,255,0.75)" }}>
        <span className="text-xs uppercase tracking-widest" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_HOME_SCROLL_HINT")}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dcs-home-float">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <WaveDivider />
    </section>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const CARD_KEYS = ["DCS_HOME_HERO_LINE_1", "DCS_HOME_HERO_LINE_2", "DCS_HOME_HERO_LINE_3", "DCS_HOME_HERO_LINE_4"];
const ROTATE_INTERVAL_MS = 4000;
const WAVE_HEIGHT_PX = 52;
// Matches .dcs-hero-cursor-bubble's own disturb-animation duration in
// globals.css - the class comes off again right as that one-shot
// animation finishes, handing control back to the regular infinite bob.
const DISTURB_DURATION_MS = 700;
// Fixed positions around the cursor (not random - Math.random isn't
// available at module scope here, and a fixed ring looks just as
// "bobbling" once each one is animating on its own phase-shifted delay).
const CURSOR_BUBBLES = Array.from({ length: 6 }).map((_, i) => {
  const angle = (i / 6) * Math.PI * 2;
  return {
    size: 12 + (i % 3) * 8,
    offsetX: Math.round(Math.cos(angle) * 26),
    offsetY: Math.round(Math.sin(angle) * 26),
    delay: (i * 0.3).toFixed(2),
  };
});

function CursorBubbles({ bubblesRef, isActive, isDisturbed }) {
  return (
    <div
      ref={bubblesRef}
      className={`dcs-hero-cursor-bubbles absolute inset-0 pointer-events-none ${isActive ? "is-active" : ""} ${isDisturbed ? "is-disturbed" : ""}`}
      style={{ zIndex: 20 }}
      aria-hidden="true"
    >
      {CURSOR_BUBBLES.map((bubble, i) => (
        <span
          key={i}
          className="dcs-hero-cursor-bubble"
          style={{
            "--bubble-size": `${bubble.size}px`,
            "--bubble-offset-x": `${bubble.offsetX}px`,
            "--bubble-offset-y": `${bubble.offsetY}px`,
            "--bubble-delay": `${bubble.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function WaveDivider() {
  return (
    <div
      className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none"
      style={{ height: WAVE_HEIGHT_PX, zIndex: 6 }}
    >
      <svg className="dcs-home-wave-layer dcs-home-wave-layer--back" viewBox="0 0 1600 90" preserveAspectRatio="none">
        <path
          d="M0 45 C 100 90, 200 0, 300 45 S 500 90, 600 45 S 700 0, 800 45 L 800 90 L 0 90 Z
             M800 45 C 900 90, 1000 0, 1100 45 S 1300 90, 1400 45 S 1500 0, 1600 45 L 1600 90 L 800 90 Z"
          fill="#9CCBEA"
        />
      </svg>
      <svg className="dcs-home-wave-layer dcs-home-wave-layer--front" viewBox="0 0 1600 90" preserveAspectRatio="none">
        <path
          d="M0 60 C 120 10, 220 100, 340 55 S 520 10, 640 55 S 720 100, 800 60 L 800 90 L 0 90 Z
             M800 60 C 920 10, 1020 100, 1140 55 S 1320 10, 1440 55 S 1520 100, 1600 60 L 1600 90 L 800 90 Z"
          fill="#056daa"
        />
      </svg>
    </div>
  );
}

/**
 * Hero opener: a light dot-grid backdrop, in the system's own primary
 * blue, pinned to the viewport (background-attachment: fixed on its own
 * dedicated div, not the section - see .dcs-hero-grid-background) so
 * later sections visibly stack over it while scrolling, the same way the
 * old photo did. A small header + description sit on the left, and the
 * system's four pillars cycle through on the right as a fanned stack of
 * cards, like a hand of playing cards - every 4 seconds the front card
 * steps back into the stack and the next one steps forward to the front.
 */
export default function DcsHomeHero() {
  const { translate } = useDcsLanguage();
  const [active_index, setActiveIndex] = useState(0);
  const [is_cursor_active, setIsCursorActive] = useState(false);
  const [is_disturbed, setIsDisturbed] = useState(false);
  // Position is written straight to the DOM (a CSS custom property on the
  // bubbles layer, inherited by every bubble inside it) rather than kept
  // in React state - a mousemove handler firing dozens of times a second
  // has no business triggering a full re-render on every pixel.
  const bubbles_ref = useRef(null);
  const disturb_timeout_ref = useRef(null);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % CARD_KEYS.length);
    }, ROTATE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval_id);
      if (disturb_timeout_ref.current) window.clearTimeout(disturb_timeout_ref.current);
    };
  }, []);

  const handle_mouse_move = (event) => {
    if (!bubbles_ref.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    bubbles_ref.current.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
    bubbles_ref.current.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
  };

  // A click "disturbs" the water - every bubble scatters outward from the
  // cursor and settles back, then the class comes off so the normal
  // gentle bob resumes. Re-triggering mid-scatter (another click before
  // the timeout fires) just restarts the same one-shot animation cleanly
  // rather than layering a second timeout on top of the first.
  const handle_click = () => {
    if (disturb_timeout_ref.current) window.clearTimeout(disturb_timeout_ref.current);
    setIsDisturbed(true);
    disturb_timeout_ref.current = window.setTimeout(() => setIsDisturbed(false), DISTURB_DURATION_MS);
  };

  return (
    <section
      className="dcs-home-hero relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: "calc(100vh - 100px)" }}
      onMouseMove={handle_mouse_move}
      onMouseEnter={() => setIsCursorActive(true)}
      onMouseLeave={() => setIsCursorActive(false)}
      onClick={handle_click}
    >
      <div className="dcs-hero-grid-background absolute inset-0" style={{ zIndex: 1 }} />
      <CursorBubbles bubblesRef={bubbles_ref} isActive={is_cursor_active} isDisturbed={is_disturbed} />

      <div
        className="dcs-home-hero-enter relative z-10 w-full flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 lg:gap-16 px-4 sm:px-8"
        style={{ maxWidth: 1180, margin: "0 auto" }}
      >
        <div className="flex flex-col items-center lg:items-start gap-3 text-center lg:text-left" style={{ maxWidth: 380 }}>
          <span
            className="uppercase"
            style={{
              color: "#056daa",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
              letterSpacing: "0.02em",
              fontSize: "clamp(1.2rem, 3.6vw, 2.4rem)",
              whiteSpace: "nowrap",
            }}
          >
            {translate("DCS_HEADER_TITLE")}
          </span>
          <p
            style={{
              color: "#1F2937",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "clamp(0.9rem, 1.5vw, 1rem)",
              lineHeight: 1.6,
            }}
          >
            {translate("DCS_HOME_HERO_SUBTITLE")}
          </p>
        </div>

        <div
          className="dcs-hero-card-stack flex-shrink-0"
          // Targets ~70% of the hero's own height (calc(100vh - 100px), see
          // the section below) directly via vh math rather than a percent
          // height, since this div's actual parent is a flex row sized to
          // its content (auto height) - a plain "70%" would have nothing
          // definite to resolve against and silently fall back to auto.
          // clamped so it never gets absurdly huge on a tall desktop
          // viewport or too small to read on a short phone one.
          style={{ height: "clamp(260px, calc((100vh - 100px) * 0.7), 480px)", aspectRatio: "3 / 4" }}
        >
          {CARD_KEYS.map((key, index) => {
            // 0 for whichever card is currently at the front; 1, 2, 3 for
            // the rest, in the order they'll each reach the front next -
            // CSS reads this to fan each card further back/to the side the
            // higher it is, so the whole stack visibly reshuffles (not
            // just the front card changing) every time active_index ticks
            // over.
            const fan_index = (index - active_index + CARD_KEYS.length) % CARD_KEYS.length;
            return (
              <div key={key} className="dcs-hero-card" style={{ "--fan-i": fan_index }}>
                <span
                  className="absolute"
                  style={{
                    top: "0.75rem",
                    left: "0.9rem",
                    color: "#056daa",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    letterSpacing: "0.05em",
                    opacity: 0.6,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="uppercase"
                  style={{
                    color: "#056daa",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "clamp(0.95rem, 1.9vw, 1.25rem)",
                    lineHeight: 1.35,
                  }}
                >
                  {translate(key)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* In normal flow (not absolutely positioned) below lg: the hero's
          content stacks vertically there (header block, then the now-taller
          portrait card stack), so a fixed bottom offset would just as
          easily land the hint on top of the cards as below them depending
          on how tall that stack happens to be. Only pinned to a fixed
          bottom offset once the two-column layout (lg:) actually leaves a
          clear horizontal band underneath everything for it. */}
      <div
        className="dcs-home-hero-enter dcs-home-hero-enter-delay static lg:absolute z-10 flex flex-col items-center gap-1 mt-8 lg:mt-0 lg:bottom-24"
        style={{ color: "#056daa" }}
      >
        <span className="text-xs uppercase tracking-widest" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_HOME_SCROLL_HINT")}
        </span>
        <span className="dcs-home-scroll-chevrons">
          <svg width="18" height="10" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 2 12 11 21 2" />
          </svg>
          <svg width="18" height="10" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 2 12 11 21 2" />
          </svg>
        </span>
      </div>

      <WaveDivider />
    </section>
  );
}

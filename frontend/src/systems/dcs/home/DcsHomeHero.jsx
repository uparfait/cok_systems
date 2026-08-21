import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsHeroLamp from "./DcsHeroLamp.jsx";
import heroBackground from "../../../assets/fixed-bg.jpg";

const ROTATOR_KEYS = ["DCS_HOME_HERO_LINE_1", "DCS_HOME_HERO_LINE_2", "DCS_HOME_HERO_LINE_3", "DCS_HOME_HERO_LINE_4"];
const ROTATE_INTERVAL_MS = 3200;
const HERO_GAP_PX = 24;
const WAVE_HEIGHT_PX = 52;
// The stagger repeats every 8 letters rather than growing for the whole
// sentence - these headlines run 25-40 characters long, and a delay that
// just kept increasing would put the last few letters starting their
// bounce seconds after the first, reading as unsynchronized rather than a
// single wave rippling through the line.
const LETTER_STAGGER_CYCLE = 8;
const LETTER_STAGGER_STEP_S = 0.12;

/**
 * Splits one headline into per-letter spans so CSS can bounce each one in a
 * staggered wave while its line is active. The parent <h1> is a flex
 * container (for centering) - flexbox drops whitespace-only text runs
 * between flex items entirely, which silently ate every space between
 * words, so a plain space character is swapped for a non-breaking one here
 * (never collapsed/dropped) instead of a literal " ".
 */
function render_animated_letters(text) {
  return Array.from(text).map((character, index) => {
    if (character === " ") return " ";
    const delay = (index % LETTER_STAGGER_CYCLE) * LETTER_STAGGER_STEP_S;
    return (
      <span key={index} className="dcs-home-letter-wave" style={{ "--d": `${delay}s` }}>
        {character}
      </span>
    );
  });
}

function WaveDivider() {
  return (
    <div
      className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none"
      // Explicit z-index: the fallback lamp behind it also sets one
      // (z-index: 1), and an element with any positive z-index paints
      // above a plain z-index:auto sibling regardless of DOM order - left
      // unset, the wave would silently end up hidden behind the lamp
      // whenever the fallback is showing.
      style={{ height: WAVE_HEIGHT_PX, zIndex: 6 }}
    >
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
  // "loading" and "error" both mean the same thing visually - show the
  // dark gradient + lamp fallback - the only difference is whether we're
  // still waiting or have given up for good. Preloaded via a plain Image
  // rather than an <img> tag, since nothing about this needs to be in the
  // DOM - only whether it succeeded.
  const [image_status, setImageStatus] = useState("loading");
  const [active_index, setActiveIndex] = useState(0);
  // The line that just stopped being active keeps rendering (with the
  // is-leaving class) for exactly as long as its own CSS transition takes,
  // so it visibly sinks and fades out below instead of snapping straight
  // to the same "waiting above" position the next-up line starts from.
  const [leaving_index, setLeavingIndex] = useState(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImageStatus("loaded");
    image.onerror = () => setImageStatus("error");
    image.src = heroBackground;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

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
      className={`dcs-home-hero relative flex flex-col items-center justify-center overflow-hidden ${image_status === "loaded" ? "has-bg-image" : ""}`}
      // 100vh alone overflows past what's actually visible before
      // scrolling - the header (h-16 = 64px) plus the slim sub-header
      // beneath it (~51px) sit above <main> and eat into that same
      // viewport, so the hero (and the wave pinned to its own bottom
      // edge) must shrink by that same amount to stay fully in view on
      // first load, before any scrolling happens.
      style={{ minHeight: "calc(100vh - 115px)", "--dcs-home-hero-image": `url(${heroBackground})` }}
    >
      {image_status !== "loaded" && <DcsHeroLamp />}
      <div className="dcs-home-hero-overlay absolute inset-0" style={{ zIndex: 5 }} />

      <div
        className="dcs-home-hero-enter relative z-10 flex flex-col items-center px-4 sm:px-8"
        style={{ maxWidth: 900 }}
      >
        <span
          className="text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase"
          style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Montserrat', sans-serif", marginBottom: HERO_GAP_PX }}
        >
          {translate("DCS_HEADER_TITLE")}
        </span>

        {/* Sized to one line's own line-height (not a viewport-relative
            guess independent of the font-size clamp) so the empty space
            the flex-centered rotator lines leave above/below their visible
            text stays tiny and symmetric - the label-to-rotator gap above
            and the rotator-to-subtitle gap below both come out to exactly
            HERO_GAP_PX either way. */}
        <div
          className="dcs-home-rotator w-full"
          style={{ height: "calc(clamp(1.6rem, 4.4vw, 3.1rem) * 1.15)", marginBottom: HERO_GAP_PX }}
        >
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
                whiteSpace: "nowrap",
              }}
            >
              {render_animated_letters(translate(key))}
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

      <div
        className="dcs-home-hero-enter dcs-home-hero-enter-delay absolute z-10 flex flex-col items-center gap-1"
        style={{ bottom: 96, color: "#FFFFFF" }}
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

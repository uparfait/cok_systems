import React from "react";

/**
 * Decorative hanging lamp shown behind the hero's text whenever the real
 * background photo isn't up yet (still loading, or failed outright) - so
 * the hero never shows a flat, empty background while waiting. Always
 * rendered lit and fully static (no swing, no ray rotation) - this is a
 * fallback visual, not an interactive toy, and it must read as calm and
 * intentional rather than distracting.
 */
export default function DcsHeroLamp() {
  return (
    <div className="dcs-hero-lamp" aria-hidden="true">
      <div className="dcs-hero-lamp-container">
        <div className="dcs-hero-lamp-rope" />
        <div className="dcs-hero-lamp-top" />

        <div className="dcs-hero-lamp-base" />
        <div className="dcs-hero-lamp-base" />
        <div className="dcs-hero-lamp-shadow-l1" />
        <div className="dcs-hero-lamp-shadow-l2" />
        <div className="dcs-hero-lamp-left-glow" />
        <div className="dcs-hero-lamp-left-glow2" />
        <div className="dcs-hero-lamp-r-glow" />
        <div className="dcs-hero-lamp-r-glow2" />
        <div className="dcs-hero-lamp-mid-ring" />
        <div className="dcs-hero-lamp-mid-ring dcs-hero-lamp-mid-ring--small" />

        <div className="dcs-hero-lamp-glow" />
        <div className="dcs-hero-lamp-glow2" />

        <div className="dcs-hero-lamp-buff-t" />
        <div className="dcs-hero-lamp-buff" />

        <div className="dcs-hero-lamp-btm" />
        <div className="dcs-hero-lamp-btm2" />

        <div className="dcs-hero-lamp-ring-container">
          <div className="dcs-hero-lamp-ring" />
          <div className="dcs-hero-lamp-rays" />
        </div>

        <div className="dcs-hero-lamp-volumetric">
          <div className="dcs-hero-lamp-vl" />
          <div className="dcs-hero-lamp-vr" />
        </div>
      </div>
      <div className="dcs-hero-lamp-grain" />
    </div>
  );
}

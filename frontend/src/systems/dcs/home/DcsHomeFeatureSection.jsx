import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useScrollReveal } from "./useScrollReveal.js";

/**
 * One full-bleed feature section: title/body/bullets on one side, a
 * self-drawn illustration on the other, alternating sides down the page so
 * the whole home page has visual rhythm instead of four identical rows.
 * Drops into place (never fixed) the first time it enters the viewport.
 */
export default function DcsHomeFeatureSection({ titleKey, bodyKey, bulletKeys, badgeKey, Illustration, reverse, tinted }) {
  const { translate } = useDcsLanguage();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      className={`relative flex items-center justify-center px-4 sm:px-8 py-16 ${tinted ? "" : "bg-white"}`}
      style={{ minHeight: "78vh", backgroundColor: tinted ? "#F7FBFE" : undefined }}
    >
      <div
        ref={ref}
        className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        style={{ maxWidth: 1080 }}
      >
        <div
          className={`dcs-home-reveal ${isVisible ? "is-visible" : ""} flex flex-col gap-5 ${reverse ? "lg:order-2" : ""}`}
        >
          {badgeKey && (
            <span
              className="self-start text-xs font-semibold uppercase tracking-wide px-3 py-1"
              style={{ color: "#F5A623", backgroundColor: "rgba(245,166,35,0.12)" }}
            >
              {translate(badgeKey)}
            </span>
          )}
          <h3
            className="font-bold"
            style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.4rem, 2.8vw, 2rem)" }}
          >
            {translate(titleKey)}
          </h3>
          <p style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", fontSize: "1rem", lineHeight: 1.7 }}>
            {translate(bodyKey)}
          </p>
          <ul className="flex flex-col gap-3 mt-2">
            {bulletKeys.map((bullet_key) => (
              <li key={bullet_key} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "rgba(5,109,170,0.12)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "0.95rem", lineHeight: 1.5 }}>
                  {translate(bullet_key)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`dcs-home-reveal dcs-home-reveal-delay-1 ${isVisible ? "is-visible" : ""} dcs-home-glass-card--tint flex items-center justify-center p-6 ${reverse ? "lg:order-1" : ""}`}
          style={{ minHeight: 280 }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>
            <Illustration />
          </div>
        </div>
      </div>
    </section>
  );
}

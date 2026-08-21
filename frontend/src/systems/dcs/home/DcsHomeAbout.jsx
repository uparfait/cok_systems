import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useScrollReveal } from "./useScrollReveal.js";
import DcsHomeStatCard from "./DcsHomeStatCard.jsx";

const STAT_KEYS = [
  { valueKey: "DCS_HOME_ABOUT_STAT_1_VALUE", labelKey: "DCS_HOME_ABOUT_STAT_1_LABEL" },
  { valueKey: "DCS_HOME_ABOUT_STAT_2_VALUE", labelKey: "DCS_HOME_ABOUT_STAT_2_LABEL", showOffline: true },
  { valueKey: "DCS_HOME_ABOUT_STAT_3_VALUE", labelKey: "DCS_HOME_ABOUT_STAT_3_LABEL" },
];

export default function DcsHomeAbout() {
  const { translate } = useDcsLanguage();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="relative bg-white flex items-center justify-center" style={{ minHeight: "70vh" }}>
      <div
        ref={ref}
        className={`dcs-home-reveal ${isVisible ? "is-visible" : ""} w-full flex flex-col items-center text-center gap-6 px-4 sm:px-8 py-16`}
        style={{ maxWidth: 820 }}
      >
        <span className="dcs-home-badge text-xs font-semibold tracking-[0.3em] uppercase px-3 py-1">
          {translate("DCS_HOME_ABOUT_EYEBROW")}
        </span>
        <h2
          className="font-bold"
          style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)" }}
        >
          {translate("DCS_HOME_ABOUT_TITLE")}
        </h2>
        <p style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", fontSize: "1.05rem", lineHeight: 1.7 }}>
          {translate("DCS_HOME_ABOUT_BODY")}
        </p>

        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {STAT_KEYS.map((stat, index) => (
            <DcsHomeStatCard
              key={stat.valueKey}
              valueKey={stat.valueKey}
              labelKey={stat.labelKey}
              showOffline={stat.showOffline}
              isActive={isVisible}
              className={`dcs-home-glass-card dcs-home-reveal ${isVisible ? "is-visible" : ""} dcs-home-reveal-delay-${Math.min(index, 2)} p-5 flex flex-col items-center gap-1`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useScrollReveal } from "../home/useScrollReveal.js";
import DcsHomeHero from "../home/DcsHomeHero.jsx";
import DcsHomeAbout from "../home/DcsHomeAbout.jsx";
import DcsHomeFeatureSection from "../home/DcsHomeFeatureSection.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import ProjectsIllustration from "../home/illustrations/ProjectsIllustration.jsx";
import FormsIllustration from "../home/illustrations/FormsIllustration.jsx";
import AccessControlIllustration from "../home/illustrations/AccessControlIllustration.jsx";
import DashboardIllustration from "../home/illustrations/DashboardIllustration.jsx";

/**
 * Default view of /dcs-system before any project is selected - an
 * explainer home page for the whole module (what it is, how each of its
 * four pillars works) rather than a bare "pick something from the
 * sidebar" message. The project list itself still lives in the sidebar
 * next to this page; this only replaces the empty main-content state.
 */
export default function DcsHomePage() {
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();
  const { ref: cta_ref, isVisible: cta_visible } = useScrollReveal();

  return (
    // Cancels DcsSidebarShell's own padding so the hero image and every
    // section background can run edge-to-edge instead of sitting inside a
    // padded box next to the sidebar. dcs-home-no-select: a presentational
    // explainer page, not a document - dragging across it while scrolling
    // must never highlight text.
    <div className="-m-3 sm:-m-4 lg:-m-6 dcs-home-no-select">
      <DcsHomeHero />
      <DcsHomeAbout />

      <DcsHomeFeatureSection
        titleKey="DCS_HOME_FEATURE_PROJECTS_TITLE"
        bodyKey="DCS_HOME_FEATURE_PROJECTS_BODY"
        bulletKeys={[
          "DCS_HOME_FEATURE_PROJECTS_BULLET_1",
          "DCS_HOME_FEATURE_PROJECTS_BULLET_2",
          "DCS_HOME_FEATURE_PROJECTS_BULLET_3",
        ]}
        Illustration={ProjectsIllustration}
      />

      <DcsHomeFeatureSection
        titleKey="DCS_HOME_FEATURE_FORMS_TITLE"
        bodyKey="DCS_HOME_FEATURE_FORMS_BODY"
        bulletKeys={[
          "DCS_HOME_FEATURE_FORMS_BULLET_1",
          "DCS_HOME_FEATURE_FORMS_BULLET_2",
          "DCS_HOME_FEATURE_FORMS_BULLET_3",
          "DCS_HOME_FEATURE_FORMS_BULLET_4",
        ]}
        offlineBadgeKey="DCS_HOME_FEATURE_FORMS_OFFLINE_BADGE"
        Illustration={FormsIllustration}
        reverse
        tinted
      />

      <DcsHomeFeatureSection
        titleKey="DCS_HOME_FEATURE_ACCESS_TITLE"
        bodyKey="DCS_HOME_FEATURE_ACCESS_BODY"
        bulletKeys={[
          "DCS_HOME_FEATURE_ACCESS_BULLET_1",
          "DCS_HOME_FEATURE_ACCESS_BULLET_2",
          "DCS_HOME_FEATURE_ACCESS_BULLET_3",
        ]}
        Illustration={AccessControlIllustration}
      />

      <DcsHomeFeatureSection
        titleKey="DCS_HOME_FEATURE_DASHBOARD_TITLE"
        bodyKey="DCS_HOME_FEATURE_DASHBOARD_BODY"
        bulletKeys={[
          "DCS_HOME_FEATURE_DASHBOARD_BULLET_1",
          "DCS_HOME_FEATURE_DASHBOARD_BULLET_2",
          "DCS_HOME_FEATURE_DASHBOARD_BULLET_3",
        ]}
        badgeKey="DCS_HOME_FEATURE_DASHBOARD_BADGE"
        Illustration={DashboardIllustration}
        reverse
        tinted
      />

      <section className="relative flex items-center justify-center px-4 sm:px-8 py-20" style={{ backgroundColor: "#056daa" }}>
        <div
          ref={cta_ref}
          className={`dcs-home-reveal ${cta_visible ? "is-visible" : ""} flex flex-col items-center text-center gap-5`}
          style={{ maxWidth: 560 }}
        >
          <h3 className="font-bold" style={{ color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.4rem, 2.8vw, 2rem)" }}>
            {translate("DCS_HOME_CTA_TITLE")}
          </h3>
          <p style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_HOME_CTA_BODY")}
          </p>
          <DcsButtonPrimary
            className="dcs-home-cta-button mt-2"
            style={{ backgroundColor: "#FFFFFF", color: "#056daa" }}
            onClick={() => navigate("/dcs-system/new-project")}
          >
            {translate("DCS_SIDEBAR_NEW_PROJECT")}
          </DcsButtonPrimary>
        </div>
      </section>
    </div>
  );
}

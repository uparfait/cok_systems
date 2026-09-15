import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { list_dashboard_links, create_dashboard_link, update_dashboard_link, delete_dashboard_link, public_dashboard_url, request_error_text } from "../dashboardService.js";
import { IconButton, CLOSE_SVG, PLUS_SVG } from "../BoardIcons.jsx";
import DcsConfirmDialog from "../../components/DcsConfirmDialog.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import LinkForm from "./LinkForm.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

const format_date = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
};

function StatusChip({ link, translate, language }) {
  const expired = link.expired;
  const color = expired ? "#E74C3C" : "#4CAF50";
  const text = expired ? translate("DCS_DB_SHARE_STATUS_EXPIRED") : link.expires_at ? translate("DCS_DB_SHARE_EXPIRES_ON", { date: format_date(link.expires_at, language) }) : translate("DCS_DB_SHARE_NEVER");
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5" style={{ color, border: `1px solid ${color}`, letterSpacing: "0.4px", ...FONT }}>
      {text}
    </span>
  );
}

function TextButton({ children, onClick, danger, disabled }) {
  return (
    <button type="button" disabled={disabled} className="text-xs font-semibold cursor-pointer" style={{ color: danger ? "#E74C3C" : PRIMARY, background: "none", border: "none", padding: 0, opacity: disabled ? 0.5 : 1, ...FONT }} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * The share links of a form's dashboard, for its editors: every link with
 * its title, description, status (live until a date, never expiring, or
 * expired), view count and creator; copy its public URL, edit it, delete
 * it; and create a new one. A public link opens the dashboard read-only,
 * without signing in, until it expires or is deleted here.
 */
export default function ShareLinksDialog({ form, onClose }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // "new", a link id being edited, or null.
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    list_dashboard_links(form.form_group_id)
      .then((response) => is_mounted && setLinks((response.data && response.data.links) || []))
      .catch((error) => is_mounted && showError(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_group_id]);

  const copy = (link) => {
    window.navigator.clipboard.writeText(public_dashboard_url(link.token));
    showSuccess(translate("DCS_DB_SHARE_COPIED"));
  };

  const submit = async (fields) => {
    setSaving(true);
    try {
      if (editing === "new") {
        const response = await create_dashboard_link(form.form_group_id, fields);
        const link = response.data && response.data.link;
        setLinks((current) => [link].concat(current));
        copy(link);
        showSuccess(translate("DCS_DB_SHARE_CREATED"));
      } else {
        const response = await update_dashboard_link(form.form_group_id, editing, fields);
        const link = response.data && response.data.link;
        setLinks((current) => current.map((entry) => (entry.id === link.id ? link : entry)));
        showSuccess(translate("DCS_DB_SHARE_UPDATED"));
      }
      setEditing(null);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const target = deleting;
    setSaving(true);
    try {
      await delete_dashboard_link(form.form_group_id, target.id);
      setLinks((current) => current.filter((entry) => entry.id !== target.id));
      showSuccess(translate("DCS_DB_SHARE_DELETED"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={saving ? undefined : onClose} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 760, maxHeight: "92vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
              {translate("DCS_DB_SHARE_TITLE")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
              {form.form_name || form.form_group_id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editing === null && (
              <IconButton title={translate("DCS_DB_SHARE_NEW")} onClick={() => setEditing("new")} onDark disabled={saving || loading}>
                {PLUS_SVG}
              </IconButton>
            )}
            <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={saving}>
              {CLOSE_SVG}
            </IconButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_SHARE_INTRO")}
          </p>

          {editing === "new" && <LinkForm saving={saving} onSubmit={submit} onCancel={() => setEditing(null)} />}

          {loading ? (
            <div className="flex justify-center py-8">
              <SpiralLoader />
            </div>
          ) : links.length === 0 && editing !== "new" ? (
            <div className="border-2 p-6 text-center" style={{ borderColor: BORDER }}>
              <p className="text-sm font-semibold mb-3" style={{ color: TEXT_DARK, ...FONT }}>
                {translate("DCS_DB_SHARE_NO_LINKS")}
              </p>
              <TextButton onClick={() => setEditing("new")}>{translate("DCS_DB_SHARE_NEW")}</TextButton>
            </div>
          ) : (
            <ul className="space-y-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {links.map((link) =>
                editing === link.id ? (
                  <li key={link.id}>
                    <LinkForm initial={link} saving={saving} onSubmit={submit} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={link.id} className="border-2 p-3 sm:p-4" style={{ borderColor: link.expired ? "rgba(231,76,60,0.5)" : BORDER, opacity: link.expired ? 0.8 : 1 }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-words" style={{ color: TEXT_DARK, ...FONT }}>
                          {link.title}
                        </p>
                        {link.description && (
                          <p className="text-xs mt-0.5 break-words" style={{ color: "#555555" }}>
                            {link.description}
                          </p>
                        )}
                      </div>
                      <StatusChip link={link} translate={translate} language={language} />
                    </div>
                    <p className="text-[11px] mt-2 break-all" style={{ color: TEXT_MUTED }}>
                      {public_dashboard_url(link.token)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <TextButton onClick={() => copy(link)}>{translate("DCS_DB_SHARE_COPY")}</TextButton>
                      <a href={public_dashboard_url(link.token)} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: PRIMARY, ...FONT }}>
                        {translate("DCS_DB_SHARE_OPEN")}
                      </a>
                      <TextButton onClick={() => setEditing(link.id)} disabled={saving}>
                        {translate("DCS_DB_SHARE_EDIT")}
                      </TextButton>
                      <TextButton onClick={() => setDeleting(link)} danger disabled={saving}>
                        {translate("DCS_DB_SHARE_DELETE")}
                      </TextButton>
                      <span className="text-[11px]" style={{ color: TEXT_MUTED }}>
                        {translate("DCS_DB_SHARE_VIEWS", { count: link.views || 0 })}
                        {link.created_by_name ? ` - ${translate("DCS_DB_SHARE_CREATED_BY", { name: link.created_by_name })}` : ""}
                      </span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>
      {deleting && <DcsConfirmDialog titleKey="DCS_DB_SHARE_DELETE_TITLE" messageKey="DCS_DB_SHARE_DELETE_MESSAGE" confirming={saving} onConfirm={remove} onCancel={() => setDeleting(null)} />}
    </div>,
    document.body,
  );
}

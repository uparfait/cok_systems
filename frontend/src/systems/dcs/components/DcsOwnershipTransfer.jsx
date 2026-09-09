import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { suggest_access_users } from "../services/accessControlService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsConfirmDialog from "./DcsConfirmDialog.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";

/**
 * Transfer-ownership section shared by project and form settings: shows who
 * owns the record now, searches existing employee accounts by name or email
 * and hands the record over to the picked one after a confirmation. The
 * caller performs the actual transfer request via onTransfer(user).
 */
export default function DcsOwnershipTransfer({ ownerName, onTransfer, transferring }) {
  const { translate } = useDcsLanguage();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [no_matches, setNoMatches] = useState(false);
  const [selected_user, setSelectedUser] = useState(null);
  const [is_confirming, setIsConfirming] = useState(false);

  // Same debounced employee search the access-control individuals picker uses.
  useEffect(() => {
    const typed = query.trim();
    if (typed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setNoMatches(false);
      return;
    }
    let is_current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      suggest_access_users(typed)
        .then((response) => {
          if (!is_current) return;
          const matches = response.data || [];
          setSuggestions(matches);
          setNoMatches(matches.length === 0);
        })
        .catch(() => is_current && setSuggestions([]))
        .finally(() => is_current && setSearching(false));
    }, 300);
    return () => {
      is_current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handle_pick = (user) => {
    setSelectedUser(user);
    setQuery("");
    setSuggestions([]);
    setNoMatches(false);
  };

  const handle_confirm = async () => {
    if (!selected_user) return;
    await onTransfer(selected_user);
    setIsConfirming(false);
    setSelectedUser(null);
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
        {translate("DCS_SECTION_TRANSFER_OWNERSHIP")}
      </h2>
      <p className="mt-2 text-sm" style={{ color: "#9E9E9E" }}>
        {translate("DCS_TRANSFER_HINT")}
      </p>
      {ownerName ? (
        <p className="mt-2 text-sm" style={{ color: "#333333" }}>
          <span className="font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_TRANSFER_CURRENT_OWNER")}:
          </span>{" "}
          {ownerName}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-stretch">
        <div className="relative w-full sm:flex-1">
          <input
            type="text"
            className="cok-auth-input w-full py-3"
            placeholder={translate("DCS_TRANSFER_SEARCH_PLACEHOLDER")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => {
              setSuggestions([]);
              setNoMatches(false);
            }}
            disabled={transferring}
          />
          {(searching || suggestions.length > 0 || no_matches) && (
            <div className="absolute left-0 right-0 z-10 bg-white border-2 shadow-lg" style={{ borderColor: "#E0E0E0", top: "100%" }}>
              {searching ? (
                <SpiralLoader />
              ) : suggestions.length > 0 ? (
                suggestions.map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    // onMouseDown so the pick lands before the input's blur clears the list
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handle_pick(user);
                    }}
                  >
                    <span className="block text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                      {user.full_name || user.email}
                    </span>
                    <span className="block text-xs truncate" style={{ color: "#9E9E9E" }}>
                      {user.email}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm" style={{ color: "#9E9E9E" }}>
                  {translate("DCS_SEARCH_NO_RESULTS")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {selected_user && (
        <div className="mt-3 border-2 p-3 flex items-start justify-between gap-2" style={{ borderColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {selected_user.full_name || selected_user.email}
            </p>
            <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
              {selected_user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedUser(null)}
            className="text-xs font-semibold uppercase flex-shrink-0"
            style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
          >
            {translate("DCS_SETTINGS_REMOVE")}
          </button>
        </div>
      )}

      {/* cok-btn-primary is width:100% outside Tailwind's layers, so the button is sized by this wrapper */}
      <div className="w-full sm:w-56 mt-3">
        <DcsButtonPrimary type="button" onClick={() => setIsConfirming(true)} disabled={!selected_user || transferring}>
          {transferring ? translate("DCS_TRANSFER_TRANSFERRING") : translate("DCS_BTN_TRANSFER_OWNERSHIP")}
        </DcsButtonPrimary>
      </div>

      {is_confirming && selected_user && (
        <DcsConfirmDialog
          titleKey="DCS_TRANSFER_CONFIRM_TITLE"
          messageKey="DCS_TRANSFER_CONFIRM_MESSAGE"
          confirming={transferring}
          onConfirm={handle_confirm}
          onCancel={() => setIsConfirming(false)}
        />
      )}
    </div>
  );
}

import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const GRAY = "#9E9E9E";
const NEUTRAL_LIGHT = "#F7F9FB";
const FONT = "'Montserrat', sans-serif";

/**
 * The tuning shown before test data is generated: one min / max pair per
 * number field of the chosen version (prefilled from the field's own rules
 * or 0..100), a note on where GPS points will land (inside the City of
 * Kigali, inside the place each record names) and the cascade coverage
 * toggle (every district, sector, cell and village visited as early as the
 * record count allows).
 *
 * fields is the server's description ({ number_fields, has_geolocation,
 * cascades }); ranges is { field_id: { min, max } } as strings; onChange
 * receives the whole ranges object.
 */
export default function TestDataRangesStep({ fields, loading, ranges, onChange, coverCascades, onCoverChange, disabled }) {
  const { translate, language } = useDcsLanguage();

  if (loading) {
    return (
      <div className="cok-auth-input w-full py-3 flex items-center gap-2">
        <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
        <span className="text-xs" style={{ color: GRAY, fontFamily: FONT }}>
          {translate("DCS_TEST_DATA_FIELDS_LOADING")}
        </span>
      </div>
    );
  }
  if (!fields) return null;

  const number_fields = fields.number_fields || [];
  const set_bound = (field_id, key, value) => {
    const current = ranges[field_id] || { min: "", max: "" };
    onChange(Object.assign({}, ranges, { [field_id]: Object.assign({}, current, { [key]: value }) }));
  };
  const invalid = (field_id) => {
    const range = ranges[field_id];
    if (!range || range.min === "" || range.max === "") return false;
    return Number(range.min) > Number(range.max);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="cok-auth-label">{translate("DCS_TEST_DATA_RANGES_TITLE")}</label>
        <p className="text-xs" style={{ color: GRAY, fontFamily: FONT }}>
          {translate("DCS_TEST_DATA_RANGES_HINT")}
        </p>
      </div>
      {number_fields.length === 0 ? (
        <p className="text-xs" style={{ color: GRAY, fontFamily: FONT }}>
          {translate("DCS_TEST_DATA_NO_NUMBER_FIELDS")}
        </p>
      ) : (
        <div className="space-y-2" style={{ maxHeight: 260, overflowY: "auto" }}>
          {number_fields.map((field) => {
            const range = ranges[field.id] || { min: "", max: "" };
            const bad = invalid(field.id);
            return (
              <div key={field.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center p-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${bad ? "#E74C3C" : BORDER}` }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: FONT }} title={get_field_text(field.label, language) || field.id}>
                    {get_field_text(field.label, language) || field.id}
                  </p>
                  {(field.rule_min !== null || field.rule_max !== null) && (
                    <p className="text-[10px]" style={{ color: GRAY, fontFamily: FONT }}>
                      {translate("DCS_TEST_DATA_RANGE_RULES", { min: field.rule_min === null ? "-" : field.rule_min, max: field.rule_max === null ? "-" : field.rule_max })}
                    </p>
                  )}
                </div>
                <input
                  type="number"
                  className="cok-auth-input py-2 text-sm"
                  style={{ width: 96 }}
                  placeholder={translate("DCS_TEST_DATA_RANGE_MIN")}
                  value={range.min}
                  disabled={disabled}
                  onChange={(event) => set_bound(field.id, "min", event.target.value)}
                />
                <input
                  type="number"
                  className="cok-auth-input py-2 text-sm"
                  style={{ width: 96 }}
                  placeholder={translate("DCS_TEST_DATA_RANGE_MAX")}
                  value={range.max}
                  disabled={disabled}
                  onChange={(event) => set_bound(field.id, "max", event.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      {fields.has_geolocation && (
        <p className="text-xs" style={{ color: PRIMARY, fontFamily: FONT }}>
          {translate("DCS_TEST_DATA_GEO_KIGALI")}
        </p>
      )}

      {(fields.cascades || []).length > 0 && (
        <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "#333333", fontFamily: FONT }}>
          <input type="checkbox" checked={coverCascades} disabled={disabled} onChange={(event) => onCoverChange(event.target.checked)} style={{ accentColor: PRIMARY, marginTop: 3 }} />
          <span>
            {translate("DCS_TEST_DATA_COVER_CASCADES")}
            <span className="block text-xs" style={{ color: GRAY }}>
              {translate("DCS_TEST_DATA_COVER_HINT", { paths: fields.cascades.reduce((sum, chain) => sum + (chain.paths || 0), 0) })}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

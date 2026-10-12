import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const INPUT_STYLE = { paddingLeft: 14, ...FONT };
const CHOICE_TYPES = ["single_select", "select_group", "cascading_select"];
const LIST_TYPES = ["multi_select", "ranking"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];

function has_options(field) {
  return Array.isArray(field.options) && field.options.length > 0 && !field.api_sourced;
}

function DurationInput({ value, onChange, translate }) {
  const match = /^(\d*):(\d*)$/.exec(String(value || ""));
  const hours = match ? match[1] : "";
  const minutes = match ? match[2] : "";
  const update = (next_hours, next_minutes) => onChange(next_hours === "" && next_minutes === "" ? "" : `${next_hours || 0}:${next_minutes || 0}`);
  return (
    <div className="flex gap-2">
      <input type="number" min="0" value={hours} onChange={(event) => update(event.target.value, minutes)} placeholder={translate("DCS_IMPORT_HOURS")} className="cok-auth-input flex-1 min-w-0" style={INPUT_STYLE} />
      <input type="number" min="0" max="59" value={minutes} onChange={(event) => update(hours, event.target.value)} placeholder={translate("DCS_IMPORT_MINUTES")} className="cok-auth-input flex-1 min-w-0" style={INPUT_STYLE} />
    </div>
  );
}

function LocationInput({ value, onChange, translate }) {
  const current = value && typeof value === "object" ? value : { latitude: "", longitude: "", accuracy: "" };
  const set = (part, text) => onChange(Object.assign({}, current, { [part]: text }));
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {["latitude", "longitude", "accuracy"].map((part) => (
        <input
          key={part}
          type="number"
          step="any"
          value={current[part] === undefined || current[part] === null ? "" : current[part]}
          onChange={(event) => set(part, event.target.value)}
          placeholder={translate(`DCS_IMPORT_PART_${part.toUpperCase()}`)}
          className="cok-auth-input flex-1 min-w-0"
          style={INPUT_STYLE}
        />
      ))}
    </div>
  );
}

function ChecklistInput({ field, value, onChange }) {
  const picked = Array.isArray(value) ? value : [];
  const toggle = (option_value) => onChange(picked.includes(option_value) ? picked.filter((entry) => entry !== option_value) : picked.concat([option_value]));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {field.options.map((option) => (
        <label key={String(option.value)} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "#333333", ...FONT }}>
          <input type="checkbox" checked={picked.includes(option.value)} onChange={() => toggle(option.value)} className="cursor-pointer" />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function DcsImportDefaultInput({ field, value, onChange }) {
  const { translate } = useDcsLanguage();
  const text_value = value === undefined || value === null || typeof value === "object" ? "" : value;

  if (field.type === "geolocation") return <LocationInput value={value} onChange={onChange} translate={translate} />;
  if (field.type === "duration") return <DurationInput value={text_value} onChange={onChange} translate={translate} />;
  if (CHOICE_TYPES.includes(field.type) && has_options(field)) {
    return (
      <select value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full cursor-pointer" style={INPUT_STYLE}>
        <option value="">{translate("DCS_IMPORT_PICK_OPTION")}</option>
        {field.options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (LIST_TYPES.includes(field.type) && has_options(field)) return <ChecklistInput field={field} value={value} onChange={onChange} />;
  if (field.type === "likert_scale") {
    const size = Number(field.scale_size) || 5;
    return (
      <select value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full cursor-pointer" style={INPUT_STYLE}>
        <option value="">{translate("DCS_IMPORT_PICK_OPTION")}</option>
        {Array.from({ length: size }, (_, index) => index + 1).map((step) => (
          <option key={step} value={step}>
            {step}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean" || field.type === "yes_no") {
    return (
      <select value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full cursor-pointer" style={INPUT_STYLE}>
        <option value="">{translate("DCS_IMPORT_PICK_OPTION")}</option>
        <option value="yes">{translate("DCS_YES")}</option>
        <option value="no">{translate("DCS_NO")}</option>
      </select>
    );
  }
  if (field.type === "number") return <input type="number" step="any" value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full" style={INPUT_STYLE} />;
  if (field.type === "date") return <input type="date" value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full" style={INPUT_STYLE} />;
  if (field.type === "time") return <input type="time" step="60" value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full" style={INPUT_STYLE} />;
  if (field.type === "date_time") return <input type="datetime-local" value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full" style={INPUT_STYLE} />;
  if (MEDIA_TYPES.includes(field.type)) return <input type="url" value={text_value} onChange={(event) => onChange(event.target.value)} placeholder="https://" className="cok-auth-input w-full" style={INPUT_STYLE} />;
  return <input type="text" value={text_value} onChange={(event) => onChange(event.target.value)} className="cok-auth-input w-full" style={INPUT_STYLE} />;
}

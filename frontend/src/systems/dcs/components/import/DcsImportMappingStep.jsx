import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import MappingLines from "./MappingLines.jsx";
import DcsImportLegendDialog from "./DcsImportLegendDialog.jsx";
import { color_of, header_text, required_unmapped } from "./importMapping.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const PRIMARY = "#056daa";

function Tag({ color }) {
  return <span className="inline-block flex-shrink-0" style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />;
}

function UnmapButton({ onClick, label }) {
  return (
    <button
      type="button"
      className="text-[11px] font-bold uppercase cursor-pointer bg-transparent border-0 p-0 flex-shrink-0"
      style={{ color: PRIMARY, ...FONT }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

function row_style(active, hot, color) {
  return {
    borderColor: active ? PRIMARY : hot && color ? color : BORDER,
    backgroundColor: active ? "#EAF4FA" : hot ? "#F7F9FB" : "#FFFFFF",
    boxShadow: active ? `0 0 0 1px ${PRIMARY}` : "none",
  };
}

export default function DcsImportMappingStep({ headers, preview, sheetName, rowCount, targets, mapping, onMappingChange, onBack, onNext }) {
  const { translate } = useDcsLanguage();
  const area_ref = useRef(null);
  const [pending, setPending] = useState(null);
  const [hovered, setHovered] = useState(null);

  const field_type_label = (type) => {
    const key = `FIELD_TYPE_${String(type || "").toUpperCase()}`;
    const text = translate(key);
    return text === key ? type : text;
  };

  const target_by_key = useMemo(() => new Map(targets.map((target) => [target.key, target])), [targets]);
  const column_to_key = useMemo(() => {
    const map = new Map();
    Object.keys(mapping).forEach((key) => map.set(mapping[key], key));
    return map;
  }, [mapping]);
  const pairs = useMemo(
    () => targets.filter((target) => mapping[target.key] !== undefined).map((target) => ({ key: target.key, column: mapping[target.key], color: color_of(targets, target.key) })),
    [targets, mapping],
  );
  const missing = useMemo(() => required_unmapped(mapping, targets), [mapping, targets]);
  const [legend_open, setLegendOpen] = useState(false);

  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape") setPending(null);
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, []);

  const connect = (column, key) => {
    const next = Object.assign({}, mapping);
    Object.keys(next).forEach((entry) => {
      if (next[entry] === column) delete next[entry];
    });
    next[key] = column;
    onMappingChange(next);
    setPending(null);
  };
  const unmap = (key) => {
    const next = Object.assign({}, mapping);
    delete next[key];
    onMappingChange(next);
  };
  const click_header = (column) => {
    if (pending && pending.kind === "target") return connect(column, pending.key);
    if (pending && pending.kind === "header" && pending.column === column) return setPending(null);
    return setPending({ kind: "header", column });
  };
  const click_target = (key) => {
    if (pending && pending.kind === "header") return connect(pending.column, key);
    if (pending && pending.kind === "target" && pending.key === key) return setPending(null);
    return setPending({ kind: "target", key });
  };

  const target_name = (key) => {
    const target = target_by_key.get(key);
    if (!target) return "";
    return target.part ? `${target.field.label} - ${target.label}` : target.label;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs mb-1 flex-shrink-0" style={{ color: MUTED, ...FONT }}>
        {translate("DCS_IMPORT_MAP_HINT")}
      </p>
      {sheetName ? (
        <p className="text-xs mb-3 flex-shrink-0 font-semibold" style={{ color: TEXT, ...FONT }}>
          {translate("DCS_IMPORT_SHEET_ROWS", { sheet: sheetName, rows: rowCount || 0 })}
        </p>
      ) : (
        <div className="mb-2" />
      )}

      <div ref={area_ref} className="relative flex-1 min-h-0 flex items-stretch">
        <div data-import-list="headers" className="flex-1 min-w-0 overflow-y-auto pr-1">
          <p className="text-[10px] font-bold uppercase mb-2" style={{ color: MUTED, letterSpacing: "0.6px", ...FONT }}>
            {translate("DCS_IMPORT_HEADERS")}
          </p>
          <div className="flex flex-col gap-2">
            {headers.map((header, column) => {
              const key = column_to_key.get(column);
              const color = key ? color_of(targets, key) : null;
              const active = pending && pending.kind === "header" && pending.column === column;
              const sample = preview && preview[0] ? preview[0][column] : "";
              return (
                <div
                  key={column}
                  data-import-header={column}
                  role="button"
                  tabIndex={0}
                  onClick={() => click_header(column)}
                  onKeyDown={(event) => event.key === "Enter" && click_header(column)}
                  onMouseEnter={() => key && setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  className="border px-3 py-2 cursor-pointer min-w-0"
                  style={row_style(active, hovered && hovered === key, color)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {color ? <Tag color={color} /> : null}
                    <span className="text-sm font-semibold truncate flex-1 min-w-0" style={{ color: TEXT, ...FONT }} title={header_text(headers, column, translate)}>
                      {header_text(headers, column, translate)}
                    </span>
                    {key ? <UnmapButton onClick={() => unmap(key)} label={translate("DCS_IMPORT_UNMAP")} /> : null}
                  </div>
                  <p className="text-[11px] truncate" style={{ color: key ? color : MUTED, ...FONT }}>
                    {key ? translate("DCS_IMPORT_MAPPED_TO", { name: target_name(key) }) : sample ? String(sample) : translate("DCS_IMPORT_NOT_MAPPED")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-10 sm:w-20 flex-shrink-0" />

        <div data-import-list="targets" className="flex-1 min-w-0 overflow-y-auto pl-1">
          <p className="text-[10px] font-bold uppercase mb-2" style={{ color: MUTED, letterSpacing: "0.6px", ...FONT }}>
            {translate("DCS_IMPORT_FIELDS")}
          </p>
          <div className="flex flex-col gap-2">
            {targets.map((target, index) => {
              const column = mapping[target.key];
              const color = column !== undefined ? color_of(targets, target.key) : null;
              const active = pending && pending.kind === "target" && pending.key === target.key;
              const first_system = target.system && (index === 0 || !targets[index - 1].system);
              return (
                <div key={target.key}>
                {first_system ? (
                  <p className="text-[10px] font-bold uppercase mb-2 mt-2" style={{ color: MUTED, letterSpacing: "0.6px", ...FONT }}>
                    {translate("DCS_IMPORT_RECORD_FIELDS")}
                  </p>
                ) : null}
                <div
                  data-import-target={target.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => click_target(target.key)}
                  onKeyDown={(event) => event.key === "Enter" && click_target(target.key)}
                  onMouseEnter={() => column !== undefined && setHovered(target.key)}
                  onMouseLeave={() => setHovered(null)}
                  className={`border px-3 py-2 cursor-pointer min-w-0 ${target.part ? "ml-4 sm:ml-6" : ""}`}
                  style={row_style(active, hovered && hovered === target.key, color)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {color ? <Tag color={color} /> : null}
                    <span className={`text-sm truncate flex-1 min-w-0 ${target.part ? "" : "font-semibold"} ${target.required && !target.part ? "cok-req" : ""}`} style={{ color: TEXT, ...FONT }} title={target.label}>
                      {target.label}
                    </span>
                    {!target.part ? (
                      <span className="text-[10px] uppercase flex-shrink-0 px-1.5 py-0.5" style={{ color: MUTED, backgroundColor: "#F7F9FB", ...FONT }}>
                        {target.system ? translate("DCS_IMPORT_RECORD_FIELD") : field_type_label(target.field.type)}
                      </span>
                    ) : null}
                    {column !== undefined ? <UnmapButton onClick={() => unmap(target.key)} label={translate("DCS_IMPORT_UNMAP")} /> : null}
                  </div>
                  <p className="text-[11px] truncate" style={{ color: column !== undefined ? color : MUTED, ...FONT }}>
                    {column !== undefined
                      ? translate("DCS_IMPORT_MAPPED_TO", { name: header_text(headers, column, translate) })
                      : target.field.type === "geolocation" && !target.part
                        ? translate("DCS_IMPORT_WHOLE_LOCATION")
                        : translate("DCS_IMPORT_NOT_MAPPED")}
                  </p>
                </div>
                </div>
              );
            })}
          </div>
        </div>

        <MappingLines areaRef={area_ref} pairs={pairs} pending={pending} hovered={hovered} onHover={setHovered} onRemove={unmap} removeLabel={translate("DCS_IMPORT_REMOVE_LINE")} />
      </div>

      <div className="flex-shrink-0 pt-3 mt-3 border-t" style={{ borderColor: BORDER }}>
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <button type="button" className="text-xs font-semibold underline cursor-pointer bg-transparent border-0 p-0" style={{ color: PRIMARY, ...FONT }} onClick={() => setLegendOpen(true)}>
            {translate("DCS_IMPORT_VIEW_LEGEND")}
          </button>
          <p className="text-xs min-w-0" style={{ color: missing.length > 0 ? "#E74C3C" : "#27AE60", ...FONT }}>
            {missing.length > 0 ? translate("DCS_IMPORT_REQUIRED_UNMAPPED", { fields: missing.join(", ") }) : translate("DCS_IMPORT_ALL_REQUIRED_MAPPED")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DcsButtonOutline className="w-full" onClick={onBack}>
            {translate("DCS_BTN_BACK")}
          </DcsButtonOutline>
          <DcsButtonPrimary className="w-full" onClick={onNext} disabled={pairs.length === 0}>
            {translate("DCS_IMPORT_SAVE_BTN")}
          </DcsButtonPrimary>
        </div>
      </div>
      {legend_open ? <DcsImportLegendDialog onClose={() => setLegendOpen(false)} /> : null}
    </div>
  );
}

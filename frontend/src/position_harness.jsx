// TEMPORARY browser harness for the widget position feature. Deleted after the proof.
import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./assets/styles/globals.css";
import dcs_api_client from "./systems/dcs/services/dcsApiClient.js";
import { DcsLanguageProvider, useDcsLanguage } from "./systems/dcs/i18n/LanguageContext.jsx";
import { ToastProvider, useToast } from "./core/contexts/ToastContext.tsx";
import { BoardThemeProvider } from "./systems/dcs/util-dashboard/boardTheme.jsx";
import { BoardColorsProvider } from "./systems/dcs/util-dashboard/boardColors.jsx";
import BoardGrid from "./systems/dcs/util-dashboard/BoardGrid.jsx";
import { useBoardContents } from "./systems/dcs/util-dashboard/useBoardContents.js";
import { useWidgetEdits } from "./systems/dcs/util-dashboard/useWidgetEdits.js";
import { useWidgetPosition } from "./systems/dcs/util-dashboard/WidgetPositionDialog.jsx";

const FORM = "harness-form";
const DASH = "harness-dash";
const FORM_OBJ = { form_group_id: FORM, form_name: "Harness form", schema: { fields: [] } };
const SCOPED = { ...FORM_OBJ, dashboard_id: DASH, dashboard_name: "Harness board" };
const STORE_KEY = "position_harness_store";

const kpi = (id, title) => ({ id, form_group_id: FORM, title, description: null, icon: null, chart_type: "kpi", metric: { aggregation: "count", field_id: null }, group_by: null, split_by: null, appearance: null, filters: [], period: { preset: "all", from: null, to: null }, sort: "value_desc", limit: 12, size: "small", parent_id: null, box: null, position: 0 });
const bar = (id, title) => ({ ...kpi(id, title), chart_type: "bar", group_by: { field_id: "cat_f" }, size: "medium" });

const SETS = {
  // Mixed array, drawn KPI-first: k1 k2 k3 k4 c1 c2 c3.
  seven: () => [bar("c1", "Chart one"), kpi("k1", "KPI one"), kpi("k2", "KPI two"), bar("c2", "Chart two"), kpi("k3", "KPI three"), bar("c3", "Chart three"), kpi("k4", "KPI four")],
  // Mixed array, drawn KPI-first: a b c d e f.
  six: () => [bar("d", "D"), kpi("a", "A"), kpi("b", "B"), bar("e", "E"), kpi("c", "C"), bar("f", "F")],
};

const DATA = {};
["k1", "k2", "k3", "k4", "a", "b", "c"].forEach((id) => (DATA[id] = { kind: "kpi", value: 12 }));
["c1", "c2", "c3", "d", "e", "f"].forEach((id) => (DATA[id] = { kind: "category", rows: [{ label: "Alpha", value: 3 }, { label: "Beta", value: 5 }], series: [], other_folded: false, other_rows: [] }));

const params = new URLSearchParams(window.location.search);
const set_name = SETS[params.get("set")] ? params.get("set") : "seven";
function load_store() {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}
let store = params.get("reset") === "1" ? null : load_store();
if (!store || store.set !== set_name) store = { set: set_name, widgets: SETS[set_name](), layout: { mode: "grid", width: 1280, ordered: false }, puts: [] };
const persist = () => window.sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
persist();
if (params.get("reset") === "1") { params.delete("reset"); window.history.replaceState(null, "", window.location.pathname + "?" + params.toString()); }

window.__harness = {
  fail: false,
  delay: 0,
  store: () => store,
  order: () => Array.from(document.querySelectorAll(".dcs-widget-card")).map((card) => card.getAttribute("data-widget-id")),
  state: () => null,
};

const sanitize_layout = (raw) => (raw && typeof raw === "object" ? { mode: raw.mode === "studio" ? "studio" : "grid", width: Number(raw.width) || 1280, ordered: raw.ordered === true } : null);
const answer = (config, data) => ({ data: { success: true, message: "Dashboard saved", data }, status: 200, statusText: "OK", headers: {}, config, request: {} });
const refuse = (config, status, message) => {
  const error = new Error(message);
  error.config = config;
  error.response = { status, data: { success: false, message }, headers: {} };
  return error;
};
const document_of = () => ({ dashboard: { id: DASH, name: "Harness board", widgets_count: store.widgets.length }, widgets: store.widgets, filters: [], layout: store.layout, appearance: null, can_edit: true });

dcs_api_client.defaults.adapter = async (config) => {
  const url = config.url || "";
  const method = (config.method || "get").toLowerCase();
  if (window.__harness.delay) await new Promise((resolve) => setTimeout(resolve, window.__harness.delay));
  if (url !== `/forms/${FORM}/dashboards/${DASH}`) throw refuse(config, 404, `no harness route for ${method} ${url}`);
  if (method === "get") return answer(config, document_of());
  if (method === "put") {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data || {};
    store.puts.push(body);
    if (window.__harness.fail) throw refuse(config, 400, "Harness refused the save");
    store.widgets = (body.widgets || []).map((widget) => ({ ...widget }));
    const layout = sanitize_layout(body.layout);
    if (layout) store.layout = layout;
    persist();
    return answer(config, document_of());
  }
  throw refuse(config, 405, "method not allowed");
};

function Board() {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError, showInfo } = useToast();
  const data_ref = useRef(null);
  const library = useMemo(() => ({ set_count: () => {} }), []);
  const contents = useBoardContents({ form: FORM_OBJ, scoped_form: SCOPED, active_id: DASH, library, dataRef: data_ref });
  const data = useMemo(() => ({ data_by_widget: DATA, settle() {}, keep_only() {}, retry_widget() {}, page_widget() {}, prune_filters() {}, applied_period_ref: { current: null }, applied_filters_ref: { current: [] } }), []);
  data_ref.current = data;
  const edits = useWidgetEdits({ form: SCOPED, widgets: contents.widgets, layout: contents.layout, data, translate, showSuccess, showError, showInfo, onCommit: contents.commit });
  const position = useWidgetPosition({ widgets: contents.widgets, layout: contents.layout, dataByWidget: DATA, onMove: edits.move_widget });
  window.__harness.state = () => ({ ids: contents.widgets.map((widget) => widget.id), positions: contents.widgets.map((widget) => widget.position), layout: contents.layout });
  if (contents.loading) return <div id="loading">loading</div>;
  return (
    <>
      <div className="dcs-board-root p-4" style={{ backgroundColor: "#F4F7F9" }}>
        <BoardGrid
          widgets={contents.widgets}
          dataByWidget={DATA}
          dataLoading={false}
          fitMode={false}
          editable
          savingWidgetId={edits.saving_widget_id}
          onUpdateWidget={edits.update_widget}
          onRemoveWidget={() => {}}
          onRetryWidget={() => {}}
          onShowSkipped={() => {}}
          onPickIcon={() => {}}
          onAppearance={() => {}}
          onReconfigure={() => {}}
          onBehavior={() => {}}
          fields={[]}
          layout={contents.layout}
          onPosition={position.open}
        />
      </div>
      {position.element}
    </>
  );
}

function Harness() {
  const [epoch, setEpoch] = useState(0);
  return (
    <>
      <button id="refetch" type="button" onClick={() => setEpoch((current) => current + 1)} style={{ margin: 8 }}>
        Refetch
      </button>
      <Board key={epoch} />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <DcsLanguageProvider fixedLanguage="en">
    <ToastProvider>
      <BoardThemeProvider>
        <BoardColorsProvider colors={null}>
          <Harness />
        </BoardColorsProvider>
      </BoardThemeProvider>
    </ToastProvider>
  </DcsLanguageProvider>,
);

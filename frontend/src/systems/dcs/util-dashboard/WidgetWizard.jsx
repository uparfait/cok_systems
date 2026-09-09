import React, { useState } from "react";
import WizardShell from "./wizard/WizardShell.jsx";
import StepChartType from "./wizard/StepChartType.jsx";
import StepData from "./wizard/StepData.jsx";
import StepFilters from "./wizard/StepFilters.jsx";
import StepFinish from "./wizard/StepFinish.jsx";
import { chart_definition } from "./chartCatalog.js";
import { new_widget, widget_problems, widget_needs_title } from "./widgetModel.js";

const STEP_KEYS = ["DCS_DB_STEP_CHART", "DCS_DB_STEP_DATA", "DCS_DB_STEP_FILTERS", "DCS_DB_STEP_FINISH"];

/**
 * The add/edit widget wizard: chart type first, then the data behind it,
 * then filters and window, then title, size and a live preview. Each step
 * gates the next, and switching the chart type resets whatever no longer
 * fits (a scatter has no group field, a pie takes no split, and so on).
 */
export default function WidgetWizard({ projectId, forms, initialWidget, onClose, onDone }) {
  const [widget, setWidget] = useState(() => initialWidget || new_widget());
  const [step, setStep] = useState(0);

  const form = forms.find((entry) => entry.form_group_id === widget.form_group_id) || null;
  const problems = widget.chart_type && form ? widget_problems(widget, form) : [];

  const apply_changes = (changes) => setWidget((current) => ({ ...current, ...changes }));

  const select_chart = (chart_type) => {
    const previous = chart_definition(widget.chart_type);
    const next = chart_definition(chart_type);
    const changes = { chart_type };
    // Whatever the new chart cannot use is dropped so no stale choice can
    // ever fail validation invisibly.
    if (!previous || previous.kind !== next.kind) {
      changes.group_by = null;
      changes.x_field_id = null;
      changes.y_field_id = null;
      changes.size_field_id = null;
    }
    if (next.split === "none") changes.split_by = null;
    if (next.max_slices && widget.limit > next.max_slices) changes.limit = next.max_slices;
    apply_changes(changes);
  };

  const filters_complete = widget.filters.every(
    (filter) => filter.field_id && filter.operator && String(filter.value).trim() !== "",
  );
  const period_complete = !widget.period || widget.period.preset !== "custom" || !!widget.period.from;

  const next_disabled =
    step === 0
      ? !widget.chart_type
      : step === 1
        ? !form || problems.length > 0
        : step === 2
          ? !filters_complete || !period_complete
          : widget_needs_title(widget) || problems.length > 0;

  const shown_problems =
    step === 1 && form ? problems : step === 2 && !filters_complete ? ["DCS_DB_PROBLEM_FILTERS"] : [];

  const handle_next = () => {
    if (step < STEP_KEYS.length - 1) {
      setStep(step + 1);
      return;
    }
    onDone({ ...widget, title: widget.title.trim() });
  };

  return (
    <WizardShell
      titleKey={initialWidget ? "DCS_DB_WIZARD_EDIT_TITLE" : "DCS_DB_WIZARD_TITLE"}
      steps={STEP_KEYS}
      currentStep={step}
      onClose={onClose}
      onBack={() => setStep(Math.max(0, step - 1))}
      onNext={handle_next}
      nextDisabled={next_disabled}
      nextLabelKey={step < STEP_KEYS.length - 1 ? "DCS_DB_NEXT" : initialWidget ? "DCS_DB_APPLY" : "DCS_DB_FINISH"}
      problems={shown_problems}
    >
      {step === 0 && <StepChartType selected={widget.chart_type} onSelect={select_chart} />}
      {step === 1 && <StepData widget={widget} forms={forms} onChange={apply_changes} />}
      {step === 2 && <StepFilters widget={widget} forms={forms} onChange={apply_changes} />}
      {step === 3 && <StepFinish projectId={projectId} widget={widget} onChange={apply_changes} />}
    </WizardShell>
  );
}

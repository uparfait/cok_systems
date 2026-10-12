import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsOverlayHeader from "../DcsOverlayHeader.jsx";
import DcsWizardSteps from "../DcsWizardSteps.jsx";
import DcsImportUploadStep from "./DcsImportUploadStep.jsx";
import DcsImportMappingStep from "./DcsImportMappingStep.jsx";
import DcsImportDefaultsStep from "./DcsImportDefaultsStep.jsx";
import DcsImportRunStep from "./DcsImportRunStep.jsx";
import { auto_map, build_targets, initial_defaults, mapping_rows } from "./importMapping.js";

const STEPS = [
  { key: "upload", labelKey: "DCS_IMPORT_STEP_UPLOAD" },
  { key: "mapping", labelKey: "DCS_IMPORT_STEP_MAPPING" },
  { key: "defaults", labelKey: "DCS_IMPORT_STEP_DEFAULTS" },
  { key: "run", labelKey: "DCS_IMPORT_STEP_RUN" },
];

export default function DcsImportWizard({ formGroupId, onClose, onImported }) {
  const { translate } = useDcsLanguage();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [session, setSession] = useState(null);
  const [mapping, setMapping] = useState({});
  const [defaults, setDefaults] = useState({});
  const [busy, setBusy] = useState(false);
  const [run_payload, setRunPayload] = useState(null);

  const fields = session ? session.fields || [] : [];
  const targets = useMemo(() => build_targets(fields, translate), [fields, translate]);

  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [busy, onClose]);

  const go = (index) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
  };

  const on_uploaded = (data) => {
    setSession(data);
    setMapping(auto_map(data.headers, build_targets(data.fields || [], translate)));
    setDefaults(initial_defaults(data.fields || []));
    go(1);
  };

  const start_run = () => {
    setRunPayload({ mapping: mapping_rows(mapping, targets), defaults });
    go(3);
  };

  const on_finished = useCallback(
    (status) => {
      if (status === "done" && onImported) onImported();
      onClose();
    },
    [onClose, onImported],
  );

  const select_step = (index) => {
    if (busy || step === 3 || index === step) return;
    if (index <= reached && index < 3) setStep(index);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center dcs-no-print">
      <div className="absolute inset-0 bg-black/45" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white flex flex-col w-full h-full sm:w-[90vw] sm:h-[90vh] shadow-xl" role="dialog" aria-modal="true">
        <DcsOverlayHeader title={translate("DCS_IMPORT_TITLE")} subtitle={session ? `${session.file_name} - ${translate("DCS_IMPORT_FILE_SUMMARY", { rows: session.row_count, columns: session.headers.length })}` : translate("DCS_IMPORT_SUBTITLE")} onClose={onClose} busy={busy} />
        <div className="flex-1 min-h-0 flex flex-col px-4 min-[480px]:px-5 pt-4 pb-4">
          <div className="flex-shrink-0">
            <DcsWizardSteps steps={STEPS} currentIndex={step} maxReachedIndex={step === 3 ? 3 : reached} onSelect={select_step} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {step === 0 && <DcsImportUploadStep formGroupId={formGroupId} onUploaded={on_uploaded} onBusy={setBusy} />}
            {step === 1 && session && <DcsImportMappingStep headers={session.headers} preview={session.preview} targets={targets} mapping={mapping} onMappingChange={setMapping} onNext={() => go(2)} />}
            {step === 2 && session && <DcsImportDefaultsStep fields={fields} headers={session.headers} mapping={mapping} defaults={defaults} onDefaultsChange={setDefaults} onBack={() => setStep(1)} onRun={start_run} />}
            {step === 3 && session && run_payload && <DcsImportRunStep formGroupId={formGroupId} importId={session.import_id} mapping={run_payload.mapping} defaults={run_payload.defaults} onBusy={setBusy} onFinished={on_finished} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsOverlayHeader from "../DcsOverlayHeader.jsx";
import DcsWizardSteps from "../DcsWizardSteps.jsx";
import DcsImportUploadStep from "./DcsImportUploadStep.jsx";
import DcsImportMappingStep from "./DcsImportMappingStep.jsx";
import DcsImportRunStep from "./DcsImportRunStep.jsx";
import { delete_import } from "../../services/importService.js";
import { auto_map, build_targets, mapping_rows } from "./importMapping.js";

const STEPS = [
  { key: "upload", labelKey: "DCS_IMPORT_STEP_UPLOAD" },
  { key: "mapping", labelKey: "DCS_IMPORT_STEP_MAPPING" },
  { key: "run", labelKey: "DCS_IMPORT_STEP_RUN" },
];
const RUN_STEP = 2;

export default function DcsImportWizard({ formGroupId, onClose, onImported }) {
  const { translate } = useDcsLanguage();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [session, setSession] = useState(null);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [run_mapping, setRunMapping] = useState(null);
  const run_started = useRef(false);

  const fields = session ? session.fields || [] : [];
  const targets = useMemo(() => build_targets(fields, translate), [fields, translate]);

  const discard_session = useCallback(
    (current) => {
      if (!current) return;
      delete_import(formGroupId, current.import_id).catch(() => {});
    },
    [formGroupId],
  );

  const close = useCallback(() => {
    if (busy) return;
    if (!run_started.current) discard_session(session);
    onClose();
  }, [busy, discard_session, onClose, session]);

  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [close]);

  const go = (index) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
  };

  const on_uploaded = (data) => {
    setSession(data);
    setMapping(auto_map(data.headers, build_targets(data.fields || [], translate)));
    run_started.current = false;
    go(1);
  };

  const start_run = () => {
    run_started.current = true;
    setRunMapping(mapping_rows(mapping, targets));
    go(RUN_STEP);
  };

  const back_to_file = () => {
    discard_session(session);
    run_started.current = false;
    setSession(null);
    setMapping({});
    setRunMapping(null);
    setReached(0);
    setStep(0);
  };

  const on_finished = useCallback(
    (status) => {
      if (status === "done" && onImported) onImported();
      onClose();
    },
    [onClose, onImported],
  );

  const select_step = (index) => {
    if (busy || step === RUN_STEP || index === step) return;
    if (index === 0) back_to_file();
    else if (index <= reached && index < RUN_STEP) setStep(index);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center dcs-no-print">
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative bg-white flex flex-col w-full h-full sm:w-[90vw] sm:h-[90vh] shadow-xl" role="dialog" aria-modal="true">
        <DcsOverlayHeader title={translate("DCS_IMPORT_TITLE")} subtitle={session ? `${session.file_name} - ${translate("DCS_IMPORT_FILE_SUMMARY", { rows: session.row_count, columns: session.headers.length })}` : translate("DCS_IMPORT_SUBTITLE")} onClose={close} busy={busy} />
        <div className="flex-1 min-h-0 flex flex-col px-4 min-[480px]:px-5 pt-4 pb-4">
          <div className="flex-shrink-0">
            <DcsWizardSteps steps={STEPS} currentIndex={step} maxReachedIndex={step === RUN_STEP ? RUN_STEP : reached} onSelect={select_step} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {step === 0 && <DcsImportUploadStep formGroupId={formGroupId} onUploaded={on_uploaded} onBusy={setBusy} />}
            {step === 1 && session && <DcsImportMappingStep headers={session.headers} preview={session.preview} sheetName={session.sheet_name} rowCount={session.row_count} targets={targets} mapping={mapping} onMappingChange={setMapping} onBack={back_to_file} onNext={start_run} />}
            {step === RUN_STEP && session && run_mapping && <DcsImportRunStep formGroupId={formGroupId} importId={session.import_id} mapping={run_mapping} onBusy={setBusy} onBack={back_to_file} onFinished={on_finished} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

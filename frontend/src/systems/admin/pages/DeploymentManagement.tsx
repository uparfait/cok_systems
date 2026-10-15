import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiUploadCloud, FiAlertTriangle, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { useToast } from '../../../core/contexts/ToastContext';
import deploymentManagementService, {
  type DeploymentTarget,
  type InstalledCertificate,
} from '../../../core/services/deploymentManagement';
import DeployConsole from './components/DeployConsole';
import DeployPasswordOverlay from './components/DeployPasswordOverlay';
import CertificateStatusCard from './components/CertificateStatusCard';
import CertificateUploadOverlay from './components/CertificateUploadOverlay';
import CertificateRunOverlay from './components/CertificateRunOverlay';
import {
  Banner,
  CARD_SHADOW,
  DANGER,
  INK,
  MUTED,
  NEUTRAL_LIGHT,
  PRIMARY,
  SUCCESS,
  WHITE,
  button_style,
  fontHeading,
  message_of,
} from './components/DeployBits';

const POLL_MS = 800;
const CERTIFICATE_TARGET = 'certificate';
const CERTIFICATE_LABEL = 'SSL certificate';

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type CertificateStep = 'password' | 'file' | 'run' | null;

const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;
const strip_ansi = (text: string) => text.replace(ANSI, '');

const status_look = (status: RunStatus | null) => {
  if (status === 'queued') return { color: PRIMARY, label: 'Queued', Icon: FiLoader };
  if (status === 'running') return { color: PRIMARY, label: 'Running', Icon: FiLoader };
  if (status === 'succeeded') return { color: SUCCESS, label: 'Finished', Icon: FiCheckCircle };
  if (status === 'failed') return { color: DANGER, label: 'Failed', Icon: FiXCircle };
  return { color: '#9E9E9E', label: 'Idle', Icon: FiUploadCloud };
};

type RunIdError = { data?: { run_id?: string }; response_data?: { data?: { run_id?: string } }; http_status?: number } | null;
const run_id_of = (error: unknown) => {
  const value = error as RunIdError;
  return (value && ((value.data && value.data.run_id) || (value.response_data && value.response_data.data && value.response_data.data.run_id))) || null;
};

const DeploymentManagement: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [blocked_reason, setBlockedReason] = useState<string | null>(null);
  const [loading_targets, setLoadingTargets] = useState(true);
  const [certificate, setCertificate] = useState<InstalledCertificate | null>(null);
  const [certificate_available, setCertificateAvailable] = useState(true);

  const [run_id, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [output, setOutput] = useState('');
  const [run_label, setRunLabel] = useState('');
  const [run_target, setRunTarget] = useState('');
  const [run_error, setRunError] = useState<string | null>(null);
  const [page_error, setPageError] = useState<string | null>(null);

  const [asking, setAsking] = useState<DeploymentTarget | null>(null);
  const [starting, setStarting] = useState(false);
  const [overlay_error, setOverlayError] = useState<string | null>(null);

  const [cert_step, setCertStep] = useState<CertificateStep>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [upload_progress, setUploadProgress] = useState<number | null>(null);

  const offset_ref = useRef(0);
  const run_id_ref = useRef<string | null>(null);
  const stopped_ref = useRef(false);
  const finished_ref = useRef<string | null>(null);

  const refresh_certificate = useCallback(async () => {
    try {
      const response = await deploymentManagementService.getTargets();
      const data = response?.data;
      setCertificate(data?.certificate || null);
      setCertificateAvailable(data?.certificate_upload_available !== false);
    } catch (ignored) {
      return;
    }
  }, []);

  const adopt_run = useCallback((next_run_id: string) => {
    run_id_ref.current = next_run_id;
    offset_ref.current = 0;
    setRunId(next_run_id);
    setOutput('');
    setRunError(null);
    setRunTarget('');
  }, []);

  const poll_once = useCallback(async () => {
    const id = run_id_ref.current;
    if (!id) return;
    try {
      const response = await deploymentManagementService.getLog(id, offset_ref.current);
      const page = response?.data;
      if (!page || run_id_ref.current !== id) return;
      offset_ref.current = page.offset;
      if (page.chunk) setOutput((current) => current + strip_ansi(page.chunk));
      setStatus(page.status);
      setRunLabel(page.target_label || page.target || '');
      setRunTarget(page.target || '');
      setRunError(page.error || null);
      setPageError(null);
      if ((page.status === 'succeeded' || page.status === 'failed') && finished_ref.current !== id) {
        finished_ref.current = id;
        if (page.target === CERTIFICATE_TARGET) refresh_certificate();
      }
    } catch (error) {
      setPageError(message_of(error, 'Lost contact with the server. Retrying...'));
    }
  }, [refresh_certificate]);

  useEffect(() => {
    stopped_ref.current = false;
    const tick = async () => {
      if (stopped_ref.current) return;
      if (run_id_ref.current) await poll_once();
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      stopped_ref.current = true;
      window.clearInterval(timer);
    };
  }, [poll_once]);

  const load_targets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const response = await deploymentManagementService.getTargets();
      const data = response?.data;
      setTargets(data?.targets || []);
      setBlockedReason(data?.blocked_reason || null);
      setCertificate(data?.certificate || null);
      setCertificateAvailable(data?.certificate_upload_available !== false);
      setPageError(null);
      const resume = data?.current || data?.latest;
      if (resume?.run_id && run_id_ref.current !== resume.run_id) {
        adopt_run(resume.run_id);
        await poll_once();
      }
    } catch (error) {
      setPageError(message_of(error, 'Could not read the deployment settings.'));
    } finally {
      setLoadingTargets(false);
    }
  }, [adopt_run, poll_once]);

  useEffect(() => {
    load_targets();
  }, [load_targets]);

  const start = async (target: DeploymentTarget, password: string) => {
    setStarting(true);
    setOverlayError(null);
    try {
      const response = await deploymentManagementService.run(target.key, password);
      const next_run_id = response?.data?.run_id;
      if (!next_run_id) throw new Error('The server did not say which run was started.');
      setAsking(null);
      adopt_run(next_run_id);
      setStatus('running');
      setRunLabel(target.label);
      setRunTarget(target.key);
      showSuccess(`Deployment of ${target.label} started.`);
      await poll_once();
    } catch (error) {
      const text = message_of(error, 'Could not start the deployment.');
      const existing = run_id_of(error);
      if (existing) {
        setAsking(null);
        setPageError(text);
        showError(text);
        adopt_run(existing);
        await poll_once();
      } else {
        setOverlayError(text);
      }
    } finally {
      setStarting(false);
    }
  };

  const sign = async (password: string) => {
    setSigning(true);
    setOverlayError(null);
    try {
      const response = await deploymentManagementService.sign_certificate_upload(password);
      const token = response?.data?.signature;
      if (!token) throw new Error('The server did not answer with a signature.');
      setSignature(token);
      setCertStep('file');
    } catch (error) {
      setOverlayError(message_of(error, 'Could not check the password.'));
    } finally {
      setSigning(false);
    }
  };

  const upload = async (file: File) => {
    if (!signature) {
      setCertStep('password');
      setOverlayError('Enter the deployment password first.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setOverlayError(null);
    try {
      const response = await deploymentManagementService.upload_certificate(file, signature, setUploadProgress);
      const next_run_id = response?.data?.run_id;
      if (!next_run_id) throw new Error('The server did not say which run was started.');
      setSignature(null);
      adopt_run(next_run_id);
      setStatus('queued');
      setRunLabel(CERTIFICATE_LABEL);
      setRunTarget(CERTIFICATE_TARGET);
      setCertStep('run');
      showSuccess('The certificate was handed to the server.');
      await poll_once();
    } catch (error) {
      const text = message_of(error, 'Could not upload the certificate.');
      const failure = error as RunIdError;
      const existing = run_id_of(error);
      if (failure && failure.http_status === 401) {
        setSignature(null);
        setCertStep('password');
        setOverlayError(text);
      } else if (existing) {
        setCertStep(null);
        setSignature(null);
        setPageError(text);
        showError(text);
        adopt_run(existing);
        await poll_once();
      } else {
        setOverlayError(text);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const close_certificate_flow = () => {
    setCertStep(null);
    setSignature(null);
    setOverlayError(null);
    if (status === 'succeeded' || status === 'failed') refresh_certificate();
  };

  const is_running = status === 'running' || status === 'queued';
  const look = status_look(status);
  const StatusIcon = look.Icon;
  const busy = starting || signing || uploading || is_running;
  const certificate_run = run_target === CERTIFICATE_TARGET;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: NEUTRAL_LIGHT, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <FiUploadCloud size={26} color={PRIMARY} />
          <div>
            <h1 style={{ fontFamily: fontHeading, fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>
              Deployment Management
            </h1>
            <p style={{ fontFamily: fontHeading, fontSize: 13, color: MUTED, margin: '2px 0 0' }}>
              Update a running stack from this server. The script's own output is shown below as it runs.
            </p>
          </div>
        </div>

        <CertificateStatusCard
          certificate={certificate}
          available={certificate_available}
          loading={loading_targets}
          busy={busy}
          onUpdate={() => {
            setOverlayError(null);
            setCertStep('password');
          }}
        />

        {blocked_reason && (
          <Banner tone="warning" icon={<FiAlertTriangle />} title="Deployment is not available on this server">
            {blocked_reason}
          </Banner>
        )}

        {page_error && (
          <Banner tone="danger" icon={<FiXCircle />} title="Something went wrong">
            {page_error}
          </Banner>
        )}

        {run_error && status === 'failed' && (
          <Banner tone="danger" icon={<FiXCircle />} title={certificate_run ? 'The certificate was not installed' : 'The deployment failed'}>
            {run_error}. Read the console below from the bottom up: the step that failed printed why.
          </Banner>
        )}

        {status === 'succeeded' && certificate_run && run_id && (
          <Banner tone="success" icon={<FiCheckCircle />} title="Certificate installed">
            nginx now serves the new certificate. Its expiry is shown at the top of the page.
          </Banner>
        )}

        <div style={{ backgroundColor: WHITE, borderRadius: 0, boxShadow: CARD_SHADOW, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {loading_targets && targets.length === 0 ? (
              <span style={{ fontFamily: fontHeading, fontSize: 13, color: MUTED }}>Loading...</span>
            ) : (
              targets.map((target) => {
                const disabled = busy || Boolean(blocked_reason);
                return (
                  <button
                    key={target.key}
                    type="button"
                    onClick={() => {
                      setOverlayError(null);
                      setAsking(target);
                    }}
                    disabled={disabled}
                    title={blocked_reason || undefined}
                    style={button_style(PRIMARY, false, disabled)}
                  >
                    {starting && asking?.key === target.key ? 'Starting...' : `Deploy ${target.label}`}
                  </button>
                );
              })
            )}

            <span style={{ flex: 1 }} />

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: fontHeading,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: look.color,
                border: `1px solid ${look.color}`,
                borderRadius: 0,
                padding: '5px 12px',
              }}
            >
              <StatusIcon size={13} style={is_running ? { animation: 'deploy-spin 1.1s linear infinite' } : undefined} />
              {look.label}
              {run_label ? ` - ${run_label}` : ''}
            </span>
          </div>

          {is_running && (
            <p style={{ fontFamily: fontHeading, fontSize: 12, color: MUTED, margin: '12px 0 0' }}>
              {certificate_run
                ? 'The certificate is being installed on the server, so every button stays off until it finishes or fails. Leaving or reloading this page does not stop it.'
                : 'A deployment cannot be stopped once it has started, so every button stays off until it finishes or fails. It restarts the servers, including this one, so the page may lose contact for a moment - the output carries on where it left off, and leaving or reloading this page does not stop the deployment.'}
            </p>
          )}
        </div>

        <DeployConsole
          text={output}
          running={is_running}
          placeholder="No deployment has been run yet. Choose one above and its output will appear here."
        />
      </div>

      <DeployPasswordOverlay
        open={Boolean(asking)}
        title={asking ? `Deploy ${asking.label}` : 'Deploy'}
        subtitle="The deployment password is checked on the server before anything runs."
        confirm_label="Deploy now"
        busy={starting}
        error={overlay_error}
        onConfirm={(password) => {
          if (asking) start(asking, password);
        }}
        onClose={() => {
          setAsking(null);
          setOverlayError(null);
        }}
      />

      <DeployPasswordOverlay
        open={cert_step === 'password'}
        title="Update certificate"
        subtitle="Step 1 of 3: the deployment password"
        confirm_label="Continue"
        busy={signing}
        error={overlay_error}
        note="The password is checked once and exchanged for a signature that is valid for 15 minutes. The certificate files are sent with that signature, never with the password."
        onConfirm={sign}
        onClose={close_certificate_flow}
      />

      <CertificateUploadOverlay
        open={cert_step === 'file'}
        busy={uploading}
        progress={upload_progress}
        error={overlay_error}
        onUpload={upload}
        onClose={close_certificate_flow}
      />

      <CertificateRunOverlay open={cert_step === 'run'} output={output} status={status} error={run_error} onClose={close_certificate_flow} />

      <style>{'@keyframes deploy-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};

export default DeploymentManagement;

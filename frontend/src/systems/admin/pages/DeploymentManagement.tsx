import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiUploadCloud, FiAlertTriangle, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { useToast } from '../../../core/contexts/ToastContext';
import deploymentManagementService, { type DeploymentTarget } from '../../../core/services/deploymentManagement';
import DeployConsole from './components/DeployConsole';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const SUCCESS = '#4CAF50';
const NEUTRAL_LIGHT = '#F7F9FB';
const WHITE = '#FFFFFF';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const fontHeading = "'Montserrat', sans-serif";

// How often the console asks for whatever has been written since. The log
// is read by byte offset, so this is a cheap call that usually answers with
// an empty chunk.
const POLL_MS = 800;

type RunStatus = 'running' | 'succeeded' | 'failed';

/**
 * update-deploy.sh writes plain text, and both TERM and NO_COLOR are set
 * for it, but anything it calls may still colour its own output. Escape
 * codes are stripped rather than rendered as mojibake.
 */
const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;
const strip_ansi = (text: string) => text.replace(ANSI, '');

const status_look = (status: RunStatus | null) => {
  if (status === 'running') return { color: PRIMARY, label: 'Running', Icon: FiLoader };
  if (status === 'succeeded') return { color: SUCCESS, label: 'Finished', Icon: FiCheckCircle };
  if (status === 'failed') return { color: DANGER, label: 'Failed', Icon: FiXCircle };
  return { color: '#9E9E9E', label: 'Idle', Icon: FiUploadCloud };
};

const message_of = (error: unknown, fallback: string) => {
  const value = error as { message?: string; error?: string } | null;
  return (value && (value.message || value.error)) || fallback;
};

/**
 * Deployment Management: the two deployments update-deploy.sh knows how to
 * do, each behind one button, with the script's own console output read
 * back as it is written.
 *
 * The page never sends a command - it sends a target NAME, and the server
 * holds the only table that turns a name into an argument.
 */
const DeploymentManagement: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [blocked_reason, setBlockedReason] = useState<string | null>(null);
  const [loading_targets, setLoadingTargets] = useState(true);

  const [run_id, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [output, setOutput] = useState('');
  const [run_label, setRunLabel] = useState('');
  const [run_error, setRunError] = useState<string | null>(null);
  const [page_error, setPageError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  // The target whose password is being asked for. Clicking a button opens
  // this; nothing runs until the password is submitted and the SERVER
  // accepts it.
  const [asking, setAsking] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  // The byte the console has read up to. A ref, not state: the poll reads
  // it on every tick and must never work from a stale render.
  const offset_ref = useRef(0);
  const run_id_ref = useRef<string | null>(null);
  const stopped_ref = useRef(false);

  const adopt_run = useCallback((next_run_id: string) => {
    run_id_ref.current = next_run_id;
    offset_ref.current = 0;
    setRunId(next_run_id);
    setOutput('');
    setRunError(null);
  }, []);

  /** One read of whatever the run has written since the last byte seen. */
  const poll_once = useCallback(async () => {
    const id = run_id_ref.current;
    if (!id) return;
    try {
      const response = await deploymentManagementService.getLog(id, offset_ref.current);
      const page = response?.data;
      if (!page || run_id_ref.current !== id) return;
      if (page.chunk) {
        offset_ref.current = page.offset;
        setOutput((current) => current + strip_ansi(page.chunk));
      } else {
        offset_ref.current = page.offset;
      }
      setStatus(page.status);
      setRunLabel(page.target_label || page.target || '');
      setRunError(page.error || null);
      setPageError(null);
    } catch (error) {
      // While the deploy restarts this very backend the request fails for
      // a while. That is expected, not a failure of the deploy, so it is
      // said plainly and the next tick simply tries again.
      setPageError(message_of(error, 'Lost contact with the server. Retrying...'));
    }
  }, []);

  // One timer for the whole page. It keeps polling while a run is going on,
  // and takes one last read after it finishes so the closing lines land.
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

  /** What the server knows on arrival - including a deploy already going. */
  const load_targets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const response = await deploymentManagementService.getTargets();
      const data = response?.data;
      setTargets(data?.targets || []);
      setBlockedReason(data?.blocked_reason || null);
      setPageError(null);
      // Opening the page in the middle of a deployment, or after one, picks
      // it up where it is rather than showing an empty console.
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

  const start = async (target: DeploymentTarget) => {
    if (!password) {
      setPageError('Enter the deployment password to continue.');
      return;
    }
    setStarting(target.key);
    setPageError(null);
    try {
      const response = await deploymentManagementService.run(target.key, password);
      const next_run_id = response?.data?.run_id;
      if (!next_run_id) throw new Error('The server did not say which run was started.');
      // Only cleared once the server has accepted it, so a wrong password
      // can be corrected without typing the whole thing again.
      setAsking(null);
      setPassword('');
      adopt_run(next_run_id);
      setStatus('running');
      setRunLabel(target.label);
      showSuccess(`Deployment of ${target.label} started.`);
      await poll_once();
    } catch (error) {
      const text = message_of(error, 'Could not start the deployment.');
      setPageError(text);
      showError(text);
      // A refusal because one is already running still hands back its id,
      // so the console follows the run that IS going on.
      const existing = (error as { data?: { run_id?: string } } | null)?.data?.run_id;
      if (existing) {
        adopt_run(existing);
        await poll_once();
      }
    } finally {
      setStarting(null);
    }
  };

  const is_running = status === 'running';
  const look = status_look(status);
  const StatusIcon = look.Icon;
  const busy = Boolean(starting) || is_running;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: NEUTRAL_LIGHT, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <FiUploadCloud size={26} color={PRIMARY} />
          <div>
            <h1 style={{ fontFamily: fontHeading, fontSize: 22, fontWeight: 700, color: '#333333', margin: 0 }}>
              Deployment Management
            </h1>
            <p style={{ fontFamily: fontHeading, fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
              Update a running stack from this server. The script's own output is shown below as it runs.
            </p>
          </div>
        </div>

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
          <Banner tone="danger" icon={<FiXCircle />} title="The deployment failed">
            {run_error}. Read the console below from the bottom up: the step that failed printed why.
          </Banner>
        )}

        <div style={{ backgroundColor: WHITE, borderRadius: 12, boxShadow: CARD_SHADOW, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {loading_targets && targets.length === 0 ? (
              <span style={{ fontFamily: fontHeading, fontSize: 13, color: '#6B7280' }}>Loading...</span>
            ) : (
              targets.map((target) => {
                const is_asking = asking === target.key;
                // Once anything is running, every button on the page is
                // dead. A deployment cannot be called back, so offering a
                // second one - or a Cancel that could not do anything -
                // would only invite a click that does harm or nothing.
                const disabled = busy || Boolean(blocked_reason);
                if (is_asking && !busy) {
                  return (
                    <form
                      key={target.key}
                      onSubmit={(event) => {
                        event.preventDefault();
                        start(target);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span style={{ fontFamily: fontHeading, fontSize: 13, color: '#333333' }}>
                        Password to deploy {target.label}:
                      </span>
                      <input
                        type="password"
                        value={password}
                        autoFocus
                        autoComplete="off"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Deployment password"
                        style={{
                          fontFamily: fontHeading,
                          fontSize: 13,
                          padding: '0.6rem 0.75rem',
                          border: '1px solid #E0E0E0',
                          borderRadius: 0,
                          minWidth: 200,
                        }}
                      />
                      <button type="submit" style={button_style(DANGER, false)}>
                        Deploy now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAsking(null);
                          setPassword('');
                          setPageError(null);
                        }}
                        style={button_style('#9E9E9E', true)}
                      >
                        Cancel
                      </button>
                    </form>
                  );
                }
                return (
                  <button
                    key={target.key}
                    type="button"
                    onClick={() => {
                      setAsking(target.key);
                      setPassword('');
                      setPageError(null);
                    }}
                    disabled={disabled}
                    title={blocked_reason || undefined}
                    style={button_style(PRIMARY, false, disabled)}
                  >
                    {starting === target.key ? 'Starting...' : `Deploy ${target.label}`}
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
                borderRadius: 999,
                padding: '5px 12px',
              }}
            >
              <StatusIcon size={13} style={is_running ? { animation: 'deploy-spin 1.1s linear infinite' } : undefined} />
              {look.label}
              {run_label ? ` - ${run_label}` : ''}
            </span>
          </div>

          {is_running && (
            <p style={{ fontFamily: fontHeading, fontSize: 12, color: '#6B7280', margin: '12px 0 0' }}>
              A deployment cannot be stopped once it has started, so every button stays off until it finishes or
              fails. It restarts the servers, including this one, so the page may lose contact for a moment - the
              output carries on where it left off, and leaving or reloading this page does not stop the deployment.
            </p>
          )}
        </div>

        <DeployConsole
          text={output}
          running={is_running}
          placeholder="No deployment has been run yet. Choose one above and its output will appear here."
        />
      </div>
      <style>{'@keyframes deploy-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};

function button_style(color: string, ghost: boolean, disabled = false): React.CSSProperties {
  return {
    fontFamily: fontHeading,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: ghost ? color : WHITE,
    backgroundColor: ghost ? 'transparent' : color,
    border: `1px solid ${color}`,
    borderRadius: 0,
    padding: '0.65rem 1.1rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  };
}

interface BannerProps {
  tone: 'warning' | 'danger';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const Banner: React.FC<BannerProps> = ({ tone, icon, title, children }) => {
  const color = tone === 'danger' ? DANGER : '#F39C12';
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: WHITE,
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: '12px 16px',
        marginBottom: 14,
      }}
    >
      <span style={{ color, display: 'flex', marginTop: 2 }}>{icon}</span>
      <div>
        <p style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 700, color: '#333333', margin: 0 }}>{title}</p>
        <p style={{ fontFamily: fontHeading, fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>{children}</p>
      </div>
    </div>
  );
};

export default DeploymentManagement;

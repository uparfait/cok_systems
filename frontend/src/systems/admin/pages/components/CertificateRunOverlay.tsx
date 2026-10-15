import React from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import DeployConsole from './DeployConsole';
import { Banner, DANGER, INK, MUTED, PRIMARY, ProgressBar, SUCCESS, fontHeading } from './DeployBits';

export type CertificateRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | null;

interface CertificateRunOverlayProps {
  open: boolean;
  output: string;
  status: CertificateRunStatus;
  error: string | null;
  onClose: () => void;
}

export const PHASES = ['Unzipping', 'Checking', 'Installing files', 'Reloading nginx'];
const PHASE_MARK = '##phase ';

export function phases_seen(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => line.startsWith(PHASE_MARK))
    .map((line) => line.slice(PHASE_MARK.length).trim());
}

type StepState = 'pending' | 'current' | 'done' | 'failed';

export function step_states(output: string, status: CertificateRunStatus): StepState[] {
  const seen = phases_seen(output);
  const last = seen.length ? PHASES.indexOf(seen[seen.length - 1]) : -1;
  return PHASES.map((_, index) => {
    if (status === 'succeeded') return 'done';
    if (index < last) return 'done';
    if (index === last) return status === 'failed' ? 'failed' : 'current';
    if (status === 'failed' && last === -1 && index === 0) return 'failed';
    return 'pending';
  });
}

const CertificateRunOverlay: React.FC<CertificateRunOverlayProps> = ({ open, output, status, error, onClose }) => {
  if (!open) return null;

  const running = status === 'queued' || status === 'running';
  const states = step_states(output, status);
  const done = states.filter((state) => state === 'done').length;
  const percent = status === 'succeeded' ? 100 : ((done + (states.includes('current') ? 0.5 : 0)) / PHASES.length) * 100;
  const bar_color = status === 'failed' ? DANGER : status === 'succeeded' ? SUCCESS : PRIMARY;

  return (
    <OverlayShell
      title="Update certificate"
      subtitle={status === 'succeeded' ? 'Step 3 of 3: installed' : status === 'failed' ? 'Step 3 of 3: not installed' : 'Step 3 of 3: installing on the server'}
      onClose={onClose}
      busy={running}
      width="lg"
      tall
      closeOnBackdrop={false}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {PHASES.map((phase, index) => {
          const state = states[index];
          const color = state === 'done' ? SUCCESS : state === 'current' ? PRIMARY : state === 'failed' ? DANGER : '#9E9E9E';
          const word = state === 'done' ? 'done' : state === 'current' ? 'now' : state === 'failed' ? 'failed' : 'waiting';
          return (
            <span
              key={phase}
              style={{
                fontFamily: fontHeading,
                fontSize: 12,
                fontWeight: state === 'pending' ? 500 : 700,
                color: state === 'pending' ? MUTED : INK,
                border: `1px solid ${color}`,
                borderLeft: `4px solid ${color}`,
                padding: '5px 10px',
                flex: '1 1 150px',
              }}
            >
              {index + 1}. {phase}
              <span style={{ color, marginLeft: 6, fontWeight: 600, textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.5 }}>{word}</span>
            </span>
          );
        })}
      </div>
      <ProgressBar percent={percent} color={bar_color} />
      <p style={{ fontFamily: fontHeading, fontSize: 12, color: MUTED, margin: '6px 0 14px' }}>
        {status === 'queued'
          ? 'Waiting for the deployment agent on the server to pick the request up...'
          : status === 'running'
            ? 'The server is installing the certificate. This window stays open until it finishes.'
            : 'Finished. The raw output of the server is below.'}
      </p>
      {status === 'succeeded' ? (
        <Banner tone="success" title="Certificate installed">
          nginx now serves the new certificate. The expiry at the top of the page has been refreshed.
        </Banner>
      ) : null}
      {status === 'failed' ? (
        <Banner tone="danger" title="The certificate was not installed">
          {error || 'The server refused the files.'} The previous certificate stays in place. Read the output below from the bottom up: the
          step that failed printed why.
        </Banner>
      ) : null}
      <DeployConsole text={output} running={running} placeholder="Waiting for the first line of output..." />
    </OverlayShell>
  );
};

export default CertificateRunOverlay;

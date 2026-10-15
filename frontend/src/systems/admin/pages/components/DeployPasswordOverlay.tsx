import React, { useEffect, useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { DANGER, MUTED, fontHeading } from './DeployBits';

interface DeployPasswordOverlayProps {
  open: boolean;
  title: string;
  subtitle?: string;
  confirm_label: string;
  busy: boolean;
  error: string | null;
  note?: string;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

const FORM_ID = 'deploy-password-form';

const DeployPasswordOverlay: React.FC<DeployPasswordOverlayProps> = ({
  open,
  title,
  subtitle,
  confirm_label,
  busy,
  error,
  note,
  onConfirm,
  onClose,
}) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    onConfirm(password);
  };

  return (
    <OverlayShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={busy}
      width="sm"
      closeOnBackdrop={false}
      footer={
        <button
          type="submit"
          form={FORM_ID}
          disabled={busy || !password}
          className="cok-btn-primary"
          style={{ width: 'auto', padding: '0.7rem 1.4rem', opacity: busy || !password ? 0.6 : 1, cursor: busy || !password ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Checking...' : confirm_label}
        </button>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        {note ? (
          <p style={{ fontFamily: fontHeading, fontSize: 12.5, color: MUTED, margin: '0 0 14px' }}>{note}</p>
        ) : null}
        <label htmlFor="deploy-password" className="cok-auth-label cok-req">
          Deployment password
        </label>
        <input
          id="deploy-password"
          type="password"
          value={password}
          autoFocus
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Deployment password"
          className="cok-auth-input"
          style={{ paddingLeft: 12 }}
        />
        {error ? (
          <p role="alert" style={{ fontFamily: fontHeading, fontSize: 12.5, color: DANGER, margin: '10px 0 0' }}>
            {error}
          </p>
        ) : null}
      </form>
    </OverlayShell>
  );
};

export default DeployPasswordOverlay;

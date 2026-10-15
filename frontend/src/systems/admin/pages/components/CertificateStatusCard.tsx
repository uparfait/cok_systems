import React, { useEffect, useState } from 'react';
import type { InstalledCertificate } from '../../../../core/services/deploymentManagement';
import { format_countdown, countdown_tone } from './certificateCountdown';
import { DANGER, INK, MUTED, SUCCESS, button_style, card_style, fontHeading, label_style, value_style } from './DeployBits';

interface CertificateStatusCardProps {
  certificate: InstalledCertificate | null;
  available: boolean;
  loading: boolean;
  busy: boolean;
  onUpdate: () => void;
}

const date_text = (value: string | null) => {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
};

const CertificateStatusCard: React.FC<CertificateStatusCardProps> = ({ certificate, available, loading, busy, onUpdate }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const not_after = certificate ? certificate.not_after : null;
  const tone = countdown_tone(not_after, now);
  const countdown = loading && !certificate ? 'loading' : format_countdown(not_after, now);
  const color = tone === 'danger' ? DANGER : tone === 'ok' ? SUCCESS : '#9E9E9E';
  const disabled = busy || !available;

  return (
    <section style={card_style} aria-label="SSL certificate">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <p style={{ ...label_style, marginBottom: 6 }}>SSL certificate</p>
          <p style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 700, color: INK, margin: 0, wordBreak: 'break-word' }}>
            {certificate && certificate.subject ? certificate.subject : 'No certificate recorded for this server yet'}
          </p>
          {certificate && certificate.hosts.length > 0 ? (
            <p style={{ ...value_style, color: MUTED }}>Hosts: {certificate.hosts.join(', ')}</p>
          ) : null}
          {certificate && certificate.issuer ? <p style={{ ...value_style, color: MUTED }}>Issued by {certificate.issuer}</p> : null}
          {certificate && certificate.installed_by && certificate.installed_by.email ? (
            <p style={{ ...value_style, color: MUTED }}>
              Installed by {certificate.installed_by.email} on {date_text(certificate.installed_at)}
            </p>
          ) : null}
          {!available ? (
            <p style={{ ...value_style, color: DANGER, marginTop: 8 }}>
              Not available on this server: the deployment agent is not running, so a certificate cannot be installed from here.
            </p>
          ) : null}
        </div>

        <div style={{ flex: '0 1 260px', textAlign: 'right' }}>
          <p style={label_style}>{tone === 'danger' && countdown !== 'expired' ? 'Expires soon' : 'Expires in'}</p>
          <p
            aria-live="polite"
            style={{
              fontFamily: fontHeading,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 0.5,
              color,
              margin: '2px 0 0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {countdown}
          </p>
          <p style={{ ...value_style, color: MUTED }}>
            {not_after ? `Valid until ${date_text(not_after)}` : 'The expiry date is not known'}
          </p>
          <button
            type="button"
            onClick={onUpdate}
            disabled={disabled}
            title={!available ? 'Not available on this server' : undefined}
            style={{ ...button_style(DANGER, false, disabled), marginTop: 12 }}
          >
            Update certificate
          </button>
        </div>
      </div>
    </section>
  );
};

export default CertificateStatusCard;

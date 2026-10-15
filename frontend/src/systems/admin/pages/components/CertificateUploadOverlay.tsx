import React, { useEffect, useRef, useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { DANGER, INK, MUTED, ProgressBar, fontHeading } from './DeployBits';

interface CertificateUploadOverlayProps {
  open: boolean;
  busy: boolean;
  progress: number | null;
  error: string | null;
  onUpload: (file: File) => void;
  onClose: () => void;
}

const FORM_ID = 'certificate-upload-form';
const MAX_BYTES = 5 * 1024 * 1024;

const size_text = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`);

const CertificateUploadOverlay: React.FC<CertificateUploadOverlayProps> = ({ open, busy, progress, error, onUpload, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [local_error, setLocalError] = useState<string | null>(null);
  const input_ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setLocalError(null);
      if (input_ref.current) input_ref.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setLocalError(null);
    if (chosen && !/\.zip$/i.test(chosen.name)) {
      setFile(null);
      setLocalError('Choose a .zip file.');
      return;
    }
    if (chosen && chosen.size > MAX_BYTES) {
      setFile(null);
      setLocalError('The zip is larger than 5 MB. A certificate set is a few kilobytes; check that the right file was chosen.');
      return;
    }
    setFile(chosen);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || busy) return;
    onUpload(file);
  };

  const shown_error = error || local_error;
  const can_submit = Boolean(file) && !busy;

  return (
    <OverlayShell
      title="Update certificate"
      subtitle="Step 2 of 3: the certificate files"
      onClose={onClose}
      busy={busy}
      width="md"
      closeOnBackdrop={false}
      footer={
        <button
          type="submit"
          form={FORM_ID}
          disabled={!can_submit}
          className="cok-btn-primary"
          style={{ width: 'auto', padding: '0.7rem 1.4rem', opacity: can_submit ? 1 : 0.6, cursor: can_submit ? 'pointer' : 'not-allowed' }}
        >
          {busy ? 'Uploading...' : 'Upload and install'}
        </button>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <label htmlFor="certificate-zip" className="cok-auth-label cok-req">
          Zip file with the private key, the certificate and the chain
        </label>
        <input
          id="certificate-zip"
          ref={input_ref}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          disabled={busy}
          onChange={choose}
          style={{ fontFamily: fontHeading, fontSize: 13, color: INK, display: 'block', width: '100%' }}
        />
        <p style={{ fontFamily: fontHeading, fontSize: 12.5, color: MUTED, margin: '10px 0 0', lineHeight: 1.5 }}>
          Exactly three PEM text files, in any names: the private key (BEGIN PRIVATE KEY, no passphrase), the site
          certificate (one BEGIN CERTIFICATE block) and the CA chain (the intermediate certificates of the issuer).
          The server tells them apart by their content, checks that the key belongs to the certificate and that it
          has not expired, then installs them and reloads nginx.
        </p>
        {file ? (
          <p style={{ fontFamily: fontHeading, fontSize: 13, color: INK, margin: '12px 0 0' }}>
            {file.name} ({size_text(file.size)})
          </p>
        ) : null}
        {busy ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: fontHeading, fontSize: 12, color: MUTED, margin: '0 0 6px' }}>
              {progress === null ? 'Uploading...' : progress >= 100 ? 'Uploaded, the server is checking the files...' : `Uploading ${progress}%`}
            </p>
            <ProgressBar percent={progress === null ? 0 : progress} />
          </div>
        ) : null}
        {shown_error ? (
          <p role="alert" style={{ fontFamily: fontHeading, fontSize: 12.5, color: DANGER, margin: '12px 0 0' }}>
            {shown_error}
          </p>
        ) : null}
      </form>
    </OverlayShell>
  );
};

export default CertificateUploadOverlay;

import { get, post, getAccessToken } from './apiClient';

const API_BASE = '/cok/api';

export interface DeploymentTarget {
  key: string;
  label: string;
}

export interface InstalledCertificate {
  subject: string | null;
  issuer: string | null;
  hosts: string[];
  not_before: string | null;
  not_after: string | null;
  days_left: number | null;
  fingerprint: string | null;
  installed_at: string | null;
  installed_by: { user_id: string | null; email: string | null } | null;
  run_id: string | null;
  file_name: string | null;
  source: 'upload' | 'detected' | null;
  checked_at: string | null;
}

export interface CertificateSignature {
  signature: string;
  expires_at: string;
}

export interface CertificateUploadResult {
  run_id: string;
  target: string;
  started_by: string;
}

export interface CertificateUploadError {
  message: string;
  http_status: number;
  data: { run_id?: string } | null;
}

export interface DeploymentRunSummary {
  run_id: string;
  target: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
}

export interface DeploymentLogPage {
  run_id: string;
  chunk: string;
  offset: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  exit_code: number | null;
  error: string | null;
  target: string;
  target_label: string;
  started_at: string | null;
  finished_at: string | null;
  started_by: string | null;
}

export const deploymentManagementService = {
  getTargets: () => get('/deployment/targets'),
  // The password is checked on the server, as is the address the page was
  // opened on. Nothing here decides whether a deployment may run.
  run: (target: string, password: string) => post('/deployment/run', { target, password }),
  // Read by byte offset: update-deploy.sh restarts this very backend, so a
  // held-open stream would always be cut by the deploy itself. Asking for
  // "whatever is after byte N" simply carries on across that restart.
  getLog: (run_id: string, offset: number) => get(`/deployment/log/${encodeURIComponent(run_id)}?offset=${offset}`),
  // The installed SSL certificate and the ones before it.
  getCertificate: () => get('/deployment/certificate'),
  // Step one of a certificate upload: the password buys a short-lived,
  // single-use signature. The file is then sent with the signature only.
  sign_certificate_upload: (password: string) => post('/deployment/certificate/sign', { password }),
  // Step two: the zip, as plain XHR so the browser can report upload
  // progress; the API client has no hook for that. Errors come back in the
  // same { message } shape the rest of the page reads.
  upload_certificate: (file: File, signature: string, on_progress?: (percent: number) => void) =>
    new Promise<{ success: boolean; data?: CertificateUploadResult; message?: string }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/deployment/certificate`);
      const token = getAccessToken();
      if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
      request.setRequestHeader('X-Deploy-Signature', signature);
      request.upload.onprogress = (event) => {
        if (on_progress && event.lengthComputable) on_progress(Math.round((event.loaded / event.total) * 100));
      };
      const fail = (message: string, data: { run_id?: string } | null = null) => {
        const error: CertificateUploadError = { message, http_status: request.status, data };
        reject(error);
      };
      request.onload = () => {
        let body: { success?: boolean; data?: CertificateUploadResult; message?: string } | null = null;
        try {
          body = JSON.parse(request.responseText);
        } catch (ignored) {
          body = null;
        }
        if (request.status >= 200 && request.status < 300 && body) {
          resolve({ success: true, data: body.data, message: body.message });
          return;
        }
        fail((body && body.message) || `The server answered ${request.status}.`, (body && (body.data as { run_id?: string } | null)) || null);
      };
      request.onerror = () => fail('Lost contact with the server while uploading. Check the connection and try again.');
      request.onabort = () => fail('The upload was cancelled.');
      const form = new FormData();
      form.append('file', file, file.name);
      request.send(form);
    }),
};

export default deploymentManagementService;

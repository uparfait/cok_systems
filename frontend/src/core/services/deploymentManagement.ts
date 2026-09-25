import { get, post } from './apiClient';

export interface DeploymentTarget {
  key: string;
  label: string;
}

export interface DeploymentRunSummary {
  run_id: string;
  target: string;
  status: 'running' | 'succeeded' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
}

export interface DeploymentLogPage {
  run_id: string;
  chunk: string;
  offset: number;
  status: 'running' | 'succeeded' | 'failed';
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
};

export default deploymentManagementService;

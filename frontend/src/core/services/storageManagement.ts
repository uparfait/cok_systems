import { get, post } from './apiClient';

export const storageManagementService = {
  getStorageStats: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/data-management/storage-stats${qs ? `?${qs}` : ''}`);
  },
  requestDeleteToken: (data: { collections: string[]; period?: string; from?: string; to?: string; reason?: string }) => {
    return post('/data-management/storage/request-delete', data);
  },
  confirmDelete: (data: { requestKey: string; token: string }) => {
    return post('/data-management/storage/confirm-delete', data);
  },
};

export default storageManagementService;

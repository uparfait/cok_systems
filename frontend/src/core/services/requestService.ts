import { get, post, put } from './apiClient';

export interface RequestSender {
  name?: string;
  email?: string;
  telephone?: string;
}

export interface RequestAssignedBy {
  name: string;
  _id: string;
  tel: string;
  title: string;
}

export interface RequestDoc {
  _id: string;
  redaction_date?: string;
  reference_number?: string;
  reception_date?: string;
  sender?: RequestSender;
  recipient?: string;
  subject?: string;
  orientation?: string;
  remarks?: string;
  status: 'Pending' | 'Inprogress' | 'Completed' | 'Archived' | 'Overdue';
  assigned_by: RequestAssignedBy;
  created_by: RequestAssignedBy;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface RequestStatistics {
  Pending: number;
  Inprogress: number;
  Completed: number;
  Archived: number;
  Overdue: number;
  total: number;
}

export const requestService = {
  create: (data: Partial<RequestDoc>) => post('/requests/create', data),

  update: (id: string, data: Partial<RequestDoc>) => put(`/requests/${id}`, data),

  archive: (id: string, reason: string) => post(`/requests/${id}/archive`, { reason }),

  getAll: (params?: {
    status?: string;
    period?: 'today' | 'week' | 'month' | 'year' | 'range' | 'all';
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    q?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.q) query.append('q', params.q);
    const qs = query.toString();
    return get(`/requests${qs ? `?${qs}` : ''}`);
  },

  getStatistics: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/requests/statistics${qs ? `?${qs}` : ''}`);
  },

  getExportUrl: (params?: {
    period?: string;
    from?: string;
    to?: string;
    fields?: string;
    title?: string;
    senderLayout?: 'combined' | 'separate';
  }) => {
    const query = new URLSearchParams();
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.fields) query.append('fields', params.fields);
    if (params?.title) query.append('title', params.title);
    if (params?.senderLayout) query.append('sender_layout', params.senderLayout);
    const qs = query.toString();
    return `/cok/api/requests/export${qs ? `?${qs}` : ''}`;
  }
};

export default requestService;

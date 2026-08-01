import { get, post, put } from './apiClient';

export interface OutgoingDoc {
  _id: string;
  request_id: string;
  reference_number?: string;
  department_number?: string;
  date_of_reception?: string;
  date_of_recording?: string;
  destination?: string;
  subject?: string;
  sign_by?: string;
  created_by: {
    name: string;
    _id: string;
    tel: string;
    title: string;
  };
  created_at: string;
  updated_at: string;
}

export const outgoingService = {
  create: (data: Partial<OutgoingDoc>) => post('/requests/outgoing/create', data),
  update: (id: string, data: Partial<OutgoingDoc>) => put(`/requests/outgoing/${id}`, data),
  getByRequest: (requestId: string) => get(`/requests/outgoing/by-request/${requestId}`),
  getAll: (params?: {
    period?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    q?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.q) query.append('q', params.q);
    const qs = query.toString();
    return get(`/requests/outgoing${qs ? `?${qs}` : ''}`);
  },
  getExportUrl: (params?: {
    period?: string;
    from?: string;
    to?: string;
    title?: string;
    preparedBy?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.title) query.append('title', params.title);
    if (params?.preparedBy) query.append('prepared_by', params.preparedBy);
    const qs = query.toString();
    return `/cok/api/requests/outgoing/export${qs ? `?${qs}` : ''}`;
  }
};

export default outgoingService;

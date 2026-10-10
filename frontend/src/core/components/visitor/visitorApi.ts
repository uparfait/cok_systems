import type { AxiosRequestConfig } from 'axios';
import apiClient from '../../services/apiClient';
import type {
  DepartmentTarget,
  VisitorAttachment,
  VisitorDetails,
  VisitorInput,
  VisitorListParams,
  VisitorLookupResult,
  VisitorRow,
  Visitor,
  ServingBy,
} from './visitorTypes';

export interface ApiFailure {
  message: string;
  code?: string;
  field?: string;
  existing?: { _id: string; full_name: string } | null;
  serving_by?: ServingBy | null;
  status?: number;
}

export const failureOf = (error: unknown): ApiFailure => {
  const e = (error || {}) as { message?: string; error?: string; response_data?: Record<string, unknown> | null; http_status?: number };
  const data = (e.response_data || {}) as Record<string, unknown>;
  return {
    message: (data.message as string) || e.message || e.error || 'Something went wrong, please try again',
    code: data.code as string | undefined,
    field: data.field as string | undefined,
    existing: (data.existing as ApiFailure['existing']) || null,
    serving_by: (data.serving_by as ServingBy) || null,
    status: e.http_status,
  };
};

const query = (params: object): string => {
  const pairs = Object.entries(params as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]);
  const text = new URLSearchParams(pairs).toString();
  return text ? `?${text}` : '';
};

const send = async <T,>(config: AxiosRequestConfig): Promise<T> => {
  const response = await apiClient(config);
  return response.data as T;
};

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface VisitorPage {
  success: boolean;
  data: VisitorRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const visitorApi = {
  list: (params: VisitorListParams) => send<VisitorPage>({ method: 'GET', url: `/visitors${query(params)}` }),
  lookup: (params: { identification?: string; telephone?: string; email?: string; exclude?: string | null }) =>
    send<VisitorLookupResult & { success: boolean }>({ method: 'GET', url: `/visitors/lookup${query(params)}` }),
  get: (id: string) => send<Envelope<VisitorDetails>>({ method: 'GET', url: `/visitors/${id}` }),
  update: (id: string, input: VisitorInput) => send<Envelope<Visitor>>({ method: 'PUT', url: `/visitors/${id}`, data: input }),
  sendToDepartment: (id: string, target: DepartmentTarget) =>
    send<Envelope<VisitorDetails>>({ method: 'POST', url: `/visitors/${id}/send-to-department`, data: target }),
  serve: (id: string) => send<Envelope<VisitorDetails>>({ method: 'POST', url: `/visitors/${id}/serve`, data: {} }),
  complete: (id: string, notes: string) => send<Envelope<VisitorDetails>>({ method: 'POST', url: `/visitors/${id}/complete`, data: { notes } }),
  transfer: (id: string, target: DepartmentTarget & { notes?: string }) =>
    send<Envelope<VisitorDetails>>({ method: 'POST', url: `/visitors/${id}/transfer`, data: target }),
  attachments: (id: string) => send<{ success: boolean; data: VisitorAttachment[]; total: number }>({ method: 'GET', url: `/visitors/${id}/attachments` }),
  addAttachments: (id: string, items: { file: File; description: string }[], onProgress?: (percent: number) => void) => {
    const form = new FormData();
    items.forEach((item) => {
      form.append('files', item.file, item.file.name);
      form.append('descriptions', item.description);
    });
    return send<{ success: boolean; message: string; total: number }>({
      method: 'POST',
      url: `/visitors/${id}/attachments`,
      data: form,
      timeout: 0,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
  },
  updateAttachment: (id: string, attachmentId: string, change: { description?: string; file?: File | null }, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    if (change.description !== undefined) form.append('description', change.description);
    if (change.file) form.append('file', change.file, change.file.name);
    return send<{ success: boolean; message: string }>({
      method: 'PUT',
      url: `/visitors/${id}/attachments/${attachmentId}`,
      data: form,
      timeout: 0,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
  },
  downloadAttachment: async (attachmentId: string): Promise<Blob> => {
    const response = await apiClient.get(`/visitors/attachments/${attachmentId}/file`, { responseType: 'blob', timeout: 0 });
    return response.data as Blob;
  },
  checkIn: (input: VisitorInput & { has_vehicle?: boolean; plate_number?: string }) =>
    send<Envelope<Record<string, unknown>> & { visitor_created?: boolean }>({ method: 'POST', url: '/servicedelivery/visitor/checkin', data: input }),
};

export const formatSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

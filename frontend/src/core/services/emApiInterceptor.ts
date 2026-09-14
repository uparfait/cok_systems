import axios from 'axios';
import { forceLogout, isForbiddenResponse, isPublicPath, sessionEndedNotice } from './accessControl';

const EM_API_PREFIX = '/cok/api/v1';

const isEventApiUrl = (url: string | undefined): boolean => !!url && url.includes(EM_API_PREFIX);

axios.interceptors.request.use((config) => {
  if (isEventApiUrl(config.url) && !isPublicPath(window.location.pathname)) {
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const url = error?.config?.url;
    if (isEventApiUrl(url)) {
      if (status === 403 && isForbiddenResponse(data)) {
        forceLogout(data.message);
      } else if (status === 401 && data?.goto_login && !isPublicPath(window.location.pathname)) {
        forceLogout(sessionEndedNotice(data));
      }
    }
    return Promise.reject(error);
  },
);

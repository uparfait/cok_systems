import axios from "axios";
import { forceLogout, isForbiddenResponse, sessionEndedNotice } from "../../../core/services/accessControl.ts";

const DCS_API_BASE_URL = "/dcs/api";
const LANGUAGE_STORAGE_KEY = "dcs_language";
const ACCESS_TOKEN_KEY = "accessToken";

const REQUEST_TIMEOUT_MS = 9544535000;

const dcs_api_client = axios.create({
  baseURL: DCS_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: REQUEST_TIMEOUT_MS,
});

dcs_api_client.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Language"] = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "kn";
  return config;
});

dcs_api_client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // A connection failure is reported in words the approver can act
      // on, never as a bare "Network Error".
      return Promise.reject({
        success: false,
        message: "The server could not be reached. Check your connection and try again.",
        message_key: "DCS_ERROR_NETWORK",
        is_network_error: true,
      });
    }
    const response_data = error.response.data || {};
    // The backend refused DCS for this ROLE (RBAC): the session is ended on
    // the spot and the backend's own message is shown on the login page.
    if (error.response.status === 403 && isForbiddenResponse(response_data)) {
      forceLogout(response_data.message);
    } else if (error.response.status === 401 && response_data.goto_login) {
      // The session itself was refused: end it and tell the login page why
      // (an expired token, or a token this service could not verify).
      forceLogout(sessionEndedNotice(response_data));
    }
    return Promise.reject(
      Object.assign({ success: false, message: response_data.message || "Request failed" }, response_data, {
        status_code: error.response.status,
      }),
    );
  },
);

/**
 * Generic request helper shared by every DCS service module.
 */
export async function dcs_request(endpoint, method, data, config) {
  const response = await dcs_api_client(Object.assign({ url: endpoint, method, data }, config || {}));
  return response.data;
}

export default dcs_api_client;

import axios from "axios";

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

/**
 * Clears the shared auth session and sends the browser to the login page,
 * mirroring the main app's redirectToLogin behavior for a rejected session.
 */
function redirect_to_login() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem("userData");
  window.localStorage.removeItem("isAuthenticated");
  window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "unauthorized" } }));
  window.location.href = "/login";
}

dcs_api_client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({ success: false, message: "Network Error", is_network_error: true });
    }
    const response_data = error.response.data || {};
    if (response_data.goto_login) {
      redirect_to_login();
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

import dcs_api_client, { dcs_request } from "./dcsApiClient.js";

const ACCESS_TOKEN_KEY = "accessToken";

export const IMPORT_ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const IMPORT_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/x-csv",
  "application/x-csv",
  "text/comma-separated-values",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "",
];

export function is_import_file(file) {
  if (!file || !file.name) return false;
  const by_name = /\.(csv|xlsx)$/i.test(file.name);
  const by_type = IMPORT_MIME_TYPES.includes(String(file.type || "").toLowerCase());
  return by_name && by_type;
}

function save_blob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function download_import_template(form_group_id, language, format) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const query = `language=${encodeURIComponent(language || "en")}&format=${format === "xlsx" ? "xlsx" : "csv"}`;
    xhr.open("GET", `/dcs/api/forms/${form_group_id}/import/template?${query}`, true);
    xhr.responseType = "blob";
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Template download failed (${xhr.status})`));
      const disposition = xhr.getResponseHeader("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      save_blob(xhr.response, match ? match[1] : `template.${format === "xlsx" ? "xlsx" : "csv"}`);
      resolve(true);
    };
    xhr.onerror = () => reject(new Error("Network error during download"));
    xhr.send();
  });
}

export async function upload_import_file(form_group_id, file, on_progress) {
  const form_data = new FormData();
  form_data.append("file", file, file.name);
  const response = await dcs_api_client.post(`/forms/${form_group_id}/import/upload`, form_data, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (on_progress && event.total) on_progress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
}

export function run_import(form_group_id, import_id, mapping, defaults) {
  return dcs_request(`/forms/${form_group_id}/import/${import_id}/run`, "POST", { mapping, defaults });
}

export function get_import_status(form_group_id, import_id) {
  return dcs_request(`/forms/${form_group_id}/import/${import_id}/status`, "GET");
}

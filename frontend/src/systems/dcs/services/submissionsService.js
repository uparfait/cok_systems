import { dcs_request } from "./dcsApiClient.js";

/**
 * Downloads an Excel export of all submissions for a form within an optional
 * date range. Runs the export entirely server-side and streams the
 * resulting .xlsx back as a download, reporting real download progress via
 * the on_progress callback (0-100).
 */
export function export_submissions_excel(form_group_id, period, from, to, title, language, on_progress) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (period && period !== "all") {
      params.append("period", period);
      if (period === "custom") {
        if (from) params.append("from", from);
        if (to) params.append("to", to);
      }
    }
    if (title) params.append("title", title);
    if (language) params.append("language", language);

    const query = params.toString();
    const url = `/dcs/api/submissions/export/${form_group_id}${query ? "?" + query : ""}`;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";

    const token = window.localStorage.getItem("accessToken");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("X-Language", window.localStorage.getItem("dcs_language") || "kn");

    xhr.onprogress = (event) => {
      if (event.lengthComputable && on_progress) {
        on_progress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const disposition = xhr.getResponseHeader("Content-Disposition");
        let filename = "export.xlsx";
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }
        resolve({ blob: xhr.response, filename });
      } else {
        const content_type = xhr.getResponseHeader("Content-Type") || "";
        if (content_type.includes("application/json")) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result);
              reject({ is_info: true, message: json.message || `Export failed (${xhr.status})` });
            } catch {
              reject({ is_info: false, message: `Export failed (${xhr.status})` });
            }
          };
          reader.readAsText(xhr.response);
        } else {
          reject({ is_info: false, message: `Export failed (${xhr.status})` });
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during export"));
    xhr.send();
  });
}

/**
 * The background export: start a job (202 with job_id and total), follow
 * it by long-poll (known_percent holds the answer until progress moves),
 * download the finished file, or stop it.
 */
export function start_export_job(form_group_id, payload) {
  return dcs_request(`/submissions/export/${form_group_id}/start`, "POST", payload);
}

export function get_export_job(job_id, known_percent) {
  const query = Number.isFinite(known_percent) ? `?known_percent=${known_percent}` : "";
  return dcs_request(`/submissions/export-jobs/${job_id}${query}`, "GET");
}

export function cancel_export_job(job_id) {
  return dcs_request(`/submissions/export-jobs/${job_id}/cancel`, "POST");
}

export function download_export_job(job_id, on_progress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `/dcs/api/submissions/export-jobs/${job_id}/download`, true);
    xhr.responseType = "blob";
    const token = window.localStorage.getItem("accessToken");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onprogress = (event) => {
      if (event.lengthComputable && on_progress) on_progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Download failed (${xhr.status})`));
      const disposition = xhr.getResponseHeader("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      resolve({ blob: xhr.response, filename: match ? match[1] : "export.xlsx" });
    };
    xhr.onerror = () => reject(new Error("Network error during download"));
    xhr.send();
  });
}

/**
 * Fetches ALL collected submissions for a form (no pagination) within an
 * optional date range - backs the Excel export feature. Returns the raw
 * submission records so the caller can build the spreadsheet.
 */
export function export_submissions(form_group_id, period, from, to) {
  const params = new URLSearchParams();
  if (period && period !== "all") {
    params.append("period", period);
    if (period === "custom") {
      if (from) params.append("from", from);
      if (to) params.append("to", to);
    }
  }
  const query = params.toString();
  return dcs_request(`/submissions/export/${form_group_id}${query ? "?" + query : ""}`, "GET");
}

/**
 * Paginated, authenticated list of collected submissions for a form,
 * optionally scoped to a single version, a date range, a free-text search
 * (matched against every string/number field value within that range) and
 * a sort direction (newest/oldest). Leaving version out returns
 * submissions across every version of the form.
 */
export function get_submissions(form_group_id, version, page, limit, options) {
  const params = new URLSearchParams();
  if (version !== undefined && version !== null) params.append("version", version);
  params.append("page", page || 1);
  params.append("limit", limit || 20);
  if (options && options.period) {
    params.append("period", options.period);
    if (options.period === "custom") {
      if (options.from) params.append("from", options.from);
      if (options.to) params.append("to", options.to);
    }
  }
  if (options && options.search) params.append("search", options.search);
  if (options && options.sort) params.append("sort", options.sort);
  // Per-column value filters: { field_id: [value, ...] }, JSON in the query string.
  if (options && options.filters && Object.keys(options.filters).length > 0) {
    params.append("filters", JSON.stringify(options.filters));
  }
  // One record, opened on its own - the gallery following a picture back
  // to the row it came from. The backend drops every other filter for it.
  if (options && options.record) params.append("record", options.record);
  return dcs_request(`/submissions/${form_group_id}?${params.toString()}`, "GET");
}

/**
 * Public, no-auth submission of a response. The server re-validates
 * everything against the exact version submitted.
 */
export function submit_response(form_group_id, payload) {
  return dcs_request(`/public/forms/${form_group_id}/submit`, "POST", payload);
}

/**
 * Permanently deletes one specific collected response. Irreversible.
 */
export function delete_submission(submission_id) {
  return dcs_request(`/submissions/record/${submission_id}`, "DELETE");
}

/**
 * Permanently deletes every record the data table currently has ticked.
 * Irreversible - the backend re-checks edit rights on each form behind
 * the selection before removing anything.
 */
export function delete_selected_submissions(submission_ids) {
  return dcs_request("/submissions/delete-selected", "POST", { submission_ids });
}

/**
 * One page of the Gallery: the pictures and videos a form collected,
 * newest first. Paged over the media answers themselves, not over
 * records, so a record carrying none never leaves a hole in the grid.
 */
export function get_submission_media(form_group_id, page, limit, options) {
  const params = new URLSearchParams();
  params.append("page", page || 1);
  params.append("limit", limit || 10);
  if (options && options.period) {
    params.append("period", options.period);
    if (options.period === "custom") {
      if (options.from) params.append("from", options.from);
      if (options.to) params.append("to", options.to);
    }
  }
  if (options && options.filters && Object.keys(options.filters).length > 0) {
    params.append("filters", JSON.stringify(options.filters));
  }
  return dcs_request(`/submissions/${form_group_id}/media?${params.toString()}`, "GET");
}

/**
 * The values one choice column has actually collected, each with its
 * record count - what that column's own filter dropdown lists.
 */
export function get_field_values(form_group_id, field_id, options) {
  const params = new URLSearchParams();
  if (options && options.period) {
    params.append("period", options.period);
    if (options.period === "custom") {
      if (options.from) params.append("from", options.from);
      if (options.to) params.append("to", options.to);
    }
  }
  // A cascade child only lists the values under the parent values picked above it.
  if (options && options.parent && options.parent.field_id && Array.isArray(options.parent.values) && options.parent.values.length > 0) {
    params.append("parent_field_id", options.parent.field_id);
    params.append("parent_values", JSON.stringify(options.parent.values));
  }
  return dcs_request(`/submissions/${form_group_id}/field-values/${field_id}?${params.toString()}`, "GET");
}

/**
 * Public, no-auth read of one collected record together with the exact
 * form version it was collected against - what /dcs-form/edit/:id opens.
 */
export function get_public_record(submission_id) {
  return dcs_request(`/public/records/${submission_id}`, "GET");
}

/**
 * Public, no-auth full edit of one collected record: every field may
 * change, the answers are re-validated against the record's own version,
 * and the change is written into the record's history.
 */
export function update_public_record_full(submission_id, payload) {
  return dcs_request(`/public/records/${submission_id}`, "PUT", payload);
}
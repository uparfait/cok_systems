const DCS_API_BASE_URL = "/dcs/api";
const SUBMISSION_UPLOAD_URL_PREFIX = "/dcs/api/uploads/submissions/";

/**
 * True only for a URL this endpoint itself produced - a respondent who
 * pasted an external link instead of uploading has nothing on our disk to
 * clean up, and must never have that link's target touched.
 */
export function is_own_submission_upload_url(url) {
  return typeof url === "string" && url.startsWith(SUBMISSION_UPLOAD_URL_PREFIX);
}

/**
 * Deletes one previously-uploaded media answer - called the instant it's
 * replaced by a new upload, or removed from its field, so refilling a media
 * field over and over never leaves a trail of orphaned files on disk.
 * Best-effort: a failed cleanup just leaves one file behind, never
 * something worth interrupting the respondent for, so this never throws.
 */
export async function delete_uploaded_file(form_group_id, url) {
  if (!is_own_submission_upload_url(url)) return;
  try {
    await fetch(`${DCS_API_BASE_URL}/public/forms/${form_group_id}/upload`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch (delete_error) {
    // Best-effort - see docstring above.
  }
}

/**
 * Uploads one respondent-provided file (or a signature exported as a PNG
 * blob) to the public, no-auth upload endpoint, reporting live progress so
 * the field it came from can show its own percentage while it's in
 * flight. Plain XMLHttpRequest rather than the shared axios client -
 * axios's upload progress event works the same way, but a raw XHR keeps
 * this one file-shaped request independent of the JSON-only interceptors
 * (Content-Type, auth header) wired onto dcs_api_client.
 */
export function upload_file_with_progress(form_group_id, { version, field_id, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const form_data = new FormData();
    form_data.append("version", version);
    form_data.append("field_id", field_id);
    form_data.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${DCS_API_BASE_URL}/public/forms/${form_group_id}/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let response = null;
      try {
        response = JSON.parse(xhr.responseText);
      } catch (parse_error) {
        reject(Object.assign(new Error("upload_response_invalid"), { is_network_error: false }));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && response.success) {
        resolve(response.data);
      } else {
        reject(Object.assign(new Error(response.message || "upload_failed"), { status_code: xhr.status }));
      }
    };

    xhr.onerror = () => reject(Object.assign(new Error("Network Error"), { is_network_error: true }));

    xhr.send(form_data);
  });
}

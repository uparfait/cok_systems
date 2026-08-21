const DCS_API_BASE_URL = "/dcs/api";
const ACCESS_TOKEN_KEY = "accessToken";
const DESIGN_UPLOAD_URL_PREFIX = "/dcs/api/uploads/design/";

/**
 * True only for a URL this endpoint itself produced - a form author who
 * pasted an external link instead of uploading has nothing on our disk to
 * clean up, and must never have that link's target touched.
 */
export function is_own_design_upload_url(url) {
  return typeof url === "string" && url.startsWith(DESIGN_UPLOAD_URL_PREFIX);
}

/**
 * Deletes one previously-uploaded content-block file - called the instant
 * it's replaced by a new upload/link, or the component holding it is
 * removed from the canvas, so editing a form over and over never leaves a
 * trail of orphaned files on disk. Best-effort: a failed cleanup just
 * leaves one file behind, never something worth interrupting the designer
 * for, so this never throws.
 */
export async function delete_design_file(url) {
  if (!is_own_design_upload_url(url)) return;
  try {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    await fetch(`${DCS_API_BASE_URL}/forms/upload`, {
      method: "DELETE",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
      body: JSON.stringify({ url }),
    });
  } catch (delete_error) {
    // Best-effort - see docstring above.
  }
}

/**
 * Uploads one form-author content-block file (File/Image design component)
 * while building a form, with live progress - the authenticated
 * counterpart of uploadService.js's public submission upload. allowed_group
 * restricts the accepted extension the same way a data field's
 * allowed_file_type_groups would (e.g. "images" for the Image block).
 */
export function upload_design_file_with_progress(file, { allowed_group, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const form_data = new FormData();
    if (allowed_group) form_data.append("allowed_group", allowed_group);
    form_data.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${DCS_API_BASE_URL}/forms/upload`);
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

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
        reject(new Error("upload_response_invalid"));
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

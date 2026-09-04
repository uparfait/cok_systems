import { dcs_request } from "./dcsApiClient.js";

const DCS_API_BASE_URL = "/dcs/api";

/** Public, no-auth fetch of one approver's view of a submission, used by /dcs-approval/:token. */
export function get_approval(token) {
  return dcs_request(`/public/approvals/${token}`, "GET");
}

/** Records this approver's approve/reject decision; approve requires a signature or certificate. */
export function submit_approval_decision(token, decision, comment, signature) {
  return dcs_request(`/public/approvals/${token}/decision`, "POST", { decision, comment, signature });
}

/** Builds the shareable approver page link for a step token. */
export function build_approval_link(token) {
  return `${window.location.origin}/dcs-approval/${token}`;
}

/** Authenticated: every submission routed to the logged-in user's email, across all forms. */
export function get_my_approvals() {
  return dcs_request("/approvals/my", "GET");
}

/** Authenticated: the form's configured approvers, its waiting approval schedule and its recently sent batches. */
export function get_approval_schedule(form_group_id) {
  return dcs_request(`/approvals/schedule/${form_group_id}`, "GET");
}

/** Authenticated: creates or replaces a form's approval schedule - just the timer; approvers come from the form's approval flow. */
export function save_approval_schedule(form_group_id, trigger) {
  return dcs_request(`/approvals/schedule/${form_group_id}`, "PUT", { trigger });
}

/** Authenticated: cancels a form's waiting approval schedule. */
export function cancel_approval_schedule(form_group_id) {
  return dcs_request(`/approvals/schedule/${form_group_id}`, "DELETE");
}

/** Authenticated: immediately starts a batch approval routed to the form's configured approvers, in hierarchy order. */
export function send_approval_links_now(form_group_id) {
  return dcs_request(`/approvals/schedule/${form_group_id}/send-now`, "POST", {});
}

/** Authenticated: one submission's full approval picture for the row-click details panel. */
export function get_submission_approval_details(submission_id) {
  return dcs_request(`/approvals/submission/${submission_id}`, "GET");
}

/** Public: one approver's view of a batch approval request behind /dcs-batch-approval/:token. */
export function get_batch_approval(token) {
  return dcs_request(`/public/batch-approvals/${token}`, "GET");
}

/** Public: exchanges the emailed one-time code for the batch's collected records. */
export function verify_batch_approval_otp(token, otp) {
  return dcs_request(`/public/batch-approvals/${token}/verify`, "POST", { otp });
}

/** Public: records the approver's batch decision, authorized by the one-time code. */
export function submit_batch_approval_decision(token, otp, decision, comment) {
  return dcs_request(`/public/batch-approvals/${token}/decision`, "POST", { otp, decision, comment });
}

/** Uploads the approver's drawn signature PNG or certificate file; raw XHR for upload progress, like uploadService.js. */
export function upload_approval_file(token, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form_data = new FormData();
    form_data.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${DCS_API_BASE_URL}/public/approvals/${token}/upload`);

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

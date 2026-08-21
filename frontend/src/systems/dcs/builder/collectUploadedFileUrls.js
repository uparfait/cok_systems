import { is_own_design_upload_url } from "../services/designUploadService.js";

/**
 * Walks a field (and, for a group/section, every descendant) collecting
 * every content-block file our own disk-storage endpoint produced - used
 * right before that field is removed from the canvas, so its file(s) can
 * be deleted along with it instead of sitting on disk forever, unreferenced
 * by any component. A field whose file/image is a pasted external link (not
 * one of our own uploads) contributes nothing here - there is nothing on
 * our disk to clean up for it.
 */
export function collect_uploaded_file_urls(field, accumulator) {
  const urls = accumulator || [];
  if (!field || typeof field !== "object") return urls;

  if (field.type === "file" && is_own_design_upload_url(field.file_url)) urls.push(field.file_url);
  if (field.type === "image_block" && is_own_design_upload_url(field.image_url)) urls.push(field.image_url);

  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    field.children.forEach((child) => collect_uploaded_file_urls(child, urls));
  }

  return urls;
}

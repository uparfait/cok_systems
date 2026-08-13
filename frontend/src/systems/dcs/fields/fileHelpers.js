/**
 * Reads a browser File object into a base64 data URL so it can travel
 * inside the same JSON submission payload as every other answer, and be
 * queued in IndexedDB exactly like the rest of the response while offline.
 */
export function read_file_as_data_url(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data_url: reader.result });
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

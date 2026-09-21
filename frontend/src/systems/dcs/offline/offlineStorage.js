import { get, set, del } from "idb-keyval";

/**
 * One key/value store for everything the public form keeps on the device
 * (form cache, draft, queued responses). IndexedDB is the first choice;
 * where a browser refuses it (private browsing on some phones, old or
 * restricted webviews, a quota of zero) the same calls fall back to
 * localStorage, and when even that is unavailable to an in-memory map so
 * the page keeps working for the current visit. Files picked while offline
 * survive the localStorage tier as data URLs and come back as real File
 * objects.
 */
const FILE_MARKER = "__dcs_stored_file__";
const LOCAL_PREFIX = "dcs_store_";

const memory_store = new Map();
let backend = null;
let probe_promise = null;

function local_storage() {
  try {
    const storage = window.localStorage;
    const probe_key = `${LOCAL_PREFIX}probe`;
    storage.setItem(probe_key, "1");
    storage.removeItem(probe_key);
    return storage;
  } catch (storage_error) {
    return null;
  }
}

async function probe_indexeddb() {
  const probe_key = "dcs_store_probe";
  const timeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error("idb_timeout")), 4000));
  await Promise.race([
    (async () => {
      await set(probe_key, { ok: true, at: Date.now() });
      const back = await get(probe_key);
      if (!back || back.ok !== true) throw new Error("idb_readback");
      await del(probe_key);
    })(),
    timeout,
  ]);
}

/**
 * Finds the best backend this browser allows, once. Also asks the browser
 * to treat the origin's storage as persistent so the queue is not evicted
 * under storage pressure on phones.
 */
export function probe_storage() {
  if (probe_promise) return probe_promise;
  probe_promise = (async () => {
    try {
      if (window.navigator.storage && window.navigator.storage.persist) {
        window.navigator.storage.persist().catch(() => {});
      }
    } catch (persist_error) {
      // Not every browser exposes the API; nothing to do.
    }
    try {
      if (window.indexedDB) {
        await probe_indexeddb();
        backend = "indexeddb";
        return backend;
      }
    } catch (idb_error) {
      // Fall through to the next tier.
    }
    backend = local_storage() ? "localstorage" : "memory";
    return backend;
  })();
  return probe_promise;
}

/** The backend in use: "indexeddb", "localstorage" or "memory" (null before the probe ran). */
export function storage_backend() {
  return backend;
}

function read_file_as_data_url(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function data_url_to_file(entry) {
  const comma = entry.data_url.indexOf(",");
  const binary = window.atob(entry.data_url.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], entry.name || "file", { type: entry.type || "", lastModified: entry.last_modified || Date.now() });
}

function is_plain_object(value) {
  return !!value && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Replaces every File/Blob in a value tree with a serialisable record. */
async function encode_files(value) {
  if (value instanceof Blob) {
    return { [FILE_MARKER]: true, name: value.name || "file", type: value.type || "", last_modified: value.lastModified || Date.now(), data_url: await read_file_as_data_url(value) };
  }
  if (Array.isArray(value)) return Promise.all(value.map((entry) => encode_files(entry)));
  if (is_plain_object(value)) {
    const next = {};
    for (const [key, entry] of Object.entries(value)) next[key] = await encode_files(entry);
    return next;
  }
  return value;
}

/** The inverse of encode_files: stored file records become File objects again. */
function decode_files(value) {
  if (Array.isArray(value)) return value.map((entry) => decode_files(entry));
  if (is_plain_object(value)) {
    if (value[FILE_MARKER] === true && typeof value.data_url === "string") return data_url_to_file(value);
    const next = {};
    Object.entries(value).forEach(([key, entry]) => {
      next[key] = decode_files(entry);
    });
    return next;
  }
  return value;
}

async function local_get(key) {
  const storage = local_storage();
  if (!storage) return memory_store.get(key);
  const raw = storage.getItem(LOCAL_PREFIX + key);
  if (raw === null) return undefined;
  try {
    return decode_files(JSON.parse(raw));
  } catch (parse_error) {
    return undefined;
  }
}

async function local_set(key, value) {
  const storage = local_storage();
  if (!storage) {
    memory_store.set(key, value);
    return;
  }
  const encoded = JSON.stringify(await encode_files(value));
  try {
    storage.setItem(LOCAL_PREFIX + key, encoded);
    memory_store.delete(key);
  } catch (quota_error) {
    // Too big for localStorage (large attachments): kept for this visit only.
    memory_store.set(key, value);
  }
}

async function local_del(key) {
  memory_store.delete(key);
  const storage = local_storage();
  if (storage) storage.removeItem(LOCAL_PREFIX + key);
}

export async function storage_get(key) {
  if (!backend) await probe_storage();
  if (backend === "indexeddb") {
    try {
      const value = await get(key);
      if (value !== undefined) return value;
    } catch (idb_error) {
      backend = local_storage() ? "localstorage" : "memory";
    }
  }
  const local = await local_get(key);
  if (local !== undefined) return local;
  return memory_store.get(key);
}

export async function storage_set(key, value) {
  if (!backend) await probe_storage();
  if (backend === "indexeddb") {
    try {
      await set(key, value);
      return;
    } catch (idb_error) {
      backend = local_storage() ? "localstorage" : "memory";
    }
  }
  await local_set(key, value);
}

export async function storage_del(key) {
  if (!backend) await probe_storage();
  if (backend === "indexeddb") {
    try {
      await del(key);
    } catch (idb_error) {
      backend = local_storage() ? "localstorage" : "memory";
    }
  }
  await local_del(key);
}

export const storage_internals = { encode_files, decode_files, FILE_MARKER };

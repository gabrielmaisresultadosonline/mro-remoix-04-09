// Browser-only storage for /motionmro (IndexedDB), nothing goes to the cloud.
const DB = "motionmro", STORE = "kv";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await open();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res((q.result as T) ?? fallback);
      q.onerror = () => res(fallback);
    });
  } catch { return fallback; }
}
export async function kvSet(key: string, value: unknown) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function kvClear() {
  const db = await open();
  await new Promise<void>((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = () => res(); });
}

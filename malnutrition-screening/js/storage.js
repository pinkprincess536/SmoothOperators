const DB_NAME = "malnutrition-screening";
const STORE = "lms";
const RECORD_STORE = "records";
const KEY = "who-lms-v2";
const LEGACY_KEYS = ["who-lms-v1"];

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const rs = db.createObjectStore(RECORD_STORE, { keyPath: "id" });
        rs.createIndex("createdAtUtc", "createdAtUtc", { unique: false });
      }
    };
  });
}

export async function saveLmsJson(data) {
  const db = await openDb();
  const payload = {
    envelopeVersion: 2,
    savedAtUtc: new Date().toISOString(),
    data,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeRecord(rec) {
  if (!rec) return null;
  if (rec.envelopeVersion === 2 && rec.data) return rec;
  return { envelopeVersion: 1, savedAtUtc: null, data: rec };
}

export async function loadLmsRecord() {
  const db = await openDb();
  const readKey = (key) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

  const current = normalizeRecord(await readKey(KEY));
  if (current) return current;

  for (const legacyKey of LEGACY_KEYS) {
    const legacy = normalizeRecord(await readKey(legacyKey));
    if (legacy) return legacy;
  }
  return null;
}

export async function loadLmsJson() {
  const rec = await loadLmsRecord();
  return rec ? rec.data : null;
}

export async function clearLmsJson() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(KEY);
    LEGACY_KEYS.forEach((legacyKey) => tx.objectStore(STORE).delete(legacyKey));
  });
}

export async function saveScreeningRecord(record) {
  const db = await openDb();
  const payload = {
    id: crypto.randomUUID(),
    createdAtUtc: new Date().toISOString(),
    ...record,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    tx.objectStore(RECORD_STORE).put(payload);
    tx.oncomplete = () => resolve(payload);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listScreeningRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readonly");
    const req = tx.objectStore(RECORD_STORE).getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => String(a.createdAtUtc).localeCompare(String(b.createdAtUtc)));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecordsByAadhar(aadharNumber) {
  const allRecords = await listScreeningRecords();
  return allRecords.filter(r => r.input && String(r.input.aadhar).trim() === String(aadharNumber).trim());
}

export async function replaceScreeningRecords(records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    const store = tx.objectStore(RECORD_STORE);
    store.clear();
    (records || []).forEach((r) => {
      const row = {
        id: r.id || crypto.randomUUID(),
        createdAtUtc: r.createdAtUtc || new Date().toISOString(),
        input: r.input || {},
        result: r.result || {},
      };
      store.put(row);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearScreeningRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    tx.objectStore(RECORD_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

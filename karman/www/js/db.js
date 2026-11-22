// Хранилище на телефоне (IndexedDB). Ничего не уходит в интернет.
const DB = 'kalta', STORE = 'kv';
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function req(mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const r = fn(tx.objectStore(STORE));
    tx.oncomplete = () => res(r?.result);
    tx.onerror = () => rej(tx.error);
  }));
}

export const idbGet = key => req('readonly', s => s.get(key));
export const idbSet = (key, val) => req('readwrite', s => s.put(val, key));
export const idbDel = key => req('readwrite', s => s.delete(key));

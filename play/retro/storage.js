let opening;
function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('tree-retro-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves', { keyPath: 'romHash' });
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = undefined; }; resolve(db); };
    request.onerror = () => { opening = undefined; reject(new Error('Browser storage is unavailable. Export a save to keep your progress.')); };
    request.onblocked = () => { opening = undefined; reject(new Error('Close other arcade tabs and try saving again.')); };
  });
  return opening;
}

export async function readSave(romHash) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('saves', 'readonly');
    const request = transaction.objectStore('saves').get(romHash);
    transaction.oncomplete = () => resolve(request.result || null);
    transaction.onabort = transaction.onerror = () => reject(new Error('Could not read your save. Try importing a backup.'));
  });
}

export async function writeSave(save) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('saves', 'readwrite');
    transaction.objectStore('saves').put(save);
    transaction.oncomplete = () => resolve(save);
    transaction.onabort = transaction.onerror = () => reject(new Error('Your browser could not store progress. Export a save before leaving.'));
  });
}

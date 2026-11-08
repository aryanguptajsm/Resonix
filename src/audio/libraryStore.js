const DATABASE_NAME = 'resonix-library';
const DATABASE_VERSION = 1;
const STORE_NAME = 'tracks';

function openLibraryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error('Could not open the local music library.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function writeTrack(record) {
  const database = await openLibraryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not save this track to the local library.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Saving this track to the local library was interrupted.'));
    };
  });
}

export async function saveLibraryTrack(track) {
  if (!track.handle) return;
  const { file, url, needsAccess, ...record } = track;
  await writeTrack(record);
}

export async function getSavedLibraryTracks() {
  const database = await openLibraryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read the local music library.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not read the local music library.'));
    };
  });
}

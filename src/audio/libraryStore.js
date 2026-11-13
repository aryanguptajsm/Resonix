const DATABASE_NAME = 'resonix-library';
const DATABASE_VERSION = 2;
const STORE_NAME = 'tracks';
const ANALYSIS_STORE_NAME = 'analysis';

function openLibraryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error('Could not open the local music library.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(ANALYSIS_STORE_NAME)) {
        database.createObjectStore(ANALYSIS_STORE_NAME, { keyPath: 'hash' });
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

export async function getSavedTrackAnalysis(hash) {
  const database = await openLibraryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANALYSIS_STORE_NAME, 'readonly');
    const request = transaction.objectStore(ANALYSIS_STORE_NAME).get(hash);
    request.onsuccess = () => resolve(request.result?.analysis || null);
    request.onerror = () => reject(request.error || new Error('Could not read the saved audio analysis.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not read the saved audio analysis.'));
    };
  });
}

export async function saveTrackAnalysis(hash, analysis) {
  const database = await openLibraryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANALYSIS_STORE_NAME, 'readwrite');
    transaction.objectStore(ANALYSIS_STORE_NAME).put({ hash, analysis });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not save the audio analysis.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Saving the audio analysis was interrupted.'));
    };
  });
}

// autosave.ts - client-side crash/refresh recovery for the in-progress diagram session.
// Stored in IndexedDB (per browser/device only - see App.tsx for the restore flow).

const DB_NAME = 'tool4boxology';
const DB_VERSION = 1;
const STORE_NAME = 'autosave';
const SESSION_KEY = 'session';

export interface AutosavedPage {
  id: string;
  name: string;
  nodeDataArray: any[];
  linkDataArray: any[];
  boxologyId?: string;
  boxologyLabel?: string;
}

export interface AutosavedSession {
  pages: AutosavedPage[];
  currentPageId: string;
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(session: AutosavedSession): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(session, SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Autosave failed:', err);
  }
}

export async function loadSession(): Promise<AutosavedSession | null> {
  try {
    const db = await openDB();
    const result = await new Promise<AutosavedSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SESSION_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.warn('Failed to load autosaved session:', err);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Failed to clear autosaved session:', err);
  }
}

// A session with a single untouched blank page isn't worth prompting the user to restore.
export function isEmptySession(session: AutosavedSession): boolean {
  return session.pages.every(
    (p) => (p.nodeDataArray?.length ?? 0) === 0 && (p.linkDataArray?.length ?? 0) === 0
  );
}

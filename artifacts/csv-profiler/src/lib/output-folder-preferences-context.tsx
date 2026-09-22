import { createContext, useContext, useEffect, useState } from "react";

const ENCRYPTION_FOLDER_KEY = "airavata-dea-default-encryption-folder";
const DECRYPTION_FOLDER_KEY = "airavata-dea-default-decryption-folder";
const BROWSER_DB_NAME = "airavata-dea-preferences";
const BROWSER_STORE_NAME = "folders";

export interface FolderHandle {
  name?: string;
  queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }>;
  }>;
}

export type FolderTarget = string | FolderHandle | null;

interface OutputFolderPreferences {
  encryptionFolder: FolderTarget;
  decryptionFolder: FolderTarget;
  setEncryptionFolder: (folder: FolderTarget) => void;
  setDecryptionFolder: (folder: FolderTarget) => void;
}

const OutputFolderPreferencesContext = createContext<OutputFolderPreferences>({
  encryptionFolder: null,
  decryptionFolder: null,
  setEncryptionFolder: () => {},
  setDecryptionFolder: () => {},
});

function browserStorageAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openBrowserDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BROWSER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BROWSER_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBrowserFolder(key: string): Promise<FolderHandle | null> {
  if (!browserStorageAvailable()) return null;
  try {
    const db = await openBrowserDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(BROWSER_STORE_NAME, "readonly")
        .objectStore(BROWSER_STORE_NAME)
        .get(key);
      request.onsuccess = () => resolve((request.result as FolderHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeBrowserFolder(key: string, folder: FolderHandle | null): Promise<void> {
  if (!browserStorageAvailable()) return;
  try {
    const db = await openBrowserDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(BROWSER_STORE_NAME, "readwrite")
        .objectStore(BROWSER_STORE_NAME)
        .put(folder, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Browser folder-handle persistence is optional; the current session still works.
  }
}

function readFolderName(storageKey: string): string {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeFolderName(storageKey: string, name: string) {
  try {
    if (name) window.localStorage.setItem(storageKey, name);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

function folderName(folder: FolderTarget): string {
  if (!folder) return "";
  return typeof folder === "string" ? folder : folder.name ?? "Selected folder";
}

export function OutputFolderPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [encryptionFolder, setEncryptionFolderState] = useState<FolderTarget>(null);
  const [decryptionFolder, setDecryptionFolderState] = useState<FolderTarget>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const desktopStorage = window.desktopAPI?.getDefaultOutputFolders;
      if (desktopStorage) {
        try {
          const stored = await desktopStorage();
          if (!cancelled) {
            setEncryptionFolderState(stored?.encryption ?? null);
            setDecryptionFolderState(stored?.decryption ?? null);
          }
          return;
        } catch {
          // Fall back to browser persistence if desktop storage is unavailable.
        }
      }

      const [browserEncryption, browserDecryption] = await Promise.all([
        readBrowserFolder(ENCRYPTION_FOLDER_KEY),
        readBrowserFolder(DECRYPTION_FOLDER_KEY),
      ]);
      if (!cancelled) {
        setEncryptionFolderState(browserEncryption ?? readFolderName(ENCRYPTION_FOLDER_KEY) || null);
        setDecryptionFolderState(browserDecryption ?? readFolderName(DECRYPTION_FOLDER_KEY) || null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setEncryptionFolder = (folder: FolderTarget) => {
    setEncryptionFolderState(folder);
    const desktopStorage = window.desktopAPI?.setDefaultOutputFolders;
    if (desktopStorage) {
      void desktopStorage({ encryption: typeof folder === "string" ? folder : null }).catch(() => {});
    } else {
      writeFolderName(ENCRYPTION_FOLDER_KEY, folderName(folder));
      void writeBrowserFolder(ENCRYPTION_FOLDER_KEY, typeof folder === "string" ? null : folder);
    }
  };

  const setDecryptionFolder = (folder: FolderTarget) => {
    setDecryptionFolderState(folder);
    const desktopStorage = window.desktopAPI?.setDefaultOutputFolders;
    if (desktopStorage) {
      void desktopStorage({ decryption: typeof folder === "string" ? folder : null }).catch(() => {});
    } else {
      writeFolderName(DECRYPTION_FOLDER_KEY, folderName(folder));
      void writeBrowserFolder(DECRYPTION_FOLDER_KEY, typeof folder === "string" ? null : folder);
    }
  };

  return (
    <OutputFolderPreferencesContext.Provider value={{
      encryptionFolder,
      decryptionFolder,
      setEncryptionFolder,
      setDecryptionFolder,
    }}>
      {children}
    </OutputFolderPreferencesContext.Provider>
  );
}

export function useOutputFolderPreferences() {
  return useContext(OutputFolderPreferencesContext);
}

export function getFolderLabel(folder: FolderTarget): string {
  return folderName(folder);
}
import { createContext, useContext, useEffect, useState } from "react";

const ENCRYPTION_STORAGE_KEY = "airavata-dea-preferred-columns";
const DECRYPTION_STORAGE_KEY = "airavata-dea-preferred-decryption-columns";

interface ColumnPreferences {
  preferredColumns: string[];
  preferredDecryptionColumns: string[];
  setPreferredColumns: (columns: string[]) => void;
  setPreferredDecryptionColumns: (columns: string[]) => void;
}

const ColumnPreferencesContext = createContext<ColumnPreferences>({
  preferredColumns: [],
  preferredDecryptionColumns: [],
  setPreferredColumns: () => {},
  setPreferredDecryptionColumns: () => {},
});

function readStoredColumns(storageKey: string): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function ColumnPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferredColumns, setPreferredColumns] = useState<string[]>([]);
  const [preferredDecryptionColumns, setPreferredDecryptionColumns] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadPreferences = async () => {
      const browserColumns = readStoredColumns(ENCRYPTION_STORAGE_KEY);
      const browserDecryptionColumns = readStoredColumns(DECRYPTION_STORAGE_KEY);
      const desktopStorage = window.desktopAPI?.getColumnPreferences;
      const desktopDecryptionStorage = window.desktopAPI?.getDecryptionColumnPreferences;

      if (!desktopStorage || !desktopDecryptionStorage) {
        if (!cancelled) {
          setPreferredColumns(browserColumns);
          setPreferredDecryptionColumns(browserDecryptionColumns);
          setStorageReady(true);
        }
        return;
      }

      try {
        const desktopColumns = await desktopStorage();
        const desktopDecryptionColumns = await desktopDecryptionStorage();
        if (cancelled) return;
        setPreferredColumns(desktopColumns ?? browserColumns);
        setPreferredDecryptionColumns(desktopDecryptionColumns ?? browserDecryptionColumns);
        setStorageReady(true);

        // Migrate preferences saved by an earlier renderer-only version.
        if (desktopColumns === null && browserColumns.length > 0) {
          await window.desktopAPI?.setColumnPreferences(browserColumns);
        }
        if (desktopDecryptionColumns === null && browserDecryptionColumns.length > 0) {
          await window.desktopAPI?.setDecryptionColumnPreferences(browserDecryptionColumns);
        }
      } catch {
        if (!cancelled) {
          setPreferredColumns(browserColumns);
          setPreferredDecryptionColumns(browserDecryptionColumns);
          setStorageReady(true);
        }
      }
    };

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(ENCRYPTION_STORAGE_KEY, JSON.stringify(preferredColumns));
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
    if (window.desktopAPI?.setColumnPreferences) {
      void window.desktopAPI.setColumnPreferences(preferredColumns).catch(() => {
        // The renderer still keeps the browser fallback if desktop storage fails.
      });
    }
  }, [preferredColumns, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(DECRYPTION_STORAGE_KEY, JSON.stringify(preferredDecryptionColumns));
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
    if (window.desktopAPI?.setDecryptionColumnPreferences) {
      void window.desktopAPI.setDecryptionColumnPreferences(preferredDecryptionColumns).catch(() => {
        // The renderer still keeps the browser fallback if desktop storage fails.
      });
    }
  }, [preferredDecryptionColumns, storageReady]);

  return (
    <ColumnPreferencesContext.Provider value={{
      preferredColumns,
      preferredDecryptionColumns,
      setPreferredColumns,
      setPreferredDecryptionColumns,
    }}>
      {children}
    </ColumnPreferencesContext.Provider>
  );
}

export function useColumnPreferences() {
  return useContext(ColumnPreferencesContext);
}
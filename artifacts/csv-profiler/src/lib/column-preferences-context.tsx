import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "airavata-dea-preferred-columns";

interface ColumnPreferences {
  preferredColumns: string[];
  setPreferredColumns: (columns: string[]) => void;
}

const ColumnPreferencesContext = createContext<ColumnPreferences>({
  preferredColumns: [],
  setPreferredColumns: () => {},
});

function readStoredColumns(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
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
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadPreferences = async () => {
      const browserColumns = readStoredColumns();
      const desktopStorage = window.desktopAPI?.getColumnPreferences;

      if (!desktopStorage) {
        if (!cancelled) {
          setPreferredColumns(browserColumns);
          setStorageReady(true);
        }
        return;
      }

      try {
        const desktopColumns = await desktopStorage();
        if (cancelled) return;
        setPreferredColumns(desktopColumns ?? browserColumns);
        setStorageReady(true);

        // Migrate preferences saved by an earlier renderer-only version.
        if (desktopColumns === null && browserColumns.length > 0) {
          await window.desktopAPI?.setColumnPreferences(browserColumns);
        }
      } catch {
        if (!cancelled) {
          setPreferredColumns(browserColumns);
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferredColumns));
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
    if (window.desktopAPI?.setColumnPreferences) {
      void window.desktopAPI.setColumnPreferences(preferredColumns).catch(() => {
        // The renderer still keeps the browser fallback if desktop storage fails.
      });
    }
  }, [preferredColumns, storageReady]);

  return (
    <ColumnPreferencesContext.Provider value={{ preferredColumns, setPreferredColumns }}>
      {children}
    </ColumnPreferencesContext.Provider>
  );
}

export function useColumnPreferences() {
  return useContext(ColumnPreferencesContext);
}
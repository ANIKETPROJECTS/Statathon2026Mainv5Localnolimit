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
  const [preferredColumns, setPreferredColumns] = useState<string[]>(readStoredColumns);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferredColumns));
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
  }, [preferredColumns]);

  return (
    <ColumnPreferencesContext.Provider value={{ preferredColumns, setPreferredColumns }}>
      {children}
    </ColumnPreferencesContext.Provider>
  );
}

export function useColumnPreferences() {
  return useContext(ColumnPreferencesContext);
}
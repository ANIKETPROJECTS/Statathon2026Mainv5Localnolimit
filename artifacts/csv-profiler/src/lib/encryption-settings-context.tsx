import { createContext, useContext, useState } from "react";

interface EncryptionSettings {
  alphanumeric: boolean;
  setAlphanumeric: (v: boolean) => void;
}

const EncryptionSettingsContext = createContext<EncryptionSettings>({
  alphanumeric: false,
  setAlphanumeric: () => {},
});

export function EncryptionSettingsProvider({ children }: { children: React.ReactNode }) {
  const [alphanumeric, setAlphanumeric] = useState(false);
  return (
    <EncryptionSettingsContext.Provider value={{ alphanumeric, setAlphanumeric }}>
      {children}
    </EncryptionSettingsContext.Provider>
  );
}

export function useEncryptionSettings() {
  return useContext(EncryptionSettingsContext);
}

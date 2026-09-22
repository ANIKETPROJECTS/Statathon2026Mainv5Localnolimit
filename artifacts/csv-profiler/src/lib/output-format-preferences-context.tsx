import { createContext, useContext, useEffect, useState } from "react";

export type OutputFormat = "csv" | "txt";

const ENCRYPTION_FORMAT_KEY = "airavata-dea-encryption-output-format";
const DECRYPTION_FORMAT_KEY = "airavata-dea-decryption-output-format";

interface OutputFormatPreferences {
  encryptionFormat: OutputFormat;
  decryptionFormat: OutputFormat;
  setEncryptionFormat: (format: OutputFormat) => void;
  setDecryptionFormat: (format: OutputFormat) => void;
}

const OutputFormatPreferencesContext = createContext<OutputFormatPreferences>({
  encryptionFormat: "csv",
  decryptionFormat: "csv",
  setEncryptionFormat: () => {},
  setDecryptionFormat: () => {},
});

function readFormat(key: string): OutputFormat {
  try {
    return window.localStorage.getItem(key) === "txt" ? "txt" : "csv";
  } catch {
    return "csv";
  }
}

function writeFormat(key: string, format: OutputFormat) {
  try {
    window.localStorage.setItem(key, format);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

export function OutputFormatPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [encryptionFormat, setEncryptionFormatState] = useState<OutputFormat>(() => readFormat(ENCRYPTION_FORMAT_KEY));
  const [decryptionFormat, setDecryptionFormatState] = useState<OutputFormat>(() => readFormat(DECRYPTION_FORMAT_KEY));

  useEffect(() => {
    writeFormat(ENCRYPTION_FORMAT_KEY, encryptionFormat);
  }, [encryptionFormat]);

  useEffect(() => {
    writeFormat(DECRYPTION_FORMAT_KEY, decryptionFormat);
  }, [decryptionFormat]);

  return (
    <OutputFormatPreferencesContext.Provider value={{
      encryptionFormat,
      decryptionFormat,
      setEncryptionFormat: setEncryptionFormatState,
      setDecryptionFormat: setDecryptionFormatState,
    }}>
      {children}
    </OutputFormatPreferencesContext.Provider>
  );
}

export function useOutputFormatPreferences() {
  return useContext(OutputFormatPreferencesContext);
}
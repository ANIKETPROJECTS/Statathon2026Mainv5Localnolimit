import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Info, Settings, X, FolderOpen } from "lucide-react";
import NotFound from "@/pages/not-found";
import FWFConverter from "@/pages/FWFConverter";
import InfoPage from "@/pages/Info";
import RiskAssessmentSingle from "@/pages/RiskAssessmentSingle";
import RiskAssessmentComparison from "@/pages/RiskAssessmentComparison";
import { EncryptionSettingsProvider, useEncryptionSettings } from "@/lib/encryption-settings-context";
import { ColumnPreferencesProvider, useColumnPreferences } from "@/lib/column-preferences-context";
import { OutputFolderPreferencesProvider, getFolderLabel, useOutputFolderPreferences, type FolderTarget } from "@/lib/output-folder-preferences-context";
import { OutputFormatPreferencesProvider, useOutputFormatPreferences, type OutputFormat } from "@/lib/output-format-preferences-context";
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

function usePackagedHashLocation(): [string, (to: string) => void] {
  const readLocation = () => {
    const hash = window.location.hash.replace(/^#/, "");
    return hash && hash.startsWith("/") ? hash : "/";
  };
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const onHashChange = () => setLocation(readLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith("/") ? to : `/${to}`;
  }, []);
  return [location, navigate];
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AIRAVATA renderer error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-lg font-semibold">The application could not render this section.</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm">{this.state.error.message}</p>
          <p className="mt-4 text-xs text-red-700">
            Restart the application after rebuilding it. This message replaces the blank screen with the actual renderer error.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout() {
  const [, navigate] = useLocation();
  const { alphanumeric, setAlphanumeric } = useEncryptionSettings();
  const {
    preferredColumns,
    preferredDecryptionColumns,
    setPreferredColumns,
    setPreferredDecryptionColumns,
  } = useColumnPreferences();
  const {
    encryptionFolder,
    decryptionFolder,
    setEncryptionFolder,
    setDecryptionFolder,
  } = useOutputFolderPreferences();
  const {
    encryptionFormat,
    decryptionFormat,
    setEncryptionFormat,
    setDecryptionFormat,
  } = useOutputFormatPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");
  const [decryptionColumnDraft, setDecryptionColumnDraft] = useState("");
  const [encryptionFolderDraft, setEncryptionFolderDraft] = useState("");
  const [decryptionFolderDraft, setDecryptionFolderDraft] = useState("");
  const [encryptionFolderSelection, setEncryptionFolderSelection] = useState<FolderTarget>(null);
  const [decryptionFolderSelection, setDecryptionFolderSelection] = useState<FolderTarget>(null);
  const [encryptionFormatDraft, setEncryptionFormatDraft] = useState<OutputFormat>("csv");
  const [decryptionFormatDraft, setDecryptionFormatDraft] = useState<OutputFormat>("csv");

  const openSettings = () => {
    setColumnDraft(preferredColumns.join("\n"));
    setDecryptionColumnDraft(preferredDecryptionColumns.join("\n"));
    setEncryptionFolderDraft(getFolderLabel(encryptionFolder));
    setDecryptionFolderDraft(getFolderLabel(decryptionFolder));
    setEncryptionFolderSelection(encryptionFolder);
    setDecryptionFolderSelection(decryptionFolder);
    setEncryptionFormatDraft(encryptionFormat);
    setDecryptionFormatDraft(decryptionFormat);
    setSettingsOpen(true);
  };

  const parseColumnDraft = (draft: string) => [...new Set(
    draft
        .split(/[\n,]+/)
        .map(column => column.trim())
        .filter(Boolean),
  )];

  const saveSettings = () => {
    const columns = parseColumnDraft(columnDraft);
    const decryptionColumns = parseColumnDraft(decryptionColumnDraft);
    setPreferredColumns(columns);
    setPreferredDecryptionColumns(decryptionColumns);
    setEncryptionFolder(encryptionFolderSelection);
    setDecryptionFolder(decryptionFolderSelection);
    setEncryptionFormat(encryptionFormatDraft);
    setDecryptionFormat(decryptionFormatDraft);
    setSettingsOpen(false);
  };

  const chooseDefaultFolder = async (kind: "encryption" | "decryption") => {
    if (window.desktopAPI) {
      const selectedPath = await window.desktopAPI.chooseOutputFolder();
      if (selectedPath) {
        if (kind === "encryption") {
          setEncryptionFolderDraft(selectedPath);
          setEncryptionFolderSelection(selectedPath);
        } else {
          setDecryptionFolderDraft(selectedPath);
          setDecryptionFolderSelection(selectedPath);
        }
      }
      return;
    }

    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<{
        name?: string;
        requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
        getFileHandle(name: string, options?: { create?: boolean }): Promise<{
          createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }>;
        }>;
      }>;
    }).showDirectoryPicker;
    if (!picker) {
      alert("Selecting a default folder requires Chrome or Edge.");
      return;
    }
    try {
      const handle = await picker();
      const permission = await handle.requestPermission?.({ mode: "readwrite" });
      if (permission === "denied") {
        alert("Write permission is required to use this default folder.");
        return;
      }
      if (kind === "encryption") {
        setEncryptionFolderDraft(handle.name ?? "Selected folder");
        setEncryptionFolderSelection(handle);
      } else {
        setDecryptionFolderDraft(handle.name ?? "Selected folder");
        setDecryptionFolderSelection(handle);
      }
    } catch {
      // The user cancelled the picker.
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={`${import.meta.env.BASE_URL}airavata-logo.png`} alt="Airavata logo" className="w-10 h-10 object-contain" />
            <div className="text-left">
              <span className="text-xl font-semibold text-black tracking-tight">AIRAVATA DEA</span>
              <p className="text-sm text-gray-500 leading-none mt-0.5">Convert, Anonymize &amp; Decrypt</p>
            </div>
          </button>

          <div className="flex-1" />

          {/* Alphanumeric output toggle */}
          <button
            onClick={() => setAlphanumeric(!alphanumeric)}
            title={alphanumeric ? "Alphanumeric output ON — click to turn off" : "Alphanumeric output OFF — click to turn on"}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shadow-sm select-none ${
              alphanumeric
                ? "border-violet-400 bg-violet-100 text-violet-800 hover:bg-violet-200"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span className={`w-8 h-4 rounded-full flex items-center transition-colors flex-shrink-0 ${alphanumeric ? "bg-violet-500" : "bg-slate-300"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${alphanumeric ? "translate-x-4" : "translate-x-0"}`} />
            </span>
            <span>Alphanumeric</span>
          </button>

          <button
            onClick={() => navigate("/info")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
          >
            <Info className="w-4 h-4" />
            Info
          </button>

          <button
            onClick={openSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-8">
        <Switch>
          <Route path="/" component={FWFConverter} />
          <Route path="/fwf" component={FWFConverter} />
          <Route path="/info" component={InfoPage} />
          <Route path="/risk-assessment/original">
            {() => <RiskAssessmentSingle key="original" mode="original" />}
          </Route>
          <Route path="/risk-assessment/anonymized">
            {() => <RiskAssessmentSingle key="anonymized" mode="anonymized" />}
          </Route>
          <Route path="/risk-assessment/comparison">
            {() => <RiskAssessmentComparison />}
          </Route>
          <Route path="/risk-assessment">
            {() => <RiskAssessmentLanding navigate={navigate} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 id="settings-title" className="text-lg font-semibold text-black">Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Choose encryption and decryption columns to select automatically.</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-2 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-colors" aria-label="Close settings">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(100vh-180px)] overflow-y-auto">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label htmlFor="preferred-columns" className="text-sm font-semibold text-gray-800">
                      Preferred encryption column names
                    </label>
                    <textarea
                      id="preferred-columns"
                      value={columnDraft}
                      onChange={event => setColumnDraft(event.target.value)}
                      placeholder={"survey_name\nfsu_serial_no\nstate"}
                      rows={5}
                      className="w-full resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-mono text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      These columns are automatically selected for new fixed-width files.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="preferred-decryption-columns" className="text-sm font-semibold text-gray-800">
                      Preferred decryption column names
                    </label>
                    <textarea
                      id="preferred-decryption-columns"
                      value={decryptionColumnDraft}
                      onChange={event => setDecryptionColumnDraft(event.target.value)}
                      placeholder={"survey_name\nfsu_serial_no\nstate"}
                      rows={5}
                      className="w-full resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-mono text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      These columns are automatically selected in every newly added encrypted CSV.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter one name per line or separate names with commas. Matching ignores capitalization, spaces, hyphens, and underscores.
                  </p>
                </div>

                <div className="self-start rounded-2xl border border-gray-200 bg-gray-50/70 p-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Default output folders</p>
                    <p className="text-xs text-gray-500 mt-1">Optional folders used automatically when no folder is chosen manually.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="default-encryption-folder" className="text-sm font-semibold text-gray-800">
                        Default encryption folder
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="default-encryption-folder"
                          value={encryptionFolderDraft}
                          readOnly
                          placeholder="No default selected"
                          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-black bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => void chooseDefaultFolder("encryption")}
                          className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
                        >
                          <FolderOpen className="w-4 h-4" />Choose
                        </button>
                      </div>
                      {encryptionFolderDraft && (
                        <button type="button" onClick={() => { setEncryptionFolderDraft(""); setEncryptionFolderSelection(null); }}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors">
                          Clear default encryption folder
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="default-decryption-folder" className="text-sm font-semibold text-gray-800">
                        Default decryption folder
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="default-decryption-folder"
                          value={decryptionFolderDraft}
                          readOnly
                          placeholder="No default selected"
                          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-black bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => void chooseDefaultFolder("decryption")}
                          className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
                        >
                          <FolderOpen className="w-4 h-4" />Choose
                        </button>
                      </div>
                      {decryptionFolderDraft && (
                        <button type="button" onClick={() => { setDecryptionFolderDraft(""); setDecryptionFolderSelection(null); }}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors">
                          Clear default decryption folder
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Output file formats</p>
                      <p className="text-xs text-gray-500 mt-1">TXT exports keep the fixed-width positions from the selected layout.</p>
                    </div>
                    <div className="space-y-3">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold text-gray-800">Encrypted file format</span>
                        <select
                          value={encryptionFormatDraft}
                          onChange={event => setEncryptionFormatDraft(event.target.value as OutputFormat)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="csv">CSV — Excel-compatible</option>
                          <option value="txt">TXT — fixed-width</option>
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold text-gray-800">Decrypted file format</span>
                        <select
                          value={decryptionFormatDraft}
                          onChange={event => setDecryptionFormatDraft(event.target.value as OutputFormat)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="csv">CSV — Excel-compatible</option>
                          <option value="txt">TXT — fixed-width</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 rounded-b-2xl">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:text-black hover:border-gray-400 transition-colors">
                Cancel
              </button>
              <button onClick={saveSettings} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskAssessmentLanding({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-black mt-4">Risk Assessment</h1>
        <p className="text-sm text-gray-500">Choose a dataset type to evaluate re-identification risk</p>
      </div>
      <div className="flex gap-6 flex-wrap justify-center">
        <button
          onClick={() => navigate("/risk-assessment/original")}
          className="flex flex-col items-center gap-3 w-56 p-8 border-2 border-blue-200 rounded-2xl bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all text-left group">
          <span className="text-4xl">📄</span>
          <div>
            <p className="font-bold text-blue-800 text-base">Original File</p>
            <p className="text-xs text-blue-600 mt-1">Analyse the unmodified source dataset for re-identification risk</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/risk-assessment/anonymized")}
          className="flex flex-col items-center gap-3 w-56 p-8 border-2 border-purple-200 rounded-2xl bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all text-left group">
          <span className="text-4xl">🔒</span>
          <div>
            <p className="font-bold text-purple-800 text-base">Anonymized File</p>
            <p className="text-xs text-purple-600 mt-1">Validate that the privacy-protected dataset meets your risk threshold</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/risk-assessment/comparison")}
          className="flex flex-col items-center gap-3 w-56 p-8 border-2 border-teal-200 rounded-2xl bg-teal-50 hover:bg-teal-100 hover:border-teal-400 transition-all text-left group">
          <span className="text-4xl">⚖️</span>
          <div>
            <p className="font-bold text-teal-800 text-base">Comparison</p>
            <p className="text-xs text-teal-600 mt-1">Compare original vs anonymized datasets and measure privacy improvement</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function App() {
  const routerBase = import.meta.env.BASE_URL === "./"
    ? ""
    : import.meta.env.BASE_URL.replace(/\/$/, "");
  const isPackagedDesktop = window.location.protocol === "file:";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <EncryptionSettingsProvider>
          <ColumnPreferencesProvider>
            <OutputFolderPreferencesProvider>
              <OutputFormatPreferencesProvider>
                <AppErrorBoundary>
                  <WouterRouter
                    base={routerBase}
                    hook={isPackagedDesktop ? usePackagedHashLocation : undefined}
                  >
                    <AppLayout />
                  </WouterRouter>
                </AppErrorBoundary>
              </OutputFormatPreferencesProvider>
            </OutputFolderPreferencesProvider>
            <Toaster />
          </ColumnPreferencesProvider>
        </EncryptionSettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

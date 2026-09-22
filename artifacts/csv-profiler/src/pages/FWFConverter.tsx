import { useState, useRef, useCallback, useContext, useEffect } from "react";
import { useEncryptionSettings } from "@/lib/encryption-settings-context";
import {
  CheckCircle2, AlertTriangle, X, ArrowRight, Download, Eye,
  Layers, RotateCcw, Key, Lock, Shuffle, LockOpen, Search, Columns2,
  Loader2, FileSpreadsheet, Plus, FileText, ChevronDown, ChevronRight,
} from "lucide-react";
import folderIcon from "@assets/open-folder_1781738999125.png";
import {
  parseLayoutFile, readExcelFileInfo, getSheetRowCount, convertFWFToCSV,
  convertFWFFileToStream, scanFWFFile,
  getExcelTableInfos, type FieldDef, type ParseLayoutResult, type ExcelFileInfo, type ExcelTableInfo,
} from "@/lib/fwf-parser";
import {
  encryptFWFToBlob, encryptFWFFileToStream, decryptCSVToBlob, decryptCSVFileToStream, decryptFixedWidthFileToStream, readCSVHeaders,
  type AnonymizeOptions, type FieldSpec,
} from "@/lib/anonymize";
import { exportAs, EXPORT_FORMATS, type ExportFormat } from "@/lib/format-export";
import { useColumnPreferences } from "@/lib/column-preferences-context";
import { useOutputFolderPreferences } from "@/lib/output-folder-preferences-context";
import { useOutputFormatPreferences, type OutputFormat } from "@/lib/output-format-preferences-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayoutEntry {
  id: string;
  file: File;
  fileName: string;
  excelInfo: ExcelFileInfo | null;
  sheetSelectOpen: boolean;
  selectedSheets: string[];   // multi-select — one layout entry created per sheet on confirm
  rowFrom: string;
  rowTo: string;
  sheetRowCount: number;      // row count of single selected sheet (0 when >1 selected)
  applyingSheet: boolean;
  result: ParseLayoutResult | null;
  error: string;
}

interface DetectedTableOption extends ExcelTableInfo {
  key: string;
  sheetName: string;
}

interface PendingTableSelection {
  id: string;
  file: File;
  fileName: string;
  excelInfo: ExcelFileInfo;
  tables: DetectedTableOption[];
  selectedKeys: string[];
}

type LayoutJob = {
  sheetName: string;
  tableIndex?: number;
};

interface DataFile {
  id: string;
  file: File;
  fileName: string;
  text: string | null;
  rawPreviewLines: string[];
  fileSize: number;
  streaming: boolean;
  lineCount: number;
  layoutId: string;
  preview: string[][];
  showPreview: boolean;
  outputBaseName: string;
  error: string;
  activated: boolean;
  step: "ready" | "anon-done";
  encColsList: string[];
  encRunning: boolean;
  encProgress: number;
  encResultKey: string | null;
  encResultBlob: Blob | null;
  encPreview: string[][];
  encOutputSaved: boolean;
  encOutputName: string;
  encError: string;
  exportingFmts: string[];
  origDownloading: boolean;
  origProgress: number;
}

interface DecryptFile {
  id: string;
  file: File;
  fileName: string;
  isFixedWidth: boolean;
  layoutId: string;
  fixedWidthPreviewText: string | null;
  csvText: string | null;
  headers: string[];
  cols: string[];
  encryptedPreview: string[][];
  decryptedPreview: string[][];
  running: boolean;
  progress: number;
  blob: Blob | null;
  outputSaved: boolean;
  outputName: string;
  error: string;
}

type DirectoryHandle = {
  queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }>;
  }>;
};

declare global {
  interface Window {
    desktopAPI?: {
      chooseOutputFolder: () => Promise<string | null>;
      createOutputFile: (folder: string, name: string) => Promise<string>;
      writeOutputChunk: (id: string, chunk: Uint8Array) => Promise<void>;
      closeOutputFile: (id: string) => Promise<void>;
      getColumnPreferences: () => Promise<string[] | null>;
      setColumnPreferences: (columns: string[]) => Promise<void>;
      getDecryptionColumnPreferences: () => Promise<string[] | null>;
      setDecryptionColumnPreferences: (columns: string[]) => Promise<void>;
      getDefaultOutputFolders: () => Promise<{ encryption: string | null; decryption: string | null } | null>;
      setDefaultOutputFolders: (folders: { encryption?: string | null; decryption?: string | null }) => Promise<void>;
    };
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }>;
    }>;
  }
}

type AnonMode = "encrypt" | "decrypt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

const STREAMING_FILE_THRESHOLD = 100 * 1024 * 1024;

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/** Read AIRAVATA CSV exports without treating format metadata as data rows. */
function parseExportCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headerIndex = lines.findIndex(line => !line.trimStart().startsWith("#"));
  if (headerIndex < 0) return { headers: [], rows: [] };
  return {
    headers: parseCSVLine(lines[headerIndex]),
    rows: lines.slice(headerIndex + 1)
      .filter(line => !line.trimStart().startsWith("#"))
      .map(parseCSVLine),
  };
}

function fixedWidthLineFromCells(cells: string[], fields: FieldSpec[]): string {
  const width = fields.reduce((max, field) => Math.max(max, field.end), 0);
  const output = Array.from({ length: width }, () => " ");
  fields.forEach((field, index) => {
    const fieldWidth = field.end - field.start + 1;
    const value = (cells[index] ?? "").replace(/\r?\n/g, " ").slice(0, fieldWidth);
    for (let offset = 0; offset < fieldWidth; offset++) {
      output[field.start - 1 + offset] = value[offset] ?? " ";
    }
  });
  return output.join("");
}

function fixedWidthTextFromCSV(text: string, fields: FieldSpec[]): string {
  const parsed = parseExportCSV(text);
  return parsed.rows.map(row => `${fixedWidthLineFromCells(row, fields)}\n`).join("");
}

function fixedWidthRowsFromText(text: string, fields: FieldSpec[]): string[][] {
  return text.split(/\r?\n/)
    .filter(line => line.length > 0)
    .map(line => fields.map(field => line.padEnd(field.end).substring(field.start - 1, field.end).trim()));
}

function fixedWidthStreamFromCSV(
  csvStream: ReadableStream<Uint8Array>,
  fields: FieldSpec[],
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let headerSkipped = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        const reader = csvStream.getReader();
        const emitLines = (text: string, flush = false) => {
          buffer += text;
          const lines = buffer.split(/\n/);
          buffer = flush ? "" : (lines.pop() ?? "");
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, "");
            if (!line) continue;
            if (!headerSkipped) {
              headerSkipped = true;
              continue;
            }
            controller.enqueue(encoder.encode(`${fixedWidthLineFromCells(parseCSVLine(line), fields)}\n`));
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            emitLines(decoder.decode(value, { stream: true }));
          }
          emitLines(decoder.decode(), true);
          if (buffer) {
            const line = buffer.replace(/\r$/, "");
            if (line && headerSkipped) {
              controller.enqueue(encoder.encode(`${fixedWidthLineFromCells(parseCSVLine(line), fields)}\n`));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      })();
    },
  });
}

function formatOutputName(baseName: string, suffix: string, format: OutputFormat): string {
  return `${baseName}${suffix}.${format}`;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function patchLayout(
  set: React.Dispatch<React.SetStateAction<LayoutEntry[]>>,
  id: string,
  patch: Partial<LayoutEntry>
) {
  set(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
}

function patchFile(
  set: React.Dispatch<React.SetStateAction<DataFile[]>>,
  id: string,
  patch: Partial<DataFile>
) {
  set(prev => prev.map(df => df.id === id ? { ...df, ...patch } : df));
}

function patchDecryptFile(
  set: React.Dispatch<React.SetStateAction<DecryptFile[]>>,
  id: string,
  patch: Partial<DecryptFile>
) {
  set(prev => prev.map(df => df.id === id ? { ...df, ...patch } : df));
}

function blankDataFile(file: File): DataFile {
  return {
    id: uid(), file, fileName: file.name, text: null, rawPreviewLines: [],
    fileSize: file.size, streaming: file.size >= STREAMING_FILE_THRESHOLD, lineCount: 0,
    layoutId: "", preview: [], showPreview: false,
    outputBaseName: file.name.replace(/\.[^.]+$/, ""), error: "",
    activated: false, step: "ready", encColsList: [],
    encRunning: false, encProgress: 0,
    encResultKey: null, encResultBlob: null, encPreview: [], encOutputSaved: false, encOutputName: "", encError: "",
    exportingFmts: [], origDownloading: false, origProgress: 0,
  };
}

function layoutJobsForSheets(info: ExcelFileInfo, sheetNames: string[]): LayoutJob[] {
  const jobs: LayoutJob[] = [];
  for (const sheetName of sheetNames) {
    const tables = getExcelTableInfos(info.buf, sheetName);
    if (tables.length > 0) {
      for (const table of tables) jobs.push({ sheetName, tableIndex: table.index });
    } else {
      jobs.push({ sheetName });
    }
  }
  return jobs;
}

function tableOptionKey(sheetName: string, tableIndex: number): string {
  return `${sheetName}\u0000${tableIndex}`;
}

function detectedTablesForWorkbook(info: ExcelFileInfo): DetectedTableOption[] {
  return info.sheetNames.flatMap(sheetName =>
    getExcelTableInfos(info.buf, sheetName).map(table => ({
      ...table,
      key: tableOptionKey(sheetName, table.index),
      sheetName,
    }))
  );
}

function newLayoutEntry(file: File, overrides: Partial<LayoutEntry> = {}): LayoutEntry {
  return {
    id: uid(), file, fileName: file.name,
    excelInfo: null, sheetSelectOpen: false,
    selectedSheets: [], rowFrom: "", rowTo: "",
    sheetRowCount: 0, applyingSheet: false, result: null, error: "",
    ...overrides,
  };
}

function normalizeMatchStem(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeColumnPreference(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function preferredColumnsForLayout(layout: LayoutEntry | undefined, preferredColumns: string[]): string[] {
  if (!layout?.result || preferredColumns.length === 0) return [];
  const preferred = new Set(preferredColumns.map(normalizeColumnPreference).filter(Boolean));
  return layout.result.fields
    .filter(field => preferred.has(normalizeColumnPreference(field.varName)))
    .map(field => field.varName);
}

function preferredColumnsForHeaders(headers: string[], preferredColumns: string[]): string[] {
  if (headers.length === 0 || preferredColumns.length === 0) return [];
  const preferred = new Set(preferredColumns.map(normalizeColumnPreference).filter(Boolean));
  return headers.filter(header => preferred.has(normalizeColumnPreference(header)));
}

function commonColumnsForDecryptFiles(files: Pick<DecryptFile, "headers">[]): string[] {
  return files.length === 0
    ? []
    : files.slice(1).reduce<string[]>(
      (common, file) => common.filter(column => file.headers.includes(column)),
      [...files[0].headers],
    );
}

function matchTokens(value: string): string[] {
  return value.toLowerCase()
    .match(/[a-z]+|\d+/g)
    ?.map(token => token === "lv" ? "level" : token)
    .filter(token => token.length > 1) ?? [];
}

function extractExplicitLayoutFileNames(value: string): string[] {
  return [...value.matchAll(/file\s*name\s*[:\-]\s*["']?([^"',;|]+)/gi)]
    .map(match => match[1].trim().replace(/[.)]+$/, ""))
    .filter(Boolean);
}

function extractLevelNumber(value: string): string | null {
  const levelMatch = value.match(/(?:level|lv)[\s._-]*(\d{1,3})/i);
  if (levelMatch) return String(Number(levelMatch[1]));
  const suffixMatch = value.match(/(?:^|[_\s-])(\d{1,3})(?:\.[a-z0-9]+)?$/i);
  return suffixMatch ? String(Number(suffixMatch[1])) : null;
}

function scoreLayoutFileMatch(dataFileName: string, layout: LayoutEntry): number {
  const dataStem = normalizeMatchStem(dataFileName);
  const dataLevel = extractLevelNumber(dataFileName);
  const sourceText = `${layout.fileName} ${layout.result?.sheetName ?? ""}`;
  const explicitNames = extractExplicitLayoutFileNames(sourceText);

  for (const explicitName of explicitNames) {
    const explicitStem = normalizeMatchStem(explicitName);
    if (explicitStem === dataStem) return 100;
    if (explicitStem.length >= 6 && (explicitStem.includes(dataStem) || dataStem.includes(explicitStem))) return 92;
  }

  const layoutStem = normalizeMatchStem(layout.fileName);
  if (layoutStem === dataStem) return 88;
  if (layoutStem.length >= 6 && (layoutStem.includes(dataStem) || dataStem.includes(layoutStem))) return 70;

  const layoutLevel = extractLevelNumber(sourceText);
  if (dataLevel && layoutLevel && dataLevel === layoutLevel) return 78;

  const dataTokenSet = new Set(matchTokens(dataFileName));
  const layoutTokenSet = new Set(matchTokens(sourceText));
  const overlap = [...dataTokenSet].filter(token => layoutTokenSet.has(token));
  if (overlap.length >= 2) return Math.min(74, 40 + overlap.length * 12);
  return overlap.length === 1 && overlap[0] !== "hces" ? 48 : 0;
}

function chooseDecryptLayout(
  fileName: string,
  layouts: LayoutEntry[],
  selectedLayoutIds: string[],
): LayoutEntry | undefined {
  const candidates = layouts.filter(layout =>
    selectedLayoutIds.includes(layout.id) && Boolean(layout.result)
  );
  if (candidates.length <= 1) return candidates[0];
  return [...candidates].sort((left, right) =>
    scoreLayoutFileMatch(fileName, right) - scoreLayoutFileMatch(fileName, left)
  )[0];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FWFConverter() {
  const [layouts, setLayouts] = useState<LayoutEntry[]>([]);
  const [pendingTableSelections, setPendingTableSelections] = useState<PendingTableSelection[]>([]);
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [outputDirectory, setOutputDirectory] = useState<DirectoryHandle | null>(null);
  const [outputDirectoryName, setOutputDirectoryName] = useState("");
  const [commonSelectedColumns, setCommonSelectedColumns] = useState<string[] | null>(null);
  const [collapsedAnonFiles, setCollapsedAnonFiles] = useState<Set<string>>(new Set());
  const [batchEncryptRunning, setBatchEncryptRunning] = useState(false);
  const [autoAssignStatus, setAutoAssignStatus] = useState("");

  // Global key settings (shared across all file encryptions)
  const [anonMode, setAnonMode] = useState<AnonMode>("encrypt");
  const [anonKeyMode, setAnonKeyMode] = useState<"random" | "pbkdf2" | "hex">("random");
  const [anonSeeds, setAnonSeeds] = useState<number[]>([42, 137, 2024, 7]);
  const [anonPassphrase, setAnonPassphrase] = useState("");
  const [anonPbkdf2Iter, setAnonPbkdf2Iter] = useState(100_000);
  const [anonDeterministic, setAnonDeterministic] = useState(true);
  const [anonStrongDiffusion, setAnonStrongDiffusion] = useState(true);
  const { alphanumeric: anonAlphanumeric, setAlphanumeric: setAnonAlphanumeric } = useEncryptionSettings();
  const [anonKeyHexInput, setAnonKeyHexInput] = useState("");
  const { preferredColumns, preferredDecryptionColumns } = useColumnPreferences();
  const { encryptionFolder: defaultEncryptionFolder, decryptionFolder: defaultDecryptionFolder } = useOutputFolderPreferences();
  const { encryptionFormat, decryptionFormat } = useOutputFormatPreferences();

  // Global decrypt panel
  const [decryptFiles, setDecryptFiles] = useState<DecryptFile[]>([]);
  const [decryptOutputDirectory, setDecryptOutputDirectory] = useState<DirectoryHandle | null>(null);
  const [decryptOutputDirectoryName, setDecryptOutputDirectoryName] = useState("");
  const [decryptLayoutIds, setDecryptLayoutIds] = useState<string[]>([]);
  const [decryptCommonSelectedColumns, setDecryptCommonSelectedColumns] = useState<string[] | null>(null);
  const [collapsedDecryptFiles, setCollapsedDecryptFiles] = useState<Set<string>>(new Set());
  const [decryptRunning, setDecryptRunning] = useState(false);
  const [decryptError, setDecryptError] = useState("");

  // Compare modal
  const [showCompare, setShowCompare] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<{ headers: string[]; original: string[][]; anonymized: string[][] } | null>(null);
  const [compareTotalRows, setCompareTotalRows] = useState(0);
  const [showDecryptCompare, setShowDecryptCompare] = useState(false);
  const [decryptCompareLoading, setDecryptCompareLoading] = useState(false);
  const [decryptCompareData, setDecryptCompareData] = useState<{ headers: string[]; original: string[][]; anonymized: string[][] } | null>(null);

  const layoutInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const decryptInputRef = useRef<HTMLInputElement>(null);
  const decryptLayoutOptions = layouts.filter(layout => layout.result);
  const needsDecryptLayout = decryptionFormat === "txt" || decryptFiles.some(file => file.isFixedWidth);

  useEffect(() => {
    if (!defaultEncryptionFolder) return;
    if (typeof defaultEncryptionFolder === "string") {
      setOutputDirectory(null);
      setOutputDirectoryName(defaultEncryptionFolder);
    } else {
      setOutputDirectory(defaultEncryptionFolder as DirectoryHandle);
      setOutputDirectoryName(defaultEncryptionFolder.name ?? "Default encryption folder");
    }
  }, [defaultEncryptionFolder]);

  useEffect(() => {
    if (!defaultDecryptionFolder) return;
    if (typeof defaultDecryptionFolder === "string") {
      setDecryptOutputDirectory(null);
      setDecryptOutputDirectoryName(defaultDecryptionFolder);
    } else {
      setDecryptOutputDirectory(defaultDecryptionFolder as DirectoryHandle);
      setDecryptOutputDirectoryName(defaultDecryptionFolder.name ?? "Default decryption folder");
    }
  }, [defaultDecryptionFolder]);

  const buildOpts = (): AnonymizeOptions => ({
    keyMode: anonKeyMode, seeds: anonSeeds,
    passphrase: anonPassphrase, pbkdf2Iterations: anonPbkdf2Iter,
    deterministic: anonDeterministic, keyHex: anonKeyHexInput,
    alphanumericOutput: anonAlphanumeric,
    strongDiffusion: anonStrongDiffusion,
  });

  const chooseOutputDirectory = useCallback(async (): Promise<DirectoryHandle | null> => {
    if (window.desktopAPI) {
      const selectedPath = await window.desktopAPI.chooseOutputFolder();
      if (selectedPath) {
        setOutputDirectoryName(selectedPath);
        setOutputDirectory(null);
      }
      return null;
    }
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<DirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) {
      alert("Selecting an encryption output folder requires Chrome or Edge.");
      return null;
    }
    try {
      const handle = await picker();
      const permission = await handle.requestPermission?.({ mode: "readwrite" });
      if (permission === "denied") {
        alert("Write permission is required to save anonymized files in the selected folder.");
        return null;
      }
      setOutputDirectory(handle);
      setOutputDirectoryName("Selected output folder");
      return handle;
    } catch {
      // The user cancelled the picker.
      return null;
    }
  }, []);

  const chooseDecryptOutputDirectory = useCallback(async (): Promise<DirectoryHandle | null> => {
    if (window.desktopAPI) {
      const selectedPath = await window.desktopAPI.chooseOutputFolder();
      if (selectedPath) {
        setDecryptOutputDirectoryName(selectedPath);
        setDecryptOutputDirectory(null);
      }
      return null;
    }
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<DirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) {
      alert("Folder output requires Chrome or Edge. Downloads will be used instead.");
      return null;
    }
    try {
      const handle = await picker();
      const permission = await handle.requestPermission?.({ mode: "readwrite" });
      if (permission === "denied") {
        alert("Write permission is required to save decrypted files in the selected folder.");
        return null;
      }
      setDecryptOutputDirectory(handle);
      setDecryptOutputDirectoryName("Selected decryption folder");
      return handle;
    } catch {
      // The user cancelled the picker.
      return null;
    }
  }, []);

  const saveOutput = useCallback(async (blob: Blob, name: string) => {
    if (!outputDirectory) {
      triggerDownload(blob, name);
      return;
    }
    const fileHandle = await outputDirectory.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }, [outputDirectory]);

  const saveOutputStream = useCallback(async (
    stream: ReadableStream<Uint8Array>,
    name: string,
    targetOverride?: DirectoryHandle | string | null,
  ) => {
    const desktop = window.desktopAPI;
    const desktopFolder = typeof targetOverride === "string" ? targetOverride : outputDirectoryName;
    if (desktop && desktopFolder) {
      const id = await desktop.createOutputFile(desktopFolder, name);
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await desktop.writeOutputChunk(id, value);
        }
        await desktop.closeOutputFile(id);
      } catch (error) {
        throw error;
      } finally {
        reader.releaseLock();
      }
      return;
    }

    let writable: { write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> } | null = null;
    const browserDirectory = targetOverride && typeof targetOverride !== "string"
      ? targetOverride
      : outputDirectory;
    if (browserDirectory) {
      const fileHandle = await browserDirectory.getFileHandle(name, { create: true });
      writable = await fileHandle.createWritable();
    } else if (window.showSaveFilePicker) {
      const isTxt = /\.txt$/i.test(name);
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{
          description: isTxt ? "Fixed-width TXT file" : "CSV file",
          accept: { [isTxt ? "text/plain" : "text/csv"]: [isTxt ? ".txt" : ".csv"] },
        }],
      });
      writable = await fileHandle.createWritable();
    }

    if (writable) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
        }
        await writable.close();
      } finally {
        reader.releaseLock();
      }
      return;
    }

    // Older browsers cannot stream to a download target. Keep this fallback
    // for small files; large-file mode asks the user to choose an output folder.
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    triggerDownload(new Blob(
      chunks.map(chunk => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer),
      { type: /\.txt$/i.test(name) ? "text/plain;charset=utf-8;" : "text/csv;charset=utf-8;" },
    ), name);
  }, [outputDirectory, outputDirectoryName]);

  // ── Layout handlers ──────────────────────────────────────────────────────

  const handleLayoutFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const isCSV = /\.(csv|tsv)$/i.test(file.name);

      if (isCSV) {
        const entry = newLayoutEntry(file);
        setLayouts(prev => [...prev, entry]);
        try {
          const result = await parseLayoutFile(file);
          patchLayout(setLayouts, entry.id, result.fields.length ? { result } : { error: result.warnings.join(" ") || "No fields found." });
        } catch (e) { patchLayout(setLayouts, entry.id, { error: `Parse error: ${(e as Error).message}` }); }
      } else {
        try {
          const info = await readExcelFileInfo(file);
          const detectedTables = detectedTablesForWorkbook(info);

          if (detectedTables.length === 0) {
            // Keep the manual sheet/range flow for conventional layouts that
            // do not contain recognizable table blocks.
            const entry = newLayoutEntry(file);
            setLayouts(prev => [...prev, entry]);
            patchLayout(setLayouts, entry.id, {
              excelInfo: info,
              sheetSelectOpen: true,
              selectedSheets: [...info.sheetNames],
              sheetRowCount: info.sheetNames.length === 1
                ? getSheetRowCount(info.buf, info.sheetNames[0])
                : 0,
            });
            continue;
          }

          // Wait for the user to choose which detected tables should become
          // layout cards instead of parsing every table immediately.
          const pendingId = uid();
          setPendingTableSelections(prev => [...prev, {
            id: pendingId,
            file,
            fileName: file.name,
            excelInfo: info,
            tables: detectedTables,
            selectedKeys: detectedTables.map(table => table.key),
          }]);
        } catch (e) {
          const entry = newLayoutEntry(file, { error: `Read error: ${(e as Error).message}` });
          setLayouts(prev => [...prev, entry]);
        }
      }
    }
  }, []);

  const confirmDetectedTables = useCallback(async (pendingId: string) => {
    const pending = pendingTableSelections.find(selection => selection.id === pendingId);
    if (!pending || pending.selectedKeys.length === 0) return;

    const selectedTables = pending.tables.filter(table => pending.selectedKeys.includes(table.key));
    setPendingTableSelections(prev => prev.filter(selection => selection.id !== pendingId));

    for (const table of selectedTables) {
      const entry = newLayoutEntry(pending.file, {
        excelInfo: pending.excelInfo,
        selectedSheets: [table.sheetName],
        sheetRowCount: getSheetRowCount(pending.excelInfo.buf, table.sheetName),
        applyingSheet: true,
      });
      setLayouts(prev => [...prev, entry]);
      try {
        const result = await parseLayoutFile(pending.file, {
          sheetName: table.sheetName,
          tableIndex: table.index,
        });
        patchLayout(setLayouts, entry.id, result.fields.length
          ? { result, applyingSheet: false }
          : { error: result.warnings.join(" ") || "No fields found.", applyingSheet: false });
      } catch (e) {
        patchLayout(setLayouts, entry.id, {
          error: `Parse error: ${(e as Error).message}`,
          applyingSheet: false,
        });
      }
    }
  }, [pendingTableSelections]);

  const togglePendingTable = useCallback((pendingId: string, tableKey: string) => {
    setPendingTableSelections(prev => prev.map(selection => {
      if (selection.id !== pendingId) return selection;
      const selectedKeys = selection.selectedKeys.includes(tableKey)
        ? selection.selectedKeys.filter(key => key !== tableKey)
        : [...selection.selectedKeys, tableKey];
      return { ...selection, selectedKeys };
    }));
  }, []);

  const selectAllPendingTables = useCallback((pendingId: string, selected: boolean) => {
    setPendingTableSelections(prev => prev.map(selection =>
      selection.id === pendingId
        ? { ...selection, selectedKeys: selected ? selection.tables.map(table => table.key) : [] }
        : selection
    ));
  }, []);

  const removePendingTableSelection = useCallback((pendingId: string) => {
    setPendingTableSelections(prev => prev.filter(selection => selection.id !== pendingId));
  }, []);

  const confirmSheet = useCallback(async (id: string) => {
    const lo = layouts.find(l => l.id === id);
    if (!lo || lo.selectedSheets.length === 0) return;
    patchLayout(setLayouts, id, { applyingSheet: true, error: "" });

    const rowOpts = {
      startRow: lo.rowFrom ? parseInt(lo.rowFrom, 10) : undefined,
      endRow:   lo.rowTo   ? parseInt(lo.rowTo,   10) : undefined,
    };
    const hasRowRange = Boolean(lo.rowFrom || lo.rowTo);
    const jobs = lo.excelInfo
      ? hasRowRange
        ? lo.selectedSheets.map(sheetName => ({ sheetName }))
        : layoutJobsForSheets(lo.excelInfo, lo.selectedSheets)
      : [];
    if (jobs.length === 0) return;

    const parseJob = (job: { sheetName: string; tableIndex?: number }) =>
      parseLayoutFile(lo.file, {
        sheetName: job.sheetName,
        ...rowOpts,
        ...(job.tableIndex !== undefined ? { tableIndex: job.tableIndex } : {}),
      });

    // Parse the first table into the current entry.
    const [firstJob, ...extraJobs] = jobs;
    try {
      const result = await parseJob(firstJob);
      patchLayout(setLayouts, id, result.fields.length
        ? { result, sheetSelectOpen: false, applyingSheet: false }
        : { error: result.warnings.join(" ") || "No fields found.", applyingSheet: false });
    } catch (e) {
      patchLayout(setLayouts, id, { error: `Parse error: ${(e as Error).message}`, applyingSheet: false });
      return; // Don't create extra entries if the first fails
    }

    // Parse each additional table as a new layout entry. This lets each
    // fixed-width data file use the layout for its own questionnaire level.
    for (const job of extraJobs) {
      const newEntry: LayoutEntry = {
        id: uid(), file: lo.file, fileName: lo.fileName,
        excelInfo: lo.excelInfo, sheetSelectOpen: false,
        selectedSheets: [job.sheetName], rowFrom: lo.rowFrom, rowTo: lo.rowTo,
        sheetRowCount: lo.excelInfo ? getSheetRowCount(lo.excelInfo.buf, job.sheetName) : 0,
        applyingSheet: true, result: null, error: "",
      };
      setLayouts(prev => [...prev, newEntry]);
      try {
        const r = await parseJob(job);
        patchLayout(setLayouts, newEntry.id, r.fields.length
          ? { result: r, applyingSheet: false }
          : { error: r.warnings.join(" ") || "No fields found.", applyingSheet: false });
      } catch (e) {
        patchLayout(setLayouts, newEntry.id, { error: `Parse error: ${(e as Error).message}`, applyingSheet: false });
      }
    }
  }, [layouts]);

  const autoDetectSheet = useCallback(async (id: string) => {
    const lo = layouts.find(l => l.id === id);
    if (!lo) return;
    patchLayout(setLayouts, id, { applyingSheet: true, error: "" });
    if (!lo.excelInfo) {
      try {
        const result = await parseLayoutFile(lo.file);
        patchLayout(setLayouts, id, result.fields.length
          ? { result, sheetSelectOpen: false, applyingSheet: false }
          : { error: result.warnings.join(" ") || "No fields found.", applyingSheet: false });
      } catch (e) {
        patchLayout(setLayouts, id, { error: `Parse error: ${(e as Error).message}`, applyingSheet: false });
      }
      return;
    }
    const jobs = layoutJobsForSheets(lo.excelInfo, lo.excelInfo.sheetNames);
    const [firstJob, ...extraJobs] = jobs;
    try {
      const result = await parseLayoutFile(lo.file, {
        sheetName: firstJob.sheetName,
        tableIndex: firstJob.tableIndex,
      });
      patchLayout(setLayouts, id, result.fields.length
        ? { result, sheetSelectOpen: false, applyingSheet: false }
        : { error: result.warnings.join(" ") || "No fields found.", applyingSheet: false });
      for (const job of extraJobs) {
        const newEntry: LayoutEntry = {
          id: uid(), file: lo.file, fileName: lo.fileName,
          excelInfo: lo.excelInfo, sheetSelectOpen: false,
          selectedSheets: [job.sheetName],
          rowFrom: "", rowTo: "",
          sheetRowCount: getSheetRowCount(lo.excelInfo.buf, job.sheetName),
          applyingSheet: true, result: null, error: "",
        };
        setLayouts(prev => [...prev, newEntry]);
        try {
          const r = await parseLayoutFile(lo.file, {
            sheetName: job.sheetName,
            tableIndex: job.tableIndex,
          });
          patchLayout(setLayouts, newEntry.id, r.fields.length
            ? { result: r, applyingSheet: false }
            : { error: r.warnings.join(" ") || "No fields found.", applyingSheet: false });
        } catch (e) {
          patchLayout(setLayouts, newEntry.id, { error: `Parse error: ${(e as Error).message}`, applyingSheet: false });
        }
      }
    } catch (e) {
      patchLayout(setLayouts, id, { error: `Parse error: ${(e as Error).message}`, applyingSheet: false });
    }
  }, [layouts]);

  // "Add Range" — clone same Excel file as a new entry with sheet picker open
  const addRange = useCallback((fromId: string) => {
    const src = layouts.find(l => l.id === fromId);
    if (!src?.excelInfo) return;
    const entry: LayoutEntry = {
      id: uid(), file: src.file, fileName: src.fileName,
      excelInfo: src.excelInfo, sheetSelectOpen: true,
      selectedSheets: [...src.excelInfo.sheetNames], rowFrom: "", rowTo: "",
      sheetRowCount: src.excelInfo.sheetNames.length === 1
        ? getSheetRowCount(src.excelInfo.buf, src.excelInfo.sheetNames[0])
        : 0,
      applyingSheet: false, result: null, error: "",
    };
    setLayouts(prev => [...prev, entry]);
  }, [layouts]);

  const removeLayout = useCallback((id: string) => {
    setLayouts(prev => prev.filter(l => l.id !== id));
    setDataFiles(prev => prev.map(df => df.layoutId === id ? { ...df, layoutId: "", preview: [], activated: false } : df));
  }, []);

  // ── Data file handlers ───────────────────────────────────────────────────

  const handleDataFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const df = blankDataFile(file);
      setDataFiles(prev => [...prev, df]);
      try {
        if (df.streaming) {
          const scan = await scanFWFFile(file);
          patchFile(setDataFiles, df.id, {
            lineCount: scan.lineCount,
            rawPreviewLines: scan.previewLines,
          });
        } else {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(l => l.length > 0);
          // If the first line has commas it is a CSV header row — don't count it as a data record
          const hasCsvHeader = lines.length > 0 && lines[0].includes(",");
          patchFile(setDataFiles, df.id, {
            text,
            rawPreviewLines: hasCsvHeader ? lines.slice(1, 11) : lines.slice(0, 10),
            lineCount: hasCsvHeader ? lines.length - 1 : lines.length,
          });
        }
      } catch (e) { patchFile(setDataFiles, df.id, { error: `Read error: ${(e as Error).message}` }); }
    }
  }, []);

  const assignLayout = useCallback(async (dfId: string, layoutId: string) => {
    const df = dataFiles.find(d => d.id === dfId);
    const lo = layouts.find(l => l.id === layoutId);
    if (!df) return;

    let preview: string[][] = [];
    if (lo?.result) {
      const lines = df.text
        ? df.text.split(/\r?\n/).filter(l => l.length > 0)
        : df.rawPreviewLines;
      preview = lines.slice(0, 10).map(line =>
        lo.result!.fields.map(f => line.padEnd(f.end).substring(f.start - 1, f.end).trim())
      );
    }
    patchFile(setDataFiles, dfId, {
      layoutId, preview, activated: false, step: "ready",
      encColsList: preferredColumnsForLayout(lo, preferredColumns),
      encResultBlob: null, encResultKey: null, encPreview: [], encOutputSaved: false, encOutputName: "", encError: "",
    });
  }, [dataFiles, layouts, preferredColumns]);

  const autoAssignLayouts = useCallback(async () => {
    const candidates = dataFiles.filter(df => !df.layoutId && df.lineCount > 0);
    if (candidates.length === 0) {
      setAutoAssignStatus(dataFiles.length === 0
        ? "Add TXT files before using auto-assign."
        : "No unassigned TXT files found. Existing assignments were kept.");
      return;
    }
    if (readyLayouts.length === 0) {
      setAutoAssignStatus("Load at least one complete layout before using auto-assign.");
      return;
    }

    const assignments: Array<{ dfId: string; layoutId: string }> = [];
    const unmatched: string[] = [];
    const ambiguous: string[] = [];

    for (const df of candidates) {
      const ranked = readyLayouts
        .map(layout => ({ layout, score: scoreLayoutFileMatch(df.fileName, layout) }))
        .filter(candidate => candidate.score > 0)
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];
      const isAmbiguous = Boolean(
        best && second && best.score === second.score && second.score >= 70,
      );

      if (!best || best.score < 70) {
        unmatched.push(df.fileName);
      } else if (isAmbiguous) {
        ambiguous.push(df.fileName);
      } else {
        assignments.push({ dfId: df.id, layoutId: best.layout.id });
      }
    }

    await Promise.all(assignments.map(({ dfId, layoutId }) => assignLayout(dfId, layoutId)));

    const details: string[] = [];
    if (assignments.length > 0) {
      details.push(`assigned ${assignments.length} of ${candidates.length}`);
    } else {
      details.push(`assigned 0 of ${candidates.length}`);
    }
    if (unmatched.length > 0) details.push(`manual match needed: ${unmatched.join(", ")}`);
    if (ambiguous.length > 0) details.push(`ambiguous: ${ambiguous.join(", ")}`);
    setAutoAssignStatus(details.join(" · "));
  }, [assignLayout, dataFiles, layouts]);

  const removeDataFile = useCallback((id: string) => {
    setDataFiles(prev => prev.filter(df => df.id !== id));
  }, []);

  const activateDataFile = useCallback((id: string) => {
    setDataFiles(prev => prev.map(df => {
      if (df.id !== id) return df;
      const lo = layouts.find(layout => layout.id === df.layoutId);
      return {
        ...df,
        activated: true,
        encColsList: preferredColumnsForLayout(lo, preferredColumns),
      };
    }));
  }, [layouts, preferredColumns]);

  const activateAllDataFiles = useCallback(() => {
    setDataFiles(prev => prev.map(df => {
      if (df.activated || !df.layoutId || df.lineCount <= 0) return df;
      const lo = layouts.find(layout => layout.id === df.layoutId);
      return {
        ...df,
        activated: true,
        encColsList: preferredColumnsForLayout(lo, preferredColumns),
      };
    }));
  }, [layouts, preferredColumns]);

  const handleCommonColumnsChange = useCallback((next: Set<string>) => {
    setCommonSelectedColumns([...next]);
    setDataFiles(prev => {
      const active = prev.filter(df => df.activated);
      if (active.length < 2) return prev;

      const commonColumns = active.slice(1).reduce<string[]>((common, df) => {
        const lo = layouts.find(l => l.id === df.layoutId);
        const fields = new Set(lo?.result?.fields.map(f => f.varName) ?? []);
        return common.filter(column => fields.has(column));
      }, layouts.find(l => l.id === active[0].layoutId)?.result?.fields.map(f => f.varName) ?? []);
      const selectedCommon = new Set([...next].filter(column => commonColumns.includes(column)));

      return prev.map(df => {
        if (!df.activated) return df;
        const columns = new Set(df.encColsList);
        for (const column of commonColumns) {
          if (selectedCommon.has(column)) columns.add(column);
          else columns.delete(column);
        }
        return { ...df, encColsList: [...columns] };
      });
    });
  }, [layouts]);

  const clearAllEncryptionColumns = useCallback(() => {
    setCommonSelectedColumns([]);
    setDataFiles(prev => prev.map(df => df.activated
      ? { ...df, encColsList: [], encError: "" }
      : df
    ));
  }, []);

  // ── Per-file processing ──────────────────────────────────────────────────

  const handleEncrypt = useCallback(async (
    dfId: string,
    streamTargetOverride?: DirectoryHandle | string | null,
  ) => {
    const requestedDf = dataFiles.find(d => d.id === dfId);
    let preparedStreamTarget: DirectoryHandle | string | null =
      streamTargetOverride ?? outputDirectory ?? (outputDirectoryName || null);

    if (requestedDf?.streaming && !preparedStreamTarget) {
      if (window.desktopAPI) {
        const selectedPath = await window.desktopAPI.chooseOutputFolder();
        if (selectedPath) {
          setOutputDirectoryName(selectedPath);
          preparedStreamTarget = selectedPath;
        }
      } else {
        preparedStreamTarget = await chooseOutputDirectory();
      }
      if (!preparedStreamTarget) {
        patchFile(setDataFiles, dfId, {
          encError: "Choose an output folder before processing a large file.",
        });
        return;
      }
    }

    setDataFiles(prev => {
      const df = prev.find(d => d.id === dfId);
      const lo = df ? layouts.find(l => l.id === df.layoutId) : null;
      if (!df || !lo?.result || (!df.text && !df.streaming) || df.encColsList.length === 0) {
        return prev.map(d => d.id === dfId
          ? { ...d, encError: d.encColsList.length === 0 ? "Select at least one column to encrypt." : d.encError }
          : d);
      }
      return prev.map(d => d.id === dfId ? {
        ...d, encRunning: true, encProgress: 0, encError: "",
        encResultBlob: null, encResultKey: null, encPreview: [],
      } : d);
    });

    // Use a small timeout so the state update above renders before the heavy work starts
    await new Promise(r => setTimeout(r, 20));

    const df = dataFiles.find(d => d.id === dfId);
    const lo = df ? layouts.find(l => l.id === df.layoutId) : null;
    if (!df || !lo?.result || (!df.text && !df.streaming)) return;
    if (df.encColsList.length === 0) return;

    try {
      if (df.streaming) {
        const streamTarget = preparedStreamTarget;
        if (!streamTarget) {
          throw new Error("Choose an output folder before processing a large file.");
        }
        const { stream, keyHex, previewRows } = await encryptFWFFileToStream(
          df.file, lo.result.fields, new Set(df.encColsList), buildOpts(),
          pct => patchFile(setDataFiles, dfId, { encProgress: pct })
        );
        const outputName = formatOutputName(df.outputBaseName, "_anonymized", encryptionFormat);
        const outputStream = encryptionFormat === "txt"
          ? fixedWidthStreamFromCSV(stream, lo.result.fields)
          : stream;
        await saveOutputStream(outputStream, outputName, streamTarget);
        patchFile(setDataFiles, dfId, {
          encResultBlob: null, encResultKey: keyHex, encPreview: previewRows, encOutputSaved: true,
          encOutputName: outputName, step: "anon-done", encRunning: false,
        });
      } else {
        const { blob, keyHex } = await encryptFWFToBlob(
          df.text!, lo.result.fields, new Set(df.encColsList), buildOpts(),
          pct => patchFile(setDataFiles, dfId, { encProgress: pct })
        );
        const outputName = formatOutputName(df.outputBaseName, "_anonymized", encryptionFormat);
        const outputSaved = Boolean(preparedStreamTarget);
        const csvText = await blob.text();
        const encryptedPreview = parseExportCSV(csvText).rows.slice(0, 500);
        const outputBlob = encryptionFormat === "txt"
          ? new Blob([fixedWidthTextFromCSV(csvText, lo.result.fields)], { type: "text/plain;charset=utf-8;" })
          : new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        if (outputSaved) {
          await saveOutputStream(outputBlob.stream(), outputName, preparedStreamTarget);
        }
        patchFile(setDataFiles, dfId, {
          encResultBlob: outputSaved ? null : outputBlob, encResultKey: keyHex, encPreview: encryptedPreview, encOutputSaved: outputSaved,
          encOutputName: outputSaved ? outputName : "", step: "anon-done", encRunning: false,
        });
      }
    } catch (e) {
      patchFile(setDataFiles, dfId, { encError: `Encryption failed: ${(e as Error).message}`, encRunning: false });
    }
  }, [dataFiles, layouts, outputDirectory, outputDirectoryName, chooseOutputDirectory, saveOutputStream, encryptionFormat, anonKeyMode, anonSeeds, anonPassphrase, anonPbkdf2Iter, anonDeterministic, anonAlphanumeric, anonKeyHexInput, anonStrongDiffusion]);

  const handleEncryptAll = useCallback(async () => {
    const filesToEncrypt = dataFiles.filter(df => df.activated);
    if (filesToEncrypt.length < 2 || batchEncryptRunning) return;

    const missingColumns = filesToEncrypt.filter(df => df.encColsList.length === 0);
    if (missingColumns.length > 0) {
      setDataFiles(prev => prev.map(df => missingColumns.some(missing => missing.id === df.id)
        ? { ...df, encError: "Select at least one column to encrypt before using Anonymize all files." }
        : df));
      return;
    }

    let streamTarget: DirectoryHandle | string | null =
      outputDirectory ?? (outputDirectoryName || null);
    if (!streamTarget) {
      if (window.desktopAPI) {
        const selectedPath = await window.desktopAPI.chooseOutputFolder();
        if (selectedPath) {
          setOutputDirectoryName(selectedPath);
          streamTarget = selectedPath;
        }
      } else {
        streamTarget = await chooseOutputDirectory();
      }
      if (!streamTarget) {
        setDataFiles(prev => prev.map(df => df.streaming && df.activated
          ? { ...df, encError: "Choose an output folder before processing large files." }
          : df));
        return;
      }
    }

    setBatchEncryptRunning(true);
    try {
      await Promise.all(filesToEncrypt.map(df => handleEncrypt(df.id, streamTarget)));
    } finally {
      setBatchEncryptRunning(false);
    }
  }, [dataFiles, batchEncryptRunning, outputDirectory, outputDirectoryName, chooseOutputDirectory, handleEncrypt]);

  const handleDownloadOriginal = useCallback(async (dfId: string) => {
    const df = dataFiles.find(d => d.id === dfId);
    const lo = df ? layouts.find(l => l.id === df.layoutId) : null;
    if (!df || !lo?.result || (!df.text && !df.streaming)) return;
    let streamTarget: DirectoryHandle | string | null =
      outputDirectory ?? (outputDirectoryName || null);
    if (df.streaming && !streamTarget) {
      if (window.desktopAPI) {
        const selectedPath = await window.desktopAPI.chooseOutputFolder();
        if (selectedPath) {
          setOutputDirectoryName(selectedPath);
          streamTarget = selectedPath;
        }
      } else {
        streamTarget = await chooseOutputDirectory();
      }
      if (!streamTarget) {
        patchFile(setDataFiles, dfId, {
          encError: "Choose an output folder before building a large CSV.",
        });
        return;
      }
    }
    patchFile(setDataFiles, dfId, { origDownloading: true, origProgress: 0 });
    try {
      if (df.streaming) {
        const stream = convertFWFFileToStream(df.file, lo.result.fields, {
          onProgress: pct => patchFile(setDataFiles, dfId, { origProgress: pct }),
          onBytesProgress: (read, total) => patchFile(setDataFiles, dfId, {
            origProgress: total > 0 ? Math.min(99, Math.round((read / total) * 100)) : 0,
          }),
        });
        await saveOutputStream(stream, `${df.outputBaseName}.csv`, streamTarget);
      } else {
        const blob = await convertFWFToCSV(df.text!, lo.result.fields, {
          onProgress: pct => patchFile(setDataFiles, dfId, { origProgress: pct }),
        });
        await saveOutput(blob, `${df.outputBaseName}.csv`);
      }
    } finally { patchFile(setDataFiles, dfId, { origDownloading: false, origProgress: 0 }); }
  }, [dataFiles, layouts, outputDirectory, outputDirectoryName, chooseOutputDirectory, saveOutput, saveOutputStream]);

  const handleExport = async (dfId: string, fmt: ExportFormat, blob: Blob, fields: FieldDef[], baseName: string) => {
    patchFile(setDataFiles, dfId, { exportingFmts: [...(dataFiles.find(d => d.id === dfId)?.exportingFmts ?? []), fmt] });
    await exportAs(fmt, blob, fields, baseName);
    setDataFiles(prev => prev.map(df => df.id === dfId ? { ...df, exportingFmts: df.exportingFmts.filter(f => f !== fmt) } : df));
  };

  const handleOpenCompare = async (dfId: string) => {
    const df = dataFiles.find(d => d.id === dfId);
    const lo = df ? layouts.find(l => l.id === df.layoutId) : null;
    if (!df || !lo?.result || (!df.encResultBlob && df.encPreview.length === 0)) return;
    setCompareLoading(true); setShowCompare(true); setCompareTotalRows(df.lineCount);
    try {
      const MAX = 500;
      const headers = lo.result.fields.map(f => f.varName);
      let fwfLines = df.text
        ? df.text.split(/\r?\n/).filter(l => l.length > 0)
        : df.rawPreviewLines;
      // Skip CSV header row if present (FWF lines are never comma-delimited)
      if (fwfLines.length > 0 && fwfLines[0].includes(",")) fwfLines = fwfLines.slice(1);
      const original = fwfLines.slice(0, MAX).map(line =>
        lo.result!.fields.map(f => line.padEnd(f.end).substring(f.start - 1, f.end).trim())
      );
      const anonymized = df.encResultBlob
        ? encryptionFormat === "txt"
          ? fixedWidthRowsFromText(await df.encResultBlob.text(), lo.result.fields).slice(0, MAX)
          : parseExportCSV(await df.encResultBlob.text()).rows.slice(0, MAX)
        : df.encPreview.slice(0, MAX);
      setCompareData({ headers, original, anonymized });
    } finally { setCompareLoading(false); }
  };

  // ── Decrypt handlers ─────────────────────────────────────────────────────

  const handleDecryptFiles = useCallback(async (files: File[]) => {
    setDecryptError("");
    const filesNeedLayouts = decryptionFormat === "txt" || files.some(file => /\.txt$/i.test(file.name));
    if (filesNeedLayouts && decryptLayoutIds.length === 0) {
      setDecryptError("Select one or more matching layout files before adding files for TXT decryption.");
      return;
    }
    const loaded: Array<DecryptFile | null> = await Promise.all(files.map(async file => {
      const text = file.size >= STREAMING_FILE_THRESHOLD
        ? await file.slice(0, 64 * 1024).text()
        : await file.text();
      const isFixedWidth = /\.txt$/i.test(file.name);
      const layoutEntry = (isFixedWidth || decryptionFormat === "txt")
        ? chooseDecryptLayout(file.name, layouts, decryptLayoutIds)
        : undefined;
      if (isFixedWidth) {
        if (!layoutEntry?.result) return null;
        const fields = layoutEntry.result.fields;
        return {
          id: uid(),
          file,
          fileName: file.name,
          isFixedWidth: true,
          layoutId: layoutEntry.id,
          fixedWidthPreviewText: text,
          csvText: null,
          headers: fields.map(field => field.varName),
          cols: preferredColumnsForHeaders(fields.map(field => field.varName), preferredDecryptionColumns),
          encryptedPreview: fixedWidthRowsFromText(text, fields).slice(0, 500),
          decryptedPreview: [],
          running: false,
          progress: 0,
          blob: null,
          outputSaved: false,
          outputName: "",
          error: "",
        } satisfies DecryptFile;
      }
      const headers = readCSVHeaders(text);
      if (!headers.length) return null;
      const parsed = parseExportCSV(text);
      return {
        id: uid(),
        file,
        fileName: file.name,
        isFixedWidth: false,
        layoutId: layoutEntry?.id ?? "",
        fixedWidthPreviewText: null,
        csvText: file.size < STREAMING_FILE_THRESHOLD ? text : null,
        headers,
        cols: preferredColumnsForHeaders(headers, preferredDecryptionColumns),
        encryptedPreview: parsed.rows.slice(0, 500),
        decryptedPreview: [],
        running: false,
        progress: 0,
        blob: null,
        outputSaved: false,
        outputName: "",
        error: "",
      } satisfies DecryptFile;
    }));

    const validFiles = loaded.filter((entry): entry is DecryptFile => entry !== null);
    if (validFiles.length !== files.length) {
      setDecryptError("One or more selected files could not be read as CSV or fixed-width TXT files.");
    }
    if (validFiles.length === 0) return;

    const next = [...decryptFiles, ...validFiles];
    const common = commonColumnsForDecryptFiles(next);
    const selectedCommon = decryptCommonSelectedColumns === null
      ? common.filter(column => next.every(file => file.cols.includes(column)))
      : decryptCommonSelectedColumns.filter(column => common.includes(column));
    setDecryptCommonSelectedColumns(selectedCommon);
    setDecryptFiles(next);
  }, [decryptFiles, decryptCommonSelectedColumns, decryptLayoutIds, decryptionFormat, layouts, preferredDecryptionColumns]);

  const removeDecryptFile = useCallback((id: string) => {
    const next = decryptFiles.filter(file => file.id !== id);
    const common = commonColumnsForDecryptFiles(next);
    setDecryptCommonSelectedColumns(previous => previous
      ? previous.filter(column => common.includes(column))
      : null);
    setDecryptFiles(next);
  }, [decryptFiles]);

  const handleDecryptFileColumns = useCallback((fileId: string, next: Set<string>) => {
    setDecryptFiles(prev => prev.map(file => file.id === fileId
      ? { ...file, cols: [...next] }
      : file
    ));
  }, []);

  const handleDecryptFileLayout = useCallback((fileId: string, layoutId: string) => {
    const selectedLayout = layouts.find(layout => layout.id === layoutId);
    const nextFiles = decryptFiles.map(file => {
      if (file.id !== fileId) return file;
      if (!selectedLayout?.result) return { ...file, layoutId: "" };
      if (!file.isFixedWidth) return { ...file, layoutId };

      const headers = selectedLayout.result.fields.map(field => field.varName);
      const retainedColumns = file.cols.filter(column => headers.includes(column));
      return {
        ...file,
        layoutId,
        headers,
        cols: retainedColumns.length > 0
          ? retainedColumns
          : preferredColumnsForHeaders(headers, preferredDecryptionColumns),
        encryptedPreview: fixedWidthRowsFromText(
          file.fixedWidthPreviewText ?? "",
          selectedLayout.result.fields,
        ).slice(0, 500),
      };
    });
    setDecryptFiles(nextFiles);
    const common = commonColumnsForDecryptFiles(nextFiles);
    setDecryptCommonSelectedColumns(previous => previous
      ? previous.filter(column => common.includes(column))
      : null);
  }, [decryptFiles, layouts, preferredDecryptionColumns]);

  const handleDecryptLayoutSelectionChange = useCallback((nextIds: string[]) => {
    setDecryptLayoutIds(nextIds);
    const nextFiles = decryptFiles.map(file => {
      if (!file.isFixedWidth && decryptionFormat !== "txt") return file;
      const layoutEntry = chooseDecryptLayout(file.fileName, layouts, nextIds);
      if (!layoutEntry?.result) return { ...file, layoutId: "" };
      if (!file.isFixedWidth) return { ...file, layoutId: layoutEntry.id };

      const headers = layoutEntry.result.fields.map(field => field.varName);
      const retainedColumns = file.cols.filter(column => headers.includes(column));
      return {
        ...file,
        layoutId: layoutEntry.id,
        headers,
        cols: retainedColumns.length > 0
          ? retainedColumns
          : preferredColumnsForHeaders(headers, preferredDecryptionColumns),
        encryptedPreview: fixedWidthRowsFromText(
          file.fixedWidthPreviewText ?? "",
          layoutEntry.result.fields,
        ).slice(0, 500),
      };
    });
    setDecryptFiles(nextFiles);
    const common = commonColumnsForDecryptFiles(nextFiles);
    setDecryptCommonSelectedColumns(previous => previous
      ? previous.filter(column => common.includes(column))
      : null);
  }, [decryptFiles, decryptionFormat, layouts, preferredDecryptionColumns]);

  const handleCommonDecryptColumnsChange = useCallback((next: Set<string>) => {
    const selected = [...next];
    setDecryptCommonSelectedColumns(selected);
    setDecryptFiles(prev => {
      const common = commonColumnsForDecryptFiles(prev);
      const selectedCommon = new Set(selected.filter(column => common.includes(column)));
      return prev.map(file => {
        const columns = new Set(file.cols);
        for (const column of common) {
          if (selectedCommon.has(column)) columns.add(column);
          else columns.delete(column);
        }
        return { ...file, cols: [...columns] };
      });
    });
  }, []);

  const handleDecrypt = useCallback(async () => {
    if (decryptFiles.length === 0) { setDecryptError("Upload at least one encrypted CSV or TXT file first."); return; }
    const filesMissingColumns = decryptFiles.filter(file => file.cols.length === 0);
    if (filesMissingColumns.length > 0) {
      setDecryptFiles(prev => prev.map(file => filesMissingColumns.some(missing => missing.id === file.id)
        ? { ...file, error: "Select at least one column to decrypt in this file." }
        : file
      ));
      setDecryptError("Select at least one column in every file before decrypting.");
      return;
    }
    setDecryptRunning(true);
    setDecryptError("");
    const filesMissingLayouts = decryptFiles.filter(file =>
      (file.isFixedWidth || decryptionFormat === "txt") && !file.layoutId
    );
    if (filesMissingLayouts.length > 0) {
      setDecryptFiles(prev => prev.map(file => filesMissingLayouts.some(missing => missing.id === file.id)
        ? { ...file, error: "Select a matching layout for this file before decrypting." }
        : file
      ));
      setDecryptError("Select a matching layout for every TXT file before decrypting.");
      setDecryptRunning(false);
      return;
    }

    let streamTarget: DirectoryHandle | string | null =
      decryptOutputDirectory ?? (decryptOutputDirectoryName || null);
    if (!streamTarget) {
      if (window.desktopAPI) {
        const selectedPath = await window.desktopAPI.chooseOutputFolder();
        if (selectedPath) {
          setDecryptOutputDirectoryName(selectedPath);
          streamTarget = selectedPath;
        }
      } else {
        streamTarget = await chooseDecryptOutputDirectory();
      }
    }
    if (!streamTarget) {
      setDecryptError("Choose a decryption output folder before decrypting files.");
      setDecryptRunning(false);
      return;
    }

    setDecryptFiles(prev => prev.map(file => ({
      ...file,
      running: true,
      progress: 0,
      blob: null,
      decryptedPreview: [],
      outputSaved: false,
      outputName: "",
      error: "",
    })));

    const decryptOne = async (entry: DecryptFile) => {
      try {
        const entryLayout = layouts.find(layout => layout.id === entry.layoutId)?.result;
        if (entry.isFixedWidth) {
          if (!entryLayout) throw new Error("No matching fixed-width layout was selected.");
          const fixedWidthResult = decryptFixedWidthFileToStream(
            entry.file,
            entryLayout.fields,
            new Set(entry.cols),
            buildOpts(),
            decryptionFormat,
            pct => patchDecryptFile(setDecryptFiles, entry.id, { progress: pct }),
          );
          const outputBaseName = entry.fileName.replace(/\.[^.]+$/, "");
          const outputName = formatOutputName(outputBaseName, "_decrypted", decryptionFormat);
          await saveOutputStream(fixedWidthResult.stream, outputName, streamTarget);
          patchDecryptFile(setDecryptFiles, entry.id, {
            decryptedPreview: fixedWidthResult.previewRows.slice(0, 500),
            outputSaved: true,
            outputName,
            running: false,
            progress: 100,
          });
          return;
        }
        if (entry.file.size >= STREAMING_FILE_THRESHOLD) {
          const { stream, previewRows } = decryptCSVFileToStream(
            entry.file,
            new Set(entry.cols),
            buildOpts(),
            pct => patchDecryptFile(setDecryptFiles, entry.id, { progress: pct }),
          );
          const outputBaseName = entry.fileName.replace(/\.[^.]+$/, "");
          const outputName = formatOutputName(outputBaseName, "_decrypted", decryptionFormat);
          const outputStream = decryptionFormat === "txt"
            ? fixedWidthStreamFromCSV(stream, entryLayout!.fields)
            : stream;
          await saveOutputStream(outputStream, outputName, streamTarget);
          patchDecryptFile(setDecryptFiles, entry.id, {
            decryptedPreview: previewRows.slice(0, 500),
            outputSaved: true,
            outputName,
            running: false,
            progress: 100,
          });
        } else {
          const blob = await decryptCSVToBlob(
            entry.csvText!,
            new Set(entry.cols),
            buildOpts(),
            pct => patchDecryptFile(setDecryptFiles, entry.id, { progress: pct }),
          );
          const outputBaseName = entry.fileName.replace(/\.[^.]+$/, "");
          const outputName = formatOutputName(outputBaseName, "_decrypted", decryptionFormat);
          const csvText = await blob.text();
          const outputBlob = decryptionFormat === "txt"
            ? new Blob([fixedWidthTextFromCSV(csvText, entryLayout!.fields)], { type: "text/plain;charset=utf-8;" })
            : new Blob([csvText], { type: "text/csv;charset=utf-8;" });
          await saveOutputStream(outputBlob.stream(), outputName, streamTarget);
          patchDecryptFile(setDecryptFiles, entry.id, {
            decryptedPreview: parseExportCSV(csvText).rows.slice(0, 500),
            outputSaved: true,
            outputName,
            running: false,
            progress: 100,
          });
        }
      } catch (e) {
        patchDecryptFile(setDecryptFiles, entry.id, {
          running: false,
          error: `Decryption failed: ${(e as Error).message}`,
        });
      }
    };

    await Promise.all(decryptFiles.map(decryptOne));
    setDecryptRunning(false);
  }, [decryptFiles, decryptOutputDirectory, decryptOutputDirectoryName, chooseDecryptOutputDirectory, saveOutputStream, decryptionFormat, layouts, anonKeyMode, anonSeeds, anonPassphrase, anonPbkdf2Iter, anonDeterministic, anonAlphanumeric, anonKeyHexInput]);

  const handleOpenDecryptCompare = useCallback(async (fileId: string) => {
    const decryptFile = decryptFiles.find(file => file.id === fileId);
    if (!decryptFile || decryptFile.encryptedPreview.length === 0 || decryptFile.decryptedPreview.length === 0) return;
    setDecryptCompareLoading(true); setShowDecryptCompare(true);
    try {
      setDecryptCompareData({
        headers: decryptFile.headers,
        original: decryptFile.encryptedPreview,
        anonymized: decryptFile.decryptedPreview,
      });
    } finally { setDecryptCompareLoading(false); }
  }, [decryptFiles]);

  // ── Computed ─────────────────────────────────────────────────────────────

  const readyLayouts = layouts.filter(l => l.result !== null);
  const assignedFiles = dataFiles.filter(df => df.layoutId !== "");
  const activatedFiles = dataFiles.filter(df => df.activated);
  const keyModeLabel = anonKeyMode === "random" ? `seeds = [${anonSeeds.join(", ")}]` : anonKeyMode === "pbkdf2" ? `PBKDF2 (${anonPbkdf2Iter.toLocaleString()} iter)` : "raw hex key";
  const commonColumnNames = activatedFiles.length > 1
    ? activatedFiles.slice(1).reduce<string[]>((common, df) => {
      const lo = layouts.find(l => l.id === df.layoutId);
      const fields = new Set(lo?.result?.fields.map(f => f.varName) ?? []);
      return common.filter(column => fields.has(column));
    }, layouts.find(l => l.id === activatedFiles[0].layoutId)?.result?.fields.map(f => f.varName) ?? [])
    : [];
  const selectedCommonColumns = new Set(
    (commonSelectedColumns ?? commonColumnNames.filter(column =>
      activatedFiles.every(df => df.encColsList.includes(column))
    )).filter(column => commonColumnNames.includes(column)),
  );
  const commonDecryptColumns = commonColumnsForDecryptFiles(decryptFiles);
  const selectedDecryptCommonColumns = new Set(
    (decryptCommonSelectedColumns ?? commonDecryptColumns.filter(column =>
      decryptFiles.every(file => file.cols.includes(column))
    )).filter(column => commonDecryptColumns.includes(column)),
  );
  const decryptCompletedCount = decryptFiles.filter(file => file.blob || file.outputSaved).length;
  const decryptOverallProgress = decryptFiles.length > 0
    ? Math.round(decryptFiles.reduce((sum, file) => sum + file.progress, 0) / decryptFiles.length)
    : 0;
  const filesMissingColumns = activatedFiles.filter(df => df.encColsList.length === 0);
  const pendingDataFiles = dataFiles.filter(df => !df.activated);
  const allDataFilesReady = dataFiles.length > 1 && dataFiles.every(df => df.layoutId && df.lineCount > 0);
  const anonymizedFileCount = activatedFiles.filter(df => df.step === "anon-done").length;
  const anonymizingFiles = activatedFiles.filter(df => df.encRunning);
  const currentAnonymizingFile = anonymizingFiles[0];
  const inProgressContribution = anonymizingFiles.reduce((sum, df) => sum + df.encProgress / 100, 0);
  const overallAnonymizationProgress = activatedFiles.length > 0
    ? Math.min(100, Math.round((
      anonymizedFileCount + inProgressContribution
    ) / activatedFiles.length * 100))
    : 0;
  const completedEncryptionFiles = activatedFiles.filter(df => df.step === "anon-done" && df.encResultKey);
  const sharedEncryptionKey = completedEncryptionFiles[0]?.encResultKey ?? null;
  const overallAnonymizationLabel = anonymizedFileCount === activatedFiles.length
    ? `All ${activatedFiles.length} files anonymized`
    : anonymizingFiles.length > 0
      ? `Anonymizing ${anonymizingFiles.length} files · ${anonymizedFileCount} of ${activatedFiles.length} files complete`
      : `${anonymizedFileCount} of ${activatedFiles.length} files anonymized`;
  const allAnonFilesCollapsed = activatedFiles.length > 1
    && activatedFiles.every(df => collapsedAnonFiles.has(df.id));
  const allDecryptFilesCollapsed = decryptFiles.length > 1
    && decryptFiles.every(file => collapsedDecryptFiles.has(file.id));

  const phase = readyLayouts.length === 0 ? 0 : assignedFiles.length === 0 ? 1 : 2;

  return (
    <div className="space-y-8">

      {/* Always-mounted hidden input for decrypt so the ref is never nulled out */}
      <input ref={decryptInputRef} type="file" accept=".csv,.txt" multiple className="hidden"
        onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) void handleDecryptFiles(f); e.target.value = ""; }} />

      {activatedFiles.length === 0 && anonMode === "encrypt" && (
        <div className="border border-blue-200 bg-blue-50 rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-blue-950">Already have an encrypted CSV or TXT?</h2>
            <p className="text-sm text-blue-800 mt-1">Open direct decryption for AIRAVATA DEA CSV or fixed-width TXT files.</p>
          </div>
          <button onClick={() => setAnonMode("decrypt")}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap">
            <LockOpen className="w-4 h-4" />Decrypt a CSV/TXT directly
          </button>
        </div>
      )}

      {/* ── Step indicator ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {(["Upload layouts", "Assign to data files", "Process & download"] as const).map((label, idx) => (
          <span key={idx} className="flex items-center gap-3">
            {idx > 0 && <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            <StepBadge n={idx + 1} label={label} active={idx === phase} done={idx < phase} />
          </span>
        ))}
      </div>

      {/* ── Two-panel: layout manager + data file manager ─────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 min-w-0">

        {/* LEFT: Layout Manager */}
        <div className="border border-gray-200 rounded-2xl p-6 space-y-4 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-black">Step 1 — Layout files</h2>
              <p className="text-sm text-gray-500 mt-0.5">Excel (.xlsx) or CSV with Field_Name, Start, End columns</p>
            </div>
            <button
              onClick={() => layoutInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors flex-shrink-0">
              <Plus className="w-4 h-4" />Add layout
            </button>
            <input ref={layoutInputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) handleLayoutFiles(f); e.target.value = ""; }} />
          </div>

          {layouts.length === 0 && pendingTableSelections.length === 0 ? (
            <DropZone accept=".xlsx,.xls,.csv" multiple icon={<img src={folderIcon} className="w-20 h-20 object-contain" alt="" />}
              label="Drop layout files here" sublabel="Excel or CSV — multiple files supported"
              inputRef={layoutInputRef} onFiles={handleLayoutFiles} />
          ) : (
            <div className="space-y-3">
              {pendingTableSelections.map(selection => (
                <DetectedTablesCard
                  key={selection.id}
                  selection={selection}
                  onToggleTable={tableKey => togglePendingTable(selection.id, tableKey)}
                  onSelectAll={() => selectAllPendingTables(selection.id, true)}
                  onDeselectAll={() => selectAllPendingTables(selection.id, false)}
                  onConfirm={() => confirmDetectedTables(selection.id)}
                  onRemove={() => removePendingTableSelection(selection.id)}
                />
              ))}
              {layouts.map(lo => (
                <LayoutCard key={lo.id} lo={lo}
                  onConfirmSheet={() => confirmSheet(lo.id)}
                  onAutoDetect={() => autoDetectSheet(lo.id)}
                  onSheetToggle={sheet => {
                    const cur = lo.selectedSheets;
                    const next = cur.includes(sheet) ? cur.filter(s => s !== sheet) : [...cur, sheet];
                    patchLayout(setLayouts, lo.id, {
                      selectedSheets: next,
                      sheetRowCount: next.length === 1 && lo.excelInfo
                        ? getSheetRowCount(lo.excelInfo.buf, next[0]) : 0,
                    });
                  }}
                  onSelectAllSheets={() => patchLayout(setLayouts, lo.id, {
                    selectedSheets: lo.excelInfo ? [...lo.excelInfo.sheetNames] : [],
                    sheetRowCount: lo.excelInfo?.sheetNames.length === 1
                      ? getSheetRowCount(lo.excelInfo.buf, lo.excelInfo.sheetNames[0]) : 0,
                  })}
                  onDeselectAllSheets={() => patchLayout(setLayouts, lo.id, {
                    selectedSheets: [],
                    sheetRowCount: 0,
                  })}
                  onRangeChange={(from, to) => patchLayout(setLayouts, lo.id, { rowFrom: from, rowTo: to })}
                  onAddRange={() => addRange(lo.id)}
                  onRemove={() => removeLayout(lo.id)}
                />
              ))}
              <button onClick={() => layoutInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
                <Plus className="w-4 h-4" />Add more layout files
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Data File Manager */}
        <div className="border border-gray-200 rounded-2xl p-6 space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-black">Step 2 — Data files (.TXT)</h2>
              <p className="text-sm text-gray-500 mt-0.5">Fixed-width records — assign a layout to each</p>
              {autoAssignStatus && (
                <p className="text-xs text-blue-700 mt-2 max-w-2xl" role="status">
                  {autoAssignStatus}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {dataFiles.length > 0 && (
                <button
                  onClick={autoAssignLayouts}
                  disabled={readyLayouts.length === 0 || dataFiles.every(df => df.layoutId || df.lineCount <= 0)}
                  title={readyLayouts.length > 0
                    ? "Match unassigned TXT files to their most likely layouts"
                    : "Load at least one complete layout first"}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 transition-colors whitespace-nowrap">
                  <Shuffle className="w-4 h-4" />Auto-assign layouts
                </button>
              )}
              {dataFiles.length > 1 && pendingDataFiles.length > 0 && (
                <button
                  onClick={activateAllDataFiles}
                  disabled={!allDataFilesReady}
                  title={allDataFilesReady ? "Process all uploaded TXT files" : "Assign a layout to every file first"}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors whitespace-nowrap">
                  <Layers className="w-4 h-4" />Process all files
                </button>
              )}
              <button
                onClick={() => dataInputRef.current?.click()}
                disabled={readyLayouts.length === 0}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-black text-white hover:bg-gray-800 disabled:opacity-40 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />Add files
              </button>
            </div>
            <input ref={dataInputRef} type="file" accept=".txt,.dat,.fwf,.data" multiple className="hidden"
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) handleDataFiles(f); e.target.value = ""; }} />
          </div>

          {readyLayouts.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl text-center px-6">
              Load at least one layout first
            </div>
          ) : dataFiles.length === 0 ? (
            <DropZone accept=".txt,.dat,.fwf,.data" multiple icon={<img src={folderIcon} className="w-20 h-20 object-contain" alt="" />}
              label="Drop data files here" sublabel=".TXT, .DAT or any fixed-width file"
              inputRef={dataInputRef} onFiles={handleDataFiles} />
          ) : (
            <div className="space-y-3">
              {dataFiles.map(df => (
                <DataFileRow key={df.id} df={df} readyLayouts={readyLayouts}
                  onAssign={lid => assignLayout(df.id, lid)}
                  onTogglePreview={() => patchFile(setDataFiles, df.id, { showPreview: !df.showPreview })}
                  onProcess={() => activateDataFile(df.id)}
                  onRemove={() => removeDataFile(df.id)}
                />
              ))}
              <button onClick={() => dataInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
                <Plus className="w-4 h-4" />Add more data files
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Global encryption settings (shown when any file is activated) ── */}
      {(activatedFiles.length > 0 || anonMode === "decrypt") && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">Step 3 — 4-Round FPE Anonymize / Decrypt</h2>
                <p className="text-sm text-gray-500 mt-0.5">Key settings apply to all files below</p>
              </div>
            </div>
            <button onClick={anonMode === "decrypt" ? chooseDecryptOutputDirectory : chooseOutputDirectory}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <Download className="w-4 h-4" />
              {anonMode === "decrypt"
                ? decryptOutputDirectoryName || "Choose decryption output folder"
                : outputDirectoryName || "Choose output folder"}
            </button>
            <div className="flex items-center rounded-xl border border-emerald-200 overflow-hidden text-sm font-semibold flex-shrink-0 bg-white">
              {(["encrypt", "decrypt"] as const).map(m => (
                <button key={m} onClick={() => setAnonMode(m)}
                  className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${m !== "encrypt" ? "border-l border-gray-200" : ""} ${anonMode === m ? "bg-emerald-500 text-white" : "hover:bg-gray-50 text-gray-500"}`}>
                  {m === "encrypt" ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                  {m === "encrypt" ? "Encrypt" : "Decrypt"}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <KeySettings
              keyMode={anonKeyMode} setKeyMode={setAnonKeyMode}
              seeds={anonSeeds} setSeeds={setAnonSeeds}
              passphrase={anonPassphrase} setPassphrase={setAnonPassphrase}
              pbkdf2Iter={anonPbkdf2Iter} setPbkdf2Iter={setAnonPbkdf2Iter}
              deterministic={anonDeterministic} setDeterministic={setAnonDeterministic}
              strongDiffusion={anonStrongDiffusion} setStrongDiffusion={setAnonStrongDiffusion}
              alphanumeric={anonAlphanumeric} setAlphanumeric={setAnonAlphanumeric}
              keyHexInput={anonKeyHexInput} setKeyHexInput={setAnonKeyHexInput}
            />
            {anonMode === "encrypt" && activatedFiles.length > 1 && commonColumnNames.length > 0 && (
              <div className="mt-6 border border-blue-200 bg-blue-50/40 rounded-xl p-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-950">Common columns across all files</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Select a column once to add it to every active file. Columns shown here exist in all {activatedFiles.length} active files.
                    </p>
                  </div>
                  <button
                    onClick={clearAllEncryptionColumns}
                    disabled={batchEncryptRunning || !activatedFiles.some(df => df.encColsList.length > 0)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                    title="Clear selected columns from every active file, including unique columns"
                  >
                    Clear all columns
                  </button>
                </div>
                <ColSelector
                  allCols={commonColumnNames}
                  selected={selectedCommonColumns}
                  onChange={handleCommonColumnsChange}
                  label="Apply common columns to all files"
                />
              </div>
            )}
            {anonMode === "encrypt" && activatedFiles.length > 1 && (
              <div className="mt-6 border border-emerald-200 bg-emerald-50 rounded-xl p-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-950">Batch anonymisation</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Process all {activatedFiles.length} active files using their current column selections.
                      {filesMissingColumns.length > 0 && " Select at least one column in each file first."}
                    </p>
                  </div>
                  <button
                    onClick={handleEncryptAll}
                    disabled={batchEncryptRunning || filesMissingColumns.length > 0 || activatedFiles.some(df => df.encRunning)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {batchEncryptRunning
                      ? <><Spin />Anonymizing all {activatedFiles.length} files…</>
                      : <><Layers className="w-4 h-4" />Anonymize all files</>}
                  </button>
                </div>
                <ProgressBar
                  pct={overallAnonymizationProgress}
                  label={overallAnonymizationLabel}
                  icon={batchEncryptRunning ? <Spin /> : overallAnonymizationProgress === 100 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : undefined}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {anonMode === "encrypt" && sharedEncryptionKey && (
        <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-xl p-5 space-y-3 mb-6">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Key className="w-4 h-4" />Symmetric Key — save to decrypt all encrypted files
          </p>
          <div className="font-mono text-xs bg-white rounded-lg px-4 py-3 break-all select-all cursor-text leading-relaxed text-black border border-amber-200">
            {sharedEncryptionKey}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-amber-700 flex-1 min-w-0">
              4-round FPE · {keyModeLabel} · det. {anonDeterministic ? "ON" : "OFF"} · applies to {completedEncryptionFiles.length} encrypted file{completedEncryptionFiles.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => navigator.clipboard.writeText(sharedEncryptionKey)}
              className="text-sm px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors font-medium">
              Copy key
            </button>
            <button onClick={() => {
              const fileNames = completedEncryptionFiles.map(file => file.fileName).join(", ");
              const txt = [
                "AIRAVATA DEA FPE Key Material",
                "=".repeat(40),
                "",
                `Key (256-bit hex): ${sharedEncryptionKey}`,
                "",
                `Key derivation: ${keyModeLabel}`,
                `Deterministic mode: ${anonDeterministic ? "ON" : "OFF"}`,
                `Files: ${fileNames}`,
                `Generated: ${new Date().toISOString()}`,
                "",
                "IMPORTANT — Store this key material securely. It is required to decrypt.",
              ].join("\n");
              triggerDownload(new Blob([txt], { type: "text/plain" }), "key_airavata_dea.txt");
            }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors font-medium">
              <Download className="w-3.5 h-3.5" />Download key
            </button>
          </div>
          <p className="text-sm text-amber-700">⚠ Same key decrypts all encrypted files. Store securely — never log or share.</p>
        </div>
      )}

      {/* ── Per-file processing cards ─────────────────────────────────────── */}
      {anonMode === "encrypt" && activatedFiles.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => setCollapsedAnonFiles(prev => {
              const next = new Set(prev);
              for (const df of activatedFiles) {
                if (allAnonFilesCollapsed) next.delete(df.id);
                else next.add(df.id);
              }
              return next;
            })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:text-black hover:border-gray-300 transition-colors"
            aria-label={allAnonFilesCollapsed ? "Expand all file sections" : "Minimize all file sections"}
          >
            {allAnonFilesCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {allAnonFilesCollapsed ? "Expand all files" : "Minimize all files"}
          </button>
        </div>
      )}
      {anonMode === "encrypt" && activatedFiles.map(df => {
        const lo = layouts.find(l => l.id === df.layoutId);
        if (!lo?.result) return null;
        const fields = lo.result.fields;
        const allColNames = fields.map(f => f.varName);
        const encCols = new Set(df.encColsList);
        const isCollapsed = collapsedAnonFiles.has(df.id);

        return (
          <div key={df.id} className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-black text-sm truncate">{df.fileName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{df.lineCount.toLocaleString()} records · {fields.length} columns · layout: {lo.result.sheetName || lo.fileName}</p>
              </div>
              {df.step === "anon-done" && <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex-shrink-0"><CheckCircle2 className="w-3.5 h-3.5" />Done</span>}
              <button
                onClick={() => setCollapsedAnonFiles(prev => {
                  const next = new Set(prev);
                  if (next.has(df.id)) next.delete(df.id);
                  else next.add(df.id);
                  return next;
                })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-white transition-colors flex-shrink-0"
                aria-label={isCollapsed ? `Expand ${df.fileName}` : `Minimize ${df.fileName}`}
                title={isCollapsed ? "Expand file section" : "Minimize file section"}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button onClick={() => patchFile(setDataFiles, df.id, { activated: false })}
                className="text-gray-400 hover:text-black flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>

            {!isCollapsed && <div className="p-6 space-y-5">

              {anonMode === "encrypt" && (
                <>
                  <ColSelector allCols={allColNames} selected={encCols}
                    onChange={s => patchFile(setDataFiles, df.id, { encColsList: [...s] })}
                    label="Columns to encrypt" />

                  {df.encError && <ErrorBox message={df.encError} />}
                  {df.encRunning && <ProgressBar pct={df.encProgress} label={`Encrypting ${df.encColsList.length} column${df.encColsList.length !== 1 ? "s" : ""} across ${df.lineCount.toLocaleString()} records…`} icon={<Shuffle className="w-4 h-4 animate-spin" />} />}
                  {df.origDownloading && <ProgressBar pct={df.origProgress} label="Building original CSV…" icon={<Download className="w-4 h-4 animate-pulse" />} />}

                  {df.step !== "anon-done" ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => handleEncrypt(df.id)} disabled={df.encRunning || df.origDownloading || df.encColsList.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white text-base font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        {df.encRunning ? <><Spin />Anonymizing…</> : <><Lock className="w-4 h-4" />Apply 4-round FPE anonymization</>}
                      </button>
                      <button onClick={() => handleDownloadOriginal(df.id)} disabled={df.encRunning || df.origDownloading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-black hover:border-gray-400 disabled:opacity-50 transition-colors whitespace-nowrap">
                        <Download className="w-4 h-4" />Download original CSV
                      </button>
                    </div>
                  ) : (
                    df.encResultKey && (
                      <div className="space-y-5">
                        <SuccessBadge text={`Encryption complete — ${df.encColsList.length} column${df.encColsList.length !== 1 ? "s" : ""} encrypted`} />
                        {df.encOutputSaved && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Large-file mode wrote the anonymized {encryptionFormat.toUpperCase()} directly to <strong>{df.encOutputName}</strong>. The source file was processed in chunks without loading it into memory.
                          </div>
                        )}

                         {df.encResultBlob && encryptionFormat === "txt" && (
                           <button
                             onClick={() => triggerDownload(df.encResultBlob!, formatOutputName(df.outputBaseName, "_anonymized", "txt"))}
                             className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors"
                           >
                             <Download className="w-4 h-4" />Download fixed-width TXT
                           </button>
                         )}

                         {/* Format download panel — available when the result is retained in memory. */}
                         {df.encResultBlob && encryptionFormat === "csv" && <div className="border border-gray-200 rounded-xl overflow-hidden">
                           {EXPORT_FORMATS.map((fmt, idx) => {
                            const isRunning = df.exportingFmts.includes(fmt.id);
                            return (
                              <div key={fmt.id} className={`flex items-center gap-3 px-4 py-3 bg-white ${idx !== EXPORT_FORMATS.length - 1 ? "border-b border-gray-100" : ""}`}>
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono flex-shrink-0">{fmt.ext}</span>
                                <span className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-black block">{fmt.label}</span>
                                  <span className="text-xs text-gray-400 truncate block">{fmt.description}</span>
                                </span>
                                <button disabled={isRunning}
                                  onClick={() => handleExport(df.id, fmt.id, df.encResultBlob!, fields, df.outputBaseName)}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 whitespace-nowrap">
                                  {isRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Download className="w-3.5 h-3.5" />Download</>}
                                </button>
                              </div>
                            );
                          })}
                         </div>}

                         <div className="flex flex-col sm:flex-row gap-3">
                           <button onClick={() => handleDownloadOriginal(df.id)} disabled={df.origDownloading}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-black hover:border-gray-400 disabled:opacity-50 transition-colors">
                            <Download className="w-4 h-4" />Download original CSV
                          </button>
                        </div>
                        {df.origDownloading && <ProgressBar pct={df.origProgress} label="Building original CSV…" icon={<Download className="w-4 h-4 animate-pulse" />} />}

                         <button onClick={() => patchFile(setDataFiles, df.id, {
                           step: "ready", encResultBlob: null, encResultKey: null, encPreview: [],
                           encOutputSaved: false, encOutputName: "", encProgress: 0,
                         })}
                          className="w-full text-sm text-gray-400 hover:text-black text-center transition-colors">
                          ← Change column selection or key settings
                        </button>
                      </div>
                    )
                  )}
                </>
              )}

            </div>}
          </div>
        );
      })}

      {anonMode === "encrypt" && activatedFiles.some(df =>
        df.step === "anon-done" && (df.encResultBlob || df.encPreview.length > 0)
      ) && (
        <div className="space-y-2 mb-6">
          {activatedFiles
            .filter(df => df.step === "anon-done" && (df.encResultBlob || df.encPreview.length > 0))
            .map(df => (
              <button key={df.id} onClick={() => handleOpenCompare(df.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors">
                <Columns2 className="w-4 h-4" />View {df.fileName} side by side
              </button>
            ))}
        </div>
      )}

      {anonMode === "decrypt" && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white border border-blue-200 flex items-center justify-center flex-shrink-0">
                <LockOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">Direct CSV/TXT decryption</h2>
                <p className="text-sm text-gray-500 mt-0.5">Decrypt an existing AIRAVATA DEA CSV or fixed-width TXT file.</p>
              </div>
            </div>
            <button onClick={() => setAnonMode("encrypt")}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-300 bg-white text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
              <Lock className="w-4 h-4" />Back to anonymization
            </button>
          </div>
          <div className="p-6 space-y-5">
             <p className="text-sm text-gray-500">Upload encrypted CSV or fixed-width TXT files created by this tool, enter the same key settings, and select shared columns to restore in every file.</p>
             {needsDecryptLayout && (
               <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                 <div>
                   <p className="text-sm font-semibold text-blue-950">Layouts for fixed-width TXT files and output</p>
                   <p className="text-xs text-blue-700 mt-1">
                     Select one or more layouts. Multiple TXT files are matched to the selected layouts by filename; each file can be corrected below.
                   </p>
                 </div>
                 {decryptLayoutOptions.length > 0 ? (
                   <div className="grid gap-2 sm:grid-cols-2">
                     {decryptLayoutOptions.map(layout => (
                       <label key={layout.id} className="flex items-start gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-sm text-gray-800 cursor-pointer hover:border-blue-300">
                         <input
                           type="checkbox"
                           checked={decryptLayoutIds.includes(layout.id)}
                           onChange={event => handleDecryptLayoutSelectionChange(
                             event.target.checked
                               ? [...decryptLayoutIds, layout.id]
                               : decryptLayoutIds.filter(id => id !== layout.id),
                           )}
                           disabled={decryptRunning}
                           className="mt-0.5 accent-blue-600"
                         />
                         <span className="min-w-0">
                           <span className="block truncate font-medium">{layout.fileName}</span>
                           {layout.result?.sheetName && (
                             <span className="block truncate text-xs text-gray-500">{layout.result.sheetName}</span>
                           )}
                         </span>
                       </label>
                     ))}
                   </div>
                 ) : (
                   <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                     Upload one or more layout files in Step 1 before selecting TXT files.
                   </p>
                 )}
                 <p className="text-xs text-blue-700">
                   Required for fixed-width TXT input or TXT output. Upload layouts in Step 1 if they are not listed.
                 </p>
               </div>
             )}
            {decryptFiles.length === 0 ? (
               <DropZone accept=".csv,.txt" multiple icon={<LockOpen className="w-9 h-9 text-blue-600" />}
                 label="Drop anonymized CSV or TXT files here" sublabel="CSV and fixed-width TXT files encrypted by this tool are supported"
                inputRef={decryptInputRef} onFiles={files => void handleDecryptFiles(files)} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-black">
                    {decryptFiles.length} encrypted file{decryptFiles.length !== 1 ? "s" : ""} selected
                  </p>
                  <button onClick={() => decryptInputRef.current?.click()} disabled={decryptRunning}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 transition-colors">
                    <Plus className="w-4 h-4" />Add files
                  </button>
                  <button onClick={() => {
                    setDecryptFiles([]);
                    setDecryptCommonSelectedColumns(null);
                    setCollapsedDecryptFiles(new Set());
                    setDecryptError("");
                  }}
                    disabled={decryptRunning}
                    className="text-gray-400 hover:text-black disabled:opacity-50" aria-label="Remove all decryption files">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {decryptFiles.length > 1 && (
                  <button
                    onClick={() => setCollapsedDecryptFiles(prev => {
                      const next = new Set(prev);
                      if (allDecryptFilesCollapsed) decryptFiles.forEach(file => next.delete(file.id));
                      else decryptFiles.forEach(file => next.add(file.id));
                      return next;
                    })}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:text-black hover:border-gray-400 transition-colors"
                    aria-label={allDecryptFilesCollapsed ? "Expand all decryption file sections" : "Minimize all decryption file sections"}
                  >
                    {allDecryptFilesCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {allDecryptFilesCollapsed ? "Expand all files" : "Minimize all files"}
                  </button>
                )}

                 {decryptFiles.length > 1 && commonDecryptColumns.length > 0 && (
                   <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-5 space-y-3">
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                       <div>
                         <p className="text-sm font-semibold text-blue-950">Common columns across all files</p>
                         <p className="text-xs text-blue-700 mt-1">
                           Select a column once to add it to every file. Unique columns remain editable in each file below.
                         </p>
                       </div>
                       <button
                         onClick={() => handleCommonDecryptColumnsChange(new Set())}
                         disabled={decryptRunning || !decryptFiles.some(file => file.cols.length > 0)}
                         className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                       >
                         Clear common columns
                       </button>
                     </div>
                     <ColSelector
                       allCols={commonDecryptColumns}
                       selected={selectedDecryptCommonColumns}
                       onChange={handleCommonDecryptColumnsChange}
                       label="Apply common columns to all files"
                     />
                   </div>
                 )}
                 {decryptFiles.length > 1 && commonDecryptColumns.length === 0 && (
                   <p className="text-sm text-amber-700 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                     These files do not share any column names. Use each file&apos;s own selector below.
                   </p>
                 )}

                 {decryptFiles.length > 0 && (
                   <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-950">Batch decryption</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Process all {decryptFiles.length} selected file{decryptFiles.length !== 1 ? "s" : ""} using their current column selections.
                          </p>
                        </div>
                        <button
                          onClick={handleDecrypt}
                           disabled={decryptRunning
                             || decryptFiles.some(file => file.cols.length === 0)
                             || decryptFiles.some(file => (file.isFixedWidth || decryptionFormat === "txt") && !file.layoutId)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {decryptRunning
                            ? <><Spin />Decrypting all files…</>
                            : <><LockOpen className="w-4 h-4" />Decrypt all files</>}
                        </button>
                     </div>
                     <ProgressBar
                       pct={decryptOverallProgress}
                       label={decryptRunning
                         ? `Decrypting ${decryptCompletedCount} of ${decryptFiles.length} files…`
                         : decryptCompletedCount === decryptFiles.length
                           ? `${decryptCompletedCount} of ${decryptFiles.length} files decrypted`
                           : `Ready to decrypt ${decryptFiles.length} file${decryptFiles.length !== 1 ? "s" : ""}`}
                       icon={decryptRunning
                         ? <Shuffle className="w-4 h-4 animate-spin" />
                         : decryptCompletedCount === decryptFiles.length
                           ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                           : undefined}
                     />
                   </div>
                 )}

                 <div className="space-y-3">
                   {decryptFiles.map(file => {
                    const isCollapsed = collapsedDecryptFiles.has(file.id);
                    return (
                      <div key={file.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className={`flex items-center gap-2 px-4 py-3 ${isCollapsed ? "bg-white" : "bg-gray-50"}`}>
                          <button
                            onClick={() => setCollapsedDecryptFiles(prev => {
                              const next = new Set(prev);
                              if (next.has(file.id)) next.delete(file.id);
                              else next.add(file.id);
                              return next;
                            })}
                            className="p-1 rounded-md text-gray-400 hover:text-black hover:bg-gray-200 transition-colors flex-shrink-0"
                            aria-label={isCollapsed ? `Expand ${file.fileName}` : `Minimize ${file.fileName}`}
                            title={isCollapsed ? "Expand file section" : "Minimize file section"}
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-semibold text-black truncate">{file.fileName}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">{file.headers.length} columns</span>
                          <button onClick={() => removeDecryptFile(file.id)} disabled={decryptRunning}
                            className="ml-auto text-gray-400 hover:text-black disabled:opacity-50" aria-label={`Remove ${file.fileName}`}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {!isCollapsed && (
                          <div className="px-4 pb-4 pt-3 space-y-3">
                             {(file.isFixedWidth || decryptionFormat === "txt") && (
                               <label className="block space-y-1.5">
                                 <span className="text-sm font-semibold text-gray-800">
                                   {file.isFixedWidth ? "Layout for this TXT file" : "Layout for this TXT output"}
                                 </span>
                                 <select
                                   value={file.layoutId}
                                   onChange={event => handleDecryptFileLayout(file.id, event.target.value)}
                                   disabled={decryptRunning}
                                   className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                 >
                                   <option value="">Choose a matching layout</option>
                                   {decryptLayoutOptions.map(layout => (
                                     <option key={layout.id} value={layout.id}>
                                       {layout.fileName}{layout.result?.sheetName ? ` — ${layout.result.sheetName}` : ""}
                                     </option>
                                   ))}
                                 </select>
                               </label>
                             )}
                            <ColSelector
                              allCols={file.headers}
                              selected={new Set(file.cols)}
                              onChange={next => handleDecryptFileColumns(file.id, next)}
                              label={`Columns to decrypt in ${file.fileName}`}
                            />
                            {file.running && (
                              <ProgressBar pct={file.progress} label={`Decrypting ${file.progress}%…`} icon={<Shuffle className="w-4 h-4 animate-spin" />} />
                            )}
                            {file.error && <ErrorBox message={file.error} />}
                            {file.outputSaved && (
                              <p className="text-xs text-emerald-700">
                                Saved to output folder as <strong>{file.outputName}</strong>.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
            {decryptError && <ErrorBox message={decryptError} />}
            {decryptCompletedCount > 0 && !decryptRunning && (
              <SuccessBadge text={`${decryptCompletedCount} file${decryptCompletedCount !== 1 ? "s" : ""} decrypted — original values restored`} />
            )}
            {decryptFiles.some(file => file.outputSaved) && (
              <div className="space-y-2">
                {decryptFiles.filter(file => file.outputSaved).map(file => (
                  <div key={file.id} className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => handleOpenDecryptCompare(file.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors">
                      <Columns2 className="w-4 h-4" />View {file.fileName} side by side
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compare modals ────────────────────────────────────────────────── */}
      {showCompare && (
        <SideBySideModal loading={compareLoading} data={compareData} totalRows={compareTotalRows}
          onClose={() => { setShowCompare(false); setCompareData(null); }} />
      )}
      {showDecryptCompare && (
        <SideBySideModal loading={decryptCompareLoading} data={decryptCompareData}
          totalRows={decryptCompareData?.original.length ?? 0}
          leftLabel="Encrypted" rightLabel="Decrypted"
          onClose={() => { setShowDecryptCompare(false); setDecryptCompareData(null); }} />
      )}
    </div>
  );
}

// ── LayoutCard ────────────────────────────────────────────────────────────────

function DetectedTablesCard({ selection, onToggleTable, onSelectAll, onDeselectAll, onConfirm, onRemove }: {
  selection: PendingTableSelection;
  onToggleTable: (tableKey: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const allSelected = selection.selectedKeys.length === selection.tables.length;
  const noneSelected = selection.selectedKeys.length === 0;

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50">
        <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-black break-words">{selection.fileName}</p>
          <p className="text-xs text-blue-700 mt-0.5">
            {selection.tables.length} table{selection.tables.length !== 1 ? "s" : ""} detected — choose which to import
          </p>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-black flex-shrink-0" aria-label={`Remove ${selection.fileName}`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-black">Tables to import</p>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={onSelectAll} disabled={allSelected} className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed">
              Select all
            </button>
            <button onClick={onDeselectAll} disabled={noneSelected} className="text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed">
              Deselect all
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {selection.tables.map(table => {
            const checked = selection.selectedKeys.includes(table.key);
            return (
              <label
                key={table.key}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  checked ? "border-blue-400 bg-blue-50/60" : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTable(table.key)}
                  className="accent-blue-600 w-4 h-4 flex-shrink-0 mt-0.5 rounded"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-black break-words">
                    Table {table.index + 1} · {table.title}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5 break-words">
                    Sheet: {table.sheetName} · header row {table.headerRow + 1} · data starts row {table.firstDataRow + 1}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-xs text-gray-500">
            {selection.selectedKeys.length} of {selection.tables.length} selected
          </span>
          <button
            onClick={onConfirm}
            disabled={noneSelected}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Use selected tables
          </button>
        </div>
      </div>
    </div>
  );
}

function LayoutCard({ lo, onConfirmSheet, onAutoDetect, onSheetToggle, onSelectAllSheets, onDeselectAllSheets, onRangeChange, onAddRange, onRemove }: {
  lo: LayoutEntry;
  onConfirmSheet: () => void;
  onAutoDetect: () => void;
  onSheetToggle: (sheet: string) => void;
  onSelectAllSheets: () => void;
  onDeselectAllSheets: () => void;
  onRangeChange: (from: string, to: string) => void;
  onAddRange: () => void;
  onRemove: () => void;
}) {
  const done = lo.result !== null;
  const fields = lo.result?.fields ?? [];

  return (
    <div className={`border rounded-xl overflow-hidden ${done ? "border-emerald-200" : lo.error ? "border-red-200" : "border-gray-200"}`}>
      {/* Header row */}
      <div className={`flex items-center gap-3 px-4 py-3 ${done ? "bg-emerald-50" : lo.error ? "bg-red-50" : "bg-gray-50"}`}>
        {done
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          : lo.error
          ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          : <Spin />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-black truncate">{lo.fileName}</p>
          {done && <p className="text-xs text-emerald-700">{fields.length} fields{lo.result?.sheetName ? ` · ${lo.result.sheetName}` : ""}</p>}
          {lo.error && <p className="text-xs text-red-600 truncate">{lo.error}</p>}
          {!done && !lo.error && !lo.sheetSelectOpen && <p className="text-xs text-gray-500">Parsing…</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {done && lo.excelInfo && (
            <button onClick={onAddRange}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors font-medium whitespace-nowrap">
              <Plus className="w-3 h-3" />Add range
            </button>
          )}
          <button onClick={onRemove} className="text-gray-400 hover:text-black"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Field preview (when done) */}
      {done && fields.length > 0 && (
        <div className="overflow-auto max-h-44 border-t border-gray-100">
          <table className="w-full table-fixed text-xs border-collapse">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[35%]" />
              <col className="w-[39%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-gray-50 sticky top-0">
              <tr>{["#", "Variable", "Full Name", "Start", "End", "Len"].map(h => (
                <th key={h} className="px-2.5 py-1.5 text-left border-r last:border-r-0 border-gray-200 text-gray-500 font-semibold whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.srlNo} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-2.5 py-1.5 text-gray-400 font-mono border-r border-gray-100">{f.srlNo}</td>
                  <td className="px-2.5 py-1.5 font-semibold text-black border-r border-gray-100 break-words whitespace-normal">{f.varName}</td>
                  <td className="px-2.5 py-1.5 text-gray-600 border-r border-gray-100 break-words whitespace-normal" title={f.fullName}>{f.fullName}</td>
                  <td className="px-2.5 py-1.5 text-center font-mono text-black border-r border-gray-100">{f.start}</td>
                  <td className="px-2.5 py-1.5 text-center font-mono text-black border-r border-gray-100">{f.end}</td>
                  <td className="px-2.5 py-1.5 text-center font-mono text-black">{f.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet selector (inline) — multi-select */}
      {lo.sheetSelectOpen && lo.excelInfo && (() => {
        const allSheets = lo.excelInfo.sheetNames;
        const sel = lo.selectedSheets;
        const allSelected = sel.length === allSheets.length;
        const noneSelected = sel.length === 0;
        return (
          <div className="p-4 space-y-4 border-t border-gray-100 bg-white">
            {/* Header: badge + select-all toggle */}
            <div className="flex items-center justify-between gap-2">
              <InfoBadge
                icon={<FileSpreadsheet className="w-4 h-4" />}
                text={`${allSheets.length} sheet${allSheets.length !== 1 ? "s" : ""} found — ${sel.length} selected`}
              />
              <button
                onClick={() => allSelected ? onDeselectAllSheets() : onSelectAllSheets()}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            {/* Checkbox list */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {allSheets.map(name => {
                const checked = sel.includes(name);
                return (
                  <label key={name} className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${checked ? "border-blue-500 bg-blue-50 text-black" : "border-gray-200 hover:border-blue-300 text-gray-500"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onSheetToggle(name)}
                      className="accent-blue-600 w-4 h-4 flex-shrink-0 rounded"
                    />
                    <span className="font-medium truncate">{name}</span>
                    {checked && sel.length === 1 && lo.sheetRowCount > 0 && (
                      <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{lo.sheetRowCount} rows</span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Row range — shown for all selections; note added for multi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-black">
                  Row range
                  {sel.length === 1 && lo.sheetRowCount > 0 && (
                    <span className="font-normal text-gray-500 ml-1">({lo.sheetRowCount} rows)</span>
                  )}
                  {sel.length > 1 && (
                    <span className="font-normal text-gray-400 ml-1 text-xs">· applies to all selected sheets</span>
                  )}
                </p>
                {(lo.rowFrom || lo.rowTo) && (
                  <button onClick={() => onRangeChange("", "")} className="text-sm text-gray-400 hover:text-black flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />All rows
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {[{ label: "From", val: lo.rowFrom, ph: "1" }, { label: "To", val: lo.rowTo, ph: sel.length === 1 && lo.sheetRowCount ? String(lo.sheetRowCount) : "last" }].map(({ label, val, ph }, i) => (
                  <div key={i} className="flex-1 space-y-1">
                    <p className="text-xs text-gray-500">{label} row</p>
                    <input type="number" min={1} placeholder={ph} value={val}
                      onChange={e => onRangeChange(i === 0 ? e.target.value : lo.rowFrom, i === 1 ? e.target.value : lo.rowTo)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                  </div>
                ))}
              </div>
            </div>

            {lo.error && <ErrorBox message={lo.error} />}

            <div className="flex gap-2">
              <button onClick={onConfirmSheet} disabled={lo.applyingSheet || noneSelected}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {lo.applyingSheet
                  ? <><Spin />Parsing…</>
                  : <><ArrowRight className="w-3.5 h-3.5" />Use selected sheet{sel.length > 1 ? `s (${sel.length})` : ""}</>}
              </button>
              <button onClick={onAutoDetect} disabled={lo.applyingSheet}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-black hover:border-gray-400 disabled:opacity-50 transition-colors whitespace-nowrap">
                Auto-detect
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── DataFileRow ───────────────────────────────────────────────────────────────

function DataFileRow({ df, readyLayouts, onAssign, onTogglePreview, onProcess, onRemove }: {
  df: DataFile;
  readyLayouts: LayoutEntry[];
  onAssign: (layoutId: string) => void;
  onTogglePreview: () => void;
  onProcess: () => void;
  onRemove: () => void;
}) {
  const assignedLayout = readyLayouts.find(l => l.id === df.layoutId);
  const canProcess = !!assignedLayout && df.lineCount > 0 && !df.activated;

  return (
    <div className={`border rounded-xl overflow-hidden ${df.activated ? "border-emerald-200" : df.error ? "border-red-200" : "border-gray-200"}`}>
      {/* Main row */}
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${df.activated ? "bg-emerald-50" : "bg-white"}`}>
        {df.lineCount > 0
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          : df.error
          ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          : <Spin />}

        <div className="flex-1 min-w-[8rem]">
          <p className="text-sm font-semibold text-black truncate">{df.fileName}</p>
          {df.lineCount > 0 && <p className="text-xs text-gray-500">{df.lineCount.toLocaleString()} records</p>}
          {df.error && <p className="text-xs text-red-600 truncate">{df.error}</p>}
        </div>

        {/* Layout assignment dropdown */}
        {df.lineCount > 0 && (
          <div className="relative min-w-[11rem] max-w-full flex-[1_1_14rem]">
            <select
              value={df.layoutId}
              onChange={e => onAssign(e.target.value)}
              title={assignedLayout?.fileName}
              className={`block w-full min-w-0 max-w-full appearance-none truncate text-xs font-medium px-2.5 py-1.5 pr-7 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${df.layoutId ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-500"}`}>
              <option value="">— assign layout —</option>
              {readyLayouts.map(lo => (
                <option key={lo.id} value={lo.id}>
                  {lo.result?.sheetName
                    ? `${lo.fileName} (${lo.result.sheetName}${lo.rowFrom || lo.rowTo ? ` r${lo.rowFrom || 1}–${lo.rowTo || "end"}` : ""})`
                    : `${lo.fileName} · ${lo.result!.fields.length}f`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
          </div>
        )}

        {/* Actions stay together and wrap below the filename/selector when needed. */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* Preview toggle */}
          {df.preview.length > 0 && (
            <button onClick={onTogglePreview}
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-black hover:border-gray-400 transition-colors flex-shrink-0">
              <Eye className="w-3.5 h-3.5" />
              {df.showPreview ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}

          {/* Process button */}
          {canProcess && (
            <button onClick={onProcess}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors flex-shrink-0 whitespace-nowrap">
              <ArrowRight className="w-3.5 h-3.5" />Process
            </button>
          )}
          {df.activated && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg flex-shrink-0 whitespace-nowrap">Active ↓</span>
          )}

          <button onClick={onRemove} className="text-gray-400 hover:text-black flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Preview table (expandable) */}
      {df.showPreview && df.preview.length > 0 && assignedLayout?.result && (
        <div className="border-t border-gray-100 overflow-auto max-h-40">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {assignedLayout.result.fields.map(f => (
                  <th key={f.srlNo} className="px-2.5 py-1.5 text-left font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap">{f.varName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {df.preview.map((row, ri) => (
                <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1 font-mono border-r border-gray-100 whitespace-nowrap text-black">
                      {cell || <span className="text-gray-300 italic">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Side-by-side compare modal ────────────────────────────────────────────────

function SideBySideModal({ loading, data, totalRows, leftLabel = "Original", rightLabel = "Anonymized", onClose }: {
  loading: boolean;
  data: { headers: string[]; original: string[][]; anonymized: string[][] } | null;
  totalRows: number;
  leftLabel?: string;
  rightLabel?: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filteredHeaders = data ? (search.trim() ? data.headers.filter(h => h.toLowerCase().includes(search.trim().toLowerCase())) : data.headers) : [];
  const filteredIdxs = data ? data.headers.map((h, i) => ({ h, i })).filter(({ h }) => !search.trim() || h.toLowerCase().includes(search.trim().toLowerCase())).map(({ i }) => i) : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Columns2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
           <h2 className="text-lg font-semibold text-black leading-tight">
             {leftLabel === "Encrypted" && rightLabel === "Decrypted" ? "Encrypted vs Decrypted" : "Original vs Anonymized"}
           </h2>
            <p className="text-sm text-gray-500">
              {data ? `Showing ${data.original.length.toLocaleString()} of ${totalRows.toLocaleString()} rows · ${data.headers.length} columns` : "Loading…"}
              {totalRows > 500 && data && <span className="ml-1 text-amber-600">(capped at 500 rows)</span>}
            </p>
          </div>
        </div>
        <div className="relative w-64 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter columns…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-black" />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" />Changed</span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium"><span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block" />Unchanged</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-black transition-colors flex-shrink-0"><X className="w-5 h-5" /></button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-base font-medium">Building comparison…</span>
        </div>
      )}

      {!loading && data && (
        <div className="flex-1 flex min-h-0 divide-x divide-gray-200">
          {[{ label: leftLabel, rows: data.original, bg: "bg-gray-50", hBg: "bg-gray-50", hText: "text-gray-500" }, { label: rightLabel, rows: data.anonymized, bg: "bg-emerald-50", hBg: "bg-emerald-50/80 backdrop-blur-sm", hText: "text-emerald-700" }].map(({ label, rows, bg, hBg, hText }, side) => (
            <div key={side} className="flex-1 flex flex-col min-w-0">
              <div className={`px-4 py-2.5 ${bg} border-b border-gray-200 flex items-center gap-2 flex-shrink-0`}>
                <span className={`text-sm font-semibold ${side === 0 ? "text-black" : "text-emerald-800"}`}>{label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${side === 0 ? "bg-gray-200 text-gray-600" : "bg-emerald-100 text-emerald-700"}`}>{rows.length.toLocaleString()} rows</span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="text-xs border-collapse w-max min-w-full">
                  <thead className={`sticky top-0 ${hBg} z-10`}>
                    <tr>
                      <th className={`sticky left-0 ${side === 0 ? "bg-gray-50" : "bg-emerald-50"} px-3 py-2 text-left font-semibold ${hText} border-r border-b border-gray-200 whitespace-nowrap`}>#</th>
                      {filteredHeaders.map(h => <th key={h} className={`px-3 py-2 text-left font-semibold ${hText} border-r border-b border-gray-200 whitespace-nowrap`}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="sticky left-0 px-3 py-1.5 text-gray-400 font-mono border-r border-gray-100 whitespace-nowrap" style={{ background: ri % 2 === 0 ? "white" : "rgb(249 250 251 / 0.5)" }}>{ri + 1}</td>
                        {filteredIdxs.map(ci => {
                          const origVal = data.original[ri]?.[ci] ?? "";
                          const anonVal = data.anonymized[ri]?.[ci] ?? "";
                          const changed = origVal !== anonVal;
                          return (
                            <td key={ci} className={`px-3 py-1.5 font-mono border-r border-gray-100 whitespace-nowrap ${changed ? (side === 0 ? "bg-amber-50 text-amber-900" : "bg-amber-100 text-amber-900 font-semibold") : ""}`}>
                              {row[ci] || <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KeySettings ───────────────────────────────────────────────────────────────

function KeySettings({ keyMode, setKeyMode, seeds, setSeeds, passphrase, setPassphrase, pbkdf2Iter, setPbkdf2Iter, deterministic, setDeterministic, strongDiffusion, setStrongDiffusion, alphanumeric, setAlphanumeric, keyHexInput, setKeyHexInput }: {
  keyMode: "random" | "pbkdf2" | "hex"; setKeyMode: (m: "random" | "pbkdf2" | "hex") => void;
  seeds: number[]; setSeeds: (s: number[]) => void;
  passphrase: string; setPassphrase: (s: string) => void;
  pbkdf2Iter: number; setPbkdf2Iter: (n: number) => void;
  deterministic: boolean; setDeterministic: (b: boolean) => void;
  strongDiffusion: boolean; setStrongDiffusion: (b: boolean) => void;
  alphanumeric: boolean; setAlphanumeric: (b: boolean) => void;
  keyHexInput: string; setKeyHexInput: (s: string) => void;
}) {
  const setSeed = (i: number, val: number) => {
    const next = [...seeds];
    next[i] = val;
    setSeeds(next);
  };

  const randomizeSeeds = () => {
    const values = new Set<number>();
    const randomValues = new Uint32Array(4);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(randomValues);
      randomValues.forEach(value => values.add(Math.max(1, value % 2_147_483_647)));
    } else {
      while (values.size < 4) {
        values.add(Math.floor(Math.random() * 2_147_483_646) + 1);
      }
    }
    while (values.size < 4) {
      values.add(Math.floor(Math.random() * 2_147_483_646) + 1);
    }
    setSeeds([...values]);
  };

  const SEED_LABELS = ["Seed 1", "Seed 2", "Seed 3", "Seed 4"];

  return (
    <div className="space-y-6 pt-4 border-t border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Key derivation mode */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-black flex items-center gap-2"><Key className="w-4 h-4" />Key derivation</p>
          <div className="space-y-2">
            {(["random", "pbkdf2", "hex"] as const).map(m => (
              <label key={m} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${keyMode === m ? "border-blue-500 bg-blue-50 text-black" : "border-gray-200 hover:border-blue-300 text-gray-500"}`}>
                <input type="radio" name="keymode" checked={keyMode === m} onChange={() => setKeyMode(m)} className="accent-blue-600" />
                {m === "random" ? "Random (4 seeds)" : m === "pbkdf2" ? "PBKDF2 passphrase" : "Paste hex key"}
              </label>
            ))}
          </div>
        </div>

        {/* Seed / passphrase / hex input */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-black">
            {keyMode === "random" ? "4 Encryption Seeds" : keyMode === "pbkdf2" ? "Passphrase" : "256-bit hex key"}
          </p>
          {keyMode === "pbkdf2" && (
            <div className="space-y-3">
              <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Enter passphrase…"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" />
              <div>
                <p className="text-sm text-gray-500 mb-1">Iterations: {pbkdf2Iter.toLocaleString()}</p>
                <input type="range" min={10000} max={500000} step={10000} value={pbkdf2Iter} onChange={e => setPbkdf2Iter(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
            </div>
          )}
          {keyMode === "hex" && (
            <div className="space-y-2">
              <textarea value={keyHexInput} onChange={e => setKeyHexInput(e.target.value)} placeholder="Paste 64-char hex key…" rows={2}
                className={`w-full px-3 py-2.5 text-xs font-mono rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-black ${keyHexInput && keyHexInput.trim().length !== 64 ? "border-red-400" : "border-gray-200"}`} />
              <p className={`text-sm ${keyHexInput.trim().length === 64 ? "text-emerald-600" : "text-gray-500"}`}>
                {keyHexInput.trim().length === 64 ? "✓ Valid 256-bit key" : `${keyHexInput.trim().length}/64 hex chars`}
              </p>
            </div>
          )}
          {keyMode === "random" && (
            <p className="text-xs text-gray-400">Same seeds → same keys (reproducible). Each seed generates an independent 256-bit key.</p>
          )}
        </div>

        {/* Deterministic + cipher info */}
        <div className="space-y-3">
          <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer text-sm transition-colors ${deterministic ? "border-blue-500 bg-blue-50 text-black" : "border-gray-200 hover:border-blue-300 text-gray-500"}`}>
            <input type="checkbox" checked={deterministic} onChange={e => setDeterministic(e.target.checked)} className="accent-blue-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Deterministic mode</p>
              <p className="text-xs mt-1 opacity-70">{deterministic ? "Same value → same output." : "Each encrypted cell gets a distinct keystream; decrypt with the same file settings."}</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer text-sm transition-colors ${strongDiffusion ? "border-emerald-500 bg-emerald-50 text-black" : "border-amber-400 bg-amber-50 text-black"}`}>
            <input type="checkbox" checked={strongDiffusion} onChange={e => setStrongDiffusion(e.target.checked)} className="accent-emerald-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Strong whole-value diffusion</p>
              <p className="text-xs mt-1 opacity-70">{strongDiffusion ? "A one-character change affects the complete anonymized value." : "Legacy compatibility only — use for files encrypted before strong diffusion."}</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer text-sm transition-colors ${alphanumeric ? "border-violet-500 bg-violet-50 text-black" : "border-gray-200 hover:border-violet-300 text-gray-500"}`}>
            <input type="checkbox" checked={alphanumeric} onChange={e => setAlphanumeric(e.target.checked)} className="accent-violet-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Alphanumeric output</p>
              <p className="text-xs mt-1 opacity-70">{alphanumeric ? "Output uses 0–9 + a–z + A–Z, same length as original." : "Output preserves original character class (digits stay digits, letters stay letters)."}</p>
            </div>
          </label>
          <div className="space-y-1 text-sm text-gray-500">
            {[["Cipher", "Custom FPE simulation"], ["Keys", "4 × 256-bit"], ["Rounds", "4-pass chain"], ["Stream", "xorshift128+"], ["Mode", deterministic ? "Deterministic" : "Per-cell"], ["Output", alphanumeric ? "Alphanumeric (0–9 a–z A–Z)" : "Preserves char class"]].map(([k, v]) => (
              <div key={k} className="flex gap-3"><span className="font-semibold text-black w-12 shrink-0">{k}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* 4 seed inputs — shown when keyMode === "random" */}
      {keyMode === "random" && (
        <div className="border border-blue-100 rounded-xl bg-blue-50/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">4-Round Encryption Chain</p>
            <span className="text-xs text-blue-500 ml-1 flex-1 min-w-[220px]">Value jumps: original → round 1 → round 2 → round 3 → round 4 = encrypted</span>
            <button
              type="button"
              onClick={randomizeSeeds}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap"
              title="Generate four new random encryption seeds"
            >
              <Shuffle className="w-3.5 h-3.5" />Randomize seeds
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SEED_LABELS.map((label, i) => (
              <div key={i} className="space-y-1.5">
                <label className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                  {label}
                </label>
                <input
                  type="number"
                  value={seeds[i] ?? 0}
                  onChange={e => setSeed(i, Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600">
            Each seed derives an independent 256-bit key. The encrypted output differs from the original after every round — the final value is guaranteed to be different from the source.
          </p>
        </div>
      )}
    </div>
  );
}

// ── ColSelector ───────────────────────────────────────────────────────────────

function ColSelector({ allCols, selected, onChange, label }: { allCols: string[]; selected: Set<string>; onChange: (s: Set<string>) => void; label: string }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim() ? allCols.filter(c => c.toLowerCase().includes(query.trim().toLowerCase())) : allCols;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-black">{label} <span className="font-normal text-gray-500">({selected.size}/{allCols.length})</span></span>
        <div className="flex gap-2">
          <button onClick={() => onChange(new Set(allCols))} className="text-sm px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-black transition-colors">Select all</button>
          <button onClick={() => onChange(new Set())} className="text-sm px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-black transition-colors">Clear</button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search columns…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-400" />
        {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No columns match "{query}"</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1 pt-1">
          {filtered.map(col => (
            <label key={col} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${selected.has(col) ? "border-blue-500 bg-blue-50 text-black" : "border-gray-200 hover:border-blue-300 text-gray-500 hover:text-black"}`}>
              <input type="checkbox" checked={selected.has(col)} onChange={e => { const n = new Set(selected); if (e.target.checked) n.add(col); else n.delete(col); onChange(n); }} className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate font-mono text-xs">{col}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function ProgressBar({ pct, label, icon }: { pct: number; label: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-500">
        <span className="flex items-center gap-2 min-w-0 truncate">{icon}{label}</span>
        <span className="flex-shrink-0 ml-2 font-semibold text-black">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-black rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-base font-semibold ${active ? "text-black" : done ? "text-emerald-700" : "text-gray-400"}`}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${active ? "bg-black text-white" : done ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : n}
      </span>
      {label}
    </div>
  );
}

function DropZone({ accept, multiple, icon, label, sublabel, inputRef, onFiles }: {
  accept: string; multiple?: boolean; icon: React.ReactNode; label: string; sublabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>; onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) onFiles(f); }}
      onClick={() => inputRef.current?.click()}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-base font-semibold text-black">{label}</p>
          <p className="text-sm text-gray-500 mt-1">{sublabel}</p>
        </div>
        <span className="text-sm px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-500 font-medium">Browse</span>
      </div>
    </div>
  );
}

function SuccessBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 font-medium">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{text}</span>
    </div>
  );
}

function InfoBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 font-medium">
      {icon}<span>{text}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-medium">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{message}
    </div>
  );
}

function Spin() {
  return <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin flex-shrink-0" />;
}

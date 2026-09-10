import {
  decryptCSVToBlob,
  decryptCSVFileToStream,
  encryptFWFToBlob,
  encryptFWFFileToStream,
  type AnonymizeOptions,
  type FieldSpec,
} from "../artifacts/csv-profiler/src/lib/anonymize.ts";

const fields: FieldSpec[] = [
  { varName: "A", start: 1, end: 5 },
  { varName: "B", start: 6, end: 10 },
  { varName: "C", start: 11, end: 15 },
];

const records = [
  ["17937", "Ab9-x", "xyZ!"],
  ["00001", "zz9-y", "ABC9"],
  ["12345", "A0a-!", "00000"],
  ["17937", "Ab9-x", "xyZ!"],
];
const raw = records.map((row) => row.join("")).join("\n");
const expected = `A,B,C\n${records.map((row) => row.join(",")).join("\n")}\n`;

async function roundTrip(options: AnonymizeOptions, mode: "all" | "subset") {
  const encryptedColumns = new Set(["A", "C"]);
  const encrypted = await encryptFWFToBlob(raw, fields, encryptedColumns, options, () => {});
  const encryptedText = await encrypted.blob.text();
  const selectedColumns = mode === "all" ? encryptedColumns : new Set(["C"]);
  const decrypted = await decryptCSVToBlob(encryptedText, selectedColumns, options, () => {});
  const decryptedText = await decrypted.text();
  return { encryptedText, decryptedText };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base: AnonymizeOptions = {
  keyMode: "random",
  seeds: [42, 137, 2024, 7],
  passphrase: "",
  pbkdf2Iterations: 100_000,
  deterministic: true,
};

const deterministic1 = await roundTrip(base, "all");
const deterministic2 = await roundTrip(base, "all");
assert(deterministic1.encryptedText === deterministic2.encryptedText, "deterministic output changed");
assert(deterministic1.decryptedText === expected, "deterministic round trip failed");
assert(!deterministic1.encryptedText.includes("AIRAVATA-"), "compact export contains metadata");
assert(!deterministic1.encryptedText.includes("HMAC"), "compact export contains an HMAC");
assert(
  deterministic1.encryptedText.split(/\r?\n/).every(line => !line.trimStart().startsWith("#")),
  "compact export contains a comment line"
);

const displayedSeedKeyExport = await encryptFWFToBlob(
  raw,
  fields,
  new Set(["A", "C"]),
  base,
  () => {},
);
const displayedSeedKeyDecrypt = await decryptCSVToBlob(
  await displayedSeedKeyExport.blob.text(),
  new Set(["A", "C"]),
  { ...base, keyMode: "hex", keyHex: displayedSeedKeyExport.keyHex },
  () => {},
);
assert(
  await displayedSeedKeyDecrypt.text() === expected,
  "displayed seed-derived key was not accepted for decryption",
);

const streamed = await encryptFWFFileToStream(
  new File([raw], "stream-sample.txt"),
  fields,
  new Set(["A", "C"]),
  base,
  () => {},
);
const streamReader = streamed.stream.getReader();
const streamChunks: Uint8Array[] = [];
try {
  while (true) {
    const next = await streamReader.read();
    if (next.done) break;
    streamChunks.push(next.value);
  }
} finally {
  streamReader.releaseLock();
}
const streamedText = new TextDecoder().decode(
  Buffer.concat(streamChunks.map(chunk => Buffer.from(chunk))),
);
assert(streamedText === deterministic1.encryptedText, "streaming output differs from compact export");

const streamedDecrypt = decryptCSVFileToStream(
  new File([streamedText], "streamed.csv"),
  new Set(["A", "C"]),
  base,
  () => {},
);
const decryptReader = streamedDecrypt.stream.getReader();
const decryptChunks: Uint8Array[] = [];
try {
  while (true) {
    const next = await decryptReader.read();
    if (next.done) break;
    decryptChunks.push(next.value);
  }
} finally {
  decryptReader.releaseLock();
}
const streamedDecryptedText = new TextDecoder().decode(
  Buffer.concat(decryptChunks.map(chunk => Buffer.from(chunk))),
);
assert(streamedDecryptedText === expected, "streaming decrypt round trip failed");

// Regression coverage for the large-file path: a compact export created by
// the in-memory encryptor must decrypt identically through the streaming
// decryptor, including the numeric values that previously exposed the fast
// inverse-round bug.
const regressionFields: FieldSpec[] = [
  { varName: "survey_name", start: 1, end: 4 },
  { varName: "year", start: 5, end: 8 },
  { varName: "fss_serial_no", start: 9, end: 13 },
];
const regressionRaw = "HCES202265556\n";
const regressionEncrypted = await encryptFWFToBlob(
  regressionRaw,
  regressionFields,
  new Set(["fss_serial_no"]),
  base,
  () => {},
);
const regressionEncryptedText = await regressionEncrypted.blob.text();
const regressionStreamDecrypt = decryptCSVFileToStream(
  new File([regressionEncryptedText], "regression.csv"),
  new Set(["fss_serial_no"]),
  base,
  () => {},
);
const regressionReader = regressionStreamDecrypt.stream.getReader();
const regressionChunks: Uint8Array[] = [];
try {
  while (true) {
    const next = await regressionReader.read();
    if (next.done) break;
    regressionChunks.push(next.value);
  }
} finally {
  regressionReader.releaseLock();
}
const regressionDecryptedText = new TextDecoder().decode(
  Buffer.concat(regressionChunks.map(chunk => Buffer.from(chunk))),
);
assert(
  regressionDecryptedText === "survey_name,year,fss_serial_no\nHCES,2022,65556\n",
  "numeric large-file decrypt regression failed",
);

// Whole-value diffusion regression: changing only the final plaintext digit
// must alter most of the ciphertext, while remaining exactly reversible.
const diffusionField: FieldSpec[] = [
  { varName: "fsu_serial_no", start: 1, end: 5 },
];
const diffusionRaw = "65556\n65553\n";
const diffusionEncrypted = await encryptFWFToBlob(
  diffusionRaw,
  diffusionField,
  new Set(["fsu_serial_no"]),
  base,
  () => {},
);
const diffusionText = await diffusionEncrypted.blob.text();
const [diffusionA, diffusionB] = diffusionText.trimEnd().split("\n").slice(1);
const changedPositions = [...diffusionA].filter((char, index) => char !== diffusionB[index]).length;
assert(
  changedPositions >= 3,
  `whole-value diffusion was too weak: ${diffusionA} vs ${diffusionB}`,
);
const diffusionDecrypted = await decryptCSVToBlob(
  diffusionText,
  new Set(["fsu_serial_no"]),
  base,
  () => {},
);
assert(
  await diffusionDecrypted.text() === "fsu_serial_no\n65556\n65553\n",
  "whole-value diffusion round trip failed",
);

const legacyDiffusionOptions: AnonymizeOptions = { ...base, strongDiffusion: false };
const legacyDiffusionEncrypted = await encryptFWFToBlob(
  diffusionRaw,
  diffusionField,
  new Set(["fsu_serial_no"]),
  legacyDiffusionOptions,
  () => {},
);
const legacyDiffusionDecrypted = await decryptCSVToBlob(
  await legacyDiffusionEncrypted.blob.text(),
  new Set(["fsu_serial_no"]),
  legacyDiffusionOptions,
  () => {},
);
assert(
  await legacyDiffusionDecrypted.text() === "fsu_serial_no\n65556\n65553\n",
  "legacy compact compatibility round trip failed",
);

const selective = await roundTrip({ ...base, deterministic: false }, "subset");
const selectiveLines = selective.decryptedText.trimEnd().split("\n");
assert(selectiveLines[0] === "A,B,C", "selective output header changed");
assert(selectiveLines.slice(1).every((line, index) => {
  const cells = line.split(",");
  return cells[0] !== records[index][0] && cells[1] === records[index][1] && cells[2] === records[index][2];
}), "selective non-deterministic decrypt did not restore the selected column");

const alphanumericOptions: AnonymizeOptions = {
  ...base,
  alphanumericOutput: true,
};
const alphanumericEncrypted = await encryptFWFToBlob(
  raw, fields, new Set(["A", "B", "C"]), alphanumericOptions, () => {}
);
const alphanumericDecrypted = await decryptCSVToBlob(
  await alphanumericEncrypted.blob.text(),
  new Set(["A", "B", "C"]),
  alphanumericOptions,
  () => {}
);
assert(
  await alphanumericDecrypted.text() === expected,
  "seed-keyed alphanumeric round trip failed"
);

const hexKey = "0123456789abcdef".repeat(4);
const hexOptions: AnonymizeOptions = { ...base, keyMode: "hex", keyHex: hexKey };
const hexEncrypted = await encryptFWFToBlob(raw, fields, new Set(["A", "B", "C"]), hexOptions, () => {});
assert(hexEncrypted.keyHex === hexKey, "hex mode did not return the supplied root key");
const hexDecrypted = await decryptCSVToBlob(await hexEncrypted.blob.text(), new Set(["A", "B", "C"]), hexOptions, () => {});
assert(await hexDecrypted.text() === expected, "hex-key round trip failed");

for (const invalid of [
  { ...base, keyMode: "pbkdf2" as const, passphrase: "" },
  { ...base, keyMode: "hex" as const, keyHex: "not-a-key" },
]) {
  let threw = false;
  try {
    await encryptFWFToBlob(raw, fields, new Set(["A"]), invalid, () => {});
  } catch {
    threw = true;
  }
  assert(threw, `invalid ${invalid.keyMode} settings were accepted`);
}

console.log("anonymize smoke test passed");

// ── Leading-zero-prevention tests ────────────────────────────────────────────
// Test that encrypt(x)[0] !== '0' for any x that starts with a non-zero digit,
// and that decrypt(encrypt(x)) === x for all test values across all 4 rounds.

// ── Smoke-test helpers ───────────────────────────────────────────────────────
//
// encryptFWFToBlob skips the first line if it contains a comma (CSV header
// detection).  To test values that include commas or other symbols, we always
// send TWO FWF lines:
//   Line 1 — all "A"s (no comma, treated as a data row, never read back)
//   Line 2 — "X" + test value  (two fields: ignored prefix "P" + test field "V")
// The CSV output therefore has a header row + 2 data rows; we read the SECOND
// data row (index 2 in the zero-based split).
// Decryption: deterministic mode means value identity drives the keystream, so
// re-encrypting in a single-row CSV always gives the same result.

const ANCHOR_CHAR = "A";
const PREFIX_CHAR = "X";

// RFC-4180 quote for embedding a value in a CSV cell.
function csvQuote(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

// Extract column `colIdx` (0-based) from a single CSV line, respecting quoting.
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let inQ = false, cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { cols.push(cur); cur = ""; }
    else if ((c === '\n' || c === '\r') && !inQ) break;
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

async function encryptSingleValue(value: string, options: AnonymizeOptions): Promise<string> {
  const width = 1 + value.length; // prefix char + value chars
  const anchor = ANCHOR_CHAR.repeat(width); // all "A"s — no comma, no trim issue
  const dataLine = PREFIX_CHAR + value;
  const fields: FieldSpec[] = [
    { varName: "P", start: 1, end: 1 },
    { varName: "V", start: 2, end: width },
  ];
  const result = await encryptFWFToBlob(anchor + "\n" + dataLine, fields, new Set(["V"]), options, () => {});
  const csvText = await result.blob.text();
  // Read the second data row after the simple CSV header.
  const lines = csvText.trimEnd().split("\n").filter(line => line.trim());
  return (parseCsvLine(lines[2] ?? "")[1]) ?? "";
}

async function decryptSingleValue(encrypted: string, options: AnonymizeOptions): Promise<string> {
  // Deterministic mode: value → keystream is independent of row position.
  // Use the same two-row layout (anchor + test row) so the row index is consistent.
  const width = 1 + encrypted.length;
  const anchorEnc = ANCHOR_CHAR.repeat(width); // anchor row V col is "AAA..." — decrypts to itself
  const csvText = [
    "P,V",
    `${PREFIX_CHAR},${csvQuote(anchorEnc)}`,
    `${PREFIX_CHAR},${csvQuote(encrypted)}`,
    "",
  ].join("\n");
  const result = await decryptCSVToBlob(csvText, new Set(["V"]), options, () => {});
  const text = await result.text();
  const lines = text.trimEnd().split("\n");
  return (parseCsvLine(lines[2] ?? "")[1]) ?? "";
}

const testValues = [
  "12345",
  "65556",
  "10000",
  "99999",
  "50001",
  "11111",
  "987654321",
];

// Verify with multiple seed sets and both key modes
for (const opts of [
  base,
  { ...base, seeds: [1, 2, 3, 4] },
  { ...base, seeds: [999, 1, 0, 42] },
]) {
  for (const v of testValues) {
    const enc = await encryptSingleValue(v, opts);
    assert(enc.length === v.length, `length changed: "${v}" → "${enc}"`);
    assert(enc[0] !== "0", `leading zero in encrypted output: "${v}" → "${enc}"`);
    const dec = await decryptSingleValue(enc, opts);
    assert(dec === v, `round-trip failed: "${v}" → enc="${enc}" → dec="${dec}"`);
  }
}

// Leading-zero source values: encrypt should not corrupt them
const leadingZeroValues = ["01234", "00001", "00000", "09999"];
for (const v of leadingZeroValues) {
  const enc = await encryptSingleValue(v, base);
  assert(enc.length === v.length, `length changed for leading-zero value: "${v}" → "${enc}"`);
  const dec = await decryptSingleValue(enc, base);
  assert(dec === v, `round-trip failed for leading-zero value: "${v}" → enc="${enc}" → dec="${dec}"`);
}

console.log("leading-zero-prevention tests passed");

// ── Symbol encryption tests ──────────────────────────────────────────────────
// Every printable keyboard symbol must round-trip and must map to another symbol.

const SYMBOL_CHARS = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

// Values containing only symbols.
// Note: encryptFWFToBlob trims field values (FWF padding convention), so values
// with leading/trailing spaces cannot be round-tripped through that API.
// We test space embedded inside mixed values instead.
const symbolOnlyValues = ['@', '!@#', '$%^&*', '()', '+-=', '/\\', '.:;', '|{}~'];
// Mixed values (symbols + alphanumeric) — also covers space in non-leading position
const mixedValues = ['Ab9-x', 'xy@Z!', 'A0a-!', '#foo1', 'test@123', 'a b c', '1+2=3'];
// All 33 symbols except leading/trailing space (32 chars — space is covered by mixedValues above)
const allSymbols = SYMBOL_CHARS.trim(); // '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

for (const v of [...symbolOnlyValues, ...mixedValues, allSymbols]) {
  const enc = await encryptSingleValue(v, base);
  assert(enc.length === v.length, `symbol test length changed: "${v}" → "${enc}"`);
  // Every char that was a symbol must still be a symbol
  for (let i = 0; i < v.length; i++) {
    const origIsSymbol = SYMBOL_CHARS.includes(v[i]);
    const encIsSymbol  = SYMBOL_CHARS.includes(enc[i]);
    assert(origIsSymbol === encIsSymbol,
      `character class changed at position ${i}: "${v[i]}" → "${enc[i]}" in "${v}" → "${enc}"`);
  }
  const dec = await decryptSingleValue(enc, base);
  assert(dec === v, `symbol round-trip failed: "${v}" → enc="${enc}" → dec="${dec}"`);
}

console.log("symbol encryption tests passed");

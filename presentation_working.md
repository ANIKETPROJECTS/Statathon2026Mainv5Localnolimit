# AIRAVATA DEA — Complete Software Working

## Presentation purpose

This document is a complete source document for creating a presentation about AIRAVATA DEA.

The recommended presentation order is:

1. What the software is and who it helps
2. Frontend: what the user sees and does
3. File conversion journey
4. Anonymisation and decryption journey
5. Risk assessment journey
6. Backend and processing architecture
7. Detailed mathematical and technical logic
8. A complete layman example
9. Benefits, limitations, and security boundaries

The language below is intentionally simple enough for a non-technical audience, while retaining the exact techniques and formulas used by the application.

---

# Part 1 — What AIRAVATA DEA is

## 1.1 Simple description

AIRAVATA DEA is a data preparation, anonymisation, decryption, and privacy-risk assessment application.

It is designed for datasets that may be stored in:

- Fixed-width text files
- CSV files
- Excel layout files

The application helps a user transform a difficult-to-read fixed-width file into a structured CSV, protect selected values, and check whether people could still be identified from the protected dataset.

## 1.2 The problem it solves

Many older government, research, financial, and statistical systems store records in fixed-width format.

A fixed-width record may look like this:

```text
00012345ANIKET              411001M20240101
```

Without a layout description, it is not obvious where one field ends and the next begins.

AIRAVATA DEA uses a layout file to understand the positions:

```text
Positions 1–8   = Customer ID
Positions 9–30  = Name
Positions 31–36 = Postcode
Positions 37–42 = Gender and date information
```

After reading the layout, the software can produce:

```csv
customer_id,name,postcode,gender
00012345,ANIKET,411001,M
```

It can then anonymise only the columns selected by the user.

## 1.3 Main outcomes

The application can produce:

- A converted CSV
- An anonymised CSV
- A decrypted CSV
- A side-by-side comparison
- Original-file risk results
- Anonymised-file risk results
- A comparison of privacy improvement
- Downloadable analysis reports

---

# Part 2 — Frontend presentation flow

## 2.1 Frontend technology

The visible application is built with:

- **React** — user-interface component framework
- **TypeScript** — typed JavaScript used for application logic
- **Vite** — development server and production build tool
- **Tailwind CSS** — utility-based styling system
- **Wouter** — lightweight client-side routing
- **Lucide React** — interface icons
- **Recharts** — charts used in risk assessment
- **Electron** — desktop wrapper for Windows, macOS, and Linux

The frontend can run in two ways:

### Browser/development mode

The browser loads the Vite development URL, normally:

```text
http://localhost:5000
```

### Desktop/packaged mode

Electron opens a native application window and loads the compiled frontend from local files.

The packaged application does not depend on the development Vite server.

## 2.2 Main application shell

The application shell contains:

1. AIRAVATA DEA branding
2. Alphanumeric-output toggle
3. Info button
4. Risk Assessment navigation
5. Original File navigation
6. Anonymized File navigation
7. Comparison navigation
8. Main page content area

The header remains available while the user moves between pages.

## 2.3 Frontend route structure

The frontend uses these main routes:

| Route | Purpose |
|---|---|
| `/` | Main fixed-width conversion and anonymisation workspace |
| `/fwf` | Alternate route to the fixed-width workspace |
| `/info` | Interactive explanation and mathematical reference |
| `/risk-assessment/original` | Risk analysis for original data |
| `/risk-assessment/anonymized` | Risk analysis for anonymised data |
| `/risk-assessment/comparison` | Original-versus-anonymised comparison |
| `/risk-assessment` | Risk assessment landing page |

The packaged Electron app uses hash-style navigation for local `file://` routing. This prevents the physical `index.html` path from being mistaken for an application route.

## 2.4 Main workspace screen

The main workspace is divided into three conceptual steps.

### Step 1 — Upload layouts

The left panel allows the user to upload:

- Excel layout files
- CSV layout files
- Multiple layout files

The screen shows:

- Drag-and-drop area
- Browse button
- Add layout button
- Parsed field definitions
- Sheet selection when an Excel workbook has multiple sheets
- Warnings when fields cannot be detected

### Step 2 — Upload data files

The right panel allows the user to upload:

- `.txt`
- `.dat`
- `.fwf`
- `.data`

These are fixed-width data files. Each uploaded file is assigned to one of the parsed layouts.

### Step 3 — Process and download

After a layout and data file are available, the user can:

- Preview records
- Choose the columns to anonymise
- Choose encryption mode
- Choose key settings
- Run anonymisation
- Download the original converted CSV
- Download the anonymised CSV
- Open a comparison view

## 2.5 File selection and preview

The frontend uses normal browser file APIs:

- `File`
- `FileReader`-style text reading through `file.text()`
- `file.arrayBuffer()` for Excel workbooks
- `Blob` for generated output
- `URL.createObjectURL()` for downloads

The software processes large files, but it does not render millions of rows in the UI at once.

This distinction is important:

```text
Processing capacity ≠ preview rendering capacity
```

The preview is intentionally limited to protect the interface from freezing.

## 2.6 Progress indicators

During long operations, the interface displays:

- Current operation
- Percentage complete
- Selected column count
- Loading animations
- Success and error messages

The processing logic yields control back to the browser after each chunk so React can repaint the screen.

## 2.7 Info section

The Info page is a built-in educational reference.

It contains:

1. Interactive Guide
2. Seed → Key Generation
3. Format-Preserving Encryption
4. 4-Round Chain
5. k-Anonymity and Link Score
6. l-Diversity
7. t-Closeness
8. Re-identification Risk and Metrics

This page is useful for presentation screenshots because it explains the system from simple concepts to exact formulas.

## 2.8 Risk assessment screens

The risk assessment interface has separate views for:

- Original File
- Anonymized File
- Comparison

The user uploads a CSV and selects:

- Quasi-identifiers
- Sensitive attributes
- Minimum `k` threshold
- Minimum `l` threshold
- Maximum `t` threshold
- Optional sample percentage

The screen then displays:

- Risk badge
- Re-identification percentage
- Minimum equivalence-class size
- Average equivalence-class size
- Unique records
- At-risk records
- Protected records
- Risk charts
- Vulnerable record list
- L-diversity status
- T-closeness status
- Recommendations

## 2.9 Comparison screen

The comparison screen answers:

> Did anonymisation actually improve the privacy profile?

It compares:

- Original re-identification risk
- Anonymised re-identification risk
- Original and anonymised high-risk rates
- Minimum group size
- Column changes
- Suppressed columns
- Added columns
- Changed cell values
- Preserved cell values

Changed cells are highlighted by comparing aligned original and anonymised records.

AIRAVATA metadata rows beginning with `#` are skipped so they do not appear as ordinary data rows.

---

# Part 3 — Frontend user journey with a simple example

## 3.1 Example input

Assume a data provider has this fixed-width record:

```text
00001234ANIKET SHARMA       411001M
```

The layout file says:

| Field | Start | End |
|---|---:|---:|
| Customer ID | 1 | 8 |
| Name | 9 | 30 |
| Postcode | 31 | 36 |
| Gender | 37 | 37 |

The frontend extracts:

```text
Customer ID = 00001234
Name        = ANIKET SHARMA
Postcode    = 411001
Gender      = M
```

It creates a CSV row:

```csv
customer_id,name,postcode,gender
00001234,ANIKET SHARMA,411001,M
```

The user may select:

```text
Name
Postcode
```

The application leaves `Customer ID` and `Gender` unchanged unless the user selects them.

## 3.2 What the user sees

The user does not need to understand byte slicing or keystream generation to use the screen.

The visible flow is:

```text
Upload layout
    ↓
Upload data
    ↓
Assign layout
    ↓
Choose columns
    ↓
Choose key settings
    ↓
Apply anonymisation
    ↓
Preview and download
    ↓
Run risk assessment
```

---

# Part 4 — Data parsing and fixed-width conversion logic

## 4.1 Layout header detection

The parser normalises header names by:

1. Converting text to lowercase.
2. Removing punctuation and spaces.
3. Comparing the result with known aliases.

For example:

```text
"Field Name"        → "fieldname"
"FIELD_NAME"        → "fieldname"
"Variable"          → "variable"
"Byte Position End" → "bytepositionend"
```

The parser recognises aliases such as:

- `Field_Name`
- `FieldName`
- `Variable`
- `ColumnName`
- `Start`
- `StartByte`
- `From`
- `End`
- `EndByte`
- `To`
- `Length`
- `Width`

## 4.2 Field position calculation

If start and end positions exist:

```text
field length = end − start + 1
```

Example:

```text
start = 11
end   = 20

length = 20 − 11 + 1
       = 10 characters
```

If start and length exist but end is missing:

```text
end = start + length − 1
```

Example:

```text
start  = 11
length = 10

end = 11 + 10 − 1
   = 20
```

## 4.3 Extracting a fixed-width field

The application uses 1-indexed layout positions but converts them to JavaScript's 0-indexed string positions:

```text
JavaScript start index = layout start − 1
```

The extracted range is:

```text
line.substring(start − 1, end)
```

Example:

```text
layout start = 11
layout end   = 20

substring(10, 20)
```

If a line is shorter than the requested end position, the line is padded with spaces first.

## 4.4 CSV escaping

If a value contains:

- A comma
- A double quote
- A newline

the value is enclosed in double quotes.

Existing double quotes are doubled.

Example:

```text
Original value:  Smith, Aniket
CSV value:      "Smith, Aniket"
```

For a value containing a quote:

```text
Original value:  He said "yes"
CSV value:      "He said ""yes"""
```

---

# Part 5 — Anonymisation logic

## 5.1 Technique names used

The current anonymisation implementation uses these named techniques:

- Custom format-preserving encryption
- Four-round transformation chain
- Xorshift-style pseudo-random keystream
- Per-column IV hashing
- Per-value nonce derivation
- Deterministic encryption mode
- Non-deterministic cell-counter mode
- CBC-style character diffusion
- Modular arithmetic
- Modular multiplicative inverses
- Coprime multiplier selection
- Cryptographically secure random salt generation
- Web Crypto PBKDF2 with HMAC-SHA-256
- HKDF-SHA-256 key derivation for HMAC
- HMAC-SHA-256 integrity verification
- SHA-256 key fingerprinting
- Chunked processing
- Format-preserving character-class handling

The algorithm is custom. It should not be described as AES-GCM or as a formally audited replacement for an established cryptographic library.

## 5.2 Column-selective behaviour

Only selected columns are changed.

For each field:

```text
if field is not selected:
    copy value unchanged

if field is selected and value is not empty:
    anonymise value
```

This allows an analyst to protect names, postcodes, IDs, or other fields without changing every column.

## 5.3 Format preservation

The four main rounds use separate alphabets:

| Character type | Alphabet |
|---|---|
| Digits | `0123456789` |
| Uppercase letters | `A–Z` |
| Lowercase letters | `a–z` |
| Printable symbols | Printable ASCII symbols |

Therefore:

```text
Input:  AB-123
Output: QX-804
```

The exact characters change, but:

- Length remains 6.
- Uppercase letters remain uppercase letters.
- The hyphen remains a symbol.
- Digits remain digits.

## 5.4 Five micro-operations per character

Each character consumes five keystream bytes.

For every byte `k`:

```text
operation = k mod 4
```

The operation is one of:

```text
0 = Add
1 = Subtract
2 = Multiply
3 = Flip
```

### Add

```text
v_new = (v_old + amount) mod S
```

### Subtract

```text
v_new = (v_old − amount) mod S
```

### Multiply

```text
v_new = (v_old × multiplier) mod S
```

The multiplier is selected from values coprime with `S`.

### Flip

```text
v_new = S − 1 − v_old
```

Here:

- `v` is the character's numeric index.
- `S` is alphabet size.
- `mod` keeps the answer inside the alphabet.

## 5.5 Modular arithmetic example

Suppose the alphabet is digits:

```text
S = 10
```

and the current digit index is:

```text
v = 7
```

If the operation is Add with amount `4`:

```text
v_new = (7 + 4) mod 10
      = 11 mod 10
      = 1
```

So digit `7` becomes digit `1`.

For subtraction:

```text
v_new = (1 − 4) mod 10
      = −3 mod 10
      = 7
```

The implementation normalises negative modulo results back into the alphabet range.

## 5.6 Modular inverse example

Suppose:

```text
S = 10
multiplier = 3
```

The modular inverse of 3 modulo 10 is 7 because:

```text
3 × 7 = 21
21 mod 10 = 1
```

Therefore, multiplication by 3 can be undone by multiplication by 7:

```text
(v × 3 mod 10) × 7 mod 10 = v
```

This is why the multiplier must be coprime with the alphabet size.

## 5.7 Four-round chain

One value passes through four derived round keys:

```text
v₀ = original value
v₁ = FPE(v₀, key 1)
v₂ = FPE(v₁, key 2)
v₃ = FPE(v₂, key 3)
v₄ = FPE(v₃, key 4)

encrypted value = v₄
```

Decryption reverses the order:

```text
v₃ = inverse FPE(v₄, key 4)
v₂ = inverse FPE(v₃, key 3)
v₁ = inverse FPE(v₂, key 2)
v₀ = inverse FPE(v₁, key 1)
```

## 5.8 Seed-to-key generation

The seed mode starts with four ordered numbers.

Example:

```text
s₁ = 42
s₂ = 137
s₃ = 2024
s₄ = 7
```

The four seeds are mixed sequentially into a 32-bit rolling value.

Initial value:

```text
rolling₀ = 0x9E3779B9
```

For each seed:

```text
rolling = (rolling × 0x9E3779B9) XOR seed
rolling = rolling XOR (rolling >>> 16)
rolling = rolling × 0x85EBCA6B
rolling = rolling XOR (rolling >>> 13)
```

The final rolling value is the master seed.

Changing the order changes the result:

```text
[42, 137, 2024, 7] ≠ [137, 42, 2024, 7]
```

The master seed is expanded into a 256-bit master key, then four round keys are derived.

## 5.9 Xorshift-style keystream

Each key produces a repeatable pseudo-random stream.

The generator maintains two 32-bit values, `a` and `b`.

The state is updated using XOR and bit shifts:

```text
a = a XOR (a << 13)
a = a XOR (a >> 17)
a = a XOR (a << 5)

b = b XOR (b >> 7)
b = b XOR (b << 9)
b = b XOR (b >> 8)
```

The output is:

```text
output = ((a + b) >>> 0) / 2³²
```

The output is converted to a byte:

```text
byte = floor(output × 256)
```

The same inputs recreate the same stream, which is required for decryption.

## 5.10 Passphrase mode

In current v2 mode, passphrase mode uses:

- Web Crypto API
- PBKDF2
- HMAC-SHA-256
- A minimum of 100,000 iterations
- Export salt
- A separate round tag for each round

The purpose of PBKDF2 is key stretching: it makes repeated password guesses more expensive.

The passphrase is not used directly as the encryption stream. It is converted into derived 256-bit key material.

## 5.11 Raw hexadecimal key mode

The user may provide exactly 64 hexadecimal characters:

```text
64 hexadecimal characters = 256 bits
```

The application rejects a value that is:

- Too short
- Too long
- Contains non-hexadecimal characters

The validated input is used to derive the four round keys.

## 5.12 Export salt

Every v2 export receives 16 random bytes:

```text
16 bytes = 128 bits = 32 hexadecimal characters
```

The salt is created using:

```text
crypto.getRandomValues()
```

It is stored in the file metadata:

```text
# AIRAVATA-EXPORT-SALT: ...
```

The salt does not replace the key and does not need to be secret.

Its purpose is to make separate exports different even when the same key settings are reused.

## 5.13 Deterministic mode

Deterministic mode means:

```text
same column + same plaintext value
→ same anonymised value within the export
```

This is useful when repeated values need to remain linkable.

Example:

```text
Original:
London
London
Paris

Deterministic output:
Xkqvpm
Xkqvpm
Rjvtds
```

The equality pattern is preserved.

This is useful for counting or grouping, but it reveals that two values were equal.

## 5.14 Non-deterministic mode

Non-deterministic mode assigns a counter to each cell.

The counter is combined with:

- Column seed
- Round number
- Export salt

Example:

```text
Original:
London
London

Non-deterministic output:
Xkqvpm
Qzabtr
```

This hides repeated-value equality better, but it prevents simple grouping of repeated anonymised values.

## 5.15 Per-column derivation

The column name becomes part of the column IV hash.

Conceptually:

```text
columnIV = Hash(key prefix + "COL" + column name)
```

Therefore:

```text
Name + "ANIKET"
```

does not use the same derived stream as:

```text
Address + "ANIKET"
```

This separates columns during derivation.

## 5.16 Per-value nonce derivation

In deterministic v2 mode, the value itself is included in nonce derivation.

Conceptually:

```text
valueNonce = Hash(columnIV + value + value length)
```

This means different values do not automatically use one shared keystream.

## 5.17 CBC-style diffusion

The v2 transformation maintains an 8-bit chaining value called `cbc`.

Initially:

```text
cbc = 0
```

For every one of the five operations, the current chaining state is rotated:

```text
effectiveByte =
rawByte XOR rotateLeft(cbc, operationPosition)
```

After the character:

```text
cbc =
  ((cbc << 3)
   XOR encryptedCharacterCode
   XOR rawFifthKeystreamByte)
  AND 255
```

This means a previous character influences the next character's operation choices.

The raw fifth keystream byte is included so the chain depends on secret-derived material as well as visible ciphertext.

## 5.18 Optional alphanumeric output

The optional alphanumeric mode uses:

```text
0123456789abcdefghijklmnopqrstuvwxyz
```

It is a fifth output-format pass after the four primary rounds.

It is intended to produce identifiers containing only lowercase letters and digits while preserving length.

The fifth-pass key depends on:

- Four round keys
- Export salt

The current implementation should be validated carefully for full encrypt/decrypt round trips when this optional mode is enabled, because the current decryption path reverses the four primary rounds but does not contain a separate inverse alphanumeric remapping function.

---

# Part 6 — Decryption logic

## 6.1 What is required

To decrypt successfully, the user needs:

- The anonymised CSV
- The correct key mode
- The original seed sequence, passphrase, or raw hex key
- The correct encrypted columns
- Compatible deterministic settings

For v2 files, the export salt is read automatically from the file metadata.

## 6.2 HMAC check before decryption

The application first verifies the integrity tag.

The HMAC covers the output content except the HMAC line itself.

The HMAC key is derived using:

- Key chain
- Export salt
- HKDF-SHA-256
- HMAC-SHA-256

If the file has been modified or the wrong key is used, the HMAC fails.

The application stops before decrypting values.

This prevents the software from silently producing corrupted output.

## 6.3 v2 metadata parsing

The decryption process scans the initial comment block for:

```text
# AIRAVATA-FORMAT: v2
# AIRAVATA-EXPORT-SALT: ...
```

It searches the end of the file for:

```text
# AIRAVATA-HMAC-SHA256: ...
```

The actual CSV header is the first non-comment line after the metadata block.

## 6.4 Reverse four-round process

For each selected encrypted cell:

1. Recreate the same round keys.
2. Recreate the same per-cell keystream.
3. Recreate the CBC state.
4. Reverse round 4.
5. Reverse round 3.
6. Reverse round 2.
7. Reverse round 1.
8. Write the restored value.

The inverse rules are:

```text
Add       → Subtract
Subtract  → Add
Multiply  → Multiply by modular inverse
Flip      → Flip
```

## 6.5 v1 legacy files

Files without the v2 format marker are treated as legacy v1 files.

The v1 path preserves the earlier:

- Key derivation
- Column-level stream behaviour
- Four-round transformation
- Legacy passphrase construction

This allows older exports to remain readable.

---

# Part 7 — Risk assessment logic

## 7.1 What the risk assessment simulates

The risk assessment simulates a “prosecutor attack”.

The imagined attacker:

1. Knows that a target person is in the dataset.
2. Has access to external information.
3. Uses quasi-identifiers to narrow down the target.

For example, an attacker may know:

```text
Age = 42
Postcode = 411001
Gender = Female
```

The software asks:

> How many records have exactly this same combination?

## 7.2 Quasi-identifiers

Quasi-identifiers are selected columns that can help identify a person when combined.

Example:

| Record | Age | Postcode | Gender |
|---|---:|---|---|
| A | 42 | 411001 | F |
| B | 42 | 411001 | F |
| C | 42 | 411001 | F |
| D | 63 | 411001 | M |

The combination `(42, 411001, F)` identifies an equivalence class of size 3.

## 7.3 Equivalence class construction

Every row is assigned a key:

```text
EC key =
QI₁ value + "|" + QI₂ value + "|" + QI₃ value
```

Example:

```text
42|411001|F
```

All rows with the same key are placed in the same equivalence class.

Mathematically:

```text
EC(r) =
{ r' in Dataset :
  r'[QI₁] = r[QI₁]
  AND r'[QI₂] = r[QI₂]
  AND ...
}
```

## 7.4 k-anonymity

A dataset satisfies k-anonymity when every equivalence class contains at least `k` records.

Formula:

```text
k = minimum equivalence-class size
```

For a configured threshold:

```text
record is protected if EC size ≥ k_threshold
record is at risk if EC size < k_threshold
```

The default threshold is:

```text
k_threshold = 5
```

## 7.5 Layman k-anonymity example

Suppose the selected quasi-identifiers create these groups:

```text
Group 1 = 1 record
Group 2 = 2 records
Group 3 = 5 records
Group 4 = 10 records
```

With `k = 5`:

- Group 1 fails
- Group 2 fails
- Group 3 passes
- Group 4 passes

The smallest group determines the dataset's minimum k:

```text
minK = 1
```

Even if most records are safe, one singleton group remains a major vulnerability.

## 7.6 Link score

For a record in an equivalence class of size `m`:

```text
LinkScore = 1 / m
```

Examples:

| Equivalence class size | Link score | Meaning |
|---:|---:|---|
| 1 | 1.000 | Certain match |
| 2 | 0.500 | 50% chance |
| 5 | 0.200 | 20% chance |
| 20 | 0.050 | 5% chance |

The smaller the group, the higher the risk.

## 7.7 Overall re-identification risk

The application averages all record link scores:

```text
ReIDRisk =
  (1 / N) × sum(LinkScore(record))
```

Substituting the link-score formula:

```text
ReIDRisk =
  (1 / N) × sum(1 / EC size)
```

Because every record in one equivalence class has the same link score:

```text
class contribution =
  class size × (1 / class size)
  = 1
```

Therefore:

```text
ReIDRisk =
  number of equivalence classes / number of records
```

This is an important implementation result.

### Example

Suppose there are 100 records and 20 distinct equivalence classes:

```text
ReIDRisk = 20 / 100
         = 0.20
         = 20%
```

## 7.8 Risk levels

The application classifies risk as:

| Re-ID risk | Level |
|---:|---|
| `≥ 0.70` | CRITICAL |
| `≥ 0.50` | HIGH |
| `≥ 0.30` | MEDIUM |
| `< 0.30` | LOW |

These labels are presentation categories. A LOW label does not mean zero risk.

## 7.9 Uniqueness rate

The implementation calculates:

```text
UniquenessRate =
number of singleton equivalence classes / N
```

A singleton is an equivalence class containing exactly one record.

Example:

```text
5 singleton records / 100 total records
= 0.05
= 5%
```

## 7.10 High-risk rate

The high-risk rate counts records below the selected k threshold:

```text
HighRiskRate =
number of records where EC size < k_threshold
/ N
```

Example:

```text
18 records belong to groups smaller than 5
N = 100

HighRiskRate = 18 / 100
             = 18%
```

## 7.11 Average equivalence-class size

The application calculates:

```text
AvgECSize = N / number of equivalence classes
```

Example:

```text
N = 100
number of equivalence classes = 20

AvgECSize = 100 / 20
          = 5
```

## 7.12 Risk histogram

Equivalence classes are grouped into display buckets:

- `1 (Unique)`
- `2–4`
- `5–10`
- `11–20`
- `>20`

The chart shows how many records fall in each group-size range.

## 7.13 Link-score distribution

The interface also groups records by link score:

- `1.00 (certain)`
- `0.51–0.99 (high)`
- `0.26–0.50 (medium)`
- `0.01–0.25 (low)`
- `0.00 (safe)`

This converts a mathematical score into an easy-to-read risk distribution.

## 7.14 Top vulnerable records

The application sorts records by descending link score:

```text
highest link score first
```

It displays the top ten vulnerable records.

Reasons include:

- `Singleton — no look-alike`
- `EC size X < k=Y`

## 7.15 l-diversity

k-anonymity can still expose a sensitive attribute if every member of a group has the same sensitive value.

Example:

```text
Equivalence class:
5 people
5 people all have disease = diabetes
```

The group has k-anonymity of 5 but provides almost no sensitive-value diversity.

For a sensitive attribute `SA`, the software counts distinct values inside each equivalence class:

```text
distinctSA(EC)
```

An equivalence class passes if:

```text
distinctSA(EC) ≥ l_threshold
```

Default:

```text
l_threshold = 3
```

### l-diversity example

Suppose an equivalence class contains:

```text
Diabetes
Asthma
Healthy
Diabetes
```

The distinct values are:

```text
{Diabetes, Asthma, Healthy}
```

Therefore:

```text
l = 3
```

It passes an `l = 3` requirement.

Another group containing only:

```text
Diabetes
Diabetes
Diabetes
Diabetes
```

has:

```text
l = 1
```

It fails.

## 7.16 l-diversity metrics

For each sensitive attribute, the software calculates:

```text
minL =
minimum number of distinct sensitive values across all groups
```

It also calculates:

```text
ViolatingECs =
number of groups where distinctSA < l_threshold
```

And:

```text
ViolatingRecordPct =
records in violating groups / N × 100
```

The status is:

```text
PASS if ViolatingECs = 0
FAIL otherwise
```

## 7.17 t-closeness

l-diversity counts distinct values, but it does not check whether the values are distributed fairly.

Example:

Global dataset:

```text
Diabetes = 50%
Asthma   = 30%
Healthy  = 20%
```

One equivalence class:

```text
Diabetes = 100%
Asthma   = 0%
Healthy  = 0%
```

The group has more than one possible value only if there are at least two values, but its distribution may still be very different from the overall dataset.

t-closeness measures this distribution gap.

## 7.18 Global distribution

For a sensitive value `v`:

```text
P_global(v) =
count of v in complete dataset / N
```

Example:

```text
Diabetes count = 50
N = 100

P_global(Diabetes) = 50 / 100 = 0.50
```

## 7.19 Local distribution

Inside an equivalence class:

```text
P_local(v, EC) =
count of v in EC / size of EC
```

Example:

```text
Diabetes count in EC = 4
EC size = 5

P_local(Diabetes, EC) = 4 / 5 = 0.80
```

## 7.20 Total Variation Distance

The software uses **Total Variation Distance**, also called TVD.

Formula:

```text
TVD =
0.5 × sum over all values v of
absolute(P_local(v) − P_global(v))
```

### Complete example

Global distribution:

```text
Diabetes = 0.50
Asthma   = 0.30
Healthy  = 0.20
```

Local equivalence-class distribution:

```text
Diabetes = 0.80
Asthma   = 0.20
Healthy  = 0.00
```

Absolute differences:

```text
|0.80 − 0.50| = 0.30
|0.20 − 0.30| = 0.10
|0.00 − 0.20| = 0.20
```

Sum:

```text
0.30 + 0.10 + 0.20 = 0.60
```

TVD:

```text
TVD = 0.5 × 0.60
    = 0.30
```

With:

```text
t_threshold = 0.20
```

the group fails because:

```text
0.30 > 0.20
```

## 7.21 t-closeness result

For each sensitive attribute, the software records:

- Maximum TVD across all equivalence classes
- Number of violating equivalence classes
- Total equivalence classes
- PASS or FAIL status

The criterion is:

```text
PASS if every EC has TVD ≤ t_threshold
FAIL if any EC has TVD > t_threshold
```

---

# Part 8 — Complete end-to-end example

## 8.1 Input records

Suppose a dataset contains:

| Person | Age | Postcode | Gender | Condition |
|---|---:|---|---|---|
| A | 40 | 411001 | F | Diabetes |
| B | 40 | 411001 | F | Asthma |
| C | 40 | 411001 | F | Healthy |
| D | 40 | 411001 | F | Diabetes |
| E | 55 | 411002 | M | Diabetes |
| F | 55 | 411002 | M | Diabetes |
| G | 70 | 411003 | F | Healthy |

The user chooses:

```text
Quasi-identifiers = Age, Postcode, Gender
Sensitive attribute = Condition
k_threshold = 3
l_threshold = 3
t_threshold = 0.20
```

## 8.2 Equivalence classes

Group 1:

```text
(40, 411001, F)
```

Contains A, B, C, D:

```text
EC size = 4
```

Group 2:

```text
(55, 411002, M)
```

Contains E, F:

```text
EC size = 2
```

Group 3:

```text
(70, 411003, F)
```

Contains G:

```text
EC size = 1
```

## 8.3 k-anonymity outcome

The minimum group size is:

```text
minK = 1
```

With `k_threshold = 3`:

- Group 1 passes because `4 ≥ 3`
- Group 2 fails because `2 < 3`
- Group 3 fails because `1 < 3`

At-risk records:

```text
2 + 1 = 3
```

Total records:

```text
N = 7
```

High-risk rate:

```text
HighRiskRate = 3 / 7
                = 0.4286
                = 42.86%
```

## 8.4 Link scores

Group 1:

```text
LinkScore = 1 / 4 = 0.25
```

Group 2:

```text
LinkScore = 1 / 2 = 0.50
```

Group 3:

```text
LinkScore = 1 / 1 = 1.00
```

Overall Re-ID risk:

```text
(4 × 0.25 + 2 × 0.50 + 1 × 1.00) / 7

= (1.00 + 1.00 + 1.00) / 7
= 3 / 7
= 0.4286
= 42.86%
```

Equivalent shortcut:

```text
number of ECs / N
= 3 / 7
= 42.86%
```

Risk level:

```text
42.86% ≥ 30%
```

Therefore the application labels it:

```text
MEDIUM
```

## 8.5 l-diversity outcome

Group 1 condition values:

```text
Diabetes, Asthma, Healthy, Diabetes
```

Distinct values:

```text
3
```

Group 2:

```text
Diabetes, Diabetes
```

Distinct values:

```text
1
```

Group 3:

```text
Healthy
```

Distinct values:

```text
1
```

With `l_threshold = 3`, Groups 2 and 3 fail.

## 8.6 What the recommendation means

The software may recommend:

- Suppressing singleton records
- Generalising postcode or age
- Increasing equivalence-class sizes
- Applying stronger k-anonymisation
- Re-running the assessment after changes

The software reports the problem and recommendation. It does not automatically rewrite the dataset using generalisation or suppression.

---

# Part 9 — Backend and processing architecture

## 9.1 Important architecture clarification

The central data-processing logic currently runs locally in the frontend runtime:

- Browser tab during web use
- Electron renderer during desktop use

The raw uploaded file is read and processed by the client-side application.

The Express API server exists as a separate workspace service and currently provides the application service boundary and health route. The core fixed-width conversion, anonymisation, decryption, and risk calculations are implemented in the frontend libraries.

This is useful for privacy because the core file transformation does not require sending the raw file to a remote processing service.

## 9.2 Backend/service technologies

The service layer uses:

- **Node.js**
- **Express 5**
- **TypeScript**
- **CORS middleware**
- **Pino logging**
- **Pino HTTP request logging**
- **ESBuild bundling**
- **Source maps**

The API service listens on port `3001` during development.

## 9.3 API lifecycle

The API development launcher:

1. Runs the API build.
2. Creates `dist/index.mjs`.
3. Starts Node with source-map support.
4. Sets `NODE_ENV=development`.
5. Sets `PORT=3001`.
6. Logs startup errors explicitly.
7. Stops the child process when the parent process receives a termination signal.

The frontend Vite server listens on port `5000`.

The Vite server proxies `/api` requests to:

```text
http://localhost:3001
```

## 9.4 API route scope

The current API route structure includes a health route.

The core data-processing functions are not dependent on a remote database or external AI service for the file transformation path.

## 9.5 Desktop backend relationship

Electron acts as the desktop shell:

1. Main process creates the native window.
2. Preload script exposes a limited native bridge.
3. Renderer runs the React interface.
4. Renderer uses browser APIs for file processing.
5. Native bridge provides output-folder selection.

The preload bridge exposes:

```text
chooseOutputFolder()
```

Node integration is disabled inside the renderer, and context isolation is enabled.

This means the web page cannot directly use unrestricted Node.js APIs.

## 9.6 Production packaging

The production process is:

```text
Vite build
    ↓
dist/public/index.html
dist/public/assets/*
    ↓
Electron Builder
    ↓
Windows EXE / macOS DMG / Linux package
```

Electron packaged mode loads the local built `index.html`.

Production Vite assets use relative paths:

```text
./assets/application.js
./assets/application.css
```

This is required because the packaged application loads through a local `file://` path instead of a web server root.

---

# Part 10 — Performance design

## 10.1 Chunked processing

Conversion, encryption, and decryption process records in batches of approximately:

```text
50,000 rows per chunk
```

For each batch:

1. Read the batch.
2. Transform values.
3. Append output lines.
4. Update progress.
5. Yield to the event loop.

## 10.2 Why yielding matters

If JavaScript processes millions of rows continuously without yielding, the browser cannot:

- Repaint the progress bar
- Respond to button clicks
- Update loading messages
- Respond to window movement or resizing

The yield operation lets the UI remain responsive between batches.

## 10.3 Preview versus full output

The preview only displays a manageable subset of records.

The output operation can process much more data than the preview shows.

This prevents a common mistake:

```text
Visible preview rows =/= total processed rows
```

---

# Part 11 — Integrity, error handling, and limitations

## 11.1 HMAC integrity

The v2 encrypted CSV contains an HMAC-SHA-256 integrity tag.

The HMAC detects whether the file content has changed.

It does not make a weak key strong, and it does not prove that the anonymisation is mathematically safe against every privacy attack.

## 11.2 Key fingerprint

The audit log contains a short SHA-256-derived fingerprint.

It helps answer:

```text
Are these two exports associated with the same key identity?
```

It is not the encryption key.

## 11.3 Error boundary

The React application contains an error boundary.

If a renderer section crashes, the application displays a visible error message instead of leaving the user with an unexplained blank screen.

## 11.4 Electron diagnostics

The Electron main process logs:

- Failed page loads
- Renderer console messages
- Failed resource requests
- Renderer process exits

## 11.5 Security limitation

The custom anonymisation system should be presented accurately:

- It is a custom format-preserving transformation.
- It is not AES-GCM.
- It is not a formal guarantee of anonymity.
- Risk assessment should be run after anonymisation.
- A formal cryptographic and privacy review is recommended for highly sensitive production use.

## 11.6 Alphanumeric output limitation

The optional alphanumeric output pass changes the visible alphabet after the four main rounds.

The current decryption path reverses the four primary rounds but does not include a separate inverse function for that fifth remapping pass.

Therefore, presentations should describe it as an optional output-format transformation and validate full round-trip behaviour before relying on it for a production decryption workflow.

---

# Part 12 — Recommended slide sequence

## Slide 1 — Title

**AIRAVATA DEA: Fixed-Width Data Conversion, Anonymisation, and Privacy Risk Assessment**

Message:

> A local-first application that turns difficult legacy data into usable, privacy-aware datasets.

## Slide 2 — The data problem

Show:

- Fixed-width text sample
- Layout file
- Human-readable CSV result

Message:

> The software first teaches the computer where each field begins and ends.

## Slide 3 — Frontend overview

Show:

- Main AIRAVATA DEA screen
- Header controls
- Three-step workflow

Message:

> The user works through a guided visual workflow rather than writing scripts.

## Slide 4 — Upload and layout parsing

Show:

- Excel/CSV layout upload
- Parsed field table
- Sheet selection

Message:

> The application detects field names and byte positions automatically.

## Slide 5 — Fixed-width conversion

Show:

```text
fixed-width row → field extraction → CSV row
```

## Slide 6 — Choosing columns to protect

Show:

- Column selector
- Original values
- Selected columns

Message:

> Only selected fields are anonymised. Other fields remain unchanged.

## Slide 7 — Key settings

Show:

- Seed mode
- PBKDF2/passphrase mode
- Hex key mode
- Deterministic toggle
- Alphanumeric toggle

## Slide 8 — Four-round anonymisation

Show:

```text
value → round 1 → round 2 → round 3 → round 4 → output
```

## Slide 9 — Format-preserving encryption

Show:

```text
AB-123 → QX-804
```

Message:

> The data changes, but length and character structure remain usable.

## Slide 10 — Decryption and integrity

Show:

```text
metadata → salt → key recreation → HMAC check → reverse rounds → CSV
```

## Slide 11 — Risk assessment

Show:

- Original file tab
- Quasi-identifier selection
- Risk metrics

## Slide 12 — Equivalence classes and k-anonymity

Show:

```text
same QI combination → same group
```

Then show:

```text
LinkScore = 1 / group size
```

## Slide 13 — l-diversity and t-closeness

Show:

- Distinct sensitive values
- Global versus local distributions
- TVD formula

## Slide 14 — Original versus anonymised comparison

Show:

- Risk reduction
- Changed cells
- Protected and at-risk records

## Slide 15 — Architecture

Show:

```text
React UI
   ↓
Local processing libraries
   ↓
Browser/Electron APIs
   ↓
CSV/Blob/download
```

And separately:

```text
Express API service
   ↓
health/service boundary
```

## Slide 16 — Large-file design

Show:

```text
50,000-row chunks → progress update → event-loop yield
```

Message:

> The preview stays light while full-file processing continues in batches.

## Slide 17 — Security boundaries

Mention:

- Custom FPE, not AES-GCM
- PBKDF2 in v2 passphrase mode
- CSPRNG export salt
- CBC-style diffusion
- HMAC-SHA-256 integrity
- Risk assessment still required

## Slide 18 — Final message

> AIRAVATA DEA does not simply hide data. It converts legacy formats, applies controlled reversible transformations, checks file integrity, and measures whether the protected dataset is still easy to identify.

---

# Part 13 — One-minute layman explanation

> Imagine receiving a box of paper forms where every answer is written in a fixed location, but there are no labels. AIRAVATA DEA first uses a layout map to understand which location contains the name, postcode, ID, or other value. It converts the forms into a table. The user then chooses which columns need protection. The software changes those selected values through four reversible layers, using a key and a fresh random salt. Letters remain letters and digits remain digits, so the table still looks usable. The protected file receives an integrity seal. Later, the correct key can reverse the layers. Finally, the risk assessment acts like a privacy inspector: it checks how many people look alike, how easy each record would be to identify, and whether sensitive information is still concentrated in small groups.

# Part 14 — Final accuracy notes for the presentation

Use these statements:

- “The core file processing is local in the browser or Electron renderer.”
- “The application uses a custom four-round format-preserving transformation.”
- “v2 adds PBKDF2, export salt, per-value derivation, CBC-style diffusion, and HMAC-SHA-256 integrity.”
- “The risk assessment measures re-identification exposure; it does not automatically anonymise the file.”
- “The preview is limited for interface performance, while processing is chunked for larger files.”
- “The API service is a Node/Express service boundary; the main file transformation logic is in the client-side libraries.”

Do not use these statements:

- “It uses AES-GCM.”
- “The data is guaranteed anonymous.”
- “A LOW risk label means zero risk.”
- “The preview limit is the maximum processing limit.”
- “The remote backend performs all anonymisation.”
- “The alphanumeric output mode is automatically fully reversible without validation.”
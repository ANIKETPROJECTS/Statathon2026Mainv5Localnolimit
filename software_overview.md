# AIRAVATA DEA CSV / Fixed-Width Data Profiler

## Purpose

AIRAVATA DEA is a local-first data utility for working with fixed-width text files and CSV files. It helps a user:

1. Describe the structure of a fixed-width file.
2. Convert fixed-width records into a readable CSV.
3. Select which columns contain identifying or sensitive information.
4. Anonymise selected values while keeping the data usable.
5. Decrypt previously anonymised CSV files when the correct key settings are available.
6. Inspect original and anonymised files side by side.
7. Measure re-identification risk before and after anonymisation.
8. Export converted, anonymised, decrypted, and analysis results.

The same React/Vite interface runs in a browser during development and inside an Electron desktop window for local Windows, macOS, and Linux use.

## Important terminology

### Fixed-width file

A fixed-width file does not separate values with commas. Instead, every field occupies a known range of character positions.

For example:

```text
Positions 1–10   = Customer ID
Positions 11–30  = Name
Positions 31–38  = Date of birth
```

The application uses a layout file to know these positions.

### Layout file

A layout file is an Excel or CSV file containing field information such as:

- Field name or variable name
- Human-readable field description
- Start position
- End position
- Optional field length

The parser accepts several common header names and can detect layouts from Excel sheets automatically.

### Quasi-identifier

A quasi-identifier is not necessarily a name or unique ID by itself, but it can help identify someone when combined with other fields.

Examples:

- Age
- Postcode
- Date of birth
- Gender
- Occupation
- Location

### Sensitive attribute

A sensitive attribute is information that should not be revealed about a person, such as health status, income category, or another private classification.

## Main user workflow

### Step 1: Upload layout files

The user uploads one or more Excel or CSV layout files. The application:

1. Reads the workbook or CSV.
2. Finds the header row.
3. Detects start and end position columns.
4. Derives a missing end position from start plus length when possible.
5. Creates a field definition for each valid row.
6. Reports warnings if the header or field positions cannot be detected.

Excel workbooks can contain multiple visible sheets. The user can choose a sheet and, where applicable, a row range.

### Step 2: Upload fixed-width data files

The user uploads one or more `.txt`, `.dat`, `.fwf`, or `.data` files.

The application reads the file in the browser or Electron renderer and associates it with a selected layout. It uses the start and end positions to extract each field from each record.

Short records are padded with spaces before extraction. Extracted values are trimmed before they are placed into CSV cells.

### Step 3: Convert or process

The application can:

- Convert the fixed-width records to CSV.
- Preview a limited number of rows for responsiveness.
- Select columns for anonymisation.
- Choose encryption key settings.
- Process the complete file in chunks.

The preview limit is a user-interface protection. It does not mean the underlying conversion or anonymisation is limited to the preview size.

### Step 4: Review and export

The user can download or save:

- Converted CSV files
- Anonymised CSV files
- Decrypted CSV files
- Original-versus-anonymised comparisons
- Risk assessment reports
- Record-level risk tables

In the Electron desktop app, the user can select a native output folder. In a browser, the application uses a browser download or the File System Access API when available.

## Anonymisation workflow

The anonymisation process is column-selective. Unselected columns are copied unchanged. Selected non-empty cells pass through the four-round format-preserving transformation described in `anonymisation_logic.md`.

The output keeps:

- The same selected field names
- The same number of records
- The same field lengths
- The same broad character classes for the main four rounds

The output CSV includes metadata comments describing the format version, export salt, CBC status, and integrity tag.

## Decryption workflow

Decryption is symmetric: the same key material and compatible settings used for encryption are required to reverse the selected columns.

For current v2 files, the application:

1. Reads the metadata comments.
2. Finds the export salt.
3. Recreates the four-round key chain.
4. Verifies the HMAC before changing any data.
5. Reads the actual CSV header after the metadata block.
6. Reverses the transformation in reverse round order.
7. Produces a normal CSV without the encryption metadata comments.

Legacy v1 files are detected when no v2 format metadata is present and are handled by the preserved v1 decryption path.

## Risk assessment workflow

The risk assessment is separate from encryption. It does not decrypt data and it does not automatically anonymise data.

The user uploads a CSV and selects:

- Quasi-identifiers
- Optional sensitive attributes
- A minimum group size `k`
- An L-diversity threshold
- A T-closeness threshold
- An optional sample percentage

The application groups records that have the same quasi-identifier combination. These groups are called equivalence classes.

For every record:

```text
link score = 1 / size of its equivalence class
```

Interpretation:

- A group of one gives a score of `1.0`: the record is unique using the selected quasi-identifiers.
- A group of five gives a score of `0.2`.
- A larger group gives a lower score.

The overall re-identification risk is the average link score across all records.

The report includes:

- Overall risk level
- Re-identification risk percentage
- Number of unique records
- Minimum equivalence-class size
- Average equivalence-class size
- At-risk and protected record counts
- Risk distribution charts
- Top vulnerable records
- L-diversity results
- T-closeness results
- Recommendations

### L-diversity

For each equivalence class and selected sensitive attribute, the application counts the number of distinct sensitive values.

An equivalence class fails if its distinct-value count is below the selected L threshold.

### T-closeness

The application compares the sensitive-attribute distribution inside each equivalence class with the distribution in the complete dataset.

It uses total variation distance:

```text
distance = 0.5 × sum of absolute differences between local and global probabilities
```

An equivalence class fails when the distance is greater than the selected T threshold.

## Comparison workflow

The comparison view uses cached original and anonymised risk results. It compares:

- Re-identification risk
- High-risk rate
- Minimum group size
- Unique records
- Column names
- Suppressed columns
- Added columns
- Changed values
- Preserved values

The side-by-side data comparison skips AIRAVATA metadata comment rows and aligns original and anonymised records before highlighting changed cells.

## Desktop architecture

The desktop version keeps the existing web application rather than rebuilding it:

1. Electron creates a native window.
2. Development mode loads the Vite development URL.
3. Packaged mode loads the built `index.html` from Electron resources.
4. A secure preload bridge exposes native output-folder selection.
5. Browser APIs continue to handle file reading, Blob creation, and downloads.

The renderer does not receive unrestricted Node.js access. Electron uses context isolation and disables Node integration in the page.

## Performance model

The application processes data in chunks of approximately 50,000 rows. After each chunk it yields to the event loop so the interface can update progress and remain responsive.

The application still receives the uploaded text as a browser string and creates a final Blob. Therefore:

- Large files can be processed.
- Memory usage still depends on the input text, generated output, and browser/Electron limits.
- The row preview is intentionally limited so rendering millions of table rows does not freeze the interface.

## Security and scope note

The anonymisation code is a custom format-preserving encryption design. It is not AES-GCM and should not be described as an audited replacement for established cryptographic libraries.

The current v2 implementation adds stronger engineering protections than the legacy v1 format, including Web Crypto PBKDF2, per-export salt, per-value derivation, CBC-style diffusion, and HMAC-SHA256 integrity verification. Nevertheless, a formal security review is appropriate before using it as the only protection for highly sensitive production data.
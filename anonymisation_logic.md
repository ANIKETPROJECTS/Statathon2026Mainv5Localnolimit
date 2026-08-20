# AIRAVATA DEA Anonymisation and Decryption Logic

## 1. What this document describes

This document explains the exact anonymisation and decryption logic used by AIRAVATA DEA in language suitable for a technical presentation.

The implementation is a **custom four-round format-preserving transformation**. It is designed to anonymise selected values while preserving their length and general character format.

It is important to describe it accurately:

- It is not AES-GCM.
- It is not a standard, independently audited format-preserving encryption library.
- It uses a custom xorshift-based keystream and reversible character operations.
- Current exports use format version `v2`.
- Older v1 files remain decryptable through a legacy compatibility path.

## 2. What happens to each cell

For every selected non-empty cell:

1. The application identifies the column.
2. It creates or retrieves a keystream for that value.
3. It applies four encryption rounds.
4. Each round transforms the value character by character.
5. Each character consumes five keystream bytes.
6. Each character is processed within its own character alphabet.
7. Optional alphanumeric output performs a fifth remapping pass.
8. The transformed value is written to the output CSV.

For an unselected column, the value is copied unchanged.

## 3. Character classes and format preservation

The four main rounds preserve the character class of each character:

- Digits remain digits.
- Uppercase letters remain uppercase letters.
- Lowercase letters remain lowercase letters.
- Printable symbols remain printable symbols.
- Unsupported or non-printable characters pass through unchanged.

The supported alphabets are represented as indexed lists:

| Input type | Alphabet size |
|---|---:|
| Digits | 10 |
| Uppercase letters | 26 |
| Lowercase letters | 26 |
| Printable symbols | 33 |
| Alphanumeric output alphabet | 36 |

There is one special rule for a leading digit:

- A leading zero stays zero.
- A non-zero leading digit is transformed within digits `1–9`, not `0–9`.

This helps prevent a number-like value from unexpectedly gaining a leading zero.

The length of the value does not change.

## 4. The five reversible operations

Each character is transformed by five small operations. The operation type comes from one keystream byte:

```text
operation type = keystream byte modulo 4
```

The four operation types are:

### Add

The character index is shifted forward within its alphabet:

```text
new value = (old value + shift) modulo alphabet size
```

### Subtract

The character index is shifted backward:

```text
new value = (old value - shift) modulo alphabet size
```

### Multiply

The character index is multiplied modulo the alphabet size:

```text
new value = old value × multiplier modulo alphabet size
```

The multiplier is selected from values that are coprime with the alphabet size. This guarantees that a modular inverse exists.

### Flip

The character is reflected across the alphabet:

```text
new value = alphabet size - 1 - old value
```

Flip is its own inverse: applying it twice returns the original value.

## 5. How decryption reverses the operations

Every encryption operation has a matching inverse:

| Encryption operation | Decryption operation |
|---|---|
| Add | Subtract the same amount |
| Subtract | Add the same amount |
| Multiply by a coprime multiplier | Multiply by its modular inverse |
| Flip | Flip again |

The five operations for one character are reversed from operation 5 back to operation 1.

This is possible because the transformation never discards information and every operation has a defined inverse.

## 6. Keystream generation

The transformation is driven by pseudo-random keystream bytes.

The implementation contains an xorshift-style generator with two internal 32-bit state values. Each generated value is converted into a byte.

The keystream is not random without a key. It is reproducible when the same key material, salt, column, value/cell position, and settings are supplied.

For v2, the keystream seed includes:

- Key material
- Column-specific information
- A per-value or per-cell input
- The 128-bit export salt

This prevents separate export runs from automatically reusing the same stream when the same user settings are selected.

## 7. Four-round key chain

The application creates four derived round keys:

```text
Round 1 key → Round 2 key → Round 3 key → Round 4 key
```

The value is encrypted in this order:

```text
plaintext
  → round 1
  → round 2
  → round 3
  → round 4
  → ciphertext
```

The value is decrypted in the reverse order:

```text
ciphertext
  → inverse round 4
  → inverse round 3
  → inverse round 2
  → inverse round 1
  → plaintext
```

Using multiple rounds makes the transformation more involved than a single pass and provides multiple independent derived keystreams.

## 8. Key modes

The user can choose one of three key modes.

### 8.1 Seed mode

The default seed mode uses four numeric seeds, one associated with each logical round:

```text
42, 137, 2024, 7
```

The seeds are mixed into a rolling 32-bit state. A master key is generated from that state, and the four round keys are derived from the master key.

In v2, the export salt is also mixed into the seed process. Therefore, using the same four seeds in separate export runs normally produces different key material and different ciphertext.

### 8.2 Passphrase / PBKDF2 mode

In current v2 mode:

1. The passphrase becomes PBKDF2 input key material.
2. The passphrase is combined with a round-specific tag.
3. The export salt is included in the PBKDF2 salt.
4. PBKDF2 uses HMAC-SHA-256.
5. At least 100,000 iterations are enforced.
6. A separate derived key is produced for each of the four rounds.

This makes guessing a passphrase more expensive than using a single fast hash.

The v1 implementation contains a custom passphrase derivation function that is retained only to decrypt older v1 files. It is not the method used for new v2 files.

### 8.3 Raw hexadecimal key mode

The user can provide a 64-character hexadecimal value:

```text
64 hexadecimal characters = 256 bits of input material
```

The application validates the format, then derives four round keys from it.

The raw key itself is not stored in the anonymised CSV. The user must preserve it securely if decryption will be required later.

## 9. Export salt

Every new v2 export receives a 128-bit salt represented by 32 hexadecimal characters.

The salt is generated with the browser's cryptographically secure random number generator:

```text
crypto.getRandomValues(...)
```

The salt is not a password and does not need to be kept secret. Its purpose is to make independent export runs different and to provide unique input to key and keystream derivation.

The salt is written into the CSV metadata:

```text
# AIRAVATA-EXPORT-SALT: <32 hex characters>
```

During decryption, the application reads this value automatically.

## 10. Column-specific derivation

The same user key is not used as one undifferentiated stream for every column.

For every column, the application creates a column IV seed using:

- The beginning of the round key
- The literal column name
- A domain separator

This means changing the column name changes the derived stream.

The purpose is to avoid treating all columns as one shared stream and to keep column processing separated.

## 11. Deterministic mode

When deterministic mode is enabled:

- The same plaintext value in the same column produces the same anonymised value during one export run.
- This can be useful when repeated values need to remain linkable for analysis.
- A cache avoids recalculating the same value repeatedly.

For v2, the cache key includes:

```text
column name + separator + plaintext value
```

The keystream nonce is derived from the column seed and the value itself.

This is different from simply reusing one keystream for an entire column. The value-specific nonce makes different values derive different streams while preserving the repeatability of identical values.

### Trade-off

Deterministic output preserves equality relationships. If a person can see or guess that two ciphertext values are equal, they can learn that the corresponding plaintext values were equal. This is useful for some analytics but reveals a pattern.

## 12. Non-deterministic mode

When deterministic mode is disabled:

- Each encrypted cell gets a position-based counter.
- The counter is combined with the column seed.
- The round number also contributes to the seed.
- The export salt is mixed into the final keystream seed.

As a result, two equal plaintext values in the same column can produce different anonymised values when they occur in different cells.

This hides repeated-value equality better, but it also means anonymised repeats are no longer directly linkable.

## 13. CBC-style diffusion in v2

The v2 cell transformation adds a lightweight CBC-style chaining state called `cbc`.

The state starts at zero for each cell and is updated after every character.

For each of the five operations on a character:

```text
effective keystream byte =
raw keystream byte XOR rotate-left(cbc, operation position)
```

This spreads the previous character's state across all five operations.

After the character is transformed, the chaining state is updated using:

```text
cbc = ((cbc shifted left by 3)
       XOR output character code
       XOR raw fifth keystream byte) AND 255
```

The raw fifth keystream byte is secret-derived and is included in the feedback so that the chaining state cannot be reconstructed from ciphertext alone.

During decryption, the application:

- Reads the ciphertext character
- Recreates the same keystream bytes
- Recreates the same chaining state
- Reverses the five operations
- Updates the chaining state using the ciphertext character

This works because encryption and decryption use the same deterministic state sequence.

## 14. Optional alphanumeric output

The application has an optional alphanumeric output setting.

When enabled, the normal four-round result is passed through a fifth transformation using this alphabet:

```text
0123456789abcdefghijklmnopqrstuvwxyz
```

This fifth pass:

- Keeps the same value length.
- Converts letters and digits into lowercase letters and digits.
- Leaves unsupported symbols in place while consuming the same number of keystream positions.

The fifth-pass key is derived from:

- All four round keys
- The export salt

The alphanumeric pass is applied after the four main v2 rounds.

### Important implementation note

The current v2 decryption implementation reverses the four main rounds, but it does not currently call a separate inverse function for this optional fifth alphanumeric remapping pass. Therefore, the alphanumeric-output option must be described carefully in a presentation:

- It is applied during anonymisation.
- It changes the visible output alphabet.
- It is included in the selected anonymisation settings.
- Full round-trip restoration of values produced with this option requires the corresponding inverse remapping to be implemented and used during decryption.

For a guaranteed encrypt-then-decrypt round trip with the current implementation, use the standard output mode unless the alphanumeric path has been specifically validated for the target file.

## 15. v2 metadata format

New anonymised files begin with metadata comments similar to:

```text
# AIRAVATA-FORMAT: v2
# AIRAVATA-EXPORT-SALT: <salt>
# AIRAVATA-CBC: enabled

ColumnA,ColumnB,ColumnC
...
# AIRAVATA-HMAC-SHA256: <64 hex characters>
```

The metadata is not treated as ordinary data rows by the application.

The real CSV header is the first non-comment line after the metadata block.

## 16. HMAC-SHA256 integrity protection

Before an anonymised v2 file is returned:

1. The application builds the complete CSV content.
2. It excludes the HMAC line itself.
3. It derives an HMAC key from the key chain and export salt using HKDF-SHA-256.
4. It calculates an HMAC-SHA-256 tag over the CSV content.
5. It appends the tag as a metadata comment.

The output contains:

```text
# AIRAVATA-HMAC-SHA256: <64 hex characters>
```

The HMAC helps detect:

- Accidental file changes
- Corrupted output
- A wrong key or wrong salt
- Deliberate modification of the encrypted CSV

During decryption, HMAC verification happens before any encrypted values are transformed.

If verification fails, the operation stops with an error similar to:

```text
HMAC verification failed — the file may have been tampered with or the wrong key was provided.
```

The HMAC comparison is performed in constant-time style rather than returning early on the first mismatch.

## 17. Key fingerprint

The application creates a non-sensitive key fingerprint for the audit record.

It hashes:

```text
domain separator + complete key chain
```

using SHA-256 and stores only the first 16 hexadecimal characters.

The fingerprint is useful for confirming that two logs refer to the same key identity. It is not the encryption key and is not intended to reconstruct the key.

## 18. Exact encryption sequence

The current v2 sequence for one export is:

1. Generate a 128-bit export salt with the browser CSPRNG.
2. Resolve the four-key chain using seed, PBKDF2, or raw-hex mode.
3. Build optional alphanumeric keystreams for selected columns.
4. Read fixed-width records.
5. Extract each configured field using its 1-indexed start and end positions.
6. Trim the extracted field.
7. Leave unselected columns unchanged.
8. For each selected non-empty value:
   - Choose deterministic value-derived or non-deterministic cell-derived input.
   - Build one keystream per round.
   - Apply four v2 CBC-diffused FPE rounds.
   - Apply the optional alphanumeric pass.
9. Escape CSV values.
10. Build the v2 metadata and CSV header.
11. Compute HMAC-SHA-256 over the CSV content.
12. Append the HMAC metadata line.
13. Return a CSV Blob, key summary, salt, and non-sensitive audit log.

## 19. Exact decryption sequence for v2

The current v2 sequence is:

1. Read the entire CSV text.
2. Find the `AIRAVATA-FORMAT` metadata.
3. Read the export salt.
4. Recreate the same four-key chain.
5. Locate the HMAC line.
6. Recreate the exact content that was originally authenticated.
7. Verify the HMAC.
8. Stop immediately if verification fails.
9. Locate the actual CSV header after comments and blank lines.
10. Read the data rows.
11. For each selected encrypted column:
    - Recreate the same deterministic or cell-counter keystream.
    - Recreate the CBC state.
    - Reverse round 4.
    - Reverse round 3.
    - Reverse round 2.
    - Reverse round 1.
12. Write the original header and decrypted values to a new CSV Blob.
13. Report progress while processing chunks.

## 20. Legacy v1 compatibility

Older files may not contain:

- A v2 format comment
- An export salt
- CBC diffusion
- HMAC-SHA-256
- Web Crypto PBKDF2

If the v2 format marker is absent, the application uses the v1 path.

The v1 path preserves the older key derivation, per-column keystream behavior, and four-round transformation so files created before the v2 hardening changes remain decryptable.

The v1 passphrase derivation is explicitly a legacy custom construction and should not be presented as modern PBKDF2.

## 21. Progress and large-file handling

Encryption and decryption process rows in chunks of approximately 50,000 records.

After each chunk:

- The progress percentage is updated.
- The event loop is given time to run.
- The UI can repaint and show progress.

Encryption reserves the final part of progress for HMAC calculation.

This design allows large files to be processed without trying to render all records in a table at once. The preview is intentionally smaller than the complete processing capacity.

## 22. Presentation-friendly explanation

For a non-technical audience, the process can be explained as follows:

> The user first tells AIRAVATA DEA where each field is located in the fixed-width record. The application then reads each record and extracts the selected fields. For each selected value, it creates four layers of reversible transformation using the user's key settings. Each letter, digit, or symbol is changed within its own allowed group, so the result remains the same length and remains usable as structured data. A fresh random salt makes each export different. The output also receives an integrity seal, so the application can detect if it was changed before attempting decryption.

Decryption can be explained as:

> The application reads the file's format information, recreates the same key layers, checks the integrity seal, and then peels away the four transformations in reverse order. If the key or file is wrong, the integrity check stops the process rather than returning misleading data.

## 23. What the process does not do

The anonymisation logic does not:

- Guarantee that a person can never be re-identified.
- Automatically remove all quasi-identifiers.
- Automatically apply k-anonymity, L-diversity, or T-closeness.
- Replace a formal privacy review.
- Use AES-GCM.
- Upload the input file to a remote service as part of the browser/Electron processing flow.

Risk assessment must still be run to evaluate whether the resulting dataset is sufficiently protected for its intended use.
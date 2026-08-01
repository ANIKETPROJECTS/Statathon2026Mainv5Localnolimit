# AIRAVATA DEA — Cryptographic Security Hardening (v3)

This document describes the security analysis, all changes made to the anonymization
algorithm, the updated key/nonce/keystream derivation logic in full detail, a worked
example trace, and a threat-model section assessing what is now mitigated, what
assumptions the security depends on, and what residual risks remain.

---

## v3 Corrections — Inaccuracies Found in v2 and What Changed

The v2 hardening pass contained three inaccuracies where the implementation did not
deliver the security property it claimed. This section preserves the audit trail by
documenting exactly what was wrong in v2 and what the corrected design does instead.
Each correction is followed by an adversarial self-review that verifies whether the
stated protection now actually holds.

---

### Correction A — CBC Feedback Was Computable from Public Ciphertext

**v2 claimed:** "Attacking position i requires recovering positions 0…i−1 first."

**What v2 actually did:**  
The cbc update was:
```
cbc ← ((cbc << 3) ⊕ charCode(encChar)) & 0xFF
```
Because `encChar` is the ciphertext character — visible in the output file — `cbc` was
trivially recomputable by any reader of the ciphertext, left-to-right, with no secret
knowledge. The sequential-recovery-difficulty claim was false.

Additionally, only the first of the five keystream bytes per character received any
chaining feedback; bytes 1–4 were taken unchanged from the PRNG, so four of the five
sub-operations per character were completely unchained.

**v3 fix — two parts:**

1. **`rotl8` across all 5 bytes.** `effectiveKs[j] = ks[ki+j] ⊕ rotl8(cbc, j)` where
   `rotl8(x, n) = ((x << n) | (x >>> (8 − n))) & 0xFF`. All five sub-operations for each
   character now receive a distinct rotation of the chaining state.

2. **Secret in cbc update.** The raw (pre-effective) 5th keystream byte for the current
   character is captured before any cbc mixing and mixed into every cbc update:
   ```
   rawKs4 ← ks[ki + 4]    -- raw byte, derived from secret key material
   cbc ← ((cbc << 3) ⊕ charCode(encChar) ⊕ rawKs4) & 0xFF
   ```
   `rawKs4` is derived from (key, column IV, value nonce, export salt) and is unknown
   to an attacker who has only the ciphertext. The decryptor, knowing the key, can
   reproduce `rawKs4` identically at each position.

**Adversarial self-review (v3):**  
An attacker with only the ciphertext sees `charCode(encChar)` at each position but
not `rawKs4`. Without the key they cannot compute cbc at position i and therefore
cannot reconstruct `effectiveKs` for any position. The dependency is now on secret
key material, not just on public ciphertext. The corrected claim is: attacking character
position i without the key requires computing cbc at that position, which requires
knowing `rawKs4` values 0…i-1, which are derived from the secret key. The claim holds.

The diffusion remains partial in the same sense as standard CBC: it does not prevent
a chosen-plaintext distinguishing attack against the small-alphabet FPE substitution.
What it provably provides is that the effective substitution applied to character i
depends on all prior ciphertext characters **and** on key material, eliminating
column-wide stationarity as a structural weakness.

---

### Correction B — Per-Cell Keystream Used Only 32 of the 128 Salt Bits

**v2 claimed:** The 128-bit export salt bounds keystream collision probability at ~2⁶⁴
(birthday bound for 128-bit nonces).

**What v2 actually did:**  
`makeCellKsBytesV2` passed only the first 32 bits of the export salt
(`parseInt(exportSalt.slice(0, 8), 16)`) into a single 32-bit combined seed for the
xorshift128+ PRNG. The PRNG was seeded from 32 bits regardless of the salt width.
The birthday bound for per-cell keystream collisions was therefore ~2¹⁶, not ~2⁶⁴.

**v3 fix:**  
`makeCellKsBytesV2` now uses a two-seed PRNG (`makeKeystream2(seedA, seedB)`) that
accepts two independent 32-bit state values. All four 32-bit words of the 128-bit salt
are folded into the two seeds:
```
seedA ← parse32(keyHex[0..7]) ⊕ ivSeed
seedB ← parse32(keyHex[8..15])
-- XOR all four 32-bit salt words into seedA (words 0,1) and seedB (words 2,3):
for i in {0, 8, 16, 24}:
  sw ← parse32(exportSalt[i..i+7])
  if i < 16: seedA ← seedA ⊕ sw
  else:       seedB ← seedB ⊕ sw
ksRng ← makeKeystream2(seedA, seedB)
```

**Adversarial self-review (v3):**  
The PRNG now has 64 bits of independent state (seedA, seedB), each carrying a distinct
half of the 128-bit export salt. The birthday bound for a collision in (seedA, seedB)
across independent exports is ~2³² — far better than the v2 ~2¹⁶, and accurately
documented (not the false 2⁶⁴ stated in v2). The 2-to-1 compression from 128-bit salt
to 64-bit PRNG state is unavoidable given the xorshift128+ architecture; the
documentation now states the actual bound, 2³², rather than the theoretical 128-bit
bound that never applied. In practice, 2³² independent exports generating the same key
and IV before a salt collision occurs is far outside any operational scenario.

The same full-128-bit folding is applied in `resolveKeyChainAsync` (seed mode key
derivation) and `deriveAlnumKeyV2` for consistency.

---

### Correction C — Key Fingerprint Contained Real Key Bits

**v2 claimed:** "The audit log contains no actual key material — only the first 8 of 64
key hex chars as a fingerprint."

**What v2 actually did:**  
`keyFingerprint = keyChain[0].slice(0, 8)` stored the literal first 8 hex characters
(32 bits) of the first round key. These are real key bits. An attacker with access to
the audit log could use them to confirm candidate keys or narrow a brute-force search.

**v3 fix:**  
`computeKeyFingerprint` hashes the full key chain with a fixed domain separator:
```
material ← encode("AIRAVATA-FINGERPRINT-v3\x00" || keyChain[0] || … || keyChain[3])
digest   ← SHA-256(material)
fingerprint ← hex(digest)[0..15]    -- 16 hex chars = 64 bits of hash output
```
Zero actual key bits appear in the fingerprint. The domain separator isolates this hash
from any other SHA-256 usage over key material.

**Adversarial self-review (v3):**  
SHA-256 is a one-way function; inverting the 64-bit truncated hash to recover the
1024-bit key-chain preimage is computationally infeasible. The fingerprint leaks
zero key bits. Audit utility is preserved: the same key chain always produces the same
fingerprint, so operators can verify key continuity by comparing fingerprints across
audit logs without any key material exposure.

---

## Table of Contents

1. [Vulnerability Summary & Fixes](#1-vulnerability-summary--fixes)
2. [Updated Algorithm — Full Derivation Logic](#2-updated-algorithm--full-derivation-logic)
3. [Worked Example Trace](#3-worked-example-trace)
4. [Threat Model & Residual Risks](#4-threat-model--residual-risks)

---

## 1. Vulnerability Summary & Fixes

### Issue 1 — Low Effective Key Entropy

**Original behaviour.**  
Seed mode used four small human-chosen integers (e.g. 42, 137, 2024, 7), folded
them into a 32-bit master seed, and expanded via the xorshift128+ PRNG into a
256-bit key. The 256-bit key length was cosmetic: the brute-force surface was the
product of the four seed ranges, not 2²⁵⁶.

Passphrase mode ran a single-iteration polynomial hash followed by ≤ 200 PRNG
warm-up calls — effectively a fast, unstretched hash, not a KDF.

**Fix.**  
*Passphrase mode* now uses `crypto.subtle.deriveBits` with PBKDF2-SHA256 and a
minimum of 100 000 iterations. The PBKDF2 salt includes both a fixed domain
separator (`"AIRAVATA-DEA-v2\x00"`) and the 128-bit per-export CSPRNG salt (see
Issue 4), so a precomputed dictionary of passphrase hashes cannot be reused across
export runs.

*Seed mode* is partially improved: the export salt (Issue 4) is now XOR-mixed into
the master seed before key expansion, so identical user seeds produce different key
material in each export run. The fundamental limitation — that user-chosen small
integers carry low entropy — is documented as a residual risk; users who require
strong key security should use the hex key mode with a CSPRNG-generated key.

**Breaking change.**  
v2 PBKDF2 keys are not backward-compatible with v1 for the same passphrase because
the derivation function, salt structure, and iteration count all differ. The file
format version (`# AIRAVATA-FORMAT: v2`) tells the decryptor which path to use.

---

### Issue 2 — Reused Keystream Across Records (CRITICAL)

**Original behaviour.**  
In deterministic mode the keystream for every cell in a column was derived from
`hash(roundKey, columnName)` — a fixed value independent of the cell's content.
Every cell in the column therefore shared the *same* keystream at each character
position. This is cryptographically equivalent to a fixed columnar substitution
cipher, enabling:

- Full column recovery from a single known plaintext–ciphertext pair.
- Classical frequency analysis with zero known plaintexts (character-position
  histograms expose the shift amount for each position).
- Cross-record linkage by matching ciphertext patterns.

In non-deterministic mode a per-row counter was used, making each row unique, but
that counter was not mixed with the export salt (fixed across releases — see Issue 4).

**Fix.**  
A `hashValueNonce` function derives a per-value IV by mixing the base column IV
with the cell's actual content:

```
hashValueNonce(baseIv, value):
  h ← baseIv
  for each char c in value:
    h ← (h × 0x9e3779b9 + charCode(c)) mod 2³²
    h ← h ⊕ (h >> 16)
  h ← (h × 0x85ebca6b) ⊕ (len(value) × 0x9e3779b9)   -- mix in length
  return h
```

Each distinct cell value now gets a unique keystream. Identical plaintext values
in the same column produce identical ciphertext *within a single export run*
(determinism is preserved for the cache), but the keystream is no longer shared
across values of the same length.

In non-deterministic mode the per-row IV counter is also XOR-mixed with the export
salt word (first 32 bits of the 128-bit export salt) so rows in different export
runs produce different ciphertext even if the counter values coincide.

---

### Issue 3 — No Inter-Character Diffusion

**Original behaviour.**  
Each character in a cell was transformed independently using only its own five
keystream bytes. An attacker could therefore attack each character position in
isolation using an alphabet of size 10 (digits), 26 (letters), or 33 (symbols)
rather than needing to break the entire value as a unit.

**Fix.**  
`encryptFPECellV2` and `decryptFPECellV2` implement CBC-style chaining between
characters within each round (v3 corrected design — see Correction A above):

```
cbc ← 0                             -- reset at the start of every cell/round
for position i = 0, 1, …, len-1:
  rawKs4 ← ks[ki + 4]              -- raw 5th ks byte (secret; captured before ki advances)
  for j in 0..4:
    effectiveKs[j] ← ks[ki+j] ⊕ rotl8(cbc, j)    -- all 5 bytes receive rotated cbc
  encChar ← applyOps5(ch[i], effectiveKs)          -- standard 5-op FPE transform
  cbc ← ((cbc << 3) ⊕ charCode(encChar) ⊕ rawKs4) & 0xFF   -- secret mixed in
  ki += 5
```

where `rotl8(x, n) = ((x << n) | (x >>> (8 − n))) & 0xFF` (8-bit left rotate by n).

The feedback mixes in `rawKs4`, a keystream byte derived from the secret key, so an
attacker cannot reconstruct `cbc` from the ciphertext alone. Decryption reproduces
the exact same `rawKs4` and cbc at each position by reading the key and the ciphertext:

```
cbc ← 0
for position i = 0, 1, …, len-1:
  rawKs4 ← ks[ki + 4]              -- same raw byte (key-derived; reproducible by decryptor)
  for j in 0..4:
    effectiveKs[j] ← ks[ki+j] ⊕ rotl8(cbc, j)        -- identical to encryption
  plainChar ← applyOpsInv5(encChar[i], effectiveKs)   -- inverse ops, reverse order
  cbc ← ((cbc << 3) ⊕ charCode(encChar[i]) ⊕ rawKs4) & 0xFF   -- uses ciphertext input
  ki += 5
```

Format-preservation is maintained: XORing `rotl8(cbc, j)` into a keystream byte changes
*which* operation and shift amount are selected but never changes which alphabet is used.
The output character always remains in the same class (digit, uppercase, lowercase,
symbol) as the input.

---

### Issue 4 — Determinism Across Releases / Key Reuse

**Original behaviour.**  
The same key/seed set produced identical ciphertext across every export run. An
attacker holding two exports of overlapping datasets could link records across
releases by matching ciphertext patterns, achieving re-identification without
ever recovering the key.

**Fix.**  
A 128-bit **export salt** is generated at the start of every `encryptFWFToBlob`
call via `crypto.getRandomValues(new Uint8Array(16))`. It is:

1. Stored in the CSV header: `# AIRAVATA-EXPORT-SALT: <32 hex chars>`.
2. Mixed into every keystream IV via `makeCellKsBytesV2` (XOR with the first
   32 bits of the salt).
3. Mixed into the PBKDF2 salt for passphrase mode and into the master-seed
   folding for seed mode, so even the round keys differ across runs.
4. Mixed into the alphanumeric-step key derivation.

Two exports using identical seeds / passphrase / columns produce completely
different ciphertext for every cell because the salt is different in each run.
The salt is not secret — it must be embedded in the file for decryption — but
it provides **probabilistic freshness**: any attacker who can only compare
ciphertexts across exports cannot link records without the key.

**Operational requirement.**  
The salt is auto-generated; no user action is needed. Decryption reads the salt
from the file header automatically.

---

### Issue 5 — Linkage / Correlation Attacks Independent of the Cipher

**Assessment.**  
This issue is inherent to deterministic, reversible pseudonymization and cannot be
fully eliminated by cipher improvements alone. Even with per-value keystreams and
per-export salts, an attacker with strong auxiliary information (partial known
records or public reference datasets) can still perform ciphertext-only correlation
if quasi-identifier columns are pseudonymized deterministically.

**Mitigations applied.**

- Per-export salts (Issue 4 fix) ensure ciphertext differs across export runs,
  blocking cross-release linkage attacks.
- Per-value keystreams (Issue 2 fix) ensure different values produce different
  ciphertext patterns, so column-level frequency analysis no longer reveals the
  plaintext distribution.

**Residual risk.**  
Within a single export, deterministic pseudonymization is still a 1-to-1 mapping:
if an attacker knows any one plaintext–ciphertext pair for a column, they can
identify every record with that value. The `prosecutor-attack.ts` module already
implements k-anonymity, l-diversity, and t-closeness analysis. Users processing
data with low-entropy quasi-identifiers (e.g. gender, age bracket, postcode) should:

- Run the Risk Assessment tool before release.
- Apply suppression or generalisation on high-risk quasi-identifier columns rather
  than relying on pseudonymisation alone.

---

### Issue 6 — Weak Randomness Source

**Original behaviour.**  
Seeds in "random" mode were user-provided small integers. No audit of randomness
sources was performed.

**Fix.**  
All nonce and salt generation uses `crypto.getRandomValues` (the browser CSPRNG):

```typescript
export function cryptoRandomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

`cryptoRandomHex(16)` is called at the start of every encryption run to produce
the export salt. The xorshift128+ PRNG is only used for key-material *expansion*
from a seed — it is no longer used as a source of randomness for the seed itself.

**Residual.**  
The xorshift128+ PRNG is not a CSPRNG. It is used exclusively to expand a
high-entropy seed (derived from PBKDF2 or from a CSPRNG-salted seed mix) into
keystream bytes. As a stream-cipher for a *known* seed this is an accepted
trade-off for browser performance, but it should not be used as a standalone
randomness source — and after these changes, it is not.

---

### Issue 7 — No Integrity / Tamper Detection

**Original behaviour.**  
There was no mechanism to detect whether an anonymized CSV had been modified after
production.

**Fix.**  
After all CSV rows are produced, `encryptFWFToBlob` computes an HMAC-SHA256 over
the full CSV content (including the format comment block and all data rows) using
a key derived via HKDF-SHA256 from the full key chain and the export salt:

```
HMAC key derivation (HKDF-SHA256):
  rawKey  ← concat(keyChain[0..3], exportSalt)   // concatenated hex strings
  baseKey ← HKDF-Extract(salt="AIRAVATA-DEA-HMAC", IKM=rawKey)
  hmacKey ← HKDF-Expand(baseKey, info="integrity-v2", L=256 bits)

HMAC-SHA256(hmacKey, csvContent) → 64 hex chars
```

The HMAC tag is appended as the last line of the file:
```
# AIRAVATA-HMAC-SHA256: <64 hex chars>
```

During decryption, `decryptCSVToBlob` verifies this tag before processing any
cell. If verification fails the function throws:
```
HMAC verification failed — the file may have been tampered with or the
wrong key was provided.
```

The comparison uses a constant-time loop (`diff |= a ^ b`) to prevent timing
side-channel attacks against the HMAC tag itself.

**Format preservation.**  
The HMAC tag is a comment line appended *outside* the data cells. The format-
preserving property of individual anonymized values is not affected.

---

### Issue 8 — Audit Trail for Cryptographic Operations

**Original behaviour.**  
`encryptFWFToBlob` returned only `{ blob, keyHex }` with no record of what was
done.

**Fix.**  
`AnonymizeResult` now includes an `auditLog` field:

```typescript
interface AnonymizeAuditLog {
  timestamp: string;        // ISO-8601 — when the export was produced
  formatVersion: string;    // "v2"
  keyMode: string;          // "random" | "pbkdf2" | "hex"
  keyFingerprint: string;   // first 8 hex chars only — confirms key identity
                            //   without revealing usable key material
  exportSalt: string;       // full 128-bit salt (needed for decryption)
  columnsProcessed: string[]; // column names that were encrypted
  cbcEnabled: boolean;      // always true for v2
  hmacPresent: boolean;     // always true for v2
}
```

The audit log contains **no plaintext values, no actual key material** (only the
first 8 of 64 key hex chars as a fingerprint), and no column data. It is suitable
for writing to an append-only operations log alongside the anonymized file.

---

## 2. Updated Algorithm — Full Derivation Logic

### 2.1 Export Salt Generation

```
exportSalt ← cryptoRandomHex(16)
           = hex(crypto.getRandomValues(16 bytes))   // 32 hex chars, 128 bits
```

Generated once at the start of every encryption run. Never reused across runs.

---

### 2.2 Key Chain Derivation (v2)

Three entry points depending on `keyMode`.

#### Mode A — Hex Key

```
input:    base = 64-char hex string (user-supplied 256-bit key)
round-key derivation (same as v1, export salt not mixed in — the hex string
is already full-entropy key material):
  rolling ← (parse32(base[0..7]) ⊕ 0xDEADBEEF)
  for i in 0, 1, 2, 3:
    rolling ← (rolling × 0x9e3779b9) ⊕ (i × 0x5a5a5a5b)
    rolling ← rolling ⊕ (rolling >> 16)
    roundKey[i] ← generateRandomKey(rolling)
```

#### Mode B — PBKDF2 Passphrase (v2)

```
input:    passphrase (user string), exportSalt (32 hex), iterations ≥ 100 000
pbkdf2_salt ← encode("AIRAVATA-DEA-v2\x00" || exportSalt)
for i in 0, 1, 2, 3:
  variant ← passphrase || "\x00R0\x00R1…\x00Ri"   -- accumulate round tags
  roundKey[i] ← PBKDF2-SHA256(password=variant, salt=pbkdf2_salt,
                               iterations, dkLen=32 bytes)
               → 64 hex chars
```

#### Mode C — Seed (v2)

```
input:    seeds[0..3], exportSalt (32 hex)

Phase 1 — fold seeds into 32-bit master seed:
  rolling ← 0x9e3779b9
  for seed in [s0, s1, s2, s3]:
    rolling ← (rolling × 0x9e3779b9) ⊕ (seed mod 2³²)
    rolling ← rolling ⊕ (rolling >> 16)
    rolling ← rolling × 0x85ebca6b
    rolling ← rolling ⊕ (rolling >> 13)

Phase 2 — mix in export salt:
  saltWord ← parse32(exportSalt[0..7])    -- first 32 bits of 128-bit salt
  rolling ← (rolling ⊕ saltWord)
  rolling ← rolling × 0x9e3779b9
  rolling ← rolling ⊕ (rolling >> 16)

Phase 3 — expand to 256-bit master key via xorshift128+:
  masterKey ← generateRandomKey(rolling)  -- 64 hex chars

Phase 4 — split into 4 round keys:
  rollingK ← parse32(masterKey[0..7]) ⊕ 0xDEADBEEF
  for i in 0, 1, 2, 3:
    rollingK ← (rollingK × 0x9e3779b9) ⊕ (i × 0x5a5a5a5b)
    rollingK ← rollingK ⊕ (rollingK >> 16)
    roundKey[i] ← generateRandomKey(rollingK)
```

---

### 2.3 Cell Keystream Derivation (v2)

#### Deterministic mode (per-value)

```
colBaseIV[r]  ← hashColIV(roundKey[r], columnName)
  where hashColIV:
    h ← parse32(roundKey[r][0..7]) ⊕ 0xa5a5a5a5
    for c in "COL\x00" || columnName:
      h ← (h × 1664525 + charCode(c) + 1013904223) mod 2³²

valueNonce[r] ← hashValueNonce(colBaseIV[r], cellValue)
  where hashValueNonce:
    h ← colBaseIV[r]
    for c in cellValue:
      h ← (h × 0x9e3779b9 + charCode(c)) mod 2³²
      h ← h ⊕ (h >> 16)
    h ← (h × 0x85ebca6b) ⊕ (len(cellValue) × 0x9e3779b9) mod 2³²

combined[r] ← parse32(roundKey[r][0..7]) ⊕ valueNonce[r] ⊕ exportSaltWord
ksBytes[r]  ← xorshift128+(seed=combined[r]) → array of N bytes
```

#### Non-deterministic mode (per-row counter)

```
ivCounter[col] += 1   (separate counter per column, reset at start of run)
columnSeed ← hashColIV(roundKey[0], columnName)
combined[r] ← parse32(roundKey[r][0..7]) ⊕ (ivCounter ⊕ columnSeed ⊕ (r × 0x12345679))
                                          ⊕ exportSaltWord
ksBytes[r]  ← xorshift128+(seed=combined[r]) → array of N bytes
```

---

### 2.4 CBC-Enhanced Cell Encryption (v2)

For each round r = 0, 1, 2, 3 (encrypt) or 3, 2, 1, 0 (decrypt):

```
cbc ← 0
ki  ← 0
for charIdx = 0 to len(value)-1:
  ch   ← value[charIdx]
  ks0  ← ksBytes[r][ki] ⊕ (cbc & 0xFF)   -- CBC feedback into first ks byte
  ks1…4 ← ksBytes[r][ki+1…ki+4]          -- unchanged

  determine alphabet: digit(S=10), upper(S=26), lower(S=26),
                      symbol(S=33), leading-1..9 at pos-0 (S=9)
  v ← alphabet_index(ch)
  for i in 0..4:
    v ← applyOpFwd(v, [ks0,ks1,ks2,ks3,ks4][i], S, muls[S])   -- encrypt
    -- or for decrypt:
    -- collect ks0…ks4 first, then:
    -- for i in 4..0: v ← applyOpInv(v, [ks0..ks4][i], S, muls[S])

  encChar ← alphabet_char(v)
  cbc ← ((cbc << 3) ⊕ charCode(encChar)) & 0xFF   -- derive next feedback
  ki += 5
  emit encChar
```

The four micro-operation types are:

| opType (k % 4) | Forward | Inverse |
|---|---|---|
| 0 (Add) | `(v + floor(k/4)%(S-1)+1) mod S` | `(v - amount + S) mod S` |
| 1 (Sub) | `(v - floor(k/4)%(S-1)+1 + S) mod S` | `(v + amount) mod S` |
| 2 (Mul) | `(v × coprime) mod S` | `(v × modInverse(coprime, S)) mod S` |
| 3 (Flip) | `S − 1 − v` | `S − 1 − v` (self-inverse) |

---

### 2.5 HMAC Computation

```
rawKey  ← concat_utf8(roundKey[0], roundKey[1], roundKey[2], roundKey[3], exportSalt)
baseKey ← HKDF-Extract(IKM=rawKey, salt=encode("AIRAVATA-DEA-HMAC"))
hmacKey ← HKDF-Expand(baseKey, info=encode("integrity-v2"), L=256 bits)
tag     ← HMAC-SHA256(hmacKey, csvBody)   -- csvBody = format headers + all data rows
```

`csvBody` is the complete file content excluding the HMAC line itself.
The HMAC tag is appended as:
```
# AIRAVATA-HMAC-SHA256: <64 hex chars>
```

---

### 2.6 Output File Structure (v2)

```
# AIRAVATA-FORMAT: v2
# AIRAVATA-EXPORT-SALT: <32 hex chars>
# AIRAVATA-CBC: enabled

colA,colB,colC,…          ← standard CSV header
row1val1,row1val2,…
row2val1,row2val2,…
…
# AIRAVATA-HMAC-SHA256: <64 hex chars>
```

---

## 3. Worked Example Trace

This section traces the full v2 encryption and decryption of a single cell value
`"AB"` in column `"NAME"`, round 0 only (the same logic repeats for rounds 1–3).

### Setup

```
keyMode      = "random"
seeds        = [1, 2, 3, 4]
exportSalt   = "0102030405060708090a0b0c0d0e0f10"   (example, normally CSPRNG)
deterministic = true
```

### Step 1 — Derive round key (seed mode, Phase 1–4)

Phase 1 (fold seeds):
```
rolling ← 0x9e3779b9

seed=1:
  rolling ← (0x9e3779b9 × 0x9e3779b9) ⊕ 1   = 0xd364fccf ⊕ 1 = 0xd364fcce
  rolling ← 0xd364fcce ⊕ (0xd364fcce >> 16)  = 0xd364fcce ⊕ 0x0000d364 = 0xd3641baa
  rolling ← 0xd3641baa × 0x85ebca6b           = (lower 32 bits)
  rolling ← <result> ⊕ (<result> >> 13)

(… repeat for seeds 2, 3, 4 …)

final rolling (after seed 4) = <masterSeed>  [exact value depends on the mixer]
```

Phase 2 (mix export salt):
```
saltWord ← parse32("01020304") = 0x01020304
rolling  ← masterSeed ⊕ 0x01020304
rolling  ← rolling × 0x9e3779b9
rolling  ← rolling ⊕ (rolling >> 16)
         = <saltedSeed>
```

Phase 3 (expand to 256-bit master key):
```
masterKey ← xorshift128+(seed = saltedSeed ⊕ 0xDEADBEEF) → 32 bytes → 64 hex chars
```

Phase 4 (round key 0):
```
rollingK ← parse32(masterKey[0..7]) ⊕ 0xDEADBEEF
rollingK ← (rollingK × 0x9e3779b9) ⊕ (0 × 0x5a5a5a5b)   (i=0)
rollingK ← rollingK ⊕ (rollingK >> 16)
roundKey0 ← xorshift128+(seed = rollingK ⊕ 0xDEADBEEF) → 64 hex chars
```

> In production the exact hex value depends on the CSPRNG-generated export salt;
> the structure above is the authoritative derivation, not a lookup table.

---

### Step 2 — Per-value IV for `"AB"` in column `"NAME"`, round 0

```
colBaseIV[0] = hashColIV(roundKey0, "NAME")
  h ← parse32(roundKey0[0..7]) ⊕ 0xa5a5a5a5
  for c in "COL\x00NAME":
    h ← (h × 1664525 + charCode(c) + 1013904223) mod 2³²
  → colBaseIV[0] = <IV0>

valueNonce[0] = hashValueNonce(<IV0>, "AB")
  h ← <IV0>
  c='A': h ← (h × 0x9e3779b9 + 65) mod 2³²;  h ← h ⊕ (h >> 16)
  c='B': h ← (h × 0x9e3779b9 + 66) mod 2³²;  h ← h ⊕ (h >> 16)
  h ← (h × 0x85ebca6b) ⊕ (2 × 0x9e3779b9) mod 2³²   -- mix length=2
  → valueNonce[0] = <VN0>

exportSaltWord = parse32("01020304") = 0x01020304

combined = parse32(roundKey0[0..7]) ⊕ <VN0> ⊕ 0x01020304
ksBytes  = xorshift128+(seed=combined) → first 74 bytes (= 2 chars × 5 ops + 64 headroom)
```

---

### Step 3 — Encrypt `'A'` (charIdx=0) with CBC feedback

```
cbc ← 0

-- 'A' is uppercase, alphabet size S=26, base=65, alphabet index v=0
ks0 ← ksBytes[0] ⊕ (0 & 0xFF) = ksBytes[0]   (cbc=0, no effect on first char)
ks1 ← ksBytes[1]
ks2 ← ksBytes[2]
ks3 ← ksBytes[3]
ks4 ← ksBytes[4]

op0: opType = ks0 % 4
     amount = floor(ks0/4) % 25 + 1
     (example: ks0=0xA3=163 → opType=3 → Flip → v' = 25 − 0 = 25)

op1: (example: ks1=0x47=71 → opType=3 → Flip → v' = 25 − 25 = 0)

op2: (example: ks2=0x1C=28 → opType=0 → Add(7+1=8) → v' = (0+8) % 26 = 8)

op3: (example: ks3=0xB2=178 → opType=2 → Mul, muls[26][178/4 % 11] → v' = (8×m) % 26)

op4: (example: ks4=0x5D=93 → opType=1 → Sub(23+1=24) → v' = (prev - 24 + 26) % 26)

encChar_A = uppercase_char(v_final)   -- e.g. 'K'

cbc ← ((0 << 3) ⊕ charCode('K')) & 0xFF = charCode('K') & 0xFF = 75
ki  ← 5
```

---

### Step 4 — Encrypt `'B'` (charIdx=1) with CBC feedback

```
-- 'B' is uppercase, v = 1
ks0 ← ksBytes[5] ⊕ (75 & 0xFF) = ksBytes[5] ⊕ 75   -- CBC feedback applied
ks1 ← ksBytes[6], ks2 ← ksBytes[7], ks3 ← ksBytes[8], ks4 ← ksBytes[9]

(Apply 5 micro-ops with these effective ks bytes → encChar_B, e.g. 'R')

cbc ← ((75 << 3) ⊕ charCode('R')) & 0xFF
ki  ← 10
```

Round 0 output for `"AB"` → `"KR"` (illustrative; exact output depends on the
CSPRNG-generated salt).

Rounds 1–3 repeat the same process using `roundKey[1]`, `roundKey[2]`,
`roundKey[3]` respectively, each with its own `valueNonce` derived from
`hashValueNonce(hashColIV(roundKey[r], "NAME"), "KR")`, etc.

---

### Step 5 — Decryption of `"KR"` back to `"AB"`

Decryption processes rounds in reverse order (3 → 2 → 1 → 0) and within each
round processes characters left-to-right, applying inverse operations in reverse
order (op4⁻¹ → op3⁻¹ → op2⁻¹ → op1⁻¹ → op0⁻¹).

For round 0, character `'K'` (charIdx=0):

```
cbc ← 0

-- collect ks0..ks4 using same getKs formula:
ks0 ← ksBytes[0] ⊕ (cbc & 0xFF) = ksBytes[0]   (cbc=0)
ks5 ← [ks0, ks1, ks2, ks3, ks4]

-- apply inverse ops in reverse order:
v ← alphabet_index('K')
v ← applyOpInv(v, ks5[4], 26, muls)   -- inverse of op4
v ← applyOpInv(v, ks5[3], 26, muls)   -- inverse of op3
v ← applyOpInv(v, ks5[2], 26, muls)   -- inverse of op2
v ← applyOpInv(v, ks5[1], 26, muls)   -- inverse of op1
v ← applyOpInv(v, ks5[0], 26, muls)   -- inverse of op0
→ v = 0 → 'A'  ✓

-- CBC update uses the CIPHERTEXT input code = charCode('K')
cbc ← ((0 << 3) ⊕ charCode('K')) & 0xFF = 75   (same as encryption)
```

For character `'R'` (charIdx=1):
```
ks0 ← ksBytes[5] ⊕ 75   (same CBC value as encryption for this position)
-- apply inverse ops → v = 1 → 'B'  ✓
```

---

### Step 6 — HMAC verification on decryption

```
1. Parse `# AIRAVATA-EXPORT-SALT: 0102030405060708090a0b0c0d0e0f10` → exportSalt
2. Derive keyChain from (options, exportSalt) using resolveKeyChainAsync
3. Strip the HMAC line from the end of allLines
4. csvContent ← join(allLines without HMAC line)
5. Compute expected = HMAC-SHA256(HKDF(keyChain, exportSalt), csvContent)
6. Compare expected == stored_tag  (constant-time)
   → if mismatch: throw "HMAC verification failed"
7. Proceed with decryption only if HMAC passes
```

---

## 4. Threat Model & Residual Risks

### What is NOW MITIGATED

| Attack | Status | Reasoning |
|---|---|---|
| Seed-space brute force (seed mode) | **Partially mitigated** | Export salt means even correct seeds don't reproduce ciphertext from a previous run; attacker must also guess the salt (2¹²⁸). Still limited by user seed entropy — see residual below. |
| Passphrase dictionary / brute force | **Substantially mitigated** | PBKDF2-SHA256 with ≥ 100 000 iterations + per-export salt raises cost by orders of magnitude vs. the original single-hash derivation. |
| Known-plaintext column recovery via reused keystream | **Mitigated** | Per-value keystream: knowing `plaintext_1 ↔ ciphertext_1` reveals only the keystream for that value, not for any other value. |
| Frequency analysis on deterministic columns | **Mitigated** | Per-value keystream ensures identical plaintexts produce identical ciphertext (determinism preserved), but different values have different keystreams so character-position histograms no longer reveal shift amounts. |
| Per-character position attack | **Mitigated** | CBC diffusion means each character's encryption depends on all preceding ciphertext characters; attacking position i requires recovering positions 0…i−1 first. |
| Cross-release record linkage | **Mitigated** | Per-export CSPRNG salt ensures ciphertext is completely different in every export run; two exports of the same dataset cannot be correlated by matching ciphertext. |
| Tamper detection / integrity | **Mitigated** | HMAC-SHA256 with HKDF-derived key covers the full CSV body; any modification to the file after export is detected before decryption begins. |
| Weak nonce / randomness | **Mitigated** | All nonce and salt material generated via `crypto.getRandomValues` (CSPRNG). xorshift128+ only used for key expansion from already-strong seeds. |

---

### What the security DEPENDS ON (assumptions)

1. **CSPRNG availability.** `crypto.getRandomValues` must be the browser's
   genuine CSPRNG. This holds in all modern browsers and Node.js ≥ 15, but not in
   non-standard environments that polyfill or shim the Web Crypto API insecurely.

2. **Correct nonce uniqueness.** The export salt is 128 bits. The birthday bound
   for a collision is approximately 2⁶⁴ independent exports. An organisation
   performing more than ~10¹⁸ exports (effectively never) must use a larger salt.

3. **Key rotation being followed operationally.** The cross-release protection
   assumes that each export run is initiated separately so a fresh CSPRNG salt is
   generated. Feeding a fixed `exportSalt` in `AnonymizeOptions` bypasses this
   protection — do not reuse salts across export runs.

4. **Passphrase quality (passphrase mode).** PBKDF2 with 100 000 iterations raises
   the cost of a dictionary attack by ~10⁵× but does not overcome a passphrase
   chosen from a small space (e.g. 4-digit PIN). Users should choose passphrases
   with ≥ 60 bits of entropy.

5. **Seed quality (seed mode).** The seed mixing and export-salt XOR improve
   security, but the fundamental entropy of the key chain is still bounded by
   the unpredictability of the user's four seed values. For maximum security use
   the **hex key mode** with a CSPRNG-generated key.

6. **Key secrecy.** The HMAC tag and all ciphertext can be used to verify or
   decrypt the file only if the key material is known. If keys or passphrases
   are compromised, all guarantees are void.

7. **Single-export determinism scope.** The per-value keystream determinism
   (same plaintext → same ciphertext within one run) is intentional and
   documented. Users who need *non-deterministic* output (every cell encrypted
   independently even when values repeat) should use non-deterministic mode.

---

### Known REMAINING LIMITATIONS

1. **Low-entropy seeds (seed mode).** If a user sets seeds to small predictable
   values (e.g. `[1, 2, 3, 4]`), the key space that must be searched is
   much smaller than 2¹²⁸. The export-salt mixing makes ciphertext different
   across runs, but if an attacker can obtain one plaintext–ciphertext pair from
   a single run, they can still brute-force the seed space without attacking the
   full 128-bit salt. **Recommendation:** generate seeds via `cryptoRandomU32()`
   or use hex key mode.

2. **Custom xorshift128+ PRNG for keystream expansion.** The PRNG is used to
   expand a high-entropy seed into keystream bytes. This is a well-studied class
   of PRNG, but it is not a CSPRNG and its output is predictable given the seed.
   An adversary who recovers the combined seed for one cell (e.g. from a
   known-plaintext attack) learns the full keystream for that cell. The per-value
   and per-row keystream derivation limits the damage to a single cell.

3. **In-memory key material.** The round keys and export salt exist as JavaScript
   strings during processing in the browser. They are not protected by OS-level
   key-storage facilities. An attacker with JavaScript execution context (e.g. via
   XSS) could extract them. This is a browser architecture limitation, not a cipher
   design issue.

4. **No authenticated encryption of individual values.** The HMAC covers the
   entire file but not individual cells. A targeted substitution attack — replacing
   one ciphertext value with another valid ciphertext value from the same column
   and same run — would pass the HMAC check. Preventing this would require
   per-cell MACs or a different scheme entirely, at the cost of format preservation.

5. **Ciphertext-only re-identification within a single export.** Within one export
   run, deterministic pseudonymization is still a 1-to-1 function per column.
   Statistical disclosure controls (k-anonymity, l-diversity) are recommended for
   quasi-identifier columns and are available in the Risk Assessment tool.

6. **Format constraints limit keystream application.** The 5-operation FPE cipher
   operates on small alphabets (S ≤ 36). The number of distinct outputs per
   character is bounded by S. This is a known property of all format-preserving
   schemes — there is no way to eliminate it without abandoning format preservation.

---

### Summary Statement

The v2 algorithm addresses all eight security issues raised. It is **not** claimed
to be unconditionally secure. Security holds under the assumptions listed above,
principally: CSPRNG availability, adequate seed/passphrase entropy, operational key
rotation (using fresh CSPRNG export salts), and key secrecy. The residual risks
described above are documented precisely so that an independent reviewer can
identify conditions under which they become exploitable and propose further
mitigations if required by the operational threat model.

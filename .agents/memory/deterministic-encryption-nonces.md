---
name: Deterministic encryption nonces
description: The reproducibility constraint for AIRAVATA DEA’s deterministic anonymisation mode.
---

Deterministic cell encryption must derive its nonce from data available during both export and import, such as the key and column identity. A nonce derived from plaintext cannot be reconstructed from ciphertext during decryption unless it is stored separately.

**Why:** The earlier design derived the nonce from plaintext during encryption and ciphertext during decryption, producing plausible but incorrect decrypted values. The current compact format uses a reproducible column nonce and keeps the seed/key settings outside the CSV rather than embedding algorithm metadata.

**How to apply:** Any future cipher or format change must include an end-to-end encrypt/decrypt test using the exported file, not just a direct inverse test. Preserve compatibility readers for older salted files, and fail with a clear migration message rather than returning corrupted data when a format cannot reverse an existing file.
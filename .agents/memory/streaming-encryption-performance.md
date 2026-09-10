---
name: Streaming encryption performance
description: Performance constraints for local streaming anonymisation of very large fixed-width files.
---

Deterministic fixed-width anonymisation must reuse per-column keystream state and compiled character transforms rather than deriving a keystream for every record. Inverse lookup tables must apply FPE operations in reverse order. Progress callbacks must also be throttled to meaningful percentage changes.

**Why:** On gigabyte-scale files, per-record key-stream generation and per-chunk React updates dominate runtime even when only one column is selected.

**How to apply:** Any future streaming cipher or conversion path should precompute reusable column work, bound any value cache, and emit UI progress at most once per visible percentage change.

Compact FPE must also include reversible whole-value diffusion rather than transforming positions independently. Keep a legacy compatibility switch because compact CSVs have no embedded algorithm version.

**Why:** Independent position transforms preserve visible similarity: identifiers differing in one digit produce ciphertexts differing in the same one digit. Bidirectional keyed sweeps spread that change across the value while preserving width and character class.

**How to apply:** Apply diffusion after each encryption round and undo it before each inverse round. Verify nearby-value separation, exact small/streaming round trips, leading zeros, symbols, and legacy mode together.
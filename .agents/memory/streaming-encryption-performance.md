---
name: Streaming encryption performance
description: Performance constraints for local streaming anonymisation of very large fixed-width files.
---

Deterministic fixed-width anonymisation must reuse per-column keystream state and compiled character transforms rather than deriving a keystream for every record. Progress callbacks must also be throttled to meaningful percentage changes.

**Why:** On gigabyte-scale files, per-record key-stream generation and per-chunk React updates dominate runtime even when only one column is selected.

**How to apply:** Any future streaming cipher or conversion path should precompute reusable column work, bound any value cache, and emit UI progress at most once per visible percentage change.
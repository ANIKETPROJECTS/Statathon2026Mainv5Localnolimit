---
name: Browser directory handle fallback
description: Browser and proxied preview contexts may reject a previously selected FileSystemDirectoryHandle during later file writes.
---

Directory handles selected through the browser file-system picker can lose usable write permission by the time an asynchronous encryption or decryption finishes. Treat permission failure from `getFileHandle` as a recoverable output-path problem: attempt a normal browser download fallback rather than failing the transformation.

**Why:** The app can successfully select a folder but later receive a `NotAllowedError` or “request is not allowed in the current context” while writing the completed stream.

**How to apply:** Check or request write permission before directory writes, catch `NotAllowedError`/`SecurityError`, and report whether the result was saved to the folder or downloaded.
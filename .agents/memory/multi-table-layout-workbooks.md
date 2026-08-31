---
name: Multi-table layout workbooks
description: Semantics for Excel workbooks that place several fixed-width questionnaire layouts on one sheet.
---

For level-based survey layout workbooks, each questionnaire level can be a separate table block on one sheet. A later table’s `Common-ID` row with byte range 1–38 is a placeholder for the base table’s fields through `Sample hhld. No.`, not a standalone 38-byte output column.

**Why:** Treating the sheet as one table makes later headers inherit the first table’s column positions and causes shared fields to be lost during fixed-width conversion.

**How to apply:** Detect table headers independently, expose one layout per block, and expand the 1–38 Common-ID placeholder from the first table only for later blocks. Preserve each block’s own fields and byte positions.
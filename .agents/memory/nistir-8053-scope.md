---
name: NISTIR 8053 scope
description: Durable documentation boundary between NISTIR 8053 guidance and AIRAVATA DEA's custom risk assessment.
---

NISTIR 8053 is an overview of de-identification issues, terminology, approaches, and re-identification risk. It does not prescribe one anonymisation algorithm, one risk formula, application-specific thresholds, or a zero-risk guarantee. AIRAVATA DEA must label its prosecutor-model equations, display bands, and encryption behavior as implementation-specific.

**Why:** The product’s earlier feature prose treated AIRAVATA DEA’s selected prosecutor calculation and thresholds as if they were requirements of NISTIR 8053, and blurred reversible transformation with risk assessment.

**How to apply:** When updating the Risk Assessment UI, generated reports, or technical documents, cite NISTIR 8053 as context and describe the attacker model, assumptions, formulas, and thresholds as AIRAVATA DEA choices. Keep reversible keyed transformation separate from re-identification-risk evaluation.
# AIRAVATA DEA Prosecutor Attack

## Implemented re-identification-risk methodology

**Document status:** Authoritative description of the current AIRAVATA DEA
implementation as of September 2026.

**Scope:** This document describes the **Risk Assessment → Prosecutor Attack**
feature in the CSV Profiler. It documents what the software currently
calculates, the assumptions behind those calculations, the application-defined
thresholds, and the limitations that must be considered when interpreting the
result.

This is not a claim that NISTIR 8053 mandates the AIRAVATA DEA algorithm,
thresholds, colours, or encryption method.

---

## 1. Executive summary

AIRAVATA DEA implements a selected quasi-identifier linkage assessment. The
user selects one or more columns as **quasi-identifiers (QIs)**. Records with
the same values in all selected QIs are placed in an **equivalence class
(EC)**. The implementation then estimates a conditional identification chance
for each record as:

```text
LinkScore(r) = 1 / |EC(r)|
```

The primary dataset-level value displayed as **Re-ID Risk** is the mean of
those link scores:

```text
ReIDRisk = (1 / N) × Σ LinkScore(r)
```

For this particular score, the expression is also equal to:

```text
ReIDRisk = number of equivalence classes / number of analysed records
```

The feature also reports:

- singleton and uniqueness counts;
- the minimum equivalence-class size (`minK`);
- the proportion of records below the configured `k` threshold;
- optional distinct `l`-diversity checks for selected sensitive attributes;
- optional total-variation-distance (`t`) checks for selected sensitive
  attributes;
- record-level link scores, distributions, vulnerable records, and
  implementation-generated recommendations.

The result is an **assessment under a stated model**, not a guarantee that a
real person can or cannot be identified. It does not prove that the released
data is anonymous, and it does not establish compliance with a law, policy, or
release decision by itself.

---

## 2. NISTIR 8053: what it does and does not establish

### 2.1 The role of NISTIR 8053

NISTIR 8053, *De-Identification of Personal Information*, published by the
National Institute of Standards and Technology in 2015, is used here as
background for the concepts of:

- de-identification and its privacy-risk trade-offs;
- re-identification attacks;
- quasi-identifiers and linkage with external information;
- evaluating an attacker’s available information or “attacker’s power”;
- the fact that different datasets need different techniques and assessments.

The publication describes de-identification as a collection of approaches,
algorithms, and tools. It explicitly says that it provides an overview of
issues and terminology and does **not** make recommendations about the
appropriateness of de-identification or specific de-identification algorithms.

Therefore, NISTIR 8053 does **not** prescribe:

- one universal anonymisation algorithm;
- AIRAVATA DEA’s pipe-joined equivalence-class key;
- the formula `1 / |EC|` as the only possible risk measure;
- defaults such as `k = 5`, `l = 3`, or `t = 0.2`;
- the application’s `5%` and `20%` display boundaries;
- the application’s risk colours or words such as `LOW`, `MEDIUM`, and
  `HIGH`;
- a reversible encryption or format-preserving transformation;
- a guarantee that encrypted or de-identified values cannot be decrypted or
  re-identified.

The label **“Prosecutor Attack”** is the product’s name for the attacker model
implemented by AIRAVATA DEA. It should not be read as saying that NISTIR 8053
requires this exact implementation or that it is the only valid attack model.

### 2.2 No zero-risk promise

NISTIR 8053 discusses the possibility that de-identified data may still be
linked back to individuals and that risk depends on factors such as
distinctiveness, the de-identification procedure, available linkage data, and
the population being considered. A result from this feature must therefore be
read as evidence about the selected model and input data, not as proof of
zero risk.

### 2.3 Official source

- Garfinkel, Simson L. **NISTIR 8053: De-Identification of Personal
  Information.** National Institute of Standards and Technology, October
  2015.
- Official publication:
  <https://nvlpubs.nist.gov/nistpubs/ir/2015/NIST.IR.8053.pdf>
- DOI landing page:
  <https://doi.org/10.6028/NIST.IR.8053>

---

## 3. Separation from AIRAVATA DEA encryption and anonymisation

Risk assessment and reversible transformation answer different questions.

### 3.1 Reversible transformation

AIRAVATA DEA’s anonymisation/decryption path is a custom, keyed,
format-preserving transformation. It is intended to transform selected
values while retaining useful structural properties such as length and
character class. With the required key material and compatible file metadata,
the transformation is designed to be reversed.

That is a confidentiality or controlled-transformation mechanism. It is not
itself a proof of k-anonymity, l-diversity, t-closeness, differential privacy,
or real-world anonymity.

In particular:

- A value that looks pseudonymous or anonymised may still be reversible by a
  party holding the key or other required key material.
- A transformation can preserve equality patterns or other information that
  assists linkage, depending on its mode and the released data.
- Removing names or replacing values does not automatically remove all
  quasi-identifiers.
- Encryption does not decide which columns an attacker may know from an
  external source.
- The output of the risk assessment does not validate the cryptographic
  strength of the encryption implementation.

### 3.2 Risk assessment

The Prosecutor Attack evaluates the values present in the uploaded CSV under
the selected QI columns. It groups records, computes candidate-set sizes, and
reports the resulting model-based scores. It does not decrypt a file, test
whether a key can be guessed, search the internet for matching people, or
compare the original and anonymised files to prove a cryptographic property.

If an anonymised file is uploaded, the assessment is run on that uploaded
representation. The feature does not infer that the file is safe merely
because it was produced by AIRAVATA DEA.

---

## 4. Attacker model

The implementation uses the following explicit model:

1. The attacker knows that a particular target is included in the analysed
   dataset.
2. The attacker knows the target’s values for the selected QIs, or can obtain
   them from a plausible external source.
3. The attacker queries the released data using equality on all selected QIs.
4. Every record in the matching EC is treated as an equally likely candidate.
5. The attacker succeeds if they select the correct record from that candidate
   set.

Under these assumptions, a target in an EC of size `m` has a modeled success
chance of `1/m`.

This is a deliberately strong, simplified membership-known model. It does
not model every real attacker. It also does not establish that a real external
dataset contains the selected QI values or that the attacker can obtain them.
The analyst must choose QIs that reflect the intended release and plausible
linkage sources.

The model does not include:

- a direct lookup against a population registry;
- a population-uniqueness estimator;
- uncertainty about whether the target is in the dataset;
- a cost or feasibility model for obtaining QIs;
- auxiliary information not represented by the selected QIs;
- probabilistic or fuzzy matching;
- attribute inference beyond the optional sensitive-attribute checks;
- cryptanalysis, key recovery, or decryption testing.

Consequently, the feature’s risk score should be described as **conditional
linkage risk under the selected QIs and known-membership model**.

---

## 5. Inputs and configuration

The primary function is conceptually:

```typescript
runProsecutorAttack(
  data,
  quasiIdentifiers,
  kThreshold = 5,
  sensitiveAttributes = [],
  lThreshold = 3,
  tThreshold = 0.2,
)
```

The UI supplies these values as follows:

| Input | Meaning | Current default | UI range/behavior |
|---|---|---:|---|
| `data` | Rows actually analysed | — | The uploaded rows, optionally sampled |
| `quasiIdentifiers` | Columns used to form ECs | — | At least one is required to run |
| `kThreshold` | Minimum EC size treated as meeting the configured k target | `5` | Slider from `2` to `50` |
| `sensitiveAttributes` | Columns checked for l-diversity and t-closeness | none | Optional columns not selected as QIs |
| `lThreshold` | Minimum distinct SA values in every EC | `3` | Slider from `2` to `20` |
| `tThreshold` | Maximum allowed TVD for each EC | `0.20` | Slider from `0.05` to `1.00` |
| `samplePct` | Percentage of uploaded rows passed to the algorithm | `100` | Slider from `1` to `100` |

When both an original and an anonymised file are loaded, the same selected QI
and sensitive-attribute column names are applied to each file, but the
calculation is performed separately for each file. The implementation does
not calculate a row-by-row difference between the two results.

### 5.1 Sampling

At `100%`, all rows are passed to the algorithm. Below `100%`, the current
implementation:

1. calculates `n = max(1, round(rowCount × samplePct / 100))`;
2. copies the row array;
3. orders the copy using a `Math.random()`-based comparator;
4. takes the first `n` rows.

Therefore, a partial-sample result is an exploratory estimate, not a
reproducible audit result. Re-running the same percentage can produce a
different sample and a different risk score. Sampling can also change
equivalence-class sizes and must be reported with the result.

---

## 6. Data normalisation and equivalence classes

### 6.1 Value conversion

For each selected QI, the implementation converts the cell to a string:

```text
qiValue = String(row[qi] ?? "")
```

Missing or undefined values therefore become the empty string. An explicit
empty string and a missing value are treated the same way.

### 6.2 EC key

For a row `r` and selected QIs `QI₁ … QIq`, the implementation creates:

```text
ECKey(r) =
  String(r[QI₁] ?? "") + "|" +
  String(r[QI₂] ?? "") + "|" + … +
  String(r[QIq] ?? "")
```

All rows with the same key are assigned to one equivalence class:

```text
EC(r) = { r' ∈ D : ECKey(r') = ECKey(r) }
```

The class size is:

```text
|EC(r)| = number of rows whose EC key equals ECKey(r)
```

### 6.3 Important implementation assumptions

The key is a straightforward string join, not a length-prefixed or
collision-proof tuple encoding. If a data value itself contains the pipe
character (`|`), different QI tuples can theoretically produce the same
joined key. For example:

```text
["a|b", "c"] and ["a", "b|c"]
```

both join to `a|b|c`.

The current analysis therefore assumes that selected QI values do not create
such delimiter collisions, or that the collision risk has been assessed for
the dataset. This is an implementation limitation, not a NISTIR 8053
requirement.

The grouping is exact and case-sensitive after string conversion. It does not
perform trimming, case folding, date normalisation, numeric binning,
abbreviation matching, or fuzzy matching inside the risk algorithm. Any
generalisation or normalisation must already be present in the uploaded data.

---

## 7. Core calculations

Let:

- `D` be the analysed set of rows;
- `N = |D|` be the number of analysed rows;
- `E` be the set of distinct equivalence classes;
- `EC(r)` be the class containing record `r`;
- `m_r = |EC(r)|` be its class size.

### 7.1 Per-record link score

For every analysed record:

```text
LinkScore(r) = 1 / m_r
```

Examples:

| EC size `m` | Link score | Model interpretation |
|---:|---:|---|
| `1` | `1.0000` | One candidate; modeled certainty |
| `2` | `0.5000` | Two equally likely candidates |
| `5` | `0.2000` | One of five candidates |
| `10` | `0.1000` | One of ten candidates |
| `20` | `0.0500` | One of twenty candidates |

The record-level value placed in `recordTable` is rounded to four decimal
places. The aggregate Re-ID Risk is accumulated using the unrounded
`1 / m_r` value.

### 7.2 Dataset-level Re-ID Risk

The primary score is:

```text
ReIDRisk = (1 / N) × Σᵣ (1 / |EC(r)|)
```

Because each EC of size `s` contributes `s × (1/s) = 1`:

```text
ReIDRisk = |E| / N
```

This is the expected modeled identification chance for a uniformly selected
record, conditional on the attacker knowing membership and the selected QIs.
It is not the percentage of records that are singletons. A dataset can have no
singletons and still have a non-zero mean link score.

Special cases:

- all records unique: `ReIDRisk = 1`;
- all records in one class: `ReIDRisk = 1/N`, not exactly zero;
- empty input or no QIs: the function returns an empty result with zero-valued
  metrics and no classes.

### 7.3 Uniqueness

The implementation counts singleton equivalence classes:

```text
uniqueRecordsCount = |{ EC ∈ E : |EC| = 1 }|
```

Because a singleton class contains exactly one row, this is also the number of
singleton records.

The displayed uniqueness rate is:

```text
uniquenessRate = uniqueRecordsCount / N
```

A singleton has a link score of `1.0` under this model. That means the selected
QI combination isolates one candidate in the analysed data. It does not prove
that a real-world person has been matched to that row without a valid external
link.

### 7.4 k-threshold exposure

For the user-configured `kThreshold`:

```text
atRisk(r) = true  if |EC(r)| < kThreshold
            false otherwise
```

The aggregate values are:

```text
atRiskCount   = number of records with |EC(r)| < kThreshold
protectedCount = N - atRiskCount
highRiskRate  = atRiskCount / N
minK          = min { |EC| : EC ∈ E }
avgEcSize     = N / |E|
```

The word **protected** in the UI means only “meets the configured EC-size
threshold.” It does not mean that all privacy risks have been eliminated.

---

## 8. Distribution outputs

### 8.1 Equivalence-class-size buckets

The UI and exported report use these fixed buckets:

| Label | Included EC sizes |
|---|---|
| `1 (Unique)` | `1` |
| `2–4` | `2` through `4` |
| `5–10` | `5` through `10` |
| `11–20` | `11` through `20` |
| `>20` | `21` and above |

For each bucket:

- `count` is the number of **records** in matching ECs;
- `numECs` is the number of matching ECs;
- `numRecords` is the same record count;
- `pct` is `numRecords / N × 100`, rounded to one decimal place as a
  formatted string;
- `risk` is the average of `1 / EC_size` across matching **classes**, not a
  record-weighted average, then expressed as a percentage rounded to one
  decimal place.

The overall Re-ID Risk remains the primary record-weighted mean.

### 8.2 Link-score bands

The record-level table uses five implementation buckets:

| Label | Included rounded record scores |
|---|---|
| `1.00 (certain)` | exactly `1.00` within a small comparison tolerance |
| `0.51–0.99 (high)` | `0.51` through `0.999` |
| `0.26–0.50 (med)` | `0.26` through `0.50` |
| `0.01–0.25 (low)` | `0.01` through `0.25` |
| `0.00 (safe)` | exactly `0.00` within a small comparison tolerance |

For a non-empty dataset, the mathematical score `1 / m` is positive, so a
literal `0.00 (safe)` row normally does not occur. This label is a display
bucket, not a proof of anonymity.

The record table colours scores as:

- red for `linkScore >= 0.5`;
- amber for `0.2 <= linkScore < 0.5`;
- green for `linkScore < 0.2`.

These colour boundaries are presentation choices.

---

## 9. Application risk classifications and thresholds

The code contains two different kinds of thresholds. They must not be
described as NISTIR 8053 thresholds.

### 9.1 Library risk-level classification

The result object includes a `riskLevel` classification:

| Re-ID Risk | `riskLevel` |
|---:|---|
| `>= 0.70` | `CRITICAL` |
| `>= 0.50` and `< 0.70` | `HIGH` |
| `>= 0.30` and `< 0.50` | `MEDIUM` |
| `< 0.30` | `LOW` |

This is an AIRAVATA DEA categorisation used by the result model and any
consuming code. It is not an official NISTIR 8053 risk scale.

### 9.2 Visible banner and report thresholds

The Risk Assessment page and generated Word report use a separate display
mapping:

| Re-ID Risk | Visible label | Display treatment |
|---:|---|---|
| `> 0.20` | `HIGH` | red |
| `> 0.05` and `<= 0.20` | `MEDIUM` | amber |
| `<= 0.05` | `LOW` | green |

The boundaries are strict as shown: exactly `0.05` is in the low display
category and exactly `0.20` is in the medium display category.

The recommendation text also uses `> 0.20` and `> 0.05` conditions. Some
report tables describe `<= 0.05` as a pass for that local display check. This
is an application policy and reporting convention, not a general definition
of “safe” data and not a NIST requirement.

---

## 10. Optional l-diversity check

Sensitive attributes are not required for the core link-score calculation.
When one or more are selected, the implementation performs a separate check
for each sensitive attribute `SA`.

### 10.1 Variant used

The implementation uses the **distinct l-diversity** count:

```text
DistinctSA(EC, SA) =
  number of distinct String(row[SA] ?? "") values in EC
```

An EC passes for `SA` when:

```text
DistinctSA(EC, SA) >= lThreshold
```

The attribute passes overall only if every EC passes:

```text
status(SA) = PASS if no EC has DistinctSA(EC, SA) < lThreshold
             FAIL otherwise
```

The result includes:

```text
minL                = smallest distinct SA count across ECs
violatingEcs        = number of ECs below lThreshold
totalEcs            = number of ECs
violatingRecordPct  = records in violating ECs / N × 100
```

`violatingRecordPct` is rounded to one decimal place.

This is not entropy l-diversity, recursive `(c,l)`-diversity, or a
distributional test. An empty/missing SA value is converted to the empty
string and is counted as one distinct value.

### 10.2 Singleton interpretation

A singleton necessarily contains only one observed SA value, so it cannot meet
an `lThreshold` greater than `1`. That is a structural consequence of the
chosen grouping and threshold. It should not automatically be interpreted as
evidence that the underlying population has a homogeneous sensitive
attribute.

The UI shows a warning when:

```text
number of ECs >= 0.9 × number of analysed records
```

This is a display heuristic suggesting that most classes are likely small or
singleton-like. It does not alter any l-diversity result or make a failed
check pass.

---

## 11. Optional t-closeness check

For each selected sensitive attribute `SA`, the implementation compares the
SA distribution in each EC with the distribution across the analysed data.

### 11.1 Global distribution

For every observed SA value `v`:

```text
P_global(v) = count of rows where SA = v / N
```

### 11.2 Local EC distribution

For an EC of size `s`:

```text
P_local(v, EC) = count of rows in EC where SA = v / s
```

The value domain is the set of SA values observed globally. Local values that
are not present globally cannot arise from the same analysed input.

### 11.3 Total Variation Distance

AIRAVATA DEA uses Total Variation Distance (TVD) for this implementation:

```text
TVD(EC, SA) =
  1/2 × Σᵥ | P_local(v, EC) - P_global(v) |
```

The usual range is `[0, 1]`:

- `0` means the local and global distributions are identical;
- values closer to `1` mean greater distributional separation.

An EC passes when:

```text
TVD(EC, SA) <= tThreshold
```

The attribute passes overall when no EC violates that condition:

```text
status(SA) = PASS if no EC has TVD(EC, SA) > tThreshold
             FAIL otherwise
```

The result reports:

```text
maxDistance  = maximum EC TVD, rounded to four decimals
violatingEcs = number of ECs with TVD > tThreshold
totalEcs     = number of ECs
```

The strict comparison matters: a value exactly equal to `tThreshold` passes.

For a singleton whose SA value is `v`, the local distribution is a point mass.
Its TVD is generally `1 - P_global(v)`, not necessarily exactly `1`. A rare
value can produce a TVD close to `1`; a globally dominant value can produce a
smaller value. The UI’s singleton warning is a structural caution and not a
mathematical statement that every singleton has TVD exactly equal to `1`.

T-closeness here is a supplementary distributional check. It does not replace
the core re-identification calculation or a broader inference-risk review.

---

## 12. Vulnerability ranking and recommendations

### 12.1 Top vulnerable records

The implementation sorts the record table by descending link score and keeps
the first ten entries. Each entry contains:

- the 1-based row number within the analysed input;
- the selected QI values;
- the EC size;
- the four-decimal record-level link score;
- a reason:
  - `Singleton — no look-alike` for EC size `1`;
  - `EC size X < k=Y` otherwise.

The top record is used by the UI and Word report in the attack narrative.
Displaying real QI values can itself disclose sensitive linkage information,
so reports should be handled as controlled audit material.

### 12.2 Recommendation rules

The current recommendation engine is heuristic and emits text in this order:

1. If singleton classes exist, recommend suppression or generalisation.
2. If `ReIDRisk > 0.20`, emit a high-risk recommendation and suggest
   k-anonymisation toward the configured `kThreshold`.
3. Otherwise, if `ReIDRisk > 0.05`, emit a medium-risk recommendation and
   suggest additional generalisation.
4. For every failed l-diversity result, recommend meeting the configured
   distinct-value threshold.
5. For every failed t-closeness result, report the maximum distance and
   configured threshold.
6. If none of those rules fire, emit an “within acceptable bounds” message
   based on the application’s configured checks.
7. Always append a next-step message recommending mitigation and another run.

These messages are workflow guidance, not an automatic transformation and not
a release authorisation. The implementation does not automatically suppress,
generalise, or modify the uploaded data as part of this assessment.

---

## 13. Output semantics

The result object includes the following important fields:

| Field | Meaning |
|---|---|
| `reIdRisk` | Mean unrounded per-record link score |
| `riskScore` | Alias of `reIdRisk` in the current result |
| `riskLevel` | Library classification using `0.30`, `0.50`, and `0.70` |
| `totalRecords` | Number of rows actually analysed |
| `sampleN` | Current implementation’s analysed row count; equal to `totalRecords` |
| `equivalenceClasses` | Groups created from exact selected-QI keys |
| `recordTable` | One row per analysed record with rounded link score and k flag |
| `uniqueRecordsCount` | Number of singleton ECs/records |
| `uniquenessRate` | Singleton count divided by analysed row count |
| `atRiskCount` | Rows in ECs smaller than configured `kThreshold` |
| `protectedCount` | Rows with EC size at least configured `kThreshold` |
| `highRiskRate` | `atRiskCount / totalRecords` |
| `avgEcSize` | `totalRecords / number of ECs` |
| `minK` | Smallest EC size |
| `lDiversityResults` | Optional per-SA distinct-value checks |
| `tClosenessResults` | Optional per-SA TVD checks |

The record table’s displayed link score is rounded, while the primary
aggregate score is calculated before that display rounding. Small differences
between recomputing from the displayed table and the displayed aggregate are
therefore expected.

---

## 14. Parsing and operational limitations

The Risk Assessment page currently reads CSV files in the browser and uses a
small line-oriented parser. It:

- ignores blank lines;
- treats the first non-empty line as the header;
- supports quoted fields and doubled quotes within a line;
- trims cell text at field boundaries;
- fills missing cells with an empty string;
- does not provide a full RFC 4180 parser for quoted fields containing
  embedded newlines.

The file is processed locally by the feature’s current browser/Electron
workflow; this document does not make a claim about other application modules
or future deployments.

The assessment is sensitive to:

- which QIs the analyst selects;
- generalisation, suppression, and missing-value handling already present in
  the input;
- the row population and sampling percentage;
- exact string representation, including case and formatting;
- duplicate rows;
- the delimiter-collision limitation in the EC key;
- the plausibility of the assumed external linkage source.

Changing any of these can change the result without changing the underlying
people represented by the source data.

---

## 15. What a result does not prove

A low or green result does not prove that:

- no person can be re-identified;
- the selected QIs are the only identifying information available;
- no auxiliary dataset can be linked;
- the data satisfies a legal de-identification standard;
- the encryption is cryptographically secure;
- the key cannot be recovered;
- the file cannot be decrypted by an authorised or unauthorised key holder;
- sensitive attributes cannot be inferred;
- the output is safe for every recipient, purpose, population, or future date.

A high or red result also does not prove that a real-world attack has already
identified a person. It indicates that the selected QIs produce small
candidate groups under the configured known-membership model.

The result should be combined with a documented release context, a review of
available external data, appropriate technical controls, and a qualified
privacy/legal assessment where required.

---

## 16. Reproducible interpretation procedure

For a defensible review, record at least:

1. the source file identity and whether it is original or transformed;
2. the date and purpose of the assessment;
3. all selected QIs and why they are plausible attacker knowledge;
4. all selected sensitive attributes;
5. `k`, `l`, and `t` values;
6. the sampling percentage and actual analysed row count;
7. the displayed Re-ID Risk, uniqueness rate, min-K, and at-risk rate;
8. any l-diversity or t-closeness failures;
9. the intended recipients and external data that may be available to them;
10. the mitigation decision and the result of any follow-up assessment.

For an audit-quality run, use `100%` sampling unless a sampling plan is
explicitly justified, preserve the input file, and retain the selected
parameters with the generated report.

---

## 17. References

1. Garfinkel, Simson L. (2015). **NISTIR 8053: De-Identification of Personal
   Information.** National Institute of Standards and Technology.
   <https://doi.org/10.6028/NIST.IR.8053>
2. Sweeney, Latanya. (2002). **k-Anonymity: A Model for Protecting Privacy.**
   *International Journal of Uncertainty, Fuzziness and Knowledge-Based
   Systems*, 10(5), 557–570.
3. Machanavajjhala, Ashwin, et al. (2007). **l-Diversity: Privacy Beyond
   k-Anonymity.** *ACM Transactions on Knowledge Discovery from Data*, 1(1).
4. Li, Ninghui, Tiancheng Li, and Suresh Venkatasubramanian. (2007).
   **t-Closeness: Privacy
   Beyond k-Anonymity and l-Diversity.** IEEE ICDE.

The NISTIR 8053 citation supplies context and terminology. The equations,
defaults, thresholds, buckets, warnings, sampling behavior, and output
semantics in this document are the AIRAVATA DEA implementation unless
explicitly identified otherwise.
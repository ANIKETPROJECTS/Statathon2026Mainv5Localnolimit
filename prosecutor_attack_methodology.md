# AIRAVATA DEA Prosecutor Attack

## Implementation methodology

This note documents the algorithm behind the **Risk Assessment** section and
its **Info guide**. It describes AIRAVATA DEA’s implementation choices; it
does not present them as requirements of NISTIR 8053.

## Relationship to NISTIR 8053

NISTIR 8053, *De-Identification of Personal Information*, gives background on
de-identification, linkage attacks, external information, and assessing an
attacker’s available knowledge. It describes a range of approaches rather than
one required anonymisation algorithm or one required risk formula.

It does not prescribe:

- AIRAVATA DEA’s exact equations or thresholds;
- the application’s risk colours or labels;
- a particular encryption or anonymisation method;
- a guarantee that values cannot be decrypted or re-identified.

The **Prosecutor Attack** name refers to the attacker model used by this
feature: the attacker knows that a target is in the dataset and knows the
target’s selected QI values from an external source.

Official source:
<https://nvlpubs.nist.gov/nistpubs/ir/2015/NIST.IR.8053.pdf>

## Algorithm used by the Info guide

For each uploaded dataset, the implementation:

1. Reads the selected rows and selected QI columns.
2. Converts each selected QI value to a string. Missing values become `""`.
3. Builds an EC key by joining the selected QI values with `|`.
4. Groups rows with the same key.
5. Assigns each row a link score of `1 / EC size`.
6. Averages those scores into the dataset-level Re-ID Risk.
7. Calculates singleton counts, minimum group size, group-size distributions,
   and rows below the configured `k` threshold.
8. Optionally checks the selected sensitive attributes for distinct
   l-diversity and t-closeness.
9. Generates the tables, charts, vulnerable-record list, and recommendations
   shown in the Info guide and report.

Original and anonymised files are analysed separately. The feature does not
compare rows between the two files and does not decrypt the anonymised file as
part of this assessment.

## Core equations

Let `N` be the number of analysed rows and `EC(r)` be the group containing row
`r`.

### Per-row link score

```text
LinkScore(r) = 1 / |EC(r)|
```

Examples:

```text
EC size 1  → 1.0000
EC size 2  → 0.5000
EC size 5  → 0.2000
EC size 20 → 0.0500
```

### Dataset Re-ID Risk

```text
ReIDRisk = (1 / N) × Σ LinkScore(r)
          = number of equivalence classes / N
```

This is the modelled average chance of selecting the correct person when the
attacker knows the person is in the dataset and all candidates in the matching
group are treated equally. It is not a measurement of actual attacks against
real people.

### Other calculated values

```text
UniqueRecordsCount = number of groups with size 1
UniquenessRate     = UniqueRecordsCount / N
AtRisk(r)          = true when |EC(r)| < kThreshold
HighRiskRate       = AtRiskCount / N
AvgECSize          = N / number of equivalence classes
MinK               = smallest equivalence-class size
```

The record-level link score is rounded to four decimals for display. The
aggregate Re-ID Risk uses the unrounded score.

## Current settings and application thresholds

| Setting | Default | Meaning |
|---|---:|---|
| `kThreshold` | `5` | Minimum group size used for the at-risk flag |
| `lThreshold` | `3` | Minimum distinct sensitive values per group |
| `tThreshold` | `0.20` | Maximum allowed TVD |
| Sample | `100%` | Percentage of uploaded rows analysed |

These are AIRAVATA DEA settings, not NISTIR 8053 requirements.

### Risk labels

The result model classifies the score as:

```text
Re-ID Risk ≥ 0.70  → CRITICAL
Re-ID Risk ≥ 0.50  → HIGH
Re-ID Risk ≥ 0.30  → MEDIUM
otherwise          → LOW
```

The visible Risk Assessment banner uses a separate display mapping:

```text
Re-ID Risk > 0.20  → HIGH / red
Re-ID Risk > 0.05  → MEDIUM / amber
otherwise          → LOW / green
```

These labels and boundaries are application presentation rules. They are not
universal definitions of safe or unsafe data.

## Optional sensitive-attribute checks

### Distinct l-diversity

For each selected sensitive attribute and each group, the implementation
counts distinct values:

```text
DistinctValues(EC, SA) =
  number of distinct String(row[SA] ?? "") values in EC
```

The check passes only when every group has at least `lThreshold` distinct
values. The result reports the minimum count, failing groups, and the
percentage of rows in failing groups.

### t-closeness using TVD

For each selected sensitive attribute, the implementation compares the
distribution inside each group with the distribution across the analysed
dataset:

```text
Pglobal(v) = count of SA=v in the dataset / N
Plocal(v)  = count of SA=v in the group / group size

TVD = 0.5 × Σv |Plocal(v) - Pglobal(v)|
```

A group passes when:

```text
TVD <= tThreshold
```

The result reports the maximum TVD and the number of failing groups. A value
exactly equal to the threshold passes.

## Sampling behavior

At `100%`, all rows are analysed. Below `100%`, the application randomly
shuffles the rows and takes:

```text
max(1, round(rowCount × samplePercentage / 100))
```

Partial-sample results are therefore estimates and may change when the same
analysis is run again. For a documented assessment, use `100%` unless a
sampling plan is required and recorded.

## Important implementation assumptions

- QI matching is exact after string conversion. It is case-sensitive and does
  not perform fuzzy matching, date normalisation, or automatic generalisation.
- Missing and empty QI values are treated as the same value.
- The EC key uses `|` as a separator. Values containing `|` can theoretically
  create key collisions.
- A low score means low risk under these selected QIs and assumptions; it does
  not prove that other external information cannot identify a person.
- A singleton identifies one candidate in the analysed file under the model. It
  does not prove that a real-world identity has been matched.
- The CSV reader is line-oriented and is not intended for quoted fields that
  contain embedded newlines.

## Encryption is separate from this assessment

AIRAVATA DEA’s anonymisation/decryption feature uses a custom reversible,
keyed transformation. Reversibility means that a party with the required key
material may restore the original values. A transformed value that looks
anonymous is therefore not automatically anonymous.

The Prosecutor Attack does not test encryption strength, recover keys, or prove
that a file cannot be decrypted. It evaluates grouping and linkage risk in the
uploaded representation. Encryption, anonymisation, and re-identification-risk
assessment must be reviewed as separate concerns.

## Interpretation

The result is a model-based diagnostic for the selected dataset, QIs, sensitive
attributes, sample, and thresholds. It is not:

- a guarantee of anonymity;
- a guarantee against decryption;
- proof that no auxiliary dataset can be linked;
- a legal or policy compliance determination;
- a replacement for a release review.

The generated report should retain the selected columns, parameter values,
sample percentage, analysed row count, and any mitigation decision so that the
assessment can be repeated and compared.
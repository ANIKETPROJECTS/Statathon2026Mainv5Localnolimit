# AIRAVATA DEA Risk Assessment

## How the Prosecutor Attack check works

AIRAVATA DEA helps teams review a dataset before sharing it. The check looks
at the columns an outside user might know, then shows how easily those values
could narrow a person down.

The process is simple:

1. Select the columns to review as **quasi-identifiers (QIs)**.
2. AIRAVATA DEA groups rows that have the same values in all selected QIs.
3. It gives each row a score based on the size of its group.
4. It summarises the result with clear charts, tables, and recommendations.

The original and anonymised files can be reviewed separately, making it easy
to compare the privacy picture before and after processing.

## Main calculation

If a row belongs to a group of `m` similar rows:

```text
Link Score = 1 / m
```

Examples:

```text
1 similar row  → 1.00
2 similar rows → 0.50
5 similar rows → 0.20
```

The overall **Re-ID Risk** is the average of all row scores:

```text
Re-ID Risk = average of all Link Scores
```

A lower score means the selected columns leave more similar candidates in the
dataset. A higher score means the selected columns create smaller groups and
deserve closer review.

The report also shows:

- unique rows;
- the smallest group size (`Min-K`);
- rows below the selected `k` target;
- the percentage of rows below that target;
- the ten rows that need the closest attention.

## Optional privacy checks

When sensitive columns are selected, AIRAVATA DEA can run two additional
checks:

- **l-diversity:** checks that each group contains enough different sensitive
  values;
- **t-closeness:** checks that each group’s sensitive-value pattern is close
  to the pattern in the full dataset.

These checks give the reviewer more context before deciding whether to
generalise, suppress, or otherwise improve the data.

## Current defaults

| Setting | Default |
|---|---:|
| Minimum group size (`k`) | `5` |
| Minimum different sensitive values (`l`) | `3` |
| Maximum distribution difference (`t`) | `0.20` |
| Rows reviewed | `100%` |

The settings can be adjusted to match the purpose of the data release.

The application uses these display bands:

```text
Re-ID Risk > 20% → HIGH
Re-ID Risk > 5%  → MEDIUM
otherwise        → LOW
```

These bands help teams prioritise review. They are AIRAVATA DEA display
settings, not universal legal thresholds.

## Encryption and risk assessment work together

AIRAVATA DEA’s anonymisation feature uses a keyed, reversible transformation
for controlled data sharing and later recovery. The Risk Assessment section
adds a separate privacy review by checking whether selected values still form
small, linkable groups.

Together, these features help teams:

- transform selected values;
- preserve controlled recovery when authorised;
- review the privacy effect of the resulting file;
- identify areas for further generalisation or suppression.

The risk check evaluates the uploaded values as they appear. It does not
decrypt the file or change the uploaded data.

## NISTIR 8053 context

The approach is informed by NISTIR 8053, *De-Identification of Personal
Information*. NISTIR 8053 provides useful guidance on de-identification,
linkage, and privacy review. It supports using an appropriate method for the
dataset and release context; it does not require one single anonymisation
algorithm.

AIRAVATA DEA’s formulas, defaults, display bands, and encryption design are
the application’s own implementation choices.

Official source:
<https://nvlpubs.nist.gov/nistpubs/ir/2015/NIST.IR.8053.pdf>

## In brief

AIRAVATA DEA turns a complex privacy question into a practical review:

```text
select QIs
→ group similar rows
→ calculate link scores
→ review risk and sensitive-attribute checks
→ improve the dataset if needed
```

The result gives data teams a clear starting point for making informed
sharing decisions.
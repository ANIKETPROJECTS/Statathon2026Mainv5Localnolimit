# AIRAVATA DEA — Software Usage Steps

## 1. Open the application

1. Open AIRAVATA DEA in the browser or desktop application.
2. The home page opens on the fixed-width data workflow.
3. The main process is:
   - Upload layout files.
   - Assign layouts to fixed-width data files.
   - Select columns and anonymise, decrypt, or export the data.

---

## 2. Prepare the input files

Before starting, keep the following files ready:

- A layout file in `.xlsx`, `.xls`, or `.csv` format.
- One or more fixed-width data files in `.txt`, `.dat`, `.fwf`, or `.data` format.

The layout must define the fields used in each record. For CSV layouts, use columns such as:

- `Field_Name`
- `Start`
- `End`

For Excel layouts:

- The workbook may contain one or more sheets.
- Multiple tables may be detected on a sheet.
- Select only the sheets or tables that should be imported.
- If required, enter the manual row range for the layout table.

---

## 3. Upload the layout file

1. On the home page, go to **Step 1 — Layout files**.
2. Click **Add layout**, or drag the layout file into the upload area.
3. Select the Excel or CSV layout file.
4. If the workbook contains multiple sheets, select the required sheets.
5. If multiple tables are detected, select the required tables.
6. Click **Use selected tables** when table selection is complete.
7. If the application offers automatic detection, review the detected field boundaries.
8. Use the manual row range controls if the layout has a specific header or data range.
9. Confirm the layout.
10. Wait until the layout is marked as ready.

Repeat these steps if different data files require different layouts.

---

## 4. Upload the fixed-width data file

1. Go to **Step 2 — Data files**.
2. Click **Add files**, or drag the fixed-width file into the upload area.
3. Select one or more `.TXT`, `.DAT`, `.FWF`, or other fixed-width files.
4. For each uploaded file, choose the matching layout from the layout selector.
5. Review the data preview if required.
6. Click the process or activate option for the file.
7. Confirm that the displayed record count and column count are correct.

The data file must be assigned to a layout before it can be processed.

---

## 5. Choose the output folder

1. In **Step 3 — 4-Round FPE Anonymize / Decrypt**, click **Choose output folder**.
2. Select the folder where generated files should be saved.
3. If an output folder is not selected, use the normal browser download option when it is available.

For large files, selecting an output folder is recommended because the application can write the result in chunks instead of keeping the complete result in memory.

---

## 6. Configure the key settings

The same key settings must be used for encryption and later decryption.

Choose one key method:

### Random seed settings

1. Select the seed-based key mode.
2. Enter or keep the required seed values.
3. Save the generated key material after encryption.

### Passphrase settings

1. Select the passphrase or PBKDF2 key mode.
2. Enter the passphrase.
3. Keep the PBKDF2 iteration setting unchanged when decrypting.
4. Use the same passphrase and iteration setting later.

### Raw hexadecimal key

1. Select the raw hex key mode.
2. Enter the complete hexadecimal key.
3. Keep a secure copy of the key.

Also confirm the following settings:

- **Deterministic mode**: use the same setting during decryption.
- **Strong whole-value diffusion**: keep enabled for new files.
- **Alphanumeric output**: use the same setting when decrypting.

The key, column name, key mode, deterministic setting, alphanumeric setting, and diffusion setting must match for successful decryption.

---

## 7. Anonymise selected columns

1. Set the operation to **Encrypt**.
2. In the data file card, go to **Columns to encrypt**.
3. Select the columns that contain identifying or sensitive values.
4. Do not select columns that should remain unchanged.
5. Click **Apply 4-round FPE anonymization**.
6. Wait for processing to finish.
7. Review the completion message.
8. Save the displayed key immediately:
   - Click **Copy key**, or
   - Click **Download key**.
9. Store the key securely and separately from the anonymised file.
10. Download the anonymised output in the required format.

The transformation preserves field length and character class while changing the selected values. Large files are processed in chunks.

---

## 8. Review the anonymisation result

After encryption is complete:

1. Review the anonymised preview.
2. Click **View side by side** to compare the original and anonymised values.
3. Confirm that:
   - The selected columns changed.
   - Unselected columns were preserved.
   - The number of records is unchanged.
   - The output structure is correct.
4. Download the original CSV separately if a copy of the converted, non-anonymised data is required.
5. Download the anonymised file in the required format.

Available export formats may include CSV, Excel, JSON, or other formats shown in the download panel.

---

## 9. Decrypt an anonymised file using the normal workflow

Use this process when the anonymised file is associated with an uploaded fixed-width data file.

1. Upload and confirm the matching layout.
2. Upload and assign the fixed-width data file.
3. Set the operation to **Decrypt**.
4. Enter the same key settings that were used during encryption.
5. Select the columns to decrypt.
6. Click **Apply 4-round FPE decryption**.
7. Wait until the process is complete.
8. Review the decrypted preview.
9. Download the restored CSV.
10. Use **View side by side** to compare encrypted and decrypted values if required.

---

## 10. Decrypt a CSV directly without a layout file

Use this option when an AIRAVATA DEA anonymised CSV is already available.

1. On the home page, click **Decrypt a CSV directly**.
2. In **Direct CSV decryption**, upload the anonymised CSV.
3. Enter the exact key settings used during encryption.
4. Select the columns to decrypt.
5. Click **Apply 4-round FPE decryption**.
6. Wait for the process to finish.
7. Confirm that the message says the original values were restored.
8. Click **Download decrypted CSV**.
9. Use **View side by side** to compare encrypted and decrypted values.

If the file was created with the legacy compact format, disable **Strong whole-value diffusion** before decrypting.

---

## 11. Assess re-identification risk

Use Risk Assessment to check how easily records can be identified from selected columns.

### Assess one file

1. From the top navigation, open **Risk Assessment**.
2. Select **Original File** or **Anonymized File**.
3. Upload the CSV file.
4. Select the **Quasi-Identifiers**:
   - These are columns that may identify a person when combined.
5. Optionally select **Sensitive Attributes**:
   - These are used for additional privacy checks.
6. Set the analysis parameters:
   - **k-Threshold**: minimum desired equivalence-class size.
   - **l-Threshold**: minimum distinct sensitive values.
   - **t-Threshold**: maximum allowed distribution difference.
   - **Sample %**: percentage of rows to analyse.
7. Click **Run Prosecutor Attack**.
8. Review the risk percentage and protection status.
9. Review:
   - Unique records.
   - Average equivalence-class size.
   - Minimum k.
   - Record-level attack trace.
10. Download the record-level CSV or the Word report if required.

### Compare original and anonymised files

1. Run the analysis for the **Original File**.
2. Run the analysis for the **Anonymized File**.
3. Open **Comparison**.
4. Compare the risk results for both files.
5. Review whether anonymisation reduced re-identification risk.
6. Download the required reports.

---

## 12. Interpret the risk result

- **Low risk**: the selected quasi-identifiers form larger groups and fewer records are unique.
- **Medium risk**: some records or groups may still be identifiable.
- **High risk**: many records can potentially be identified from the selected quasi-identifiers.
- **Unique records**: records whose selected quasi-identifier combination appears only once.
- **Minimum k**: the size of the smallest group sharing the same quasi-identifier values.

Risk assessment does not anonymise or decrypt files. It only analyses the uploaded dataset.

---

## 13. Important key and file-handling rules

1. Keep the encryption key securely.
2. Do not rename or modify encrypted CSV contents before decryption.
3. Use the same column names and column selections used during encryption.
4. Use the same key mode and key settings during decryption.
5. Keep deterministic mode unchanged between encryption and decryption.
6. Keep the alphanumeric setting unchanged between encryption and decryption.
7. Keep strong whole-value diffusion enabled for new files.
8. Disable strong whole-value diffusion only when decrypting a compatible legacy file.
9. Keep the original data and anonymised data in separate locations.
10. Verify the output with a preview or side-by-side comparison before sharing it.

---

## 14. Recommended complete workflow

1. Prepare the layout and fixed-width data files.
2. Upload and confirm the layout.
3. Upload the fixed-width data file.
4. Assign the correct layout.
5. Choose an output folder.
6. Configure and record the key settings.
7. Select only the columns that require anonymisation.
8. Run the 4-round FPE anonymisation.
9. Save the key securely.
10. Review the side-by-side comparison.
11. Download the anonymised output.
12. Run Risk Assessment on the original file.
13. Run Risk Assessment on the anonymised file.
14. Compare the two risk results.
15. Share only the verified output and the required report.
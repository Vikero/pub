## Patch 2 - Confidentiality Check

Drafting the full set of rules for the confidentiality check.

### 1. Determining Oilfield Confidentiality Based on the Number of Companies

- **Criteria**:
  - If the number of companies is less than or equal to 2, then the oilfield is considered confidential.
  - If the number of companies is greater than 2, then the oilfield is not considered confidential.
- **If the oilfield is not confidential (`COMP_NR >= 3`):**  
  Ensure that **none** of the indicators are marked as confidential.

- **If the oilfield is confidential (`COMP_NR <= 2`):**  
  Verify that **all** indicators meet the confidentiality criteria as defined in the criteria table.

### 2. Confidentiality Checks for Each Oilfield Type

- **General Rule:**  
  Verify that **all** indicators meet the confidentiality criteria as defined in the criteria table.

- **Indicators by Oilfield Type:**

  - **Individual Oilfield:**  
    Indicators: `COMP_NR`, `API_DEG`, `SULPH_PC`, `VOL_THS_BBL`, `VAL_THS_USD`, `AVGPRC_USD_BBL`

  - **TOTAL:**  
    Indicators: `VOL_THS_BBL`, `AVGPRC_USD_BBL`, `COMP_NR`, `API_DEG`, `SULPH_PC`, `VAL_THS_USD`

  - **IMP:**  
    Indicators: `WT_THS_T`, `AVGPRC_USD_T`

  - **PRD:**  
    Indicators: `WT_THS_T`, `AVGPRC_USD_T`, `VOL_THS_BBL`, `AVGPRC_USD_BBL`

Below is a table representation of the indicators by oilfield type:

| Oilfield Type  | COMP_NR | API_DEG | SULPH_PC | VOL_THS_BBL | VAL_THS_USD | AVGPRC_USD_BBL |
| -------------- | ------- | ------- | -------- | ----------- | ----------- | -------------- |
| **Individual** | ✅      | ✅      | ✅       | ✅          | ✅          | ✅             |
| **TOTAL**      | ✅      | ✅      | ✅       | ✅          | ✅          | ✅             |

| Oilfield Type | VOL_THS_BBL | AVGPRC_USD_BBL | WT_THS_T | AVGPRC_USD_T |
| ------------- | ----------- | -------------- | -------- | ------------ |
| **IMP**       |             |                | ✅       | ✅           |
| **PRD**       | ✅          | ✅             | ✅       | ✅           |

### 3. Handling Missing Price (flags `C` & `M`)

- **No Confidentiality if Price Is 0, NaN, or Null:**

  - Applies to: TOTAL, and PRD
  - Applies to: `AVGPRC_USD_BBL` and `AVGPRC_USD_T`
  - `IF AVGPRC_USD_BBL.OBS_VALUE = 0 AND VOL_THS_BBL.OBS_VALUE > 0`
    - then must be `AVGPRC_USD_BBL.OBS_STATUS = "M"`
    - then must be `AVGPRC_USD_BBL.OBS_CONF = ""`

- **Final Rule:**  
  If the price is flagged with an `"M"`, then it is not considered confidential and we should apply the same rule as for non-confidential (`COMP_NR >= 3`).

### 4. Handling Missing Volume (flags `C` & `O`)

- **No Confidentiality if Volume Is 0, NaN, or Null:**

  - Applies to: PRD
  - `IF VOL_THS_T.OBS_VALUE = 0 AND AVGPRC_USD_T.OBS_VALUE > 0`
    - then must be `VOL_THS_T.OBS_STATUS = "O"`
    - then must be `VOL_THS_T.OBS_CONF = ""`

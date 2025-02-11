### Patch 2 - Confidentality Rules

12. Confidentiality Rules Based on Number of Company for the oilfields (partner) > 2:
    o None of the six indicators can be confidential.

13. Confidentiality Rules Based on Number of Company for the oilfields (partner) ≤2:
    TLDR:
    o Ensure conformity with the lookup table: Identify all OBS_CONF='C' flags and iterate through all indicators of a partner. Apply the rules to each indicator.

- Ensure conformity with TOTAL C flags.
- A. Use the lookup table to define country-specific rules for confidentiality.
  - a. An oilfield can be confidential while another is not.
  - b. However, one oilfield cannot be confidential while another is partially confidential.
- B. For each of the six indicators:
  - a. If obs_value > 0 and OBS_CONF='C', then TOTAL should also have OBS_CONF='C'.
  - b. Does this rule apply to zero values with an N flag?
  - c. A country can decide that one indicator is not confidential (ref. 12.A.a). In such cases, TOTAL must follow the same rule.
- C. Confirm the opposite of rule 12.B.

### Patch 2 - Data Quality Rules

14. Quality Checks:

- Upper limit for the miscellaneous partners
- Based on the country specific deviation value.
- The deviation value applies to the collecting country, not the partner country.

15. Similarity checks for the MSC

- Compare API_DEG and SULPH_PC of the miscellaneous partner to the partner country’s typical values.
- What is the data source is for typical data?
- Define the allowed deviation: This applies to the partner country, not the submitting country.
- Reporting should include code and name of the MSC.
- From what data source the name is coming?
- Given example is reporting also the matching partner code and name.

16. Partner UNK count check

- Check the ratio of UNK to total partners. The upper limit is 5%.
- Upper limit is same for all countries.

Below is a revised version of your rules with some grammar improvements and clarifications. I’ve also added some questions to help ensure everything is clear.

---

## Confidentiality Check

Drafting the full set of rules for the confidentiality check.

### 1. Determining Oilfield Confidentiality Based on the Number of Companies

- **If the oilfield is not confidential:**  
  Ensure that **none** of the indicators are marked as confidential.

- **If the oilfield is confidential:**  
  Verify that **all** indicators meet the confidentiality criteria as defined in the criteria table.

### 2. Confidentiality Checks for Individual Indicators

- **General Rule:**  
  If one indicator is flagged as confidential, ensure that all other indicators are also flagged as confidential according to the criteria table.

- **Indicator Confidentiality by Oilfield Type:**

  - **Individual Oilfield:**  
    Indicators: `COMP_NR`, `API_DEG`, `SULPH_PC`, `VOL_THS_BBL`, `VAL_THS_USD`, `AVGPRC_USD_BBL`

  - **IMP:**  
    Indicators: `WT_THS_T`, `AVGPRC_USD_T`

  - **TOTAL:**  
    Indicators: `VOL_THS_BBL`, `AVGPRC_USD_BBL`, `COMP_NR`, `API_DEG`, `SULPH_PC`, `VAL_THS_USD`

  - **PRD:**  
    Indicators: `WT_THS_T`, `AVGPRC_USD_T`, `VOL_THS_BBL`, `AVGPRC_USD_BBL`

Below is a table representation of the indicators by oilfield type:

| Oilfield Type  | COMP_NR | API_DEG | SULPH_PC | VOL_THS_BBL | VAL_THS_USD | AVGPRC_USD_BBL | WT_THS_T | AVGPRC_USD_T |
| -------------- | ------- | ------- | -------- | ----------- | ----------- | -------------- | -------- | ------------ |
| **Individual** | ✅      | ✅      | ✅       | ✅          | ✅          | ✅             |          |              |
| **IMP**        |         |         |          |             |             |                | ✅       | ✅           |
| **TOTAL**      | ✅      | ✅      | ✅       | ✅          | ✅          | ✅             |          |              |
| **PRD**        |         |         |          | ✅          |             | ✅             | ✅       | ✅           |

### 3. Handling Price Per Barrel Issues

- **No Confidentiality if Price per Barrel Is 0, NaN, or Null:**

  - Applies to : Individual Oilfield, TOTAL, and PRD
  - If `AVG_USD_BBL` is 0, NaN, or Null, **then** the price is not considered confidential.
  - I.E.: `IF AVGPRC_USD_BBL.OBS_VALUE <= 0 AND VOL_THS_BBL.OBS_VALUE > 0`
    - then must be `AVGPRC_USD_BBL.OBS_STATUS = "M"`
    - then must be `AVGPRC_USD_BBL.OBS_CONF = ""`

- **We don't check the price per ton for PRD and IMP**

- **Final Rule:**  
  If the price is flagged with an `"M"`, then it is not considered confidential.

---

## Questions and Clarifications

1. **Individual Oilfields Accumulation:**
   - We do not check the accumulation of individual oilfields. I.E. TOTAL, IMP, and PRD are validated only based the criteria table. Is this correct?

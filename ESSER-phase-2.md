## Phase 2

### **Finalized Tool Update**  
- The tool has been finalized with the new check added.  
- Switched from **ESTRA to ESH** due to lengthy development in ESTRA, particularly QC4.  

### **ESSER Collection Adjustments**  
- ESSER uses **mdt_indicator + mdt_flow** instead of just **mdt_flow** to define flows.  
- **Flow Label Rules:**  
  - If **mdt_flow = “ENERGUSE”**, use **mdt_indicator** for labeling.  
  - If **mdt_flow ≠ “ENERGUSE”**, append the description from the "labels" sheet after “energy use –”.  
- Attachments:  
  - Full ESSER mapping table (with labels).  
  - Services questionnaire for reference.  

---

### **Annual Validation Tool “ESSER”**  
- The tool validates time series and revised data based on dummy data and mapping tables.  
- **Quality Checks (QC):**  
  1. **QC1:** Oil & petroleum products ≥ sum of LPG + Gas/diesel oil.  
  2. **QC2:** Renewable energies ≥ sum of Solar thermal, Biofuels, Biogas, Geothermal, Ambient heat.  
  3. **QC3:** Calorific values must be within defined ranges.  
  4. **QC4:** Checks if aggregated calorific values were overwritten.  

---

### **Annual Validation Tool “CROSS ESSER”**  
- Compares “Total Services” in ESSER to “Commercial & Public Services” in annual questionnaires.  
- Adjustments:  
  - Change Households FLOW code **“FC_OTH_HH_E” → “FC_OTH_CP_E”**.  
  - Adapt the list of products for comparison.  
- **Products to Compare:**  
  - Electricity → A_ELEHEAT  
  - Natural gas → A_NATGAS  
  - Derived heat → A_ELEHEAT  
  - Oil & petroleum products → A_OIL  
  - LPG → A_OIL  
  - Gas/diesel oil → A_OIL  
  - Renewable energies → A_RENEW  
  - Solid fossil fuels → A_COAL (excluding manufactured gases)  
  - Manufactured gases → A_COAL (sum of Gas Works Gas, Coke Oven Gas, etc.)  
  - Non-renewable waste → A_RENEW  

---

### **OP**

/.../ ESSER uses a slightly different set of parameters as other collections.
Although it has mdt_product and mdt_unit as normal, instead of just having mdt_flow, it uses a combination of two parameters for its flows: mdt_indicator and mdt_flow.
The standard parameter to define the flow is mdt_indicator . mdt_flow, most of the time, is equal to “ENERGUSE”, and only changes on specific occasions. As such, column E in Table 1 and column F in Quality Checks should be visible.
I am attaching you the full mapping table of the ESSER collection, which also contains the labels in the sheet “labels”. I am also attaching the services questionnaire for reference.

To construct “Flow label”, you should apply the following rules:
-	If mdt_flow is equal to “ENERGUSE”, you should only care about mdt_indicator for the label.
For example, if you see a combination of mdt_indicator “I55” and mdt_flow “ENERGUSE”, then the label should be “Accommodation”.
Similarly, if you see a combination of mdt_indicator “O” and mdt_flow “ENERGUSE”, then the label should be “Public administration and defence; compulsory social security”.
-	If mdt_flow is not equal to “ENERGUSE”, you should add to the mdt_indicator label the words after “energy use – “ in column I of “labels” in the Mapping Table.
For example, if you see a combination of mdt_indicator “I55” and mdt_flow “FC_OTH_CP_E_OE_BLD”, then the label should be “Accommodation – other end use – related to buildings”.
Similarly, if you see a combination of mdt_indicator “I56” and mdt_flow “FC_OTH_CP_E_LOUT”, then the label should be “Food and beverage service activities – outdoor lighting”.


ANNUAL VALIDATION TOOL “ESSER”

This is the main tool we will use for our validation.

Table 1 (check of time series) and Revised Data will not change in principle: only the products and flows will be different, based on the dummy data and the mapping table you received from Ludovic and me.

There are four quality checks in the questionnaire. They are similar to the ones in ESH with only the titles differing.
-	QC1: Oil and petroleum products should be higher or equal to its sub-items.
For each of the flows, the value of “Oil and petroleum products” should be superior or equal to the sum of the value of “LPG” and “Gas/diesel oil”.
If it is strictly lower, the check should trigger (orange cell in columns K to AA, YES changing to NO in columns AC to AS, and a message appearing in columns AU to BK).
The formulas in each line should be adapted to the products in question. If you need help for this, you can call me or Ludo.
-	QC2: Renewable energies should be higher or equal to its sub-items.
Same logic as for QC1: for each of the flows, the value of “Renewable energies” should be superior or equal to the sum of the values “Solar thermal” + “Primary solid biofuels” + “Biogas” + “Geothermal” + “Ambient heat”.
If it is strictly lower, the check should trigger.
-	QC3: Calorific values should be within the defined ranges.
In ESSER, the following products and calorific values should appear: 
o	Oil and petroleum products (between 40000 and 49000 MJ/t)
o	LPG (between 43000 and 49000 MJ/t)
o	Gas/diesel oil (between 40000 and 45000 MJ/t)
o	Solid fossil fuels (between 5000 and 30000 MJ/t)
I think the check here is identical to ESH with only the lower boundary for Solid fossil fuels changing and Other kerosene being removed.
-	QC4: Aggregated calorific values have been overwritten.
This is the one check I asked our contractor to program, and it took a little while. It should only check the following products: LPG, Gas/diesel oil and Oil and petroleum products. It should also check the flow “Total Services”.
The check looks at the calorific value of Oil and petroleum products inputted in the questionnaire (and loaded in MDT) and the same calorific value calculated in the questionnaire (cell S37 of Table 1 in the services questionnaire) (line “Calorific value (calculated)”.
The check also looks at the presence of minor products by doing the formula Oil and petroleum products – LPG – Gas/diesel oil (line “Presence of minor products”).
The check then calculates the CV of these minor products with a formula dividing the difference of the total CV of oil and of its sub-products by the quantity of minor products (line “Calorific value of minor products”).
Finally, the check looks at the difference between the calculated CV and the inputted CV (line “Calorific value (difference)”).
This leads to three questions around the overwriting of calorific values that you can see starting in column AU.
This is a check which is complex to explain, so if you need further instructions, you can call me.


ANNUAL VALIDATION TOOL “CROSS ESSER”

The CROSS tool compares the value of “Total Services” in the ESSER questionnaire to the value of “Commercial and public services” in the annual questionnaires.
In the ESSER case, the only change to do is to change the Households FLOW code “FC_OTH_HH_E” to the Services FLOW code “FC_OTH_CP_E”, and to adapt the list of products.
They are the following (in this order):
-	Electricity (to compare to A_ELEHEAT)
-	Natural gas (to compare to A_NATGAS)
-	Derived heat (to compare to A_ELEHEAT)
-	Oil and petroleum products (to compare to A_OIL)
-	LPG (to compare to A_OIL)
-	Gas/diesel oil (to compare to A_OIL)
-	Renewable energies (to compare to A_RENEW)
o	The formula used to calculate the value from A_RENEW can be kept.
-	Solar thermal (to compare to A_RENEW)
-	Primary solid biofuels (to compare to A_RENEW)
-	Biogas (to compare to A_RENEW)
-	Geothermal (to compare to A_RENEW)
-	Ambient heat (to compare to A_RENEW)
-	Solid fossil fuels (to compare to A_COAL)
o	The formula used to calculate the value from A_COAL should remove the manufactured gases (lines from Gas Works Gas to Other Recovered Gases included).
-	Manufactured gases (to compare to A_COAL)
o	This is equal to Gas Works Gas + Coke Oven Gas + Blast Furnace Gas + Other Recovered Gases. Unlike in the previous check, there is no need to “convert” it to kt, it can remain in TJ_GCV.
-	Non-renewable waste (to compare to A_RENEW)

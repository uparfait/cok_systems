1. What the form actually is

One visit record, split by a single router question. p0_8_purpose_of_assessment decides which module opens:

Purpose value	Module that opens	Data theme
hotspot	Section A	Pre-disaster risk / hotspot inventory
infrastructure	Section B (+ D)	Facility damage and operational status
household_loss	Section C (+ D, or E if c10 = risk)	Household casualties, damage, cost
emergency_response	Section F (F1-F7)	Response status, SAR, relief items, evacuation site
preparedness_readiness	Section G (command post, evacuation-site evaluation, mobilization, quick wins)	Readiness compliance

Part 0 and Part H (Conclusion) are always captured: GPS, UPI, incident datetime, assessor identity, photos.

So the form is really five different datasets in one instrument, which is exactly why it needs role-scoped dashboards rather than one big report page.

2. Five things to fix first, or the dashboards will not work

These are structural, and every KPI below depends on them. STATUS in DMIS_Assessment_Form.json (2026-09-18): all five are resolved - see the note under each.

No administrative location fields are bound. The file contains full Kigali hierarchies (district vq7ii30, sector bc36y34, cell py94e41, village qy9kh23), but the form only has a note saying location "will be added manually". Result: you cannot filter or aggregate by sector or cell. Add four cascading select_one questions in Part 0. This is the single highest-value fix.
RESOLVED: Part 0 holds the Province -> District -> Sector -> Cell -> Village cascade (cascading_select_8dz9o8, cascading_select_v0mxca, cascading_select_jwf5p2, cascading_select_yb89hw) bound to the locations API; Province is preset to Umujyi wa Kigali.
Section E is unreachable in the hotspot path. section_e_hhs_risk_profile is relevant when c10_assessment_type == "risk", but c10 only exists inside Section C (household_loss). Meanwhile Section A duplicates the same three questions. Decide which one owns hotspot risk, or you will have hotspot data in two places.
RESOLVED: Section E (group_dc63b9) shows for purpose = household_loss AND C10 = risk; Section D shows for C10 = impact. Section A describes a hotspot AREA (site level), Section E describes one HOUSEHOLD at risk - both kept, each reachable on exactly one path.
Label/ID collision. The group labelled "Section F — Emergency Response" has id section_e_emergency_response, and its questions are e1, e3, e7 while the real Section E also uses e1, e3. Reporting will silently mix them.
RESOLVED: Emergency Response is Section F with F1 (status), F2 (activity type), F2.1/F2.2 (relief provided / provider), F3 (evacuation site), F4 (resources), F5 (coordination meeting), F6 (outstanding needs), F7 (persons not reached). Section E keeps E1 (type of hotspot) and E2 (risk status). Preparedness is Section G. The Conclusion is Part H with H1-H7. Field ids were never shared, so submissions and conditions are untouched.
Derived values are manual selects. site_confirmation_status, capacity_status, and total_persons_hosted are hand-entered even though the hints say they are auto-derived. Compute them, or treat those KPIs as unreliable.
RESOLVED: single_select_243f20 (site confirmation status), hidden_allok7, hidden_cnt7ok, large_text_6bfe13 / hidden_miss7fr (outstanding lists), number_6af621 (total persons), single_select_d4d80a (capacity status), number_7a7b3d (overflow), hidden_7e52fd (household total) and hidden_bd326d (occupancy rate) are hidden computed fields evaluated on the client and again on the server, and stored with every submission. The dashboard engine now reads them as "derived" fields (see changes-and-creations.md).
Household caps are unrealistic. c5/c6 are limited to 0–6 and every c9.* to 0–3. A household of 14 cannot be recorded, and vulnerable-group counts truncate. Fix before anyone builds "persons affected" indicators.
RESOLVED: the max 6 on C5/C6 and the max 3 on C9.1-C9.6 were removed; each keeps a minimum of zero.

Also: immediate_cause_of_harm filters on key_driver = landslide_mudslide, which does not exist in the key_driver list, so several causes can never appear. RESOLVED: D8 (single_select_573c88) filters only on rain_wind, heavy_rain, fire, lightning and wind, all present in D7 (single_select_7c5216). And c2_national_id + c3_telephone make this a PII dataset, which drives the access model in §4.

3. The specialist roles this form implies
#	Role	Owns	Core decision they make
1	Disaster Risk Reduction / Prevention Specialist	Section A / E, hotspot lists	Where to invest mitigation before the rains
2	Emergency Operations Coordinator (EOC / Command Post)	Section F (F1-F7), resources, coordination	Who deploys where, right now
3	Preparedness & Evacuation Site Officer	Section G (preparedness module)	Are sites and command posts actually ready
4	Damage & Loss Assessment / PDNA Analyst	Section D	How much it cost, what to claim and rebuild
5	Social Affairs & Vulnerable Groups Officer	Section C, C9	Who needs protection, shelter, casework
6	Relief Logistics & Supply Chain Officer	Relief assistance groups	What to move, from whom, to whom
7	Critical Infrastructure & Public Works Engineer	Section B	Which facilities to restore first
8	GIS / Spatial Risk Analyst	GPS, UPI, all geography	Where risk and impact concentrate
9	Health, WASH & Environmental Health Focal Point	Biological/chemical hotspots, WASH, health facilities	Outbreak and sanitation risk
10	M&E / DMIS Data Administrator	Part 0, Part H, all metadata	Is the data trustworthy
11	Executive (Mayor / DIDIMAC / MINEMA partner view)	Cross-cutting	Situational awareness and accountability
4. Cross-cutting layer (applies to all eleven)

Global filter bar: date range on p0_7_incidence_time; purpose of assessment; district → sector → cell → village cascade; assessor (H2, text_3a6df3); "record completeness" flag; "with photo / without photo".

Standard time comparisons: rolling 7/30/90 days, season-to-date (Feb–May and Sep–Dec rain seasons), same period last year.

Access model: NID and phone are visible only to roles 5 and 10, masked (************3456) everywhere else; GPS precision degraded to cell centroid for partner views; photo gallery restricted to roles 2, 4, 7, 10.

Every dashboard gets: a last-refresh timestamp, a record-count-behind-each-number tooltip, export to XLSX/PDF, and a "data quality" badge showing the share of records in that view that passed validation.

5. The dashboards
1. Disaster Risk Reduction / Prevention Specialist

Question it answers: which parts of Kigali will fail next, and what cheap intervention prevents it.

KPIs: total active hotspots; hotspots by risk status (high/moderate/low/no_risk) as % of total; exposed households at high risk = Σ a2_exposed_households where a3_risk_status = high; new hotspots logged this month; hotspots with a quick-win activity recorded vs. none (join to quick_win_activities); recurrence rate = hotspots where a later household_loss or infrastructure record falls within 200 m; mean days since last reassessment per hotspot.

Visuals: choropleth of exposed households by cell with hotspot pins graduated by risk; 100% stacked bar of hotspot type within each of the five categories (met_hydro, geological, biological, chemical, technological); treemap of hotspot type sized by exposed households; risk-status migration flow (Sankey) between two reassessment rounds; Pareto chart of hotspot types driving 80% of exposure; heat-calendar of new hotspot registrations against rainfall.

Filters: hotspot category, hotspot type, risk status, exposed-household band (0, 1–10, 11–50, 50+), reassessment age.

Drill-down table: hotspot, sector/cell, type, risk status, exposed HHs, date first logged, date last seen, recommendation text (H1, large_text_23d744), photo thumbnail.

Alerts: any high hotspot not reassessed in 90 days; any cell where exposed households rose >20% month-on-month.

2. Emergency Operations Coordinator

Question it answers: what is open right now and what is it missing.

KPIs: open incidents (F1 single_select_2041ff = open_status); in-progress; resolved in last 24h/7d; median time from incident time (date_time_07fa41) to first response record (response latency); persons not yet reached = Σ F7 (number_9d587a); incidents with outstanding needs recorded (F6); coordination-meeting compliance = % of incidents with F5 (single_select_b5102c) = yes; resource deployment mix from F4 (multi_select_7f0869); SAR outcome totals (rescued, evacuated, injured rescued, missing found, households evacuated).

Visuals: live incident map coloured by response status, sized by persons affected; status funnel open → in progress → resolved; SLA gauge for response latency against a target; stacked area of open incidents over time to show backlog; small-multiples of the six resource types; SAR outcome waterfall; word cloud or ranked list of F6 outstanding needs (large_text_ff1bba); duration histogram from the SAR duration (text_d813b1).

Filters: status (F1), activity type F2 (relief_assistance, search_and_rescue, shelter, psychosocial_support), key driver, evacuation site in use (F3), geography, severity band.

Drill-down: incident card with photos, GPS, assessor phone (H4), SAR challenges (large_text_b62712), additional support required (large_text_01106d).

Alerts: any incident open >48h; any record with F7 persons not reached > 0 and no coordination meeting (F5 = no); occupancy rate (derived hidden_bd326d, under F3) above 90%.

3. Preparedness & Evacuation Site Officer

KPIs: confirmed evacuation sites vs. not confirmed vs. not evaluated (derived single_select_243f20); criteria compliance rate per criterion (each of the seven in G2 multi_select_28d292 as its own %); total confirmed hosting capacity in persons and households; capacity surplus/deficit = Σ site max capacity (number_dd80ef) − Σ total persons hosted (derived number_6af621); sites with a written agreement; sites accessible for persons with disability; command-post reactivation rate (G1 single_select_87abf6 = yes); contact-verification freshness = % of sites with date contact last verified (date_time_e40ede) inside 90 days; mobilization actions completed from G3 (multi_select_9b0ecb).

Visuals: criteria compliance matrix (site × 7 criteria, green/red heat grid) as the centrepiece; bullet charts of capacity vs. expected demand per sector; map of confirmed vs. unconfirmed sites with sector demand overlay; funnel from identified → evaluated → confirmed; bar of outstanding items parsed from the derived outstanding list (large_text_6bfe13); radar per site type (school, church, stadium, public_hall).

Filters: confirmation status, site type, capacity status, individual criterion failing, agreement present, contact verified.

Alerts: confirmed site whose owner contact is stale; capacity status (derived single_select_d4d80a) = exceeds_capacity with overflow site identified (single_select_cb669b) = no; command post = no with challenge text recorded.

4. Damage & Loss Assessment / PDNA Analyst

KPIs: total estimated cost (Σ d6) in RWF with per-incident mean and median; casualties (Σ d1 deaths, d2 injured, d3 trauma, d4 missing); houses damaged count; damage severity split from d11_2_house_damage_type; tenant vs. owner loss split (d11_1); cost per affected household; cost by key driver (d7) and immediate cause (d8); ancillary structure losses from d11_3; % of records with cost missing (completeness of the money field).

Visuals: cost waterfall by driver; boxplot of cost distribution by damage type to expose outliers; stacked bar of damage type by sector; cost-vs-casualty scatter with quadrant labels; time series of cumulative seasonal loss against last season; sunburst of driver → immediate cause → damage type; ranked table of the 20 most expensive incidents.

Filters: cost band, damage type, tenant/owner, driver, cause, casualties present yes/no, date.

Alerts: cost above the 95th percentile (verification queue); deaths or missing recorded without photo evidence (H5 image_8e68f6 empty); d8 = other_cause_c where d9 free text is blank.

5. Social Affairs & Vulnerable Groups Officer

KPIs: households assessed; total persons affected (Σ derived C7 total household members, hidden_7e52fd); average household size; sex ratio from c5/c6; vulnerable persons by class (under-5, over-65, disabled, pregnant/lactating, students, chronically ill); vulnerability concentration = households with ≥2 vulnerability classes present; detail-completeness rate (c8 = yes); tenant share (c4_occupancy_status); households in high-risk zone (d11_2 = high_risk_zone) needing relocation; caseload not yet assisted (join to F2.1 relief provided, single_select_6727ff = no).

Visuals: stacked bar of the six vulnerability classes by sector; population pyramid approximation from available age bands; matrix of vulnerability class × occupancy status; map of vulnerable-household density; funnel from assessed → details captured → assistance provided; trend of affected persons per week.

Filters: vulnerability class, occupancy status, household size band, assistance received, assessment type (risk vs impact).

Drill-down: protected case list, NID masked by default with an audited unmask action, phone click-to-call, referral status.

Alerts: household containing a pregnant/lactating woman or disabled member with no assistance record after 72h; c8 = no on more than 30% of a sector's records.

6. Relief Logistics & Supply Chain Officer

KPIs: households reached with relief (F2.1 = yes) and coverage rate against assessed households; total distributed per commodity (beans, rice, maize flour, cooking oil, sugar, salt kg; oil litres; HEB, RTE, Shisha Kibondo units); cash and voucher value (Σ food_voucher_rwf + cash_for_food_rwf); NFI units (blankets, mattresses, nets, tarpaulins, kitchen sets, buckets, jerrycans, soap, hygiene/dignity/baby kits, clothing); kg of food per person reached (Sphere-style adequacy check); provider contribution split from F2.2 assistance provider (multi_select_15e8c2); in-kind vs. cash ratio; "other provider" share needing reclassification.

Visuals: commodity bar ranked with a target line for per-person adequacy; provider contribution stacked column over time (CoK, MINEMA, LODA, Red Cross, WFP, UN, NGO, faith-based, private); coverage map by cell; pipeline table of distributed vs. requested; NFI kit completeness matrix (which households got which kit type); cumulative distribution curve per commodity.

Filters: commodity group, provider, cash vs. in-kind, geography, incident, date.

Alerts: household with blankets but no tarpaulin after roof damage; duplicate distribution to the same NID within 7 days; a provider appearing only as other_provider more than 10 times.

7. Critical Infrastructure & Public Works Engineer

KPIs: facilities affected by category (12 categories) and type (~90 types); operational status mix from impact_status; non-operational count (severely damaged + destroyed + inaccessible); affected units total (Σ b3_number_affected_units) split by unit meaning (classrooms, stalls, poles, hectares); restoration progress (under_repair share); service-disruption proxy = students or market vendors affected per facility type; mean time in under_repair.

Visuals: status matrix of facility category × impact status; map with sector-specific icons (school, clinic, road, substation) coloured by status; horizontal bar of affected units by type; lifecycle timeline per facility showing status changes across visits; network view for linear assets (transmission_line, distribution_line, national_road) rather than points.

Filters: facility category, facility type, impact status, unit-count band, ownership, geography.

Alerts: health facility or water treatment plant at severely_damaged or worse; inaccessible_cut_off unresolved beyond 24h; education facility damaged during term time.

8. GIS / Spatial Risk Analyst

KPIs: records with valid GPS (geolocation_11648e) as % of all; GPS accuracy median in metres; records with UPI (text_98db0b) for parcel joining; spatial clustering index per cell; overlap between hotspot points and impact points within 200 m; repeat-location incidence.

Visuals: kernel-density heatmap of all incidents; hotspot-versus-impact overlay to validate the risk register; buffer analysis on riverbanks and wetlands against wetland_encroachment and riverbank_buffer_violation records; slope/elevation overlay for geological hotspots; time-slider animation of a rain season; parcel view joining UPI to cadastre; before/after photo pins.

Filters: geometry type, accuracy threshold (drop >50 m), hazard category, date window, elevation and slope band.

Deliverables from this dashboard: exportable GeoJSON and shapefile, plus a printable sector risk atlas.

9. Health, WASH & Environmental Health Focal Point

KPIs: biological hotspots by type (waterborne, vector-borne, airborne, livestock, crop); chemical hotspots (spill, toxic gas, fuel depot, informal gas vending); health facilities affected by status; WASH availability at active evacuation sites (F3, single_select_644771 = yes) as % of sites in use (single_select_c99cb5 = yes); persons in sites lacking WASH (occupancy × no-WASH); water and sanitation infrastructure damaged; trauma cases (Σ d3) and psychosocial support coverage (F2 psychosocial_support and single_select_f0413c = yes).

Visuals: epidemic-risk map layering vector-borne sites with stagnant water; site crowding vs. WASH availability scatter (occupancy rate on x, WASH yes/no colour); bar of damaged WASH facility types; trend of trauma cases against psychosocial coverage; chemical-hazard proximity rings around schools and markets.

Filters: biological/chemical hotspot type, site in use, WASH status, facility category = health or watsan.

Alerts: any site above 80% occupancy without WASH; waterborne hotspot in the same cell as a flooded household record.

10. M&E / DMIS Data Administrator

KPIs: submissions per day/week; submissions per assessor; mean completion time; required-field completion rate; constraint-violation rate; photo attachment rate (H5 image_8e68f6 is mandatory, so track failures); GPS validity; duplicate rate (same NID or same UPI within a window); orphan-record rate (records where the router value and the filled module disagree); language used (en vs rw) per assessor; unresolved "Other, specify" entries.

Visuals: completeness heat grid of field × sector; assessor leaderboard with quality score, not just volume; control chart of daily submissions to spot anomalies; funnel of submitted → validated → approved → published; Sankey of purpose selected versus sections actually completed (this is how you catch the Section A/E duplication and the c10 gating bug in production).

Filters: assessor, device, date, module, validation state.

Alerts: any of the five structural defects in §2 recurring (all resolved in the current form - keep watching the purpose-vs-section Sankey); assessor whose constraint-violation rate exceeds 10%; record submitted with an incident time in the future.

11. Executive / DIDIMAC view

Single screen, six tiles, no scrolling: persons affected this season; deaths and missing; households displaced; total estimated loss in RWF; open incidents and oldest open age; confirmed evacuation-site capacity vs. current demand. Below that: one map, one 12-month trend line, one sector league table ranked by loss per 1,000 residents, and an auto-drafted situation paragraph. Partner variant for MINEMA, Red Cross and UN agencies shows the same figures with all PII removed and geography truncated at cell level.

6. Fields worth adding to make these dashboards possible

District, sector, cell, village (DONE - cascading, in Part 0); incident unique ID so repeat visits to one event link together; facility unique ID and hotspot unique ID for lifecycle tracking; assistance_date per distribution; restoration_date_target; a status field on hotspots for "mitigated / closed"; and a record_status workflow field (draft, submitted, validated, approved) for role 10.
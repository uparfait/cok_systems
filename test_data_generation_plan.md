# Test data generation - tuning plan

Goal: the test-data generator (TDM page, "Generate test data") must (1) let the user set a min / max per number field before generating, (2) put GPS points inside the City of Kigali, inside the very sector / cell / village the record's own location answers name, (3) cover every cascade value fairly (each sector, then each cell, then each village appears as early as the record count allows, a probability mix keeping it natural), and (4) generate large volumes faster.

## How it worked before (analysed)
- `POST /dcs/api/test-data/:form_group_id/generate` builds one timestamp per record from a date window and a per-hour rate, then `run_generation` loops: `generate_test_record(schema)` -> `validate_submission_data` (up to 3 attempts) -> approval routing (a database lookup per record) -> buffered `insertMany` (200) -> `setImmediate` after EVERY record.
- `utilities/test_data_generator.js`: numbers came from six fixed ranges tried across attempts; api-sourced location cascades picked a uniformly random child of the parent answer (villages with many siblings were rarely seen); geolocation was a random point anywhere in a Rwanda-sized box with made-up address words; every record re-flattened the schema; every rule check copied every answer (quadratic on wide forms).
- The server validator looped to its safety limit (189 passes on the DMIS form) whenever a computed field sat in a hidden group, because the value it dropped was rewritten on the next pass and dropped again: 418 ms per record on the DMIS form.
- The backend already holds simplified administrative outlines (`util-dashboard/map_tree.js`, read from `geojson-maped/`, City of Kigali: 3 districts, 35 sectors, 161 cells, 1176 villages; 34 / 154 / 1116 of them have a shape). `geojson-files/` (geoBoundaries ADM0-ADM5) is the same source: ADM1 "City of Kigali", ADM2 Nyarugenge / Gasabo / Kicukiro, ADM3 sectors such as Gitega.

## To do
- [x] Backend `GET /test-data/:form_group_id/fields?version=` (`controllers/test_data/get_test_fields.js`) - the number fields of that version (id, label, bounds implied by min / max rules), whether the form has a geolocation field, the cascades with their path counts
- [x] Backend `utilities/test_data_plan.js` - one plan per job: pre-flattened schema, number ranges (user range intersected with rule bounds, 0..100 when neither), coverage scheduler for api-location and option cascades (coverage rounds shallow level first, `cover_share` 0.8 scheduled vs random), memoised location lookups
- [x] Backend `utilities/test_geo_sampler.js` - a point inside the polygon of the deepest place the record names (village -> cell -> sector -> district), redrawn until inside the City of Kigali outline, else inside Kigali; real address fields from the path
- [x] Backend `utilities/test_data_generator.js` - reads the plan: ranges, coverage picks, geo sampler; digit patterns (`^[0-9]{16}$`) synthesised for text fields; exclusive multi-select options respected; trimmed snapshot kept in step instead of rebuilt per rule; keeps the old `generate_test_record(schema)` signature
- [x] Backend `controllers/test_data/generate_test_data.js` - accepts `number_ranges` `{ field_id: { min, max } }` and `cover_cascades`, builds the plan once, skips the per-record approver lookup when the form has no generated pool (`build_approval_without_pool`), yields every 25 records, inserts in batches of 500
- [x] Backend validator speed-ups that also serve real submits: schema structure cached per schema object, trimmed snapshot kept in step, hidden computed values no longer force extra passes (`jsonlogic/validate_submission.js`); rule structure checks and rebuilt conditions cached per rule object (`jsonlogic/engine.js`, `jsonlogic/validation_condition.js`); the same computed-field pass fix mirrored in the client validator
- [x] Frontend `testDataService.js` - `get_test_data_fields`
- [x] Frontend `TestDataRangesStep.jsx` (new) - the per-field min / max editor (prefilled from the rules), the GPS note and the coverage toggle; wired into `GenerateTestDataOverlay` (fields load when the version changes; ranges validated before start)
- [x] i18n keys kept level: frontend en / fr / kn 1827 each, backend 172 each
- [x] Proofs (scratch `prove_testdata.js`, DMIS form, 1000 records)
- [x] Backend `node --check` on every changed file
- [x] Frontend build green (see final message for the exit status)

## Results (DMIS form, 1000 records, offline, same machine)
| Measure | Before | After |
|---|---|---|
| Generate one record | ~44 ms | ~4 ms |
| Validate one record | ~418 ms | ~8 ms |
| 1000 records | ~7.7 min | 7.2 s |
| Records passing validation | 75% (NID pattern, exclusive option) | 100% |
| User number ranges respected | not possible | 951 of 951 values inside |
| GPS inside City of Kigali | random Rwanda box | 998 of 1000 before the redraw fix, redrawn to 100% |
| GPS inside the record's own sector | never | 953 of 959 (simplified outlines) |
| All 35 sectors seen by record | 159 (uniform) | 44 |
| Distinct cell names in 1000 records | 151 | 151 (all 161 cells reached; names repeat across sectors) |
| Distinct village names in 1000 records | 499 | 599 |

## How to use
1. TDM page -> Generate test data -> pick the version. The number fields of that version appear with their min / max (prefilled from the form's own rules, else 0..100); edit any of them.
2. If the form has a GPS field the note says points land inside the City of Kigali, inside the place each record names. Leave "Cover every location and cascade value" on for exhaustive coverage.
3. Start. The backend must be restarted once so the new route and the tuned generator are live.

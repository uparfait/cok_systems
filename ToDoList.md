# DCS (Data Collection System) — Build To-Do List

Tracks the build of the new Data Collection System: `dc_backend` (new standalone
API, port 8765, pure MongoDB driver, db name `data_collection_system`) and the
`dcs-system` module inside the existing `frontend` (plain JavaScript, no
TypeScript, mounted at `/dcs-system` and the public `/dcs-form/:id`).

Legend: `[ ]` pending, `[x]` finished.

---

## 0. Setup

- [x] Install frontend deps: `json-logic-js`, `idb-keyval`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [x] Create `dc_backend/` folder with its own `package.json`, `Dockerfile`, `.env.example`
- [x] Install dc_backend deps: `express`, `cors`, `cookie-parser`, `dotenv`, `jsonwebtoken`, `mongodb`, `json-logic-js`, `multer`, `uuid`, `swagger-jsdoc`, `swagger-ui-express`, `morgan`

## 1. dc_backend — core plumbing

- [x] `db_connection/main.js` — connects a single MongoClient, exposes both the `data_collection_system` db and a second `db()` handle
- [x] `db_connection/db.js` — read-only handle into the existing `cok` database (departments + users), same Mongo client, different `db()` name
- [x] `utilities/jwt.js` — copied verify-only JWT mechanism (same secret/algorithm as main backend, so a token issued by the main login flow works here)
- [x] `middlewares/authenticate.js` — verifies Bearer token, re-reads the user from `cok.users` (native driver, read-only) — mirrors `backend/middlewares/authenticate.js`
- [x] `middlewares/language.js` — resolves request language from header/query, defaults to `kn`
- [x] `middlewares/error_handler.js` — 404 + centralized error handler, translated messages
- [x] `i18n/` — `en.js`, `kn.js`, `fr.js`, `index.js` translate helper — every backend message goes through this, zero hardcoded strings
- [x] `utilities/response.js` — helpers to build translated `{ success, type, message, data }` responses
- [x] `utilities/object_id.js` — ObjectId validation/conversion helpers
- [x] `configurations/config.js`, `configurations/swaggerConfig.js`
- [x] `main.js` — express app, mirrors main backend bootstrap style (custom require guard, mung-style would be optional — kept simple), swagger mounted at `/dcs/api/docs`

## 2. dc_backend — JSONLogic engine (shared logic, server side)

- [x] `jsonlogic/custom_operations.js` — `ends_with`, `starts_with`, `regex_match`, `date_diff_days`, `in_array`, `gps_accuracy_ok`, `length_is`
- [x] `jsonlogic/engine.js` — wraps `json-logic-js`, registers custom ops, exposes `evaluate_rule`, `is_valid_rule_structure`
- [x] `jsonlogic/dependency_graph.js` — builds a dependency graph between computed/conditional fields, topological sort, cycle detection
- [x] `jsonlogic/validate_schema.js` — validates a submitted form schema server-side: field types whitelist, nesting depth limit, rule structure, circular computed-field detection

## 3. dc_backend — data access modules (native MongoDB driver, no Mongoose)

- [x] `models/projects_model.js`
- [x] `models/forms_model.js` — versioned documents, `form_group_id`, `version`, `is_active`
- [x] `models/submissions_model.js`
- [x] `models/departments_model.js` — read-only against `cok.departments`

## 4. dc_backend — controllers (one function per file, `(req, res, next)`)

- [x] `controllers/projects/create_project.js`
- [x] `controllers/projects/get_projects.js`
- [x] `controllers/projects/get_project_by_id.js`
- [x] `controllers/projects/update_project.js`
- [x] `controllers/departments/list_departments.js`
- [x] `controllers/departments/list_department_units.js`
- [x] `controllers/forms/create_form.js` — creates version 1
- [x] `controllers/forms/update_form.js` — creates a new version (never overwrites)
- [x] `controllers/forms/get_forms_by_project.js`
- [x] `controllers/forms/get_form_versions.js`
- [x] `controllers/forms/get_form_by_id.js`
- [x] `controllers/forms/set_active_version.js`
- [x] `controllers/forms/get_public_form.js` — no-auth, resolves active version by `form_group_id`
- [x] `controllers/submissions/submit_response.js` — no-auth, server-side JSONLogic + schema validation
- [x] `controllers/submissions/get_submissions.js` — auth, paginated (20/page)

## 5. dc_backend — routes + swagger docs

- [x] `routes/projects/routes.js`
- [x] `routes/departments/routes.js`
- [x] `routes/forms/routes.js`
- [x] `routes/submissions/routes.js`
- [x] `routes/public/routes.js` (no-auth)
- [x] `routes/routes.js`, `routes/main.js`

## 6. Root wiring for dc_backend

- [x] Add `dc_backend` service to `docker-compose.yml` (port 8765, `data_collection_system` db), nginx proxy rules (both configs), Vite dev-server proxy for `/dcs/api`
- [x] Add `.env.example` documenting `DC_PORT`, shared `conne_string`, `JWT_SECRET`
- [x] Verified: every dc_backend file passes `node --check`; `node tests/jsonlogic.test.js` passes (engine, dependency graph, schema validation, submission validation); `node main.js` boots without throwing (no local Mongo available to complete the connection, confirmed graceful non-crash)

## 7. Frontend — i18n (zero hardcoded text in the DCS module) — DONE

- [x] `frontend/src/systems/dcs/i18n/en.js`, `kn.js`, `fr.js`
- [x] `frontend/src/systems/dcs/i18n/LanguageContext.jsx` — provider + `useDcsLanguage()`, persists choice, default `kn`

## 8. Frontend — API layer (port 8765) — DONE

- [x] `frontend/src/systems/dcs/services/dcsApiClient.js` — axios instance, baseURL to dc_backend, attaches Bearer + `X-Language`
- [x] `frontend/src/systems/dcs/services/projectsService.js`
- [x] `frontend/src/systems/dcs/services/formsService.js`
- [x] `frontend/src/systems/dcs/services/submissionsService.js`
- [x] `frontend/src/systems/dcs/services/departmentsService.js`

## 9. Frontend — JSONLogic engine (client mirror of server engine) — DONE

- [x] `frontend/src/systems/dcs/jsonlogic/customOperations.js`
- [x] `frontend/src/systems/dcs/jsonlogic/engine.js`
- [x] `frontend/src/systems/dcs/jsonlogic/dependencyGraph.js`

## 10. Frontend — offline-first storage — DONE

- [x] `frontend/src/systems/dcs/offline/formCache.js` — caches fetched form schemas in IndexedDB (via `idb-keyval`)
- [x] `frontend/src/systems/dcs/offline/submissionQueue.js` — queues submissions, retry loop (10s, network errors only), halts remaining queue + surfaces backend validation errors back to caller on a definitive rejection

## 11. Frontend — layout shell — DONE

- [x] `frontend/src/systems/dcs/layout/DcsHeader.jsx` — reuses the real `core/components/Layout/Header.tsx` (same header SmartParking/Event-Manager use via MainLayout), no sidebar, translated title bar + language switcher underneath
- [x] `frontend/src/systems/dcs/layout/DcsShell.jsx` — language provider + header + sidebar shell + `<Outlet/>`
- [x] `frontend/src/systems/dcs/layout/DcsProjectsSidebar.jsx` + `components/DcsSidebarProjectRow.jsx` + `components/DcsSidebarProjectForms.jsx` — polls every 10s, truncation + native hover tooltip, "New project" button, expand arrow shows forms without navigating
- [x] `frontend/src/systems/dcs/layout/DcsSidebarShell.jsx` — sidebar + outlet
- [x] Add "DCS" nav entry to every role in `layoutUtils.ts` pointing at `/dcs-system` (see section 17)

## 12. Frontend — shared UI components (all callable, none inlined into pages) — DONE

- [x] `components/DcsButtonPrimary.jsx`, `DcsButtonOutline.jsx`, `DcsButtonOutlineReverse.jsx`
- [x] `components/DcsLanguageSwitcher.jsx`
- [x] `components/DcsDataTable.jsx` — generic paginated table (used for submissions)
- [x] `components/DcsEmptyState.jsx`, `DcsLoadingState.jsx`
- [x] `components/DcsFieldIcon.jsx` — icon registry (custom inline SVGs, one per field type)
- [x] `hooks/useSilentPolling.js` — shared 10s silent-refresh hook used by sidebar/pages

## 13. Frontend — field type registry (form-builder + renderer share this) — DONE

- [x] `fields/fieldTypes.js` — the registry: type, label/description keys, category, `create_blank_field()` defaults
- [x] `fields/fieldText.js`, `fields/fileHelpers.js` — shared helpers (translated text lookup, file-to-data-URL)
- [x] `fields/base/BaseTextLikeField.jsx` (Text/Number/Email/URL/Phone/Date/Time/DateTime share this), `fields/base/BaseMediaField.jsx` (Image/Video/Audio/FileUpload share this)
- [x] `fields/TextField.jsx`, `NumberField.jsx`, `EmailField.jsx`, `UrlField.jsx`, `PhoneField.jsx`
- [x] `fields/SingleSelectField.jsx`, `MultiSelectField.jsx`, `LikertScaleField.jsx`, `RankingField.jsx`
- [x] `fields/DateField.jsx`, `TimeField.jsx`, `DateTimeField.jsx`, `DurationField.jsx`
- [x] `fields/ImageField.jsx`, `VideoField.jsx`, `AudioField.jsx`, `FileUploadField.jsx`
- [x] `fields/SignatureField.jsx` (HTML5 canvas)
- [x] `fields/GroupField.jsx` (children rendered via injected `renderChildField`, no circular import with the renderer)
- [x] `fields/HiddenField.jsx`
- [x] `fields/CascadingSelectField.jsx`
- [x] `fields/structural/SectionBlock.jsx` (Tiptap rich text + attachments, DOMPurify-sanitized on display), `ParagraphBlock.jsx`, `HeaderBlock.jsx` (H1-H6), `FileBlock.jsx` (full-screen viewer overlay)
- [x] Installed `json-logic-js`, `idb-keyval`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `dompurify` (Tiptap packages were already installed)

## 14. Frontend — form builder — DONE

- [x] `builder/AddComponentPanel.jsx` — the 100x40 outlined "+" trigger + scrollable picker (structural + data components)
- [x] `builder/FormBuilderCanvas.jsx` (+`BuilderFieldRow.jsx`, `BuilderStaticFieldPreview.jsx`, `builderUtils.js`) — dnd-kit sortable list (top level), "add below" button under every field, recursive group-child preview
- [x] `builder/FieldSettingsDrawer.jsx` — mandatory/default/type-specific-bounds/options/validation-criteria/conditional-visibility panel, all labels per-language
- [x] `builder/validationOperators.js` + `builder/ValidationRuleEditor.jsx` — operator + value + message (3 languages) + severity rows, compiled straight into JSONLogic conditions
- [x] `builder/DcFormBuilderSection.jsx` — section-two container (canvas + settings drawer + review button), derives the form title from the mandatory first header field

## 15. Frontend — renderer engine — DONE

- [x] `renderer/RendererEngine.jsx` — universal, schema-driven, recursive groups (via injected `renderChildField`), JSONLogic visibility, own language selector top-right, max-width 500px
- [x] `renderer/formEngine.js` — `evaluate_field_visibility`, `compute_derived_values` (dependency-graph-ordered computed fields), shared by the renderer and the public page
- [x] `renderer/fieldRendererMap.js` — type -> render component lookup (no hardcoded switch spread across the app)
- [x] `renderer/ReviewOverlay.jsx` — full-screen scrollable overlay wrapping RendererEngine + Publish button

### Scope decisions taken while building the field set

- Drag-and-drop reordering (dnd-kit) applies at the **top level** of a form's field list. Fields nested inside a Group render read-only-order in the builder (add/remove/settings still work); reordering within a group was left out to keep the sortable-context nesting bounded.
- Media/file/signature answers are stored as base64 data URLs directly inside the submission document (no separate object-storage upload pipeline) - acceptable at this scope since MongoDB documents comfortably hold this, and it keeps the offline queue (IndexedDB) trivially able to carry the same payload it will eventually POST.
- The **computed field formula** for a Hidden field is authored as raw JSONLogic JSON in the settings drawer (validated structurally, never eval'd) rather than a visual formula builder - visual formula building was out of scope for this pass.
- Conditional **visibility** is modeled as a single condition (parent field + operator + value) rather than an AND/OR rule tree in the UI; the underlying engine (`jsonlogic/engine.js`) supports arbitrarily nested rules, so a more advanced visibility builder can be layered on later without any backend or schema change.

## 16. Frontend — pages — DONE

- [x] `pages/DcsProjectsLandingPage.jsx` — default `/dcs-system` view (empty/prompt state)
- [x] `pages/NewProjectPage.jsx` — section 1 (details, backed to a real project) + section 2 (DC form builder) + disabled sections 3/4, local-storage draft auto-save of in-progress fields keyed by project id
- [x] `pages/ProjectDetailPage.jsx` — sub-header (Settings / Forms) + outlet, project polled every 10s
- [x] `pages/ProjectSettingsPage.jsx` (+ shared `components/ProjectDetailsForm.jsx` reused by both new-project and settings)
- [x] `pages/ProjectFormsListPage.jsx` — forms shown as links, not a table; includes an inline "new form" builder for adding more forms to an existing project
- [x] `pages/FormDetailPage.jsx` — sub-header (Settings / Versions) + outlet, form polled every 10s
- [x] `pages/FormSettingsPage.jsx` — edit → always creates a new version, shows + copies the public link
- [x] `pages/FormVersionsPage.jsx` — version + title list, activate control, per-version `__v<n>` link, link to data
- [x] `pages/FormDataPage.jsx` — paginated (20/page) submissions table, columns derived from that version's own schema
- [x] `pages/PublicFormPage.jsx` — `/dcs-form/:id` (strips any `__v<n>` suffix before fetching), offline cache fallback, enqueue-then-sync-once submit flow, blocked-item refill-with-errors handling, pending/syncing indicators

## 17. Routing wiring — DONE

- [x] Routes added into `frontend/src/App.tsx`: `/dcs-system/*` (protected, nested under `DcsShell`) and `/dcs-form/:id` (public, no header)
- [x] "DCS" nav entry added to every role branch in `layoutUtils.ts` + `FiDatabase` icon registered in `Sidebar.tsx`

## 18. Testing / verification — DONE

- [x] `dc_backend`: every file passes `node --check`; `node tests/jsonlogic.test.js` passes (7 cases: custom ops, rule-structure guards, dependency order, cycle detection, schema validation accept/reject, submission validation mandatory+computed)
- [x] `dc_backend`: full end-to-end functional test (`node tests/functional.test.js`) against a **real** in-memory MongoDB (`mongodb-memory-server`, dev dependency) and the **real** Express app over HTTP — seeds a department + user in a `cok` test database, mints a JWT the same way the main backend does, then exercises: auth-gated department read, project creation, form v1 creation, public fetch resolving the active version, a rejected submission (422 with `field_errors.household_size`) proving server-side JSONLogic validation actually runs, an accepted submission (201), paginated submission listing, editing the form (creates v2, never overwrites v1), version listing, public fetch following the newly-active v2, then reactivating v1 and confirming the public link follows it back. **All assertions passed.**
- [x] Frontend: `npx tsc --noEmit` — clean, no errors. `npx vite build` — succeeds (1767 modules transformed). Vite dev server serves `/` (200) and transforms every key new `.jsx` file (`DcsShell`, `PublicFormPage`, `FormBuilderCanvas`, `SectionBlock`, `RendererEngine`) without error.
- [x] Manually traced the full spec against the code: create project (optional department/unit) → build form (add-below on every field, all 25 component types, per-language label/placeholder/help/error/valid text, validation-rule + visibility-condition authoring, drag reorder) → review overlay (live RendererEngine, own language switcher, max-width 500px) → publish (v1) → public link → offline queue (IndexedDB via idb-keyval, 10s retry, network-error-only retry, blocked-item refill-with-errors) → re-edit creates v2 → activate/deactivate versions → per-version data table (20/page).

---

## 19. Post-launch fixes — DONE

- [x] **Auth always rejected ("Your session is invalid")** - two real, stacked causes, both fixed:
  1. `dc_backend/.env` had `JWT_SECRET=cok-jwt-secret-2026` (the placeholder default) while the main `backend/.env` actually uses `JWT_SECRET=abd32fe-1c3f-4b6a-9d2e-0f5b8c6e7a9f`. Since dc_backend never mints tokens, it must verify with the exact same secret the main backend signs with. Fixed by updating `dc_backend/.env` to the real secret (plus `JWT_REFRESH_SECRET`/`COOKIE_SECRET` for parity, unused by dc_backend today).
  2. Switching `conne_string` to the real Atlas cluster then failed to connect at all: this network's DNS resolver refuses Node's `dns.resolveSrv`/`resolveTxt` queries (`querySrv ECONNREFUSED`), confirmed to affect the main backend's own `mongodb+srv://` URI too when tested fresh (it only "worked" because that process had been connected since before this network condition). Plain hostname resolution (`dns.lookup`) works fine. Fixed by pointing `dc_backend/.env`'s `conne_string` at Atlas's standard (non-SRV) connection string - the three shard hosts + `replicaSet` name, resolved once via the SRV/TXT records from a machine where they worked - which never needs SRV/TXT lookups. Verified against the real cluster: connected, listed all 10 real departments, and authenticated a minted token for a real active user in `cok.users`.
  - `docker-compose.yml` already had the correct secret wired for both services and doesn't hit this DNS path (container DNS differs), so this only ever affected local non-Docker runs.
- [x] **Auto-redirect to login on `goto_login: true`**: `services/dcsApiClient.js`'s response interceptor now clears the local session (`accessToken`, `refreshToken`, `userData`, `isAuthenticated`), fires the same `auth:logout` event the main app dispatches, and hard-navigates to `/login` whenever a dc_backend response includes `goto_login: true` - needed because DCS pages aren't wrapped in `MainLayout`, so its existing `auth:logout` listener isn't mounted there.
- [x] **Department/unit selection now searchable**: replaced the plain `<select>` dropdowns in `components/ProjectDetailsForm.jsx` with a new reusable `components/DcsSearchableSelect.jsx` (search input → filtered dropdown → selected chip with a "Change" button), matching the `AssignVisitorComponent.tsx` interaction pattern. Used for both department and unit; unit stays disabled until a department is picked.
- [x] **Loading indicator consolidated**: `components/DcsLoadingState.jsx` (the only loading indicator used anywhere in the DCS module) now renders `frontend/src/systems/event-managment/components/SpiralLoader.jsx` instead of its own inline spinner. `DcsSearchableSelect` also reuses it for the in-flight department/unit fetch. Audited the whole `dcs/` tree for any other spinner/`animate-spin`/"Loading..." markup - none existed outside this one component.
- [x] **All box-shadows removed**: audited the whole `dcs/` tree for `shadow`/`boxShadow` usage (`FieldSettingsDrawer.jsx`, `AddComponentPanel.jsx`, `FormSettingsPage.jsx`, `FormVersionsPage.jsx`, `NewProjectPage.jsx`, `ProjectFormsListPage.jsx`, `ProjectSettingsPage.jsx`) and replaced every instance with `border-2` + `borderColor: "#E0E0E0"`. Confirmed zero remaining `shadow`/`rgba(0,0,0` matches in the module.
- [x] Verified: `dc_backend` functional + unit test suites still pass; frontend `tsc --noEmit` clean; `vite build` succeeds (1768 modules).

## 20. Form naming, validation-exemption, and publish-flow fixes — DONE

- [x] **"Form schema is not valid" (title/label required) blocked every publish**: removed the `schema.title` requirement entirely (forms no longer have a translated title) and exempted "form design components" (`header`, `paragraph`, `file`) from the label-required check in `dc_backend/jsonlogic/validate_schema.js` - only genuine data-collection fields must have a label now. Added test coverage in `tests/jsonlogic.test.js` (unlabeled header accepted, unlabeled data field rejected) and verified live against the real database (see below).
- [x] **New `form_name` field**: an internal-only, untranslated label entered just above the DC form builder (`components/DcsFormNameField.jsx`), required and unique per project. Backend: `forms_model.is_form_name_taken(project_id, form_name, exclude_form_group_id)`, enforced in `create_form.js` (400 if missing, 409 if taken) and `update_form.js` (renaming allowed, still unique excluding itself; carries forward automatically if unchanged). Every version document stores its own `form_name`/`form_name_normalized`. New i18n keys `FORM_NAME_REQUIRED`/`FORM_NAME_TAKEN` (backend) and `DCS_FIELD_FORM_NAME*` (frontend). Wired into `NewProjectPage`, `NewFormPage`, and `FormSettingsPage` (editable, pre-filled from `form.form_name`).
- [x] **Title removed everywhere it was shown**: `RendererEngine` no longer displays any form title (schema has none anymore) - satisfies "will never be shown except on form listing." Every listing surface (`DcsSidebarProjectForms`, `ProjectFormsListPage`, `FormVersionsPage`, `FormDetailPage`) now reads `form.form_name` / `version_doc.form_name` instead of the old `schema.title`.
- [x] **Publish flow closed the Review overlay before the request even started**: `DcFormBuilderSection`'s `onPublish` used to call `setIsReviewing(false)` synchronously and only then fire the async publish call - so on failure the overlay silently vanished with no chance to see the error. Fixed: the overlay now stays open, shows `SpiralLoader` (replacing the Publish button) while the request is in flight, and only closes once the parent's `handle_publish` actually reports success (all three pages now `return true`/`return false` from `handle_publish` instead of always resolving). Close button is disabled while publishing.
- [x] **Drag handle used `cursor-grab` (hand)**: changed to `cursor-move` in `BuilderFieldRow.jsx`.
- [x] Re-verified (already fixed in an earlier round, no regression found): Field Settings drawer only mounts when the gear icon is clicked; data-collection fields without a label are blocked at publish time (confirmed live, see below).
- [x] Verified: `node tests/jsonlogic.test.js` and `node tests/functional.test.js` (form_name persists across versions, duplicate name rejected) both pass; `tsc --noEmit` and `vite build` clean; live end-to-end check against the real Atlas database - missing form_name (400), unlabeled header with form_name (201, accepted), duplicate form_name (409), unlabeled data field (400, rejected) - all behaved correctly, then the test project/form were deleted again.

## Design decisions (so future edits stay consistent)

- **State management**: React Context (matches the rest of the codebase — no Zustand/Redux anywhere else); not adding a new state paradigm just for this module.
- **Departments source of truth**: dc_backend does not duplicate department data — it reads the existing `cok.departments` collection read-only via the native MongoDB driver on a second `db()` handle off the same Mongo client.
- **Auth**: dc_backend never issues tokens; it only verifies tokens minted by the main backend's login flow (same `JWT_SECRET`), matching `backend/middlewares/authenticate.js` but re-implemented without Mongoose.
- **No TypeScript** anywhere under `frontend/src/systems/dcs/` — plain `.js`/`.jsx`, per instruction.
- **No Mongoose** anywhere under `dc_backend/` — native `mongodb` driver only.

## Brief Description

This component lets users build their own data collection forms without writing code. Instead of hard-coding every form, the component stores each form as a **JSON document** that describes what fields to show, what rules to apply, and how fields relate to each other. A separate rendering engine reads this JSON and builds the actual form on screen at runtime.

### Why This Architecture Matters for Dashboards

Because every form is stored as structured metadata (not custom code), dashboards can be generated automatically. The dashboard reads the same JSON schema to know:
- What questions were asked: auto-generates chart axes and table columns
- What field types were used: picks the right visualization (map for GPS, bar chart for selects, timeline for dates)
- What validation rules exist: flags data quality issues automatically
- What versions exist: compares trends across form changes over time

If forms were built as custom code instead, every new form would require a developer to manually build a matching dashboard. With metadata-driven architecture, **one dashboard engine serves unlimited forms**.

### Core Features
- **Visual Drag-and-Drop Builder**: Users arrange fields visually with an "Add Below" button under every question for fast editing
- **Save & Continue Later**: Auto-saves drafts locally so work is never lost; users can resume anytime
- **All Field Types Supported**: From basic text to GPS, signatures, barcodes, file uploads, and repeating sub-forms
- **Conditional Logic**: Show/hide fields, enable/disable inputs, and calculate values based on other answers using safe JSONLogic expressions
- **Multi-Layer Validation**: Rules run on the user’s device for instant feedback AND on the server for data integrity
- **Offline-First**: Forms work fully without internet; data syncs automatically when connection returns
- **Form Versioning**: Every change creates a new version; old collected data stays valid and traceable
- **Accessibility & Multi-Language**: Works with screen readers, supports RTL layouts, and allows translated labels

---

## 1. Core Architectural Concepts

### Schema Storage Strategy (NoSQL Document Preferred)

Each form definition is stored as a single JSON document in a NoSQL database (like MongoDB or CouchDB). This is preferred over traditional SQL tables because:

- Form structures vary wildly between users; forcing them into fixed SQL columns requires constant schema migrations
- Nested data like repeat groups, conditional rules, and option lists map naturally to JSON documents
- Reading/writing an entire form is a single document operation, not a join across many tables
- Adding new field types or rule types doesn’t require database schema changes

The collected *responses* may use a different storage strategy (e.g., flattened for analytics), but the *form definition itself* lives as a flexible JSON document.

### Renderer Engine

The renderer is a universal component that takes any valid form JSON and displays it correctly. It does NOT contain hardcoded form logic. Instead, it:

- Reads the JSON schema field by field
- Maps each field type to the correct UI component (text input, date picker, map widget, etc.)
- Applies validation rules, visibility conditions, and computed values dynamically
- Handles nested groups and repeat sections recursively

This means you build the renderer **once**, and it works for every form ever created. New field types only require adding one new component mapping.

### Versioning & Immutability

Forms change after people start collecting data. If you overwrite the old form definition, you lose the ability to understand historical data. The system enforces:

- Every save creates a **new version** (v1, v2, v3…) rather than replacing the old one
- Collected responses are permanently linked to the exact version they were submitted against
- Old versions remain readable and exportable forever
- Dashboard filters can compare data across versions or isolate specific versions

This is non-negotiable for audit trails, regulatory compliance, and accurate longitudinal analysis.

### Offline-First Capability

Field data collection often happens in areas with no internet. The system must work fully offline:

- Form definitions are cached locally when first loaded
- All responses are saved to local device storage (IndexedDB or SQLite) immediately
- Validation, conditional logic, and calculations run entirely on-device using the same JSONLogic engine
- When connectivity returns, queued responses sync to the server with conflict detection
- Sync failures are retried automatically; users see clear status indicators

Offline-first is not an add-on feature; it is the default operating mode. Online-only systems fail in real-world field conditions.

### Conditional Logic Engine

Users need to show/hide fields, set defaults, and validate based on other answers. The system uses **JSONLogic** for all expressions because:

- It is pure data (JSON), not executable code: safe from injection attacks
- The same rule runs identically on phone, tablet, browser, and server
- It supports if/else, math, string operations, array filtering, and custom extensions
- Rules are serializable, versionable, and auditable

Custom operations are registered for form-specific needs (date differences, regex matching, GPS accuracy checks). A dependency graph tracks which fields depend on which others, preventing infinite loops and ensuring efficient re-evaluation only when relevant inputs change.

### Field Types

| Category | Field Type | What It Does |
|----------|-----------|--------------|
| Basic Input | Text | Free text entry with optional length limits |
| Basic Input | Number | Numeric entry with min/max bounds |
| Basic Input | Email | Email address with format validation |
| Basic Input | URL | Web link with protocol validation |
| Basic Input | Phone | Phone number with format/pattern support |
| Selection | Single Select | Choose one option from a list |
| Selection | Multi-Select | Choose multiple options from a list |
| Selection | Likert Scale | Rate agreement on a numbered scale |
| Selection | Ranking | Order items by preference |
| Date/Time | Date | Calendar date picker |
| Date/Time | Time | Time-only picker |
| Date/Time | DateTime | Combined date and time |
| Date/Time | Duration | Elapsed time entry |
| Media | Image | Photo capture or upload with compression |
| Media | Video | Video recording or upload |
| Media | Audio | Voice recording or audio file upload |
| Media | File Upload | Any document/file with size/type limits |
| Geospatial | GPS Point | Capture current location coordinates |
| Geospatial | Polygon | Draw area boundaries on a map |
| Geospatial | Geofence | Validate location within defined boundary |
| Advanced | Signature | Handwritten signature capture |
| Advanced | Barcode/QR Scanner | Scan codes via device camera |
| Advanced | NFC Tag | Read NFC tags via device hardware |
| Structural | Group | Organize related fields visually |
| Structural | Repeat Group | Collect multiple instances of a field set (e.g., household members) |
| Structural | Page Break | Split long forms into pages |
| Computed | Calculated Field | Auto-compute value from other fields |
| Computed | Hidden Field | Store value without showing to user |
| Reference | External Data Lookup | Pull options from external API/database |
| Reference | Cascading Select | Filter child options based on parent selection |

---

## 3. Validation Architecture

Validation happens in three layers to balance user experience with data integrity.

### Client-Side Validation (User Experience Layer)
Runs instantly on the user’s device as they fill out the form:
- Shows errors immediately on blur or after typing pauses
- Supports cross-field rules (e.g., “end date must be after start date”)
- Distinguishes soft warnings (user can proceed) from hard errors (blocks submission)
- Uses the same JSONLogic rules as the server to ensure consistency

### Server-Side Validation (Data Integrity Layer)
Re-validates every submission on the server before accepting it:
- Never trusts client-side validation alone (data can be tampered with)
- Applies identical JSONLogic rules plus server-only business rules (quota checks, database lookups)
- Enforces strict type checking and sanitization
- Rejects malformed data with detailed error paths for debugging

### Schema-Level Validation (Definition Layer)
Built into the form definition itself:
- Combines multiple validators with AND/OR logic
- Provides pre-built patterns for common formats (postal codes, IDs, phone numbers)
- Auto-sanitizes inputs (trims whitespace, strips dangerous characters)
- Validates rule structure when forms are saved to prevent broken logic

---

## 4. Non-Functional Considerations

These are requirements that don’t describe *what* the system does, but *how well* it must do it.

- **Security**: All user-entered labels and help text are sanitized before display. JSONLogic prevents code injection. Rule complexity is limited to prevent abuse.
- **Performance**: Large forms use virtual scrolling to avoid lag. Heavy components (maps, media) load lazily. Validation results are cached and only recomputed when dependencies change.
- **Accessibility**: Generated forms include proper ARIA labels, keyboard navigation, and screen reader support. Error messages are programmatically associated with their fields.
- **Internationalization**: Labels support multiple languages. Layout adapts for right-to-left scripts. Numbers and dates format according to user locale.
- **Audit Trail**: Every form change is logged with who changed it, when, and what was modified. Essential for compliance and troubleshooting.
- **Export Flexibility**: Data exports adapt to the form schema. Repeat groups flatten correctly for CSV. JSON and Parquet exports preserve full structure. Users can customize export mappings.
- **Mobile Responsiveness**: Both builder and renderer are tested on small screens. Touch targets meet minimum size standards. Offline indicators are visible without hover states.

---

## 5. Tech Stack Patterns (JSON Schema Preferred)

### Why JSON Schema as the Foundation
JSON Schema is the industry standard for describing JSON data structures. Using it as the core form definition format provides:
- Built-in validation keywords (type, minLength, pattern, enum, required)
- Wide tooling support across languages and platforms
- Interoperability with other systems (ODK/XLSForm converters, API documentation generators)
- Clear separation between structure definition and behavioral logic (JSONLogic handles behavior)

### Recommended Libraries by Concern

| Concern | Recommended Library | Why |
|---------|-------------------|-----|
| Form Definition Standard | JSON Schema | Industry standard, rich ecosystem |
| Conditional Logic & Expressions | json-logic-js | Safe, serializable, cross-platform |
| Drag-and-Drop Builder | dnd-kit (React) / sortablejs (vanilla) | Accessible, performant, mobile-friendly |
| Schema-Based Rendering | react-jsonschema-form / formio.js | Mature, extensible, community-supported |
| Client-Side Schema Validation | zod | TypeScript-first, excellent error messages |
| Offline Local Storage | Dexie.js / idb-keyval | Simple IndexedDB wrapper with async API |
| Reactive State & Dependencies | Zustand / Signals | Lightweight, fine-grained reactivity for computed fields |
| Virtual Scrolling | @tanstack/react-virtual | Handles thousands of rows efficiently |
| Date/Time Handling | date-fns / dayjs | Tree-shakeable, immutable, locale-aware |
| Server-Side JSONLogic Parity | json-logic-js (Node) / py-json-logic (Python) | Same library/runtime guarantees identical evaluation |

### Key Integration Pattern
The form definition JSON combines JSON Schema (structure + basic validation) with JSONLogic extensions (conditional visibility, computed values, cross-field rules). The renderer parses both sections: JSON Schema drives field rendering and basic validation, while JSONLogic drives dynamic behavior. This separation keeps concerns clean and allows each layer to evolve independently.
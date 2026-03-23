# TLF Shell Generator App – PRD

**Version:** 1.8  
**Date:** March 9, 2026  
**Author:** Linh Dinh  
**Status:** Approved – Production Ready  

---

## 1. Overview

**Product vision**  
AI-powered web app that automates TLF mock shell generation from confidential clinical documents (SAP, protocol, CRF, TLF shells library, TLF list, and other supporting documents), with human-in-the-loop approval, multi-role AI clinical reasoning, parse-once document architecture, and GxP-style traceability.

**Target users & personas**

- **Primary: Biostatistician (Pro tier)**  
  Has access to full document set, cares about variable/stat mapping and alignment to SAP/ADaM, comfortable with R and statistical concepts.

- **Secondary: Data Manager (Basic tier)**  
  May only upload SAP/protocol and needs quick, reasonably accurate shells.

**Pain point**

- Manual TLF shell creation from SAP/protocol/CRF takes 4–8 hours per study.

**Strategic goals**

- 50 beta users.
- 80% time savings vs manual workflow.
- Sustainable paid “Pro” tier.

---

## 2. Objectives & Success Metrics

**Primary objectives**

- Generate accurate TLF shells with ≥90% user approval on first preview.
- Handle real SAP/protocol uploads end-to-end in <15 minutes per study.

**Key KPIs**

- Completion rate: >85% shells approved without major edits.
- Session time: <15 minutes per study (tracked via analytics).
- Confidentiality: 0 cross-user data leaks (validated via RLS tests).
- AI quality: Reviewer catches and resolves ≥2 issues per shell before preview.
- Cost efficiency: Average API cost < $0.01 per shell (target ≤ $1 per study).
- Latency: <1 second AI response per shell after document retrieval.

### 2.1 Traceability Matrix

| Objective           | Feature                 | Test Case                                      | Success Metric          |
|---------------------|-------------------------|-----------------------------------------------|-------------------------|
| High approval       | Per-Shell AI Loop       | Mock SAP → shells approved without major edits| ≥90% first-preview OK   |
| Fast sessions       | Upload + Preview        | 10-doc set completed in one session           | <15 minutes per study   |
| Confidentiality     | RLS + Audit             | User A cannot see User B’s materials          | All checks pass         |
| AI quality          | Multi-Role AI Debate    | Reviewer resolves ≥2 issues per shell         | Audit log review        |
| Variable accuracy   | Variable Review Round   | User confirms/adds all variables before export| Completion rate         |
| Efficacy accuracy   | Efficacy Shell Handling | Efficacy shells match SAP analyses            | User survey / review    |
| Cost efficiency     | Parse-Once + Caching    | Measured tokens per shell                     | < $0.01 per shell       |
| Speed               | Chunk Retrieval         | Measured per-shell latency                    | <1 second per shell     |

---

## 3. Features by Phase

### 3.1 Phase 1 – MVP (Must-Haves)

Core loop: Upload → Parse Once → Extract TLF list → Define structure → Per-shell AI loop → Export.

| Feature                    | Description                                                                                                                                                                                                                                             | Acceptance Criteria                                                                                                                                                                  | Priority |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| Document upload & parse    | Users upload SAP, protocol, CRF, TLF list, TLF shells library, and other supporting documents (PDF/Word/Excel). Each file is tagged as `sap`, `protocol`, `crf`, `library`, `tlf-list` or `other` (with a user label). Documents are parsed once on upload; raw files are then deleted. | Documents are stored securely; doc_status moves `uploading → processing → ready`; “other” files have user labels; no raw file is used in per-shell calls (only parsed content).                                             | Must     |
| TLF list extraction/editor | If TLF list is not uploaded, AI extracts it from SAP parsed content. User can review, edit, add, or remove TLFs to finalize the list.                                                                                                                   | Extracted list corresponds to SAP section 12.x; user can edit and approve; TLF list stored and used as the backbone for per-shell generation.                                                                               | Must     |
| Shell structure setup      | User defines, per section, the general shell structure: table/figure/listing number pattern, title template, subtitle template, and column headers (e.g. demographics: arms + total; others: arms only).                                                | Preview view shows example shells per section with number, title, subtitle, and headers; user must approve structure before per-shell generation proceeds.                                                                  | Must     |
| Per-shell generation loop  | For each shell in the TLF list, AI retrieves relevant chunks from parsed documents and suggests footnotes, variables, types, and statistics based on those chunks and its own clinical reasoning. Library is used as a reference if available. Multi-role AI (Biostat Expert → Builder → Reviewer) runs before user preview. | AI suggestions are always based on retrieved content plus reasoning; internal Reviewer runs before user sees anything; shells reach ≥90% approval on first preview; JSON shells and audit entries stored per shell.        | Must     |
| Efficacy shell handling    | For efficacy TLFs, AI identifies the relevant SAP analysis section(s), endpoints, analysis populations, and statistical methods, and suggests a suitable table/listing/figure layout based on library or reasoning.                                     | For known efficacy TLFs, SAP analysis mapping and presentation are correct or easily correctable by user; mapping is visible and editable; user can override suggested layout and mapping.                                  | Must     |
| Variable Review Round      | After AI suggests variables for a shell, user enters a dedicated review step: confirm, remove, edit, add new variables (e.g. from ADaM or clinical intuition). AI-suggested variables not backed by documents are flagged as “AI-suggested (unconfirmed)”. | All variables for each shell are either confirmed or clearly flagged; user can do bulk confirm of AI-suggested variables; changes are logged to audit trail.                                                                | Must     |
| Rendered table preview     | Shell preview is shown as a Word/Excel-style table (grid), not JSON. Includes title, subtitle, column headers, and row stubs for variables/parameters.                                                                                                  | Users see what the final table will look like (layout, titles, headers) and can give feedback based on visual preview; preview updates after each AI/user interaction.                                                     | Must     |
| Previews & export          | Users can export approved shells to Word, Excel, or RTF.                                                                                                                                                                                                | Exported files contain all approved shells with titles, subtitles, headers, and footnotes; formatting is acceptable for regulatory/statistical use; no unapproved shells are exported.                                      | Must     |
| Compliance audit log       | System logs AI suggestions and user edits with timestamps and references to source chunks/sections.                                                                                                                                                      | Exportable CSV log is available showing per-shell history, including variables, footnotes, SAP section references, unconfirmed variables, and user feedback.                                                                | Must     |
| Cost dashboard             | Internal dashboard (admin view) for tracking token usage and API costs per study and per shell.                                                                                                                                                         | Costs per study and per shell visible; alerts when estimated API cost approaches $1 per study; allows tuning of retrieval and prompt sizes if needed.                                                                      | Must     |

### 3.1.1 MVP TLF List & Content Rules

#### 1. Accepted Uploaded Documents (MVP)

For the MVP, the app supports upload of the following document types:

- **SAP** (mandatory conceptually; may be omitted if user only uploads a TLF shell list).
- **Protocol** (optional).
- **TLF shell library** (optional collection of reference shells).
- **Study‑specific TLF shell list** (optional, but unlocks the fastest path to shells).

Each document is tagged by type on upload.

#### 2. TLF List Behavior

- **If a study-specific TLF shell list is provided:**
  - The app uses that list as the **source of truth** for TLF numbers, titles, and section types.
  - AI generates shells **only for the shells in that list**.
  - No TLF list extraction from SAP is performed.

- **If a study‑specific TLF shell list is not provided:**
  - The app **first extracts a candidate TLF list from the SAP** (e.g., section 12.x).
  - The user is presented with a **review screen** for the extracted list:
    - Can add, remove, or reorder rows.
    - Can edit numbers, titles, or section types.
    - Can request AI to adjust the list (e.g., “add a separate table for AEs by SOC”).
  - User must **approve the final TLF list** before the app proceeds to per‑shell generation.

This ensures the app never generates shells for unknown TLF numbers without user sign‑off.

#### 3. Per‑Shell Content Logic (MVP)

For each shell in the approved TLF list, the app follows these rules:

- **If the SAP explicitly specifies the content of the table/figure (e.g., “Table 14.1.1: Demographics by ARM, with AGE, SEX, RACE…”):**
  - The app:
    - Uses the **variables** explicitly named in the SAP as the base variable list.
    - AI reasoning **infers the variable type** (categorical vs numeric) from:
      - Variable names.
      - Context (e.g., “AGE” → numeric; “SEX” → categorical).
    - AI suggests **summary statistics** appropriate for the inferred type:
      - Continuous → Mean (SD), Min, Max (or similar).
      - Categorical → n (%).
  - The app **does not require** user input of variables at this stage.
  - User can:
    - Add or remove variables.
    - Adjust footnotes or section references.
    - Request different stats (e.g., add median/IQR).
  - If user changes the variable list, those changes are treated as **override** and persisted in the shell.

- **If the SAP does not specify the exact variables for the table/figure:**
  - The app **asks the user to provide** the variables, including:
    - Variable names.
    - Optional hierarchy (e.g., for disposition‑like tables: “ARM” → “Enrolled” → “Completed”, etc.).
    - Optional grouping (e.g., “AE by SOC and PT”).
  - **If the user provides variables:**
    - The app uses them as the base variable list.
    - AI:
      - Validates inferred type and stats.
      - May suggest additional standard variables (e.g., “Consider adding total N per row/column?”).
      - Flags any AI‑suggested variables as "AI‑suggested (unconfirmed)".
  - **If the user provides no variables at all:**
    - The app assumes the table is **of a standard type** in the field (e.g., “AE by SOC and PT”, “Disposition”, “Demographics”, etc.).
    - AI:
      - Infers the likely variable pattern from the title, section, and SAP/protocol context.
      - Suggests a **reasonable default table structure** (variables + hierarchy + stats).
      - Clearly marks all variables as "AI‑suggested (unconfirmed)".
    - The user must **confirm or adjust** the suggested structure before the shell is finalized.

### 3.1.2 Title Structure and Analysis Set Handling

**Title composition in clinical TLFs**

Clinical TLF titles typically follow this pattern:
[Core Title] [Subtitle] ([Analysis Set])


Where:
- **Core title**: Main description of the table content (required)
- **Subtitle**: Optional descriptor, often starting with "by", "for", "stratified by" (optional)
- **Analysis set**: Subject population analyzed, typically in parentheses (required)

**Examples from real SAPs:**
- "Summary of Demographics by Treatment Group (Safety Population)"
- "Adverse Events by System Organ Class (Safety Population)"
- "Primary Efficacy Endpoint Analysis (Intent-to-Treat Population)"
- "Laboratory Values Over Time by Visit (Per-Protocol Population)"

**Storage and parsing**

Each TLF and shell must store:
1. `title` - core title only
2. `subtitle` - optional descriptor
3. `analysis_set` - population designation
4. `raw_title` - original complete title string from SAP (for reference)

**TLF list extraction logic**

When TLF list is extracted from SAP:

1. System extracts raw title strings from SAP section 12.x (or equivalent shell list section)
2. System **parses each title** to separate components using these rules:
   - **Analysis set**: Extract content in final parentheses if it contains keywords like "Population", "Set", "Analysis", "Subjects"
   - **Subtitle**: Extract phrase starting with "by", "for", "stratified by", "grouped by", etc.
   - **Core title**: Remaining text before subtitle or analysis set
3. System stores all components separately in TLF list rows
4. User reviews parsed titles in TLF list editor and can adjust:
   - Correct parsing errors
   - Manually separate combined text
   - Add missing analysis set if not in original SAP title

**TLF list upload logic**

When TLF list is uploaded:

1. If uploaded file contains separate columns (title, subtitle, analysis_set):
   - Use directly
2. If uploaded file contains only complete title strings:
   - Apply same parsing logic as SAP extraction
   - Flag low-confidence parses for user review

**Shell generation logic**

When generating individual shells:

1. Inherit parsed title components from approved TLF list row
2. If analysis set is missing:
   - Check global requirements for section default
   - Extract from SAP content for this specific shell
   - AI suggests based on shell type and context
   - Flag as "TBD - needs user confirmation"
3. Allow user to override any component during shell review

**Rendering and display**

Rendered preview and export must show:
Table [number]: [title]
[subtitle] (if present)
([analysis_set])


**Component precedence**

For each component:
1. User explicit override (highest priority)
2. Approved TLF list parsed value
3. SAP explicit content for this shell
4. Global requirements section default (analysis set only)
5. AI reasoning from context (lowest priority, must be flagged)

**Validation and warnings**

System should:
- Warn if analysis set is missing or unclear
- Warn if parsing confidence is low
- Flag analysis sets that don't match known population types from protocol
- Allow bulk editing of analysis sets across multiple TLFs in same section

### 3.2 Phase 2+ (Future)

| Feature              | Description                                                                                           | Dependencies              |
|----------------------|-------------------------------------------------------------------------------------------------------|---------------------------|
| Multi-study batch    | Process multiple studies in a single batch (shared documents, different TLF lists).                  | MVP upload + parse layer  |
| SDTM/ADaM var mapping| Suggest mapping to ADaM datasets and variable names; export mapping for programming.                 | ADaM metadata integration |
| Team collaboration   | Multi-user workflows for TLF design (comments, approvals, roles).                                    | Auth/roles, study sharing |
| Live data population | Populate TLFs with real data (beyond shell design). **Out of scope for MVP.**                        | Future phase              |

---

## 4. User Flows & Experience

### 4.0 Study Page Layout (MVP)

Each study has a **tabbed interface** with the following tabs (left‑to‑right, matching screenshot):

1. **📄 Documents**  
   - List of uploaded documents (SAP, protocol, TLF library, study‑specific TLF list).  
   - Upload button + type selector (`sap`|`protocol`|`library`|`tlf-list`|`other`).  
   - Status per document: `uploading` → `processing` → `ready` or `error`.  
   - Download parsed content or re‑parse option.

2. **📋 TLF**  
   - **Editable TLF list table** (number, title, section, status).  
   - If no study‑specific list uploaded: AI‑extracted from SAP + **AI chatbox** for feedback (e.g., "add separate AE by SOC table").  
   - Edit: add/remove/reorder rows, edit cells.  
   - Approve button to finalize list before shell generation.

3. **🔧 Global Requirements**  
   - **Shell structure setup** by section type (demographics, safety, efficacy, etc.).  
   - Per section: number pattern (e.g., 14.x), title/subtitle templates, column headers (arms + total?).  
   - Preview sample table for each section type.  
   - Save/approve structures.

4. **🧩 All Shells**  
   - List of generated shells (sidebar like your React prototype).  
   - Click to open **per‑shell editor** (main area): rendered preview + AI chatbox + table edits.  

**Navigation:** Top bar shows study name + "Save Requirements" button. Breadcrumb: Dashboard → Studies → StudyXYZ.[file:230]


### 4.1 Upload and Parse

1. User logs in (with MFA).
2. User uploads one or more documents, selecting type for each:
   - `sap`, `protocol`, `crf`, `library`, `tlf-list`, or `other` (with label).
3. System parses documents once:
   - Extracts text.
   - Splits into chunks with section references.
   - Indexes chunks for semantic retrieval.
4. Raw files are deleted after parsing; parsed summaries and chunks are retained.
5. Document status is visible (uploading → processing → ready or error).

### 4.2 TLF List Extraction and Editing

1. If a TLF list file is provided:
   - System ingests it as the baseline TLF list.
2. If no TLF list is provided:
   - AI extracts a candidate list from SAP parsed content (section 12.x).
3. User edits:
   - Add/remove rows.
   - Adjust numbers/titles/sections.
4. User approves the final TLF list, which drives subsequent per-shell steps.

### 4.3 Shell Structure Setup

1. User defines structure by “section type” (e.g. demographics, efficacy, safety).
2. For each section type, user configures:
   - Number pattern (e.g. 1.x, 2.x).
   - Title template.
   - Subtitle template.
   - Column headers (e.g. `ARM A`, `ARM B`, `Total` for demographics).
3. System shows a sample preview table for each section type.
4. User approves structure before moving to per-shell generation.

### 4.4 Per-Shell AI Loop

For each shell in the TLF list:

**Step A – AI generation (chunk-based)**

- System builds a query from shell number, title, subtitle, and section type.
- Retrieves the top few relevant chunks from:
  - SAP.
  - Protocol.
  - TLF library (if available).
  - Other supporting documents (if useful).
- Biostat Expert role:
  - Suggests footnotes with explicit SAP/protocol section references.
  - Suggests variables with:
    - Name.
    - Type (categorical/numeric).
    - Statistic (e.g. Mean (SD), n (%), Min/Max).
  - For efficacy shells:
    - Identifies SAP analysis section.
    - Maps endpoints and populations.
    - Suggests appropriate layout (table/listing/figure).
- Builder role:
  - Converts suggestions into an internal JSON shell (not shown to user).
- Reviewer role:
  - Checks for GxP traceability, hallucinations, incorrect types/stats, and incorrect efficacy mapping.
  - Sends corrections back to Builder until no critical issues remain.
- After internal review, system creates a rendered table preview (Word/Excel-style grid) for the user.

**Step B – Variable Review Round**

- User sees a list of variables proposed by AI:
  - Variables backed by retrieved chunks.
  - Variables suggested only by AI reasoning (flagged as “AI-suggested (unconfirmed)”).
- User actions:
  - Confirm variables.
  - Remove variables.
  - Edit names or stats.
  - Add new variables manually.
  - Optionally bulk-confirm AI-suggested variables.
- System updates the internal JSON shell and logs all changes.

**Step C – Feedback and Approval**

- User reviews the full rendered shell preview (title, subtitle, headers, variable rows, footnotes).
- User can:
  - Refer to specific SAP/protocol sections (e.g. “see SAP 12.3”).
  - Suggest different wording or footnote content.
  - Request different statistics (e.g. add median/IQR).
  - Select a different TLF library shell as reference (e.g. “match library Table 2.5”).
  - Provide free-text feedback.
- AI adjusts the shell based on feedback, re-running internal roles if needed.
- User approves the shell when satisfied.
- System logs each iteration in the audit log, including sources and feedback.

### 4.4.1 User Feedback Mechanisms

During the TLF list and per‑shell preview steps, users can provide feedback in **two complementary forms**. The app must support both and synchronize them in the audit log.

#### 1. Free‑text feedback to AI

- Users can:
  - Type natural language messages to the AI (e.g., “Use AGE GROUP instead of continuous AGE”, “Add footnote from SAP 12.3”, “Make this look like Table 2.5 in the library”).
- The app must:
  - Attach the text feedback to the current TLF or shell.
  - Log it in the audit trail with timestamp and user ID.
- AI processes the text and:
  - Adjusts footnotes, variables, hierarchy, or statistics.
  - Re‑renders the preview table if needed.
  - Explains the change in the next preview (if requested by user).

#### 2. Direct table edits (UI‑driven)

Users can also **directly edit** the preview table grid, which the app must translate into structured changes:

- **Reorder rows:**
  - Users can drag rows to reorder parameters or variables.
  - The app updates the row order in the internal JSON shell and reflects it in the UI.
- **Add or remove rows:**
  - Users can add new rows (e.g., a new parameter or subgroup).
  - App:
    - Infers variable name from cell content if possible.
    - Marks new rows as **AI‑suggested (unconfirmed)** if not backed by SAP/protocol.
- **Add or remove columns:**
  - Users can add a new column (e.g., a “Percent” column) or remove an existing one.
  - App:
    - Updates the `headers` array and `preview_table` structure.
    - Remaps existing data to the new column layout.
- **Edit cell content:**
  - Users can edit text in headers or row stubs.
  - App:
    - Updates the title, subtitle, or parameter labels accordingly.
    - Preserves AI‑suggested flags only when the variable is unchanged.

AI must:
- Respect direct table edits as **user overrides**.
- Not reverse them in subsequent rounds unless explicitly requested (e.g., via text feedback: “Re‑order back to SAP order”).
- Log all table edits (e.g., “row added”, “column removed”, “reshuffle rows”) in the audit trail together with any free‑text feedback.


### 4.5 Export

1. After all desired shells are approved, user exports:
   - Shells to Word/Excel/RTF.
   - Audit log to CSV.
2. Export format:
   - Maintains numbering, titles, subtitles, headers, and footnotes.
   - Is suitable as a starting point for submission-ready shells.

---

## 4.5 Security & Confidentiality

**Core principles**

- Clinical documents (SAP, protocol, CRF, etc.) are confidential.
- There must be zero cross-user or cross-study leaks.

**Requirements**

- Authentication:
  - Secure auth with MFA.
- Authorization and isolation:
  - Row-level security on all main tables (studies, documents, shells, chunks, audit logs).
  - Documents, chunks, and shells are scoped to a specific user and study.
- Encryption:
  - Data encrypted at rest and in transit.
- Upload handling:
  - All uploads go through server-side endpoints; no client-side API keys.
  - Raw files deleted after parsing.
- Retention:
  - Parsed content retained only as required and configurable (e.g. 30 days).
- Audit:
  - Every AI suggestion and user edit logged with timestamp and identifiers.
- AI safety:
  - Study IDs and drug names must be anonymized before being sent to external AI APIs.

---

## 4.6 AI Reasoning Specification (Per-Shell Loop)

**Scope**

- Applies to the per-shell AI loop described in Section 4.4.

**Context retrieval**

- AI never re-reads raw documents.
- Per shell, AI receives:
  - Shell metadata: number, title, subtitle, section type.
  - A small set of relevant chunks from SAP, protocol, library, and other docs.
  - A brief summary of the documents (cached).
  - Previous feedback for this shell (if any).

**Roles**

- **Biostat Expert**
  - Uses retrieved chunks and domain knowledge to:
    - Propose footnotes with explicit SAP/protocol section references.
    - Identify candidate variables and statistics.
    - For efficacy shells, map to SAP analysis sections and endpoints.
  - Marks any variables that do not appear in retrieved chunks as “AI-suggested (unconfirmed)”.

- **Builder**
  - Constructs an internal JSON representation of the shell, including:
    - number, title, subtitle.
    - variables with `name`, `type`, `stat`, `confirmed` flag.
    - optional efficacy mapping details.
    - preview_table stub (to render grid UI).

- **Reviewer**
  - Checks the JSON draft for:
    - GxP traceability (footnotes must reference SAP sections).
    - Correct variable types and statistics.
    - Sensible efficacy mapping.
    - Obvious hallucinations or unsupported assumptions.
  - Sends back corrections to Builder until no critical issues remain.
  - Only then does the system render the user-facing preview.

**Constitution (rules)**

- Never show a shell to the user before Reviewer has run.
- Always cite SAP section numbers in footnotes when SAP content exists.
- Always distinguish:
  - Variables backed by document content.
  - Variables that are AI-suggested (unconfirmed).
- Store shells as structured JSON; show users rendered table previews instead of raw JSON.
- Always allow user to override AI decisions.

---

## 4.7 Document Processing Pipeline (PRD-Level)

**Core principle**

- Documents are parsed and indexed once at upload.  
  All later AI operations use these parsed representations and small retrieved chunks, not raw files.

**High-level pipeline**

1. Upload:
   - User uploads files and labels their type.
   - System validates size and type.

2. Parse:
   - System extracts text from each file (per type: PDF/Word/Excel).
   - Fallback OCR is used when necessary (e.g. scanned PDFs).

3. Chunk:
   - Text is split into logical sections, ideally aligned to SAP/protocol headings.
   - Each chunk is tagged with document type, section reference, and other metadata.

4. Index:
   - Chunks are indexed in a vector or search-friendly store to allow semantic retrieval per shell.
   - A lightweight per-document summary is stored for AI context.

5. Cleanup:
   - Raw files are deleted after successful parsing and indexing.
   - Only derived representations remain.

**Per-shell retrieval behavior**

- For each shell:
  - System queries indexed chunks using shell metadata (title, type, etc.).
  - Only a small set of top-matching chunks are sent to the AI.
  - A cached system/document summary reduces repeated context cost.

**Cost and performance targets**

- Cost:
  - Parse-once + small-chunk retrieval + caching should keep API cost below $0.01 per shell (approximately ≤ $1 per study).
- Performance:
  - Per-shell AI response (after retrieval) should typically be <1 second.

**Error handling (summary)**

- If parsing fails:
  - Mark document as error and prompt user to re-upload or switch method.
- If retrieval finds low-relevance chunks:
  - AI may lean more on clinical reasoning but should flag low confidence.
- If OCR is needed:
  - System may warn user that quality could be lower for heavily scanned documents.

---

## 5. Assumptions, Risks & Dependencies

**Assumptions**

- SAP and protocol documents have reasonably structured headings and sections.
- Users are willing to review and correct AI suggestions (Variable Review, feedback loops).
- Supabase (or similar) infrastructure is available for auth, storage, and database.

**Risks**

- AI hallucination:
  - Mitigated by Reviewer role, strict SAP section references, and human approval.
- Poor document quality (e.g. scanned PDFs):
  - Mitigated by OCR and user warnings; may still reduce accuracy.
- Incomplete uploads (missing protocol, CRF, or library):
  - AI must rely more on reasoning; unconfirmed items are clearly flagged.
- User fatigue with Variable Review:
  - Mitigated by bulk confirm actions and good defaults.

**Dependencies**

- External AI provider with healthcare-friendly terms.
- Parsing libraries for PDF/Word/Excel.
- Database and storage with row-level security.
- Frontend stack for interactive previews (e.g. React).

### 5.1 Backend Assumptions

To support the document‑centric frontend (sidebar TLF list, main shell editor, and AI chat panel) shown in the current prototype, the backend is assumed to:

- Store **document metadata** for SAP, protocol, TLF shell library, and study‑specific TLF lists, with a link to each TLF shell.
- Persist a **structured TLF list** (number, title, section reference, status) that can be edited by the user and reviewed before shell generation.
- Maintain a **shell state model** including:
  - Table type, title, population, and section context.
  - Columns (labels, widths), hierarchical rows (with indentation and header flags), and footnotes.
- Capture **user feedback** in both:
  - **Free‑text messages to AI** (chat history).
  - **Direct table edits** (add row/column, reorder, delete).
- Provide an **audit trail API** that logs:
  - User edits (e.g., “add row”, “delete column”, “update title”).
  - AI‑generated suggestions and their justification.
- Support **AI interaction via an API** that:
  - Accepts user prompts and TLF/shell context.
  - Returns structured text or metadata that can be parsed into rows/columns/suggestions.
- Offer **export endpoints** for shell specs (e.g., JSON, Excel) compatible with SAS or R‑based TLF mock‑shell generation scripts.

If any of these backend capabilities are not delivered as planned, the frontend will fall back to **local‑only editing with export**, but without:
- Multi‑user collaboration.
- Document‑linked TLF list review.
- Centralized audit trail.


---

## 6. Approval Checklist

- [x] Problem definition and users are clear.
- [x] MVP feature set is defined and scoped.
- [x] Per-shell AI loop, roles, and Variable Review are defined.
- [x] TLF list extraction and editing flow defined.
- [x] Shell structure (number, title, subtitle, headers) defined.
- [x] Security and confidentiality requirements defined.
- [x] Document processing pipeline defined at PRD level (parse once, retrieve chunks).
- [x] Export and audit requirements defined.
- [x] KPIs and cost/latency targets defined.
- [x] Future extensions identified (Phase 2+).

**Approved by:** Linh Dinh – March 9, 2026

# TLF Shell Generator

You are an AI assistant helping build an app that generates TLF shells
from clinical documents (SAP, protocol, CRF, TLF shells library, TLF
list, and other supporting docs). The canonical product requirements
are in `tlf-shell-generator-prd-v1.8.md`.

Your goals:
- Follow the PRD at all times.
- Preserve GxP-style traceability and auditability.
- Minimize token usage via parse-once, retrieve-many design.
- Always keep the biostatistician user experience in mind.

---

## 1. Project Overview (from PRD v1.8)

- Product: AI-powered web app to automate TLF mock shell generation.
- Inputs: SAP, protocol, CRF, TLF shells library, TLF list, and other
  supporting documents (PDF/Word/Excel, type-tagged).
- Outputs: Approved TLF shells (Word/Excel/RTF) plus a CSV audit log.
- Users:
  - Primary: Biostatisticians (Pro tier), R-savvy, care about variables
    and statistics mapping from SAP/ADaM.
  - Secondary: Data Managers (Basic tier), may only upload SAP/protocol.
- Core loop:
  1. Upload & parse docs once.
  2. Extract and edit TLF list.
  3. Define shell structure (number/title/subtitle/headers).
  4. Per-shell AI loop with Variable Review and rendered table preview.
  5. Export shells + audit log.

Key constraints:
- Target ≤15 minutes end-to-end per study.
- ≥90% shells approved on first preview.
- No cross-user data leaks.
- API cost ≤$1 per study (≈<$0.01 per shell).

---

## 2. Files and Roles

### 2.1 Key Files

- `tlf-shell-generator-prd-v1.8.md`  
  Product Requirements Document (source of truth for features/flows).

- `CLAUDE.md` (this file)  
  Instructions for how you should behave in this repo.

- Future files (may not exist yet but you should support):
  - `tlf-shell-generator-tech-design.md` – architecture and DB schema.
  - `tlf-shell-generator-prompts.md` – sprint and test prompts.
  - `/src` – application code (Next.js/React, Supabase client, etc.).
  - `/db` – SQL migrations (Supabase/pgvector).

### 2.2 Your Role

- You are a **system-level assistant** for:
  - Designing schemas and APIs consistent with the PRD.
  - Drafting backend/frontend code snippets.
  - Designing and refining prompts for the per-shell AI loop.
  - Proposing tests and QA scenarios.

- You must:
  - Align with PRD v1.8 terminology and flows (especially Sections 3–4).
  - Respect parse-once, retrieve-many architecture (Section 4.7 high-level).
  - Preserve auditability (shell JSON + audit log per interaction).

---

## 3. Functional Scope (What to Help With)

When the user asks for help, you should support tasks that fall into
these areas, using the PRD as the source of truth.

### 3.1 Document Upload & Parsing

- Design endpoints and data flow for:
  - Uploading documents with type labels (sap/protocol/crf/library/tlf-list/other).
  - Triggering parse-once pipeline and marking doc_status
    (`uploading` → `processing` → `ready` or `error`).
- Ensure:
  - Raw files are deleted after parsing.
  - Parsed summaries and chunks are stored for later retrieval.

### 3.2 TLF List Extraction and Editing

- Assist with:
  - Logic to extract TLF list from SAP parsed content when no TLF list is provided.
  - Data structures and UI models to allow editing and approval of the TLF list.
- Keep in mind:
  - TLF list must map back to SAP sections where possible.

### 3.3 Shell Structure Setup

- Help implement:
  - Configuration model for per-section shell structure:
    - Number format.
    - Title format.
    - Subtitle format.
    - Column headers (e.g., for demographics vs other tables).
  - Preview generation for a “section-level” structure before
    per-shell generation.

### 3.4 Per-Shell AI Loop

You should support design and prompt work for a **three-role** loop:

- Biostat Expert:
  - Suggests footnotes with SAP/protocol section references.
  - Suggests variables, types (categorical/numeric), and stats based on
    retrieved chunks and clinical reasoning.
  - For efficacy shells, maps to SAP analysis sections and endpoints.

- Builder:
  - Produces internal JSON shell draft, including:
    - `number`, `title`, `subtitle`.
    - `variables` with `type`, `stat`, and `confirmed` flag.
    - `efficacy_mapping` when applicable.
    - `preview_table` stub.

- Reviewer:
  - Checks for:
    - GxP traceability (footnotes cite SAP sections).
    - Correct variable types/stats.
    - Correct efficacy mapping.
  - Sends issues back to Builder until no critical issues remain.

You must preserve:
- Variable Review round:
  - Confirm/flag/add/remove variables.
  - Bulk confirm for AI-suggested variables.
- Rendered table preview:
  - Users see a Word/Excel-like grid, not raw JSON.
- Library usage:
  - Use TLF shell library as a reference, but still allow AI reasoning.
  - Allow user to switch to a different library shell as reference.

---

## 4. Non-Functional Requirements to Respect

When proposing designs or code, keep these constraints in mind:

- Security:
  - Per-user row-level security on all tables and storage.
  - No cross-user visibility of studies, documents, chunks, or shells.
- Performance:
  - Parse once at upload.
  - Retrieve only top 3–5 chunks per shell.
  - Aim for <1s AI response per shell after retrieval.
- Cost:
  - Target < $1 API cost per study.
  - Encourage prompt caching and minimal per-shell context.
- Compliance:
  - Every AI suggestion and user edit must be auditable in a log.
  - Never assume access to real PHI/PII; anonymization is mandatory.

---

## 5. How to Use the PRD

Whenever there’s ambiguity, follow this priority:

1. **PRD v1.8**  
   - Features, flows, acceptance criteria.
   - Particularly:
     - Section 3: Feature table (MVP vs later).
     - Section 4: User flows and experience.
     - Section 4.5–4.7: Security and document pipeline.

2. **This CLAUDE.md**  
   - How you’re expected to behave in this repo.

3. **Tech Design (when available)**  
   - Specific schemas, endpoints, libraries.

If the PRD conflicts with this file, **assume the PRD is the higher authority**, and suggest updating this CLAUDE.md.

---

## 6. Example Tasks You Should Handle Well

- Generate a DB schema proposal consistent with:
  - Studies, documents, chunks, shells, audit logs, variable review.
- Draft an API design for:
  - Uploading documents and tracking parse status.
  - Running the per-shell AI loop and variable review.
- Write or refine prompts for:
  - Per-shell AI loop (Biostat Expert → Builder → Reviewer).
  - Variable Review step instructions.
- Suggest test cases that:
  - Validate RLS isolation.
  - Validate efficacy shell mapping logic.
  - Validate cost assumptions (token usage per shell).

---

## 7. Out of Scope

Unless the user explicitly asks, you should avoid:

- Changing high-level product goals (e.g., target users, main value prop).
- Proposing features outside the PRD’s MVP and Phase 2+ unless the user
  is brainstorming.
- Writing long narrative documentation; prioritize concise, structured
  specs (schemas, endpoints, pseudo-code, prompts).

---

## 8. When Unsure

If the PRD is ambiguous or silent:

1. State the ambiguity clearly.
2. Propose 1–2 options with tradeoffs.
3. Ask the user to choose, or pick the option that:
   - Minimizes risk, and
   - Preserves GxP-style traceability.

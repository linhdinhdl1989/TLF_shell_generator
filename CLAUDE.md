# CLAUDE.md — Global Defaults (Linh Dinh)

## 1) Who you are helping
- You are assisting Linh Dinh, a biostatistician and AI product developer.
- Priorities: correctness, clear structure, and maintainability over cleverness.
- When in doubt, ask clarifying questions instead of guessing.

## 2) How to work by default
- Prefer test-driven development for any non-trivial change.
- Keep functions small, pure where practical, and well-named.
- Use type hints in Python and clear prop types / interfaces in frontend code.
- Avoid large, monolithic files; extract modules when something feels "too big".

## 3) Communication style
- Explain plans and trade-offs in plain language before large changes.
- Propose 1–2 options with pros/cons if there is a significant design choice.
- Before deleting or renaming files, explicitly confirm with the user.

## 4) Project context pointers (TLF Shell Generator)
- This global file is not tied to a single repo, but Linh often works on
  the TLF Shell Generator project.
- When inside that repo, treat these files as canonical references:
  - tlf-shell-generator-prd.md        # main product requirements
  - tlf-shell-generator-spec.md       # detailed roles/scope/constraints
  - docs/CODEBASE_MAP.md              # current codebase structure
- If there is ambiguity in that project, follow: PRD → spec → repo CLAUDE.md.

## 5) Safety and quality
- Preserve auditability: prefer append-only logs over destructive updates.
- Be mindful of PHI/PII: assume real clinical data must be anonymized.
- Optimize for reliability and clarity; micro-optimizations are usually lower priority.

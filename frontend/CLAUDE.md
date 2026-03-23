## Frontend — TLF Shell Generator

- Stack: React + Vite, JavaScript (migratable to TS later).
- Styling: Tailwind via index.css and tailwind.config.js; avoid inline styles.
- Main entry: src/main.jsx → src/StudyPage.jsx with tabs.
- API base URL comes from VITE_API_BASE (fallback http://localhost:8000).

When implementing new UI:
- Use reusable components extracted from StudyPage.jsx / TLFListTab.jsx.
- Keep network logic in a dedicated API helper (e.g. src/api.js), not inside JSX.

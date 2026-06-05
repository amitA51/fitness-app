## Hebrew-first skills (installed globally, use in this project)

This is a Hebrew RTL PWA. The following skills are installed and MUST be used when their domain comes up — invoke via the Skill tool before doing the work manually:

- **hebrew-content-writer** — any time you write or edit user-visible Hebrew copy (UX text, buttons, empty states, errors, aria-labels, marketing). Complements the copy self-audit in `.claude/rules/common/ui-preflight.md`.
- **hebrew-rtl-best-practices** — any RTL/bidi layout work: direction issues, CSS logical properties, Tailwind RTL, icon mirroring, mixed Hebrew/English/numbers rendering.
- **israeli-accessibility-compliance** — accessibility work beyond generic WCAG: IS 5568 (תקן ישראלי), Hebrew screen readers (NVDA/JAWS/VoiceOver), RTL ARIA patterns. Use for a11y audits of this app.
- **hebrew-document-generator** — if asked to produce Hebrew PDF/DOCX/PPTX (e.g. workout reports, coach documents, invoices).
- **hebrew-nlp-toolkit** — if asked to process Hebrew text programmatically (tokenization, NER, speech-to-text for Hebrew).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

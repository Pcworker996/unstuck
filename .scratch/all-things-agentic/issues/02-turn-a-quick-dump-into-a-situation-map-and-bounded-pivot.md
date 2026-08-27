# 02 — Turn a Quick dump into a Situation map and bounded Pivot

**What to build:** An authenticated person can consent, enter only a Quick dump about any ordinary Stuck situation, and receive a provenance-aware Situation map plus one recommended Pivot and two distinct alternatives. The Pivot Protocol owns this complete decision path; Genkit and Gemini provide validated structured generation rather than becoming the application interface.

**Blocked by:** 01 — Expand a Google-native authenticated runtime.

**Status:** ready-for-agent

- [ ] A Quick dump without any artifact is sufficient to start the normal Pivot Protocol.
- [ ] Explicit processing consent is required before model work, and the app-owned direct-input Safety gate runs before generation, memory access, or persistence.
- [ ] A safe Quick dump produces a structured Situation map that separately represents person statements, guide interpretations, uncertainties, constraints, and the person's immediate definition of progress.
- [ ] Every map item carries supported provenance, and generated interpretations cannot silently become person statements.
- [ ] Normal generation returns exactly one primary Pivot and two distinct alternatives drawn only from the bounded Pivot library.
- [ ] The Activity trace reports observable events such as Safety completion, map creation, generation, validation, and fallback use without exposing prompts or hidden reasoning.
- [ ] All model output is schema-validated, receives at most one bounded repair attempt, and otherwise returns a typed fallback that preserves the accepted Quick dump.
- [ ] Deterministic tests drive the authenticated Pivot Protocol interface through in-memory adapters and cover the normal, Safety-interrupted, invalid-output, and generation-failure paths.
- [ ] The workspace visibly supports signed-out, Quick dump, Safety interruption, Situation map, Activity trace, and Pivot recommendation states on mobile and desktop.


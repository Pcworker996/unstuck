# 03 — Collaborate through a versioned, editable Situation map

**What to build:** The person and Pivot guide can collaboratively refine the Situation map before choosing a Pivot. The guide may ask at most two useful, one-at-a-time questions; the person may answer, skip, or directly correct the map; and every accepted mutation is versioned, observable, and safe to retry.

**Blocked by:** 02 — Turn a Quick dump into a Situation map and bounded Pivot.

**Status:** ready-for-agent

- [ ] The guide can ask no more than two clarification questions before the first recommendation, presents only one at a time, and permits each question to be skipped.
- [ ] Skipping every question still produces a bounded recommendation from the context already shared.
- [ ] The person can edit any person-editable Situation-map section and remains the authority over corrected facts.
- [ ] Corrections retain provenance and appear as observable map revisions and Activity-trace events rather than hidden chat history.
- [ ] Every mutation requires the expected map version; a stale edit returns a visible conflict without overwriting newer state.
- [ ] State-changing commands accept idempotency keys so a duplicate answer, skip, correction, regeneration, dismissal, or selection has one effect.
- [ ] A correction or clarification can visibly change the map and subsequent Pivot recommendation without exceeding the question budget.
- [ ] Contradictions remain explicit until the person resolves them; model output cannot promote artifact or guide claims to person statements.
- [ ] Tests assert returned protocol state, trace events, requested effects, and persisted versions through the Pivot Protocol seam rather than private helpers or prompt wording.
- [ ] The mobile workspace uses focused, collapsible map and trace views, while wider layouts allow guide, map, and trace state to be inspected together.


# 05 — Adapt from approved memories and Guidance preferences

**What to build:** A later Check-in can use a small, owner-scoped set of approved prior experiences and explicit Guidance preferences to adapt its Situation map and Pivot recommendation. The person can see and control every memory used; adaptation never relies on hidden traits, diagnoses, or raw Private entries.

**Blocked by:** 04 — Save a protocol and report its Agency shift.

**Status:** ready-for-agent

- [ ] Saving an approved Derived memory creates a validated 768-dimensional embedding using gemini-embedding-001 without embedding raw artifact bytes.
- [ ] Once an initial usable map exists, the protocol makes at most one owner-scoped semantic retrieval attempt and considers no more than three memories above the configured relevance threshold.
- [ ] Forgotten, deleted, excluded, other-owner, irrelevant, and below-threshold memories cannot influence the map or recommendation.
- [ ] The generation boundary receives compact approved Derived-memory summaries only; it receives no raw Private entry, vector, distance score, or other person's data.
- [ ] Every influential memory appears as an owner-visible Memory explanation linked to inspectable saved history.
- [ ] The person can exclude, forget, or delete an influential memory before regeneration and can create or delete explicit Guidance preferences.
- [ ] A later map or recommendation demonstrably adapts from an explicit correction, Pivot choice, outcome, Agency shift, or Guidance preference.
- [ ] Personality traits, motives, diagnoses, permanent characteristics, and hidden preferences are rejected from memory and generated state.
- [ ] Embedding or retrieval failure continues without personalization, preserves the current map, and discloses the degraded state.
- [ ] Tests cover vector shape, owner filtering, top-three and threshold bounds, contradictory memory, control operations, non-disclosure, visible adaptation, and retrieval fallback.


# 10 — Evaluate the protocol against synthetic Stuck situations

**What to build:** Maintainers can run a committed evaluation suite that demonstrates the Pivot Protocol's safety, provenance, boundedness, adaptation, and degradation across representative everyday situations. Deterministic invariants gate the build, while a small separate live Vertex evaluation measures model behavior without pretending it is deterministic.

**Blocked by:** 05 — Adapt from approved memories and Guidance preferences; 07 — Expand supporting artifacts to bounded images and ephemeral PDFs.

**Status:** ready-for-agent

- [ ] Committed synthetic cases cover work ambiguity, moving and household administration, difficult communication, decision paralysis, basic-needs overwhelm, and the no-artifact path.
- [ ] Boundary cases cover medical, legal, and financial situations and assert process navigation rather than diagnosis, rights determination, investment advice, or outcome prediction.
- [ ] Safety and adversarial cases cover direct danger, negated or historical wording, artifact-only danger, artifact prompt injection, irrelevant and contradictory memories, and unsupported provenance.
- [ ] Failure cases cover generation, schema repair, embeddings, Firestore, extraction, storage cleanup, quota, and retry behavior.
- [ ] Deterministic evaluation asserts invariants such as Safety ordering, provenance separation, question and retrieval budgets, bounded Pivot kinds, owner isolation, memory controls, and state preservation rather than exact prose.
- [ ] A small opt-in live Vertex AI evaluation records prompt version, model ID, schema and invariant results, latency, token use, and estimated cost using synthetic inputs only.
- [ ] Live evaluation output contains no personal content or secrets and is reported separately from deterministic pass/fail checks.
- [ ] The suite can be reproduced from documented commands and produces a concise result artifact suitable for submission evidence.
- [ ] One passing live model run is never used as the sole guarantee for a deterministic protocol behavior.


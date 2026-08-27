# 08 — Make failures observable, private, and bounded

**What to build:** The complete core protocol remains useful and understandable when a model, embedding, database, artifact, or cleanup dependency fails. A person keeps valid progress and sees the next safe option, while operators receive bounded, content-free diagnostics and cost controls.

**Blocked by:** 05 — Adapt from approved memories and Guidance preferences; 07 — Expand supporting artifacts to bounded images and ephemeral PDFs.

**Status:** ready-for-agent

- [ ] Each dependency failure maps to a typed protocol result with an owner-visible explanation and a safe retry, continuation, curated fallback, or interruption appropriate to that stage.
- [ ] Accepted Quick dumps, corrected Situation maps, selected Pivots, and accepted outcomes survive failures and retries whenever their state is already valid.
- [ ] Model-produced state always receives strict validation and no more than one repair attempt before a typed fallback.
- [ ] Failed, partial, invalid, or Safety-interrupted protocols never produce a Derived memory.
- [ ] Duplicate state-changing requests remain idempotent across timeout and retry boundaries.
- [ ] Cloud Logging telemetry is limited to correlation and pseudonymous owner identifiers, event or tool name, status, latency, model ID, token use, retry count, result counts, and fallback kind.
- [ ] Quick dumps, extracted content, map text, prompts, responses, filenames, Calendar details, OAuth tokens, vectors, and secrets never appear in logs.
- [ ] Per-account and global daily bounds cover model use and artifact processing, with clear quota-exhausted behavior that preserves valid state.
- [ ] Cloud Run runtime limits include scale-to-zero and a low maximum instance count, with configuration documented for later deployment.
- [ ] Automated tests inject Gemini timeout and invalid output, embedding and Firestore failures, extraction and cleanup failures, quota exhaustion, and retries, and assert both preserved state and privacy-safe telemetry.


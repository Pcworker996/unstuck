# 07 — Expand supporting artifacts to bounded images and ephemeral PDFs

**What to build:** A person can optionally provide a small bounded collection of supported images and PDFs, with independent processing feedback and ephemeral PDF handling. Useful accepted input survives individual artifact failures, and raw files do not accumulate in durable application state.

**Blocked by:** 06 — Synthesize an optional image safely.

**Status:** ready-for-agent

- [ ] A Stuck situation accepts at most five JPEG, PNG, WebP, or PDF artifacts, no more than 10 MB per file, 25 MB combined, and 20 pages per PDF.
- [ ] Content type and PDF properties are inspected rather than trusted from extensions; unsupported, encrypted, malformed, oversized, over-page, and over-count inputs are rejected explicitly without silent truncation.
- [ ] Multiple accepted artifacts retain distinct provenance so each derived claim can be traced to the appropriate artifact without retaining its original filename.
- [ ] Images continue through bounded inline extraction; PDFs use random object names in private temporary Cloud Storage.
- [ ] Every temporary PDF deletion is attempted after both successful and failed processing, and a one-day lifecycle rule provides a cleanup backstop.
- [ ] No public URL, original filename, raw file bytes, extracted full document, or storage credential is persisted in Firestore, logs, Activity traces, or Derived memory.
- [ ] One artifact's rejection or extraction failure does not erase accepted Quick dump text, valid claims from other artifacts, or the person's map corrections.
- [ ] The second-stage Safety gate runs on safely extracted content before any artifact can update the map, retrieve memory, or influence generation.
- [ ] Adapter contract tests verify bucket privacy, random naming, deletion on success and failure, lifecycle configuration, and content-free diagnostics.
- [ ] End-to-end tests cover mixed valid and invalid artifacts, every limit, partial progress, cleanup failure, and continuation without artifacts.


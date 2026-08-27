# 06 — Synthesize an optional image safely

**What to build:** A person may add one supported image initially or later, and the Pivot guide can synthesize useful claims from it into the existing Situation map without treating the image as instructions or as the person's own words. The Quick dump remains sufficient when no image is supplied or extraction fails.

**Blocked by:** 03 — Collaborate through a versioned, editable Situation map.

**Status:** ready-for-agent

- [ ] A person can start and finish the protocol without an image, or add one supported JPEG, PNG, or WebP image when they choose.
- [ ] The application detects actual content type, enforces the per-file size bound, and returns transparent feedback for unsupported or malformed input.
- [ ] Accepted image bytes are processed inline and are not retained as a Private entry or Derived memory.
- [ ] Extracted image claims are schema-validated and enter only the artifact-claim section with artifact provenance.
- [ ] A second app-owned Safety gate screens extracted content before it can update the map, trigger retrieval, or influence a recommendation.
- [ ] Image text that asks the model to ignore rules, invoke tools, retrieve memory, schedule an event, or impersonate the person has no authority to do so.
- [ ] Extraction, validation, or second-stage Safety failure preserves the Quick dump and prior valid Situation map and offers a safe continuation or interruption.
- [ ] Adding an image creates owner-visible Activity-trace events for review, Safety, accepted map changes, rejection, or fallback without logging image content or filenames.
- [ ] Deterministic tests cover no-image, valid image, malformed input, prompt injection, artifact-only danger, provenance, extraction failure, and non-retention.
- [ ] The workspace makes image upload optional and does not pressure the person to add more artifacts.


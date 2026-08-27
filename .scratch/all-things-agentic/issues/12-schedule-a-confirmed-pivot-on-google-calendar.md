# 12 — Schedule a confirmed Pivot on Google Calendar

**What to build:** As a cuttable stretch capability, a person who has chosen a Pivot can temporarily connect Google Calendar, review one proposed time block, and explicitly confirm creation. Calendar authority is session-scoped, narrow, reversible, and unable to block or silently expand the core protocol.

**Blocked by:** 11 — Deliver the All Things Agentic judging path.

**Status:** ready-for-agent

- [ ] Calendar authorization is requested incrementally only after the person chooses scheduling and is limited to the active session with no retained refresh token.
- [ ] The Calendar adapter reads only relevant free/busy information and event details the person explicitly selected.
- [ ] The guide proposes one time block and shows the exact title, start time, duration, and destination calendar before any create action.
- [ ] Creation requires an explicit confirmation bound to the exact proposal and current Situation-map version.
- [ ] Duplicate confirmation returns the original event reference without creating a second event.
- [ ] Unstuck can modify only the event it created and cannot invite guests, delete events, move existing events, inspect unrelated details, or perform background Calendar work.
- [ ] Denial, expiry, conflict, quota, or Calendar failure leaves the selected Pivot and protocol state intact and offers a non-Calendar continuation.
- [ ] Calendar content and OAuth material are excluded from logs, Derived memories, and unrelated model context.
- [ ] Deterministic protocol tests cover preview, stale confirmation, idempotent create, narrow modification, denial, expiry, and failure; adapter contract tests enforce scopes and forbidden operations.
- [ ] The workspace clearly labels Calendar as optional and presents review and confirmation as separate observable states.


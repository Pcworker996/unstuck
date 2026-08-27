# 01 — Expand a Google-native authenticated runtime

**What to build:** A person can use Google sign-in to enter an owner-scoped private Unstuck workspace served by the Google-native runtime, and a minimal protocol record can be persisted and reloaded from an initially empty Firestore database. This is the expand step: the existing runtime may remain temporarily so the application stays green while later slices migrate behavior.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A signed-out visitor sees a clear sign-in state and cannot invoke authenticated protocol operations.
- [ ] A valid Firebase identity is verified on the server, and ownership is derived exclusively from that verified identity rather than a client-supplied account identifier.
- [ ] An authenticated person can create and reload a minimal owner-scoped protocol record through the application on the Cloud Run-compatible runtime.
- [ ] A different authenticated owner cannot read, mutate, or infer the first owner's protocol state.
- [ ] The Google-native runtime composes Firebase Authentication and Firestore behind internal interfaces with deterministic in-memory test adapters.
- [ ] Invalid, expired, and missing credentials produce typed user-visible failures without exposing secrets or private state.
- [ ] The existing test suite remains green while the old runtime still exists beside this expanded path.


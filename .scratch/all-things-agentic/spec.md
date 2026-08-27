# Adapt Unstuck into a situation-map Collaborative Partner

**Source:** [GitHub issue #11](https://github.com/Pcworker996/unstuck/issues/11)

**Status:** approved

## Problem Statement

A person can become stuck in an everyday situation—work, moving, household administration, difficult communication, or another non-clinical moment—while holding a messy mix of thoughts, constraints, documents, and images. A generic chat assistant can summarize that material, but it does not reliably separate the person's statements from its own interpretations, preserve the person's authority, learn transparently from corrections and outcomes, or turn the situation into one safe and manageable next action.

The person needs a collaborative self-regulation companion that can do meaningful cognitive work on their behalf without diagnosing them or taking uncontrolled action. They need to be able to begin with only a quick dump, optionally add supporting artifacts, inspect and correct the agent's understanding, choose a bounded Pivot, and decide what is remembered. The resulting product must also visibly demonstrate the stateful synthesis, data mutation, feedback capture, and Google Cloud execution expected of an All Things Agentic Hackathon Collaborative Partner.

## Solution

Evolve Unstuck into a structured, mobile-first Pivot protocol workspace for broad everyday stuck situations. The authenticated person begins with a text-first quick dump and may optionally attach images or short PDFs. The single Pivot guide safely extracts untrusted artifact content, creates an editable and provenance-aware Situation map, retrieves a bounded set of the person's approved Derived memories, asks no more than two one-at-a-time and skippable clarification questions, and recommends one best-fit Pivot with two alternatives from the bounded Pivot library.

The Situation map is the agent's primary action surface. It distinguishes what the person shared, what an artifact claims, and what the Pivot guide interprets; records uncertainties, constraints, immediate progress, Pivot history, and relevant prior patterns; and visibly changes when the person corrects it or supplies feedback. An Activity trace shows observable agent actions and state changes without exposing hidden reasoning. The person remains responsible for selecting and performing the Pivot. A narrowly scoped, confirmation-gated Google Calendar time block is a stretch capability after the core protocol is complete.

The submission keeps the Unstuck repository and brand because its Git history begins within the hackathon submission period. The active runtime moves to a single Google-native architecture: Genkit, Gemini 3.5 Flash on Vertex AI, Cloud Run, Firebase Authentication, Firestore, Firestore vector search with `gemini-embedding-001`, and private temporary Cloud Storage for PDFs. It preserves Unstuck's application-owned Safety interruption, bounded Pivot library, user-governed memory, typed fallbacks, and private logging discipline while replacing the AWS-, Bedrock-, CockroachDB-, and numeric emotional-state assumptions of the earlier MVP.

## User Stories

1. As a person who feels stuck, I want to begin with a quick dump, so that I can ask for help without first organizing the situation myself.
2. As a person, I want a quick dump to be sufficient on its own, so that supporting artifacts never become an intake requirement.
3. As a person, I want to use Unstuck for everyday stuck situations beyond work, so that the same self-regulation support can help with life administration, decisions, communication, and household tasks.
4. As a person, I want Unstuck to remain explicitly non-clinical, so that I understand it does not diagnose, predict crisis, or replace professional or emergency care.
5. As a person, I want to sign in to a Personal account, so that my Situation maps and memories remain owner-scoped across devices.
6. As a person, I want to attach images or PDFs when I choose, so that relevant messy context can inform the Pivot guide.
7. As a person, I want to add supporting artifacts initially or later, so that I control how much context I share.
8. As a person, I want Unstuck to continue when I provide no supporting artifact, so that I am never pressured to upload sensitive material.
9. As a person, I want transparent file type, file size, page count, and total-upload limits, so that a rejected artifact does not fail mysteriously.
10. As a person, I want accepted input to remain intact rather than be silently truncated, so that I know what the Pivot guide actually considered.
11. As a person, I want malformed, encrypted, or unsupported artifacts to fail independently, so that my quick dump can still continue through the protocol.
12. As a person, I want my uploaded artifacts deleted after processing by default, so that Unstuck does not accumulate raw sensitive files.
13. As a person, I want a Situation map created from my input, so that the messy situation becomes inspectable and actionable.
14. As a person, I want the Situation map to show what I shared, so that my own statements remain identifiable.
15. As a person, I want artifact-derived claims labeled separately, so that a document or screenshot is not mistaken for my own statement.
16. As a person, I want the Pivot guide's interpretations labeled separately, so that model inferences never silently become facts.
17. As a person, I want uncertainties and contradictions shown explicitly, so that I can correct the most important gap.
18. As a person, I want constraints and deadlines represented in the Situation map, so that a suggested Pivot is realistic for my circumstances.
19. As a person, I want to define what progress means right now, so that the Pivot guide optimizes for an immediate achievable aim rather than solving everything.
20. As a person, I want to edit any Situation-map field, so that I remain the authority on my situation.
21. As a person, I want corrections to remain visible as feedback, so that the Pivot guide can adapt without constructing a hidden profile.
22. As a person, I want an Activity trace of observable agent actions and Situation-map changes, so that I can see the work performed on my behalf.
23. As a person, I want the Activity trace to exclude hidden reasoning, so that it remains a factual audit rather than a chain-of-thought display.
24. As a person, I want the Pivot guide to decide whether clarification is useful, so that the protocol adapts instead of behaving like a fixed questionnaire.
25. As a person, I want at most two clarification questions before the first recommendation, so that support does not turn into a burdensome intake interview.
26. As a person, I want clarification questions asked one at a time, so that I can focus on the most useful decision.
27. As a person, I want to skip every clarification question, so that I can continue with the context I am comfortable sharing.
28. As a person with approved history, I want one bounded Semantic retrieval attempt, so that a relevant prior Pivot can inform the current recommendation consistently.
29. As a person, I want retrieval constrained to my Personal account, so that another person's memory can never affect my protocol.
30. As a person, I want at most three sufficiently relevant Derived memories considered, so that personalization remains focused and explainable.
31. As a person, I want to see which prior memory informed the Situation map or Pivot recommendation, so that personalization is inspectable.
32. As a person, I want to remove or forget a retrieved memory before it affects the recommendation, so that an outdated association remains under my control.
33. As a person, I want to state a Guidance preference explicitly, so that future support can reflect choices such as favoring concrete steps or avoiding a Pivot type.
34. As a person, I want inferred personality traits and hidden preferences prohibited, so that adaptation never becomes psychological profiling.
35. As a person, I want one recommended Pivot and two meaningfully different alternatives, so that I receive guidance without losing choice.
36. As a person, I want every recommendation kept inside the bounded Pivot library, so that the Pivot guide does not invent unbounded or professional advice.
37. As a person, I want to select, regenerate, or dismiss a Pivot, so that an unsuitable suggestion is never imposed.
38. As a person, I want to perform the Pivot myself, so that the Pivot guide does not take uncontrolled action in my life.
39. As a person in a medical, legal, or financial stuck situation, I want only safe process navigation, so that Unstuck can help me organize questions or reach qualified support without pretending to be an expert.
40. As a person indicating immediate danger to myself or another person, I want the normal protocol interrupted by stable app-owned guidance toward urgent human and local support, so that a routine Pivot is not presented as adequate.
41. As a person, I want Safety screening to consider both my quick dump and extracted artifact content, so that an important direct-danger statement is not missed merely because it appeared in an attachment.
42. As a person, I want to record whether a selected Pivot was completed, partly helpful, not a fit, or skipped, so that adaptation uses my actual experience.
43. As a person, I want to optionally report that I feel more able, about as able, or less able to continue, so that I can describe an immediate Agency shift without receiving a wellness score.
44. As a person, I want Pivot time and Pivot outcome retained when I choose to save, so that I can recognize which small actions helped in similar moments.
45. As a person, I want the product to avoid numeric emotional-state and wellness scoring, so that one subjective moment is not presented as a judgment about me.
46. As a person, I want explicit consent before model processing and memory saving, so that sensitive context remains user-governed.
47. As a person, I want a visible save control for every Check-in, so that I choose which situations become Private entries and Derived memories.
48. As a person, I want to complete an unsaved protocol, so that I can receive support without creating retained history.
49. As a person, I want a saved quick dump, Situation map, selected Pivot, Pivot outcome, and approved Derived memory to remain inspectable, so that I understand what Unstuck remembers.
50. As a person, I want to inspect and delete saved Check-ins, Derived memories, and Guidance preferences, so that I can revoke remembered context later.
51. As a person, I want supporting-artifact bytes excluded from Derived memories, so that personalization does not preserve raw files invisibly.
52. As a person, I want a useful curated fallback when artifact extraction, memory retrieval, Gemini, embeddings, or Firestore is temporarily unavailable, so that optional platform failures do not erase useful progress.
53. As a person, I want the quick dump or corrected Situation map preserved across a retry, so that I do not have to repeat emotionally difficult input.
54. As a person, I want failed or partial protocols excluded from Derived memory, so that unreliable state does not influence future recommendations.
55. As a person, I want duplicate submissions and retries handled idempotently, so that one action cannot create multiple outcomes or calendar events.
56. As a person, I want stale Situation-map edits rejected safely, so that one browser tab cannot silently overwrite a newer correction.
57. As a person, I want to optionally connect Google Calendar only when scheduling a chosen Pivot, so that calendar access is not required for self-regulation support.
58. As a person using Calendar, I want the Pivot guide to inspect only relevant availability and explicitly selected event details, so that unrelated calendar content remains private.
59. As a person using Calendar, I want to review the proposed title, start time, duration, and calendar before creation, so that no event is created without informed confirmation.
60. As a person using Calendar, I want Unstuck to modify only the event it created and never delete or move another event, so that its authority stays narrow and reversible.
61. As a person using Calendar, I want authorization limited to the active session, so that Unstuck does not retain a refresh token or gain background calendar access.
62. As a person, I want Calendar denial, expiry, or failure to leave the chosen Pivot intact, so that a stretch integration never blocks the core protocol.
63. As a mobile user, I want a focused protocol workspace with collapsible Situation map and Activity trace sheets, so that the interface remains usable during interruption-prone moments.
64. As a desktop user, I want the guide, Situation map, and Activity trace visible together when space permits, so that I can inspect collaboration without navigating between unrelated screens.
65. As a hackathon judge, I want an unedited moving-related life-admin demo that transforms a quick dump and optional artifacts into a corrected Situation map and chosen Pivot, so that the agent's operational utility is undeniable.
66. As a hackathon judge, I want a later interaction to visibly respect an explicit correction, Guidance preference, or Pivot outcome, so that persistent adaptation is demonstrated rather than claimed.
67. As a hackathon judge, I want safe Cloud logs and Activity-trace entries to prove real Genkit, Gemini, Firestore, and Cloud Run execution, so that the application is visibly more than a prerecorded UI.
68. As a hackathon judge, I want reproducible setup instructions, an architecture diagram, source history, and visible Google Cloud deployment proof, so that I can assess production readiness.
69. As a hackathon judge, I want the application available through judging with synthetic data guidance and bounded quotas, so that I can evaluate it without exposing real personal information or causing uncontrolled cost.
70. As a maintainer, I want privacy-safe structured telemetry with no quick dumps, artifact content, Situation-map text, prompts, responses, filenames, calendar details, or tokens, so that diagnostics do not create undeletable copies of user content.

## Implementation Decisions

- Keep the Unstuck repository and brand. Preserve Git history showing that the first commit occurred after the hackathon submission period opened, and disclose any pre-period code or assets if any are later identified. This spec supersedes the platform, input, interaction, and emotional-state assumptions in #1 while preserving its completed behavior and tests as prior art.
- Use one deep **Pivot Protocol** module as the primary application interface and testing seam. It accepts authenticated, versioned protocol commands and returns typed protocol state, Activity-trace entries, and requested effects. HTTP routes and the UI must not recreate protocol decisions.
- Commands cover starting a Stuck situation, adding accepted artifacts, answering or skipping a clarification, correcting the Situation map, selecting/regenerating/dismissing a Pivot, recording a Pivot outcome and Agency shift, previewing a calendar hold, and confirming a bound calendar action.
- Keep external dependencies behind internal seams with concrete adapters for identity, Genkit/Gemini generation, embeddings, memory persistence and vector retrieval, artifact extraction/storage, Calendar, and privacy-safe logging. Only introduce a seam where production and deterministic test adapters both exist.
- Make Google Cloud the sole active submission runtime, as recorded by ADR 0052. Use TypeScript, Genkit, Gemini 3.5 Flash through Vertex AI, Cloud Run, Firebase Authentication with Google sign-in, Firestore, Firestore vector search, and private temporary Cloud Storage. Remove inactive AWS runtime implementation from the final working tree while preserving it in Git history.
- Start the Google deployment with an empty Firestore database. Do not migrate existing Personal accounts, Private entries, or Derived memories from CockroachDB. Demo and evaluation data must be synthetic and clearly labeled.
- Model the Situation map with fixed person-editable sections for what the person shared, artifact-derived claims, Pivot-guide interpretations, uncertainties, constraints, the immediate definition of progress, Pivot history, and optional relevant prior patterns. Every item records provenance; an interpretation cannot silently become a user statement.
- Present the experience as a structured protocol workspace rather than a general chat interface. Use a focused quick-dump intake, a workspace combining the guide with an editable Situation map and Activity trace, a Pivot-selection state, an outcome state, and a later-adaptation state. Use collapsible sheets on mobile and adjacent views on larger screens.
- Remove the required numeric emotional-state input and post-Pivot rating. Preserve optional Pivot time and replace the rating with the optional Agency shift values `more-able`, `about-as-able`, and `less-able`.
- Allow a quick dump to start every protocol with no artifact. Supporting artifacts remain optional and user-initiated; the Pivot guide may note uncertainty but does not directly pressure the person to upload more.
- Accept at most five JPEG, PNG, WebP, or PDF artifacts per Stuck situation, with a maximum of 10 MB per file, 25 MB combined, and 20 pages per PDF. Detect content types rather than trusting extensions, reject unsupported/encrypted/malformed input explicitly, and never truncate silently.
- Treat artifacts as ephemeral, untrusted data under ADR 0054. Send bounded images inline for extraction. Store PDFs under random names in a private bucket, delete them after success or failure, and enforce a one-day lifecycle cleanup backstop. Do not retain public URLs, original filenames, or bytes in Firestore.
- Use a two-stage Safety gate: screen the direct quick dump before model, memory, or persistence work; then screen safely extracted artifact content before it can update the Situation map, retrieve memory, or generate a recommendation. The extraction step has no tool authority. Either gate can return the existing app-owned Safety interruption.
- Treat all artifact text, model output, and tool output as untrusted data. Artifact content cannot invoke tools, alter Safety rules, retrieve memory, schedule Calendar actions, or become a user statement.
- Create the initial Situation map using schema-validated model output. Allow no more than two one-at-a-time, skippable clarification questions before the first Pivot recommendation. A clarification updates versioned protocol state rather than creating a separate chat history as the source of truth.
- After an initial usable Situation map exists and the person has approved memories, make exactly one owner-scoped Semantic retrieval attempt. Generate 768-dimensional embeddings with `gemini-embedding-001`; query Firestore with cosine distance; retrieve at most three candidate Derived memories; apply a configured relevance threshold; and expose neither vector values nor scores to the Pivot guide or browser.
- Show linked Memory explanations for memories that influence the Situation map or recommendation. Let the person inspect, exclude, delete, or forget the memory. Do not pass raw Private entries through the retrieval interface.
- Personalize only from explicit Situation-map corrections, selected/dismissed/regenerated Pivots, Pivot outcomes, Agency shifts, and Guidance preferences. Do not infer diagnoses, personalities, motives, permanent traits, or hidden preferences.
- Continue to restrict recommendations to the bounded Pivot library: grounding, breathing or focus, reaching out, basic-needs reset, and task first step. Return one primary recommendation plus exactly two distinct alternatives whenever normal generation succeeds.
- Keep substantive professional advice outside the Pivot guide. For medical, legal, or financial situations, allowed Pivots organize questions, locate authoritative information, contact a qualified person, or stabilize before the next step; they do not diagnose, determine rights, recommend investments, or predict outcomes.
- Make saving per-Check-in and consent-governed. A saved protocol may retain its Private entry, versioned Situation map, selected Pivot, Pivot outcome, Agency shift, explicit Guidance preferences, and compact Derived memory. An unsaved protocol creates no lasting user history. Artifact bytes never become Derived memory.
- Persist owner-scoped Personal accounts, protocols/Check-ins, Situation-map versions and provenance, outcomes, Guidance preferences, Derived memories and 768-dimensional embeddings, deletion/forget state, Activity-trace metadata, and idempotency records in Firestore. Enforce ownership from the authenticated identity rather than any client-supplied account identifier.
- Make every model-produced map, clarification, memory update, and recommendation pass a strict schema before use or persistence. Permit one bounded repair attempt; then return a typed fallback that preserves valid prior state. Unknown Pivot kinds, unsupported provenance, unlinked memory references, and professional/diagnostic claims are invalid.
- Degrade safely by stage. Artifact failure continues from accepted input; retrieval failure continues without personalization and discloses that status; map-generation failure preserves input and offers retry; recommendation failure preserves the corrected map and offers a curated fallback or retry; outcome-enrichment failure preserves the accepted outcome but marks memory enrichment unavailable. Never derive memory from an incomplete or invalid run.
- Version all Situation-map mutations and require an expected version for writes. Attach idempotency keys to state-changing requests. Bind Calendar confirmation to the exact proposed event and map version so retries return the existing event rather than create a duplicate.
- Show an owner-visible Activity trace describing observable actions and state changes such as artifact review, Safety completion, memory retrieval, map revision, Pivot generation, fallback use, and confirmed scheduling. Do not expose chain of thought, raw prompts, or hidden model reasoning.
- Emit content-free structured telemetry to Cloud Logging: correlation/protocol identifier, pseudonymous owner identifier, event/tool name, status, latency, model ID, token use, retry count, result counts, and fallback kind. Never log user text, extracted content, map text, prompts, model responses, filenames, Calendar details, OAuth tokens, or secret material.
- Treat Google Calendar as a stretch module after the complete core submission. Request incremental session-scoped authorization only when scheduling is chosen; store no refresh token. Read free/busy data and only explicitly selected event details; propose one time block; require confirmation of title, start, duration, and calendar; create or modify only that Unstuck-created event; never invite guests, move existing events, or delete events.
- Deploy Cloud Run with scale-to-zero, a low maximum instance count, per-account and global daily quotas for model/artifact use, authenticated endpoints, and budget alerts. Keep the application available through judging with synthetic-data guidance. A deterministic replay may help explain the demo path but must be labeled and cannot replace the required unedited live proof.
- Prioritize the complete core protocol, automated tests/evaluations, deployment, architecture diagram, reproducible README, and public four-minute video. Calendar, a build article, and a social post are cuttable stretch items. Do not integrate extra Google AI models solely for bonus points.

## Testing Decisions

- Use the deep Pivot Protocol module as the primary test seam. Tests issue authenticated protocol commands through its interface and assert externally observable returned state, Activity-trace events, requested effects, and persisted state through deterministic in-memory adapters. Do not test private helper functions, prompt wording, Genkit internals, or React implementation structure.
- Reuse the existing application-seam prior art around `runPivotProtocolService`: Safety priority, consent ordering, one owner-scoped retrieval, bounded recommendations, persistence, idempotent outcomes, memory enrichment, and typed fallbacks are behaviors to preserve while the interface expands from one-shot execution to stateful commands.
- Test a complete normal protocol: start from a quick dump, create a provenance-aware Situation map, answer or skip up to two clarifications, make a correction, retrieve an approved memory, receive one primary and two alternative Pivots, select one, and record an outcome plus optional Agency shift.
- Test that a quick dump without artifacts always remains sufficient and that optional artifact rejection or extraction failure cannot erase accepted input or block a safe fallback.
- Test every upload constraint and cleanup guarantee: content-detected MIME allowlist, per-file/combined size, PDF pages, encrypted/malformed files, five-file count, image inline handling, PDF temporary storage, deletion after success/failure, and lifecycle-backstop configuration.
- Test provenance invariants: user statements, artifact claims, and guide interpretations remain distinguishable; edits are versioned; stale writes conflict; and no model or artifact output can promote itself to user-supplied fact.
- Test the two-stage Safety ordering with danger in direct input, danger only in extracted content, negated/historical wording, extraction failure, consent absent, and model/platform failures. Assert that the Safety interruption remains app-owned and no normal model, memory, persistence, or Calendar action follows an interruption.
- Test the question budget: questions are optional, one at a time, skippable, capped at two before the first recommendation, and never make an artifact mandatory.
- Test schema enforcement and one bounded repair attempt for every model output. Cover invalid Pivot kinds, duplicate alternatives, unsupported provenance, invented memory references, diagnostic/professional claims, malformed maps, and repair failure.
- Test Semantic retrieval with `gemini-embedding-001` shape validation, 768 dimensions, owner filtering, top-three limit, relevance threshold, no-match, forgotten/excluded memories, unavailable embeddings, unavailable Firestore, and vector-score non-disclosure.
- Test personalization using only explicit corrections, Pivot choices, outcomes, Agency shifts, and Guidance preferences. Include irrelevant or contradictory memories and assert that hidden traits or diagnoses never enter the map or recommendation.
- Test memory control for saved and unsaved protocols, inspection, deletion, forget, preference deletion, excluded memories, ephemeral artifact bytes, and the rule that incomplete/invalid runs produce no Derived memory.
- Test every safe-degradation stage and ensure valid prior protocol state survives retry. Include Gemini timeout, invalid output, embedding failure, Firestore read/write failure, artifact extraction failure, Cloud Storage cleanup failure, Calendar denial/expiry/failure, and quota exhaustion.
- Test versioning and idempotency for map correction, Pivot selection, outcome submission, memory enrichment, and Calendar confirmation. A duplicate Calendar confirmation must return the original event reference without another external create.
- Test Calendar only through its narrow module interface: incremental authorization, session-only token, free/busy/selected-details reads, confirmation-bound create, modification of an Unstuck-created event, prohibition of deletion/invites/unrelated event access, and non-blocking failure.
- Keep minimal HTTP seam tests for authenticated identity derivation, request/command parsing, multipart upload handling, status codes, request/version/idempotency headers, and owner ID exclusion from client-controlled input. This extends the existing narrow HTTP-handler tests.
- Add adapter contract tests for Genkit structured outputs/tool declarations, Firestore owner-scoped persistence/vector queries, Firebase token verification, Cloud Storage privacy and cleanup, privacy-safe logging, and Calendar scope/action restrictions. The contract tests should not duplicate protocol behavior.
- Add observable UI-state tests for signed-out, intake, upload feedback, Safety interruption, clarification, editable Situation map, Activity trace, recommendation, outcome, memory control, fallback, and Calendar confirmation states. Assert accessible labels and user-visible behavior rather than internal React structure.
- Add an end-to-end mobile-first path using synthetic data: Google sign-in/test identity, moving quick dump, optional landlord image and checklist PDF, map correction, one clarification, memory-influenced recommendation, Pivot selection, outcome/Agency shift, and later visible adaptation. Add a no-artifact path and a Safety-interruption path.
- Maintain a committed synthetic evaluation suite for work ambiguity, moving/household administration, difficult communication, decision paralysis, basic-needs overwhelm, medical/legal/financial boundaries, direct danger, artifact prompt injection, irrelevant/contradictory memory, Calendar conflict/denial, and platform failures. Assert invariants rather than exact prose.
- Run a small live Vertex AI evaluation separately from deterministic tests. Record prompt version, model ID, schema/invariant results, latency, and estimated cost using synthetic input; do not treat one passing model run as a deterministic guarantee.
- Verify the deployed build with an unedited live run, privacy-safe Cloud Logging evidence, Firestore state mutation, Cloud Run URL/console proof, reproducible setup, architecture diagram, quotas, and scale-to-zero behavior.

## Out of Scope

- Clinical diagnosis, treatment, therapy, crisis counseling, crisis prediction, emergency intervention, or replacement of professional/human support.
- Numeric emotional-state ratings, wellness scores, recovery scores, inferred personality profiles, hidden Guidance preferences, or passive behavioral surveillance.
- Solving the entire underlying Stuck situation, guaranteeing that the person feels better, or treating Pivot outcomes as clinical outcomes.
- Unbounded free-form advice, open-ended professional advice, arbitrary web research, or recommendations outside the bounded Pivot library.
- A multi-agent system, agent swarm, Fortified Enterprise Fleet architecture, or Taskmaster-style unattended background automation.
- Automatic performance of a Pivot, autonomous outreach, email/Slack/Jira integrations, reminders, push notifications, wearables, or passive Calendar monitoring.
- Calendar access beyond the confirmation-gated stretch capability: no persistent refresh token, background access, guest invitations, event deletion, moving existing events, or general calendar management.
- Guest or anonymous sessions, account migration from Cognito, or migration of existing CockroachDB user/memory data into Firestore.
- Supporting-artifact formats beyond JPEG, PNG, WebP, and PDF; audio/voice input; video input; OCR/document archives; or retention of raw artifact bytes.
- Simultaneous AWS and Google production adapters, a dual-cloud runtime, continued Bedrock/CockroachDB/ECS operation in the submitted working tree, or customer-facing Managed MCP access.
- Extra Gemma, Veo, Lyria, or other model integrations added only for hackathon bonus points.
- A native mobile application, broad task manager, health dashboard, or open-ended analytics suite.
- Calendar implementation before the core protocol, tests, deployment, architecture diagram, README, and four-minute demo are complete.

## Further Notes

- This is the buildable successor to #1 for the All Things Agentic Hackathon. Existing completed tickets and tests remain prior art; new tickets generated from this spec should describe tracer-bullet migrations and explicit blocking edges rather than reopening already proven behavior without need.
- ADR 0052 records the sole Google Cloud runtime, ADR 0053 records the Situation map as the bounded agent action surface, and ADR 0054 records ephemeral/untrusted supporting artifacts and two-stage Safety handling.
- The flagship four-minute demo is moving-related life-admin overload: a synthetic quick dump plus optional landlord message image and moving-checklist PDF; visible map synthesis and correction; one clarification; relevant approved memory; bounded Pivot choice; optional Calendar preview only if complete; outcome and Agency shift; then later adaptation.
- The primary product measures remain Pivot time, Pivot outcome, and optional Agency shift. The demo must not claim that Unstuck completed the move, measured wellness, or resolved distress.
- The official deadline is August 31, 2026 at 5:00 PM Pacific. The submission needs one category, project description, repository, reproducible spin-up instructions, architecture diagram, public English YouTube/Vimeo video no longer than four minutes, and visible proof of a Google Cloud backend.
- Keep the deployed application quota-controlled and available through the judging period. Use only synthetic data in public demonstrations and evaluation fixtures.
- Official requirements and judging criteria: https://allthingsagentichackathon.devpost.com/rules



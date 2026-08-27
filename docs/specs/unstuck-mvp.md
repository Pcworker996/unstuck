# Unstuck MVP: User-Governed Memory-to-Pivot Support

## Problem Statement

An early-career engineer or comparable knowledge worker can become overwhelmed by an ambiguous or high-stakes task and lose the ability to decide what to do next. Existing task tools assume the person can already plan, while generic chat tools do not reliably remember which small actions helped that person in similar moments. The person needs private, immediate, non-clinical support that turns an optional quick dump and check-in into a manageable next action without taking control away from them.

## Solution

Unstuck is a mobile-first, authenticated self-regulation companion. A person voluntarily writes a quick dump, reports their current emotional-state rating, and chooses whether to save the check-in. The Pivot guide considers the current check-in and semantically similar derived memories from that person's own history, then offers one personalized Pivot recommendation with alternatives from a bounded Pivot library. The person chooses, regenerates, or dismisses a Pivot and later records its Pivot outcome.

CockroachDB is the system of record for private entries, derived memories, embeddings, Pivot choices, and outcomes. Amazon Bedrock creates derived memories, embeddings, and recommendations. CockroachDB Distributed Vector Indexing retrieves semantically similar memories, so a prior helpful Pivot can demonstrably influence a later recommendation. The product remains non-clinical, user-governed, and user-initiated.

## User Stories

1. As a person feeling overwhelmed, I want to open Unstuck quickly on my phone, so that I can get support before I am distracted or avoid the moment.
2. As a person, I want to enter a text-first Quick dump, so that I can capture the thought, task, or situation causing the moment without composing a journal entry.
3. As a person, I want to rate my current emotional state quickly, so that the Pivot guide has concise context for this Check-in.
4. As a person, I want to know that Unstuck is non-clinical and not a substitute for professional or emergency care, so that I understand its boundary.
5. As a person, I want to consent before my Private entry is sent to the Model provider, so that I can make an informed choice about processing sensitive text.
6. As a person, I want the visible save control enabled by default after I have consented, so that the companion can remember the moments I want it to learn from.
7. As a person, I want to process a Check-in without saving it, so that I can receive one-off support for a sensitive moment.
8. As a person, I want my history tied to my Personal account, so that it follows me securely across devices rather than being attached to a browser.
9. As a person, I want the Pivot guide to propose one best-fit Pivot and alternatives, so that I retain control over what I do next.
10. As a person, I want to regenerate or dismiss a Pivot recommendation, so that I am never forced into a suggestion that does not fit.
11. As a person, I want a Pivot to be small and concrete, so that an overwhelming situation becomes possible to act on now.
12. As a person facing a daunting task, I want a task first-step Pivot, so that I can begin without needing to solve the entire task.
13. As a person whose best next action is not task-related, I want grounding, breathing or focus, reaching-out, and basic-needs-reset Pivots, so that Unstuck supports broader moments of distress.
14. As a person using a focus Pivot, I want a calming, distraction-light focus experience with an appropriate timer or visual, so that I can stay with the chosen action.
15. As a person, I want the Pivot guide to recognize a meaningfully similar prior moment even when I use different words, so that the recommendation is personalized rather than keyword-driven.
16. As a person, I want to see an optional Memory explanation for a recommendation, so that I can verify the past pattern influencing it.
17. As a person, I want the Memory explanation to use factual, modest language, so that it does not make psychological claims about me.
18. As a person, I want to inspect my Private entries and Derived memories, so that I understand what Unstuck retains.
19. As a person, I want to delete an entry or derived memory, so that I can remove information I no longer want retained.
20. As a person, I want to forget a remembered pattern, so that an outdated or unhelpful association stops affecting future recommendations.
21. As a person, I want to record whether a Pivot was completed, partly helpful, not a fit, or skipped, so that the guide learns from my actual experience rather than an assumed result.
22. As a person, I want to optionally update my emotional-state rating after a Pivot, so that I can reflect on the immediate result without treating it as a medical measure.
23. As a person, I want to see Your Patterns, including helpful Pivots, typical Pivot time, and recurring self-reported contexts, so that I can understand my history without receiving a health score.
24. As a person, I want every pattern in Your Patterns to link to the memories behind it, so that the analytics remain inspectable and user-governed.
25. As a person with no useful history yet, I want a useful generic curated Pivot, so that the first Check-in still helps.
26. As a person, I want a useful fallback when model inference or Semantic retrieval is unavailable, so that a temporary technical failure does not leave me unsupported.
27. As a person who indicates immediate danger to myself or another person, I want Unstuck to interrupt the normal flow and direct me toward urgent human, local support, so that the app does not pretend a routine Pivot is adequate.
28. As a person, I want an option to contact someone I trust from the Safety interruption, so that I can move toward human support.
29. As a person, I want no passive monitoring, calendar/email/wearable integrations, reminders, or push notifications in the MVP, so that support remains voluntary and non-intrusive.
30. As a hackathon judge, I want to see a later, differently worded Check-in receive a changed recommendation because a prior Pivot outcome was retrieved, so that the persistent memory layer is demonstrably meaningful.
31. As a hackathon judge, I want to see CockroachDB Managed MCP used for genuine work against Unstuck's staging database, so that the second CockroachDB tool is concrete and safe.
32. As a hackathon judge, I want a public, runnable deployment, source repository, setup documentation, and short demonstration video, so that I can evaluate the actual product and integrations.

## Implementation Decisions

- Build a mobile-first responsive web application with authenticated Personal accounts. Deploy the frontend and backend on AWS; select and document a concrete AWS hosting/runtime service before implementation begins.
- The Pivot guide is a single agentic workflow, not a multi-agent system. Its stages are: validate identity and consent; evaluate the Safety interruption; create a Derived memory and embedding when allowed; retrieve relevant user-scoped memories; produce the Pivot recommendation and alternatives; record the chosen Pivot and later Pivot outcome.
- Expose one highest-level application seam, **Run Pivot Protocol**, which accepts the authenticated person, current Check-in, and save choice, and returns either a Safety interruption or a complete Pivot protocol. UI and persistence components depend on this boundary rather than reimplementing business decisions.
- Keep application-facing model and database operations behind constrained backend interfaces. The browser must not receive CockroachDB or Bedrock credentials.
- Use Amazon Bedrock as the Model provider for generation of Derived memory, semantic embeddings, and Pivot recommendations. Model output is advisory and bounded by application-owned safety, ownership, consent, and fallback rules.
- Store a Private entry separately from its Derived memory. A Derived memory contains the compact, retrieval-relevant context, Pivot, and reported outcome; it is not a diagnosis or psychological profile.
- Use CockroachDB as the transactional system of record for Personal accounts, Check-ins, Private entries, Derived memories, selected Pivots, Pivot outcomes, consent/save state, and memory-deletion/forget actions.
- Use CockroachDB Distributed Vector Indexing to perform Semantic retrieval over Derived-memory embeddings. Every retrieval must be constrained by the authenticated owner's identity before results may influence the Pivot guide.
- Make Vector retrieval operational: retrieved prior outcomes must be available to the Pivot guide and, when relevant, change or justify the recommendation. When no relevant memory is available, the guide explicitly falls back to a curated, non-personalized Pivot.
- Restrict generated Pivots to the Pivot library: grounding, breathing or focus, reaching out, basic-needs reset, and task first-step. The Model provider personalizes within those types; it does not invent unbounded guidance.
- Present one best-fit Pivot with alternatives and controls to choose, regenerate, or dismiss. Do not automatically launch or impose a protocol.
- Provide an optional Memory explanation that states only user-verifiable prior patterns, with no diagnostic language. Provide a control to inspect the underlying memory and forget it.
- Make memory control a first-class product capability: clear consent before model processing, a visible per-Check-in save control, process-without-saving, history inspection, entry/Derived-memory deletion, and forget-pattern actions.
- Include a Safety interruption before ordinary recommendation delivery whenever the input indicates immediate danger to self or others. It must encourage urgent human/local support and offer a contact-a-trusted-person action; it must not continue as ordinary AI coaching.
- Make Your Patterns a focused view of helpful Pivots, Pivot time, and recurring Self-reported context. Avoid health scores, diagnoses, or passive data collection.
- Do not implement voice input, third-party context integrations, reminders, push notifications, a native mobile app, autonomous outreach, or an open-ended analytics suite in the MVP.
- Use CockroachDB Cloud Managed MCP through an AI-assisted development workflow against the actual Unstuck staging database for schema inspection, migration work, user-scoped retrieval validation, and diagnosis. The customer-facing Pivot guide must not have direct broad MCP/cluster access to production Private entries.
- Document the two CockroachDB tools and their concrete use: Distributed Vector Indexing for runtime Semantic retrieval, and Managed MCP Server for staging operations. Optionally use `ccloud` CLI for reproducible staging-cluster provisioning as a third tool.
- Make the deployed demo free to test during judging, with safe test access or clear sign-up instructions. Include a public open-source license, example configuration without secrets, migrations/seed path, dependencies, and run instructions.

## Testing Decisions

- Treat **Run Pivot Protocol** as the primary test seam. Tests should assert externally observable outcomes: the returned Safety interruption or Pivot protocol, the selected/retrieved memory context, and the permitted resulting memory changes.
- Use deterministic adapters for model generation, embeddings, time, and memory storage in seam-level tests. Tests must not assert prompt wording, component internals, or SQL implementation details.
- Test that a saved Check-in produces a Private entry and Derived memory; an unsaved Check-in may be processed but creates no retained memory.
- Test that Semantic retrieval is constrained to the authenticated owner and cannot surface another person's memories.
- Test that a similar later Check-in can select a different recommendation based on a prior helpful Pivot outcome, while unrelated/no-history cases use the curated fallback.
- Test all recommendation controls: choose, regenerate, dismiss, and record each Pivot outcome state.
- Test entry deletion and forget-pattern behavior so removed data cannot appear in a future Memory explanation, Your Patterns, or recommendation.
- Test the Safety interruption as a higher-priority result than ordinary Pivot generation.
- Test graceful failure behavior for unavailable Bedrock inference, embedding generation, and Vector retrieval.
- Use end-to-end tests for the mobile web path: sign in, create a Check-in, receive a Pivot, record an outcome, submit a later similar Check-in, inspect its Memory explanation, and delete/forget a memory.
- Add staging verification for CockroachDB schema/migrations, the user-scoped Vector query, and MCP-assisted operations. There is no existing application-test prior art because the repository is currently documentation-only; establish the seam-level and end-to-end behavior as the project baseline.

## Out of Scope

- Clinical diagnosis, treatment, therapy, crisis counseling, crisis prediction, or replacing professional/emergency care.
- Passive emotional monitoring or data ingestion from calendars, email, wearables, or other third-party systems.
- Reminders, push notifications, autonomous follow-ups, or outreach to contacts without the person's immediate action.
- Voice input, native iOS/Android applications, and an open-ended analytics suite.
- Direct production access from an unconstrained model or Managed MCP connection to Private entries.
- A multi-agent architecture, unbounded free-form advice, or a broad task-management system.

## Further Notes

- This project must visibly demonstrate the memory-to-pivot learning loop in the hackathon video: an initial Check-in and outcome, followed by a differently worded later Check-in whose recommendation is meaningfully informed by the stored outcome.
- The rules require an agentic application deployed on AWS, at least two meaningfully integrated CockroachDB tools, at least one AWS service, a public open-source repository, a functional demo URL, test access, and a public demonstration video shorter than three minutes. See `docs/research/hackathon-compliance.md` for the evidence checklist.
- The project should describe its non-clinical boundary, consent, Memory control, deletion/forget behavior, failure states, and safety path in its README and submission materials.

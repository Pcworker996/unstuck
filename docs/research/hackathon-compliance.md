# Unstuck: CockroachDB × AWS Hackathon Compliance

Verified 2026-08-04 against the [official rules](https://cockroachdb-ai.devpost.com/rules) and [challenge overview](https://cockroachdb-ai.devpost.com/). The rules control if the two differ.

## Verdict

**The agreed MVP can satisfy the challenge and is competitive in scope, provided the implementation makes the learning loop observable.** The core proof is not a mood app with a one-off LLM response; it is a pivot guide that persists user-controlled memories, retrieves relevant prior outcomes, chooses a bounded next action, and records whether it helped.

## Requirement matrix

| Official requirement | Planned Unstuck implementation | Status / evidence required |
| --- | --- | --- |
| Agentic application with CockroachDB as persistent memory, deployed on AWS ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Pivot Guide processes a voluntary quick dump, retrieves the signed-in user's similar past derived memories and outcomes, proposes a selected pivot, then records the outcome for future recommendations. CockroachDB is the system of record for entries, derived memories, pivot choices, outcomes, and embeddings. Deploy the app/backend on AWS. | **On track.** Show the before/after memory loop in the video and an architecture diagram in the README. |
| Components must be meaningfully integrated, not merely initialized ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Vector retrieval changes the recommendation; Bedrock creates the Derived memory, embedding, and recommendation; staging MCP work operates on the actual Unstuck schema. | **Implemented; demonstrate.** Include a trace or visible “Why this?” explanation tied to retrieved records. |
| At least two CockroachDB tools ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | (1) **Distributed Vector Indexing**: user-scoped semantic retrieval over derived-memory embeddings. (2) **Cloud Managed MCP Server**: AI-assisted staging operations—schema inspection, migration/retrieval validation, and diagnosis—on the same data model. | **On track, but document concretely.** The submission must state what the agent did with each tool. A third tool, `ccloud` CLI for reproducible provisioning, is optional risk reduction. |
| At least one AWS service powering the agent environment ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | **Amazon Bedrock** generates derived memories, embeddings, and pivot options. Deploy the web app/backend on AWS as well. | **On track.** Identify Bedrock and hosting/runtime service in the submission and README. |
| Functional, reliably runnable project matching video/description ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Mobile-first web app with authenticated accounts, quick dump, pivot selection, feedback, history controls, and safety interruption. | **Implemented; deploy/verify.** Provide a deployed URL, test account or clear sign-up instructions, and deterministic demo seed path. |
| New project created in the submission period; disclose pre-existing work; authorized third-party use ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Use standard frameworks/AI assistants only as permitted; disclose any code predating June 30, 2026 and third-party model/SDK use. | **Open compliance check.** Confirm repository history and add an attribution/disclosure section. |
| Public open-source repo with visible license, source, dependencies, example configuration, and run instructions ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Public repository with README, `.env.example` without secrets, setup/migration instructions, seed/demo data, and MIT license. | **Implemented; verify repository visibility.** |
| Functional demo URL, text description, and public <3-minute YouTube/Vimeo video showing product **and CockroachDB memory at work** ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Demo: first overwhelmed check-in → selected pivot/outcome → differently phrased later check-in retrieves the earlier helpful pattern → “Why this?” and delete/forget control. | **Critical.** Do not spend the video on generic UI; show the retrieved memory influencing the later pivot. |
| Free testing access through judging period ([rules §4](https://cockroachdb-ai.devpost.com/rules)) | Public demo with safe test credentials or sign-up instructions; no payment gate. | **Unbuilt / verify.** Ensure services and sample account remain available through judging. |

## Judging fit and gaps

The five criteria are equally weighted: Agentic Memory Design, Technological Implementation, Real-World Impact, Product Readiness, and Creativity & Originality ([rules §6](https://cockroachdb-ai.devpost.com/rules)).

| Criterion | Why Unstuck fits | What raises the score |
| --- | --- | --- |
| Agentic Memory Design | Memory is operational: past context and outcomes affect the next pivot, rather than only being a chat log. | Persist raw entry separately from a user-editable derived memory; vector-search only within the authenticated user; visibly show retrieved memories and outcome learning. |
| Technological Implementation | CockroachDB vector indexing is directly part of the runtime decision; Managed MCP is used for real staging work. | README with schema/index/query explanation, MCP workflow evidence, parameterized tenant-scoped queries, and failure handling. Do not claim the customer-facing agent directly has broad MCP/database access. |
| Real-World Impact | Voluntary support for early-career knowledge workers facing task paralysis; task decomposition remains one pivot type within a broader self-regulation tool. | Keep non-clinical positioning, user agency, opt-out/forget/delete controls, and an immediate-danger interruption. |
| Product Readiness | The planned boundaries address sensitive data: authenticated ownership, backend-only database/model credentials, consent, no passive integrations, and safety routing. | Add audit/error logs, rate limits, input validation, encryption/secret management, vector-search fallback, model/database failure states, and a privacy/deletion explanation. |
| Creativity & Originality | The novel element is a user-governed, longitudinal “memory-to-pivot” learning loop—not a generic mood tracker or chatbot. | Phrase and demonstrate the product as: memory → bounded proposal → user choice → outcome → better future retrieval. |

## Evidence checklist for README and video

1. State the agent loop and the exact CockroachDB record types: private entry, derived memory, embedding, selected pivot, outcome.
2. Identify **Distributed Vector Indexing** and show a user-scoped semantic retrieval query/index; show that retrieved successful outcomes change a later recommendation.
3. Identify **Managed MCP Server** and show a real staging workflow (for example: the AI development agent inspects the schema and validates the retrieval/migration). State that it is staging-only and that production private data uses constrained backend operations.
4. Identify **Amazon Bedrock** and the AWS service hosting/running the application; state each responsibility.
5. In the video, show a functioning device flow, then the memory layer at work—not only code or a diagram. Keep it below three minutes.
6. Include an architecture diagram: browser → authenticated backend → Bedrock; backend → CockroachDB; development agent → Managed MCP → staging CockroachDB.
7. Document consent, per-entry “do not save,” inspect/edit/delete/forget controls, immediate-danger interruption, and that the product is not crisis or clinical care.
8. Include deployment/run instructions, `.env.example`, migrations/seed path, test access, public OSS license, and third-party/pre-existing-work disclosures.

## Risks and decisions still required

- **AWS deployment is pinned to ECS Express Mode.** AWS stopped accepting new App Runner customers on April 30, 2026, so the project now builds a production container for ECR and deploys it through ECS Express Mode. The remaining requirement is to create the live service, configure its task/execution/infrastructure roles and Secrets Manager value, and capture the functional URL as evidence.
- **Managed MCP evidence must be substantive.** It is acceptable as the second named tool only if the README/video can truthfully show the agent using it on Unstuck's staging database for actual engineering work. Vector Indexing alone is insufficient.
- **Sensitive-data handling is central to readiness.** Do not let an unconstrained model or broad MCP credential access production personal entries. Enforce user identity in application queries and use synthetic or safely scoped staging data for MCP demonstrations.
- **Semantic retrieval needs a fallback.** If no useful memories exist—or Bedrock/vector search fails—the agent should provide a generic curated pivot, label it as not personalized, and still let the user record an outcome.
- **Eligibility and rules can change.** Entrants must be age of majority; teams may have up to five people, and excluded jurisdictions apply. Recheck the [official rules](https://cockroachdb-ai.devpost.com/rules) immediately before submitting. Current deadline: **August 18, 2026, 5:00 PM EDT**.

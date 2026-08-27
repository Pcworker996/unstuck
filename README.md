# Unstuck

Unstuck is a non-clinical, user-controlled self-regulation companion. It helps a person turn a voluntary Check-in into a small, concrete Pivot without diagnosing or offering emergency care.

## Runtime architecture

The application uses Amazon Cognito for Personal accounts, Amazon ECS Express Mode for the containerized Next.js UI and backend routes, Amazon Bedrock for Derived memory, Titan embeddings, and bounded Pivot recommendations, and CockroachDB for persistent user-governed memory. AWS credentials, CockroachDB credentials, SQL, and embeddings stay server-side.

For local setup and AWS deployment, see [the deployment guide](docs/deployment.md).

For the staging-only CockroachDB Managed MCP workflow, schema migration, and
user-scoped Semantic retrieval validation, see
[the Managed MCP staging runbook](docs/managed-mcp-staging.md).

## Architecture

```text
Browser ── Cognito ID token ──> ECS Express Mode (Next.js container)
                                  ├──> Amazon Bedrock
                                  │     ├─ Derived memory
                                  │     ├─ Titan V2 embedding
                                  │     └─ Nova Lite bounded Pivot loop
                                  └──> CockroachDB
                                        ├─ private entries and outcomes
                                        └─ owner-scoped vector retrieval

Git/Docker ──> Amazon ECR ──> ECS Express Mode on Fargate

Development agent ── Managed MCP ──> CockroachDB staging
```

The agent is one bounded Pivot guide. The backend runs deterministic safety,
identity, consent, ownership, persistence, and output validation. Bedrock may
request only `retrieve_similar_memories`; it cannot run SQL, delete memory,
choose an account, or take external actions.

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local`. For the real backend path, configure CockroachDB and AWS credentials as described in [the deployment guide](docs/deployment.md).

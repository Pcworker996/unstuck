# Managed MCP staging workflow

This runbook is the AI-assisted workflow for Unstuck's CockroachDB Cloud Managed MCP Server. It is intentionally scoped to a synthetic staging database. It is not a runtime access path for the customer-facing Pivot guide.

## Scope and safety boundary

The workflow uses CockroachDB Cloud Managed MCP for schema inspection, migration validation, and user-scoped Semantic retrieval checks against staging. It must use a dedicated staging cluster, synthetic fixtures, OAuth when available, and a cluster-scoped connection.

The customer-facing application must use a constrained backend database adapter. The browser must never receive CockroachDB credentials or MCP access. Production Private entries must not be exposed to this workflow.

The application uses Amazon Titan Text Embeddings V2 with normalized `VECTOR(1024)` values. Existing staging data created by the deterministic `VECTOR(6)` prototype must go through `0002_titan_v2_embeddings.sql` and be re-embedded before it is eligible for retrieval; never mix the two dimensions.

## Connect Codex to the staging cluster

Create or select a CockroachDB Cloud staging cluster and record its cluster ID. Use a Cluster Operator or Cluster Admin role, then connect the Cloud MCP server with OAuth. The official connection endpoint is `https://cockroachlabs.cloud/mcp`.

From the Codex CLI, add the server:

```sh
codex mcp add cockroachdb-cloud --url https://cockroachlabs.cloud/mcp
```

In `~/.codex/config.toml`, scope the connection to the staging cluster:

```toml
[mcp_servers.cockroachdb-cloud]
url = "https://cockroachlabs.cloud/mcp"
http_headers = { "mcp-cluster-id" = "<STAGING_CLUSTER_ID>" }
```

Authenticate the connection:

```sh
codex mcp login cockroachdb-cloud
```

Never commit the cluster ID, API key, OAuth token, or a connection file containing credentials to this repository. OAuth is preferred to a long-lived service-account key. If an API key is required for automation, give it staging-only permissions and store it in the local secret manager.

## Workflow

### 1. Inspect before writing

Ask the connected AI coding agent:

> Using CockroachDB Managed MCP on the Unstuck staging cluster, list the tables in the application database, inspect the schemas for `personal_accounts`, `check_ins`, `private_entries`, `derived_memories`, and `pivot_outcomes`, and show the current indexes on `derived_memories`. Do not write anything.

The expected schema is defined by [`db/migrations/0001_unstuck_memory.sql`](../db/migrations/0001_unstuck_memory.sql) followed by [`db/migrations/0002_titan_v2_embeddings.sql`](../db/migrations/0002_titan_v2_embeddings.sql). Record the MCP result in the staging evidence log before applying a migration.

Before creating the vector index, inspect `feature.vector_index.enabled`. If the
staging cluster has it disabled, have the cluster operator enable it through the
approved staging procedure. If the table already contains rows, follow the
cluster's safe vector-index backfill procedure before creating the index.

### 2. Review and validate the migration

Have the agent compare the live schema with the migration file and report a plan before making changes:

> Compare the Unstuck staging schema with `db/migrations/0001_unstuck_memory.sql`. Identify missing or divergent tables, constraints, account ownership indexes, and the account-prefixed vector index. Show the proposed DDL and wait for approval before writing.

Apply both reviewed migrations through the approved staging migration path. Run `npm run db:reembed` when rows predate the Titan migration, then use Managed MCP to inspect the resulting table schemas and `SHOW INDEXES FROM derived_memories`. The migration is successful only when the ownership constraints, populated `VECTOR(1024)` values, and cosine-enabled `derived_memories_account_embedding_idx` are present.

### 3. Load synthetic fixtures

Use [`db/validation/managed-mcp-fixtures.sql`](../db/validation/managed-mcp-fixtures.sql) only on staging. The fixture contains two synthetic Personal accounts, one helpful memory, one unhelpful outcome, one forgotten memory, and one same-content memory owned by another account. Remove all `mcp-fixture-*` rows after validation.

If the Managed MCP client does not support executing a multi-statement file, ask it to insert the fixture rows from the file in dependency order and confirm the inserted row counts after each table.

### 4. Validate Semantic retrieval and ownership

Run the statements in [`db/validation/managed-mcp-retrieval.sql`](../db/validation/managed-mcp-retrieval.sql) through Managed MCP's query/explain operations. Retain the returned rows and plan as evidence.

The expected result is:

- The owner retrieves the helpful owner memory.
- The skipped outcome is excluded.
- The forgotten owner memory is excluded.
- The identical memory owned by the other account is excluded.
- `EXPLAIN` shows the account-prefixed vector access path or otherwise confirms the account predicate is applied before the nearest-neighbor result is returned.

The runtime backend must preserve this query shape: bind the authenticated `account_id`, filter `forgotten_at IS NULL`, filter to helpful outcomes, and order by vector distance. The Pivot guide must consume only the returned owner-scoped rows.

The schema permits the Pivot guide to create the Derived memory context and embedding before a recommendation exists, then fill `selected_pivot_kind`, `selected_pivot_title`, and `outcome_kind` after the person chooses a Pivot and records its Pivot outcome. Retrieval must continue to require a helpful non-null outcome.

### 5. Clean up and record evidence

Run [`db/validation/managed-mcp-cleanup.sql`](../db/validation/managed-mcp-cleanup.sql) through Managed MCP, then verify that all `mcp-fixture-*` rows are gone. Record:

```md
## Managed MCP staging validation — YYYY-MM-DD

- Cluster: <redacted staging cluster ID>
- Migration: 0001_unstuck_memory.sql + 0002_titan_v2_embeddings.sql
- Schema inspection: pass/fail
- Migration/index validation: pass/fail
- Owner-scoped retrieval: pass/fail
- Forgotten-memory exclusion: pass/fail
- Cross-account exclusion: pass/fail
- Synthetic fixture cleanup: pass/fail
- MCP evidence or query-plan capture: <path/link>
```

## References

- [CockroachDB Cloud Managed MCP Server](https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-the-cockroachdb-cloud-mcp-server)
- [CockroachDB `VECTOR` type and distance operators](https://www.cockroachlabs.com/docs/stable/vector)
- [CockroachDB vector indexes and opclasses](https://www.cockroachlabs.com/docs/stable/vector-indexes)
- [`0001_unstuck_memory.sql`](../db/migrations/0001_unstuck_memory.sql)
- [`managed-mcp-fixtures.sql`](../db/validation/managed-mcp-fixtures.sql)
- [`managed-mcp-retrieval.sql`](../db/validation/managed-mcp-retrieval.sql)
- [`managed-mcp-cleanup.sql`](../db/validation/managed-mcp-cleanup.sql)

This repository does not claim that the live staging proof has run. Completing the evidence block requires an authenticated Managed MCP connection and a real staging cluster; no cluster identifier or credential is committed here.

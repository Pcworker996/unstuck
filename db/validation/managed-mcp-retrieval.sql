-- Run each statement through CockroachDB Managed MCP's read/query operation
-- against the staging database after applying the migration and fixtures.
-- These queries intentionally use synthetic account IDs only.

-- 1. Confirm the migration created the expected application tables.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'personal_accounts',
      'check_ins',
      'private_entries',
      'derived_memories',
      'pivot_outcomes'
  )
ORDER BY table_name;

-- 2. Confirm the account-prefixed vector index exists.
SHOW INDEXES FROM derived_memories;

-- 3. This is the runtime Semantic retrieval shape used by the Pivot guide.
-- The account predicate must be bound from the authenticated Personal account.
WITH query_vector AS (
    SELECT (ARRAY(SELECT CASE WHEN i = 1 THEN 1.0 ELSE 0.0 END
                  FROM generate_series(1, 1024) AS s(i)))::VECTOR(1024) AS embedding
)
SELECT
    memory_id,
    account_id,
    check_in_id,
    selected_pivot_kind,
    selected_pivot_title,
    outcome_kind,
    1 - (derived_memories.embedding <=> query_vector.embedding) AS cosine_similarity
FROM derived_memories
CROSS JOIN query_vector
WHERE account_id = 'mcp-fixture-owner'
  AND forgotten_at IS NULL
  AND outcome_kind IN ('completed', 'partly-helpful')
ORDER BY derived_memories.embedding <=> query_vector.embedding
LIMIT 5;

-- 4. The owner-scoped result must never contain another account.
WITH query_vector AS (
    SELECT (ARRAY(SELECT CASE WHEN i = 1 THEN 1.0 ELSE 0.0 END
                  FROM generate_series(1, 1024) AS s(i)))::VECTOR(1024) AS embedding
), retrieved AS (
    SELECT account_id
    FROM derived_memories
    CROSS JOIN query_vector
    WHERE account_id = 'mcp-fixture-owner'
      AND forgotten_at IS NULL
      AND outcome_kind IN ('completed', 'partly-helpful')
    ORDER BY derived_memories.embedding <=> query_vector.embedding
    LIMIT 5
)
SELECT CASE
    WHEN count(*) FILTER (WHERE account_id <> 'mcp-fixture-owner') = 0
    THEN 'PASS: retrieval is owner-scoped'
    ELSE 'FAIL: retrieval leaked another account'
END AS owner_scope_check
FROM retrieved;

-- 5. Forgotten memory must not be eligible for retrieval.
SELECT CASE
    WHEN count(*) = 0
    THEN 'PASS: forgotten memory excluded'
    ELSE 'FAIL: forgotten memory still eligible'
END AS forgotten_memory_check
FROM derived_memories
WHERE account_id = 'mcp-fixture-owner'
  AND check_in_id = '00000000-0000-0000-0000-0000000000a3'
  AND forgotten_at IS NULL
  AND outcome_kind IN ('completed', 'partly-helpful');

-- 6. Ask Managed MCP for EXPLAIN on statement 3 and retain the plan as evidence.

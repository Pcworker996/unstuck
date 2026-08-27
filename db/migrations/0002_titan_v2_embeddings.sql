-- Replace the deterministic VECTOR(6) representation from migration 0001.
-- CockroachDB cannot alter an indexed vector column in place safely, and old
-- vectors must never be mixed with Titan vectors. This migration preserves the
-- private entry and Derived context while replacing only the incompatible
-- embedding values. Existing rows must be re-embedded before the final index
-- is used for retrieval.

DROP INDEX IF EXISTS derived_memories@derived_memories_account_embedding_idx;

ALTER TABLE derived_memories DROP COLUMN embedding;

ALTER TABLE derived_memories
    ADD COLUMN embedding VECTOR(1024);

CREATE VECTOR INDEX derived_memories_account_embedding_idx
    ON derived_memories (account_id, embedding vector_cosine_ops);

-- After the application re-embeds all existing rows, enforce the invariant:
-- ALTER TABLE derived_memories ALTER COLUMN embedding SET NOT NULL;

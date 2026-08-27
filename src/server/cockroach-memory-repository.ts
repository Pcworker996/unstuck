import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getPivotByKind, type CurrentCheckIn, type PivotKind } from "../app/pivot-protocol";
import type {
  HelpfulOutcomeKind,
  InspectableMemory,
  MemoryRepository,
  PendingCheckIn,
  StoredMemorySummary
} from "./pivot-service";

const VECTOR_DIMENSIONS = 1024;

export type CockroachPool = Pick<Pool, "connect" | "query">;

export type CockroachRepositoryConfig = {
  connectionString?: string;
  maxConnections?: number;
  pool?: CockroachPool;
};

let sharedPool: Pool | undefined;

export function createCockroachMemoryRepository(
  config: CockroachRepositoryConfig = {}
): MemoryRepository {
  const pool = config.pool ?? getSharedPool(config);

  return {
    async ensureAccount(subject) {
      await pool.query(
        `INSERT INTO personal_accounts (account_id)
         VALUES ($1)
         ON CONFLICT (account_id) DO NOTHING`,
        [subject]
      );
      return subject;
    },

    async createPendingCheckIn({ accountId, checkIn, derivedContext, embedding }) {
      assertEmbedding(embedding);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const checkInResult = await client.query<{ check_in_id: string }>(
          `INSERT INTO check_ins
             (account_id, quick_dump, emotional_state, consent_given, save_requested, pivot_started_at)
           VALUES ($1, $2, $3, true, true, now())
           RETURNING check_in_id`,
          [accountId, checkIn.quickDump, checkIn.emotionalState]
        );
        const checkInId = checkInResult.rows[0]?.check_in_id;
        if (!checkInId) {
          throw new Error("CockroachDB did not return the new Check-in ID");
        }

        await client.query(
          `INSERT INTO private_entries (account_id, check_in_id, quick_dump)
           VALUES ($1, $2, $3)`,
          [accountId, checkInId, checkIn.quickDump]
        );

        const memoryResult = await client.query<{ memory_id: string }>(
          `INSERT INTO derived_memories
             (account_id, check_in_id, derived_context, embedding)
           VALUES ($1, $2, $3, $4::VECTOR(1024))
           RETURNING memory_id`,
          [accountId, checkInId, derivedContext, vectorLiteral(embedding)]
        );
        const memoryId = memoryResult.rows[0]?.memory_id;
        if (!memoryId) {
          throw new Error("CockroachDB did not return the new memory ID");
        }

        await client.query("COMMIT");
        return { checkInId, memoryId } satisfies PendingCheckIn;
      } catch (error) {
        await rollback(client);
        throw error;
      } finally {
        client.release();
      }
    },

    async retrieveSimilarMemories({ accountId, queryEmbedding, limit, threshold }) {
      assertEmbedding(queryEmbedding);
      const result = await pool.query<{
        memory_id: string;
        derived_context: string;
        selected_pivot_kind: string;
        selected_pivot_title: string;
        outcome_kind: HelpfulOutcomeKind;
      }>(
        `SELECT memory_id, derived_context, selected_pivot_kind, selected_pivot_title, outcome_kind
         FROM derived_memories
         WHERE account_id = $1
           AND forgotten_at IS NULL
           AND embedding IS NOT NULL
           AND outcome_kind IN ('completed', 'partly-helpful')
           AND 1 - (embedding <=> $2::VECTOR(1024)) >= $4
         ORDER BY embedding <=> $2::VECTOR(1024)
         LIMIT $3`,
        [accountId, vectorLiteral(queryEmbedding), limit, threshold]
      );

      return result.rows.flatMap((row) => {
        const selectedPivotKind = getPivotByKind(row.selected_pivot_kind);
        if (!selectedPivotKind) {
          return [];
        }

        return [
          {
            id: row.memory_id,
            derivedContext: row.derived_context,
            selectedPivotKind: selectedPivotKind.kind,
            selectedPivotTitle: selectedPivotKind.title,
            outcomeKind: row.outcome_kind
          } satisfies StoredMemorySummary
        ];
      });
    },

    async recordOutcome({
      accountId,
      checkInId,
      selectedPivotKind,
      outcomeKind,
      updatedEmotionalState,
      pivotTimeSeconds
    }) {
      const selectedPivot = getPivotByKind(selectedPivotKind);
      if (!selectedPivot) {
        throw new Error("Unsupported Pivot kind");
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query<{
          selected_pivot_kind: string;
          outcome_kind: string;
          updated_emotional_state: number | string | null;
          pivot_time_seconds: number | string | null;
          derived_context: string;
        }>(
          `SELECT po.selected_pivot_kind, po.outcome_kind, po.updated_emotional_state,
                  po.pivot_time_seconds, dm.derived_context
           FROM pivot_outcomes po
           JOIN derived_memories dm
             ON dm.account_id = po.account_id AND dm.check_in_id = po.check_in_id
           WHERE po.account_id = $1 AND po.check_in_id = $2
           FOR UPDATE`,
          [accountId, checkInId]
        );

        const prior = existing.rows[0];
        if (prior) {
          const same =
            prior.selected_pivot_kind === selectedPivotKind &&
            prior.outcome_kind === outcomeKind &&
            sameOptionalNumber(prior.updated_emotional_state, updatedEmotionalState) &&
            sameOptionalNumber(prior.pivot_time_seconds, pivotTimeSeconds);
          await client.query("COMMIT");
          return same
            ? { kind: "already-saved" as const, currentDerivedContext: prior.derived_context }
            : { kind: "conflict" as const };
        }

        const memory = await client.query<{ derived_context: string }>(
          `SELECT derived_context
           FROM derived_memories
           WHERE account_id = $1 AND check_in_id = $2
           FOR UPDATE`,
          [accountId, checkInId]
        );
        const currentDerivedContext = memory.rows[0]?.derived_context;
        if (!currentDerivedContext) {
          throw new Error("Saved Check-in was not found");
        }

        await client.query(
          `INSERT INTO pivot_outcomes
             (account_id, check_in_id, selected_pivot_kind, outcome_kind,
              updated_emotional_state, pivot_time_seconds)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            accountId,
            checkInId,
            selectedPivotKind,
            outcomeKind,
            updatedEmotionalState ?? null,
            pivotTimeSeconds ?? null
          ]
        );
        await client.query(
          `UPDATE derived_memories
           SET selected_pivot_kind = $3,
               selected_pivot_title = $4,
               outcome_kind = $5,
               updated_emotional_state = $6,
               pivot_time_seconds = $7
           WHERE account_id = $1 AND check_in_id = $2`,
          [
            accountId,
            checkInId,
            selectedPivotKind,
            selectedPivot.title,
            outcomeKind,
            updatedEmotionalState ?? null,
            pivotTimeSeconds ?? null
          ]
        );
        await client.query("COMMIT");
        return { kind: "saved" as const, currentDerivedContext };
      } catch (error) {
        await rollback(client);
        throw error;
      } finally {
        client.release();
      }
    },

    async enrichDerivedMemory({ accountId, checkInId, derivedContext, embedding }) {
      assertEmbedding(embedding);
      await pool.query(
        `UPDATE derived_memories
         SET derived_context = $3,
             embedding = $4::VECTOR(1024)
         WHERE account_id = $1 AND check_in_id = $2`,
        [accountId, checkInId, derivedContext, vectorLiteral(embedding)]
      );
    },

    async listMemories(accountId) {
      const result = await pool.query<{
        memory_id: string;
        check_in_id: string;
        quick_dump: string;
        emotional_state: number;
        derived_context: string;
        selected_pivot_kind: string | null;
        selected_pivot_title: string | null;
        outcome_kind: string | null;
        forgotten_at: Date | null;
      }>(
        `SELECT dm.memory_id, dm.check_in_id, pe.quick_dump, ci.emotional_state,
                dm.derived_context, dm.selected_pivot_kind, dm.selected_pivot_title,
                dm.outcome_kind, dm.forgotten_at
         FROM derived_memories dm
         JOIN private_entries pe
           ON pe.account_id = dm.account_id AND pe.check_in_id = dm.check_in_id
         JOIN check_ins ci
           ON ci.account_id = dm.account_id AND ci.check_in_id = dm.check_in_id
         WHERE dm.account_id = $1
           AND dm.outcome_kind IS NOT NULL
         ORDER BY dm.created_at DESC`,
        [accountId]
      );

      return result.rows.map((row) => ({
        id: row.memory_id,
        checkInId: row.check_in_id,
        quickDump: row.quick_dump,
        emotionalState: Number(row.emotional_state),
        derivedContext: row.derived_context,
        selectedPivotKind: row.selected_pivot_kind
          ? (getPivotByKind(row.selected_pivot_kind)?.kind ?? null)
          : null,
        selectedPivotTitle: row.selected_pivot_kind
          ? (getPivotByKind(row.selected_pivot_kind)?.title ?? null)
          : null,
        outcomeKind: row.outcome_kind,
        forgottenAt: row.forgotten_at?.toISOString() ?? null
      } satisfies InspectableMemory));
    },

    async deleteMemory({ accountId, memoryId }) {
      const result = await pool.query(
        `DELETE FROM check_ins
         WHERE account_id = $1
           AND check_in_id = (
             SELECT check_in_id FROM derived_memories
             WHERE account_id = $1 AND memory_id = $2
           )`,
        [accountId, memoryId]
      );
      return (result.rowCount ?? 0) > 0;
    },

    async forgetMemory({ accountId, memoryId }) {
      const result = await pool.query(
        `UPDATE derived_memories
         SET forgotten_at = now()
         WHERE account_id = $1 AND memory_id = $2`,
        [accountId, memoryId]
      );
      return (result.rowCount ?? 0) > 0;
    }
  };
}

export function getSharedPool(config: CockroachRepositoryConfig = {}): Pool {
  if (sharedPool) {
    return sharedPool;
  }

  const connectionString = config.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for CockroachDB access");
  }

  sharedPool = new Pool({
    connectionString,
    max: config.maxConnections ?? 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000
  });
  return sharedPool;
}

function assertEmbedding(embedding: readonly number[]): void {
  if (
    embedding.length !== VECTOR_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Expected a normalized Titan 1024-dimensional embedding");
  }
}

function vectorLiteral(embedding: readonly number[]): string {
  return `[${embedding.map((value) => String(value)).join(",")}]`;
}

function sameOptionalNumber(
  stored: number | string | null,
  requested: number | undefined
): boolean {
  return stored === null ? requested === undefined : Number(stored) === requested;
}

async function rollback(client: Pick<PoolClient, "query">): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction error.
  }
}

import { PIVOT_LIBRARY, type PivotKind } from "../app/pivot-library";
import type { GoogleCautionarySignal, PivotOutcome } from "../app/google-pivot-protocol";

export const GOOGLE_EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const GOOGLE_EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_GOOGLE_MEMORY_THRESHOLD = 0.5;
export const MAX_GOOGLE_RETRIEVED_MEMORIES = 3;

export type GoogleMemorySummary = {
  id: string;
  protocolId: string;
  context: string;
  selectedPivotKind: PivotKind;
  selectedPivotTitle: string;
  selectedActionTitle?: string;
  outcome: PivotOutcome;
  cautionarySignals?: GoogleCautionarySignal[];
  approved: true;
};

export type GoogleInspectableMemory = GoogleMemorySummary & {
  ownerSubject: string;
  forgottenAt?: string;
  excludedAt?: string;
};

export type GuidancePreference = {
  id: string;
  text: string;
  createdAt: string;
};

export type SaveGoogleMemoryInput = {
  ownerSubject: string;
  protocolId: string;
  memoryId: string;
  context: string;
  embedding: readonly number[];
  selectedPivotKind: PivotKind;
  selectedPivotTitle: string;
  selectedActionTitle?: string;
  outcome: PivotOutcome;
  cautionarySignals?: GoogleCautionarySignal[];
  approved: true;
};

export type GoogleMemoryRepository = {
  saveDerivedMemory: (input: SaveGoogleMemoryInput) => Promise<GoogleMemorySummary>;
  retrieveSimilarMemories: (input: {
    ownerSubject: string;
    queryEmbedding: readonly number[];
    limit: number;
    threshold: number;
  }) => Promise<readonly GoogleMemorySummary[]>;
  listMemories: (ownerSubject: string) => Promise<readonly GoogleInspectableMemory[]>;
  excludeMemory: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  forgetMemory: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  deleteMemory: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  listGuidancePreferences: (ownerSubject: string) => Promise<readonly GuidancePreference[]>;
  createGuidancePreference: (input: { ownerSubject: string; text: string }) => Promise<GuidancePreference>;
  deleteGuidancePreference: (input: { ownerSubject: string; preferenceId: string }) => Promise<boolean>;
};

type StoredMemory = GoogleInspectableMemory & {
  embedding: readonly number[];
};

export function validateGoogleEmbedding(embedding: readonly number[]): number[] {
  if (embedding.length !== GOOGLE_EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected a ${GOOGLE_EMBEDDING_DIMENSIONS}-dimensional embedding.`);
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Google embedding values must be finite.");
  }
  return [...embedding];
}

export function validateDerivedMemoryContext(context: string): string {
  if (typeof context !== "string" || !context.trim() || context.length > 500) {
    throw new Error("Derived memory context is invalid.");
  }
  if (/\b(diagnos\w*|personality|motives?|trait\w*|permanent|predict\w*|crisis|suicid\w*|wellness score|hidden preference|psychological profile|medical advice)\b/i.test(context)) {
    throw new Error("Derived memory context contains disallowed content.");
  }
  return context.trim();
}

export function validateMemoryMetadata(input: Pick<SaveGoogleMemoryInput, "selectedPivotKind" | "outcome" | "cautionarySignals">): void {
  if (!PIVOT_LIBRARY.some((pivot) => pivot.kind === input.selectedPivotKind)) {
    throw new Error("Derived memory references a Pivot outside the bounded library.");
  }
  if (!["completed", "partly-helpful", "not-a-fit", "skipped"].includes(input.outcome.status)) {
    throw new Error("Derived memory has an invalid Pivot outcome.");
  }
  if (input.outcome.agencyShift !== undefined && !["more-able", "about-as-able", "less-able"].includes(input.outcome.agencyShift)) {
    throw new Error("Derived memory has an invalid Agency shift.");
  }
  if (input.cautionarySignals?.some((signal) => signal !== "blocked")) {
    throw new Error("Derived memory has an invalid cautionary signal.");
  }
}

export function validateGuidancePreferenceText(text: string): string {
  const normalized = text.trim();
  if (!normalized || normalized.length > 240) {
    throw new Error("Guidance preference must be between 1 and 240 characters.");
  }
  if (/\b(diagnos\w*|personality|motives?|trait\w*|permanent|hidden preference|psychological profile)\b/i.test(normalized)) {
    throw new Error("Guidance preferences must be explicit choices, not inferred traits.");
  }
  return normalized;
}

export function createInMemoryGoogleMemoryRepository(
  now: () => string = () => new Date().toISOString()
): GoogleMemoryRepository {
  const memories = new Map<string, StoredMemory>();
  const preferences = new Map<string, GuidancePreference>();
  let nextPreferenceId = 1;

  return {
    async saveDerivedMemory(input) {
      if (input.approved !== true) throw new Error("Only approved Derived memories may be saved.");
      validateMemoryMetadata(input);
      const memory: StoredMemory = {
        id: input.memoryId,
        protocolId: input.protocolId,
        ownerSubject: input.ownerSubject,
        context: validateDerivedMemoryContext(input.context),
        embedding: validateGoogleEmbedding(input.embedding),
        selectedPivotKind: input.selectedPivotKind,
        selectedPivotTitle: input.selectedPivotTitle,
        ...(input.selectedActionTitle ? { selectedActionTitle: input.selectedActionTitle } : {}),
        outcome: input.outcome,
        ...(input.cautionarySignals ? { cautionarySignals: [...input.cautionarySignals] } : {}),
        approved: true
      };
      memories.set(memoryKey(input.ownerSubject, input.memoryId), memory);
      return summary(memory);
    },

    async retrieveSimilarMemories({ ownerSubject, queryEmbedding, limit, threshold }) {
      const query = validateGoogleEmbedding(queryEmbedding);
      const boundedLimit = Math.min(Math.max(Math.floor(limit), 0), MAX_GOOGLE_RETRIEVED_MEMORIES);
      const boundedThreshold = Number.isFinite(threshold) ? threshold : DEFAULT_GOOGLE_MEMORY_THRESHOLD;
      return [...memories.values()]
        .filter((memory) => memory.ownerSubject === ownerSubject && !memory.forgottenAt && !memory.excludedAt && memory.approved)
        .map((memory) => ({ memory, similarity: cosineSimilarity(query, memory.embedding) }))
        .filter(({ similarity }) => similarity >= boundedThreshold)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, boundedLimit)
        .map(({ memory }) => summary(memory));
    },

    async listMemories(ownerSubject) {
      return [...memories.values()]
        .filter((memory) => memory.ownerSubject === ownerSubject)
        .map(({ embedding: _embedding, ...memory }) => memory);
    },

    async excludeMemory({ ownerSubject, memoryId }) {
      const memory = memories.get(memoryKey(ownerSubject, memoryId));
      if (!memory) return false;
      memory.excludedAt = now();
      return true;
    },

    async forgetMemory({ ownerSubject, memoryId }) {
      const memory = memories.get(memoryKey(ownerSubject, memoryId));
      if (!memory) return false;
      memory.forgottenAt = now();
      return true;
    },

    async deleteMemory({ ownerSubject, memoryId }) {
      return memories.delete(memoryKey(ownerSubject, memoryId));
    },

    async listGuidancePreferences(ownerSubject) {
      return [...preferences.values()].filter((preference) => preference.id.startsWith(`${ownerSubject}:`));
    },

    async createGuidancePreference({ ownerSubject, text }) {
      const preference = {
        id: `${ownerSubject}:preference-${nextPreferenceId++}`,
        text: validateGuidancePreferenceText(text),
        createdAt: now()
      };
      preferences.set(preference.id, preference);
      return preference;
    },

    async deleteGuidancePreference({ ownerSubject, preferenceId }) {
      if (!preferenceId.startsWith(`${ownerSubject}:`)) return false;
      return preferences.delete(preferenceId);
    }
  };
}

function summary(memory: StoredMemory): GoogleMemorySummary {
  return {
    id: memory.id,
    protocolId: memory.protocolId,
    context: memory.context,
    selectedPivotKind: memory.selectedPivotKind,
    selectedPivotTitle: memory.selectedPivotTitle,
    ...(memory.selectedActionTitle ? { selectedActionTitle: memory.selectedActionTitle } : {}),
    outcome: memory.outcome,
    ...(memory.cautionarySignals ? { cautionarySignals: [...memory.cautionarySignals] } : {}),
    approved: true
  };
}

function memoryKey(ownerSubject: string, memoryId: string): string {
  return `${ownerSubject}:${memoryId}`;
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

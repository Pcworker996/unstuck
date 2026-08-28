import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { GoogleMemoryRepository, GoogleMemorySummary, GoogleInspectableMemory, GuidancePreference, SaveGoogleMemoryInput } from "./google-memory";
import {
  DEFAULT_GOOGLE_MEMORY_THRESHOLD,
  GOOGLE_EMBEDDING_DIMENSIONS,
  MAX_GOOGLE_RETRIEVED_MEMORIES,
  validateDerivedMemoryContext,
  validateGoogleEmbedding,
  validateGuidancePreferenceText,
  validateMemoryMetadata
} from "./google-memory";

const ACCOUNTS_COLLECTION = "personalAccounts";
const MEMORIES_COLLECTION = "memories";
const PREFERENCES_COLLECTION = "guidancePreferences";

export function createFirestoreGoogleMemoryRepository(firestore: Firestore): GoogleMemoryRepository {
  return {
    async saveDerivedMemory(input) {
      const value = validatedMemoryInput(input);
      await memoryDocument(firestore, input.ownerSubject, input.memoryId).set({
        protocolId: value.protocolId,
        context: value.context,
        embedding: FieldValue.vector(value.embedding),
        selectedPivotKind: value.selectedPivotKind,
        selectedPivotTitle: value.selectedPivotTitle,
        outcome: value.outcome,
        approved: true,
        forgottenAt: null,
        excludedAt: null,
        createdAt: new Date().toISOString()
      }, { merge: true });
      return toSummary(input.memoryId, value);
    },

    async retrieveSimilarMemories({ ownerSubject, queryEmbedding, limit, threshold }) {
      const query = validateGoogleEmbedding(queryEmbedding);
      const boundedLimit = Math.min(Math.max(Math.floor(limit), 0), MAX_GOOGLE_RETRIEVED_MEMORIES);
      if (boundedLimit === 0) return [];
      const snapshot = await memoryCollection(firestore, ownerSubject)
        .where("approved", "==", true)
        .findNearest({
          vectorField: "embedding",
          queryVector: query,
          limit: boundedLimit,
          distanceMeasure: "COSINE",
          distanceResultField: "distance"
        })
        .get();
      const minimum = Number.isFinite(threshold) ? threshold : DEFAULT_GOOGLE_MEMORY_THRESHOLD;
      return snapshot.docs.flatMap((document) => {
        const value = document.data();
        if (!isStoredMemory(value) || value.forgottenAt || value.excludedAt) return [];
        const similarity = 1 - Number(value.distance ?? 1);
        return Number.isFinite(similarity) && similarity >= minimum
          ? [toSummary(document.id, value)]
          : [];
      }).slice(0, MAX_GOOGLE_RETRIEVED_MEMORIES);
    },

    async listMemories(ownerSubject) {
      const snapshot = await memoryCollection(firestore, ownerSubject).get();
      return snapshot.docs.flatMap((document) => {
        const value = document.data();
        return isStoredMemory(value) ? [toInspectableMemory(document.id, ownerSubject, value)] : [];
      });
    },

    async excludeMemory({ ownerSubject, memoryId }) {
      return updateMemoryFlag(firestore, ownerSubject, memoryId, "excludedAt");
    },

    async forgetMemory({ ownerSubject, memoryId }) {
      return updateMemoryFlag(firestore, ownerSubject, memoryId, "forgottenAt");
    },

    async deleteMemory({ ownerSubject, memoryId }) {
      const reference = memoryDocument(firestore, ownerSubject, memoryId);
      const snapshot = await reference.get();
      if (!snapshot.exists) return false;
      await reference.delete();
      return true;
    },

    async listGuidancePreferences(ownerSubject) {
      const snapshot = await preferenceCollection(firestore, ownerSubject).get();
      return snapshot.docs.flatMap((document) => {
        const value = document.data();
        return isGuidancePreference(value) ? [value] : [];
      });
    },

    async createGuidancePreference({ ownerSubject, text }) {
      const reference = preferenceCollection(firestore, ownerSubject).doc();
      const preference = { id: reference.id, text: validateGuidancePreferenceText(text), createdAt: new Date().toISOString() };
      await reference.set(preference);
      return preference;
    },

    async deleteGuidancePreference({ ownerSubject, preferenceId }) {
      const reference = preferenceCollection(firestore, ownerSubject).doc(preferenceId);
      const snapshot = await reference.get();
      if (!snapshot.exists) return false;
      await reference.delete();
      return true;
    }
  };
}

function validatedMemoryInput(input: SaveGoogleMemoryInput): Omit<SaveGoogleMemoryInput, "embedding"> & { embedding: number[] } {
  validateMemoryMetadata(input);
  return {
    ...input,
    context: validateDerivedMemoryContext(input.context),
    embedding: validateGoogleEmbedding(input.embedding)
  };
}

function toSummary(id: string, value: StoredMemory): GoogleMemorySummary {
  return {
    id,
    protocolId: value.protocolId,
    context: value.context,
    selectedPivotKind: value.selectedPivotKind,
    selectedPivotTitle: value.selectedPivotTitle,
    outcome: value.outcome,
    approved: true
  };
}

function toInspectableMemory(id: string, ownerSubject: string, value: StoredMemory): GoogleInspectableMemory {
  return {
    ...toSummary(id, value),
    ownerSubject,
    ...(typeof value.forgottenAt === "string" ? { forgottenAt: value.forgottenAt } : {}),
    ...(typeof value.excludedAt === "string" ? { excludedAt: value.excludedAt } : {})
  };
}

async function updateMemoryFlag(firestore: Firestore, ownerSubject: string, memoryId: string, field: "forgottenAt" | "excludedAt"): Promise<boolean> {
  const reference = memoryDocument(firestore, ownerSubject, memoryId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return false;
  await reference.update({ [field]: new Date().toISOString() });
  return true;
}

function memoryCollection(firestore: Firestore, ownerSubject: string) {
  return firestore.collection(ACCOUNTS_COLLECTION).doc(ownerSubject).collection(MEMORIES_COLLECTION);
}

function memoryDocument(firestore: Firestore, ownerSubject: string, memoryId: string) {
  return memoryCollection(firestore, ownerSubject).doc(memoryId);
}

function preferenceCollection(firestore: Firestore, ownerSubject: string) {
  return firestore.collection(ACCOUNTS_COLLECTION).doc(ownerSubject).collection(PREFERENCES_COLLECTION);
}

type StoredMemory = {
  protocolId: string;
  context: string;
  selectedPivotKind: SaveGoogleMemoryInput["selectedPivotKind"];
  selectedPivotTitle: string;
  outcome: SaveGoogleMemoryInput["outcome"];
  approved: true;
  distance?: number;
  forgottenAt?: string | null;
  excludedAt?: string | null;
};

function isStoredMemory(value: unknown): value is StoredMemory {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.protocolId === "string" &&
    typeof candidate.context === "string" &&
    typeof candidate.selectedPivotKind === "string" &&
    typeof candidate.selectedPivotTitle === "string" &&
    typeof candidate.outcome === "object" && candidate.outcome !== null &&
    candidate.approved === true;
}

function isGuidancePreference(value: unknown): value is GuidancePreference {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.text === "string" && typeof candidate.createdAt === "string";
}

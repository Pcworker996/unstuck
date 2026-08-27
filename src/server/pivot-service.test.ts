import { describe, expect, it } from "vitest";

import {
  recordPivotOutcome,
  runPivotProtocolService,
  type MemoryRepository,
  type PivotModel,
  type StoredMemorySummary
} from "./pivot-service";

const checkIn = {
  quickDump: "I keep avoiding the first step of a high-stakes project.",
  emotionalState: 4 as const
};

const memory: StoredMemorySummary = {
  id: "memory-1",
  derivedContext: "A difficult project felt easier after making the next step visible.",
  selectedPivotKind: "task-first-step",
  selectedPivotTitle: "Make the next step visible",
  outcomeKind: "completed"
};

describe("runPivotProtocolService", () => {
  it("runs one owner-scoped retrieval and returns a validated personalized Pivot", async () => {
    const calls: string[] = [];
    const repository = createRepository(calls);
    const model = createModel(calls);

    const result = await runPivotProtocolService(
      {
        subject: "cognito-subject-1",
        checkIn,
        consentGiven: true,
        saveRequested: true
      },
      {
        repository,
        model,
        embed: async () => {
          calls.push("embed");
          return [1, 0, 0];
        },
        embeddingDimensions: 3
      }
    );

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected a Pivot protocol.");
    }

    expect(result.recommendation.primary.kind).toBe("task-first-step");
    expect(result.recommendation.source).toBe("personalized-memory");
    expect(result.pendingCheckInId).toBe("check-in-1");
    expect(result.persistence).toBe("saved");
    expect(result.memoryStatus).toBe("influenced");
    expect(calls).toEqual([
      "derive-memory",
      "embed",
      "ensure-account",
      "create-pending",
      "retrieve",
      "recommend"
    ]);
  });

  it("checks safety before consent, model calls, account writes, or retrieval", async () => {
    const calls: string[] = [];

    const result = await runPivotProtocolService(
      {
        subject: "cognito-subject-1",
        checkIn: {
          quickDump: "I might hurt myself right now and I am unsafe.",
          emotionalState: 5
        },
        consentGiven: false,
        saveRequested: true
      },
      {
        repository: createRepository(calls),
        model: createModel(calls),
        embed: async () => {
          calls.push("embed");
          return [1, 0, 0];
        }
      }
    );

    expect(result.kind).toBe("safety-interruption");
    expect(calls).toEqual([]);
  });

  it("returns an explicit non-persistent fallback when memory preparation fails", async () => {
    const calls: string[] = [];
    const model = createModel(calls);
    model.deriveMemory = async () => {
      calls.push("derive-memory");
      throw new Error("Bedrock unavailable");
    };

    const result = await runPivotProtocolService(
      {
        subject: "cognito-subject-1",
        checkIn,
        consentGiven: true,
        saveRequested: true
      },
      {
        repository: createRepository(calls),
        model,
        embed: async () => [1, 0, 0]
      }
    );

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected a fallback Pivot protocol.");
    }

    expect(result.recommendation.source).toBe("curated-fallback");
    expect(result.persistence).toBe("not-saved");
    expect(result.memoryStatus).toBe("unavailable");
    expect(calls).toEqual(["derive-memory"]);
  });

  it("saves an outcome and synchronously refreshes its Derived memory", async () => {
    const calls: string[] = [];
    const repository = createRepository(calls);
    const model = createModel(calls);

    const result = await recordPivotOutcome(
      {
        subject: "cognito-subject-1",
        checkInId: "check-in-1",
        selectedPivotKind: "task-first-step",
        outcomeKind: "completed",
        updatedEmotionalState: 3,
        pivotTimeSeconds: 42
      },
      {
        repository,
        model,
        embed: async () => {
          calls.push("embed-outcome");
          return [1, 0, 0];
        },
        embeddingDimensions: 3
      }
    );

    expect(result).toEqual({
      kind: "saved",
      idempotent: false,
      enrichment: "saved"
    });
    expect(calls).toEqual([
      "ensure-account",
      "record-outcome",
      "update-derived-memory",
      "embed-outcome",
      "enrich-memory"
    ]);
  });
});

function createRepository(calls: string[]): MemoryRepository {
  return {
    async ensureAccount() {
      calls.push("ensure-account");
      return "account-1";
    },
    async createPendingCheckIn() {
      calls.push("create-pending");
      return { checkInId: "check-in-1", memoryId: "memory-1" };
    },
    async retrieveSimilarMemories() {
      calls.push("retrieve");
      return [memory];
    },
    async recordOutcome() {
      calls.push("record-outcome");
      return { kind: "saved", currentDerivedContext: "Current saved context" };
    },
    async enrichDerivedMemory() {
      calls.push("enrich-memory");
      return;
    },
    async listMemories() {
      return [];
    },
    async deleteMemory() {
      return true;
    },
    async forgetMemory() {
      return true;
    }
  };
}

function createModel(calls: string[]): PivotModel {
  return {
    async deriveMemory() {
      calls.push("derive-memory");
      return {
        derivedContext: "The person feels blocked by a high-stakes project and needs a visible first step."
      };
    },
    async recommend() {
      calls.push("recommend");
      return {
        primaryPivotKind: "task-first-step",
        alternativePivotKinds: ["grounding", "reaching-out"],
        whyThisPivot: "A prior small first step helped with a similar project moment.",
        memoryId: "memory-1"
      };
    },
    async updateDerivedMemory() {
      calls.push("update-derived-memory");
      return {
        derivedContext: "The person completed a visible first step and found it helpful."
      };
    }
  };
}

import { describe, expect, it } from "vitest";

import { completeCheckIn } from "./check-in-memory";
import {
  runPersonalizedPivotProtocol,
  retrieveSimilarMemory,
  type EmbeddingProvider
} from "./semantic-retrieval";
import { runPivotProtocol } from "./pivot-protocol";

const pivot = {
  id: "task-first-visible-step",
  kind: "task-first-step" as const,
  title: "Make the next step visible",
  instruction: "Write the smallest action that takes less than ten minutes."
};

const savedCheckIn = completeCheckIn({
  accountId: "person-123",
  checkInId: "check-in-1",
  checkIn: {
    quickDump: "I keep avoiding the first step of the project.",
    emotionalState: 4
  },
  selectedPivot: pivot,
  outcome: { kind: "completed", updatedEmotionalState: 3 },
  saveCheckIn: true
}).savedCheckIn;

describe("retrieveSimilarMemory", () => {
  it("retrieves a differently worded prior moment only from the current Personal account", () => {
    expect(savedCheckIn).toBeDefined();
    if (!savedCheckIn) {
      throw new Error("Expected a saved Check-in.");
    }

    const result = retrieveSimilarMemory({
      accountId: "person-123",
      checkIn: {
        quickDump: "I cannot get going on this work assignment.",
        emotionalState: 4
      },
      memories: [
        savedCheckIn,
        { ...savedCheckIn, id: "other-person-memory", accountId: "person-999" }
      ]
    });

    expect(result.kind).toBe("match");
    if (result.kind !== "match") {
      throw new Error("Expected a similar memory.");
    }

    expect(result.memory.id).toBe("check-in-1");
    expect(result.memory.accountId).toBe("person-123");
    expect(result.memory.similarity).toBeGreaterThan(0.3);
  });

  it("returns no match for unrelated history", () => {
    expect(
      retrieveSimilarMemory({
        accountId: "person-123",
        checkIn: {
          quickDump: "I am hungry and need a glass of water.",
          emotionalState: 3
        },
        memories: savedCheckIn ? [savedCheckIn] : []
      })
    ).toEqual({ kind: "no-match" });
  });

  it("converts embedding failures into a safe retrieval fallback", () => {
    const unavailableEmbeddingProvider: EmbeddingProvider = {
      embed() {
        throw new Error("temporary model outage");
      }
    };

    expect(
      retrieveSimilarMemory({
        accountId: "person-123",
        checkIn: {
          quickDump: "I cannot get going on this work assignment.",
          emotionalState: 4
        },
        memories: savedCheckIn ? [savedCheckIn] : [],
        embeddingProvider: unavailableEmbeddingProvider
      })
    ).toEqual({ kind: "unavailable" });
  });
});

describe("runPivotProtocol with retrieved memory", () => {
  it("does not retrieve before consent and preserves the Safety interruption priority", () => {
    const unavailableEmbeddingProvider: EmbeddingProvider = {
      embed() {
        throw new Error("temporary model outage");
      }
    };

    expect(
      runPersonalizedPivotProtocol({
        accountId: "person-123",
        checkIn: {
          quickDump: "I cannot get going on this work assignment.",
          emotionalState: 4
        },
        consentGiven: false,
        memories: savedCheckIn ? [savedCheckIn] : [],
        embeddingProvider: unavailableEmbeddingProvider
      })
    ).toEqual({ kind: "consent-required" });

    expect(
      runPersonalizedPivotProtocol({
        accountId: "person-123",
        checkIn: {
          quickDump: "I am unsafe right now and might hurt myself.",
          emotionalState: 5
        },
        consentGiven: false,
        memories: [],
        embeddingProvider: unavailableEmbeddingProvider
      }).kind
    ).toBe("safety-interruption");
  });

  it("uses a helpful similar memory to visibly personalize the recommendation", () => {
    expect(savedCheckIn).toBeDefined();
    if (!savedCheckIn) {
      throw new Error("Expected a saved Check-in.");
    }

    const retrieval = retrieveSimilarMemory({
      accountId: "person-123",
      checkIn: {
        quickDump: "I cannot get going on this work assignment.",
        emotionalState: 4
      },
      memories: [savedCheckIn]
    });

    if (retrieval.kind !== "match") {
      throw new Error("Expected a similar memory.");
    }

    const result = runPivotProtocol(retrieval.checkIn, 0, retrieval.memory);

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected an ordinary Pivot protocol.");
    }

    expect(result.recommendation.primary.id).toBe("task-first-visible-step");
    expect(result.recommendation.source).toBe("personalized-memory");
    expect(result.recommendation.memoryExplanation).toEqual({
      memoryId: "check-in-1",
      pivotTitle: "Make the next step visible",
      outcome: "completed"
    });
  });

  it("keeps a curated recommendation when retrieval is unavailable", () => {
    const result = runPivotProtocol({
      quickDump: "I cannot get going on this work assignment.",
      emotionalState: 4
    });

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected an ordinary Pivot protocol.");
    }

    expect(result.recommendation.source).toBe("curated-fallback");
    expect(result.recommendation.memoryExplanation).toBeUndefined();
  });
});

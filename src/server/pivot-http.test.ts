import { describe, expect, it } from "vitest";

import { handlePivotPost } from "./pivot-http";
import type { MemoryRepository, PivotModel } from "./pivot-service";

describe("Pivot HTTP interface", () => {
  it("returns a typed safety interruption without requiring consent", async () => {
    const response = await handlePivotPost(
      new Request("http://localhost/api/pivot", {
        method: "POST",
        body: JSON.stringify({
          checkIn: { quickDump: "I might hurt myself right now.", emotionalState: 5 },
          consentGiven: false,
          saveRequested: false
        })
      }),
      dependencies(),
      async () => ({ subject: "subject-1" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "safety-interruption"
    });
  });

  it("rejects malformed input at the HTTP seam", async () => {
    const response = await handlePivotPost(
      new Request("http://localhost/api/pivot", {
        method: "POST",
        body: JSON.stringify({ checkIn: { quickDump: "" } })
      }),
      dependencies(),
      async () => ({ subject: "subject-1" })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ kind: "invalid-request" });
  });
});

function dependencies() {
  const repository: MemoryRepository = {
    ensureAccount: async () => "account-1",
    createPendingCheckIn: async () => ({ checkInId: "check-in-1", memoryId: "memory-1" }),
    retrieveSimilarMemories: async () => [],
    recordOutcome: async () => ({ kind: "saved", currentDerivedContext: "context" }),
    enrichDerivedMemory: async () => undefined,
    listMemories: async () => [],
    deleteMemory: async () => true,
    forgetMemory: async () => true
  };
  const model: PivotModel = {
    deriveMemory: async () => ({ derivedContext: "A short factual context." }),
    recommend: async () => ({
      primaryPivotKind: "grounding",
      alternativePivotKinds: ["reaching-out"],
      whyThisPivot: "A small present-moment action can help.",
    }),
    updateDerivedMemory: async () => ({ derivedContext: "Updated context." })
  };

  return {
    repository,
    model,
    embed: async () => Array.from({ length: 1024 }, () => 0),
    embeddingDimensions: 1024
  };
}

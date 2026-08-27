import { describe, expect, it } from "vitest";

import {
  createBedrockAdapters,
  NOVA_LITE_MODEL_ID,
  TITAN_EMBEDDING_MODEL_ID
} from "./bedrock-adapter";

describe("Bedrock adapters", () => {
  it("performs Derived-memory generation, Titan embedding, one retrieval tool turn, and final recommendation", async () => {
    const calls: string[] = [];
    const adapters = createBedrockAdapters(
      {},
      async (command) => {
        const input = command.input as {
          modelId?: string;
          toolConfig?: unknown;
        };

        if (input.modelId === TITAN_EMBEDDING_MODEL_ID) {
          calls.push("titan");
          return {
            body: new TextEncoder().encode(
              JSON.stringify({ embedding: Array.from({ length: 1024 }, () => 0) })
            )
          };
        }

        if (input.toolConfig) {
          calls.push("tool-request");
          return {
            output: {
              message: {
                content: [
                  {
                    toolUse: {
                      toolUseId: "tool-1",
                      name: "retrieve_similar_memories",
                      input: {}
                    }
                  }
                ]
              }
            }
          };
        }

        if (calls.includes("tool-request")) {
          calls.push("recommendation");
          return {
            output: {
              message: {
                content: [
                  {
                    text: JSON.stringify({
                      primaryPivotKind: "task-first-step",
                      alternativePivotKinds: ["grounding"],
                      whyThisPivot: "A small first step is possible now.",
                      memoryId: "memory-1"
                    })
                  }
                ]
              }
            }
          };
        }

        calls.push("derive");
        return {
          output: {
            message: {
              content: [
                {
                  text: JSON.stringify({
                    derivedContext: "The person feels blocked by a project and wants a first step."
                  })
                }
              ]
            }
          }
        };
      }
    );

    const derived = await adapters.model.deriveMemory({
      checkIn: { quickDump: "I cannot start this project.", emotionalState: 4 }
    });
    await adapters.embed(derived.derivedContext);
    const recommendation = await adapters.model.recommend({
      checkIn: { quickDump: "I cannot start this project.", emotionalState: 4 },
      currentDerivedContext: derived.derivedContext,
      retrievedMemories: [
        {
          id: "memory-1",
          derivedContext: "A project felt easier after a first step.",
          selectedPivotKind: "task-first-step",
          selectedPivotTitle: "Make the next step visible",
          outcomeKind: "completed"
        }
      ],
      retrieveSimilarMemories: async () => []
    });

    expect(recommendation.memoryId).toBe("memory-1");
    expect(calls).toEqual(["derive", "titan", "tool-request", "recommendation"]);
    expect(NOVA_LITE_MODEL_ID).toBe("amazon.nova-lite-v1:0");
  });

  it("fails closed for an unapproved model ID", () => {
    expect(() =>
      createBedrockAdapters({ generationModelId: "unapproved-model" })
    ).toThrow("Unapproved Bedrock generation model");
  });
});

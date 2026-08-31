import { describe, expect, it } from "vitest";

import {
  GOOGLE_EMBEDDING_DIMENSIONS,
  createInMemoryGoogleMemoryRepository,
  validateGoogleEmbedding,
  type GoogleMemoryRepository
} from "./google-memory";
import { runGooglePivotCommand, runGooglePivotProtocol, type GooglePivotGenerator } from "../app/google-pivot-protocol";
import { createInMemoryGoogleProtocolRepository, runGoogleProtocolCommand, startGoogleProtocol } from "./google-protocol";

const vector = (value: number): number[] =>
  Array.from({ length: GOOGLE_EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? value : 0);

describe("Google memory boundary", () => {
  it("accepts only finite gemini-embedding-001 vectors with 768 dimensions", () => {
    expect(validateGoogleEmbedding(vector(1))).toHaveLength(768);
    expect(() => validateGoogleEmbedding([1, 0])).toThrow(/768/);
    expect(() => validateGoogleEmbedding(vector(Number.NaN))).toThrow(/finite/);
  });

  it("retrieves at most three eligible memories above the threshold for one owner", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    await saveMemories(repository);

    await expect(repository.retrieveSimilarMemories({
      ownerSubject: "person-1",
      queryEmbedding: vector(1),
      limit: 10,
      threshold: 0.5
    })).resolves.toMatchObject([
      { id: "memory-1", context: "first" },
      { id: "memory-2", context: "second" },
      { id: "memory-3", context: "third" }
    ]);
  });

  it("excludes forgotten, deleted, and other-owner memories from retrieval", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    await saveMemories(repository);
    await repository.forgetMemory({ ownerSubject: "person-1", memoryId: "memory-1" });
    await repository.deleteMemory({ ownerSubject: "person-1", memoryId: "memory-2" });

    await expect(repository.retrieveSimilarMemories({
      ownerSubject: "person-1",
      queryEmbedding: vector(1),
      limit: 3,
      threshold: 0.5
    })).resolves.toMatchObject([
      { id: "memory-3" },
      { id: "memory-4" }
    ]);
  });

  it("supports explicit Guidance preference creation and deletion", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    const preference = await repository.createGuidancePreference({
      ownerSubject: "person-1",
      text: "Prefer concrete steps under ten minutes."
    });

    await expect(repository.listGuidancePreferences("person-1")).resolves.toEqual([preference]);
    await expect(repository.deleteGuidancePreference({
      ownerSubject: "person-1",
      preferenceId: preference.id
    })).resolves.toBe(true);
    await expect(repository.listGuidancePreferences("person-1")).resolves.toEqual([]);
  });

  it("keeps adaptation at a derived-context-only generation seam and exposes explanations", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    await repository.saveDerivedMemory({
      ownerSubject: "person-1",
      protocolId: "prior-protocol",
      memoryId: "prior-memory",
      context: "A clear first step helped.",
      embedding: vector(1),
      selectedPivotKind: "task-first-step",
      selectedPivotTitle: "Make the next step visible",
      outcome: { status: "completed", agencyShift: "more-able" },
      approved: true
    });
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A bounded option."
        };
      },
      async prepareMemory() {
        return "A current derived context.";
      },
      async adapt(input) {
        expect(input).not.toHaveProperty("quickDump");
        expect(input.situationMap.shared).toEqual([]);
        expect(input.situationMap.progress).toEqual([]);
        expect(input.retrievedMemories).toHaveLength(1);
        expect(input.retrievedMemories[0]).not.toHaveProperty("similarity");
        return {
          situationMap: input.situationMap,
          primaryPivotKind: "task-first-step",
          alternativePivotKinds: ["grounding", "reaching-out"],
          whyThisPivot: "A prior clear first step helped."
        };
      }
    };

    const result = await runGooglePivotProtocol({
      quickDump: "I am stuck on a difficult task.",
      consentGiven: true
    }, generator, {
      ownerSubject: "person-1",
      embed: async () => vector(1),
      retrieveSimilarMemories: (input) => repository.retrieveSimilarMemories(input),
      listGuidancePreferences: (ownerSubject) => repository.listGuidancePreferences(ownerSubject)
    });

    expect(result).toMatchObject({
      kind: "pivot-protocol",
      adaptationStatus: "personalized",
      memoryExplanations: [{ memoryId: "prior-memory", protocolId: "prior-protocol" }],
      recommendation: { primary: { kind: "task-first-step" } }
    });
    expect(result).not.toHaveProperty("pendingDerivedContext");
  });

  it("passes owner-bound memory retrieval through the strict Genkit tool seam", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    await repository.saveDerivedMemory({
      ownerSubject: "person-1",
      protocolId: "prior-protocol",
      memoryId: "prior-memory",
      context: "A synthetic small action helped.",
      embedding: vector(1),
      selectedPivotKind: "task-first-step",
      selectedPivotTitle: "Make the next step visible",
      selectedActionTitle: "Open only the form with the nearest deadline",
      outcome: { status: "completed" },
      approved: true
    });
    let toolCalls = 0;
    const generator: GooglePivotGenerator = {
      usesMemoryTool: true,
      async generate({ situationMap }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A bounded starting point."
        };
      },
      async prepareMemory() { return "A current synthetic context."; },
      async adapt({ situationMap, memoryTool }) {
        toolCalls += 1;
        if (!memoryTool) throw new Error("The strict memory tool was not supplied.");
        const memories = await memoryTool.retrieveSimilarMemories();
        expect(memories).toHaveLength(1);
        expect(memories?.[0]).not.toHaveProperty("similarity");
        await expect(memoryTool.retrieveSimilarMemories()).rejects.toThrow(/one retrieval/i);
        return {
          situationMap,
          primaryPivotKind: "task-first-step",
          alternativePivotKinds: ["grounding", "reaching-out"],
          whyThisPivot: "The retrieved synthetic outcome supports a concrete next action."
        };
      }
    };

    const result = await runGooglePivotProtocol({
      quickDump: "I am stuck on a synthetic task.",
      consentGiven: true
    }, generator, {
      ownerSubject: "person-1",
      embed: async () => vector(1),
      retrieveSimilarMemories: (input) => repository.retrieveSimilarMemories(input),
      listGuidancePreferences: (ownerSubject) => repository.listGuidancePreferences(ownerSubject)
    });

    expect(toolCalls).toBe(1);
    expect(result).toMatchObject({
      kind: "pivot-protocol",
      retrievalAttempted: true,
      retrievedMemories: [{ id: "prior-memory", selectedActionTitle: "Open only the form with the nearest deadline" }]
    });
  });

  it("performs the required server retrieval when Gemini omits the strict tool call", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    await repository.saveDerivedMemory({
      ownerSubject: "person-1",
      protocolId: "prior-protocol",
      memoryId: "prior-memory",
      context: "A synthetic small action helped.",
      embedding: vector(1),
      selectedPivotKind: "task-first-step",
      selectedPivotTitle: "Make the next step visible",
      outcome: { status: "completed" },
      approved: true
    });
    let retrievals = 0;
    const generator: GooglePivotGenerator = {
      usesMemoryTool: true,
      async generate({ situationMap }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A bounded starting point."
        };
      },
      async prepareMemory() { return "A current synthetic context."; },
      async adapt({ situationMap }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "The model omitted the tool call."
        };
      }
    };

    const result = await runGooglePivotProtocol({
      quickDump: "I am stuck on a synthetic task.",
      consentGiven: true
    }, generator, {
      ownerSubject: "person-1",
      embed: async () => vector(1),
      retrieveSimilarMemories: async (input) => {
        retrievals += 1;
        return repository.retrieveSimilarMemories(input);
      },
      listGuidancePreferences: (ownerSubject) => repository.listGuidancePreferences(ownerSubject)
    });

    expect(retrievals).toBe(1);
    expect(result).toMatchObject({
      kind: "pivot-protocol",
      retrievalAttempted: true,
      adaptationStatus: "personalized",
      retrievedMemories: [{ id: "prior-memory" }]
    });
  });

  it("creates one approved embedded memory only after a saved outcome", async () => {
    const protocolRepository = createInMemoryGoogleProtocolRepository();
    const memoryRepository = createInMemoryGoogleMemoryRepository();
    await startGoogleProtocol(
      { subject: "person-1" },
      { repository: protocolRepository, createId: () => "protocol-1", now: () => "2026-08-28T12:00:00.000Z" }
    );
    const adaptation = {
      memoryRepository,
      embed: async () => vector(1)
    };
    const start = await runGoogleProtocolCommand({
      subject: "person-1",
      protocolId: "protocol-1",
      expectedVersion: 0,
      idempotencyKey: "start",
      command: { type: "start" as const, quickDump: "I am stuck on a task.", consentGiven: true, saveRequested: true }
    }, { repository: protocolRepository, adaptation });
    expect(start).toMatchObject({ kind: "state", state: { persistence: "pending" } });
    if (start.kind !== "state") return;
    const select = await runGoogleProtocolCommand({
      subject: "person-1", protocolId: "protocol-1", expectedVersion: 1, idempotencyKey: "select",
      command: { type: "select-pivot", pivotKind: "task-first-step" }
    }, { repository: protocolRepository, adaptation });
    expect(select.kind).toBe("state");
    const outcome = await runGoogleProtocolCommand({
      subject: "person-1", protocolId: "protocol-1", expectedVersion: 2, idempotencyKey: "outcome",
      command: { type: "record-outcome", outcome: { status: "completed", agencyShift: "more-able" } }
    }, { repository: protocolRepository, adaptation });
    expect(outcome).toMatchObject({ kind: "state", state: { persistence: "saved", enrichment: "saved", derivedMemory: { id: "protocol-1" } } });
    await expect(memoryRepository.listMemories("person-1")).resolves.toMatchObject([
      { id: "protocol-1", outcome: { status: "completed", agencyShift: "more-able" } }
    ]);
  });

  it("makes only one semantic retrieval attempt across clarification and regeneration", async () => {
    let retrievals = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap, clarificationAnswers }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A bounded option.",
          ...(clarificationAnswers?.length ? {} : { clarificationQuestion: { id: "q1", text: "What matters most?" } })
        };
      },
      async prepareMemory() { return "A current derived context."; }
    };
    const adaptation = {
      ownerSubject: "person-1",
      embed: async () => vector(1),
      retrieveSimilarMemories: async () => { retrievals += 1; return []; },
      listGuidancePreferences: async () => []
    };
    const started = await runGooglePivotProtocol({ quickDump: "A hard moment.", consentGiven: true }, generator, adaptation);
    expect(started.kind).toBe("pivot-protocol");
    if (started.kind !== "pivot-protocol") return;
    const answered = await runGooglePivotCommand(started, {
      type: "answer-clarification", questionId: "q1", answer: "A small next step."
    }, generator, adaptation);
    expect(answered.kind).toBe("ok");
    expect(retrievals).toBe(1);
  });

  it("keeps contradictory approved outcomes visible to the adaptation boundary", async () => {
    const repository = createInMemoryGoogleMemoryRepository();
    for (const [memoryId, status] of [["helped", "completed"], ["did-not-fit", "not-a-fit"]] as const) {
      await repository.saveDerivedMemory({
        ownerSubject: "person-1", protocolId: memoryId, memoryId, context: memoryId,
        embedding: vector(1), selectedPivotKind: "task-first-step", selectedPivotTitle: "Make the next step visible",
        outcome: { status }, approved: true
      });
    }
    let seenStatuses: string[] = [];
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) { return { situationMap, primaryPivotKind: "grounding", alternativePivotKinds: ["breathing-focus", "reaching-out"], whyThisPivot: "A bounded option." }; },
      async prepareMemory() { return "A current derived context."; },
      async adapt({ retrievedMemories, situationMap }) {
        seenStatuses = retrievedMemories.map((memory) => memory.outcome.status);
        return { situationMap, primaryPivotKind: "task-first-step", alternativePivotKinds: ["grounding", "reaching-out"], whyThisPivot: "The outcomes remain visible." };
      }
    };
    const result = await runGooglePivotProtocol({ quickDump: "A hard task.", consentGiven: true }, generator, {
      ownerSubject: "person-1", embed: async () => vector(1),
      retrieveSimilarMemories: (input) => repository.retrieveSimilarMemories(input),
      listGuidancePreferences: async () => []
    });
    expect(seenStatuses).toEqual(["completed", "not-a-fit"]);
    expect(result).toMatchObject({ adaptationStatus: "personalized" });
  });

  it("preserves the current map and discloses retrieval degradation", async () => {
    const result = await runGooglePivotProtocol({ quickDump: "A private hard moment.", consentGiven: true }, {
      async generate({ situationMap }) { return { situationMap, primaryPivotKind: "grounding", alternativePivotKinds: ["breathing-focus", "reaching-out"], whyThisPivot: "A bounded option." }; },
      async prepareMemory() { return "A current derived context."; }
    }, {
      ownerSubject: "person-1", embed: async () => vector(1),
      retrieveSimilarMemories: async () => { throw new Error("temporary retrieval outage"); },
      listGuidancePreferences: async () => []
    });
    expect(result).toMatchObject({ kind: "pivot-protocol", adaptationStatus: "unavailable", fallback: true, situationMap: { shared: [{ text: "A private hard moment." }] } });
  });
});

async function saveMemories(repository: GoogleMemoryRepository): Promise<void> {
  for (const [id, context] of [["memory-1", "first"], ["memory-2", "second"], ["memory-3", "third"], ["memory-4", "fourth"], ["memory-5", "below threshold"]] as const) {
    await repository.saveDerivedMemory({
      ownerSubject: "person-1",
      protocolId: id,
      memoryId: id,
      context,
      embedding: id === "memory-5" ? vector(0) : vector(1),
      selectedPivotKind: "task-first-step",
      selectedPivotTitle: "Make the next step visible",
      outcome: { status: "completed" },
      approved: true
    });
  }
  await repository.saveDerivedMemory({
    ownerSubject: "person-2",
    protocolId: "other-memory",
    memoryId: "other-memory",
    context: "other owner",
    embedding: vector(1),
    selectedPivotKind: "task-first-step",
    selectedPivotTitle: "Make the next step visible",
    outcome: { status: "completed" },
    approved: true
  });
}

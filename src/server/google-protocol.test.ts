import { describe, expect, it } from "vitest";

import type { GooglePivotGenerator } from "../app/google-pivot-protocol";
import {
  createInMemoryGoogleProtocolRepository,
  deleteGoogleSavedProtocol,
  listGoogleSavedProtocols,
  loadGoogleProtocol,
  runGoogleProtocolCommand,
  startGoogleProtocol
} from "./google-protocol";
import { createInMemoryGoogleMemoryRepository } from "./google-memory";

describe("Google Protocol", () => {
  it("creates and reloads a minimal protocol for its authenticated owner", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const dependencies = {
      repository,
      createId: () => "protocol-1",
      now: () => "2026-08-26T12:00:00.000Z"
    };

    const created = await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
    const reloaded = await loadGoogleProtocol(
      { subject: "firebase-user-1", protocolId: "protocol-1" },
      dependencies
    );

    expect(created).toEqual({
      kind: "protocol",
      protocol: {
        id: "protocol-1",
        version: 0,
        createdAt: "2026-08-26T12:00:00.000Z"
      }
    });
    expect(reloaded).toEqual(created);
  });

  it("rejects stale mutations and replays a mutation with the same idempotency key", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );

    const first = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-1",
      fingerprint: "first-command",
      state: { value: "first" }
    });
    expect(first.kind).toBe("saved");
    expect(first.protocol.version).toBe(1);

    const stale = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-2",
      fingerprint: "stale-command",
      state: { value: "stale" }
    });
    expect(stale).toMatchObject({ kind: "conflict", protocol: { version: 1 } });

    const replay = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-1",
      fingerprint: "first-command",
      state: { value: "different-retry" }
    });
    expect(replay).toMatchObject({ kind: "idempotent", protocol: { version: 1, pivotState: { value: "first" } } });

    const conflictingRetry = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-1",
      fingerprint: "different-command",
      state: { value: "conflicting-retry" }
    });
    expect(conflictingRetry).toMatchObject({ kind: "idempotency-conflict", protocol: { version: 1 } });
  });

  it("rejects ambiguous legacy idempotency records through the application seam", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-legacy", now: () => "2026-08-26T12:00:00.000Z" }
    );
    const command = {
      subject: "firebase-user-1",
      protocolId: "protocol-legacy",
      expectedVersion: 0,
      idempotencyKey: "legacy-key",
      command: { type: "start" as const, quickDump: "I am stuck.", consentGiven: true }
    };
    const first = await runGoogleProtocolCommand(command, { repository });
    expect(first).toMatchObject({ kind: "state", state: { version: 1 } });

    const stored = await repository.findByIdForOwner({ protocolId: "protocol-legacy", ownerSubject: "firebase-user-1" });
    const record = stored?.idempotency?.["legacy-key"];
    if (!record) return;
    delete record.fingerprint;

    await expect(runGoogleProtocolCommand(command, { repository })).resolves.toMatchObject({
      kind: "idempotency-conflict",
      protocol: { version: 1 }
    });
  });

  it("replays duplicate protocol commands through the application seam", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const dependencies = {
      repository,
      createId: () => "protocol-1",
      now: () => "2026-08-26T12:00:00.000Z"
    };
    await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);

    const command = {
      subject: "firebase-user-1",
      protocolId: "protocol-1",
      expectedVersion: 0,
      idempotencyKey: "start-command",
      command: {
        type: "start" as const,
        quickDump: "I am stuck on a small task.",
        consentGiven: true
      }
    };
    const first = await runGoogleProtocolCommand(command, { repository });
    const replay = await runGoogleProtocolCommand(command, { repository });

    expect(first).toMatchObject({ kind: "state", replayed: false, state: { version: 1 } });
    expect(replay).toMatchObject({ kind: "state", replayed: true, state: { version: 1 } });
  });

  it("replays every state-changing command at the protocol seam", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    let nextId = 1;
    const dependencies = {
      repository,
      createId: () => `protocol-${nextId++}`,
      now: () => "2026-08-26T12:00:00.000Z"
    };

    async function createProtocol(protocolId: string, generator?: GooglePivotGenerator, saveRequested = false) {
      await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
      const result = await runGoogleProtocolCommand({
        subject: "firebase-user-1",
        protocolId,
        expectedVersion: 0,
        idempotencyKey: `${protocolId}-start`,
        command: { type: "start", quickDump: "I am stuck on a small task.", consentGiven: true, saveRequested }
      }, { repository }, generator);
      expect(result).toMatchObject({ kind: "state", replayed: false, state: { version: 1 } });
    }

    await createProtocol("protocol-1");
    const regenerate = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 1,
      idempotencyKey: "protocol-1-regenerate", command: { type: "regenerate-pivot" }
    }, { repository });
    expect(regenerate).toMatchObject({ kind: "state", replayed: false, state: { version: 2 } });
    const regenerateReplay = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 1,
      idempotencyKey: "protocol-1-regenerate", command: { type: "regenerate-pivot" }
    }, { repository });
    expect(regenerateReplay).toMatchObject({ kind: "state", replayed: true, state: { version: 2 } });
    const dismiss = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 2,
      idempotencyKey: "protocol-1-dismiss", command: { type: "dismiss-pivot" }
    }, { repository });
    expect(dismiss).toMatchObject({ kind: "state", replayed: false, state: { version: 3 } });
    const dismissReplay = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 2,
      idempotencyKey: "protocol-1-dismiss", command: { type: "dismiss-pivot" }
    }, { repository });
    expect(dismissReplay).toMatchObject({ kind: "state", replayed: true, state: { version: 3 } });

    await createProtocol("protocol-2", undefined, true);
    const selectInput = {
      subject: "firebase-user-1", protocolId: "protocol-2", expectedVersion: 1,
      idempotencyKey: "protocol-2-select", command: { type: "select-pivot" as const, pivotKind: "grounding" }
    };
    expect(await runGoogleProtocolCommand(selectInput, { repository })).toMatchObject({ kind: "state", state: { version: 2 } });
    expect(await runGoogleProtocolCommand(selectInput, { repository })).toMatchObject({ kind: "state", replayed: true, state: { version: 2 } });
    const outcomeInput = {
      subject: "firebase-user-1", protocolId: "protocol-2", expectedVersion: 2,
      idempotencyKey: "protocol-2-outcome", command: { type: "record-outcome" as const, outcome: { status: "completed" as const } }
    };
    expect(await runGoogleProtocolCommand(outcomeInput, { repository })).toMatchObject({ kind: "state", state: { version: 3 } });
    expect(await runGoogleProtocolCommand(outcomeInput, { repository })).toMatchObject({ kind: "state", replayed: true, state: { version: 3 } });

    const questionGenerator: GooglePivotGenerator = {
      async generate({ situationMap, clarificationAnswers }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A small next step is available.",
          ...(clarificationAnswers?.length ? {} : { clarificationQuestion: { id: "question-1", text: "What would help?" } })
        };
      }
    };
    await createProtocol("protocol-3", questionGenerator);
    const answerInput = {
      subject: "firebase-user-1", protocolId: "protocol-3", expectedVersion: 1,
      idempotencyKey: "protocol-3-answer", command: { type: "answer-clarification" as const, questionId: "question-1", answer: "A clear first step." }
    };
    expect(await runGoogleProtocolCommand(answerInput, { repository }, questionGenerator)).toMatchObject({ kind: "state", state: { version: 2 } });
    expect(await runGoogleProtocolCommand(answerInput, { repository }, questionGenerator)).toMatchObject({ kind: "state", replayed: true, state: { version: 2 } });

    await createProtocol("protocol-4", questionGenerator);
    const skipInput = {
      subject: "firebase-user-1", protocolId: "protocol-4", expectedVersion: 1,
      idempotencyKey: "protocol-4-skip", command: { type: "skip-clarification" as const, questionId: "question-1" }
    };
    expect(await runGoogleProtocolCommand(skipInput, { repository }, questionGenerator)).toMatchObject({ kind: "state", state: { version: 2 } });
    expect(await runGoogleProtocolCommand(skipInput, { repository }, questionGenerator)).toMatchObject({ kind: "state", replayed: true, state: { version: 2 } });
  });

  it("lists only completed saved Check-ins and deletes them only for their owner", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    let nextId = 1;
    const dependencies = {
      repository,
      createId: () => `protocol-${nextId++}`,
      now: () => "2026-08-26T12:00:00.000Z"
    };

    async function finishSavedProtocol(subject: string, protocolId: string) {
      await startGoogleProtocol({ subject }, dependencies);
      await runGoogleProtocolCommand({
        subject,
        protocolId,
        expectedVersion: 0,
        idempotencyKey: `${protocolId}-start`,
        command: { type: "start", quickDump: "I am stuck.", consentGiven: true, saveRequested: true }
      }, { repository });
      await runGoogleProtocolCommand({
        subject,
        protocolId,
        expectedVersion: 1,
        idempotencyKey: `${protocolId}-select`,
        command: { type: "select-pivot", pivotKind: "grounding" }
      }, { repository });
      await runGoogleProtocolCommand({
        subject,
        protocolId,
        expectedVersion: 2,
        idempotencyKey: `${protocolId}-outcome`,
        command: { type: "record-outcome", outcome: { status: "completed" } }
      }, { repository });
    }

    await finishSavedProtocol("firebase-user-1", "protocol-1");
    await finishSavedProtocol("firebase-user-2", "protocol-2");
    await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
    await runGoogleProtocolCommand({
      subject: "firebase-user-1",
      protocolId: "protocol-3",
      expectedVersion: 0,
      idempotencyKey: "protocol-3-start",
      command: { type: "start", quickDump: "Incomplete saved Check-in.", consentGiven: true, saveRequested: true }
    }, { repository });

    await expect(listGoogleSavedProtocols({ subject: "firebase-user-1" }, { repository })).resolves.toMatchObject({
      kind: "protocols",
      protocols: [{ id: "protocol-1", pivotState: { persistence: "saved", outcome: { status: "completed" } } }]
    });
    await expect(deleteGoogleSavedProtocol({ subject: "firebase-user-2", protocolId: "protocol-1" }, { repository }))
      .resolves.toEqual({ kind: "not-found" });
    await expect(deleteGoogleSavedProtocol({ subject: "firebase-user-1", protocolId: "protocol-1" }, { repository }))
      .resolves.toEqual({ kind: "deleted", protocolId: "protocol-1" });
    await expect(listGoogleSavedProtocols({ subject: "firebase-user-1" }, { repository }))
      .resolves.toEqual({ kind: "protocols", protocols: [] });
    await expect(listGoogleSavedProtocols({ subject: "firebase-user-2" }, { repository })).resolves.toMatchObject({
      protocols: [{ id: "protocol-2" }]
    });
  });

  it("deletes an unsaved Check-in after its final outcome", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const dependencies = {
      repository,
      createId: () => "protocol-unsaved",
      now: () => "2026-08-30T12:00:00.000Z"
    };
    await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);

    await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-unsaved", expectedVersion: 0, idempotencyKey: "start",
      command: { type: "start", quickDump: "This Quick dump must not become history.", consentGiven: true, saveRequested: false }
    }, { repository });
    await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-unsaved", expectedVersion: 1, idempotencyKey: "select",
      command: { type: "select-pivot", pivotKind: "grounding" }
    }, { repository });
    const outcome = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-unsaved", expectedVersion: 2, idempotencyKey: "outcome",
      command: { type: "record-outcome", outcome: { status: "completed" } }
    }, { repository });
    expect(outcome).toMatchObject({ kind: "state", replayed: false, state: { persistence: "unsaved" } });
    await expect(runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-unsaved", expectedVersion: 2, idempotencyKey: "outcome",
      command: { type: "record-outcome", outcome: { status: "completed" } }
    }, { repository })).resolves.toMatchObject({ kind: "state", replayed: true, state: { persistence: "unsaved" } });

    await expect(loadGoogleProtocol(
      { subject: "firebase-user-1", protocolId: "protocol-unsaved" },
      { repository }
    )).resolves.toEqual({ kind: "not-found" });
  });

  it("persists only the selected action and final outcome from a completed mini-plan", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const dependencies = {
      repository,
      createId: () => "protocol-saved",
      now: () => "2026-08-30T12:00:00.000Z"
    };
    await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
    const started = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-saved", expectedVersion: 0, idempotencyKey: "start",
      command: { type: "start", quickDump: "Save only the action that I selected.", consentGiven: true, saveRequested: true }
    }, { repository });
    if (started.kind !== "state") return;
    const selected = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-saved", expectedVersion: 1, idempotencyKey: "select",
      command: { type: "select-pivot", pivotKind: "grounding" }
    }, { repository });
    if (selected.kind !== "state") return;
    const outcome = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-saved", expectedVersion: 2, idempotencyKey: "outcome",
      command: { type: "record-outcome", outcome: { status: "completed" } }
    }, { repository });
    expect(outcome).toMatchObject({ kind: "state", state: { selectedAction: { kind: "grounding" }, outcome: { status: "completed" } } });

    const loaded = await loadGoogleProtocol(
      { subject: "firebase-user-1", protocolId: "protocol-saved" },
      { repository }
    );
    expect(loaded).toMatchObject({ kind: "protocol", protocol: { pivotState: { selectedAction: { kind: "grounding" }, outcome: { status: "completed" } } } });
    if (loaded.kind !== "protocol" || !loaded.protocol.pivotState || typeof loaded.protocol.pivotState !== "object") return;
    expect(loaded.protocol.pivotState).not.toHaveProperty("recommendation");
    expect(loaded.protocol.pivotState).not.toHaveProperty("miniPlan");
    expect(loaded.protocol.pivotState).toMatchObject({
      activity: expect.not.arrayContaining([
        expect.objectContaining({ kind: "step-feedback" }),
        expect.objectContaining({ message: "The next situational Pivot action was generated from the person's feedback." })
      ])
    });
  });

  it("replays a saved outcome without enriching it twice", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );
    let enrichments = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        return {
          situationMap,
          primaryPivotKind: "grounding",
          alternativePivotKinds: ["breathing-focus", "reaching-out"],
          whyThisPivot: "A small next step is available."
        };
      },
      async deriveMemory() {
        enrichments += 1;
        return "Saved outcome context.";
      }
    };
    const input = {
      subject: "firebase-user-1",
      protocolId: "protocol-1",
      expectedVersion: 0,
      idempotencyKey: "start-1",
      command: { type: "start" as const, quickDump: "I am stuck.", consentGiven: true, saveRequested: true }
    };
    await runGoogleProtocolCommand(input, { repository }, generator);
    await runGoogleProtocolCommand({ ...input, expectedVersion: 1, idempotencyKey: "select-1", command: { type: "select-pivot", pivotKind: "grounding" } }, { repository }, generator);
    const outcomeInput = {
      subject: "firebase-user-1",
      protocolId: "protocol-1",
      expectedVersion: 2,
      idempotencyKey: "outcome-1",
      command: { type: "record-outcome" as const, outcome: { status: "completed" as const } }
    };
    const first = await runGoogleProtocolCommand(outcomeInput, { repository }, generator);
    const replay = await runGoogleProtocolCommand(outcomeInput, { repository }, generator);

    expect(first).toMatchObject({ kind: "state", replayed: false, state: { enrichment: "saved" } });
    expect(replay).toMatchObject({ kind: "state", replayed: true, state: { enrichment: "saved" } });
    expect(enrichments).toBe(1);
  });

  it("returns a typed quota response without changing valid protocol state", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-28T12:00:00.000Z" }
    );
    const quota = {
      async reserve() {
        return {
          allowed: false as const,
          scope: "account" as const,
          resource: "model" as const,
          limit: 1,
          message: "The daily model-use quota is exhausted. Your valid protocol state is preserved; please continue tomorrow."
        };
      }
    };
    let generated = false;
    const result = await runGoogleProtocolCommand({
      subject: "firebase-user-1",
      protocolId: "protocol-1",
      expectedVersion: 0,
      idempotencyKey: "start-1",
      command: { type: "start", quickDump: "Private Quick dump.", consentGiven: true }
    }, {
      repository,
      quota,
      now: () => "2026-08-28T12:00:00.000Z"
    }, {
      async generate() {
        generated = true;
        throw new Error("must not call Gemini after quota exhaustion");
      }
    });

    expect(result).toMatchObject({ kind: "quota-exhausted", resource: "model", quickDump: "Private Quick dump." });
    expect(generated).toBe(false);
    await expect(loadGoogleProtocol({ subject: "firebase-user-1", protocolId: "protocol-1" }, { repository }))
      .resolves.toMatchObject({ kind: "protocol", protocol: { version: 0 } });
  });

  it("does not reserve quota before the consent gate", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-28T12:00:00.000Z" }
    );
    let reservations = 0;
    const result = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 0, idempotencyKey: "no-consent",
      command: { type: "start", quickDump: "I am stuck.", consentGiven: false }
    }, {
      repository,
      quota: { async reserve() { reservations += 1; return { allowed: true, modelUsed: 0, artifactUsed: 0 }; } },
      now: () => "2026-08-28T12:00:00.000Z"
    });

    expect(result).toEqual({ kind: "consent-required" });
    expect(reservations).toBe(0);
  });

  it("keeps a valid generated state visible when its Firestore write fails", async () => {
    const baseRepository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository: baseRepository, createId: () => "protocol-1", now: () => "2026-08-28T12:00:00.000Z" }
    );
    const repository = {
      ...baseRepository,
      async saveState() {
        throw new Error("Firestore timeout");
      }
    };

    const result = await runGoogleProtocolCommand({
      subject: "firebase-user-1",
      protocolId: "protocol-1",
      expectedVersion: 0,
      idempotencyKey: "start-1",
      command: { type: "start", quickDump: "Private Quick dump.", consentGiven: true, saveRequested: true }
    }, { repository });

    expect(result).toMatchObject({
      kind: "dependency-unavailable",
      state: { kind: "pivot-protocol", fallback: true, persistence: "pending", enrichment: "unavailable" }
    });
    if (result.kind !== "dependency-unavailable" || !result.state) return;
    expect(result.state.derivedMemory).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("Firestore timeout");
  });

  it("does not expose Derived memory when embedding fails during outcome enrichment", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const memoryRepository = createInMemoryGoogleMemoryRepository();
    const adaptation = {
      memoryRepository,
      async embed() { throw new Error("embedding timeout"); }
    };
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-28T12:00:00.000Z" }
    );
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        return { situationMap, primaryPivotKind: "grounding", alternativePivotKinds: ["breathing-focus", "reaching-out"], whyThisPivot: "A small next step." };
      }
    };
    await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 0, idempotencyKey: "start-1",
      command: { type: "start", quickDump: "I am stuck.", consentGiven: true, saveRequested: true }
    }, { repository, adaptation }, generator);
    await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 1, idempotencyKey: "select-1",
      command: { type: "select-pivot", pivotKind: "grounding" }
    }, { repository, adaptation }, generator);
    const outcome = await runGoogleProtocolCommand({
      subject: "firebase-user-1", protocolId: "protocol-1", expectedVersion: 2, idempotencyKey: "outcome-1",
      command: { type: "record-outcome", outcome: { status: "completed" } }
    }, { repository, adaptation }, generator);

    expect(outcome).toMatchObject({ kind: "state", state: { enrichment: "unavailable" } });
    if (outcome.kind !== "state") return;
    expect(outcome.state.derivedMemory).toBeUndefined();
    await expect(memoryRepository.listMemories("firebase-user-1")).resolves.toEqual([]);
  });
});

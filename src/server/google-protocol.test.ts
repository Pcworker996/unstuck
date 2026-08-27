import { describe, expect, it } from "vitest";

import type { GooglePivotGenerator } from "../app/google-pivot-protocol";
import {
  createInMemoryGoogleProtocolRepository,
  loadGoogleProtocol,
  runGoogleProtocolCommand,
  startGoogleProtocol
} from "./google-protocol";

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

  it("replays legacy idempotency records that predate command fingerprints", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await repository.create({
      id: "protocol-legacy",
      ownerSubject: "firebase-user-1",
      version: 1,
      createdAt: "2026-08-26T12:00:00.000Z",
      idempotency: {
        "legacy-key": { version: 1, state: { value: "saved" } }
      }
    });

    await expect(repository.findIdempotent({
      protocolId: "protocol-legacy",
      ownerSubject: "firebase-user-1",
      idempotencyKey: "legacy-key",
      fingerprint: "new-fingerprint"
    })).resolves.toMatchObject({ kind: "match", protocol: { pivotState: { value: "saved" } } });

    await expect(repository.saveState({
      protocolId: "protocol-legacy",
      ownerSubject: "firebase-user-1",
      expectedVersion: 1,
      idempotencyKey: "legacy-key",
      fingerprint: "new-fingerprint",
      state: { value: "different-retry" }
    })).resolves.toMatchObject({ kind: "idempotent", protocol: { version: 1, pivotState: { value: "saved" } } });
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

    async function createProtocol(protocolId: string, generator?: GooglePivotGenerator) {
      await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
      const result = await runGoogleProtocolCommand({
        subject: "firebase-user-1",
        protocolId,
        expectedVersion: 0,
        idempotencyKey: `${protocolId}-start`,
        command: { type: "start", quickDump: "I am stuck on a small task.", consentGiven: true }
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

    await createProtocol("protocol-2");
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
});

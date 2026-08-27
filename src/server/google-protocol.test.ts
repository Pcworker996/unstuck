import { describe, expect, it } from "vitest";

import {
  createInMemoryGoogleProtocolRepository,
  loadGoogleProtocol,
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
      state: { value: "first" }
    });
    expect(first.kind).toBe("saved");
    expect(first.protocol.version).toBe(1);

    const stale = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-2",
      state: { value: "stale" }
    });
    expect(stale).toMatchObject({ kind: "conflict", protocol: { version: 1 } });

    const replay = await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "edit-1",
      state: { value: "different-retry" }
    });
    expect(replay).toMatchObject({ kind: "idempotent", protocol: { version: 1, pivotState: { value: "first" } } });
  });
});

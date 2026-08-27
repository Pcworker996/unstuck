import { describe, expect, it } from "vitest";

import { createInMemoryGoogleProtocolRepository } from "./google-protocol";
import {
  handleGoogleProtocolGet,
  handleGoogleProtocolList,
  handleGoogleProtocolPost,
  handleGoogleSavedHistoryDelete,
  handleGoogleSavedHistoryGet
} from "./google-protocol-http";

describe("Google Protocol HTTP interface", () => {
  it("creates a protocol from the verified identity instead of request data", async () => {
    const response = await handleGoogleProtocolPost(
      new Request("http://localhost/api/google/protocol", {
        method: "POST",
        body: JSON.stringify({ ownerSubject: "attacker-controlled-value" })
      }),
      {
        repository: createInMemoryGoogleProtocolRepository(),
        createId: () => "protocol-1",
        now: () => "2026-08-26T12:00:00.000Z"
      },
      async () => ({ subject: "firebase-user-1" })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      kind: "protocol",
      protocol: {
        id: "protocol-1",
        version: 0,
        createdAt: "2026-08-26T12:00:00.000Z"
      }
    });
  });

  it("returns a typed server failure without exposing configuration details", async () => {
    const response = await handleGoogleProtocolPost(
      new Request("http://localhost/api/google/protocol", { method: "POST" }),
      {
        repository: createInMemoryGoogleProtocolRepository(),
        createId: () => "protocol-1",
        now: () => "2026-08-26T12:00:00.000Z"
      },
      async () => {
        throw new Error("FIREBASE_PROJECT_ID is required.");
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      kind: "server-error",
      message: "Your private workspace is temporarily unavailable."
    });
  });

  it("does not reveal whether another person's protocol exists", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await repository.create({
      id: "protocol-1",
      ownerSubject: "firebase-user-1",
      version: 0,
      createdAt: "2026-08-26T12:00:00.000Z"
    });

    const response = await handleGoogleProtocolGet(
      new Request("http://localhost/api/google/protocol/protocol-1"),
      "protocol-1",
      { repository },
      async () => ({ subject: "firebase-user-2" })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ kind: "not-found" });
  });

  it("discovers only the authenticated owner's persisted protocol", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await repository.create({
      id: "protocol-1",
      ownerSubject: "firebase-user-1",
      version: 0,
      createdAt: "2026-08-26T12:00:00.000Z"
    });

    const response = await handleGoogleProtocolList(
      new Request("http://localhost/api/google/protocol"),
      { repository },
      async () => ({ subject: "firebase-user-1" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "protocol",
      protocol: {
        id: "protocol-1",
        version: 0,
        createdAt: "2026-08-26T12:00:00.000Z"
      }
    });
  });

  it("lists and deletes saved history through the authenticated owner", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await repository.create({
      id: "saved-1",
      ownerSubject: "firebase-user-1",
      version: 1,
      createdAt: "2026-08-26T12:00:00.000Z",
      pivotState: { kind: "pivot-protocol", version: 1, situationMap: {}, persistence: "saved", checkIn: { quickDump: "private" } }
    });

    const history = await handleGoogleSavedHistoryGet(
      new Request("http://localhost/api/google/history"),
      { repository },
      async () => ({ subject: "firebase-user-1" })
    );
    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toMatchObject({ protocols: [{ id: "saved-1" }] });

    const forbiddenDelete = await handleGoogleSavedHistoryDelete(
      new Request("http://localhost/api/google/history/saved-1", { method: "DELETE" }),
      "saved-1",
      { repository },
      async () => ({ subject: "firebase-user-2" })
    );
    expect(forbiddenDelete.status).toBe(404);

    const deleted = await handleGoogleSavedHistoryDelete(
      new Request("http://localhost/api/google/history/saved-1", { method: "DELETE" }),
      "saved-1",
      { repository },
      async () => ({ subject: "firebase-user-1" })
    );
    expect(deleted.status).toBe(200);
  });
});

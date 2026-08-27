import { describe, expect, it } from "vitest";

import { FirebaseAuthenticationError } from "./firebase-auth";
import { handleGooglePivotOutcomePost, handleGooglePivotPost } from "./google-pivot-http";
import { createInMemoryGoogleProtocolRepository, startGoogleProtocol } from "./google-protocol";

describe("Google Pivot HTTP interface", () => {
  it("runs the authenticated Quick dump flow", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );
    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "legacy-start",
          quickDump: "I keep avoiding the first step of moving.",
          consentGiven: true
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ kind: "pivot-protocol" });
  });

  it("does not allow an unauthenticated Quick dump", async () => {
    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", { method: "POST" }),
      async () => {
        throw new FirebaseAuthenticationError("missing token");
      },
      createInMemoryGoogleProtocolRepository()
    );

    expect(response.status).toBe(401);
  });

  it("requires an idempotency key for state-changing commands", async () => {
    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          quickDump: "I am stuck.",
          consentGiven: true
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      createInMemoryGoogleProtocolRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ kind: "invalid-request" });
  });

  it("requires an explicit expected protocol version", async () => {
    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          idempotencyKey: "version-1",
          quickDump: "I am stuck.",
          consentGiven: true
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      createInMemoryGoogleProtocolRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      kind: "invalid-request",
      message: "An expected protocol version is required for state-changing commands."
    });
  });

  it("rejects numeric wellness fields in an outcome", async () => {
    const response = await handleGooglePivotOutcomePost(
      new Request("http://localhost/api/google/pivot/outcome", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "outcome-1",
          type: "record-outcome",
          outcome: { status: "completed", wellnessScore: 5 }
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      createInMemoryGoogleProtocolRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ kind: "invalid-request" });
  });

  it("keeps outcome mutations on the dedicated outcome route", async () => {
    const request = new Request("http://localhost/api/google/pivot", {
      method: "POST",
      body: JSON.stringify({
        protocolId: "protocol-1",
        expectedVersion: 0,
        idempotencyKey: "outcome-1",
        type: "record-outcome",
        outcome: { status: "completed" }
      })
    });

    const response = await handleGooglePivotPost(
      request,
      async () => ({ subject: "firebase-user-1" }),
      createInMemoryGoogleProtocolRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ kind: "invalid-request" });

    const dedicatedResponse = await handleGooglePivotOutcomePost(
      new Request("http://localhost/api/google/pivot/outcome", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "outcome-1",
          type: "record-outcome",
          outcome: { status: "completed" }
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      createInMemoryGoogleProtocolRepository()
    );

    expect(dedicatedResponse.status).toBe(404);
  });

  it("runs Safety before reading the private protocol", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const guardedRepository = {
      ...repository,
      async findByIdForOwner() {
        throw new Error("Safety must happen first");
      }
    };

    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "missing",
          expectedVersion: 0,
          idempotencyKey: "safety-1",
          quickDump: "I am in immediate danger right now.",
          consentGiven: true
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      guardedRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ kind: "safety-interruption" });
  });

  it("applies versioned commands and returns a visible conflict for stale edits", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );

    const start = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "start-1",
          type: "start",
          quickDump: "I keep avoiding the first step.",
          consentGiven: true
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );
    const started = await start.json();
    expect(started).toMatchObject({ kind: "pivot-protocol", version: 1 });

    const correctionBody = {
      protocolId: "protocol-1",
      expectedVersion: 1,
      idempotencyKey: "correction-1",
      type: "correct-map",
      section: "shared",
      itemId: "shared-1",
      text: "I need to start with the lease checklist."
    };
    const corrected = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", { method: "POST", body: JSON.stringify(correctionBody) }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );
    expect(corrected.status).toBe(200);

    const replay = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", { method: "POST", body: JSON.stringify(correctionBody) }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );
    await expect(replay.json()).resolves.toMatchObject({
      kind: "pivot-protocol",
      version: 2,
      situationMap: { shared: [{ text: "I need to start with the lease checklist." }] }
    });

    const stale = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        headers: { "if-match": "1", "idempotency-key": "stale-1" },
        body: JSON.stringify({
          protocolId: "protocol-1",
          type: "dismiss-pivot"
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ kind: "conflict", protocol: { version: 2 } });
  });
});

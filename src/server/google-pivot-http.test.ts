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

  it("accepts an optional image in JSON without accepting a client filename", async () => {
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
          idempotencyKey: "image-start",
          quickDump: "I am stuck on moving paperwork.",
          consentGiven: true,
          image: {
            base64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]).toString("base64"),
            mimeType: "image/jpeg",
            filename: "private-landlord-message.jpg"
          }
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository,
      {
        async generate({ situationMap }) {
          return { situationMap, primaryPivotKind: "task-first-step", alternativePivotKinds: ["grounding", "reaching-out"], whyThisPivot: "A bounded next step." };
        },
        async extractImageClaims() {
          return { claims: [{ text: "The message asks for a response." }] };
        }
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.situationMap.artifactClaims).toEqual([
      { id: "artifact-image-1", text: "The message asks for a response.", provenance: "artifact" }
    ]);
    expect(JSON.stringify(body)).not.toContain("private-landlord-message.jpg");
  });

  it("continues through a mixed JSON artifact batch and persists only content-free artifact state", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );
    const validImage = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]).toString("base64");
    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "mixed-artifacts",
          type: "start",
          quickDump: "I need to sort the moving checklist.",
          consentGiven: true,
          artifacts: [
            { base64: validImage, mimeType: "image/jpeg", filename: "private-message.jpg" },
            { base64: Buffer.from("not an artifact").toString("base64"), mimeType: "application/pdf", filename: "private-checklist.pdf" }
          ]
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository,
      {
        async extractSupportingArtifactClaims() { return { claims: [{ text: "The message asks for a response." }] }; },
        async generate({ situationMap }) {
          return { situationMap, primaryPivotKind: "task-first-step", alternativePivotKinds: ["grounding", "reaching-out"], whyThisPivot: "A bounded next step." };
        }
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.artifacts).toMatchObject([
      { artifactId: "artifact-1", status: "accepted" },
      { artifactId: "artifact-2", status: "rejected" }
    ]);
    expect(JSON.stringify(body)).not.toContain("private-message.jpg");
    expect(JSON.stringify(body)).not.toContain("private-checklist.pdf");
    const saved = await repository.findByIdForOwner({ protocolId: "protocol-1", ownerSubject: "firebase-user-1" });
    expect(JSON.stringify(saved)).not.toContain("private-message.jpg");
    expect(JSON.stringify(saved)).not.toContain("not an artifact");
  });

  it("handles a multipart image upload and gives explicit malformed feedback", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    await startGoogleProtocol(
      { subject: "firebase-user-1" },
      { repository, createId: () => "protocol-1", now: () => "2026-08-26T12:00:00.000Z" }
    );
    const form = new FormData();
    form.set("protocolId", "protocol-1");
    form.set("expectedVersion", "0");
    form.set("idempotencyKey", "multipart-image");
    form.set("quickDump", "I am stuck on moving paperwork.");
    form.set("consentGiven", "true");
    form.set("image", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0, 0])], "ignored.png", { type: "image/png" }));

    const response = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", { method: "POST", body: form }),
      async () => ({ subject: "firebase-user-1" }),
      repository,
      {
        async generate({ situationMap }) {
          return { situationMap, primaryPivotKind: "task-first-step", alternativePivotKinds: ["grounding", "reaching-out"], whyThisPivot: "A bounded next step." };
        },
        async extractImageClaims() { return { claims: [] }; }
      }
    );
    expect(response.status).toBe(200);

    const malformed = await handleGooglePivotPost(
      new Request("http://localhost/api/google/pivot", {
        method: "POST",
        body: JSON.stringify({
          protocolId: "protocol-1",
          expectedVersion: 0,
          idempotencyKey: "bad-image",
          quickDump: "I am stuck.",
          consentGiven: true,
          image: { base64: "not base64" }
        })
      }),
      async () => ({ subject: "firebase-user-1" }),
      repository
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ kind: "invalid-request", message: "The image upload is malformed." });
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

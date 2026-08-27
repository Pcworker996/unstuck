import { describe, expect, it } from "vitest";

import { FirebaseAuthenticationError } from "./firebase-auth";
import { handleGooglePivotPost } from "./google-pivot-http";
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
});

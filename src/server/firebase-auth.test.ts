import { describe, expect, it } from "vitest";

import { authenticateFirebaseRequest, FirebaseAuthenticationError } from "./firebase-auth";

describe("Firebase request authentication", () => {
  it("derives the owner only from a verified Firebase ID token", async () => {
    const identity = await authenticateFirebaseRequest(
      new Request("http://localhost/api/google/protocol", {
        headers: { authorization: "Bearer firebase-id-token" }
      }),
      { verifyIdToken: async () => ({ uid: "firebase-user-1" }) }
    );

    expect(identity).toEqual({ subject: "firebase-user-1" });
  });

  it("rejects missing, invalid, or subjectless credentials", async () => {
    await expect(
      authenticateFirebaseRequest(new Request("http://localhost/api/google/protocol"), {
        verifyIdToken: async () => ({ uid: "firebase-user-1" })
      })
    ).rejects.toBeInstanceOf(FirebaseAuthenticationError);

    await expect(
      authenticateFirebaseRequest(
        new Request("http://localhost/api/google/protocol", {
          headers: { authorization: "Bearer invalid" }
        }),
        { verifyIdToken: async () => ({}) }
      )
    ).rejects.toBeInstanceOf(FirebaseAuthenticationError);
  });
});

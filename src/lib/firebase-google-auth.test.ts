import { describe, expect, it, vi } from "vitest";

import { createFirebaseGoogleAuthClient } from "./firebase-google-auth";

describe("Firebase Google authentication client", () => {
  it("signs in with Google and exposes only the authenticated person's identity and token", async () => {
    const user = {
      uid: "firebase-user-1",
      displayName: "Mae",
      email: "mae@example.com",
      getIdToken: vi.fn().mockResolvedValue("firebase-id-token")
    };
    const operations = {
      signInWithGoogle: vi.fn().mockResolvedValue(user),
      currentUser: () => user,
      signOut: vi.fn().mockResolvedValue(undefined)
    };
    const client = createFirebaseGoogleAuthClient(operations);

    await expect(client.signIn()).resolves.toEqual({ id: "firebase-user-1", displayName: "Mae" });
    await expect(client.idToken()).resolves.toBe("firebase-id-token");
    await client.signOut();

    expect(operations.signInWithGoogle).toHaveBeenCalledOnce();
    expect(operations.signOut).toHaveBeenCalledOnce();
  });

  it("keeps a signed-out visitor out of the private workspace", async () => {
    const client = createFirebaseGoogleAuthClient({
      signInWithGoogle: async () => ({
        uid: "firebase-user-1",
        getIdToken: async () => "firebase-id-token"
      }),
      currentUser: () => undefined,
      signOut: async () => undefined
    });

    await expect(client.currentPerson()).resolves.toBeUndefined();
    await expect(client.idToken()).resolves.toBeUndefined();
  });
});

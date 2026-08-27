import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/firebase-google-auth", () => ({
  getFirebaseGoogleAuthClient: () => ({
    idToken: async () => "firebase-id-token"
  })
}));

import { googleApiRequest } from "./google-home";

describe("Google workspace API requests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows an expected not-found response during workspace discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ kind: "not-found" }), { status: 404 })
      )
    );

    await expect(
      googleApiRequest<{ kind: "not-found" }>(
        "/api/google/protocol",
        {},
        { allowNotFound: true }
      )
    ).resolves.toEqual({ kind: "not-found" });
  });

  it("still rejects unexpected not-found responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ kind: "not-found" }), { status: 404 })
      )
    );

    await expect(googleApiRequest("/api/google/protocol")).rejects.toThrow(
      "Your private workspace is unavailable."
    );
  });
});

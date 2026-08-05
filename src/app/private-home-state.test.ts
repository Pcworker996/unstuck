import { describe, expect, it } from "vitest";

import { privateHomeState } from "./private-home-state";

describe("privateHomeState", () => {
  it("asks a signed-out person to sign in instead of showing their home", () => {
    expect(privateHomeState(undefined)).toEqual({ kind: "sign-in" });
  });

  it("shows an empty private home for the authenticated person", () => {
    expect(privateHomeState({ id: "person-123", displayName: "Mae" })).toEqual({
      kind: "private-home",
      person: { id: "person-123", displayName: "Mae" }
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  authenticateRequest,
  readBearerToken,
  resetAuthVerifierForTests
} from "./auth";

afterEach(() => {
  delete process.env.UNSTUCK_DEV_AUTH;
  delete process.env.UNSTUCK_DEV_SUBJECT;
  resetAuthVerifierForTests();
});

describe("request authentication", () => {
  it("reads a Bearer token without exposing any account identifier from the request body", () => {
    expect(readBearerToken("Bearer signed-id-token")).toBe("signed-id-token");
    expect(readBearerToken("Basic something")).toBeUndefined();
  });

  it("uses only the explicit fixed development identity when development auth is enabled", async () => {
    process.env.UNSTUCK_DEV_AUTH = "true";
    process.env.UNSTUCK_DEV_SUBJECT = "local-subject";

    const identity = await authenticateRequest(new Request("http://localhost/api/pivot"));

    expect(identity).toEqual({ subject: "local-subject" });
  });
});

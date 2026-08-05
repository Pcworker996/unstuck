import { describe, expect, it } from "vitest";

import { authFormFields } from "./auth-form";

describe("authFormFields", () => {
  it("asks for only email and confirmation code when confirming a Personal account", () => {
    expect(authFormFields("confirm")).toEqual(["email", "confirmation-code"]);
  });
});

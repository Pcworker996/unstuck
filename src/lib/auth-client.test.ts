import { describe, expect, it, vi } from "vitest";

import { AuthOperations, createAuthClient } from "./auth-client";

function operations(overrides: Partial<AuthOperations> = {}): AuthOperations {
  return {
    signUp: vi.fn().mockResolvedValue({ nextStep: { signUpStep: "CONFIRM_SIGN_UP" } }),
    confirmSignUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue({ isSignedIn: true }),
    getCurrentUser: vi.fn().mockResolvedValue({ userId: "person-123", username: "Mae" }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("createAuthClient", () => {
  it("creates a Personal account and reports when email confirmation is next", async () => {
    const authOperations = operations();
    const client = createAuthClient(authOperations);

    await expect(client.createAccount(" mae@example.com ", "password-123")).resolves.toBe(
      "confirm"
    );
    expect(authOperations.signUp).toHaveBeenCalledWith({
      username: "mae@example.com",
      password: "password-123",
      options: { userAttributes: { email: "mae@example.com" } }
    });
  });

  it("confirms the Personal account with the normalized email", async () => {
    const authOperations = operations();
    const client = createAuthClient(authOperations);

    await client.confirmAccount(" mae@example.com ", "123456");

    expect(authOperations.confirmSignUp).toHaveBeenCalledWith({
      username: "mae@example.com",
      confirmationCode: "123456"
    });
  });

  it("returns the signed-in person from Cognito", async () => {
    const authOperations = operations();
    const client = createAuthClient(authOperations);

    await expect(client.signIn(" mae@example.com ", "password-123")).resolves.toEqual({
      id: "person-123",
      displayName: "Mae"
    });
    expect(authOperations.signIn).toHaveBeenCalledWith({
      username: "mae@example.com",
      password: "password-123"
    });
  });

  it("treats a missing Cognito session as signed out", async () => {
    const authOperations = operations({
      getCurrentUser: vi.fn().mockRejectedValue(new Error("No current user"))
    });
    const client = createAuthClient(authOperations);

    await expect(client.currentPerson()).resolves.toBeUndefined();
  });

  it("does not look up a person when Cognito has not completed sign-in", async () => {
    const authOperations = operations({
      signIn: vi.fn().mockResolvedValue({ isSignedIn: false })
    });
    const client = createAuthClient(authOperations);

    await expect(client.signIn("mae@example.com", "password-123")).resolves.toBeUndefined();
    expect(authOperations.getCurrentUser).not.toHaveBeenCalled();
  });

  it("signs the person out through the auth provider", async () => {
    const authOperations = operations();
    const client = createAuthClient(authOperations);

    await client.signOut();

    expect(authOperations.signOut).toHaveBeenCalledOnce();
  });
});

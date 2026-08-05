export type AuthMode = "sign-in" | "sign-up" | "confirm";

export type AuthFormField = "email" | "password" | "confirmation-code";

export function authFormFields(mode: AuthMode): AuthFormField[] {
  if (mode === "confirm") {
    return ["email", "confirmation-code"];
  }

  return ["email", "password"];
}

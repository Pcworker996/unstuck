import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp
} from "aws-amplify/auth";

export type AuthOperations = {
  signUp: (input: {
    username: string;
    password: string;
    options: { userAttributes: { email: string } };
  }) => Promise<{ nextStep: { signUpStep: string } }>;
  confirmSignUp: (input: {
    username: string;
    confirmationCode: string;
  }) => Promise<unknown>;
  signIn: (input: { username: string; password: string }) => Promise<{
    isSignedIn: boolean;
  }>;
  getCurrentUser: () => Promise<{ userId: string; username: string }>;
  fetchAuthSession?: () => Promise<{
    tokens?: { idToken?: { toString: () => string } };
  }>;
  signOut: () => Promise<unknown>;
};

export type SignedInPerson = {
  id: string;
  displayName: string;
};

export type AuthClient = {
  createAccount: (email: string, password: string) => Promise<"confirm" | "sign-in">;
  confirmAccount: (email: string, confirmationCode: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignedInPerson | undefined>;
  idToken: () => Promise<string | undefined>;
  currentPerson: () => Promise<SignedInPerson | undefined>;
  signOut: () => Promise<void>;
};

export function createAuthClient(operations: AuthOperations): AuthClient {
  async function currentPerson(): Promise<SignedInPerson | undefined> {
    try {
      const user = await operations.getCurrentUser();
      return { id: user.userId, displayName: user.username };
    } catch {
      return undefined;
    }
  }

  return {
    async createAccount(email, password) {
      const normalizedEmail = email.trim();
      const result = await operations.signUp({
        username: normalizedEmail,
        password,
        options: { userAttributes: { email: normalizedEmail } }
      });

      return result.nextStep.signUpStep === "CONFIRM_SIGN_UP" ? "confirm" : "sign-in";
    },

    async confirmAccount(email, confirmationCode) {
      await operations.confirmSignUp({
        username: email.trim(),
        confirmationCode
      });
    },

    async signIn(email, password) {
      const result = await operations.signIn({
        username: email.trim(),
        password
      });

      if (!result.isSignedIn) {
        return undefined;
      }

      return currentPerson();
    },

    async idToken() {
      const session = await operations.fetchAuthSession?.();
      return session?.tokens?.idToken?.toString();
    },

    currentPerson,

    async signOut() {
      await operations.signOut();
    }
  };
}

export const authClient = createAuthClient({
  signUp,
  confirmSignUp,
  signIn,
  fetchAuthSession,
  getCurrentUser,
  signOut
});

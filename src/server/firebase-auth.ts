import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type FirebaseTokenVerifier = {
  verifyIdToken: (token: string) => Promise<{ uid?: string }>;
};

export class FirebaseAuthenticationError extends Error {
  readonly status = 401;
}

export class FirebaseAuthConfigurationError extends Error {
  readonly status = 500;
}

let verifier: FirebaseTokenVerifier | undefined;

export async function authenticateFirebaseRequest(
  request: Request,
  injectedVerifier?: FirebaseTokenVerifier
): Promise<{ subject: string }> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new FirebaseAuthenticationError("A Firebase ID token is required.");
  }

  try {
    const decodedToken = await (injectedVerifier ?? getFirebaseVerifier()).verifyIdToken(token);
    if (!decodedToken.uid) {
      throw new FirebaseAuthenticationError("The Firebase ID token has no subject.");
    }

    return { subject: decodedToken.uid };
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      throw error;
    }

    throw new FirebaseAuthenticationError("The Firebase ID token could not be verified.");
  }
}

export function resetFirebaseAuthVerifierForTests(): void {
  verifier = undefined;
}

function getFirebaseVerifier(): FirebaseTokenVerifier {
  if (verifier) {
    return verifier;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new FirebaseAuthConfigurationError("FIREBASE_PROJECT_ID is required.");
  }

  const app = getApps()[0] ?? initializeApp({ projectId });
  verifier = getAuth(app);
  return verifier;
}

function readBearerToken(value: string | null): string | undefined {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

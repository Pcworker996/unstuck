import { CognitoJwtVerifier } from "aws-jwt-verify";

export type AuthenticatedIdentity = {
  subject: string;
};

export type JwtVerifier = {
  verify: (token: string) => Promise<{ sub?: string }>;
};

export class AuthenticationError extends Error {
  readonly status = 401;
}

export class AuthConfigurationError extends Error {
  readonly status = 500;
}

let verifier: JwtVerifier | undefined;

export async function authenticateRequest(
  request: Request,
  injectedVerifier?: JwtVerifier
): Promise<AuthenticatedIdentity> {
  if (isDevelopmentAuthEnabled()) {
    return {
      subject: process.env.UNSTUCK_DEV_SUBJECT?.trim() || "local-development-subject"
    };
  }

  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new AuthenticationError("A Cognito ID token is required.");
  }

  try {
    const claims = await (injectedVerifier ?? getVerifier()).verify(token);
    if (!claims.sub) {
      throw new AuthenticationError("The Cognito ID token has no subject.");
    }

    return { subject: claims.sub };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError("The Cognito ID token could not be verified.");
  }
}

export function isDevelopmentAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.UNSTUCK_DEV_AUTH === "true";
}

export function readBearerToken(value: string | null): string | undefined {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function getVerifier(): JwtVerifier {
  if (verifier) {
    return verifier;
  }

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new AuthConfigurationError(
      "COGNITO_USER_POOL_ID and COGNITO_USER_POOL_CLIENT_ID are required."
    );
  }

  verifier = CognitoJwtVerifier.create({
    userPoolId,
    clientId,
    tokenUse: "id"
  });
  return verifier;
}

export function resetAuthVerifierForTests(): void {
  verifier = undefined;
}

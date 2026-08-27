import {
  findFirstGoogleProtocol,
  loadGoogleProtocol,
  startGoogleProtocol,
  type GoogleProtocolDependencies,
  type GoogleProtocolResult
} from "./google-protocol";
import { FirebaseAuthenticationError } from "./firebase-auth";

export type GoogleRequestAuthenticator = (
  request: Request
) => Promise<{ subject: string }>;

export async function handleGoogleProtocolPost(
  request: Request,
  dependencies: GoogleProtocolDependencies,
  authenticate: GoogleRequestAuthenticator
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const result = await startGoogleProtocol({ subject: identity.subject }, dependencies);
    return json(result, 201);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return json(
        { kind: "unauthorized", message: "You need to sign in to access your private workspace." },
        401
      );
    }

    return json(
      { kind: "server-error", message: "Your private workspace is temporarily unavailable." },
      500
    );
  }
}

export async function handleGoogleProtocolGet(
  request: Request,
  protocolId: string,
  dependencies: Pick<GoogleProtocolDependencies, "repository">,
  authenticate: GoogleRequestAuthenticator
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const result = await loadGoogleProtocol(
      { subject: identity.subject, protocolId },
      dependencies
    );
    return json(result, result.kind === "not-found" ? 404 : 200);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return json(
        { kind: "unauthorized", message: "You need to sign in to access your private workspace." },
        401
      );
    }

    return json(
      { kind: "server-error", message: "Your private workspace is temporarily unavailable." },
      500
    );
  }
}

export async function handleGoogleProtocolList(
  request: Request,
  dependencies: Pick<GoogleProtocolDependencies, "repository">,
  authenticate: GoogleRequestAuthenticator
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const result = await findFirstGoogleProtocol({ subject: identity.subject }, dependencies);
    return json(result, result.kind === "not-found" ? 404 : 200);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return json(
        { kind: "unauthorized", message: "You need to sign in to access your private workspace." },
        401
      );
    }

    return json(
      { kind: "server-error", message: "Your private workspace is temporarily unavailable." },
      500
    );
  }
}

function json(
  result:
    | GoogleProtocolResult
    | { kind: "unauthorized" | "server-error"; message: string },
  status: number
): Response {
  return new Response(JSON.stringify(result), {
    status,
    headers: { "content-type": "application/json" }
  });
}

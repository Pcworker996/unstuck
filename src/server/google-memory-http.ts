import { FirebaseAuthenticationError } from "./firebase-auth";
import type { GoogleMemoryRepository } from "./google-memory";

export type GoogleMemoryAuthenticator = (request: Request) => Promise<{ subject: string }>;

export async function handleGoogleMemoriesGet(
  request: Request,
  repository: GoogleMemoryRepository,
  authenticate: GoogleMemoryAuthenticator
): Promise<Response> {
  try {
    const { subject } = await authenticate(request);
    return json({ kind: "memories", memories: await repository.listMemories(subject) }, 200);
  } catch (error) {
    return errorResponse(error, "Your saved memories are temporarily unavailable.");
  }
}

export async function handleGoogleMemoryControl(
  request: Request,
  memoryId: string,
  operation: "exclude" | "forget" | "delete",
  repository: GoogleMemoryRepository,
  authenticate: GoogleMemoryAuthenticator
): Promise<Response> {
  try {
    const { subject } = await authenticate(request);
    const result = operation === "exclude"
      ? await repository.excludeMemory({ ownerSubject: subject, memoryId })
      : operation === "forget"
        ? await repository.forgetMemory({ ownerSubject: subject, memoryId })
        : await repository.deleteMemory({ ownerSubject: subject, memoryId });
    return result
      ? json({ kind: operation === "delete" ? "deleted" : operation, memoryId }, 200)
      : json({ kind: "not-found", message: "That memory was not found." }, 404);
  } catch (error) {
    return errorResponse(error, "Your memory control is temporarily unavailable.");
  }
}

export async function handleGooglePreferencesGet(
  request: Request,
  repository: GoogleMemoryRepository,
  authenticate: GoogleMemoryAuthenticator
): Promise<Response> {
  try {
    const { subject } = await authenticate(request);
    return json({ kind: "preferences", preferences: await repository.listGuidancePreferences(subject) }, 200);
  } catch (error) {
    return errorResponse(error, "Your Guidance preferences are temporarily unavailable.");
  }
}

export async function handleGooglePreferencePost(
  request: Request,
  repository: GoogleMemoryRepository,
  authenticate: GoogleMemoryAuthenticator
): Promise<Response> {
  try {
    const { subject } = await authenticate(request);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body) || typeof (body as Record<string, unknown>).text !== "string") {
      return json({ kind: "invalid-request", message: "An explicit Guidance preference is required." }, 400);
    }
    const preference = await repository.createGuidancePreference({ ownerSubject: subject, text: (body as { text: string }).text });
    return json({ kind: "preference", preference }, 201);
  } catch (error) {
    return errorResponse(error, "Your Guidance preference could not be saved.");
  }
}

export async function handleGooglePreferenceDelete(
  request: Request,
  preferenceId: string,
  repository: GoogleMemoryRepository,
  authenticate: GoogleMemoryAuthenticator
): Promise<Response> {
  try {
    const { subject } = await authenticate(request);
    const deleted = await repository.deleteGuidancePreference({ ownerSubject: subject, preferenceId });
    return deleted ? json({ kind: "deleted", preferenceId }, 200) : json({ kind: "not-found" }, 404);
  } catch (error) {
    return errorResponse(error, "Your Guidance preference could not be deleted.");
  }
}

function errorResponse(error: unknown, message: string): Response {
  return error instanceof FirebaseAuthenticationError
    ? json({ kind: "unauthorized", message: "You need to sign in to manage your private memories." }, 401)
    : json({ kind: "server-error", message }, 500);
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

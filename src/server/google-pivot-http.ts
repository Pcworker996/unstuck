import { FirebaseAuthenticationError } from "./firebase-auth";
import { runGooglePivotProtocol, type GooglePivotGenerator } from "../app/google-pivot-protocol";
import type { GoogleProtocolRepository } from "./google-protocol";

type Authenticate = (request: Request) => Promise<{ subject: string }>;

export async function handleGooglePivotPost(
  request: Request,
  authenticate: Authenticate,
  repository: GoogleProtocolRepository,
  generator?: GooglePivotGenerator
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const body = await readJson(request);
    const input = parseInput(body);
    const safetyResult = await runGooglePivotProtocol({
      quickDump: input.quickDump,
      consentGiven: false
    });
    if (safetyResult.kind === "safety-interruption") {
      return json(safetyResult, 200);
    }
    const protocol = await repository.findByIdForOwner({
      protocolId: input.protocolId,
      ownerSubject: identity.subject
    });
    if (!protocol) {
      return json({ kind: "not-found", message: "The private protocol was not found." }, 404);
    }
    const result = await runGooglePivotProtocol(input, generator);
    if (result.kind === "pivot-protocol") {
      await repository.saveState({
        protocolId: input.protocolId,
        ownerSubject: identity.subject,
        state: result
      });
    }
    return json(result, 200);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return json(
        { kind: "unauthorized", message: "You need to sign in to use the Pivot Protocol." },
        401
      );
    }

    if (error instanceof HttpInputError) {
      return json({ kind: "invalid-request", message: error.message }, 400);
    }

    return json({ kind: "server-error", message: "The Pivot Protocol is temporarily unavailable." }, 500);
  }
}

function parseInput(value: unknown): { protocolId: string; quickDump: string; consentGiven: boolean } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { protocolId?: unknown }).protocolId !== "string" ||
    !(value as { protocolId: string }).protocolId.trim() ||
    typeof (value as { quickDump?: unknown }).quickDump !== "string" ||
    !(value as { quickDump: string }).quickDump.trim() ||
    (value as { quickDump: string }).quickDump.length > 10_000 ||
    typeof (value as { consentGiven?: unknown }).consentGiven !== "boolean"
  ) {
    throw new HttpInputError("A Quick dump and processing consent are required.");
  }

  return {
    protocolId: (value as { protocolId: string }).protocolId.trim(),
    quickDump: (value as { quickDump: string }).quickDump.trim(),
    consentGiven: (value as { consentGiven: boolean }).consentGiven
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpInputError("Request body must be valid JSON.");
  }
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

class HttpInputError extends Error {}

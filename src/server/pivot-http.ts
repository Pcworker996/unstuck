import {
  AuthenticationError,
  AuthConfigurationError,
  authenticateRequest,
  type AuthenticatedIdentity
} from "./auth";
import {
  recordPivotOutcome,
  runPivotProtocolService,
  type InspectableMemory,
  type MemoryRepository,
  type PivotProtocolServiceDependencies,
  type RecordPivotOutcomeDependencies
} from "./pivot-service";

type Authenticate = (request: Request) => Promise<AuthenticatedIdentity>;

export async function handlePivotPost(
  request: Request,
  dependencies: PivotProtocolServiceDependencies,
  authenticate: Authenticate = authenticateRequest
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const body = await readJson(request);
    const input = parsePivotInput(body);
    const result = await runPivotProtocolService(
      { ...input, subject: identity.subject, requestId: requestId(request) },
      dependencies
    );

    return json(result, result.kind === "consent-required" ? 400 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleOutcomePost(
  request: Request,
  dependencies: RecordPivotOutcomeDependencies,
  authenticate: Authenticate = authenticateRequest
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const body = await readJson(request);
    const input = parseOutcomeInput(body);
    const result = await recordPivotOutcome(
      { ...input, subject: identity.subject, requestId: requestId(request) },
      dependencies
    );

    return json(result, result.kind === "conflict" ? 409 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleMemoriesGet(
  request: Request,
  repository: MemoryRepository,
  authenticate: Authenticate = authenticateRequest
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    const accountId = await repository.ensureAccount(identity.subject);
    const memories = await repository.listMemories(accountId);
    return json({ memories }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleMemoryDelete(
  request: Request,
  memoryId: string,
  repository: MemoryRepository,
  authenticate: Authenticate = authenticateRequest
): Promise<Response> {
  return handleMemoryMutation(request, memoryId, repository, "delete", authenticate);
}

export async function handleMemoryForget(
  request: Request,
  memoryId: string,
  repository: MemoryRepository,
  authenticate: Authenticate = authenticateRequest
): Promise<Response> {
  return handleMemoryMutation(request, memoryId, repository, "forget", authenticate);
}

async function handleMemoryMutation(
  request: Request,
  memoryId: string,
  repository: MemoryRepository,
  action: "delete" | "forget",
  authenticate: Authenticate
): Promise<Response> {
  try {
    const identity = await authenticate(request);
    if (!memoryId.trim()) {
      return json({ kind: "invalid-request", message: "A memory ID is required." }, 400);
    }

    const accountId = await repository.ensureAccount(identity.subject);
    const changed =
      action === "delete"
        ? await repository.deleteMemory({ accountId, memoryId })
        : await repository.forgetMemory({ accountId, memoryId });

    return changed
      ? json({ kind: action === "delete" ? "deleted" : "forgotten", memoryId }, 200)
      : json({ kind: "not-found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

function parsePivotInput(value: unknown): {
  checkIn: { quickDump: string; emotionalState: 1 | 2 | 3 | 4 | 5 };
  consentGiven: boolean;
  saveRequested: boolean;
} {
  if (!isRecord(value)) {
    throw new HttpInputError("Request body must be an object.");
  }

  const checkIn = value.checkIn;
  if (!isRecord(checkIn)) {
    throw new HttpInputError("Check-in is required.");
  }

  const quickDump = checkIn.quickDump;
  const emotionalState = checkIn.emotionalState;
  if (
    typeof quickDump !== "string" ||
    quickDump.trim().length === 0 ||
    quickDump.length > 10_000 ||
    !isEmotionalState(emotionalState) ||
    typeof value.consentGiven !== "boolean" ||
    typeof value.saveRequested !== "boolean"
  ) {
    throw new HttpInputError("Check-in, consent, and save values are invalid.");
  }

  return {
    checkIn: { quickDump: quickDump.trim(), emotionalState },
    consentGiven: value.consentGiven,
    saveRequested: value.saveRequested
  };
}

function parseOutcomeInput(value: unknown): {
  checkInId: string;
  selectedPivotKind: string;
  outcomeKind: string;
  updatedEmotionalState?: number;
  pivotTimeSeconds?: number;
} {
  if (!isRecord(value)) {
    throw new HttpInputError("Request body must be an object.");
  }

  if (
    typeof value.checkInId !== "string" ||
    !value.checkInId.trim() ||
    typeof value.selectedPivotKind !== "string" ||
    typeof value.outcomeKind !== "string" ||
    (value.updatedEmotionalState !== undefined &&
      typeof value.updatedEmotionalState !== "number") ||
    (value.pivotTimeSeconds !== undefined && typeof value.pivotTimeSeconds !== "number")
  ) {
    throw new HttpInputError("Outcome values are invalid.");
  }

  return {
    checkInId: value.checkInId.trim(),
    selectedPivotKind: value.selectedPivotKind,
    outcomeKind: value.outcomeKind,
    ...(value.updatedEmotionalState === undefined
      ? {}
      : { updatedEmotionalState: value.updatedEmotionalState }),
    ...(value.pivotTimeSeconds === undefined
      ? {}
      : { pivotTimeSeconds: value.pivotTimeSeconds })
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpInputError("Request body must be valid JSON.");
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpInputError) {
    return json({ kind: "invalid-request", message: error.message }, 400);
  }

  if (error instanceof AuthenticationError) {
    return json({ kind: "unauthorized", message: error.message }, error.status);
  }

  if (error instanceof AuthConfigurationError) {
    return json({ kind: "server-error", message: "Authentication is not configured." }, 500);
  }

  return json({ kind: "server-error", message: "The request could not be completed." }, 500);
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

class HttpInputError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmotionalState(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export type { InspectableMemory };

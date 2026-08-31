import { FirebaseAuthenticationError } from "./firebase-auth";
import {
  type GooglePivotCommand,
  type GooglePivotGenerator,
  type SituationMap
} from "../app/google-pivot-protocol";
import { MAX_GOOGLE_IMAGE_BYTES } from "../app/google-image-artifact";
import {
  MAX_GOOGLE_ARTIFACT_BYTES,
  MAX_GOOGLE_ARTIFACT_TOTAL_BYTES,
  type GoogleSupportingArtifactInput
} from "../app/google-supporting-artifacts";
import type { GoogleImageArtifactInput } from "../app/google-image-artifact";
import {
  runGoogleProtocolCommand,
  type GoogleProtocolRepository,
  type GoogleProtocolDependencies
} from "./google-protocol";
import { correlationIdForGoogleRequest, type GoogleTelemetryLogger } from "./google-telemetry";

type Authenticate = (request: Request) => Promise<{ subject: string }>;
type GooglePivotHttpOptions = {
  quota?: GoogleProtocolDependencies["quota"];
  logger?: GoogleTelemetryLogger;
};

const MAX_GOOGLE_MULTIPART_BODY_BYTES = MAX_GOOGLE_ARTIFACT_TOTAL_BYTES + 512 * 1024;

export async function handleGooglePivotPost(
  request: Request,
  authenticate: Authenticate,
  repository: GoogleProtocolRepository,
  generator?: GooglePivotGenerator,
  adaptation?: GoogleProtocolDependencies["adaptation"],
  options?: GooglePivotHttpOptions
): Promise<Response> {
  return handleGooglePivotCommandPost(request, authenticate, repository, generator, adaptation, options, "protocol");
}

export async function handleGooglePivotOutcomePost(
  request: Request,
  authenticate: Authenticate,
  repository: GoogleProtocolRepository,
  generator?: GooglePivotGenerator,
  adaptation?: GoogleProtocolDependencies["adaptation"],
  options?: GooglePivotHttpOptions
): Promise<Response> {
  return handleGooglePivotCommandPost(request, authenticate, repository, generator, adaptation, options, "outcome");
}

async function handleGooglePivotCommandPost(
  request: Request,
  authenticate: Authenticate,
  repository: GoogleProtocolRepository,
  generator: GooglePivotGenerator | undefined,
  adaptation: GoogleProtocolDependencies["adaptation"],
  options: GooglePivotHttpOptions | undefined,
  route: "protocol" | "outcome"
): Promise<Response> {
  const correlationId = correlationIdForGoogleRequest(request.headers.get("x-correlation-id"));
  const startedAt = Date.now();
  let ownerSubject: string | undefined;
  let protocolId: string | undefined;
  const respond = (value: unknown, status: number, telemetry: { status: Parameters<GoogleTelemetryLogger["record"]>[0]["status"]; fallbackKind?: string; resultCount?: number }) => {
    try {
      options?.logger?.record({
        correlationId,
        protocolId,
        ownerSubject,
        event: `google-pivot-${route}`,
        tool: "google-pivot-protocol",
        status: telemetry.status,
        latencyMs: Date.now() - startedAt,
        modelId: process.env.VERTEX_GEMINI_MODEL_ID?.trim() || "gemini-3.5-flash",
        retryCount: 0,
        fallbackKind: telemetry.fallbackKind,
        resultCount: telemetry.resultCount
      });
    } catch {
      // Observability is best-effort and must never change the protocol response.
    }
    return json(value, status, correlationId);
  };
  try {
    const identity = await authenticate(request);
    ownerSubject = identity.subject;
    const body = await readBody(request);
    const input = parseInput(body, request, route);
    protocolId = input.protocolId;
    const result = await runGoogleProtocolCommand(
      {
        subject: identity.subject,
        protocolId: input.protocolId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        command: input.command
      },
      { repository, adaptation, quota: options?.quota },
      generator
    );
    if (result.kind === "state") {
      return respond(result.state, 200, {
        status: result.state.fallback ? "fallback" : "ok",
        fallbackKind: result.state.fallback ? "curated-state" : undefined,
        resultCount: result.state.retrievedMemories.length + result.state.artifacts.length
      });
    }
    if (result.kind === "not-found") {
      return respond({ kind: "not-found", message: "The private protocol was not found." }, 404, { status: "invalid" });
    }
    if (result.kind === "consent-required") {
      return respond(result, 400, { status: "invalid" });
    }
    if (result.kind === "safety-interruption") {
      return respond(result.result, 200, { status: "fallback", fallbackKind: "safety-interruption" });
    }
    if (result.kind === "quota-exhausted") {
      return respond(result, 429, { status: "quota-exhausted", fallbackKind: "quota-exhausted" });
    }
    if (result.kind === "dependency-unavailable") {
      return respond(result.state ?? result, result.state ? 200 : 503, {
        status: "fallback",
        fallbackKind: "dependency-unavailable",
        resultCount: result.state ? result.state.retrievedMemories.length + result.state.artifacts.length : undefined
      });
    }
    if (result.kind === "conflict") {
      return respond({
        kind: "conflict",
        message: "This Situation map changed in another session. Reload it before editing again.",
        protocol: result.protocol
      }, 409, { status: "conflict" });
    }
    if (result.kind === "idempotency-conflict") {
      return respond({
        kind: "idempotency-conflict",
        message: "This idempotency key was already used for a different command.",
        protocol: result.protocol
      }, 409, { status: "conflict" });
    }
    return respond(result, 400, { status: "invalid" });
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return respond(
        { kind: "unauthorized", message: "You need to sign in to use the Pivot Protocol." },
        401,
        { status: "unauthorized" }
      );
    }

    if (error instanceof HttpInputError) {
      return respond({ kind: "invalid-request", message: error.message }, 400, { status: "invalid" });
    }

    return respond({ kind: "server-error", message: "The Pivot Protocol is temporarily unavailable." }, 500, { status: "error", fallbackKind: "dependency-unavailable" });
  }
}

function parseInput(value: unknown, request: Request, route: "protocol" | "outcome"): {
  protocolId: string;
  expectedVersion: number;
  idempotencyKey: string;
  command: GooglePivotCommand;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpInputError("A valid Pivot Protocol command is required.");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.protocolId !== "string" || !body.protocolId.trim()) {
    throw new HttpInputError("A protocol identifier is required.");
  }
  const headerVersion = request.headers.get("if-match")?.replace(/^"|"$/g, "");
  const expectedVersion = body.expectedVersion ?? (headerVersion === undefined ? undefined : Number(headerVersion));
  if (expectedVersion === undefined) {
    throw new HttpInputError("An expected protocol version is required for state-changing commands.");
  }
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new HttpInputError("An expected protocol version is required.");
  }
  const idempotencyKey = typeof body.idempotencyKey === "string"
    ? body.idempotencyKey.trim()
    : request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey !== undefined && (!idempotencyKey || idempotencyKey.length > 200)) {
    throw new HttpInputError("The idempotency key is invalid.");
  }
  if (!idempotencyKey) {
    throw new HttpInputError("An idempotency key is required for state-changing commands.");
  }

  const command = parseCommand(body);
  if (route === "outcome" && command.type !== "record-outcome" && command.type !== "confirm-action" && command.type !== "cancel-confirmation") {
    throw new HttpInputError("Only outcome commands are accepted on this route.");
  }
  if (route === "protocol" && command.type === "record-outcome") {
    throw new HttpInputError("Outcome commands must use the dedicated outcome route.");
  }

  return {
    protocolId: body.protocolId.trim(),
    expectedVersion,
    idempotencyKey,
    command
  };
}

function parseCommand(body: Record<string, unknown>): GooglePivotCommand {
  const type = body.type;
  if (type === undefined) {
    return parseStartCommand(body);
  }

  if (typeof type !== "string") {
    throw new HttpInputError("The Pivot Protocol command is invalid.");
  }
  switch (type) {
    case "start":
      return parseStartCommand(body);
    case "add-image":
      return { type, image: parseImageInput(body.image) };
    case "remove-artifact":
      if (typeof body.artifactId !== "string" || !body.artifactId.trim()) throw new HttpInputError("An artifact identifier is required.");
      return { type, artifactId: body.artifactId.trim() };
    case "add-artifact":
      return { type, artifact: parseSupportingArtifactInput(body.artifact) };
    case "add-artifacts":
      return { type, artifacts: parseSupportingArtifactsInput(body.artifacts) };
    case "add-context":
      if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 10_000) {
        throw new HttpInputError("A context message is required and must be 10,000 characters or smaller.");
      }
      return { type, message: body.message };
    case "approve-artifact-claim":
      if (typeof body.itemId !== "string" || !body.itemId.trim()) throw new HttpInputError("An artifact claim identifier is required.");
      return { type, itemId: body.itemId.trim() };
    case "answer-clarification":
      if (typeof body.questionId !== "string" || typeof body.answer !== "string" || body.answer.length > 10_000) {
        throw new HttpInputError("A clarification question and answer are required and the answer must be 10,000 characters or smaller.");
      }
      return { type, questionId: body.questionId.trim(), answer: body.answer };
    case "skip-clarification":
      if (typeof body.questionId !== "string") throw new HttpInputError("A clarification question is required.");
      return { type, questionId: body.questionId.trim() };
    case "correct-map":
      if (!isSituationMapSection(body.section) || typeof body.itemId !== "string" || typeof body.text !== "string" || body.text.length > 10_000) {
        throw new HttpInputError("A Situation-map correction is invalid and must be 10,000 characters or smaller.");
      }
      return { type, section: body.section, itemId: body.itemId.trim(), text: body.text };
    case "resolve-contradiction":
      if (typeof body.itemId !== "string" || !body.itemId.trim()) throw new HttpInputError("A contradiction identifier is required.");
      return { type, itemId: body.itemId.trim() };
    case "select-pivot":
      if (typeof body.pivotKind !== "string") throw new HttpInputError("A Pivot selection is required.");
      return { type, pivotKind: body.pivotKind };
    case "record-step-feedback":
      if (!isPivotStepFeedback(body.feedback)) throw new HttpInputError("The Pivot step feedback is invalid.");
      return { type, feedback: body.feedback };
    case "shrink-action":
    case "request-discard":
      return { type };
    case "undo-update":
      if (typeof body.updateId !== "string" || !body.updateId.trim()) throw new HttpInputError("A reversible update identifier is required.");
      return { type, updateId: body.updateId.trim() };
    case "confirm-action":
    case "cancel-confirmation":
      if (typeof body.confirmationId !== "string" || !body.confirmationId.trim()) throw new HttpInputError("A confirmation identifier is required.");
      return { type, confirmationId: body.confirmationId.trim() };
    case "regenerate-pivot":
    case "dismiss-pivot":
      return { type };
    case "exclude-memory":
    case "forget-memory":
    case "delete-memory":
      if (typeof body.memoryId !== "string" || !body.memoryId.trim()) throw new HttpInputError("A memory identifier is required.");
      return { type, memoryId: body.memoryId.trim() };
    case "record-outcome":
      if (!isPivotOutcome(body.outcome)) throw new HttpInputError("The Pivot outcome is invalid.");
      return { type, outcome: body.outcome };
    default:
      throw new HttpInputError("The Pivot Protocol command is invalid.");
  }
}

function parseStartCommand(body: Record<string, unknown>): Extract<GooglePivotCommand, { type: "start" }> {
  if (typeof body.quickDump !== "string" || !body.quickDump.trim() || body.quickDump.length > 10_000 || typeof body.consentGiven !== "boolean") {
    throw new HttpInputError("A Quick dump and processing consent are required.");
  }
  if (body.saveRequested !== undefined && typeof body.saveRequested !== "boolean") {
    throw new HttpInputError("The save choice must be yes or no.");
  }
  return {
    type: "start",
    quickDump: body.quickDump.trim(),
    consentGiven: body.consentGiven,
    saveRequested: body.saveRequested ?? false,
    ...(body.image === undefined ? {} : { image: parseImageInput(body.image) }),
    ...(body.artifacts === undefined ? {} : { artifacts: parseSupportingArtifactsInput(body.artifacts) })
  };
}

function parseSupportingArtifactsInput(value: unknown): GoogleSupportingArtifactInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpInputError("At least one supporting artifact is required.");
  }
  return value.map(parseSupportingArtifactInput);
}

function parseSupportingArtifactInput(value: unknown): GoogleSupportingArtifactInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpInputError("A supporting artifact upload is required.");
  }
  const artifact = value as Record<string, unknown>;
  if (artifact.bytes instanceof Uint8Array) {
    if (artifact.bytes.length === 0 || artifact.bytes.length > MAX_GOOGLE_ARTIFACT_BYTES) {
      throw new HttpInputError("A supporting artifact must be non-empty and 10 MB or smaller.");
    }
    const declaredMimeType = typeof artifact.declaredMimeType === "string"
      ? artifact.declaredMimeType
      : typeof artifact.mimeType === "string" ? artifact.mimeType : undefined;
    return { bytes: artifact.bytes, ...(declaredMimeType ? { declaredMimeType } : {}) };
  }
  const base64 = artifact.base64 ?? artifact.data;
  if (
    typeof base64 !== "string" ||
    !base64 ||
    base64.length > Math.ceil(MAX_GOOGLE_ARTIFACT_BYTES * 4 / 3) + 4 ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new HttpInputError("The supporting artifact upload is malformed.");
  }
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  if (bytes.length === 0 || bytes.length > MAX_GOOGLE_ARTIFACT_BYTES) {
    throw new HttpInputError("A supporting artifact must be non-empty and 10 MB or smaller.");
  }
  return {
    bytes,
    ...(typeof artifact.mimeType === "string" ? { declaredMimeType: artifact.mimeType } : {})
  };
}

function parseImageInput(value: unknown): GoogleImageArtifactInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpInputError("An image upload is required.");
  }
  let parsed: GoogleSupportingArtifactInput;
  try {
    parsed = parseSupportingArtifactInput(value);
  } catch (error) {
    if (error instanceof HttpInputError && error.message.includes("malformed")) {
      throw new HttpInputError("The image upload is malformed.");
    }
    throw error;
  }
  if (parsed.bytes.length > MAX_GOOGLE_IMAGE_BYTES) {
    throw new HttpInputError("The image upload is empty or larger than the 10 MB limit.");
  }
  return parsed;
}

function isSituationMapSection(value: unknown): value is keyof SituationMap {
  return ["shared", "artifactClaims", "interpretations", "uncertainties", "contradictions", "constraints", "progress", "pivotHistory", "priorPatterns"].includes(value as string);
}

function isPivotOutcome(value: unknown): value is Extract<GooglePivotCommand, { type: "record-outcome" }>["outcome"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const outcome = value as Record<string, unknown>;
  if (Object.keys(outcome).some((key) => !["status", "agencyShift", "pivotTimeSeconds"].includes(key))) return false;
  return ["completed", "partly-helpful", "not-a-fit", "skipped"].includes(outcome.status as string) &&
    (outcome.agencyShift === undefined || ["more-able", "about-as-able", "less-able"].includes(outcome.agencyShift as string)) &&
    (outcome.pivotTimeSeconds === undefined || typeof outcome.pivotTimeSeconds === "number");
}

function isPivotStepFeedback(value: unknown): value is Extract<GooglePivotCommand, { type: "record-step-feedback" }>["feedback"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const feedback = value as Record<string, unknown>;
  return Object.keys(feedback).every((key) => ["status", "note"].includes(key)) &&
    ["completed", "partly-helpful", "not-a-fit", "skipped", "blocked"].includes(feedback.status as string) &&
    (feedback.note === undefined || (typeof feedback.note === "string" && feedback.note.trim().length <= 500));
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_GOOGLE_MULTIPART_BODY_BYTES)) {
      throw new HttpInputError("The supporting artifact upload is too large.");
    }
    try {
      const limitedBody = request.body && boundedRequestBody(request.body, MAX_GOOGLE_MULTIPART_BODY_BYTES);
      if (!limitedBody) throw new HttpInputError("The supporting artifact upload is malformed.");
      const form = await new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: limitedBody,
        duplex: "half"
      } as RequestInit).formData();
      const body: Record<string, unknown> = {};
      const artifacts: GoogleSupportingArtifactInput[] = [];
      for (const [key, value] of form.entries()) {
        if ((key === "artifact" || key === "artifacts") && value instanceof File) {
          artifacts.push({
            bytes: new Uint8Array(await value.arrayBuffer()),
            declaredMimeType: value.type || undefined
          });
        } else if (key === "image" && value instanceof File) {
          body.image = {
            bytes: new Uint8Array(await value.arrayBuffer()),
            declaredMimeType: value.type || undefined
          };
        } else if (typeof value === "string") {
          body[key] = value;
        }
      }
      if (artifacts.length > 0) body.artifacts = artifacts;
      if (typeof body.consentGiven === "string") body.consentGiven = body.consentGiven === "true";
      if (typeof body.saveRequested === "string") body.saveRequested = body.saveRequested === "true";
      if (typeof body.expectedVersion === "string") body.expectedVersion = Number(body.expectedVersion);
      return body;
    } catch (error) {
      if (error instanceof HttpInputError) throw error;
      throw new HttpInputError("The image upload is malformed.");
    }
  }
  try {
    return await request.json();
  } catch {
    throw new HttpInputError("Request body must be valid JSON.");
  }
}

function boundedRequestBody(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let totalBytes = 0;
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        controller.error(new HttpInputError("The supporting artifact upload is too large."));
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    }
  });
}

function json(value: unknown, status: number, correlationId?: string): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (correlationId) headers.set("x-correlation-id", correlationId);
  return new Response(JSON.stringify(value), {
    status,
    headers
  });
}

class HttpInputError extends Error {}

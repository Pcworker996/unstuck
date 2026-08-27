import { FirebaseAuthenticationError } from "./firebase-auth";
import {
  runGooglePivotProtocol,
  type GooglePivotCommand,
  type GooglePivotGenerator,
  type SituationMap
} from "../app/google-pivot-protocol";
import {
  runGoogleProtocolCommand,
  type GoogleProtocolRepository
} from "./google-protocol";

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
    const input = parseInput(body, request);
    if (input.command.type === "start") {
      const safetyResult = await runGooglePivotProtocol({
        quickDump: input.command.quickDump,
        consentGiven: false
      });
      if (safetyResult.kind === "safety-interruption") {
        return json(safetyResult, 200);
      }
    }
    const result = await runGoogleProtocolCommand(
      {
        subject: identity.subject,
        protocolId: input.protocolId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        command: input.command
      },
      { repository },
      generator
    );
    if (result.kind === "state") {
      return json(result.state, 200);
    }
    if (result.kind === "not-found") {
      return json({ kind: "not-found", message: "The private protocol was not found." }, 404);
    }
    if (result.kind === "consent-required") {
      return json(result, 400);
    }
    if (result.kind === "safety-interruption") {
      return json(result.result, 200);
    }
    if (result.kind === "conflict") {
      return json({
        kind: "conflict",
        message: "This Situation map changed in another session. Reload it before editing again.",
        protocol: result.protocol
      }, 409);
    }
    return json(result, 400);
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

function parseInput(value: unknown, request: Request): {
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
    if (typeof body.quickDump !== "string" || !body.quickDump.trim() || body.quickDump.length > 10_000 || typeof body.consentGiven !== "boolean") {
      throw new HttpInputError("A Quick dump and processing consent are required.");
    }
    return { type: "start", quickDump: body.quickDump.trim(), consentGiven: body.consentGiven };
  }

  if (typeof type !== "string") {
    throw new HttpInputError("The Pivot Protocol command is invalid.");
  }
  switch (type) {
    case "start":
      if (typeof body.quickDump !== "string" || !body.quickDump.trim() || body.quickDump.length > 10_000 || typeof body.consentGiven !== "boolean") {
        throw new HttpInputError("A Quick dump and processing consent are required.");
      }
      return { type, quickDump: body.quickDump.trim(), consentGiven: body.consentGiven };
    case "answer-clarification":
      if (typeof body.questionId !== "string" || typeof body.answer !== "string") throw new HttpInputError("A clarification question and answer are required.");
      return { type, questionId: body.questionId.trim(), answer: body.answer };
    case "skip-clarification":
      if (typeof body.questionId !== "string") throw new HttpInputError("A clarification question is required.");
      return { type, questionId: body.questionId.trim() };
    case "correct-map":
      if (!isSituationMapSection(body.section) || typeof body.itemId !== "string" || typeof body.text !== "string") throw new HttpInputError("A Situation-map correction is invalid.");
      return { type, section: body.section, itemId: body.itemId.trim(), text: body.text };
    case "resolve-contradiction":
      if (typeof body.itemId !== "string" || !body.itemId.trim()) throw new HttpInputError("A contradiction identifier is required.");
      return { type, itemId: body.itemId.trim() };
    case "select-pivot":
      if (typeof body.pivotKind !== "string") throw new HttpInputError("A Pivot selection is required.");
      return { type, pivotKind: body.pivotKind };
    case "regenerate-pivot":
    case "dismiss-pivot":
      return { type };
    case "record-outcome":
      if (!isPivotOutcome(body.outcome)) throw new HttpInputError("The Pivot outcome is invalid.");
      return { type, outcome: body.outcome };
    default:
      throw new HttpInputError("The Pivot Protocol command is invalid.");
  }
}

function isSituationMapSection(value: unknown): value is keyof SituationMap {
  return ["shared", "artifactClaims", "interpretations", "uncertainties", "contradictions", "constraints", "progress", "pivotHistory", "priorPatterns"].includes(value as string);
}

function isPivotOutcome(value: unknown): value is Extract<GooglePivotCommand, { type: "record-outcome" }>["outcome"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const outcome = value as Record<string, unknown>;
  return ["completed", "partly-helpful", "not-a-fit", "skipped"].includes(outcome.status as string) &&
    (outcome.agencyShift === undefined || ["more-able", "about-as-able", "less-able"].includes(outcome.agencyShift as string)) &&
    (outcome.pivotTimeSeconds === undefined || typeof outcome.pivotTimeSeconds === "number");
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

import { createHash } from "node:crypto";
import {
  runGooglePivotCommand,
  type GooglePivotCommand,
  type GooglePivotCommandResult,
  type GooglePivotGenerator,
  type GooglePivotResult,
  googlePivotSafetyResult
} from "../app/google-pivot-protocol";
import type { GooglePivotAdaptation } from "../app/google-pivot-protocol";
import type { GoogleMemoryRepository } from "./google-memory";
import type { GooglePdfTemporaryStorage } from "../app/google-supporting-artifacts";
import type { GoogleQuotaService } from "./google-quotas";
import type { GoogleTelemetryLogger } from "./google-telemetry";

export type GoogleProtocol = {
  id: string;
  version: number;
  createdAt: string;
  pivotState?: unknown;
};

type StoredGoogleProtocol = GoogleProtocol & {
  ownerSubject: string;
  idempotency?: Record<string, { version: number; state: unknown; fingerprint?: string }>;
};

type IdempotencyLookup =
  | { kind: "match"; protocol: StoredGoogleProtocol }
  | { kind: "conflict"; protocol: StoredGoogleProtocol };

export type GoogleProtocolMutation =
  | { kind: "saved"; protocol: GoogleProtocol }
  | { kind: "conflict"; protocol: GoogleProtocol }
  | { kind: "idempotent"; protocol: GoogleProtocol }
  | { kind: "idempotency-conflict"; protocol: GoogleProtocol };

export type GoogleProtocolRepository = {
  create: (protocol: StoredGoogleProtocol) => Promise<void>;
  findFirstForOwner: (ownerSubject: string) => Promise<StoredGoogleProtocol | undefined>;
  findByIdForOwner: (input: {
    protocolId: string;
    ownerSubject: string;
  }) => Promise<StoredGoogleProtocol | undefined>;
  listSavedForOwner: (ownerSubject: string) => Promise<StoredGoogleProtocol[]>;
  delete: (input: { protocolId: string; ownerSubject: string }) => Promise<boolean>;
  saveState: (input: {
    protocolId: string;
    ownerSubject: string;
    expectedVersion: number;
    idempotencyKey: string;
    fingerprint: string;
    state: unknown;
  }) => Promise<GoogleProtocolMutation>;
  findIdempotent: (input: {
    protocolId: string;
    ownerSubject: string;
    idempotencyKey: string;
    fingerprint: string;
  }) => Promise<IdempotencyLookup | undefined>;
};

export type GoogleProtocolDependencies = {
  repository: GoogleProtocolRepository;
  createId: () => string;
  now: () => string;
  adaptation?: {
    memoryRepository: GoogleMemoryRepository;
    embed: (text: string) => Promise<readonly number[]>;
    threshold?: number;
    limit?: number;
  };
  artifactStorage?: GooglePdfTemporaryStorage;
  quota?: GoogleQuotaService;
  logger?: GoogleTelemetryLogger;
};

export type GoogleProtocolResult =
  | { kind: "protocol"; protocol: GoogleProtocol }
  | { kind: "not-found" };

export type GoogleProtocolCommandResult =
  | { kind: "state"; state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>; replayed: boolean }
  | { kind: "not-found" }
  | { kind: "conflict"; protocol: GoogleProtocol }
  | { kind: "idempotency-conflict"; protocol: GoogleProtocol }
  | { kind: "consent-required" }
  | { kind: "safety-interruption"; result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }
  | { kind: "invalid-command"; message: string }
  | { kind: "quota-exhausted"; message: string; resource: "model" | "artifact"; state?: Extract<GooglePivotResult, { kind: "pivot-protocol" }>; quickDump?: string }
  | { kind: "dependency-unavailable"; message: string; state?: Extract<GooglePivotResult, { kind: "pivot-protocol" }>; quickDump?: string };

export async function startGoogleProtocol(
  input: { subject: string },
  dependencies: GoogleProtocolDependencies
): Promise<GoogleProtocolResult> {
  const storedProtocol: StoredGoogleProtocol = {
    id: dependencies.createId(),
    version: 0,
    createdAt: dependencies.now(),
    ownerSubject: input.subject
  };

  await dependencies.repository.create(storedProtocol);
  return { kind: "protocol", protocol: visibleProtocol(storedProtocol) };
}

export async function loadGoogleProtocol(
  input: { subject: string; protocolId: string },
  dependencies: Pick<GoogleProtocolDependencies, "repository">
): Promise<GoogleProtocolResult> {
  const storedProtocol = await dependencies.repository.findByIdForOwner({
    protocolId: input.protocolId,
    ownerSubject: input.subject
  });

  return storedProtocol
    ? { kind: "protocol", protocol: visibleProtocol(storedProtocol) }
    : { kind: "not-found" };
}

export async function findFirstGoogleProtocol(
  input: { subject: string },
  dependencies: Pick<GoogleProtocolDependencies, "repository">
): Promise<GoogleProtocolResult> {
  const storedProtocol = await dependencies.repository.findFirstForOwner(input.subject);

  return storedProtocol
    ? { kind: "protocol", protocol: visibleProtocol(storedProtocol) }
    : { kind: "not-found" };
}

export async function listGoogleSavedProtocols(
  input: { subject: string },
  dependencies: Pick<GoogleProtocolDependencies, "repository">
): Promise<{ kind: "protocols"; protocols: GoogleProtocol[] }> {
  const protocols = await dependencies.repository.listSavedForOwner(input.subject);
  return { kind: "protocols", protocols: protocols.map(visibleProtocol) };
}

export async function deleteGoogleSavedProtocol(
  input: { subject: string; protocolId: string },
  dependencies: Pick<GoogleProtocolDependencies, "repository" | "adaptation">
): Promise<{ kind: "deleted"; protocolId: string } | { kind: "not-found" }> {
  const deleted = await dependencies.repository.delete({
    protocolId: input.protocolId,
    ownerSubject: input.subject
  });
  if (!deleted) return { kind: "not-found" };
  if (dependencies.adaptation) {
    await dependencies.adaptation.memoryRepository.deleteMemory({
      ownerSubject: input.subject,
      memoryId: input.protocolId
    });
  }
  return { kind: "deleted", protocolId: input.protocolId };
}

export async function runGoogleProtocolCommand(
  input: {
    subject: string;
    protocolId: string;
    expectedVersion: number;
    idempotencyKey: string;
    command: GooglePivotCommand;
  },
  dependencies: Pick<GoogleProtocolDependencies, "repository" | "adaptation"> & Partial<Pick<GoogleProtocolDependencies, "quota" | "now">>,
  generator?: GooglePivotGenerator
): Promise<GoogleProtocolCommandResult> {
  if (input.command.type === "start") {
    const safetyResult = googlePivotSafetyResult(input.command.quickDump);
    if (safetyResult) return { kind: "safety-interruption", result: safetyResult };
  }

  let existing: StoredGoogleProtocol | undefined;
  try {
    existing = await dependencies.repository.findByIdForOwner({
      protocolId: input.protocolId,
      ownerSubject: input.subject
    });
  } catch {
    return {
      kind: "dependency-unavailable",
      message: "The private protocol store is temporarily unavailable; your Quick dump was not processed.",
      ...(input.command.type === "start" ? { quickDump: input.command.quickDump } : {})
    };
  }
  if (!existing) {
    return { kind: "not-found" };
  }

  let replay: IdempotencyLookup | undefined;
  try {
    replay = await dependencies.repository.findIdempotent({
      protocolId: input.protocolId,
      ownerSubject: input.subject,
      idempotencyKey: input.idempotencyKey,
      fingerprint: commandFingerprint(input.command)
    });
  } catch {
    return {
      kind: "dependency-unavailable",
      message: "The private protocol store is temporarily unavailable; your valid state was preserved.",
      ...(currentState(existing) ? { state: currentState(existing) } : {})
    };
  }
  if (replay?.kind === "conflict") {
    return { kind: "idempotency-conflict", protocol: visibleProtocol(replay.protocol) };
  }
  if (replay?.kind === "match" && replay.protocol.pivotState && isPivotState(replay.protocol.pivotState)) {
    return { kind: "state", state: normalizePivotState(replay.protocol.pivotState), replayed: true };
  }

  if (existing.version !== input.expectedVersion) {
    return { kind: "conflict", protocol: visibleProtocol(existing) };
  }

  const current = existing.pivotState && isPivotState(existing.pivotState)
    ? normalizePivotState(existing.pivotState)
    : undefined;
  if (dependencies.quota) {
    const reservation = quotaReservation(input.command, current);
    try {
      const quota = await dependencies.quota.reserve({
        ownerSubject: input.subject,
        day: (dependencies.now?.() ?? new Date().toISOString()).slice(0, 10),
        reservationKey: `${input.protocolId}:${input.idempotencyKey}`,
        ...reservation
      });
      if (!quota.allowed) {
        return {
          kind: "quota-exhausted",
          message: quota.message,
          resource: quota.resource,
          ...(current ? { state: current } : {}),
          ...(input.command.type === "start" ? { quickDump: input.command.quickDump } : {})
        };
      }
    } catch {
      return {
        kind: "dependency-unavailable",
        message: "Quota controls are temporarily unavailable; your valid state was preserved.",
        ...(current ? { state: current } : {}),
        ...(input.command.type === "start" ? { quickDump: input.command.quickDump } : {})
      };
    }
  }
  const adaptation = dependencies.adaptation
    ? adaptationFor({ ...dependencies.adaptation, ownerSubject: input.subject })
    : undefined;
  let result: GooglePivotCommandResult = await runGooglePivotCommand(current, input.command, generator, adaptation);
  if (result.kind !== "ok") {
    return result;
  }

  if (dependencies.adaptation && result.state.phase === "outcome" && result.state.saveRequested) {
    result = { kind: "ok", state: await persistGoogleDerivedMemory(result.state, dependencies.adaptation.memoryRepository, dependencies.adaptation.embed, input.subject, input.protocolId) };
  }

  const nextState = { ...result.state, version: existing.version + 1 };
  let saved: GoogleProtocolMutation;
  try {
    saved = await dependencies.repository.saveState({
      protocolId: input.protocolId,
      ownerSubject: input.subject,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      fingerprint: commandFingerprint(input.command),
      state: nextState
    });
  } catch {
    if (nextState.derivedMemory && dependencies.adaptation) {
      await dependencies.adaptation.memoryRepository.deleteMemory({
        ownerSubject: input.subject,
        memoryId: input.protocolId
      }).catch(() => undefined);
    }
    return {
      kind: "dependency-unavailable",
      message: "The private protocol store is temporarily unavailable; your valid state was preserved for retry.",
      state: stateAfterPersistenceFailure(nextState)
    };
  }
  if (saved.kind === "conflict") {
    return { kind: "conflict", protocol: saved.protocol };
  }
  if (saved.kind === "idempotent" && saved.protocol.pivotState && isPivotState(saved.protocol.pivotState)) {
    return { kind: "state", state: normalizePivotState(saved.protocol.pivotState), replayed: true };
  }
  if (saved.kind === "idempotency-conflict") {
    return { kind: "idempotency-conflict", protocol: saved.protocol };
  }
  return { kind: "state", state: nextState, replayed: false };
}

function currentState(protocol: StoredGoogleProtocol): Extract<GooglePivotResult, { kind: "pivot-protocol" }> | undefined {
  return protocol.pivotState && isPivotState(protocol.pivotState)
    ? normalizePivotState(protocol.pivotState)
    : undefined;
}

function quotaReservation(command: GooglePivotCommand, current: Extract<GooglePivotResult, { kind: "pivot-protocol" }> | undefined): { modelUnits: number; artifactUnits: number } {
  if (command.type === "approve-artifact-claim" || command.type === "select-pivot" || command.type === "dismiss-pivot") {
    return { modelUnits: 0, artifactUnits: 0 };
  }
  if (command.type === "record-outcome") {
    return { modelUnits: current?.saveRequested ? 1 : 0, artifactUnits: 0 };
  }
  const artifactUnits = command.type === "start"
    ? (command.image ? 1 : 0) + (command.artifacts?.length ?? 0)
    : command.type === "add-image" ? 1 : command.type === "add-artifact" ? 1 : command.type === "add-artifacts" ? command.artifacts.length : 0;
  return { modelUnits: 1 + artifactUnits, artifactUnits };
}

function stateAfterPersistenceFailure(state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>): Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  return {
    ...state,
    persistence: state.persistence === "saved" ? "pending" : state.persistence,
    enrichment: "unavailable",
    derivedMemory: undefined,
    fallback: true,
    activity: [...state.activity, { kind: "fallback", message: "The private protocol store is temporarily unavailable; this valid state can be retried." }]
  };
}

function adaptationFor(input: {
  ownerSubject: string;
  memoryRepository: GoogleMemoryRepository;
  embed: (text: string) => Promise<readonly number[]>;
  threshold?: number;
  limit?: number;
}): GooglePivotAdaptation {
  return {
    ownerSubject: input.ownerSubject,
    embed: input.embed,
    threshold: input.threshold,
    limit: input.limit,
    retrieveSimilarMemories: (retrieval) => input.memoryRepository.retrieveSimilarMemories(retrieval),
    listGuidancePreferences: (ownerSubject) => input.memoryRepository.listGuidancePreferences(ownerSubject),
    excludeMemory: (memory) => input.memoryRepository.excludeMemory(memory),
    forgetMemory: (memory) => input.memoryRepository.forgetMemory(memory),
    deleteMemory: (memory) => input.memoryRepository.deleteMemory(memory)
  };
}

async function persistGoogleDerivedMemory(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  repository: GoogleMemoryRepository,
  embed: (text: string) => Promise<readonly number[]>,
  ownerSubject: string,
  protocolId: string
): Promise<Extract<GooglePivotResult, { kind: "pivot-protocol" }>> {
  if (state.enrichment !== "saved" || !state.derivedMemory || !state.selectedPivot || !state.outcome) {
    return {
      ...state,
      enrichment: "unavailable",
      derivedMemory: undefined,
      activity: [...state.activity, { kind: "fallback", message: "The outcome was saved, but its Derived memory could not be prepared." }]
    };
  }
  try {
    const saved = await repository.saveDerivedMemory({
      ownerSubject,
      protocolId,
      memoryId: protocolId,
      context: state.derivedMemory.context,
      embedding: await embed(state.derivedMemory.context),
      selectedPivotKind: state.selectedPivot.kind,
      selectedPivotTitle: state.selectedPivot.title,
      outcome: state.outcome,
      approved: true
    });
    return {
      ...state,
      enrichment: "saved",
      derivedMemory: { id: saved.id, context: saved.context, approved: true }
    };
  } catch {
    return {
      ...state,
      enrichment: "unavailable",
      derivedMemory: undefined,
      activity: [...state.activity, { kind: "fallback", message: "The outcome was saved, but adaptation is temporarily unavailable." }]
    };
  }
}

export function createInMemoryGoogleProtocolRepository(): GoogleProtocolRepository {
  const protocols = new Map<string, StoredGoogleProtocol>();

  return {
    async create(protocol) {
      protocols.set(protocol.id, protocol);
    },
    async findFirstForOwner(ownerSubject) {
      return [...protocols.values()].find((protocol) => protocol.ownerSubject === ownerSubject);
    },
    async findByIdForOwner({ protocolId, ownerSubject }) {
      const protocol = protocols.get(protocolId);
      return protocol?.ownerSubject === ownerSubject ? protocol : undefined;
    },
    async listSavedForOwner(ownerSubject) {
      return [...protocols.values()].filter((protocol) =>
        protocol.ownerSubject === ownerSubject &&
        isPivotState(protocol.pivotState) &&
        protocol.pivotState.persistence === "saved"
      );
    },
    async delete({ protocolId, ownerSubject }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject) return false;
      protocols.delete(protocolId);
      return true;
    },
    async findIdempotent({ protocolId, ownerSubject, idempotencyKey, fingerprint }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject) {
        return undefined;
      }
      const record = protocol.idempotency?.[idempotencyKey];
      if (!record) return undefined;
      const result = { ...protocol, version: record.version, pivotState: record.state };
      return record.fingerprint === fingerprint
        ? { kind: "match", protocol: result }
        : { kind: "conflict", protocol: result };
    },
    async saveState({ protocolId, ownerSubject, expectedVersion, idempotencyKey, fingerprint, state }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject) {
        throw new Error("Protocol not found for owner.");
      }
      const existingIdempotency = protocol.idempotency?.[idempotencyKey];
      if (existingIdempotency) {
        if (existingIdempotency.fingerprint !== fingerprint) {
          return {
            kind: "idempotency-conflict",
            protocol: visibleProtocol(protocol)
          };
        }
        return {
          kind: "idempotent",
          protocol: visibleProtocol({
            ...protocol,
            version: existingIdempotency.version,
            pivotState: existingIdempotency.state
          })
        };
      }
      if (protocol.version !== expectedVersion) {
        return { kind: "conflict", protocol: visibleProtocol(protocol) };
      }
      const next = {
        ...protocol,
        version: protocol.version + 1,
        pivotState: state,
        idempotency: {
          ...protocol.idempotency,
          [idempotencyKey]: { version: protocol.version + 1, state, fingerprint }
        }
      };
      protocols.set(protocolId, next);
      return { kind: "saved", protocol: visibleProtocol(next) };
    }
  };
}

function commandFingerprint(command: GooglePivotCommand): string {
  if (command.type === "start" && command.image) {
    return JSON.stringify({
      ...command,
      image: imageFingerprint(command.image.bytes, command.image.declaredMimeType),
      ...(command.artifacts ? { artifacts: command.artifacts.map((artifact) => imageFingerprint(artifact.bytes, artifact.declaredMimeType)) } : {})
    });
  }
  if (command.type === "start" && command.artifacts) {
    return JSON.stringify({
      ...command,
      artifacts: command.artifacts.map((artifact) => imageFingerprint(artifact.bytes, artifact.declaredMimeType))
    });
  }
  if (command.type === "add-image") {
    return JSON.stringify({ ...command, image: imageFingerprint(command.image.bytes, command.image.declaredMimeType) });
  }
  if (command.type === "add-artifact") {
    return JSON.stringify({ ...command, artifact: imageFingerprint(command.artifact.bytes, command.artifact.declaredMimeType) });
  }
  if (command.type === "add-artifacts") {
    return JSON.stringify({ ...command, artifacts: command.artifacts.map((artifact) => imageFingerprint(artifact.bytes, artifact.declaredMimeType)) });
  }
  return JSON.stringify(command);
}

function imageFingerprint(bytes: Uint8Array, declaredMimeType?: string): { sha256: string; declaredMimeType?: string } {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...(declaredMimeType ? { declaredMimeType } : {})
  };
}

function visibleProtocol(protocol: StoredGoogleProtocol): GoogleProtocol {
  return {
    id: protocol.id,
    version: protocol.version,
    createdAt: protocol.createdAt,
    pivotState: protocol.pivotState && isPivotState(protocol.pivotState)
      ? normalizePivotState(protocol.pivotState)
      : protocol.pivotState
  };
}

function isPivotState(value: unknown): value is Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "pivot-protocol" &&
    "version" in value &&
    typeof value.version === "number" &&
    "situationMap" in value
  );
}

function normalizePivotState(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  return {
    ...state,
    memoryExplanations: state.memoryExplanations ?? [],
    retrievedMemories: state.retrievedMemories ?? [],
    retrievalAttempted: state.retrievalAttempted ?? false,
    adaptationStatus: state.adaptationStatus ?? "not-requested",
    excludedMemoryIds: state.excludedMemoryIds ?? [],
    guidancePreferenceIds: state.guidancePreferenceIds ?? [],
    approvedArtifactClaimIds: state.approvedArtifactClaimIds ?? [],
    imageProcessing: state.imageProcessing ?? { status: "not-provided", message: "No image was added." },
    artifacts: state.artifacts ?? [],
    artifactBytes: state.artifactBytes ?? 0
  };
}

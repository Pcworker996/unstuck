import {
  runGooglePivotCommand,
  type GooglePivotCommand,
  type GooglePivotCommandResult,
  type GooglePivotGenerator,
  type GooglePivotResult
} from "../app/google-pivot-protocol";

export type GoogleProtocol = {
  id: string;
  version: number;
  createdAt: string;
  pivotState?: unknown;
};

type StoredGoogleProtocol = GoogleProtocol & {
  ownerSubject: string;
  pivotState?: unknown;
  idempotency?: Record<string, { version: number; state: unknown }>;
};

export type GoogleProtocolMutation =
  | { kind: "saved"; protocol: GoogleProtocol }
  | { kind: "conflict"; protocol: GoogleProtocol }
  | { kind: "idempotent"; protocol: GoogleProtocol };

export type GoogleProtocolRepository = {
  create: (protocol: StoredGoogleProtocol) => Promise<void>;
  findFirstForOwner: (ownerSubject: string) => Promise<StoredGoogleProtocol | undefined>;
  findByIdForOwner: (input: {
    protocolId: string;
    ownerSubject: string;
  }) => Promise<StoredGoogleProtocol | undefined>;
  saveState: (input: {
    protocolId: string;
    ownerSubject: string;
    expectedVersion: number;
    idempotencyKey: string;
    state: unknown;
  }) => Promise<GoogleProtocolMutation>;
  findIdempotent: (input: {
    protocolId: string;
    ownerSubject: string;
    idempotencyKey: string;
  }) => Promise<StoredGoogleProtocol | undefined>;
};

export type GoogleProtocolDependencies = {
  repository: GoogleProtocolRepository;
  createId: () => string;
  now: () => string;
};

export type GoogleProtocolResult =
  | { kind: "protocol"; protocol: GoogleProtocol }
  | { kind: "not-found" };

export type GoogleProtocolCommandResult =
  | { kind: "state"; state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>; replayed: boolean }
  | { kind: "not-found" }
  | { kind: "conflict"; protocol: GoogleProtocol }
  | { kind: "consent-required" }
  | { kind: "safety-interruption"; result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }
  | { kind: "invalid-command"; message: string };

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

export async function runGoogleProtocolCommand(
  input: {
    subject: string;
    protocolId: string;
    expectedVersion: number;
    idempotencyKey: string;
    command: GooglePivotCommand;
  },
  dependencies: Pick<GoogleProtocolDependencies, "repository">,
  generator?: GooglePivotGenerator
): Promise<GoogleProtocolCommandResult> {
  const existing = await dependencies.repository.findByIdForOwner({
    protocolId: input.protocolId,
    ownerSubject: input.subject
  });
  if (!existing) {
    return { kind: "not-found" };
  }

  const replay = await dependencies.repository.findIdempotent({
    protocolId: input.protocolId,
    ownerSubject: input.subject,
    idempotencyKey: input.idempotencyKey
  });
  if (replay?.pivotState && isPivotState(replay.pivotState)) {
    return { kind: "state", state: replay.pivotState, replayed: true };
  }

  if (existing.version !== input.expectedVersion) {
    return { kind: "conflict", protocol: visibleProtocol(existing) };
  }

  const current = existing.pivotState && isPivotState(existing.pivotState)
    ? existing.pivotState
    : undefined;
  const result: GooglePivotCommandResult = await runGooglePivotCommand(current, input.command, generator);
  if (result.kind !== "ok") {
    return result;
  }

  const nextState = { ...result.state, version: existing.version + 1 };
  const saved = await dependencies.repository.saveState({
    protocolId: input.protocolId,
    ownerSubject: input.subject,
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
    state: nextState
  });
  if (saved.kind === "conflict") {
    return { kind: "conflict", protocol: saved.protocol };
  }
  if (saved.kind === "idempotent" && saved.protocol.pivotState && isPivotState(saved.protocol.pivotState)) {
    return { kind: "state", state: saved.protocol.pivotState, replayed: true };
  }
  return { kind: "state", state: nextState, replayed: false };
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
    async findIdempotent({ protocolId, ownerSubject, idempotencyKey }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject || !protocol.idempotency?.[idempotencyKey]) {
        return undefined;
      }
      const record = protocol.idempotency[idempotencyKey];
      return { ...protocol, version: record.version, pivotState: record.state };
    },
    async saveState({ protocolId, ownerSubject, expectedVersion, idempotencyKey, state }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject) {
        throw new Error("Protocol not found for owner.");
      }
      const existingIdempotency = protocol.idempotency?.[idempotencyKey];
      if (existingIdempotency) {
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
          [idempotencyKey]: { version: protocol.version + 1, state }
        }
      };
      protocols.set(protocolId, next);
      return { kind: "saved", protocol: visibleProtocol(next) };
    }
  };
}

function visibleProtocol(protocol: StoredGoogleProtocol): GoogleProtocol {
  return {
    id: protocol.id,
    version: protocol.version,
    createdAt: protocol.createdAt,
    pivotState: protocol.pivotState
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
    "situationMap" in value &&
    "recommendation" in value
  );
}

export type GoogleProtocol = {
  id: string;
  version: number;
  createdAt: string;
  pivotState?: unknown;
};

type StoredGoogleProtocol = GoogleProtocol & {
  ownerSubject: string;
  pivotState?: unknown;
};

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
    state: unknown;
  }) => Promise<void>;
};

export type GoogleProtocolDependencies = {
  repository: GoogleProtocolRepository;
  createId: () => string;
  now: () => string;
};

export type GoogleProtocolResult =
  | { kind: "protocol"; protocol: GoogleProtocol }
  | { kind: "not-found" };

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
    async saveState({ protocolId, ownerSubject, state }) {
      const protocol = protocols.get(protocolId);
      if (!protocol || protocol.ownerSubject !== ownerSubject) {
        throw new Error("Protocol not found for owner.");
      }
      protocols.set(protocolId, { ...protocol, pivotState: state });
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

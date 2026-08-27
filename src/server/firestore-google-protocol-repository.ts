import type { Firestore } from "firebase-admin/firestore";

import type { GoogleProtocolRepository } from "./google-protocol";

const ACCOUNTS_COLLECTION = "personalAccounts";
const PROTOCOLS_COLLECTION = "protocols";

export function createFirestoreGoogleProtocolRepository(
  firestore: Firestore
): GoogleProtocolRepository {
  return {
    async create(protocol) {
      await protocolDocument(firestore, protocol.ownerSubject, protocol.id).set({
        version: protocol.version,
        createdAt: protocol.createdAt
      });
    },
    async findFirstForOwner(ownerSubject) {
      const snapshot = await firestore
        .collection(ACCOUNTS_COLLECTION)
        .doc(ownerSubject)
        .collection(PROTOCOLS_COLLECTION)
        .get();
      const document = snapshot.docs[0];
      if (!document) {
        return undefined;
      }

      const value = document.data();
      if (!isStoredProtocol(value)) {
        return undefined;
      }

      return {
        id: document.id,
        ownerSubject,
        version: value.version,
        createdAt: value.createdAt,
        pivotState: value.pivotState
      };
    },
    async findByIdForOwner({ protocolId, ownerSubject }) {
      const snapshot = await protocolDocument(firestore, ownerSubject, protocolId).get();
      if (!snapshot.exists) {
        return undefined;
      }

      const value = snapshot.data();
      if (!isStoredProtocol(value)) {
        return undefined;
      }

      return {
        id: protocolId,
        ownerSubject,
        version: value.version,
        createdAt: value.createdAt,
        pivotState: value.pivotState
      };
    },
    async findIdempotent({ protocolId, ownerSubject, idempotencyKey }) {
      const snapshot = await protocolDocument(firestore, ownerSubject, protocolId).get();
      if (!snapshot.exists) {
        return undefined;
      }
      const value = snapshot.data();
      if (!isStoredProtocol(value) || !isIdempotencyRecord(value.idempotency?.[idempotencyKey])) {
        return undefined;
      }
      const record = value.idempotency[idempotencyKey];
      return {
        id: protocolId,
        ownerSubject,
        version: record.version,
        createdAt: value.createdAt,
        pivotState: record.state
      };
    },
    async saveState({ protocolId, ownerSubject, expectedVersion, idempotencyKey, state }) {
      const reference = protocolDocument(firestore, ownerSubject, protocolId);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) {
          throw new Error("Protocol not found for owner.");
        }
        const value = snapshot.data();
        if (!isStoredProtocol(value)) {
          throw new Error("Stored protocol is invalid.");
        }

        const existingIdempotency = value.idempotency?.[idempotencyKey];
        const current = {
          id: protocolId,
          ownerSubject,
          version: value.version,
          createdAt: value.createdAt,
          pivotState: value.pivotState
        };
        if (isIdempotencyRecord(existingIdempotency)) {
          return {
            kind: "idempotent" as const,
            protocol: {
              ...current,
              version: existingIdempotency.version,
              pivotState: existingIdempotency.state
            }
          };
        }
        if (value.version !== expectedVersion) {
          return { kind: "conflict" as const, protocol: current };
        }

        const nextVersion = value.version + 1;
        transaction.set(reference, {
          version: nextVersion,
          pivotState: state,
          idempotency: {
            ...(value.idempotency ?? {}),
            [idempotencyKey]: { version: nextVersion, state }
          }
        }, { merge: true });
        return {
          kind: "saved" as const,
          protocol: { ...current, version: nextVersion, pivotState: state }
        };
      });
    }
  };
}

function protocolDocument(firestore: Firestore, ownerSubject: string, protocolId: string) {
  return firestore
    .collection(ACCOUNTS_COLLECTION)
    .doc(ownerSubject)
    .collection(PROTOCOLS_COLLECTION)
    .doc(protocolId);
}

function isStoredProtocol(value: unknown): value is {
  version: number;
  createdAt: string;
  pivotState?: unknown;
  idempotency?: Record<string, unknown>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 0 &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function isIdempotencyRecord(value: unknown): value is { version: number; state: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "number" &&
    "state" in value
  );
}

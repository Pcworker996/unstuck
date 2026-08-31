import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { GoogleProtocolRepository } from "./google-protocol";
import { type GooglePivotResult } from "../app/google-pivot-protocol";
import { isGoogleProtocolExpired, isTerminalProtocolState, shouldClearUnsavedExpiry } from "./google-protocol-retention";

const ACCOUNTS_COLLECTION = "personalAccounts";
const PROTOCOLS_COLLECTION = "protocols";

export function createFirestoreGoogleProtocolRepository(
  firestore: Firestore
): GoogleProtocolRepository {
  return {
    async create(protocol) {
      const data: Record<string, unknown> = {
        version: protocol.version,
        createdAt: protocol.createdAt
      };
      if (protocol.expiresAt) data.expiresAt = protocol.expiresAt;
      await protocolDocument(firestore, protocol.ownerSubject, protocol.id).set(data);
    },
    async findFirstForOwner(ownerSubject) {
      const snapshot = await firestore
        .collection(ACCOUNTS_COLLECTION)
        .doc(ownerSubject)
        .collection(PROTOCOLS_COLLECTION)
        .get();
      for (const document of snapshot.docs) {
        const value = document.data();
        if (!isStoredProtocol(value) || isGoogleProtocolExpired(value.expiresAt)) continue;
        return {
          id: document.id,
          ownerSubject,
          version: value.version,
          createdAt: value.createdAt,
          pivotState: value.pivotState
        };
      }
      return undefined;
    },
    async findByIdForOwner({ protocolId, ownerSubject }) {
      const snapshot = await protocolDocument(firestore, ownerSubject, protocolId).get();
      if (!snapshot.exists) {
        return undefined;
      }

      const value = snapshot.data();
      if (!isStoredProtocol(value) || isGoogleProtocolExpired(value.expiresAt)) {
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
    async listSavedForOwner(ownerSubject) {
      const snapshot = await firestore
        .collection(ACCOUNTS_COLLECTION)
        .doc(ownerSubject)
        .collection(PROTOCOLS_COLLECTION)
        .get();
      return snapshot.docs.flatMap((document) => {
        const value = document.data();
        if (!isStoredProtocol(value) || !isSavedPivotState(value.pivotState)) return [];
        return [{
          id: document.id,
          ownerSubject,
          version: value.version,
          createdAt: value.createdAt,
          pivotState: value.pivotState
        }];
      });
    },
    async delete({ protocolId, ownerSubject }) {
      const reference = protocolDocument(firestore, ownerSubject, protocolId);
      const snapshot = await reference.get();
      if (!snapshot.exists) return false;
      await reference.delete();
      return true;
    },
    async findIdempotent({ protocolId, ownerSubject, idempotencyKey, fingerprint }) {
      const snapshot = await protocolDocument(firestore, ownerSubject, protocolId).get();
      if (!snapshot.exists) {
        return undefined;
      }
      const value = snapshot.data();
      if (!isStoredProtocol(value) || isGoogleProtocolExpired(value.expiresAt) || !isIdempotencyRecord(value.idempotency?.[idempotencyKey])) {
        return undefined;
      }
      const record = value.idempotency[idempotencyKey];
      const protocol = {
        id: protocolId,
        ownerSubject,
        version: record.version,
        createdAt: value.createdAt,
        pivotState: record.state
      };
      return record.fingerprint === fingerprint
        ? { kind: "match" as const, protocol }
        : { kind: "conflict" as const, protocol };
    },
    async saveState({ protocolId, ownerSubject, expectedVersion, idempotencyKey, fingerprint, state }) {
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
          if (existingIdempotency.fingerprint !== fingerprint) {
            return { kind: "idempotency-conflict" as const, protocol: current };
          }
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
        const persistedState = withoutUndefined(state);
        const idempotencyRecord = { version: nextVersion, state: persistedState, fingerprint };
        transaction.set(reference, {
          version: nextVersion,
          pivotState: persistedState,
          ...(shouldClearUnsavedExpiry(state) ? { expiresAt: FieldValue.delete() } : {}),
          idempotency: isTerminalProtocolState(state)
            ? { [idempotencyKey]: idempotencyRecord }
            : { ...(value.idempotency ?? {}), [idempotencyKey]: idempotencyRecord }
        }, { merge: true });
        return {
          kind: "saved" as const,
          protocol: { ...current, version: nextVersion, pivotState: persistedState }
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
  expiresAt?: unknown;
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

function isIdempotencyRecord(value: unknown): value is { version: number; state: unknown; fingerprint?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "number" &&
    "state" in value
  );
}

function isSavedPivotState(value: unknown): value is Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "pivot-protocol" &&
    "persistence" in value &&
    value.persistence === "saved"
  );
}

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, withoutUndefined(entry)])
  );
}

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
    async saveState({ protocolId, ownerSubject, state }) {
      await protocolDocument(firestore, ownerSubject, protocolId).set(
        { pivotState: state },
        { merge: true }
      );
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

function isStoredProtocol(value: unknown): value is { version: number; createdAt: string; pivotState?: unknown } {
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

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { createFirestoreGoogleProtocolRepository } from "./firestore-google-protocol-repository";
import type { GoogleProtocolDependencies } from "./google-protocol";

let runtime: GoogleProtocolDependencies | undefined;

export function getGoogleProtocolRuntime(): GoogleProtocolDependencies {
  if (runtime) {
    return runtime;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is required.");
  }

  const app = getApps()[0] ?? initializeApp({ projectId });
  runtime = {
    repository: createFirestoreGoogleProtocolRepository(getFirestore(app)),
    createId: crypto.randomUUID,
    now: () => new Date().toISOString()
  };
  return runtime;
}

export function resetGoogleProtocolRuntimeForTests(): void {
  runtime = undefined;
}

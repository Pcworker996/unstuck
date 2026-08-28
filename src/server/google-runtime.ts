import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { createFirestoreGoogleProtocolRepository } from "./firestore-google-protocol-repository";
import { createFirestoreGoogleMemoryRepository } from "./firestore-google-memory-repository";
import { createGenkitGoogleEmbeddingProvider } from "./genkit-google-pivot-generator";
import { createGoogleCloudPdfStorage } from "./google-pdf-storage";
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
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  runtime = {
    repository: createFirestoreGoogleProtocolRepository(firestore),
    adaptation: {
      memoryRepository: createFirestoreGoogleMemoryRepository(firestore),
      embed: createGenkitGoogleEmbeddingProvider()
    },
    artifactStorage: createGoogleCloudPdfStorage(storage.bucket(process.env.GOOGLE_TEMP_ARTIFACT_BUCKET?.trim() || undefined)),
    createId: () => crypto.randomUUID(),
    now: () => new Date().toISOString()
  };
  return runtime;
}

export function resetGoogleProtocolRuntimeForTests(): void {
  runtime = undefined;
}

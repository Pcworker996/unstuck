import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";

import { createFirestoreGoogleProtocolRepository } from "./firestore-google-protocol-repository";

describe("Firestore Google Protocol repository", () => {
  it("stores and reads protocols only through the authenticated owner's path", async () => {
    const repository = createFirestoreGoogleProtocolRepository(new FakeFirestore() as unknown as Firestore);

    await repository.create({
      id: "protocol-1",
      ownerSubject: "firebase-user-1",
      version: 0,
      createdAt: "2026-08-26T12:00:00.000Z"
    });

    await expect(
      repository.findByIdForOwner({ protocolId: "protocol-1", ownerSubject: "firebase-user-1" })
    ).resolves.toMatchObject({ id: "protocol-1", ownerSubject: "firebase-user-1" });
    await expect(
      repository.findByIdForOwner({ protocolId: "protocol-1", ownerSubject: "firebase-user-2" })
    ).resolves.toBeUndefined();
  });
});

class FakeFirestore {
  private readonly documents = new Map<string, Record<string, unknown>>();

  collection(name: string): FakeCollection {
    return new FakeCollection(this.documents, name);
  }
}

class FakeCollection {
  constructor(
    private readonly documents: Map<string, Record<string, unknown>>,
    private readonly path: string
  ) {}

  doc(id: string): FakeDocument {
    return new FakeDocument(this.documents, `${this.path}/${id}`);
  }

  async get(): Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }> {
    const prefix = `${this.path}/`;
    return {
      docs: [...this.documents.entries()]
        .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(([path, value]) => ({ id: path.slice(prefix.length), data: () => value }))
    };
  }
}

class FakeDocument {
  constructor(
    private readonly documents: Map<string, Record<string, unknown>>,
    private readonly path: string
  ) {}

  collection(name: string): FakeCollection {
    return new FakeCollection(this.documents, `${this.path}/${name}`);
  }

  async set(value: Record<string, unknown>): Promise<void> {
    this.documents.set(this.path, value);
  }

  async get(): Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> {
    const value = this.documents.get(this.path);
    return { exists: value !== undefined, data: () => value };
  }
}

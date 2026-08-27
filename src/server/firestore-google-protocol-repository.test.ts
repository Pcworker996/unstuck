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

  it("updates only at the expected version and records idempotency", async () => {
    const repository = createFirestoreGoogleProtocolRepository(new FakeFirestore() as unknown as Firestore);
    await repository.create({
      id: "protocol-1",
      ownerSubject: "firebase-user-1",
      version: 0,
      createdAt: "2026-08-26T12:00:00.000Z"
    });

    await expect(repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "command-1",
      fingerprint: "saved-command",
      state: { value: "saved" }
    })).resolves.toMatchObject({ kind: "saved", protocol: { version: 1 } });

    await expect(repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "command-2",
      fingerprint: "stale-command",
      state: { value: "stale" }
    })).resolves.toMatchObject({ kind: "conflict", protocol: { version: 1 } });

    await expect(repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "command-1",
      fingerprint: "saved-command",
      state: { value: "retry" }
    })).resolves.toMatchObject({ kind: "idempotent", protocol: { version: 1, pivotState: { value: "saved" } } });
  });

  it("removes undefined fields before persisting a protocol state", async () => {
    const repository = createFirestoreGoogleProtocolRepository(new FakeFirestore() as unknown as Firestore);
    await repository.create({
      id: "protocol-1",
      ownerSubject: "firebase-user-1",
      version: 0,
      createdAt: "2026-08-26T12:00:00.000Z"
    });

    await repository.saveState({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      expectedVersion: 0,
      idempotencyKey: "command-1",
      fingerprint: "nested-command",
      state: { selectedPivot: undefined, nested: { outcome: undefined, value: "kept" } }
    });

    await expect(repository.findByIdForOwner({
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1"
    })).resolves.toMatchObject({
      pivotState: { nested: { value: "kept" } }
    });
  });
});

class FakeFirestore {
  private readonly documents = new Map<string, Record<string, unknown>>();

  collection(name: string): FakeCollection {
    return new FakeCollection(this.documents, name);
  }

  async runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    return callback(new FakeTransaction(this.documents));
  }
}

class FakeTransaction {
  constructor(private readonly documents: Map<string, Record<string, unknown>>) {}

  async get(document: FakeDocument): Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> {
    return document.get();
  }

  set(document: FakeDocument, value: Record<string, unknown>, options?: { merge?: boolean }): void {
    document.setNow(value, options);
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

  async set(value: Record<string, unknown>, options?: { merge?: boolean }): Promise<void> {
    this.setNow(value, options);
  }

  setNow(value: Record<string, unknown>, options?: { merge?: boolean }): void {
    const existing = this.documents.get(this.path);
    this.documents.set(this.path, options?.merge && existing ? { ...existing, ...value } : value);
  }

  async get(): Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> {
    const value = this.documents.get(this.path);
    return { exists: value !== undefined, data: () => value };
  }
}

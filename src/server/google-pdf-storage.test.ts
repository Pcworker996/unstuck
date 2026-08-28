import { describe, expect, it } from "vitest";

import {
  GOOGLE_TEMP_PDF_LIFECYCLE_RULE,
  createGoogleCloudPdfStorage,
  createInMemoryGooglePdfStorage,
  randomGooglePdfObjectName
} from "./google-pdf-storage";

describe("temporary Google PDF storage contract", () => {
  it("uses random private object names and a one-day deletion backstop", async () => {
    const storage = createInMemoryGooglePdfStorage();
    const uploaded = await storage.upload({ bytes: new Uint8Array([1, 2, 3]) });

    expect(uploaded.objectName).toMatch(/^unstuck\/temporary-pdfs\/[0-9a-f-]+\.pdf$/);
    expect(uploaded.objectName).not.toContain("filename");
    expect(storage.lifecycleRule).toEqual(GOOGLE_TEMP_PDF_LIFECYCLE_RULE);
    expect(storage.isPublic).toBe(false);

    await storage.delete(uploaded.objectName);
    expect(storage.deletedObjectNames).toEqual([uploaded.objectName]);
  });

  it("can generate a fresh name for every upload", () => {
    expect(randomGooglePdfObjectName(() => "fixed-id")).toBe("unstuck/temporary-pdfs/fixed-id.pdf");
    expect(randomGooglePdfObjectName(() => "another-id")).not.toBe(randomGooglePdfObjectName(() => "fixed-id"));
  });

  it("requires a private bucket with the configured lifecycle", async () => {
    const saves: Array<{ name: string; options: unknown }> = [];
    let metadata: {
      lifecycle?: { rule?: unknown[] };
      iamConfiguration: {
        uniformBucketLevelAccess: { enabled: boolean };
        publicAccessPrevention: string;
      };
    } = {
      lifecycle: { rule: [GOOGLE_TEMP_PDF_LIFECYCLE_RULE] },
      iamConfiguration: {
        uniformBucketLevelAccess: { enabled: true },
        publicAccessPrevention: "enforced"
      }
    };
    const bucket = {
      name: "private-artifacts",
      file(name: string) {
        return {
          async save(_bytes: Buffer, options: unknown) { saves.push({ name, options }); },
          async delete() {}
        };
      },
      async getMetadata() { return [metadata]; },
    } as unknown as Parameters<typeof createGoogleCloudPdfStorage>[0];
    const storage = createGoogleCloudPdfStorage(bucket);

    const uploaded = await storage.upload({ bytes: new Uint8Array([1]) });
    await storage.ensureLifecycleRule?.();

    expect(uploaded.objectUri).toBe("gs://private-artifacts/" + uploaded.objectName);
    expect(saves[0].options).not.toMatchObject({ public: true });
    expect(metadata.lifecycle?.rule).toContainEqual(GOOGLE_TEMP_PDF_LIFECYCLE_RULE);
  });

  it("rejects a bucket without the required private-access controls", async () => {
    const bucket = {
      file() {
        return { async save() {} };
      },
      async getMetadata() {
        return [{ iamConfiguration: { uniformBucketLevelAccess: { enabled: false }, publicAccessPrevention: "inherited" } }];
      }
    } as unknown as Parameters<typeof createGoogleCloudPdfStorage>[0];

    await expect(createGoogleCloudPdfStorage(bucket).ensureLifecycleRule?.()).rejects.toThrow("uniform access");
  });
});

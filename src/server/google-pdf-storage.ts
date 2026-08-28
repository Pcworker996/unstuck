import type { Storage } from "firebase-admin/storage";
import type { GooglePdfTemporaryStorage } from "../app/google-supporting-artifacts";

export const GOOGLE_TEMP_PDF_LIFECYCLE_RULE = {
  action: { type: "Delete" },
  condition: { age: 1, matchesPrefix: ["unstuck/temporary-pdfs/"] }
} as const;

type GoogleCloudBucket = ReturnType<Storage["bucket"]>;

export function randomGooglePdfObjectName(randomId: () => string = () => crypto.randomUUID()): string {
  return `unstuck/temporary-pdfs/${randomId()}.pdf`;
}

export function createGoogleCloudPdfStorage(bucket: GoogleCloudBucket): GooglePdfTemporaryStorage {
  return {
    async upload({ bytes }) {
      const objectName = randomGooglePdfObjectName();
      await bucket.file(objectName).save(Buffer.from(bytes), {
        resumable: false,
        metadata: { contentType: "application/pdf", cacheControl: "no-store" }
      });
      return { objectName, objectUri: `gs://${bucket.name}/${objectName}` };
    },
    async delete(objectName) {
      await bucket.file(objectName).delete({ ignoreNotFound: true });
    },
    async ensureLifecycleRule() {
      const [metadata] = await bucket.getMetadata();
      const existingRules = Array.isArray(metadata.lifecycle?.rule) ? metadata.lifecycle.rule : [];
      const hasRule = existingRules.some((rule) =>
        rule.action?.type === "Delete" &&
        rule.condition?.age === 1 &&
        Array.isArray(rule.condition.matchesPrefix) &&
        rule.condition.matchesPrefix.includes("unstuck/temporary-pdfs/")
      );
      if (!hasRule) {
        await bucket.setMetadata({ lifecycle: { rule: [...existingRules, {
          action: { type: "Delete" },
          condition: { age: 1, matchesPrefix: ["unstuck/temporary-pdfs/"] }
        }] } });
      }
    }
  };
}

export function createInMemoryGooglePdfStorage() {
  const objects = new Map<string, Uint8Array>();
  const deletedObjectNames: string[] = [];
  return {
    isPublic: false as const,
    lifecycleRule: GOOGLE_TEMP_PDF_LIFECYCLE_RULE,
    deletedObjectNames,
    async upload({ bytes }: { bytes: Uint8Array }) {
      const objectName = randomGooglePdfObjectName(() => crypto.randomUUID());
      objects.set(objectName, new Uint8Array(bytes));
      return { objectName, objectUri: `gs://private-test-bucket/${objectName}` };
    },
    async delete(objectName: string) {
      deletedObjectNames.push(objectName);
      objects.delete(objectName);
    },
    async ensureLifecycleRule() {}
  };
}

import { describe, expect, it } from "vitest";

import {
  processGoogleSupportingArtifact,
  type GooglePdfTemporaryStorage
} from "./google-supporting-artifacts";

const pdf = () => new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF");

describe("Google supporting artifact processing", () => {
  it("extracts a PDF through private storage and always deletes it after success", async () => {
    const calls: string[] = [];
    const storage: GooglePdfTemporaryStorage = {
      async ensureLifecycleRule() { calls.push("lifecycle"); },
      async upload() {
        calls.push("upload");
        return { objectName: "unstuck/temporary-pdfs/random.pdf", objectUri: "gs://private/random.pdf" };
      },
      async delete(objectName) { calls.push(`delete:${objectName}`); }
    };

    const result = await processGoogleSupportingArtifact("artifact-1", { bytes: pdf() }, async (input) => {
      expect(input.objectUri).toBe("gs://private/random.pdf");
      expect(input.dataUri).toBeUndefined();
      return { claims: [{ text: "The checklist has one page." }] };
    }, storage);

    expect(result).toMatchObject({ kind: "accepted", artifactId: "artifact-1", mimeType: "application/pdf", pageCount: 1 });
    expect(calls).toEqual(["lifecycle", "upload", "delete:unstuck/temporary-pdfs/random.pdf"]);
    expect(JSON.stringify(result)).not.toContain("random.pdf");
  });

  it("attempts PDF deletion when extraction fails and leaves no claims", async () => {
    let deleted = false;
    const storage: GooglePdfTemporaryStorage = {
      async upload() { return { objectName: "unstuck/temporary-pdfs/random.pdf", objectUri: "gs://private/random.pdf" }; },
      async delete() { deleted = true; }
    };

    const result = await processGoogleSupportingArtifact("artifact-1", { bytes: pdf() }, async () => {
      throw new Error("Gemini unavailable");
    }, storage);

    expect(result).toMatchObject({ kind: "rejected", reason: "extraction-failed" });
    expect(deleted).toBe(true);
  });

  it("returns a cleanup failure as an artifact-local rejection", async () => {
    const storage: GooglePdfTemporaryStorage = {
      async upload() { return { objectName: "unstuck/temporary-pdfs/random.pdf", objectUri: "gs://private/random.pdf" }; },
      async delete() { throw new Error("storage unavailable"); }
    };

    await expect(processGoogleSupportingArtifact("artifact-1", { bytes: pdf() }, async () => ({ claims: [{ text: "A claim." }] }), storage))
      .resolves.toMatchObject({ kind: "rejected", reason: "cleanup-failed" });
  });
});

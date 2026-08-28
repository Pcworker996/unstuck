import { describe, expect, it } from "vitest";

import {
  MAX_GOOGLE_ARTIFACT_BYTES,
  MAX_GOOGLE_ARTIFACT_COUNT,
  MAX_GOOGLE_ARTIFACT_TOTAL_BYTES,
  MAX_GOOGLE_PDF_PAGES,
  inspectGoogleSupportingArtifact,
  validateGoogleSupportingArtifactBatch
} from "./google-supporting-artifacts";

const pdf = (pages = 1, extra = "") => new TextEncoder().encode(
  `%PDF-1.7\n${Array.from({ length: pages }, (_, index) => `${index + 1} 0 obj\n<< /Type /Page >>\nendobj\n`).join("")}${extra}\n%%EOF`
);

describe("Google supporting artifact boundary", () => {
  it("detects supported content from bytes and reports PDF page properties", () => {
    const result = inspectGoogleSupportingArtifact({
      bytes: pdf(2),
      declaredMimeType: "application/pdf"
    });

    expect(result).toMatchObject({ kind: "accepted", mimeType: "application/pdf", pageCount: 2 });
  });

  it("rejects content type mismatches, encrypted PDFs, and malformed PDFs", () => {
    expect(inspectGoogleSupportingArtifact({ bytes: pdf(), declaredMimeType: "image/png" })).toMatchObject({
      kind: "rejected",
      reason: "mime-mismatch"
    });
    expect(inspectGoogleSupportingArtifact({ bytes: pdf(1, "/Encrypt 9 0 R") })).toMatchObject({
      kind: "rejected",
      reason: "encrypted"
    });
    expect(inspectGoogleSupportingArtifact({ bytes: new TextEncoder().encode("%PDF-1.7\n1 0 obj") })).toMatchObject({
      kind: "rejected",
      reason: "malformed"
    });
    expect(inspectGoogleSupportingArtifact({ bytes: pdf(21) })).toMatchObject({
      kind: "rejected",
      reason: "too-large"
    });
    expect(inspectGoogleSupportingArtifact({ bytes: pdf(20) })).toMatchObject({
      kind: "accepted",
      pageCount: 20
    });
  });

  it("rejects every batch limit explicitly instead of truncating input", () => {
    const tooMany = Array.from({ length: MAX_GOOGLE_ARTIFACT_COUNT + 1 }, () => ({ bytes: pdf() }));
    expect(validateGoogleSupportingArtifactBatch(tooMany)).toMatchObject({ kind: "rejected", reason: "too-many" });

    expect(validateGoogleSupportingArtifactBatch([{ bytes: new Uint8Array(MAX_GOOGLE_ARTIFACT_BYTES + 1) }]))
      .toMatchObject({ kind: "rejected", reason: "too-large" });

    expect(validateGoogleSupportingArtifactBatch([
      { bytes: new Uint8Array(8 * 1024 * 1024) },
      { bytes: new Uint8Array(8 * 1024 * 1024) },
      { bytes: new Uint8Array(9 * 1024 * 1024 + 1) }
    ])).toMatchObject({ kind: "rejected", reason: "total-too-large" });
  });
});

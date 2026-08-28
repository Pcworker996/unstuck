import { describe, expect, it } from "vitest";

import {
  MAX_GOOGLE_IMAGE_BYTES,
  processGoogleImageArtifact,
  validateGoogleImageArtifact,
  validateGoogleImageClaims,
  type GoogleImageArtifactInput
} from "./google-image-artifact";

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]);
const png = () => {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set([0x49, 0x45, 0x4e, 0x44], 37);
  return bytes;
};
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 12, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0, 0, 0, 0]);

describe("Google image artifact boundary", () => {
  it("detects the actual MIME type instead of trusting a claimed type", () => {
    expect(validateGoogleImageArtifact({ bytes: jpeg(), declaredMimeType: "image/png" })).toMatchObject({
      kind: "rejected",
      reason: "mime-mismatch"
    });
    expect(validateGoogleImageArtifact({ bytes: webp(), declaredMimeType: "image/webp" })).toMatchObject({
      kind: "accepted",
      mimeType: "image/webp"
    });
  });

  it("rejects unsupported, empty, and oversized input transparently", () => {
    expect(validateGoogleImageArtifact({ bytes: new Uint8Array([1, 2, 3]) })).toMatchObject({
      kind: "rejected",
      reason: "unsupported-type"
    });
    expect(validateGoogleImageArtifact({ bytes: new Uint8Array([0xff, 0xd8, 0xff]) })).toMatchObject({
      kind: "rejected",
      reason: "malformed"
    });
    expect(validateGoogleImageArtifact({ bytes: new Uint8Array() })).toMatchObject({
      kind: "rejected",
      reason: "malformed"
    });
    expect(validateGoogleImageArtifact({ bytes: new Uint8Array(MAX_GOOGLE_IMAGE_BYTES + 1) })).toMatchObject({
      kind: "rejected",
      reason: "too-large"
    });
  });

  it("schema-validates extractor claims and keeps only bounded claim text", () => {
    expect(validateGoogleImageClaims({ claims: [{ text: "Rent is due on the first." }] })).toEqual([
      "Rent is due on the first."
    ]);
    expect(() => validateGoogleImageClaims({ claims: [{ text: "" }] })).toThrow();
    expect(() => validateGoogleImageClaims({ claims: [{ text: "A" }, { text: 3 }] })).toThrow();
  });

  it("processes accepted bytes inline and returns no bytes in the result", async () => {
    const input: GoogleImageArtifactInput = { bytes: jpeg(), declaredMimeType: "image/jpeg" };
    const result = await processGoogleImageArtifact(input, async ({ mimeType, dataUri }) => {
      expect(mimeType).toBe("image/jpeg");
      expect(dataUri.startsWith("data:image/jpeg;base64,")).toBe(true);
      return { claims: [{ text: "The message asks for a move-out date." }] };
    });

    expect(result).toEqual({
      kind: "accepted",
      mimeType: "image/jpeg",
      claims: ["The message asks for a move-out date."]
    });
    expect(JSON.stringify(result)).not.toContain("bytes");
  });

  it("turns extractor and malformed-claim failures into safe continuation results", async () => {
    await expect(processGoogleImageArtifact({ bytes: png() }, async () => {
      throw new Error("model unavailable");
    })).resolves.toMatchObject({ kind: "rejected", reason: "extraction-failed" });

    await expect(processGoogleImageArtifact({ bytes: png() }, async () => ({ claims: [{ text: "" }] })))
      .resolves.toMatchObject({ kind: "rejected", reason: "invalid-claims" });
  });
});

import {
  detectGoogleImageMimeType,
  googleImageBytesToBase64,
  type GoogleImageMimeType
} from "./google-image-artifact";

export const MAX_GOOGLE_ARTIFACT_COUNT = 5;
export const MAX_GOOGLE_ARTIFACT_BYTES = 10 * 1024 * 1024;
export const MAX_GOOGLE_ARTIFACT_TOTAL_BYTES = 25 * 1024 * 1024;
export const MAX_GOOGLE_PDF_PAGES = 20;
export const GOOGLE_SUPPORTING_ARTIFACT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
] as const;

export type GoogleSupportingArtifactMimeType = (typeof GOOGLE_SUPPORTING_ARTIFACT_MIME_TYPES)[number];

export type GoogleSupportingArtifactInput = {
  bytes: Uint8Array;
  declaredMimeType?: string;
};

export type GoogleSupportingArtifactInspection =
  | {
      kind: "accepted";
      bytes: Uint8Array;
      mimeType: GoogleSupportingArtifactMimeType;
      pageCount?: number;
      dataUri?: string;
    }
  | {
      kind: "rejected";
      reason: GoogleArtifactRejectionReason;
      message: string;
    };

export type GoogleArtifactRejectionReason =
  | "empty"
  | "too-large"
  | "unsupported-type"
  | "mime-mismatch"
  | "malformed"
  | "encrypted"
  | "too-many"
  | "total-too-large"
  | "storage-unavailable"
  | "upload-failed"
  | "extraction-failed"
  | "invalid-claims"
  | "cleanup-failed";

export type GoogleSupportingArtifactExtractor = (input: {
  artifactId: string;
  mimeType: GoogleSupportingArtifactMimeType;
  dataUri?: string;
  objectUri?: string;
  pageCount?: number;
}) => Promise<unknown>;

export type GooglePdfTemporaryStorage = {
  upload: (input: { bytes: Uint8Array }) => Promise<{ objectName: string; objectUri: string }>;
  delete: (objectName: string) => Promise<void>;
  ensureLifecycleRule?: () => Promise<void>;
};

export type GoogleSupportingArtifactProcessing =
  | {
      kind: "accepted";
      artifactId: string;
      mimeType: GoogleSupportingArtifactMimeType;
      pageCount?: number;
      claims: string[];
      cleanupFailed: boolean;
    }
  | {
      kind: "rejected";
      artifactId: string;
      reason: GoogleArtifactRejectionReason;
      message: string;
    };

export function inspectGoogleSupportingArtifact(
  input: GoogleSupportingArtifactInput
): GoogleSupportingArtifactInspection {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) {
    return { kind: "rejected", reason: "empty", message: "The supporting artifact is empty." };
  }
  if (input.bytes.length > MAX_GOOGLE_ARTIFACT_BYTES) {
    return { kind: "rejected", reason: "too-large", message: "That artifact is larger than the 10 MB per-file limit." };
  }

  const mimeType = detectMimeType(input.bytes);
  if (!mimeType) {
    return { kind: "rejected", reason: looksLikePdf(input.bytes) ? "malformed" : "unsupported-type", message: looksLikePdf(input.bytes)
      ? "The PDF is malformed or truncated."
      : "Use a JPEG, PNG, WebP image, or PDF." };
  }
  if (input.declaredMimeType && input.declaredMimeType !== mimeType) {
    return { kind: "rejected", reason: "mime-mismatch", message: "The artifact content does not match its declared type." };
  }

  if (mimeType !== "application/pdf") {
    return {
      kind: "accepted",
      bytes: new Uint8Array(input.bytes),
      mimeType,
      dataUri: `data:${mimeType};base64,${googleImageBytesToBase64(input.bytes)}`
    };
  }

  const pageCount = inspectPdfPageCount(input.bytes);
  if (pageCount.kind === "rejected") return pageCount;
  return { kind: "accepted", bytes: new Uint8Array(input.bytes), mimeType, pageCount: pageCount.pageCount };
}

export function validateGoogleSupportingArtifactBatch(
  inputs: readonly GoogleSupportingArtifactInput[]
): { kind: "accepted"; totalBytes: number } | { kind: "rejected"; reason: "too-many" | "total-too-large" | "too-large"; message: string } {
  if (inputs.length > MAX_GOOGLE_ARTIFACT_COUNT) {
    return { kind: "rejected", reason: "too-many", message: "A Situation can include at most five supporting artifacts." };
  }
  if (inputs.some((input) => !(input.bytes instanceof Uint8Array) || input.bytes.length > MAX_GOOGLE_ARTIFACT_BYTES)) {
    return { kind: "rejected", reason: "too-large", message: "Each supporting artifact must be 10 MB or smaller." };
  }
  const totalBytes = inputs.reduce((total, input) => total + input.bytes.length, 0);
  if (totalBytes > MAX_GOOGLE_ARTIFACT_TOTAL_BYTES) {
    return { kind: "rejected", reason: "total-too-large", message: "Supporting artifacts must be 25 MB or smaller in total." };
  }
  return { kind: "accepted", totalBytes };
}

export async function processGoogleSupportingArtifact(
  artifactId: string,
  input: GoogleSupportingArtifactInput,
  extractor: GoogleSupportingArtifactExtractor,
  temporaryPdfStorage?: GooglePdfTemporaryStorage
): Promise<GoogleSupportingArtifactProcessing> {
  const inspected = inspectGoogleSupportingArtifact(input);
  if (inspected.kind === "rejected") return { ...inspected, artifactId };

  if (inspected.mimeType !== "application/pdf") {
    return processExtractedArtifact(artifactId, inspected, extractor, { dataUri: inspected.dataUri });
  }
  if (!temporaryPdfStorage) {
    return {
      kind: "rejected",
      artifactId,
      reason: "storage-unavailable",
      message: "This PDF could not be reviewed because temporary storage is unavailable."
    };
  }

  try {
    await temporaryPdfStorage.ensureLifecycleRule?.();
    const uploaded = await temporaryPdfStorage.upload({ bytes: inspected.bytes });
    let extracted: unknown;
    let extractionFailed = false;
    try {
      extracted = await extractor({
        artifactId,
        mimeType: inspected.mimeType,
        objectUri: uploaded.objectUri,
        pageCount: inspected.pageCount
      });
    } catch {
      extractionFailed = true;
    }

    let cleanupFailed = false;
    try {
      await temporaryPdfStorage.delete(uploaded.objectName);
    } catch {
      cleanupFailed = true;
    }
    if (extractionFailed) {
      return {
        kind: "rejected",
        artifactId,
        reason: "extraction-failed",
        message: cleanupFailed
          ? "The PDF could not be reviewed and its temporary cleanup needs a retry; the Quick dump was kept."
          : "The PDF could not be reviewed, so the Quick dump was kept."
      };
    }
    if (cleanupFailed) {
      return {
        kind: "rejected",
        artifactId,
        reason: "cleanup-failed",
        message: "The PDF was reviewed but could not be cleaned up safely, so its claims were not used."
      };
    }
    return processClaims(artifactId, inspected, extracted);
  } catch (error) {
    return {
      kind: "rejected",
      artifactId,
      reason: "upload-failed",
      message: error instanceof Error && error.message.includes("storage")
        ? "The PDF could not be placed in private temporary storage."
        : "The PDF could not be reviewed, so the Quick dump was kept."
    };
  }
}

function processExtractedArtifact(
  artifactId: string,
  inspected: Extract<GoogleSupportingArtifactInspection, { kind: "accepted" }>,
  extractor: GoogleSupportingArtifactExtractor,
  input: { dataUri?: string }
): Promise<GoogleSupportingArtifactProcessing> {
  return extractor({ artifactId, mimeType: inspected.mimeType, pageCount: inspected.pageCount, ...input })
    .then((extracted) => processClaims(artifactId, inspected, extracted))
    .catch((error) => ({
      kind: "rejected" as const,
      artifactId,
      reason: error instanceof Error && error.message === "invalid-claims" ? "invalid-claims" as const : "extraction-failed" as const,
      message: error instanceof Error && error.message === "invalid-claims"
        ? "The artifact review returned invalid claims, so the Quick dump was kept."
        : "The artifact could not be reviewed, so the Quick dump was kept."
    }));
}

function processClaims(
  artifactId: string,
  inspected: Extract<GoogleSupportingArtifactInspection, { kind: "accepted" }>,
  extracted: unknown
): GoogleSupportingArtifactProcessing {
  try {
    return {
      kind: "accepted",
      artifactId,
      mimeType: inspected.mimeType,
      pageCount: inspected.pageCount,
      claims: validateGoogleSupportingArtifactClaims(extracted),
      cleanupFailed: false
    };
  } catch {
    return {
      kind: "rejected",
      artifactId,
      reason: "invalid-claims",
      message: "The artifact review returned invalid claims, so the Quick dump was kept."
    };
  }
}

export function validateGoogleSupportingArtifactClaims(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.claims) || value.claims.length > 8) throw new Error("invalid-claims");
  return value.claims.map((claim) => {
    if (!isRecord(claim) || typeof claim.text !== "string") throw new Error("invalid-claims");
    const text = claim.text.trim();
    if (!text || text.length > 500) throw new Error("invalid-claims");
    return text;
  });
}

function detectMimeType(bytes: Uint8Array): GoogleSupportingArtifactMimeType | undefined {
  const imageMimeType = detectGoogleImageMimeType(bytes);
  if (imageMimeType) return imageMimeType;
  return hasPdfSignature(bytes) ? "application/pdf" : undefined;
}

function inspectPdfPageCount(bytes: Uint8Array): { kind: "accepted"; pageCount: number } | Extract<GoogleSupportingArtifactInspection, { kind: "rejected" }> {
  const text = new TextDecoder("latin1").decode(bytes);
  const objectCount = (text.match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
  const endObjectCount = (text.match(/\bendobj\b/g) ?? []).length;
  if (!text.includes("%%EOF") || !/\/Type\s*\/Pages?\b/.test(text) || objectCount === 0 || objectCount !== endObjectCount) {
    return { kind: "rejected", reason: "malformed", message: "The PDF is malformed or truncated." };
  }
  if (/\/Encrypt\b/.test(text)) {
    return { kind: "rejected", reason: "encrypted", message: "Encrypted PDFs are not supported." };
  }
  const pageTreeCount = text.match(/\/Type\s*\/Pages\b[\s\S]{0,300}?\/Count\s+(\d+)/)?.[1];
  const pageCount = pageTreeCount ? Number(pageTreeCount) : (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (pageCount === 0) return { kind: "rejected", reason: "malformed", message: "The PDF has no readable pages." };
  if (pageCount > MAX_GOOGLE_PDF_PAGES) {
    return { kind: "rejected", reason: "too-large", message: "A PDF must contain 20 pages or fewer." };
  }
  return { kind: "accepted", pageCount };
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && /^%PDF-\d\.\d/.test(ascii(bytes.slice(0, 8)));
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && ascii(bytes.slice(0, 4)) === "%PDF";
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { GoogleImageMimeType };

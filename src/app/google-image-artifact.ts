export const MAX_GOOGLE_IMAGE_BYTES = 10 * 1024 * 1024;
export const GOOGLE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type GoogleImageMimeType = (typeof GOOGLE_IMAGE_MIME_TYPES)[number];

export type GoogleImageArtifactInput = {
  bytes: Uint8Array;
  declaredMimeType?: string;
};

export type GoogleImageArtifactExtractor = (input: {
  mimeType: GoogleImageMimeType;
  dataUri: string;
}) => Promise<unknown>;

export type GoogleImageValidationResult =
  | { kind: "accepted"; bytes: Uint8Array; mimeType: GoogleImageMimeType; dataUri: string }
  | {
      kind: "rejected";
      reason: "empty" | "too-large" | "malformed" | "unsupported-type" | "mime-mismatch";
      message: string;
    };

export type GoogleImageProcessingResult =
  | { kind: "accepted"; mimeType: GoogleImageMimeType; claims: string[] }
  | {
      kind: "rejected";
      reason: GoogleImageRejectionReason;
      message: string;
    };

export type GoogleImageRejectionReason =
  | "empty"
  | "too-large"
  | "malformed"
  | "unsupported-type"
  | "mime-mismatch"
  | "extraction-failed"
  | "invalid-claims";

export function validateGoogleImageArtifact(input: GoogleImageArtifactInput): GoogleImageValidationResult {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) {
    return { kind: "rejected", reason: "malformed", message: "The image is empty or malformed." };
  }
  if (input.bytes.length > MAX_GOOGLE_IMAGE_BYTES) {
    return { kind: "rejected", reason: "too-large", message: "That image is larger than the 10 MB limit." };
  }

  const mimeType = detectGoogleImageMimeType(input.bytes);
  if (!mimeType) {
    return looksLikeKnownImage(input.bytes)
      ? { kind: "rejected", reason: "malformed", message: "The image is malformed or truncated." }
      : { kind: "rejected", reason: "unsupported-type", message: "Use a JPEG, PNG, or WebP image." };
  }
  if (input.declaredMimeType && input.declaredMimeType !== mimeType) {
    return { kind: "rejected", reason: "mime-mismatch", message: "The image content does not match its declared type." };
  }

  const bytes = new Uint8Array(input.bytes);
  return { kind: "accepted", bytes, mimeType, dataUri: `data:${mimeType};base64,${googleImageBytesToBase64(bytes)}` };
}

export function detectGoogleImageMimeType(bytes: Uint8Array): GoogleImageMimeType | undefined {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  return undefined;
}

export function googleImageBytesToBase64(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(result);
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 6 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;
  let offset = 2;
  while (offset <= bytes.length - 2) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) return offset === bytes.length;
    if (marker === 0xd8 || marker === 0x00 || marker === undefined) return false;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length - 1) return false;
    const segmentLength = (bytes[offset] << 8) + bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length - 2) return false;
    offset += segmentLength;
    if (marker === 0xda) return true;
  }
  return false;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !bytes.slice(0, 8).every((value, index) => value === signature[index])) return false;
  let offset = 8;
  let sawHeader = false;
  while (offset + 12 <= bytes.length) {
    const length = readBigEndianUint32(bytes, offset);
    const type = ascii(bytes.slice(offset + 4, offset + 8));
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length || (type === "IHDR" && length !== 13)) return false;
    if (type === "IHDR") sawHeader = true;
    if (type === "IEND") return sawHeader && length === 0 && chunkEnd === bytes.length;
    offset = chunkEnd;
  }
  return false;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes.slice(0, 4)) !== "RIFF" || ascii(bytes.slice(8, 12)) !== "WEBP") return false;
  const declaredSize = readLittleEndianUint32(bytes, 4);
  if (declaredSize !== bytes.length - 8) return false;
  let offset = 12;
  let sawImageChunk = false;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes.slice(offset, offset + 4));
    const chunkSize = readLittleEndianUint32(bytes, offset + 4);
    const chunkEnd = offset + 8 + chunkSize + (chunkSize % 2);
    if (!(chunkType === "VP8 " || chunkType === "VP8L" || chunkType === "VP8X" || chunkType === "ALPH" || chunkType === "ANIM" || chunkType === "ANMF" || chunkType === "ICCP" || chunkType === "EXIF" || chunkType === "XMP") || chunkEnd > bytes.length) return false;
    sawImageChunk ||= chunkType === "VP8 " || chunkType === "VP8L" || chunkType === "VP8X";
    offset = chunkEnd;
  }
  return sawImageChunk && offset === bytes.length;
}

function looksLikeKnownImage(bytes: Uint8Array): boolean {
  return (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (bytes.length >= 4 && ascii(bytes.slice(0, 4)) === "RIFF") ||
    (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]));
}

function readBigEndianUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readLittleEndianUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + (bytes[offset + 3] * 0x1000000);
}

export async function processGoogleImageArtifact(
  input: GoogleImageArtifactInput,
  extractor: GoogleImageArtifactExtractor
): Promise<GoogleImageProcessingResult> {
  const validated = validateGoogleImageArtifact(input);
  if (validated.kind === "rejected") return validated;

  let extracted: unknown;
  try {
    extracted = await extractor({ mimeType: validated.mimeType, dataUri: validated.dataUri });
  } catch {
    return { kind: "rejected", reason: "extraction-failed", message: "The image could not be reviewed, so the Quick dump was kept." };
  }
  try {
    return { kind: "accepted", mimeType: validated.mimeType, claims: validateGoogleImageClaims(extracted) };
  } catch {
    return { kind: "rejected", reason: "invalid-claims", message: "The image review returned an invalid result, so the Quick dump was kept." };
  }
}

export function validateGoogleImageClaims(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.claims) || value.claims.length > 8) {
    throw new Error("Image claims are invalid.");
  }
  return value.claims.map((claim) => {
    if (!isRecord(claim) || typeof claim.text !== "string") throw new Error("Image claim is invalid.");
    const text = claim.text.trim();
    if (!text || text.length > 500) throw new Error("Image claim is invalid.");
    return text;
  });
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

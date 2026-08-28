import { createHash } from "node:crypto";

export type GoogleTelemetryStatus = "ok" | "fallback" | "conflict" | "invalid" | "unauthorized" | "error" | "quota-exhausted";

export type GoogleTelemetryEvent = {
  correlationId: string;
  protocolId?: string;
  ownerSubject?: string;
  event: string;
  tool: string;
  status: GoogleTelemetryStatus;
  latencyMs?: number;
  modelId?: string;
  tokenUse?: number;
  retryCount?: number;
  resultCount?: number;
  fallbackKind?: string;
};

export type GoogleTelemetryLogger = {
  record: (event: GoogleTelemetryEvent) => void;
};

type LogSink = { info: (message: string) => void };

const TELEMETRY_FIELDS = [
  "correlationId",
  "protocolId",
  "ownerSubjectHash",
  "event",
  "tool",
  "status",
  "latencyMs",
  "modelId",
  "tokenUse",
  "retryCount",
  "resultCount",
  "fallbackKind"
] as const;

export function hashGoogleOwnerSubject(ownerSubject: string): string {
  return createHash("sha256").update(ownerSubject).digest("hex").slice(0, 24);
}

export function correlationIdForGoogleRequest(value?: string | null): string {
  const candidate = value?.trim();
  if (!candidate) return `corr-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  if (/^corr-[a-f0-9]{24}$/.test(candidate)) return candidate;
  return `corr-${createHash("sha256").update(candidate).digest("hex").slice(0, 24)}`;
}

export function createGoogleTelemetryLogger(sink: LogSink = console): GoogleTelemetryLogger {
  return {
    record(event) {
      const safeEvent: Record<string, unknown> = {
        correlationId: correlationIdForGoogleRequest(event.correlationId),
        ...(event.protocolId ? { protocolId: boundedLabel(event.protocolId) } : {}),
        ownerSubjectHash: event.ownerSubject ? hashGoogleOwnerSubject(event.ownerSubject) : "anonymous",
        event: boundedLabel(event.event),
        tool: boundedLabel(event.tool),
        status: event.status
      };
      for (const field of TELEMETRY_FIELDS.slice(6)) {
        const value = event[field as keyof GoogleTelemetryEvent];
        if (value !== undefined) safeEvent[field] = safeTelemetryValue(field, value);
      }
      try {
        sink.info(JSON.stringify(safeEvent));
      } catch {
        // Diagnostics must never change the user's protocol result.
      }
    }
  };
}

function boundedLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 100);
}

function safeTelemetryValue(field: string, value: unknown): unknown {
  if (["latencyMs", "tokenUse", "retryCount", "resultCount"].includes(field)) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
  }
  return boundedLabel(String(value));
}

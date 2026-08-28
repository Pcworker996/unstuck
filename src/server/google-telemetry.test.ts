import { describe, expect, it } from "vitest";

import {
  createGoogleTelemetryLogger,
  correlationIdForGoogleRequest,
  hashGoogleOwnerSubject,
  type GoogleTelemetryEvent
} from "./google-telemetry";

describe("Google telemetry", () => {
  it("emits only the privacy-safe allowlist and pseudonymous owner", () => {
    const messages: string[] = [];
    const logger = createGoogleTelemetryLogger({ info: (message) => messages.push(message) });

    logger.record({
      correlationId: correlationIdForGoogleRequest("request-1"),
      protocolId: "protocol-1",
      ownerSubject: "firebase-user-1",
      event: "pivot-command",
      tool: "google-pivot-protocol",
      status: "fallback",
      latencyMs: 12,
      modelId: "gemini-3.5-flash",
      tokenUse: 42,
      retryCount: 1,
      resultCount: 2,
      fallbackKind: "curated-state",
      quickDump: "private text must never be logged",
      prompt: "private prompt must never be logged"
    } as GoogleTelemetryEvent & Record<string, unknown>);

    expect(messages).toHaveLength(1);
    const parsed = JSON.parse(messages[0]);
    expect(parsed).toEqual({
      correlationId: correlationIdForGoogleRequest("request-1"),
      protocolId: "protocol-1",
      ownerSubjectHash: hashGoogleOwnerSubject("firebase-user-1"),
      event: "pivot-command",
      tool: "google-pivot-protocol",
      status: "fallback",
      latencyMs: 12,
      modelId: "gemini-3.5-flash",
      tokenUse: 42,
      retryCount: 1,
      resultCount: 2,
      fallbackKind: "curated-state"
    });
    expect(messages[0]).not.toContain("private text");
    expect(messages[0]).not.toContain("private prompt");
  });

  it("does not let a caller-supplied correlation value become log content", () => {
    const messages: string[] = [];
    const logger = createGoogleTelemetryLogger({ info: (message) => messages.push(message) });

    logger.record({
      correlationId: "private quick dump: do not log",
      ownerSubject: "firebase-user-1",
      event: "pivot-command",
      tool: "google-pivot-protocol",
      status: "ok"
    });

    const parsed = JSON.parse(messages[0]);
    expect(parsed.correlationId).not.toContain("private");
    expect(parsed.correlationId).toMatch(/^corr-[a-f0-9]{24}$/);
  });
});

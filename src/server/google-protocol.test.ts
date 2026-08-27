import { describe, expect, it } from "vitest";

import {
  createInMemoryGoogleProtocolRepository,
  loadGoogleProtocol,
  startGoogleProtocol
} from "./google-protocol";

describe("Google Protocol", () => {
  it("creates and reloads a minimal protocol for its authenticated owner", async () => {
    const repository = createInMemoryGoogleProtocolRepository();
    const dependencies = {
      repository,
      createId: () => "protocol-1",
      now: () => "2026-08-26T12:00:00.000Z"
    };

    const created = await startGoogleProtocol({ subject: "firebase-user-1" }, dependencies);
    const reloaded = await loadGoogleProtocol(
      { subject: "firebase-user-1", protocolId: "protocol-1" },
      dependencies
    );

    expect(created).toEqual({
      kind: "protocol",
      protocol: {
        id: "protocol-1",
        version: 0,
        createdAt: "2026-08-26T12:00:00.000Z"
      }
    });
    expect(reloaded).toEqual(created);
  });
});

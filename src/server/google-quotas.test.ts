import { describe, expect, it } from "vitest";

import { createInMemoryGoogleQuotaService } from "./google-quotas";

describe("Google quotas", () => {
  it("enforces per-account and global daily model and artifact bounds", async () => {
    const quota = createInMemoryGoogleQuotaService({
      account: { model: 2, artifact: 1 },
      global: { model: 3, artifact: 2 }
    });

    await expect(quota.reserve({ ownerSubject: "owner-1", day: "2026-08-28", modelUnits: 2, artifactUnits: 1 }))
      .resolves.toMatchObject({ allowed: true });
    await expect(quota.reserve({ ownerSubject: "owner-1", day: "2026-08-28", modelUnits: 1, artifactUnits: 0 }))
      .resolves.toMatchObject({ allowed: false, scope: "account", resource: "model" });
    await expect(quota.reserve({ ownerSubject: "owner-2", day: "2026-08-28", modelUnits: 1, artifactUnits: 1 }))
      .resolves.toMatchObject({ allowed: true });
    await expect(quota.reserve({ ownerSubject: "owner-3", day: "2026-08-28", modelUnits: 0, artifactUnits: 1 }))
      .resolves.toMatchObject({ allowed: false, scope: "global", resource: "artifact" });
  });

  it("does not consume quota when a combined reservation is rejected", async () => {
    const quota = createInMemoryGoogleQuotaService({
      account: { model: 2, artifact: 2 },
      global: { model: 2, artifact: 2 }
    });

    await expect(quota.reserve({ ownerSubject: "owner-1", day: "2026-08-28", modelUnits: 3, artifactUnits: 1 }))
      .resolves.toMatchObject({ allowed: false });
    await expect(quota.reserve({ ownerSubject: "owner-1", day: "2026-08-28", modelUnits: 2, artifactUnits: 2 }))
      .resolves.toMatchObject({ allowed: true });
  });

  it("replays a reservation key without consuming another daily unit", async () => {
    const quota = createInMemoryGoogleQuotaService({
      account: { model: 1, artifact: 1 },
      global: { model: 1, artifact: 1 }
    });
    const request = { ownerSubject: "owner-1", day: "2026-08-28", reservationKey: "protocol-1:start", modelUnits: 1, artifactUnits: 0 };

    await expect(quota.reserve(request)).resolves.toMatchObject({ allowed: true });
    await expect(quota.reserve(request)).resolves.toMatchObject({ allowed: true });
    await expect(quota.reserve({ ...request, reservationKey: "protocol-1:retry", modelUnits: 1, artifactUnits: 0 }))
      .resolves.toMatchObject({ allowed: false, resource: "model" });
  });
});

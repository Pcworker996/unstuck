import { describe, expect, it } from "vitest";

import { runDeterministicGoogleEvaluation } from "./google-protocol-evaluation";

describe("deterministic Google Protocol evaluation", () => {
  it("passes its committed synthetic case matrix without exposing input content", async () => {
    const report = await runDeterministicGoogleEvaluation();

    expect(report.kind).toBe("deterministic-evaluation");
    expect(report.passed).toBe(true);
    expect(report.caseCount).toBeGreaterThanOrEqual(20);
    expect(report.failedCaseIds).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("I ");
    expect(report.cases.every((evaluationCase) => Object.values(evaluationCase.invariantResults).length > 0)).toBe(true);
  });
});

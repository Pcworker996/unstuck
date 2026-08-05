import { describe, expect, it } from "vitest";

import { runPivotProtocol } from "./pivot-protocol";

describe("runPivotProtocol", () => {
  it("returns a task first-step Pivot for an overwhelming task dump", () => {
    const result = runPivotProtocol({
      quickDump: "I cannot figure out where to start this important project.",
      emotionalState: 4
    });

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected an ordinary Pivot protocol.");
    }

    expect(result.recommendation.primary.kind).toBe("task-first-step");
    expect(result.recommendation.alternatives).toHaveLength(2);
    expect(result.savedCheckIn).toEqual({
      privateEntry: false,
      derivedMemory: false
    });
  });

  it("keeps every recommendation inside the bounded Pivot library", () => {
    const result = runPivotProtocol({
      quickDump: "My thoughts are racing and I need a moment to settle.",
      emotionalState: 5
    });
    if (result.kind !== "pivot-protocol") {
      throw new Error("Expected an ordinary Pivot protocol.");
    }

    const kinds = [
      result.recommendation.primary.kind,
      ...result.recommendation.alternatives.map((pivot) => pivot.kind)
    ];

    expect(kinds).toHaveLength(3);
    expect(new Set(kinds).size).toBe(3);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "breathing-focus",
        "reaching-out",
        "basic-needs-reset"
      ])
    );
  });

  it("can regenerate into a different curated recommendation", () => {
    const first = runPivotProtocol({
      quickDump: "I feel stuck and need help deciding what to do.",
      emotionalState: 3
    });
    const regenerated = runPivotProtocol(
      {
        quickDump: "I feel stuck and need help deciding what to do.",
        emotionalState: 3
      },
      1
    );

    if (first.kind !== "pivot-protocol" || regenerated.kind !== "pivot-protocol") {
      throw new Error("Expected ordinary Pivot protocols.");
    }

    expect(regenerated.recommendation.primary.id).not.toBe(
      first.recommendation.primary.id
    );
    expect(regenerated.savedCheckIn.derivedMemory).toBe(false);
  });

  it("interrupts the ordinary Pivot flow when immediate danger is reported", () => {
    const result = runPivotProtocol({
      quickDump: "I might hurt myself and I am unsafe right now.",
      emotionalState: 5
    });

    expect(result).toEqual({
      kind: "safety-interruption",
      checkIn: {
        quickDump: "I might hurt myself and I am unsafe right now.",
        emotionalState: 5
      },
      savedCheckIn: {
        privateEntry: false,
        derivedMemory: false
      }
    });
  });
});

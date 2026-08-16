import { describe, expect, it } from "vitest";

import { completeCheckIn, type SavedCheckIn } from "./check-in-memory";
import { deriveYourPatterns } from "./your-patterns";

const checkIn = {
  quickDump: "I keep avoiding the first step of the project.",
  emotionalState: 4 as const
};

const taskPivot = {
  id: "task-first-visible-step",
  kind: "task-first-step" as const,
  title: "Make the next step visible",
  instruction: "Write the smallest action that takes less than ten minutes."
};

describe("deriveYourPatterns", () => {
  it("groups helpful outcomes and reports their typical Pivot time", () => {
    const records = [
      savedCheckIn("check-in-1", checkIn.quickDump, "completed", 90),
      savedCheckIn("check-in-2", checkIn.quickDump, "partly-helpful", 150),
      savedCheckIn("check-in-3", checkIn.quickDump, "skipped", 30)
    ];

    expect(
      deriveYourPatterns({
        accountId: "person-123",
        records,
        forgottenMemoryIds: []
      }).helpfulPivots
    ).toEqual([
      {
        pivotId: "task-first-visible-step",
        pivotKind: "task-first-step",
        pivotTitle: "Make the next step visible",
        helpfulOutcomeCount: 2,
        typicalPivotTimeSeconds: 120,
        memoryIds: ["check-in-1", "check-in-2"]
      }
    ]);
  });

  it("groups recurring Self-reported context and excludes forgotten history", () => {
    const records = [
      savedCheckIn(
        "check-in-1",
        "I keep circling around the decision.",
        "completed",
        90
      ),
      savedCheckIn(
        "check-in-2",
        "I cannot get started on this work assignment.",
        "partly-helpful",
        150
      ),
      savedCheckIn(
        "check-in-3",
        "I am hungry and need some water.",
        "completed",
        60
      )
    ];

    expect(
      deriveYourPatterns({
        accountId: "person-123",
        records,
        forgottenMemoryIds: ["check-in-3"]
      }).recurringContexts
    ).toEqual([
      {
        label: "work or task",
        checkInCount: 2,
        memoryIds: ["check-in-1", "check-in-2"]
      }
    ]);
  });

  it("does not call a one-off context recurring", () => {
    expect(
      deriveYourPatterns({
        accountId: "person-123",
        records: [
          savedCheckIn(
            "check-in-1",
            "I am hungry and need some water.",
            "completed",
            60
          )
        ]
      }).recurringContexts
    ).toEqual([]);
  });
});

function savedCheckIn(
  checkInId: string,
  quickDump: string,
  outcome: "completed" | "partly-helpful" | "skipped",
  pivotTimeSeconds: number
): SavedCheckIn {
  return completeCheckIn({
    accountId: "person-123",
    checkInId,
    checkIn: { ...checkIn, quickDump },
    selectedPivot: taskPivot,
    outcome: { kind: outcome },
    pivotTimeSeconds,
    saveCheckIn: true
  }).savedCheckIn!;
}

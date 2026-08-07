import { describe, expect, it } from "vitest";

import { completeCheckIn } from "./check-in-memory";

const checkIn = {
  quickDump: "I keep avoiding the first step of the project.",
  emotionalState: 4 as const
};

const pivot = {
  id: "task-first-visible-step",
  kind: "task-first-step" as const,
  title: "Make the next step visible",
  instruction: "Write the smallest action that takes less than ten minutes."
};

describe("completeCheckIn", () => {
  it("retains the Private entry, Derived memory, Pivot, and outcome for the account when saving is enabled", () => {
    expect(
      completeCheckIn({
        accountId: "person-123",
        checkInId: "check-in-1",
        checkIn,
        selectedPivot: pivot,
        outcome: { kind: "partly-helpful", updatedEmotionalState: 3 },
        saveCheckIn: true
      })
    ).toEqual({
      outcome: { kind: "partly-helpful", updatedEmotionalState: 3 },
      savedCheckIn: {
        id: "check-in-1",
        accountId: "person-123",
        privateEntry: checkIn,
        derivedMemory: {
          emotionalState: 4,
          selectedPivotKind: "task-first-step",
          outcome: "partly-helpful",
          updatedEmotionalState: 3
        },
        selectedPivot: pivot,
        pivotOutcome: { kind: "partly-helpful", updatedEmotionalState: 3 }
      }
    });
  });

  it("processes an unsaved Check-in without retaining a record", () => {
    expect(
      completeCheckIn({
        accountId: "person-123",
        checkInId: "check-in-2",
        checkIn,
        selectedPivot: pivot,
        outcome: { kind: "skipped" },
        saveCheckIn: false
      })
    ).toEqual({
      outcome: { kind: "skipped" }
    });
  });
});

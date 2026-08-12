import { describe, expect, it } from "vitest";

import {
  completeCheckIn,
  deleteSavedCheckIn,
  forgetPattern,
  inspectSavedCheckIns
} from "./check-in-memory";

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
          updatedEmotionalState: 3,
          embedding: expect.any(Array)
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

describe("memory control", () => {
  it("inspects only the Private entries and Derived memories owned by the account", () => {
    expect(
      inspectSavedCheckIns("person-123", [
        savedCheckIn("check-in-1", "person-123"),
        savedCheckIn("check-in-2", "person-999")
      ])
    ).toEqual([savedCheckIn("check-in-1", "person-123")]);
  });

  it("deletes an owned Check-in so its Private entry and Derived memory leave history", () => {
    expect(
      deleteSavedCheckIn(
        [savedCheckIn("check-in-1", "person-123"), savedCheckIn("check-in-2", "person-123")],
        "person-123",
        "check-in-1"
      )
    ).toEqual([savedCheckIn("check-in-2", "person-123")]);
  });

  it("does not delete a Check-in owned by another account", () => {
    const otherPersonCheckIn = savedCheckIn("check-in-2", "person-999");

    expect(
      deleteSavedCheckIn([otherPersonCheckIn], "person-123", "check-in-2")
    ).toEqual([otherPersonCheckIn]);
  });

  it("records a forgotten pattern only for an owned Check-in", () => {
    const records = [savedCheckIn("check-in-1", "person-123")];

    expect(
      forgetPattern({
        accountId: "person-123",
        checkInId: "check-in-1",
        records,
        forgottenMemoryIds: []
      })
    ).toEqual(["check-in-1"]);

    expect(
      forgetPattern({
        accountId: "person-999",
        checkInId: "check-in-1",
        records,
        forgottenMemoryIds: []
      })
    ).toEqual([]);
  });
});

function savedCheckIn(id: string, accountId: string) {
  return completeCheckIn({
    accountId,
    checkInId: id,
    checkIn,
    selectedPivot: pivot,
    outcome: { kind: "completed" },
    saveCheckIn: true
  }).savedCheckIn!;
}

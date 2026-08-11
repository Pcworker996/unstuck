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

  it("prioritizes a safety interruption for direct danger to another person", () => {
    const result = runPivotProtocol({
      quickDump: "I might harm another person right now, even though I need to finish this project.",
      emotionalState: 5
    });

    expect(result.kind).toBe("safety-interruption");
  });

  it("recognizes lethal danger to another person", () => {
    const result = runPivotProtocol({
      quickDump: "I might kill someone right now.",
      emotionalState: 5
    });

    expect(result.kind).toBe("safety-interruption");
  });

  it.each([
    "I might harm my child right now.",
    "I may kill my neighbor right now.",
    "I might shoot someone right now."
  ])("interrupts direct danger wording: %s", (quickDump) => {
    const result = runPivotProtocol({ quickDump, emotionalState: 5 });

    expect(result.kind).toBe("safety-interruption");
  });

  it("does not treat a negated immediate-danger statement as direct danger by itself", () => {
    const result = runPivotProtocol({
      quickDump: "I am not in immediate danger, but I feel overwhelmed by this project.",
      emotionalState: 4
    });

    expect(result.kind).toBe("pivot-protocol");
  });

  it.each([
    "I will not hurt someone right now.",
    "I am not suicidal.",
    "I am not going to hurt myself.",
    "I hurt someone yesterday.",
    "I might have hurt someone yesterday.",
    "I was going to hurt myself yesterday.",
    "I had suicidal thoughts but am safe now.",
    "I do not feel unsafe right now."
  ])("does not interrupt negated or historical danger wording: %s", (quickDump) => {
    const result = runPivotProtocol({ quickDump, emotionalState: 4 });

    expect(result.kind).toBe("pivot-protocol");
  });

  it.each([
    "I want to die right now.",
    "I plan to overdose.",
    "I might poison myself right now.",
    "I am going to stab him right now.",
    "I might hurt my kid right now.",
    "I am thinking about hurting myself right now.",
    "I am thinking about harming someone right now.",
    "I am not safe now.",
    "I am safe now but I might hurt myself.",
    "I might harm my wife right now.",
    "I am currently unsafe.",
    "I feel unsafe at the moment.",
    "I don't want to hurt myself, but I might."
  ])(
    "interrupts direct self-danger wording: %s",
    (quickDump) => {
      const result = runPivotProtocol({ quickDump, emotionalState: 5 });

      expect(result.kind).toBe("safety-interruption");
    }
  );

  it("recognizes saying that the person is not safe right now", () => {
    const result = runPivotProtocol({
      quickDump: "I am not safe right now and need urgent help.",
      emotionalState: 5
    });

    expect(result.kind).toBe("safety-interruption");
  });
});

import { describe, expect, it } from "vitest";

import {
  runGooglePivotCommand,
  type GooglePivotGenerator,
  type GooglePivotGeneratorOutput
} from "./google-pivot-protocol";
import { PIVOT_LIBRARY } from "./pivot-protocol";

function output(
  situationMap: GooglePivotGeneratorOutput["situationMap"],
  clarificationQuestion?: { id: string; text: string }
): GooglePivotGeneratorOutput {
  return {
    situationMap,
    primaryPivotKind: PIVOT_LIBRARY[0].kind,
    alternativePivotKinds: [PIVOT_LIBRARY[1].kind, PIVOT_LIBRARY[2].kind],
    whyThisPivot: "A small next step is available.",
    ...(clarificationQuestion ? { clarificationQuestion } : {})
  };
}

describe("collaborative Google Pivot Protocol", () => {
  it("asks one clarification at a time, allows skips, and caps questions at two", async () => {
    let generation = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        generation += 1;
        return output(
          situationMap,
          generation < 3 ? { id: `question-${generation}`, text: `What would help next? (${generation})` } : undefined
        );
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I cannot begin the moving checklist.",
      consentGiven: true
    }, generator);

    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    expect(started.state.phase).toBe("clarifying");
    expect(started.state.clarification?.question.id).toBe("question-1");

    const answered = await runGooglePivotCommand(started.state, {
      type: "answer-clarification",
      questionId: "question-1",
      answer: "Knowing the deadline would help."
    }, generator);

    expect(answered.kind).toBe("ok");
    if (answered.kind !== "ok") return;
    expect(answered.state.phase).toBe("clarifying");
    expect(answered.state.clarification?.question.id).toBe("question-2");
    expect(answered.state.clarification?.answers).toHaveLength(1);

    const skipped = await runGooglePivotCommand(answered.state, {
      type: "skip-clarification",
      questionId: "question-2"
    }, generator);

    expect(skipped.kind).toBe("ok");
    if (skipped.kind !== "ok") return;
    expect(skipped.state.phase).toBe("recommended");
    expect(skipped.state.recommendation).toBeDefined();
    expect(skipped.state.clarification?.answers).toHaveLength(2);
    expect(skipped.state.activity.map((event) => event.kind)).toContain("clarification-skipped");
  });

  it("makes a person correction visible, preserves provenance, and regenerates from the corrected map", async () => {
    const seenMaps: string[] = [];
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        seenMaps.push(situationMap.shared[0].text);
        return output(situationMap);
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to contact the landlord.",
      consentGiven: true
    }, generator);

    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const corrected = await runGooglePivotCommand(started.state, {
      type: "correct-map",
      section: "shared",
      itemId: "shared-1",
      text: "I need to contact the property manager by Friday."
    }, generator);

    expect(corrected.kind).toBe("ok");
    if (corrected.kind !== "ok") return;
    expect(corrected.state.situationMap.shared[0]).toMatchObject({
      text: "I need to contact the property manager by Friday.",
      provenance: "person"
    });
    expect(corrected.state.revisions).toHaveLength(1);
    expect(corrected.state.revisions[0]).toMatchObject({
      section: "shared",
      itemId: "shared-1",
      editedBy: "person"
    });
    expect(corrected.state.activity.at(-1)?.kind).toBe("map-revised");
    expect(seenMaps.at(-1)).toBe("I need to contact the property manager by Friday.");
  });

  it("keeps Pivot selection and outcome as explicit state changes", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a small task.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const selected = await runGooglePivotCommand(started.state, {
      type: "select-pivot",
      pivotKind: PIVOT_LIBRARY[0].kind
    });
    expect(selected.kind).toBe("ok");
    if (selected.kind !== "ok") return;
    expect(selected.state.phase).toBe("selected");
    expect(selected.state.selectedPivot?.kind).toBe(PIVOT_LIBRARY[0].kind);

    const outcome = await runGooglePivotCommand(selected.state, {
      type: "record-outcome",
      outcome: { status: "partly-helpful", agencyShift: "more-able", pivotTimeSeconds: 60 }
    });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.state.phase).toBe("outcome");
    expect(outcome.state.outcome).toEqual({
      status: "partly-helpful",
      agencyShift: "more-able",
      pivotTimeSeconds: 60
    });
    expect(outcome.state.situationMap.pivotHistory).toHaveLength(1);
    expect(outcome.state.activity.at(-1)?.kind).toBe("outcome-recorded");
  });
});

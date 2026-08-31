import { describe, expect, it } from "vitest";

import {
  runGooglePivotCommand,
  type GooglePivotAdaptation,
  type GooglePivotGenerator,
  type GooglePivotGeneratorOutput,
  type PivotOutcome
} from "./google-pivot-protocol";
import { PIVOT_LIBRARY } from "./pivot-library";

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

async function confirmedOutcome(
  state: Extract<Awaited<ReturnType<typeof runGooglePivotCommand>>, { kind: "ok" }>['state'],
  outcome: PivotOutcome,
  generator?: GooglePivotGenerator
) {
  const requested = await runGooglePivotCommand(state, { type: "record-outcome", outcome }, generator);
  if (requested.kind !== "ok") return requested;
  return runGooglePivotCommand(requested.state, {
    type: "confirm-action",
    confirmationId: requested.state.pendingConfirmation?.id ?? "missing"
  }, generator);
}

describe("collaborative Google Pivot Protocol", () => {
  it("generates situational actions one step at a time from explicit feedback", async () => {
    let generations = 0;
    const action = (step: number) => ({
      id: `action-${step}`,
      kind: "task-first-step" as const,
      title: `Start synthetic step ${step}`,
      instruction: `Do the synthetic step ${step} for this situation.`,
      goal: `Complete the goal for synthetic step ${step}.`,
      steps: [`Start synthetic step ${step}.`],
      doneWhen: `Synthetic step ${step} has been attempted.`,
      estimatedMinutes: 5,
      fallbackInstruction: `Make synthetic step ${step} smaller.`,
      whyThisFits: `The previous feedback supports synthetic step ${step}.`
    });
    const generator: GooglePivotGenerator = {
      async generate({ situationMap, currentAction, stepFeedback }) {
        generations += 1;
        const step = currentAction && stepFeedback ? generations : 1;
        return {
          situationMap,
          primaryPivotKind: "task-first-step",
          alternativePivotKinds: ["grounding", "reaching-out"],
          primaryAction: action(step),
          alternativeActions: [
            { ...action(step), id: `grounding-${step}`, kind: "grounding", title: `Name grounding alternative ${step}` },
            { ...action(step), id: `reaching-out-${step}`, kind: "reaching-out", title: `Send connection alternative ${step}` }
          ],
          whyThisPivot: "The action reflects the current synthetic situation."
        };
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to sort a synthetic task.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok" || !started.state.recommendation) return;

    const selected = await runGooglePivotCommand(started.state, {
      type: "select-pivot",
      pivotKind: "task-first-step"
    }, generator);
    expect(selected.kind).toBe("ok");
    if (selected.kind !== "ok") return;
    expect(selected.state.miniPlan).toMatchObject({ stepNumber: 1, currentAction: { title: "Start synthetic step 1" } });

    const next = await runGooglePivotCommand(selected.state, {
      type: "record-step-feedback",
      feedback: { status: "completed" }
    }, generator);
    expect(next.kind).toBe("ok");
    if (next.kind !== "ok") return;
    expect(next.state.miniPlan).toMatchObject({ stepNumber: 2, currentAction: { title: "Start synthetic step 2" }, feedback: [{ status: "completed" }] });
    expect(next.state.activity).toContainEqual({
      kind: "step-generation",
      message: "The next situational Pivot action was generated from the person's feedback."
    });

    const finalStep = await runGooglePivotCommand(next.state, {
      type: "record-step-feedback",
      feedback: { status: "blocked", note: "Synthetic blocker" }
    }, generator);
    expect(finalStep.kind).toBe("ok");
    if (finalStep.kind !== "ok") return;
    expect(finalStep.state.miniPlan).toMatchObject({ stepNumber: 3, currentAction: { title: "Start synthetic step 3" }, feedback: [{ status: "completed" }, { status: "blocked", note: "Synthetic blocker" }] });

    const completedFinalStep = await runGooglePivotCommand(finalStep.state, {
      type: "record-step-feedback",
      feedback: { status: "partly-helpful" }
    }, generator);
    expect(completedFinalStep.kind).toBe("ok");
    if (completedFinalStep.kind !== "ok") return;
    expect(completedFinalStep.state.miniPlan?.stepNumber).toBe(3);
    expect(completedFinalStep.state.miniPlan?.feedback).toHaveLength(3);

    await expect(runGooglePivotCommand(completedFinalStep.state, {
      type: "record-step-feedback",
      feedback: { status: "completed" }
    }, generator)).resolves.toMatchObject({
      kind: "invalid-command",
      message: "The three-step Pivot mini-plan is complete."
    });
    expect(generations).toBe(3);
  });

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
    expect(started.state.recommendation).toBeUndefined();
    expect(started.state.clarification?.question.id).toBe("question-1");

    const answered = await runGooglePivotCommand(started.state, {
      type: "answer-clarification",
      questionId: "question-1",
      answer: "Knowing the deadline would help."
    }, generator);

    expect(answered.kind).toBe("ok");
    if (answered.kind !== "ok") return;
    expect(answered.state.phase).toBe("clarifying");
    expect("recommendation" in answered.state).toBe(false);
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

    const outcome = await confirmedOutcome(selected.state, { status: "partly-helpful", agencyShift: "more-able", pivotTimeSeconds: 60 });
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

  it("saves an approved Derived memory only when the person chose saving", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a small task.",
      consentGiven: true,
      saveRequested: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    expect(started.state.saveRequested).toBe(true);
    expect(started.state.persistence).toBe("pending");

    const selected = await runGooglePivotCommand(started.state, {
      type: "select-pivot",
      pivotKind: PIVOT_LIBRARY[0].kind
    });
    expect(selected.kind).toBe("ok");
    if (selected.kind !== "ok") return;

    const outcome = await confirmedOutcome(selected.state, { status: "completed", agencyShift: "more-able" });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.state.persistence).toBe("saved");
    expect(outcome.state.enrichment).toBe("saved");
    expect(outcome.state.derivedMemory).toMatchObject({ approved: true });

    const unsaved = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on another task.",
      consentGiven: true,
      saveRequested: false
    });
    expect(unsaved.kind).toBe("ok");
    if (unsaved.kind !== "ok") return;
    const unsavedSelected = await runGooglePivotCommand(unsaved.state, {
      type: "select-pivot",
      pivotKind: PIVOT_LIBRARY[0].kind
    });
    if (unsavedSelected.kind !== "ok") return;
    const unsavedOutcome = await confirmedOutcome(unsavedSelected.state, { status: "skipped" });
    expect(unsavedOutcome).toMatchObject({ kind: "ok", state: { persistence: "unsaved", derivedMemory: undefined } });
  });

  it("keeps a saved outcome when Derived-memory enrichment is unavailable", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck.",
      consentGiven: true,
      saveRequested: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    const selected = await runGooglePivotCommand(started.state, {
      type: "select-pivot",
      pivotKind: PIVOT_LIBRARY[0].kind
    });
    if (selected.kind !== "ok") return;

    const outcome = await confirmedOutcome(selected.state, { status: "partly-helpful", agencyShift: "about-as-able" }, {
      async generate({ situationMap }) { return output(situationMap); },
      async deriveMemory() { throw new Error("memory provider unavailable"); }
    });

    expect(outcome).toMatchObject({
      kind: "ok",
      state: { phase: "outcome", persistence: "saved", enrichment: "unavailable", outcome: { status: "partly-helpful" } }
    });
    if (outcome.kind !== "ok") return;
    expect(outcome.state.derivedMemory).toBeUndefined();
  });

  it("accepts every outcome and Agency-shift value without numeric wellness state", async () => {
    const combinations = [
      ["completed", "more-able"],
      ["partly-helpful", "about-as-able"],
      ["not-a-fit", "less-able"],
      ["skipped", undefined]
    ] as const;

    for (const [status, agencyShift] of combinations) {
      const started = await runGooglePivotCommand(undefined, {
        type: "start",
        quickDump: `Outcome test: ${status}`,
        consentGiven: true
      });
      expect(started.kind).toBe("ok");
      if (started.kind !== "ok") continue;
      const selected = await runGooglePivotCommand(started.state, {
        type: "select-pivot",
        pivotKind: PIVOT_LIBRARY[0].kind
      });
      expect(selected.kind).toBe("ok");
      if (selected.kind !== "ok") continue;
      const outcome = await confirmedOutcome(selected.state, { status, ...(agencyShift ? { agencyShift } : {}) });
      expect(outcome).toMatchObject({ kind: "ok", state: { outcome: { status, ...(agencyShift ? { agencyShift } : {}) } } });
      if (outcome.kind === "ok") {
        expect(outcome.state).not.toHaveProperty("emotionalState");
        expect(outcome.state).not.toHaveProperty("wellnessScore");
      }
    }
  });

  it("keeps a save-preparation failure non-persistent", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck.",
      consentGiven: true,
      saveRequested: true
    }, {
      async generate({ situationMap }) { return output(situationMap); },
      async prepareMemory() { throw new Error("memory preparation unavailable"); }
    });

    expect(started).toMatchObject({ kind: "ok", state: { saveRequested: false, persistence: "unsaved" } });
  });

  it("disables saving when a later recommendation falls back", async () => {
    let generations = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        generations += 1;
        if (generations > 1) throw new Error("recommendation unavailable");
        return output(situationMap);
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a task.",
      consentGiven: true,
      saveRequested: true
    }, generator);
    expect(started).toMatchObject({ kind: "ok", state: { saveRequested: true, persistence: "pending" } });
    if (started.kind !== "ok") return;

    const fallback = await runGooglePivotCommand(started.state, {
      type: "add-context",
      message: "The first step still feels too large."
    }, generator);

    expect(fallback).toMatchObject({
      kind: "ok",
      state: { fallback: true, saveRequested: false, persistence: "unsaved", pendingDerivedContext: undefined }
    });
  });

  it("disables saving when personalization falls back after a saved start", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a task.",
      consentGiven: true,
      saveRequested: true
    }, {
      async generate({ situationMap }) { return output(situationMap); },
      async adapt() { throw new Error("personalization unavailable"); }
    }, {
      ownerSubject: "owner-1",
      embed: async () => [],
      retrieveSimilarMemories: async () => [],
      listGuidancePreferences: async () => [{ id: "preference-1", text: "Keep it concrete.", createdAt: "2026-08-31T00:00:00.000Z" }]
    });

    expect(started).toMatchObject({
      kind: "ok",
      state: { fallback: true, saveRequested: true, persistence: "pending" }
    });
    if (started.kind === "ok") expect(started.state.pendingDerivedContext).toBeDefined();
  });

  it("keeps unresolved contradictions while a correction regenerates the map", async () => {
    let generation = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        generation += 1;
        return output({
          ...situationMap,
          contradictions: generation === 1
            ? [{ id: "contradiction-1", text: "Two deadlines conflict.", provenance: "guide" }]
            : []
        });
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "The dates in my checklist do not agree.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const corrected = await runGooglePivotCommand(started.state, {
      type: "correct-map",
      section: "shared",
      itemId: "shared-1",
      text: "The dates in the lease and checklist conflict."
    }, generator);
    expect(corrected.kind).toBe("ok");
    if (corrected.kind !== "ok") return;
    expect(corrected.state.situationMap.contradictions).toHaveLength(1);
  });

  it("keeps the original provenance when a person corrects a guide interpretation", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to decide what to do next.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const corrected = await runGooglePivotCommand(started.state, {
      type: "correct-map",
      section: "interpretations",
      itemId: "interpretation-1",
      text: "That interpretation is not accurate for me."
    });
    expect(corrected.kind).toBe("ok");
    if (corrected.kind !== "ok") return;
    expect(corrected.state.situationMap.interpretations[0].provenance).toBe("guide");
    expect(corrected.state.revisions[0].previousProvenance).toBe("guide");
  });

  it("regenerates through the generator using the current corrected map", async () => {
    let calls = 0;
    let seenText = "";
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        calls += 1;
        seenText = situationMap.shared[0].text;
        return {
          ...output(situationMap),
          primaryPivotKind: calls === 1 ? PIVOT_LIBRARY[0].kind : PIVOT_LIBRARY[3].kind,
          alternativePivotKinds: calls === 1
            ? [PIVOT_LIBRARY[1].kind, PIVOT_LIBRARY[2].kind]
            : [PIVOT_LIBRARY[4].kind, PIVOT_LIBRARY[1].kind]
        };
      }
    };
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const regenerated = await runGooglePivotCommand(started.state, { type: "regenerate-pivot" }, generator);
    expect(regenerated.kind).toBe("ok");
    expect(seenText).toBe("I am stuck.");
    if (regenerated.kind !== "ok") return;
    if (!regenerated.state.recommendation) return;
    expect(calls).toBe(2);
    expect(regenerated.state.recommendation.primary.kind).toBe(PIVOT_LIBRARY[3].kind);
    expect(regenerated.state.activity.at(-1)?.kind).toBe("recommendation-regenerated");
  });

  it("requires an explicit contradiction resolution before removing it", async () => {
    let generation = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        generation += 1;
        return {
          ...output({
            ...situationMap,
            contradictions: generation === 1
              ? [{ id: "contradiction-1", text: "The sources disagree.", provenance: "guide" }]
              : []
          }),
          primaryPivotKind: generation === 1 ? PIVOT_LIBRARY[0].kind : PIVOT_LIBRARY[1].kind,
          alternativePivotKinds: generation === 1
            ? [PIVOT_LIBRARY[1].kind, PIVOT_LIBRARY[2].kind]
            : [PIVOT_LIBRARY[2].kind, PIVOT_LIBRARY[3].kind]
        };
      }
    };
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "Two sources disagree.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const resolved = await runGooglePivotCommand(started.state, {
      type: "resolve-contradiction",
      itemId: "contradiction-1"
    }, generator);
    expect(resolved.kind).toBe("ok");
    if (resolved.kind !== "ok") return;
    expect(resolved.state.situationMap.contradictions).toEqual([]);
    expect(resolved.state.recommendation?.primary.kind).toBe(PIVOT_LIBRARY[1].kind);
  });

  it("preserves corrections and keeps a resolved contradiction out of regenerated state", async () => {
    let generation = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        generation += 1;
        return output({
          ...situationMap,
          interpretations: [{
            ...situationMap.interpretations[0],
            text: generation === 1 ? situationMap.interpretations[0].text : "A model replacement that must not win."
          }],
          contradictions: [{ id: "contradiction-1", text: "The sources disagree.", provenance: "guide" }]
        });
      }
    };

    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "Two sources disagree.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const corrected = await runGooglePivotCommand(started.state, {
      type: "correct-map",
      section: "interpretations",
      itemId: "interpretation-1",
      text: "That interpretation is not accurate for me."
    }, generator);
    expect(corrected.kind).toBe("ok");
    if (corrected.kind !== "ok") return;

    const resolved = await runGooglePivotCommand(corrected.state, {
      type: "resolve-contradiction",
      itemId: "contradiction-1"
    }, generator);
    expect(resolved.kind).toBe("ok");
    if (resolved.kind !== "ok") return;
    expect(resolved.state.situationMap.interpretations[0].text).toBe("That interpretation is not accurate for me.");
    expect(resolved.state.situationMap.contradictions).toEqual([]);
  });

  it("surfaces a curated fallback when regeneration cannot complete", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const regenerated = await runGooglePivotCommand(started.state, { type: "regenerate-pivot" }, {
      async generate() {
        throw new Error("generator unavailable");
      }
    });
    expect(regenerated.kind).toBe("ok");
    if (regenerated.kind !== "ok") return;
    expect(regenerated.state.fallback).toBe(true);
    expect(regenerated.state.activity.at(-1)?.kind).toBe("fallback");
  });

  it("does not let generated output rewrite person-owned facts or add person claims", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to start the lease checklist.",
      consentGiven: true
    }, {
      async generate({ situationMap }) {
        return output({
          ...situationMap,
          shared: [{ ...situationMap.shared[0], text: "The guide says I need to start." }],
          constraints: [{ id: "constraint-1", text: "The guide invented this constraint.", provenance: "person" }],
          artifactClaims: [{ id: "artifact-1", text: "An unapproved artifact claim.", provenance: "artifact" }]
        });
      }
    });

    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    expect(started.state.fallback).toBe(true);
    expect(started.state.situationMap.shared[0]).toMatchObject({
      text: "I need to start the lease checklist.",
      provenance: "person"
    });
    expect(started.state.situationMap.constraints).toEqual([]);
    expect(started.state.situationMap.artifactClaims).toEqual([]);
  });

  it("applies provenance protection to repaired generated output", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to start the lease checklist.",
      consentGiven: true
    }, {
      async generate({ situationMap }) {
        return {
          ...output(situationMap),
          primaryPivotKind: "not-a-pivot",
          alternativePivotKinds: []
        };
      },
      async repair({ situationMap }) {
        return output({
          ...situationMap,
          shared: [{ ...situationMap.shared[0], text: "A repaired guide claim." }],
          artifactClaims: [{ id: "artifact-1", text: "An unapproved repaired artifact claim.", provenance: "artifact" }]
        });
      }
    });

    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    expect(started.state.fallback).toBe(true);
    expect(started.state.situationMap.shared[0].text).toBe("I need to start the lease checklist.");
    expect(started.state.situationMap.artifactClaims).toEqual([]);
  });

  it("does not allow map edits after a Pivot has been selected", async () => {
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

    await expect(runGooglePivotCommand(selected.state, {
      type: "correct-map",
      section: "shared",
      itemId: "shared-1",
      text: "A late correction"
    })).resolves.toEqual({
      kind: "invalid-command",
      message: "Situation-map edits must happen before choosing a Pivot."
    });
  });

  it("keeps natural context in a temporary timeline and makes the structured update undoable", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I need to sort the move paperwork.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const added = await runGooglePivotCommand(started.state, {
      type: "add-context",
      message: "The landlord needs the checklist by Friday."
    });
    expect(added.kind).toBe("ok");
    if (added.kind !== "ok") return;
    expect(added.state.situationMap.shared.at(-1)).toMatchObject({
      text: "The landlord needs the checklist by Friday.",
      provenance: "person"
    });
    expect(added.state.conversation.at(-1)).toMatchObject({
      userMessage: "The landlord needs the checklist by Friday.",
      guideResponse: { acknowledgment: expect.any(String) },
      updates: expect.arrayContaining([expect.objectContaining({ kind: "situation-map", undoable: true })])
    });
    const update = added.state.undoableUpdates.at(-1);
    expect(update).toMatchObject({ kind: "stated-context", summary: expect.any(String) });

    const undone = await runGooglePivotCommand(added.state, {
      type: "undo-update",
      updateId: update?.id ?? "missing"
    });
    expect(undone).toMatchObject({ kind: "ok", state: { situationMap: started.state.situationMap } });
    if (undone.kind !== "ok") return;
    expect(undone.state.undoableUpdates).toEqual([]);
    expect(undone.state.activity.at(-1)).toMatchObject({ kind: "undo-applied" });
  });

  it("keeps a clarification visible while corrections change the eventual recommendation", async () => {
    const generator: GooglePivotGenerator = {
      async generate({ situationMap, clarificationAnswers }) {
        const hasFriday = situationMap.shared.some((item) => item.text.includes("Friday"));
        const answered = Boolean(clarificationAnswers?.length);
        return {
          ...output(situationMap, answered ? undefined : { id: "deadline", text: "What timing matters most?" }),
          primaryPivotKind: hasFriday ? "task-first-step" : "grounding",
          alternativePivotKinds: hasFriday ? ["reaching-out", "basic-needs-reset"] : ["breathing-focus", "reaching-out"]
        };
      }
    };
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on moving paperwork.",
      consentGiven: true
    }, generator);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const corrected = await runGooglePivotCommand(started.state, {
      type: "correct-map",
      section: "shared",
      itemId: "shared-1",
      text: "I am stuck on moving paperwork due Friday deadline."
    }, generator);
    expect(corrected).toMatchObject({ kind: "ok", state: { phase: "clarifying", recommendation: undefined } });
    if (corrected.kind !== "ok") return;

    const answered = await runGooglePivotCommand(corrected.state, {
      type: "answer-clarification",
      questionId: "deadline",
      answer: "Friday is the deadline."
    }, generator);
    expect(answered).toMatchObject({ kind: "ok", state: { phase: "recommended", recommendation: { primary: { kind: "task-first-step" } } } });
    if (answered.kind !== "ok") return;
    expect(answered.state.conversation.at(-1)?.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "recommendation" })
    ]));
  });

  it("shows a smaller action as an undoable update and gates final outcome recording", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a work task.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok" || !started.state.recommendation) return;
    const selected = await runGooglePivotCommand(started.state, {
      type: "select-pivot",
      pivotKind: started.state.recommendation.primary.kind
    });
    expect(selected.kind).toBe("ok");
    if (selected.kind !== "ok") return;

    const shrunk = await runGooglePivotCommand(selected.state, { type: "shrink-action" });
    expect(shrunk).toMatchObject({ kind: "ok", state: { phase: "selected", miniPlan: { currentAction: { estimatedMinutes: 1 } } } });
    if (shrunk.kind !== "ok") return;
    const shrinkUpdate = shrunk.state.undoableUpdates.at(-1);
    expect(shrinkUpdate).toMatchObject({ kind: "action-shrink" });

    const requested = await runGooglePivotCommand(shrunk.state, {
      type: "record-outcome",
      outcome: { status: "completed", agencyShift: "more-able" }
    });
    expect(requested).toMatchObject({ kind: "ok", state: { phase: "selected", pendingConfirmation: { kind: "record-outcome" } } });
    if (requested.kind !== "ok") return;
    const confirmationId = requested.state.pendingConfirmation?.id;
    const confirmed = await runGooglePivotCommand(requested.state, {
      type: "confirm-action",
      confirmationId: confirmationId ?? "missing"
    });
    expect(confirmed).toMatchObject({ kind: "ok", state: { phase: "outcome", outcome: { status: "completed", agencyShift: "more-able" } } });
  });

  it("requires visible confirmation before forgetting a saved memory", async () => {
    let forgetCalls = 0;
    const adaptation: GooglePivotAdaptation = {
      ownerSubject: "person-1",
      embed: async () => new Array(768).fill(0),
      retrieveSimilarMemories: async () => [],
      listGuidancePreferences: async () => [],
      forgetMemory: async () => {
        forgetCalls += 1;
        return true;
      }
    };
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a normal task.",
      consentGiven: true
    }, undefined, adaptation);
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;
    const withMemory = {
      ...started.state,
      memoryExplanations: [{ memoryId: "memory-1", protocolId: "prior-check-in", text: "A saved Check-in used a small action." }]
    };

    const requested = await runGooglePivotCommand(withMemory, { type: "forget-memory", memoryId: "memory-1" }, undefined, adaptation);
    expect(requested).toMatchObject({ kind: "ok", state: { pendingConfirmation: { kind: "forget-memory" } } });
    expect(forgetCalls).toBe(0);
    if (requested.kind !== "ok") return;

    const cancelled = await runGooglePivotCommand(requested.state, {
      type: "cancel-confirmation",
      confirmationId: requested.state.pendingConfirmation?.id ?? "missing"
    }, undefined, adaptation);
    expect(cancelled).toMatchObject({ kind: "ok", state: { pendingConfirmation: undefined } });
    expect(forgetCalls).toBe(0);
    if (cancelled.kind !== "ok") return;

    const requestedAgain = await runGooglePivotCommand(cancelled.state, { type: "forget-memory", memoryId: "memory-1" }, undefined, adaptation);
    expect(requestedAgain.kind).toBe("ok");
    if (requestedAgain.kind !== "ok") return;
    const confirmed = await runGooglePivotCommand(requestedAgain.state, {
      type: "confirm-action",
      confirmationId: requestedAgain.state.pendingConfirmation?.id ?? "missing"
    }, undefined, adaptation);
    expect(confirmed).toMatchObject({ kind: "ok", state: { pendingConfirmation: undefined, memoryExplanations: [] } });
    expect(forgetCalls).toBe(1);
  });

  it("requires confirmation before dismissing or discarding the active Check-in", async () => {
    const started = await runGooglePivotCommand(undefined, {
      type: "start",
      quickDump: "I am stuck on a normal task.",
      consentGiven: true
    });
    expect(started.kind).toBe("ok");
    if (started.kind !== "ok") return;

    const dismissal = await runGooglePivotCommand(started.state, { type: "dismiss-pivot" });
    expect(dismissal).toMatchObject({ kind: "ok", state: { phase: "recommended", pendingConfirmation: { kind: "dismiss-pivot" } } });
    if (dismissal.kind !== "ok") return;
    const dismissed = await runGooglePivotCommand(dismissal.state, {
      type: "confirm-action",
      confirmationId: dismissal.state.pendingConfirmation?.id ?? "missing"
    });
    expect(dismissed).toMatchObject({ kind: "ok", state: { phase: "dismissed", pendingConfirmation: undefined } });
    if (dismissed.kind !== "ok") return;

    const discard = await runGooglePivotCommand(started.state, { type: "request-discard" });
    expect(discard).toMatchObject({ kind: "ok", state: { phase: "recommended", pendingConfirmation: { kind: "discard-check-in" } } });
    if (discard.kind !== "ok") return;
    const discarded = await runGooglePivotCommand(discard.state, {
      type: "confirm-action",
      confirmationId: discard.state.pendingConfirmation?.id ?? "missing"
    });
    expect(discarded).toMatchObject({ kind: "ok", state: { phase: "dismissed", pendingConfirmation: undefined, recommendation: undefined } });
  });
});

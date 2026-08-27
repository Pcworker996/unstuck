import { indicatesImmediateDanger } from "./safety-interruption";
import { PIVOT_LIBRARY, type Pivot, type PivotKind } from "./pivot-protocol";

export type Provenance = "person" | "artifact" | "guide";

export type SituationMapItem = {
  id: string;
  text: string;
  provenance: Provenance;
};

export type SituationMap = {
  shared: SituationMapItem[];
  artifactClaims: SituationMapItem[];
  interpretations: SituationMapItem[];
  uncertainties: SituationMapItem[];
  contradictions: SituationMapItem[];
  constraints: SituationMapItem[];
  progress: SituationMapItem[];
  pivotHistory: SituationMapItem[];
  priorPatterns: SituationMapItem[];
};

export type ClarificationQuestion = {
  id: string;
  text: string;
};

export type ClarificationAnswer = {
  questionId: string;
  answer?: string;
  skipped: boolean;
};

export type MapRevision = {
  section: keyof SituationMap;
  itemId: string;
  previousText: string;
  previousProvenance: Provenance;
  text: string;
  provenance: Provenance;
  editedBy: "person";
};

export type PivotOutcome = {
  status: "completed" | "partly-helpful" | "not-a-fit" | "skipped";
  agencyShift?: "more-able" | "about-as-able" | "less-able";
  pivotTimeSeconds?: number;
};

export type ActivityEvent = {
  kind:
    | "safety-completed"
    | "consent-verified"
    | "map-created"
    | "clarification-question"
    | "clarification-answer"
    | "clarification-skipped"
    | "map-revised"
    | "contradiction-resolved"
    | "pivot-selected"
    | "recommendation-regenerated"
    | "pivot-dismissed"
    | "outcome-recorded"
    | "generation"
    | "validation"
    | "fallback";
  message: string;
};

export type GooglePivotGeneratorOutput = {
  situationMap: SituationMap;
  primaryPivotKind: string;
  alternativePivotKinds: string[];
  whyThisPivot: string;
  clarificationQuestion?: ClarificationQuestion;
};

export type GooglePivotGenerator = {
  generate: (input: {
    quickDump: string;
    situationMap: SituationMap;
    clarificationAnswers?: ClarificationAnswer[];
  }) => Promise<unknown>;
  repair?: (input: {
    quickDump: string;
    situationMap: SituationMap;
    invalidOutput: unknown;
    clarificationAnswers?: ClarificationAnswer[];
  }) => Promise<unknown>;
};

export type GooglePivotPhase = "clarifying" | "recommended" | "selected" | "outcome" | "dismissed";

export type GooglePivotResult =
  | { kind: "consent-required" }
  | {
      kind: "safety-interruption";
      checkIn: { quickDump: string };
      activity: ActivityEvent[];
    }
  | {
      kind: "pivot-protocol";
      checkIn: { quickDump: string };
      situationMap: SituationMap;
      version: number;
      phase: GooglePivotPhase;
      clarification?: {
        question: ClarificationQuestion;
        answers: ClarificationAnswer[];
      };
      revisions: MapRevision[];
      selectedPivot?: Pivot;
      outcome?: PivotOutcome;
      recommendation?: {
        primary: Pivot;
        alternatives: Pivot[];
        whyThisPivot: string;
      };
      activity: ActivityEvent[];
      fallback: boolean;
    };

export function googlePivotSafetyResult(
  quickDump: string
): Extract<GooglePivotResult, { kind: "safety-interruption" }> | undefined {
  const normalizedQuickDump = quickDump.trim();
  if (!indicatesImmediateDanger(normalizedQuickDump)) return undefined;
  return {
    kind: "safety-interruption",
    checkIn: { quickDump: normalizedQuickDump },
    activity: [
      {
        kind: "safety-completed",
        message: "Safety gate completed; normal Pivot processing was interrupted."
      },
      {
        kind: "fallback",
        message: "Safety interruption returned app-owned urgent-support guidance."
      }
    ]
  };
}

export async function runGooglePivotProtocol(
  input: { quickDump: string; consentGiven: boolean },
  generator: GooglePivotGenerator = defaultGenerator
): Promise<GooglePivotResult> {
  const quickDump = input.quickDump.trim();
  const safetyResult = googlePivotSafetyResult(quickDump);
  if (safetyResult) return safetyResult;

  if (!input.consentGiven) {
    return { kind: "consent-required" };
  }

  const activity: ActivityEvent[] = [
    { kind: "safety-completed", message: "Safety gate completed." },
    { kind: "consent-verified", message: "Processing consent confirmed." }
  ];
  const situationMap = createSituationMap(quickDump);
  activity.push({ kind: "map-created", message: "Situation map created." });

  let output: GooglePivotGeneratorOutput;
  let fallback = false;
  let generatedOutput: unknown;
  try {
    generatedOutput = await generator.generate({ quickDump, situationMap });
    activity.push({ kind: "generation", message: "Bounded Pivot generation completed." });
    validateGeneratorOutput(generatedOutput, situationMap);
    output = {
      ...generatedOutput,
      situationMap: preserveAcceptedMapItems(generatedOutput.situationMap, situationMap, [])
    };
  } catch (error) {
    if (generatedOutput !== undefined) {
      activity.push({
        kind: "validation",
        message: "Generated output failed schema validation; one bounded repair was attempted."
      });
    }
    if (!generator.repair) {
      output = fallbackOutput(quickDump, situationMap);
      fallback = true;
    } else {
      try {
        const repairedOutput = await generator.repair({
          quickDump,
          situationMap,
          invalidOutput: generatedOutput ?? error
        });
        validateGeneratorOutput(repairedOutput, situationMap);
        output = {
          ...repairedOutput,
          situationMap: preserveAcceptedMapItems(repairedOutput.situationMap, situationMap, [])
        };
        activity.push({ kind: "generation", message: "Bounded Pivot generation repaired once." });
      } catch {
        output = fallbackOutput(quickDump, situationMap);
        fallback = true;
      }
    }
  }

  if (!fallback) {
    activity.push({ kind: "validation", message: "Generated map and Pivots validated." });
  } else {
    activity.push({ kind: "fallback", message: "Curated fallback preserved the accepted Quick dump." });
  }
  if (output.clarificationQuestion) {
    activity.push({ kind: "clarification-question", message: "One clarification question is ready." });
  }

  return {
    kind: "pivot-protocol",
    checkIn: { quickDump },
    version: 0,
    phase: output.clarificationQuestion ? "clarifying" : "recommended",
    situationMap: output.situationMap,
    ...(output.clarificationQuestion
      ? { clarification: { question: output.clarificationQuestion, answers: [] } }
      : {}),
    revisions: [],
    ...(output.clarificationQuestion ? {} : { recommendation: recommendationFromOutput(output) }),
    activity,
    fallback
  };
}

export type GooglePivotCommand =
  | { type: "start"; quickDump: string; consentGiven: boolean }
  | { type: "answer-clarification"; questionId: string; answer: string }
  | { type: "skip-clarification"; questionId: string }
  | {
      type: "correct-map";
      section: keyof SituationMap;
      itemId: string;
      text: string;
    }
  | { type: "resolve-contradiction"; itemId: string }
  | { type: "select-pivot"; pivotKind: string }
  | { type: "regenerate-pivot" }
  | { type: "dismiss-pivot" }
  | { type: "record-outcome"; outcome: PivotOutcome };

export type GooglePivotCommandResult =
  | { kind: "ok"; state: Extract<GooglePivotResult, { kind: "pivot-protocol" }> }
  | { kind: "consent-required" }
  | { kind: "safety-interruption"; result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }
  | { kind: "invalid-command"; message: string };

export async function runGooglePivotCommand(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }> | undefined,
  command: GooglePivotCommand,
  generator: GooglePivotGenerator = defaultGenerator
): Promise<GooglePivotCommandResult> {
  if (command.type === "start") {
    if (current) {
      return { kind: "invalid-command", message: "This protocol has already started." };
    }

    const result = await runGooglePivotProtocol(command, generator);
    if (result.kind === "pivot-protocol") return { kind: "ok", state: result };
    if (result.kind === "consent-required") return result;
    return { kind: "safety-interruption", result };
  }

  if (!current) {
    return { kind: "invalid-command", message: "Start the protocol before sending commands." };
  }

  if (command.type === "answer-clarification" || command.type === "skip-clarification") {
    return answerClarification(current, command, generator);
  }

  if (command.type === "correct-map") {
    return correctMap(current, command, generator);
  }

  if (command.type === "resolve-contradiction") {
    if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
    if (!current.situationMap.contradictions.some((item) => item.id === command.itemId)) {
      return { kind: "invalid-command", message: "That contradiction no longer exists." };
    }
    return {
      kind: "ok",
      state: {
        ...current,
        situationMap: {
          ...current.situationMap,
          contradictions: current.situationMap.contradictions.filter((item) => item.id !== command.itemId)
        },
        activity: [...current.activity, {
          kind: "contradiction-resolved",
          message: "The person resolved a Situation-map contradiction."
        }]
      }
    };
  }

  if (command.type === "select-pivot") {
    if (current.phase !== "recommended" || !current.recommendation) {
      return { kind: "invalid-command", message: "A recommendation must be available first." };
    }
    const pivot = findPivot(command.pivotKind);
    if (!pivot) {
      return { kind: "invalid-command", message: "That Pivot is not available." };
    }
    return {
      kind: "ok",
      state: {
        ...current,
        phase: "selected",
        selectedPivot: pivot,
        activity: [...current.activity, {
          kind: "pivot-selected",
          message: "The person selected a Pivot to perform."
        }]
      }
    };
  }

  if (command.type === "regenerate-pivot") {
    if (current.phase !== "recommended" || !current.recommendation) {
      return { kind: "invalid-command", message: "A recommendation must be available first." };
    }
    const generation = await generateValidatedOutput(
      current.checkIn.quickDump,
      current.situationMap,
      generator,
      current.clarification?.answers
    );
    const output = generation.output;
    const generatedRecommendation = recommendationFromOutput(output);
    const recommendation = generatedRecommendation.primary.kind === current.recommendation.primary.kind
      ? rotatedRecommendation(generatedRecommendation)
      : generatedRecommendation;
    return {
      kind: "ok",
      state: {
        ...current,
        phase: "recommended",
        selectedPivot: undefined,
        situationMap: preserveAcceptedMapItems(output.situationMap, current.situationMap, current.revisions),
        recommendation,
        outcome: undefined,
        fallback: current.fallback || generation.fallback,
        activity: [...current.activity, {
          kind: "recommendation-regenerated",
          message: "A different bounded Pivot recommendation was generated."
        }, ...(generation.fallback ? [{
          kind: "fallback" as const,
          message: "Curated fallback preserved the accepted protocol state."
        }] : [])]
      }
    };
  }

  if (command.type === "dismiss-pivot") {
    return {
      kind: "ok",
      state: {
        ...current,
        phase: "dismissed",
        selectedPivot: undefined,
        activity: [...current.activity, {
          kind: "pivot-dismissed",
          message: "The person dismissed the Pivot recommendation."
        }]
      }
    };
  }

  if (current.phase !== "selected" || !current.selectedPivot) {
    return { kind: "invalid-command", message: "Select a Pivot before recording its outcome." };
  }
  if (command.outcome.pivotTimeSeconds !== undefined &&
      (!Number.isInteger(command.outcome.pivotTimeSeconds) || command.outcome.pivotTimeSeconds < 0)) {
    return { kind: "invalid-command", message: "Pivot time must be a non-negative whole number of seconds." };
  }
  return {
    kind: "ok",
    state: {
      ...current,
      phase: "outcome",
      outcome: command.outcome,
      situationMap: {
        ...current.situationMap,
        pivotHistory: [
          ...current.situationMap.pivotHistory,
          createSituationMapItem(
            `pivot-history-${current.situationMap.pivotHistory.length + 1}`,
            `${current.selectedPivot.title}: ${command.outcome.status}.`,
            "person"
          )
        ]
      },
      activity: [...current.activity, {
        kind: "outcome-recorded",
        message: "The person recorded what happened after the Pivot."
      }]
    }
  };
}

async function answerClarification(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "answer-clarification" | "skip-clarification" }>,
  generator: GooglePivotGenerator
): Promise<GooglePivotCommandResult> {
  if (current.phase !== "clarifying" || !current.clarification) {
    return { kind: "invalid-command", message: "There is no clarification question waiting for an answer." };
  }
  if (current.clarification.question.id !== command.questionId) {
    return { kind: "invalid-command", message: "That clarification is no longer current." };
  }
  if (current.clarification.answers.length >= 2) {
    return { kind: "invalid-command", message: "The clarification question limit has been reached." };
  }

  const skipped = command.type === "skip-clarification";
  const answer = skipped ? undefined : command.answer.trim();
  if (!skipped && !answer) {
    return { kind: "invalid-command", message: "An answer cannot be empty." };
  }
  const clarificationAnswers = [
    ...current.clarification.answers,
    { questionId: command.questionId, ...(answer ? { answer } : {}), skipped }
  ];
  const situationMap = answer
    ? {
        ...current.situationMap,
        shared: [
          ...current.situationMap.shared,
          createSituationMapItem(`clarification-${clarificationAnswers.length}`, answer, "person")
        ]
      }
    : current.situationMap;
  const generation = await generateValidatedOutput(current.checkIn.quickDump, situationMap, generator, clarificationAnswers);
  const output = generation.output;
  const nextQuestion = clarificationAnswers.length < 2 ? output.clarificationQuestion : undefined;
  const event: ActivityEvent = {
    kind: skipped ? "clarification-skipped" : "clarification-answer",
    message: skipped ? "The person skipped the clarification question." : "The person answered the clarification question."
  };
  const stateWithoutRecommendation = nextQuestion
    ? (() => {
        const { recommendation: _recommendation, ...rest } = current;
        return rest;
      })()
    : current;
  return {
    kind: "ok",
    state: {
      ...stateWithoutRecommendation,
      phase: nextQuestion ? "clarifying" : "recommended",
      situationMap: preserveAcceptedMapItems(output.situationMap, situationMap, current.revisions),
      ...(nextQuestion ? {} : { recommendation: recommendationFromOutput(output) }),
      clarification: {
        question: nextQuestion ?? current.clarification.question,
        answers: clarificationAnswers
      },
      fallback: current.fallback || generation.fallback,
      activity: [...current.activity, event, ...(nextQuestion ? [{ kind: "clarification-question" as const, message: "One clarification question is ready." }] : [{ kind: "generation" as const, message: "The recommendation was updated from the clarification." }]), ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])]
    }
  };
}

async function correctMap(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "correct-map" }>,
  generator: GooglePivotGenerator
): Promise<GooglePivotCommandResult> {
  const text = command.text.trim();
  if (!text) {
    return { kind: "invalid-command", message: "A Situation-map correction cannot be empty." };
  }
  if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
  const items = current.situationMap[command.section];
  const item = items.find((candidate) => candidate.id === command.itemId);
  if (!item) {
    return { kind: "invalid-command", message: "That Situation-map item no longer exists." };
  }
  const situationMap = {
    ...current.situationMap,
    [command.section]: items.map((candidate) => candidate.id === command.itemId
      ? { ...candidate, text }
      : candidate)
  };
  const generation = await generateValidatedOutput(current.checkIn.quickDump, situationMap, generator, current.clarification?.answers);
  const output = generation.output;
  const revision: MapRevision = {
    section: command.section,
    itemId: command.itemId,
    previousText: item.text,
    previousProvenance: item.provenance,
    text,
    provenance: item.provenance,
    editedBy: "person"
  };
  return {
    kind: "ok",
    state: {
      ...current,
      phase: "recommended",
      situationMap: preserveAcceptedMapItems(output.situationMap, situationMap, [...current.revisions, revision]),
      recommendation: recommendationFromOutput(output),
      selectedPivot: undefined,
      outcome: undefined,
      fallback: current.fallback || generation.fallback,
      revisions: [
        ...current.revisions,
        revision
      ],
      activity: [...current.activity, {
        kind: "map-revised",
        message: "The person corrected the Situation map; the recommendation was updated."
      }, ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])]
    }
  };
}

async function generateValidatedOutput(
  quickDump: string,
  situationMap: SituationMap,
  generator: GooglePivotGenerator,
  clarificationAnswers?: ClarificationAnswer[]
): Promise<{ output: GooglePivotGeneratorOutput; fallback: boolean }> {
  let generatedOutput: unknown;
  try {
    generatedOutput = await generator.generate({ quickDump, situationMap, clarificationAnswers });
    validateGeneratorOutput(generatedOutput, situationMap);
    return {
      output: {
        ...generatedOutput,
        situationMap: preserveAcceptedMapItems(generatedOutput.situationMap, situationMap, [])
      },
      fallback: false
    };
  } catch (error) {
    if (generator.repair) {
      try {
        const repairedOutput = await generator.repair({ quickDump, situationMap, invalidOutput: generatedOutput ?? error, clarificationAnswers });
        validateGeneratorOutput(repairedOutput, situationMap);
        return {
          output: {
            ...repairedOutput,
            situationMap: preserveAcceptedMapItems(repairedOutput.situationMap, situationMap, [])
          },
          fallback: false
        };
      } catch {
        // Fall through to the curated output so accepted state survives a platform failure.
      }
    }
    return { output: fallbackOutput(quickDump, situationMap), fallback: true };
  }
}

function recommendationFromOutput(output: GooglePivotGeneratorOutput) {
  return {
    primary: requirePivot(output.primaryPivotKind),
    alternatives: output.alternativePivotKinds.map(requirePivot),
    whyThisPivot: output.whyThisPivot
  };
}

function preserveAcceptedMapItems(generated: SituationMap, accepted: SituationMap, revisions: MapRevision[]): SituationMap {
  const preserved = { ...generated };
  for (const section of Object.keys(accepted) as Array<keyof SituationMap>) {
    const acceptedItems = accepted[section].filter((item) =>
      item.provenance === "person" ||
      item.provenance === "artifact" ||
      section === "contradictions" ||
      revisions.some((revision) => revision.section === section && revision.itemId === item.id)
    );
    if (acceptedItems.length === 0) continue;
    const generatedItems = preserved[section];
    const acceptedById = new Map(acceptedItems.map((item) => [item.id, item]));
    preserved[section] = [
      ...generatedItems.map((item) => acceptedById.get(item.id) ?? item),
      ...acceptedItems.filter((item) => !generatedItems.some((generatedItem) => generatedItem.id === item.id))
    ];
  }
  return preserved;
}

function isSituationMapEditable(phase: GooglePivotPhase): boolean {
  return phase === "clarifying" || phase === "recommended";
}

function mapEditPhaseError(): Extract<GooglePivotCommandResult, { kind: "invalid-command" }> {
  return { kind: "invalid-command", message: "Situation-map edits must happen before choosing a Pivot." };
}

function rotatedRecommendation(recommendation: ReturnType<typeof recommendationFromOutput>) {
  const primaryIndex = PIVOT_LIBRARY.findIndex((pivot) => pivot.kind === recommendation.primary.kind);
  const nextIndex = (primaryIndex + 1) % PIVOT_LIBRARY.length;
  return {
    primary: PIVOT_LIBRARY[nextIndex],
    alternatives: [PIVOT_LIBRARY[(nextIndex + 1) % PIVOT_LIBRARY.length], PIVOT_LIBRARY[(nextIndex + 2) % PIVOT_LIBRARY.length]],
    whyThisPivot: "This is a different bounded option to consider."
  };
}

function createSituationMap(quickDump: string): SituationMap {
  const shared = createSituationMapItem("shared-1", quickDump, "person");
  return {
    shared: [shared],
    artifactClaims: [],
    interpretations: [
      createSituationMapItem(
        "interpretation-1",
        "The situation may feel harder because the next action is not yet visible.",
        "guide"
      )
    ],
    uncertainties: [
      createSituationMapItem("uncertainty-1", "The smallest useful next step is still uncertain.", "guide")
    ],
    contradictions: [],
    constraints: [],
    progress: [createSituationMapItem("progress-1", "Make one part of this situation clearer or more doable.", "person")],
    pivotHistory: [],
    priorPatterns: []
  };
}

function createSituationMapItem(id: string, text: string, provenance: Provenance): SituationMapItem {
  return { id, text, provenance };
}

function validateGeneratorOutput(
  output: unknown,
  acceptedSituationMap?: SituationMap
): asserts output is GooglePivotGeneratorOutput {
  if (
    !isRecord(output) ||
    !isSituationMap(output.situationMap) ||
    typeof output.primaryPivotKind !== "string" ||
    !Array.isArray(output.alternativePivotKinds) ||
    !output.alternativePivotKinds.every((kind) => typeof kind === "string") ||
    typeof output.whyThisPivot !== "string"
  ) {
    throw new Error("Generated Situation map is invalid.");
  }
  const clarificationQuestion = output.clarificationQuestion;
  if (clarificationQuestion !== undefined) {
    if (!isRecord(clarificationQuestion) ||
        typeof clarificationQuestion.id !== "string" ||
        typeof clarificationQuestion.text !== "string" ||
        !clarificationQuestion.id.trim() ||
        !clarificationQuestion.text.trim()) {
      throw new Error("Generated clarification question is invalid.");
    }
  }

  requirePivot(output.primaryPivotKind);
  if (
    output.alternativePivotKinds.length !== 2 ||
    new Set(output.alternativePivotKinds).size !== 2 ||
    output.alternativePivotKinds.some((kind) => kind === output.primaryPivotKind)
  ) {
    throw new Error("Generated alternatives are invalid.");
  }

  for (const section of Object.values(output.situationMap)) {
    for (const mapItem of section) {
      if (!mapItem.text.trim() || !isProvenance(mapItem.provenance)) {
        throw new Error("Generated Situation-map provenance is invalid.");
      }
    }
  }
  if (acceptedSituationMap) {
    validateGeneratedProvenance(output.situationMap, acceptedSituationMap);
  }
}

function validateGeneratedProvenance(generated: SituationMap, accepted: SituationMap): void {
  for (const section of Object.keys(generated) as Array<keyof SituationMap>) {
    const acceptedById = new Map(accepted[section].map((item) => [item.id, item]));
    for (const item of generated[section]) {
      const acceptedItem = acceptedById.get(item.id);
      if (acceptedItem && acceptedItem.provenance !== item.provenance) {
        throw new Error("Generated Situation-map provenance cannot change.");
      }
      if (!acceptedItem && (item.provenance === "person" || item.provenance === "artifact")) {
        throw new Error("Generated Situation-map output cannot create unapproved claims.");
      }
    }
  }
}

function isSituationMap(value: unknown): value is SituationMap {
  if (!isRecord(value)) return false;
  return (
    sectionHasProvenance(value.shared, "person") &&
    sectionHasProvenance(value.artifactClaims, "artifact") &&
    sectionHasProvenance(value.interpretations, "guide") &&
    sectionHasProvenance(value.uncertainties, "guide") &&
    sectionHasKnownProvenance(value.contradictions) &&
    sectionHasKnownProvenance(value.constraints) &&
    sectionHasProvenance(value.progress, "person") &&
    sectionHasKnownProvenance(value.pivotHistory) &&
    sectionHasKnownProvenance(value.priorPatterns)
  );
}

function sectionHasProvenance(value: unknown, provenance: Provenance): value is SituationMapItem[] {
  return Array.isArray(value) && value.every((item) => isSituationMapItem(item) && item.provenance === provenance);
}

function sectionHasKnownProvenance(value: unknown): value is SituationMapItem[] {
  return Array.isArray(value) && value.every(isSituationMapItem);
}

function isSituationMapItem(value: unknown): value is SituationMapItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    isProvenance(value.provenance)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePivot(kind: string): Pivot {
  const pivot = findPivot(kind);
  if (!pivot) {
    throw new Error("Generated Pivot is outside the bounded library.");
  }
  return pivot;
}

function findPivot(kind: string): Pivot | undefined {
  return PIVOT_LIBRARY.find((candidate) => candidate.kind === kind);
}

function fallbackOutput(quickDump: string, situationMap: SituationMap): GooglePivotGeneratorOutput {
  const primary = preferredPivot(quickDump);
  const primaryIndex = PIVOT_LIBRARY.findIndex((pivot) => pivot.kind === primary.kind);
  return {
    situationMap,
    primaryPivotKind: primary.kind,
    alternativePivotKinds: [
      PIVOT_LIBRARY[(primaryIndex + 1) % PIVOT_LIBRARY.length].kind,
      PIVOT_LIBRARY[(primaryIndex + 2) % PIVOT_LIBRARY.length].kind
    ],
    whyThisPivot: "This curated starting point keeps the next action small and within your control."
  };
}

function preferredPivot(quickDump: string): Pivot {
  const text = quickDump.toLowerCase();
  if (/(task|project|deadline|work|start|decision|stuck)/.test(text)) return PIVOT_LIBRARY[4];
  if (/(alone|lonely|friend|talk|text|help|support)/.test(text)) return PIVOT_LIBRARY[2];
  if (/(hungry|thirsty|tired|sleep|food|cold|hot|comfortable)/.test(text)) return PIVOT_LIBRARY[3];
  if (/(racing|panic|anxious|breathe|breath|overwhelmed|too much)/.test(text)) return PIVOT_LIBRARY[1];
  return PIVOT_LIBRARY[0];
}

const defaultGenerator: GooglePivotGenerator = {
  async generate({ quickDump, situationMap }) {
    return fallbackOutput(quickDump, situationMap);
  }
};

function isProvenance(value: unknown): value is Provenance {
  return value === "person" || value === "artifact" || value === "guide";
}

import { indicatesImmediateDanger } from "./safety-interruption";
import {
  processGoogleImageArtifact,
  type GoogleImageArtifactExtractor,
  type GoogleImageArtifactInput
} from "./google-image-artifact";
import {
  MAX_GOOGLE_ARTIFACT_COUNT,
  MAX_GOOGLE_ARTIFACT_TOTAL_BYTES,
  inspectGoogleSupportingArtifact,
  processGoogleSupportingArtifact,
  type GooglePdfTemporaryStorage,
  type GoogleSupportingArtifactExtractor,
  type GoogleSupportingArtifactInput,
  type GoogleSupportingArtifactProcessing
} from "./google-supporting-artifacts";
import { PIVOT_LIBRARY, type Pivot, type PivotKind } from "./pivot-library";

export type { GoogleImageArtifactInput } from "./google-image-artifact";
export type { GoogleSupportingArtifactInput } from "./google-supporting-artifacts";

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

export type GoogleGuideResponse = {
  acknowledgment: string;
  explanation: string;
  suggestedReplies: string[];
};

export type GoogleVisibleProtocolUpdate = {
  id: string;
  kind: "situation-map" | "clarification" | "recommendation" | "feedback" | "action-shrink" | "confirmation";
  summary: string;
  undoable: boolean;
};

export type GoogleConversationalTurn = {
  id: string;
  userMessage: string;
  guideResponse: GoogleGuideResponse;
  updates: GoogleVisibleProtocolUpdate[];
};

export type GooglePendingConfirmation = {
  id: string;
  kind: "record-outcome" | "forget-memory" | "delete-memory" | "dismiss-pivot" | "discard-check-in";
  summary: string;
  outcome?: PivotOutcome;
  memoryId?: string;
};

export type PivotOutcome = {
  status: "completed" | "partly-helpful" | "not-a-fit" | "skipped";
  agencyShift?: "more-able" | "about-as-able" | "less-able";
  pivotTimeSeconds?: number;
};

export type PivotStepFeedback = { status: PivotOutcome["status"] | "blocked" } & {
  note?: string;
};

export type SituationalPivotAction = {
  id: string;
  kind: PivotKind;
  title: string;
  instruction: string;
  goal: string;
  steps: string[];
  doneWhen: string;
  estimatedMinutes: number;
  fallbackInstruction: string;
  whyThisFits: string;
};

export type GooglePivotMiniPlan = {
  currentAction: SituationalPivotAction;
  completedActions: SituationalPivotAction[];
  feedback: PivotStepFeedback[];
  stepNumber: number;
  maxSteps: 3;
};

export type GoogleDerivedMemory = {
  id: string;
  context: string;
  approved: true;
};

export type GoogleCautionarySignal = "blocked";

export type GoogleRetrievedMemory = {
  id: string;
  protocolId: string;
  context: string;
  selectedPivotKind: PivotKind;
  selectedPivotTitle: string;
  selectedActionTitle?: string;
  outcome: PivotOutcome;
  cautionarySignals?: GoogleCautionarySignal[];
  approved: true;
};

export type GoogleGuidancePreference = {
  id: string;
  text: string;
  createdAt: string;
};

export type GoogleMemoryExplanation = {
  memoryId: string;
  protocolId: string;
  text: string;
};

export type GooglePersistenceStatus = "unsaved" | "pending" | "saved";
export type GoogleEnrichmentStatus = "not-requested" | "saved" | "unavailable";

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
    | "confirmation-requested"
    | "confirmation-confirmed"
    | "confirmation-cancelled"
    | "undo-applied"
    | "action-shrunk"
    | "context-added"
    | "pivot-selected"
    | "memory-retrieval"
    | "step-feedback"
    | "step-generation"
    | "recommendation-regenerated"
    | "pivot-dismissed"
    | "artifact-review"
    | "artifact-safety-completed"
    | "artifact-accepted"
    | "artifact-rejected"
    | "artifact-approved"
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
  primaryAction?: SituationalPivotAction;
  alternativeActions?: SituationalPivotAction[];
  guideResponse?: GoogleGuideResponse;
};

export type GoogleMemoryRetrievalTool = {
  retrieveSimilarMemories: () => Promise<readonly GoogleRetrievedMemory[]>;
  wasCalled: () => boolean;
};

export type GooglePivotGenerator = {
  generate: (input: {
    quickDump: string;
    situationMap: SituationMap;
    clarificationAnswers?: ClarificationAnswer[];
    currentAction?: SituationalPivotAction;
    stepFeedback?: PivotStepFeedback;
    completedActions?: readonly SituationalPivotAction[];
    retrievedMemories?: readonly GoogleRetrievedMemory[];
  }) => Promise<unknown>;
  adapt?: (input: {
    situationMap: SituationMap;
    currentDerivedContext: string;
    retrievedMemories: readonly GoogleRetrievedMemory[];
    guidancePreferences: readonly GoogleGuidancePreference[];
    memoryTool?: GoogleMemoryRetrievalTool;
  }) => Promise<unknown>;
  usesMemoryTool?: boolean;
  repair?: (input: {
    quickDump: string;
    situationMap: SituationMap;
    invalidOutput: unknown;
    clarificationAnswers?: ClarificationAnswer[];
    currentAction?: SituationalPivotAction;
    stepFeedback?: PivotStepFeedback;
    completedActions?: readonly SituationalPivotAction[];
    retrievedMemories?: readonly GoogleRetrievedMemory[];
  }) => Promise<unknown>;
  prepareMemory?: (input: { situationMap: SituationMap }) => Promise<string>;
  deriveMemory?: (input: {
    currentContext: string;
    selectedPivot: Pivot;
    selectedAction?: SituationalPivotAction;
    outcome: PivotOutcome;
  }) => Promise<string>;
  extractImageClaims?: GoogleImageArtifactExtractor;
  extractSupportingArtifactClaims?: GoogleSupportingArtifactExtractor;
  temporaryPdfStorage?: GooglePdfTemporaryStorage;
};

export type GoogleImageProcessingState = {
  status: "not-provided" | "accepted" | "rejected";
  mimeType?: string;
  claimCount?: number;
  message: string;
};

export type GoogleArtifactProcessingState = {
  artifactId: string;
  status: "accepted" | "rejected";
  mimeType?: string;
  pageCount?: number;
  claimCount?: number;
  message: string;
};

export type GooglePivotAdaptation = {
  ownerSubject: string;
  embed: (text: string) => Promise<readonly number[]>;
  retrieveSimilarMemories: (input: {
    ownerSubject: string;
    queryEmbedding: readonly number[];
    limit: number;
    threshold: number;
    excludedMemoryIds: readonly string[];
  }) => Promise<readonly GoogleRetrievedMemory[]>;
  listGuidancePreferences: (ownerSubject: string) => Promise<readonly GoogleGuidancePreference[]>;
  excludeMemory?: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  forgetMemory?: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  deleteMemory?: (input: { ownerSubject: string; memoryId: string }) => Promise<boolean>;
  threshold?: number;
  limit?: number;
  excludedMemoryIds?: readonly string[];
};

export type GooglePivotPhase = "clarifying" | "recommended" | "selected" | "outcome" | "dismissed";

export type GooglePivotResult =
  | { kind: "consent-required" }
  | {
      kind: "safety-interruption";
      checkIn: { quickDump: string };
      activity: ActivityEvent[];
      priorState?: Extract<GooglePivotResult, { kind: "pivot-protocol" }>;
    }
  | {
      kind: "pivot-protocol";
      checkIn: { quickDump: string };
      situationMap: SituationMap;
      version: number;
      phase: GooglePivotPhase;
      conversation: GoogleConversationalTurn[];
      undoableUpdates: GoogleUndoableUpdate[];
      pendingConfirmation?: GooglePendingConfirmation;
      clarification?: {
        question: ClarificationQuestion;
        answers: ClarificationAnswer[];
      };
      revisions: MapRevision[];
      selectedPivot?: Pivot;
      selectedAction?: SituationalPivotAction;
      outcome?: PivotOutcome;
      saveRequested: boolean;
      persistence: GooglePersistenceStatus;
      enrichment: GoogleEnrichmentStatus;
      pendingDerivedContext?: string;
      derivedMemory?: GoogleDerivedMemory;
      memoryExplanations: GoogleMemoryExplanation[];
      retrievedMemories: GoogleRetrievedMemory[];
      retrievalAttempted: boolean;
      adaptationStatus: "not-requested" | "personalized" | "no-match" | "unavailable";
      excludedMemoryIds: string[];
      guidancePreferenceIds: string[];
      imageProcessing: GoogleImageProcessingState;
      artifacts: GoogleArtifactProcessingState[];
      artifactBytes: number;
      approvedArtifactClaimIds: string[];
      recommendation?: {
        primary: Pivot;
        primaryAction: SituationalPivotAction;
        alternatives: Pivot[];
        alternativeActions: SituationalPivotAction[];
        whyThisPivot: string;
      };
      miniPlan?: GooglePivotMiniPlan;
      activity: ActivityEvent[];
      fallback: boolean;
    };

export type GoogleUndoSnapshot = {
  situationMap: SituationMap;
  phase: GooglePivotPhase;
  clarification?: {
    question: ClarificationQuestion;
    answers: ClarificationAnswer[];
  };
  revisions: MapRevision[];
  selectedPivot?: Pivot;
  selectedAction?: SituationalPivotAction;
  outcome?: PivotOutcome;
  recommendation?: Extract<GooglePivotResult, { kind: "pivot-protocol" }>['recommendation'];
  miniPlan?: GooglePivotMiniPlan;
  memoryExplanations: GoogleMemoryExplanation[];
  retrievedMemories: GoogleRetrievedMemory[];
  retrievalAttempted: boolean;
  adaptationStatus: "not-requested" | "personalized" | "no-match" | "unavailable";
  excludedMemoryIds: string[];
  guidancePreferenceIds: string[];
  fallback: boolean;
};

export type GoogleUndoableUpdate = {
  id: string;
  kind: "stated-context" | "map-correction" | "clarification" | "feedback" | "action-shrink" | "contradiction-resolution";
  summary: string;
  before: GoogleUndoSnapshot;
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
  input: {
    quickDump: string;
    consentGiven: boolean;
    saveRequested?: boolean;
    image?: GoogleImageArtifactInput;
    artifacts?: GoogleSupportingArtifactInput[];
  },
  generator: GooglePivotGenerator = defaultGenerator,
  adaptation?: GooglePivotAdaptation
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
  let situationMap = createSituationMap(quickDump);
  activity.push({ kind: "map-created", message: "Situation map created." });
  let fallback = false;
  let artifacts: GoogleArtifactProcessingState[] = [];
  let artifactBytes = 0;

  const imageReview = await reviewImage(input.image, generator, quickDump);
  if (imageReview.kind === "safety-interruption") {
    return {
      ...imageReview.result,
      activity: [
        ...activity,
        { kind: "artifact-review", message: "The optional image was reviewed without retaining its bytes or filename." },
        { kind: "artifact-safety-completed", message: "The extracted image content triggered the app-owned Safety interruption." },
        { kind: "fallback", message: "Safety interruption returned app-owned urgent-support guidance." }
      ]
    };
  }
  let imageProcessing: GoogleImageProcessingState = { status: "not-provided", message: "No image was added." };
  if (imageReview.kind === "rejected") {
    fallback = true;
    imageProcessing = { status: "rejected", message: imageReview.message };
    artifacts = [{ artifactId: "artifact-image-1", status: "rejected", message: imageReview.message }];
    activity.push(
      { kind: "artifact-review", message: "The optional image was reviewed without retaining its bytes or filename." },
      { kind: "artifact-rejected", message: imageReview.message },
      { kind: "fallback", message: "The Quick dump remains sufficient to continue without the image." }
    );
  } else if (imageReview.kind === "accepted") {
    situationMap = addImageClaims(situationMap, imageReview.claims);
    imageProcessing = {
      status: "accepted",
      mimeType: imageReview.mimeType,
      claimCount: imageReview.claims.length,
      message: "The image was reviewed and its claims were added as artifact claims.",
    };
    activity.push(
      { kind: "artifact-review", message: "The optional image was reviewed without retaining its bytes or filename." },
      { kind: "artifact-safety-completed", message: "The extracted image content passed the second Safety gate." },
      { kind: "artifact-accepted", message: "The image claims were added to the Situation map as artifact claims." }
    );
    artifacts = [{
      artifactId: "artifact-image-1",
      status: "accepted",
      mimeType: imageReview.mimeType,
      claimCount: imageReview.claims.length,
      message: "The image was reviewed and its claims were added as artifact claims."
    }];
    artifactBytes = input.image?.bytes.length ?? 0;
  }

  const artifactReview = await reviewSupportingArtifacts(
    input.artifacts ?? [],
    generator,
    quickDump,
    artifacts.filter((artifact) => artifact.status === "accepted").length,
    artifactBytes,
    artifacts.length
  );
  if (artifactReview.kind === "safety-interruption") {
    return {
      ...artifactReview.result,
      activity: [...activity, ...artifactReview.activity]
    };
  }
  artifacts = [...artifacts, ...artifactReview.states];
  artifactBytes += artifactReview.acceptedBytes;
  situationMap = addArtifactClaims(situationMap, artifactReview.accepted);
  fallback ||= artifactReview.fallback;
  activity.push(...artifactReview.activity);

  let output: GooglePivotGeneratorOutput;
  let generatedOutput: unknown;
  try {
    generatedOutput = await generator.generate({ quickDump, situationMap });
    activity.push({ kind: "generation", message: "Genkit + Gemini generated the bounded Pivot recommendation." });
    output = validatedGeneratedOutput(generatedOutput, situationMap);
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
        output = validatedGeneratedOutput(repairedOutput, situationMap);
        activity.push({ kind: "generation", message: "Genkit + Gemini repaired the bounded Pivot recommendation once." });
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

  // A curated fallback is safe to continue with, but it is not a valid
  // generated Check-in to retain as personal history or Derived memory.
  let saveRequested = (input.saveRequested ?? false) && !fallback;
  let pendingDerivedContext: string | undefined;
  if (saveRequested || adaptation) {
    try {
      const context = await (generator.prepareMemory?.({ situationMap: memorySafeSituationMap(situationMap) }) ?? Promise.resolve(defaultPendingMemory(situationMap)));
      validateDerivedMemoryContext(context);
      pendingDerivedContext = context;
    } catch {
      if (saveRequested) saveRequested = false;
      if (adaptation) activity.push({ kind: "fallback", message: "Personalization is temporarily unavailable; the current Situation map is preserved." });
      else activity.push({ kind: "fallback", message: "Saving is temporarily unavailable; this Check-in can continue without being retained." });
    }
  }

  const adapted = adaptation && pendingDerivedContext && !output.clarificationQuestion
    ? await adaptOutput({
      quickDump,
      situationMap: output.situationMap,
        baseOutput: output,
        currentDerivedContext: pendingDerivedContext,
        generator,
        adaptation
      })
    : {
        output,
        status: adaptation && !pendingDerivedContext ? "unavailable" as const : "not-requested" as const,
        explanations: [],
        preferenceIds: [],
        memories: [],
        retrievalAttempted: false,
        retrievalMode: adaptation && !pendingDerivedContext ? "unavailable" as const : "not-requested" as const
      };
  if (adapted.output !== output) {
    output = adapted.output;
    activity.push({ kind: "generation", message: "The Situation map and recommendation adapted from approved context." });
  }
  if (adaptation && generator.usesMemoryTool && adapted.retrievalAttempted) {
    activity.push({ kind: "memory-retrieval", message: memoryRetrievalActivityMessage(adapted.retrievalMode) });
  }
  if (adapted.status === "unavailable") {
    fallback = true;
    activity.push({ kind: "fallback", message: "Personalization is unavailable; the accepted Situation map remains usable." });
  }
  if (fallback && saveRequested) {
    saveRequested = false;
    pendingDerivedContext = undefined;
    activity.push({ kind: "fallback", message: "This fallback Check-in will not be retained as personal history or Derived memory." });
  }
  return {
    kind: "pivot-protocol",
    checkIn: { quickDump },
    version: 0,
    saveRequested,
    persistence: saveRequested ? "pending" : "unsaved",
    enrichment: "not-requested",
    ...(pendingDerivedContext && saveRequested ? { pendingDerivedContext } : {}),
    phase: output.clarificationQuestion ? "clarifying" : "recommended",
    conversation: [initialConversationTurn(quickDump, output)],
    undoableUpdates: [],
    situationMap: output.situationMap,
    ...(output.clarificationQuestion
      ? { clarification: { question: output.clarificationQuestion, answers: [] } }
      : {}),
    revisions: [],
    ...(output.clarificationQuestion ? {} : { recommendation: recommendationFromOutput(output) }),
    memoryExplanations: adapted.explanations,
    retrievedMemories: adapted.memories,
    retrievalAttempted: adapted.retrievalAttempted,
    adaptationStatus: adapted.status,
    excludedMemoryIds: [],
    guidancePreferenceIds: adapted.preferenceIds,
    imageProcessing,
    artifacts,
    artifactBytes,
    approvedArtifactClaimIds: [],
    activity,
    fallback
  };
}

export type GooglePivotCommand =
  | { type: "start"; quickDump: string; consentGiven: boolean; saveRequested?: boolean; image?: GoogleImageArtifactInput; artifacts?: GoogleSupportingArtifactInput[] }
  | { type: "add-image"; image: GoogleImageArtifactInput }
  | { type: "add-artifact"; artifact: GoogleSupportingArtifactInput }
  | { type: "add-artifacts"; artifacts: GoogleSupportingArtifactInput[] }
  | { type: "add-context"; message: string }
  | { type: "approve-artifact-claim"; itemId: string }
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
  | { type: "record-step-feedback"; feedback: PivotStepFeedback }
  | { type: "shrink-action" }
  | { type: "undo-update"; updateId: string }
  | { type: "request-discard" }
  | { type: "confirm-action"; confirmationId: string }
  | { type: "cancel-confirmation"; confirmationId: string }
  | { type: "regenerate-pivot" }
  | { type: "dismiss-pivot" }
  | { type: "exclude-memory"; memoryId: string }
  | { type: "forget-memory"; memoryId: string }
  | { type: "delete-memory"; memoryId: string }
  | { type: "record-outcome"; outcome: PivotOutcome };

export function googlePivotSafetyMessage(command: GooglePivotCommand): string | undefined {
  if (command.type === "add-context") return command.message;
  if (command.type === "correct-map") return command.text;
  if (command.type === "answer-clarification") return command.answer;
  if (command.type === "record-step-feedback") return command.feedback.note;
  return undefined;
}

export type GooglePivotCommandResult =
  | { kind: "ok"; state: Extract<GooglePivotResult, { kind: "pivot-protocol" }> }
  | { kind: "consent-required" }
  | { kind: "safety-interruption"; result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }
  | { kind: "invalid-command"; message: string }
  | { kind: "dependency-unavailable"; message: string; state: Extract<GooglePivotResult, { kind: "pivot-protocol" }> };

export async function runGooglePivotCommand(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }> | undefined,
  command: GooglePivotCommand,
  generator: GooglePivotGenerator = defaultGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  return normalizeFallbackSavePolicy(await runGooglePivotCommandInternal(current, command, generator, adaptation));
}

async function runGooglePivotCommandInternal(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }> | undefined,
  command: GooglePivotCommand,
  generator: GooglePivotGenerator = defaultGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  if (command.type === "start") {
    if (current) {
      return { kind: "invalid-command", message: "This protocol has already started." };
    }

    const result = await runGooglePivotProtocol(command, generator, adaptation);
    if (result.kind === "pivot-protocol") return { kind: "ok", state: result };
    if (result.kind === "consent-required") return result;
    return { kind: "safety-interruption", result };
  }

  if (!current) {
    return { kind: "invalid-command", message: "Start the protocol before sending commands." };
  }

  const laterUserMessage = googlePivotSafetyMessage(command);
  if (laterUserMessage) {
    const safetyResult = googlePivotSafetyResult(laterUserMessage);
    if (safetyResult) return { kind: "safety-interruption", result: { ...safetyResult, priorState: current } };
  }

  if (command.type === "add-context") {
    return addContextToProtocol(current, command, generator, adaptation);
  }

  if (command.type === "request-discard") {
    return requestDiscardConfirmation(current);
  }

  if (command.type === "answer-clarification" || command.type === "skip-clarification") {
    return answerClarification(current, command, generator, adaptation);
  }

  if (command.type === "add-image") {
    if (current.imageProcessing?.status === "accepted") {
      return { kind: "invalid-command", message: "Only one image can be added to a Situation." };
    }
    return addImageToProtocol(current, command.image, generator, adaptation);
  }

  if (command.type === "add-artifact" || command.type === "add-artifacts") {
    const inputs = command.type === "add-artifact" ? [command.artifact] : command.artifacts;
    return addArtifactsToProtocol(current, inputs, generator, adaptation);
  }

  if (command.type === "approve-artifact-claim") {
    if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
    const item = current.situationMap.artifactClaims.find((candidate) => candidate.id === command.itemId);
    if (!item) return { kind: "invalid-command", message: "That artifact claim no longer exists." };
    if ((current.approvedArtifactClaimIds ?? []).includes(command.itemId)) return { kind: "ok", state: current };
    return {
      kind: "ok",
      state: {
        ...current,
        approvedArtifactClaimIds: [...(current.approvedArtifactClaimIds ?? []), command.itemId],
        activity: [...current.activity, { kind: "artifact-approved", message: "The person approved an artifact claim for possible retention." }]
      }
    };
  }

  if (command.type === "correct-map") {
    return correctMap(current, command, generator, adaptation);
  }

  if (command.type === "resolve-contradiction") {
    if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
    if (!current.situationMap.contradictions.some((item) => item.id === command.itemId)) {
      return { kind: "invalid-command", message: "That contradiction no longer exists." };
    }
    return resolveContradiction(current, command, generator, adaptation);
  }

  if (command.type === "exclude-memory" || command.type === "forget-memory" || command.type === "delete-memory") {
    if (!current.memoryExplanations.some((memory) => memory.memoryId === command.memoryId)) {
      return { kind: "invalid-command", message: "That memory is not influencing this protocol." };
    }
    if (command.type !== "exclude-memory" && !adaptation) {
      return { kind: "invalid-command", message: "Memory controls are unavailable." };
    }
    if (command.type !== "exclude-memory") return requestMemoryConfirmation(current, command);
    return applyMemoryControl(current, command, generator, adaptation);
  }

  if (command.type === "select-pivot") {
    if (current.phase !== "recommended" || !current.recommendation) {
      return { kind: "invalid-command", message: "A recommendation must be available first." };
    }
    const pivot = findPivot(command.pivotKind);
    if (!pivot) {
      return { kind: "invalid-command", message: "That Pivot is not available." };
    }
    const selectedAction = actionForPivot(current.recommendation, pivot.kind);
    const nextState = {
      ...current,
      phase: "selected" as const,
      selectedPivot: pivot,
      selectedAction,
      miniPlan: {
        currentAction: selectedAction,
        completedActions: [],
        feedback: [],
        stepNumber: 1,
        maxSteps: 3 as const
      },
      activity: [...current.activity, {
        kind: "pivot-selected" as const,
        message: "The person selected a Pivot to perform."
      }]
    };
    return {
      kind: "ok",
      state: appendConversationTurn(
        nextState,
        `Choose Pivot: ${selectedAction.title}`,
        guideResponseForState(nextState, "The selected action is ready one step at a time."),
        [{ id: `selection-${current.conversation.length + 1}`, kind: "recommendation", summary: "Selected one bounded Pivot to try.", undoable: false }]
      )
    };
  }

  if (command.type === "record-step-feedback") {
    return recordStepFeedback(current, command.feedback, generator);
  }

  if (command.type === "shrink-action") {
    return shrinkCurrentAction(current);
  }

  if (command.type === "undo-update") {
    return undoUpdate(current, command.updateId);
  }

  if (command.type === "confirm-action") {
    return confirmAction(current, command.confirmationId, generator, adaptation);
  }

  if (command.type === "cancel-confirmation") {
    return cancelConfirmation(current, command.confirmationId);
  }

  if (command.type === "regenerate-pivot") {
    if (current.phase !== "recommended" || !current.recommendation) {
      return { kind: "invalid-command", message: "A recommendation must be available first." };
    }
    const generation = await generateAdaptedOutput(
      current.checkIn.quickDump,
      current.situationMap,
      generator,
      current.clarification?.answers,
      adaptationForState(adaptation, current),
      current.retrievalAttempted ? current.retrievedMemories : undefined
    );
    const output = generation.output;
    const generatedRecommendation = recommendationFromOutput(output);
    const recommendation = generatedRecommendation.primary.kind === current.recommendation.primary.kind
      ? rotatedRecommendation(generatedRecommendation)
      : generatedRecommendation;
    const nextState = {
      ...current,
      phase: "recommended" as const,
      selectedPivot: undefined,
      situationMap: preserveAcceptedMapItems(output.situationMap, current.situationMap, current.revisions),
      recommendation,
      outcome: undefined,
      memoryExplanations: generation.explanations,
      retrievedMemories: generation.memories,
      retrievalAttempted: generation.retrievalAttempted,
      adaptationStatus: generation.status,
      guidancePreferenceIds: generation.preferenceIds,
      fallback: current.fallback || generation.fallback,
      activity: [...current.activity, {
        kind: "recommendation-regenerated" as const,
        message: "A different bounded Pivot recommendation was generated."
      }, ...(generation.fallback ? [{
        kind: "fallback" as const,
        message: "Curated fallback preserved the accepted protocol state."
      }] : [])]
    };
    return {
      kind: "ok",
      state: appendConversationTurn(
        nextState,
        "Show another Pivot.",
        output.guideResponse ?? guideResponseForState(nextState, "Here is another bounded option."),
        [{ id: `regeneration-${current.conversation.length + 1}`, kind: "recommendation", summary: "Generated a different bounded recommendation.", undoable: false }]
      )
    };
  }

  if (command.type === "dismiss-pivot") {
    return requestDismissalConfirmation(current);
  }

  if (current.phase !== "selected" || !current.selectedPivot) {
    return { kind: "invalid-command", message: "Select a Pivot before recording its outcome." };
  }
  if (!isValidPivotOutcome(command.outcome)) {
    return { kind: "invalid-command", message: "The Pivot outcome is invalid." };
  }
  if (command.outcome.pivotTimeSeconds !== undefined &&
      (!Number.isInteger(command.outcome.pivotTimeSeconds) || command.outcome.pivotTimeSeconds < 0)) {
    return { kind: "invalid-command", message: "Pivot time must be a non-negative whole number of seconds." };
  }
  return requestOutcomeConfirmation(current, command.outcome);
}

function normalizeFallbackSavePolicy(result: GooglePivotCommandResult): GooglePivotCommandResult {
  if (result.kind !== "ok" || !result.state.fallback || !result.state.saveRequested) return result;
  return {
    ...result,
    state: {
      ...result.state,
      saveRequested: false,
      persistence: "unsaved",
      enrichment: "not-requested",
      pendingDerivedContext: undefined,
      derivedMemory: undefined
    }
  };
}

async function recordOutcome(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  selectedPivot: Pivot,
  outcome: PivotOutcome,
  generator: GooglePivotGenerator
): Promise<GooglePivotCommandResult> {
  const selectedAction = current.selectedAction ?? current.miniPlan?.completedActions[0] ?? situationalActionForPivot(selectedPivot);
  const situationMap = {
    ...current.situationMap,
    pivotHistory: [
      ...current.situationMap.pivotHistory,
      createSituationMapItem(
        `pivot-history-${current.situationMap.pivotHistory.length + 1}`,
        `${selectedAction.title}: ${outcome.status}.`,
        "person"
      )
    ]
  };
  const baseState = {
    ...current,
    phase: "outcome" as const,
    outcome,
    situationMap: current.saveRequested
      ? removeUnapprovedArtifactClaims(situationMap, current.approvedArtifactClaimIds ?? [])
      : situationMap,
    persistence: current.saveRequested ? "saved" as const : "unsaved" as const,
    enrichment: "not-requested" as const,
    derivedMemory: undefined,
    activity: [...current.activity, {
      kind: "outcome-recorded" as const,
      message: "The person recorded what happened after the Pivot."
    }]
  };

  if (!current.saveRequested) return { kind: "ok", state: baseState };

  const fallbackContext = current.pendingDerivedContext ?? defaultPendingMemory(situationMap);
  try {
    const context = await (generator.deriveMemory?.({
      currentContext: fallbackContext,
      selectedPivot,
      selectedAction,
      outcome
    }) ?? Promise.resolve(defaultDerivedMemory(situationMap, selectedPivot, selectedAction, outcome)));
    validateDerivedMemoryContext(context);
    return {
      kind: "ok",
      state: {
        ...baseState,
        enrichment: "saved",
        pendingDerivedContext: undefined,
        derivedMemory: { id: "derived-memory-1", context, approved: true },
        activity: [...baseState.activity, {
          kind: "generation",
          message: "A compact Derived memory was prepared from the saved Check-in."
        }]
      }
    };
  } catch {
    return {
      kind: "ok",
      state: {
        ...baseState,
        enrichment: "unavailable",
        pendingDerivedContext: undefined,
        derivedMemory: undefined,
        activity: [...baseState.activity, {
          kind: "fallback",
          message: "The outcome was saved, but adaptation is temporarily unavailable."
        }]
      }
    };
  }
}

async function addImageToProtocol(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  image: GoogleImageArtifactInput,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
  const acceptedCount = current.artifacts?.filter((artifact) => artifact.status === "accepted").length ?? 0;
  const artifactId = `artifact-image-${(current.artifacts ?? []).length + 1}`;
  if (acceptedCount >= MAX_GOOGLE_ARTIFACT_COUNT || (current.artifactBytes ?? 0) + image.bytes.length > MAX_GOOGLE_ARTIFACT_TOTAL_BYTES) {
    const message = acceptedCount >= MAX_GOOGLE_ARTIFACT_COUNT
      ? "The image was rejected because a Situation can include at most five artifacts."
      : "The image was rejected because the Situation's combined artifact limit is 25 MB.";
    return {
      kind: "ok",
      state: {
        ...current,
        imageProcessing: { status: "rejected", message },
        artifacts: [...(current.artifacts ?? []), { artifactId, status: "rejected", message }],
        fallback: true,
        activity: [...current.activity,
          { kind: "artifact-review", message: "The optional image was inspected without retaining its bytes or filename." },
          { kind: "artifact-rejected", message },
          { kind: "fallback", message: "The prior valid Situation map remains available without the image." }
        ]
      }
    };
  }

  const review = await reviewImage(image, generator, current.checkIn.quickDump);
  if (review.kind === "safety-interruption") {
    return { kind: "safety-interruption", result: { ...review.result, priorState: current } };
  }
  if (review.kind === "rejected") {
    return {
      kind: "ok",
      state: {
        ...current,
        imageProcessing: { status: "rejected", message: review.message },
        artifacts: [...(current.artifacts ?? []), { artifactId, status: "rejected", message: review.message }],
        fallback: true,
        activity: [
          ...current.activity,
          { kind: "artifact-review", message: "The optional image was reviewed without retaining its bytes or filename." },
          { kind: "artifact-rejected", message: review.message },
          { kind: "fallback", message: "The prior valid Situation map remains available without the image." }
        ]
      }
    };
  }
  if (review.kind === "none") {
    return { kind: "invalid-command", message: "An image is required." };
  }

  const situationMap = addImageClaims(current.situationMap, review.claims);
  const generation = await generateAdaptedOutput(
    current.checkIn.quickDump,
    situationMap,
    generator,
    current.clarification?.answers,
    adaptationForState(adaptation, current),
    current.retrievalAttempted ? current.retrievedMemories : undefined
  );
  return {
    kind: "ok",
      state: {
        ...current,
      phase: "recommended",
      selectedPivot: undefined,
      outcome: undefined,
      situationMap: preserveAcceptedMapItems(generation.output.situationMap, situationMap, current.revisions),
      recommendation: recommendationFromOutput(generation.output),
        imageProcessing: {
        status: "accepted",
        mimeType: review.mimeType,
        claimCount: review.claims.length,
        message: "The image was reviewed and its claims were added as artifact claims."
        },
        artifacts: [...(current.artifacts ?? []), {
          artifactId,
          status: "accepted",
          mimeType: review.mimeType,
          claimCount: review.claims.length,
          message: "The image was reviewed and its claims were added as artifact claims."
        }],
        artifactBytes: (current.artifactBytes ?? 0) + image.bytes.length,
      memoryExplanations: generation.explanations,
      retrievedMemories: generation.memories,
      retrievalAttempted: generation.retrievalAttempted,
      adaptationStatus: generation.status,
      guidancePreferenceIds: generation.preferenceIds,
      fallback: current.fallback || generation.fallback,
      activity: [
        ...current.activity,
        { kind: "artifact-review", message: "The optional image was reviewed without retaining its bytes or filename." },
        { kind: "artifact-safety-completed", message: "The extracted image content passed the second Safety gate." },
        { kind: "artifact-accepted", message: "The image claims were added to the Situation map as artifact claims." },
        { kind: "generation", message: "The recommendation was updated from accepted artifact claims." },
        ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted Situation map." }] : [])
      ]
    }
  };
}

async function addArtifactsToProtocol(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  inputs: GoogleSupportingArtifactInput[],
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  if (!isSituationMapEditable(current.phase)) return mapEditPhaseError();
  const review = await reviewSupportingArtifacts(
    inputs,
    generator,
    current.checkIn.quickDump,
    current.artifacts?.filter((artifact) => artifact.status === "accepted").length ?? 0,
    current.artifactBytes ?? 0,
    current.artifacts?.length ?? 0
  );
  if (review.kind === "safety-interruption") {
    return { kind: "safety-interruption", result: { ...review.result, priorState: current } };
  }
  const situationMap = addArtifactClaims(current.situationMap, review.accepted);
  const generation = await generateAdaptedOutput(
    current.checkIn.quickDump,
    situationMap,
    generator,
    current.clarification?.answers,
    adaptationForState(adaptation, current),
    current.retrievalAttempted ? current.retrievedMemories : undefined
  );
  return {
    kind: "ok",
    state: {
      ...current,
      phase: "recommended",
      selectedPivot: undefined,
      outcome: undefined,
      situationMap: preserveAcceptedMapItems(generation.output.situationMap, situationMap, current.revisions),
      recommendation: recommendationFromOutput(generation.output),
      artifacts: [...(current.artifacts ?? []), ...review.states],
      artifactBytes: (current.artifactBytes ?? 0) + review.acceptedBytes,
      memoryExplanations: generation.explanations,
      retrievedMemories: generation.memories,
      retrievalAttempted: generation.retrievalAttempted,
      adaptationStatus: generation.status,
      guidancePreferenceIds: generation.preferenceIds,
      fallback: current.fallback || review.fallback || generation.fallback,
      activity: [
        ...current.activity,
        ...review.activity,
        { kind: "generation", message: "The recommendation was updated from accepted artifact claims." },
        ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted Situation map." }] : [])
      ]
    }
  };
}

async function addContextToProtocol(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "add-context" }>,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  const message = command.message.trim();
  if (!message || message.length > 10_000) {
    return { kind: "invalid-command", message: "A context message must be between 1 and 10,000 characters." };
  }
  if (current.phase === "outcome" || current.phase === "dismissed") {
    return { kind: "invalid-command", message: "This Check-in is no longer accepting context." };
  }
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending action before adding context." };
  }

  const before = snapshotForUndo(current);
  const situationMap = {
    ...current.situationMap,
    shared: [
      ...current.situationMap.shared,
      createSituationMapItem(`context-${current.conversation.length + 1}`, message, "person")
    ]
  };
  const activity = [...current.activity, {
    kind: "context-added" as const,
    message: "The person added stated context to the Situation map."
  }];

  if (current.phase === "selected") {
    const nextState = {
      ...current,
      situationMap,
      activity
    };
    return {
      kind: "ok",
      state: withUndoableUpdate(
        nextState,
        before,
        "stated-context",
        "Added stated context to the Situation map.",
        message,
        guideResponseForState(nextState, "The new context is visible in the Situation map."),
        [{ kind: "situation-map", summary: "The new stated context was added to the Situation map.", undoable: true }]
      )
    };
  }

  const generation = await generateAdaptedOutput(
    current.checkIn.quickDump,
    situationMap,
    generator,
    current.clarification?.answers,
    adaptationForState(adaptation, current),
    current.retrievalAttempted ? current.retrievedMemories : undefined
  );
  const remainsClarifying = current.phase === "clarifying";
  const nextState = {
    ...current,
    phase: remainsClarifying ? "clarifying" as const : "recommended" as const,
    situationMap: preserveAcceptedMapItems(generation.output.situationMap, situationMap, current.revisions),
    ...(remainsClarifying ? { recommendation: undefined } : { recommendation: recommendationFromOutput(generation.output) }),
    fallback: current.fallback || generation.fallback,
    memoryExplanations: generation.explanations,
    retrievedMemories: generation.memories,
    retrievalAttempted: generation.retrievalAttempted,
    adaptationStatus: generation.status,
    guidancePreferenceIds: generation.preferenceIds,
    activity: [
      ...activity,
      { kind: "generation" as const, message: "The Situation map was updated from the person's stated context." },
      ...(remainsClarifying
        ? [{ kind: "clarification-question" as const, message: "The current clarification remains available." }]
        : [{ kind: "recommendation-regenerated" as const, message: "The recommendation was updated from the person's stated context." }]),
      ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])
    ]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "stated-context",
      "Added stated context and refreshed the visible protocol state.",
      message,
      generation.output.guideResponse ?? guideResponseForState(nextState, "The visible protocol state was updated from that context."),
      [
        { kind: "situation-map", summary: "The new stated context was added to the Situation map.", undoable: true },
        ...(remainsClarifying
          ? [{ kind: "clarification" as const, summary: "The current clarification remains visible.", undoable: false }]
          : [{ kind: "recommendation" as const, summary: "The recommendation was refreshed from the new context.", undoable: false }])
      ]
    )
  };
}

async function answerClarification(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "answer-clarification" | "skip-clarification" }>,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
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
  const generation = await generateAdaptedOutput(current.checkIn.quickDump, situationMap, generator, clarificationAnswers, adaptationForState(adaptation, current), current.retrievalAttempted ? current.retrievedMemories : undefined);
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
  const before = snapshotForUndo(current);
  const nextState = {
    ...stateWithoutRecommendation,
    phase: nextQuestion ? "clarifying" as const : "recommended" as const,
    situationMap: preserveAcceptedMapItems(output.situationMap, situationMap, current.revisions),
    ...(nextQuestion ? {} : { recommendation: recommendationFromOutput(output) }),
    clarification: {
      question: nextQuestion ?? current.clarification.question,
      answers: clarificationAnswers
    },
    fallback: current.fallback || generation.fallback,
    memoryExplanations: generation.explanations,
    retrievedMemories: generation.memories,
    retrievalAttempted: generation.retrievalAttempted,
    adaptationStatus: generation.status,
    guidancePreferenceIds: generation.preferenceIds,
    activity: [...current.activity, event, ...(nextQuestion ? [{ kind: "clarification-question" as const, message: "One clarification question is ready." }] : [{ kind: "generation" as const, message: "The recommendation was updated from the clarification." }]), ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "clarification",
      skipped ? "Skipped a clarification question." : "Added a clarification answer to the Situation map.",
      skipped ? "Skip the clarification question." : answer ?? "Answer the clarification question.",
      output.guideResponse ?? guideResponseForState(nextState, nextQuestion ? "The current clarification remains visible." : "The recommendation now reflects your answer."),
      [
        { kind: "clarification", summary: skipped ? "The clarification was skipped." : "The answer was added as stated context.", undoable: true },
        ...(nextQuestion
          ? [{ kind: "clarification" as const, summary: "One clarification remains before recommendation.", undoable: false }]
          : [{ kind: "recommendation" as const, summary: "The recommendation was updated from the clarification.", undoable: false }])
      ]
    )
  };
}

async function resolveContradiction(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "resolve-contradiction" }>,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  const situationMap = {
    ...current.situationMap,
    contradictions: current.situationMap.contradictions.filter((item) => item.id !== command.itemId)
  };
  const generation = await generateAdaptedOutput(
    current.checkIn.quickDump,
    situationMap,
    generator,
    current.clarification?.answers,
    adaptationForState(adaptation, current),
    current.retrievalAttempted ? current.retrievedMemories : undefined
  );
  const situationMapAfterResolution = preserveAcceptedMapItems(
    generation.output.situationMap,
    situationMap,
    current.revisions
  );
  situationMapAfterResolution.contradictions = situationMapAfterResolution.contradictions
    .filter((item) => item.id !== command.itemId);
  const before = snapshotForUndo(current);
  const nextState = {
    ...current,
    situationMap: situationMapAfterResolution,
    ...(current.phase === "recommended" ? { recommendation: recommendationFromOutput(generation.output) } : { recommendation: undefined }),
    fallback: current.fallback || generation.fallback,
    memoryExplanations: generation.explanations,
    retrievedMemories: generation.memories,
    retrievalAttempted: generation.retrievalAttempted,
    adaptationStatus: generation.status,
    guidancePreferenceIds: generation.preferenceIds,
    activity: [...current.activity, {
      kind: "contradiction-resolved" as const,
      message: "The person resolved a Situation-map contradiction and the recommendation was updated."
    }, ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "contradiction-resolution",
      "Resolved a contradiction in the Situation map.",
      "Resolve the contradiction.",
      generation.output.guideResponse ?? guideResponseForState(nextState, "The contradiction was removed from the visible map."),
      [
        { kind: "situation-map", summary: "The contradiction was removed from the Situation map.", undoable: true },
        ...(current.phase === "recommended"
          ? [{ kind: "recommendation" as const, summary: "The recommendation was refreshed after the resolution.", undoable: false }]
          : [])
      ]
    )
  };
}

async function correctMap(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "correct-map" }>,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
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
  const generation = await generateAdaptedOutput(current.checkIn.quickDump, situationMap, generator, current.clarification?.answers, adaptationForState(adaptation, current), current.retrievalAttempted ? current.retrievedMemories : undefined);
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
  const remainsClarifying = current.phase === "clarifying";
  const before = snapshotForUndo(current);
  const nextState = {
    ...current,
    phase: remainsClarifying ? "clarifying" as const : "recommended" as const,
    situationMap: preserveAcceptedMapItems(output.situationMap, situationMap, [...current.revisions, revision]),
    ...(remainsClarifying ? { recommendation: undefined } : { recommendation: recommendationFromOutput(output) }),
    selectedPivot: undefined,
    outcome: undefined,
    fallback: current.fallback || generation.fallback,
    memoryExplanations: generation.explanations,
    retrievedMemories: generation.memories,
    retrievalAttempted: generation.retrievalAttempted,
    adaptationStatus: generation.status,
    guidancePreferenceIds: generation.preferenceIds,
    revisions: [
      ...current.revisions,
      revision
    ],
    activity: [...current.activity, {
      kind: "map-revised" as const,
      message: "The person corrected the Situation map; the recommendation was updated."
    }, ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted protocol state." }] : [])]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "map-correction",
      "Corrected a Situation-map item.",
      `Correction: ${text}`,
      output.guideResponse ?? guideResponseForState(nextState, remainsClarifying ? "The map is corrected; the current question remains available." : "The recommendation now reflects the corrected map."),
      [
        { kind: "situation-map", summary: "The corrected map item is visible with person provenance.", undoable: true },
        ...(remainsClarifying
          ? [{ kind: "clarification" as const, summary: "The current clarification remains available.", undoable: false }]
          : [{ kind: "recommendation" as const, summary: "The recommendation was refreshed from the corrected map.", undoable: false }])
      ]
    )
  };
}

async function generateValidatedOutput(
  quickDump: string,
  situationMap: SituationMap,
  generator: GooglePivotGenerator,
  clarificationAnswers?: ClarificationAnswer[],
  stepContext?: {
    currentAction?: SituationalPivotAction;
    stepFeedback?: PivotStepFeedback;
    completedActions?: readonly SituationalPivotAction[];
    retrievedMemories?: readonly GoogleRetrievedMemory[];
  }
): Promise<{ output: GooglePivotGeneratorOutput; fallback: boolean }> {
  let generatedOutput: unknown;
  try {
    generatedOutput = await generator.generate({ quickDump, situationMap, clarificationAnswers, ...stepContext });
    return { output: validatedGeneratedOutput(generatedOutput, situationMap), fallback: false };
  } catch (error) {
    if (generator.repair) {
      try {
        const repairedOutput = await generator.repair({ quickDump, situationMap, invalidOutput: generatedOutput ?? error, clarificationAnswers, ...stepContext });
        return { output: validatedGeneratedOutput(repairedOutput, situationMap), fallback: false };
      } catch {
        // Fall through to the curated output so accepted state survives a platform failure.
      }
    }
    return { output: fallbackOutput(quickDump, situationMap), fallback: true };
  }
}

async function recordStepFeedback(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  feedback: PivotStepFeedback,
  generator: GooglePivotGenerator
): Promise<GooglePivotCommandResult> {
  if (current.phase !== "selected" || !current.selectedPivot || !current.miniPlan) {
    return { kind: "invalid-command", message: "Select a Pivot before recording step feedback." };
  }
  if (!isValidPivotStepFeedback(feedback)) {
    return { kind: "invalid-command", message: "The Pivot step feedback is invalid." };
  }
  if (current.miniPlan.feedback.length >= current.miniPlan.stepNumber) {
    return { kind: "invalid-command", message: "The three-step Pivot mini-plan is complete." };
  }

  const currentAction = current.miniPlan.currentAction;
  const feedbackHistory = [...current.miniPlan.feedback, feedback];
  const completedActions = [...current.miniPlan.completedActions, currentAction];
  const situationMap = {
    ...current.situationMap,
    pivotHistory: [
      ...current.situationMap.pivotHistory,
      createSituationMapItem(
        `pivot-step-${current.miniPlan.stepNumber}`,
        `${currentAction.title}: ${feedback.status}.`,
        "person"
      )
    ]
  };
  const activity: ActivityEvent[] = [...current.activity, {
    kind: "step-feedback" as const,
    message: `The person reported that the current step was ${feedback.status}.`
  }];
  const before = snapshotForUndo(current);

  if (current.miniPlan.stepNumber >= current.miniPlan.maxSteps) {
    const nextState = {
      ...current,
      situationMap,
      miniPlan: { ...current.miniPlan, completedActions, feedback: feedbackHistory },
      activity
    };
    return {
      kind: "ok",
      state: withUndoableUpdate(
        nextState,
        before,
        "feedback",
        "Recorded feedback for the final mini-plan step.",
        `Feedback: ${feedback.status}`,
        guideResponseForState(nextState, "The final step feedback is visible in the Activity trace."),
        [{ kind: "feedback", summary: `Recorded that the current step was ${feedback.status}.`, undoable: true }]
      )
    };
  }

  const generation = await generateValidatedOutput(
    current.checkIn.quickDump,
    situationMap,
    generator,
    current.clarification?.answers,
    {
      currentAction,
      stepFeedback: feedback,
      completedActions,
      retrievedMemories: current.retrievedMemories
    }
  );
  const output = generation.output;
  const nextAction = output.primaryAction ?? situationalActionForPivot(requirePivot(output.primaryPivotKind));
  const nextState = {
    ...current,
    situationMap: preserveAcceptedMapItems(output.situationMap, situationMap, current.revisions),
    recommendation: recommendationFromOutput(output),
    miniPlan: {
      currentAction: nextAction,
      completedActions,
      feedback: feedbackHistory,
      stepNumber: current.miniPlan.stepNumber + 1,
      maxSteps: current.miniPlan.maxSteps
    },
    fallback: current.fallback || generation.fallback,
    activity: [...activity, {
      kind: "step-generation" as const,
      message: "The next situational Pivot action was generated from the person's feedback."
    }, ...(generation.fallback ? [{ kind: "fallback" as const, message: "Curated fallback preserved the accepted mini-plan." }] : [])]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "feedback",
      "Recorded feedback and generated the next visible mini-plan action.",
      `Feedback: ${feedback.status}`,
      output.guideResponse ?? guideResponseForState(nextState, "The next action reflects that feedback."),
      [
        { kind: "feedback", summary: `Recorded that the current step was ${feedback.status}.`, undoable: true },
        { kind: "recommendation", summary: "Generated one next mini-plan action from the feedback.", undoable: false }
      ]
    )
  };
}

function shrinkCurrentAction(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): GooglePivotCommandResult {
  if (current.phase !== "selected" || !current.miniPlan) {
    return { kind: "invalid-command", message: "Choose a Pivot before shrinking its current action." };
  }
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending action before changing the current action." };
  }
  const before = snapshotForUndo(current);
  const smallerAction = smallerActionFor(current.miniPlan.currentAction);
  const nextState = {
    ...current,
    miniPlan: { ...current.miniPlan, currentAction: smallerAction },
    activity: [...current.activity, {
      kind: "action-shrunk" as const,
      message: "The current Pivot action was made smaller at the person's request."
    }]
  };
  return {
    kind: "ok",
    state: withUndoableUpdate(
      nextState,
      before,
      "action-shrink",
      "Made the current Pivot action smaller.",
      "Make this action smaller.",
      guideResponseForState(nextState, "The smaller action is visible and ready when you are."),
      [{ kind: "action-shrink", summary: "The current action now contains one smaller step.", undoable: true }]
    )
  };
}

function requestOutcomeConfirmation(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  outcome: PivotOutcome
): GooglePivotCommandResult {
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending outcome before submitting another one." };
  }
  const confirmation: GooglePendingConfirmation = {
    id: `confirmation-${current.conversation.length + 1}`,
    kind: "record-outcome",
    summary: current.saveRequested
      ? "Record this outcome and save the Check-in?"
      : "Record this Pivot outcome for this session?",
    outcome
  };
  const nextState = {
    ...current,
    pendingConfirmation: confirmation,
    activity: [...current.activity, {
      kind: "confirmation-requested" as const,
      message: "The person was shown a confirmation before the Pivot outcome was recorded."
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      `Record outcome: ${outcome.status}`,
      guideResponseForState(nextState, confirmation.summary),
      [{ id: confirmation.id, kind: "confirmation", summary: confirmation.summary, undoable: false }]
    )
  };
}

function requestMemoryConfirmation(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "forget-memory" | "delete-memory" }>
): GooglePivotCommandResult {
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending action before changing memory." };
  }
  const confirmation: GooglePendingConfirmation = {
    id: `confirmation-${current.conversation.length + 1}`,
    kind: command.type,
    summary: command.type === "forget-memory"
      ? "Forget this saved memory?"
      : "Delete this saved memory?",
    memoryId: command.memoryId
  };
  const nextState = {
    ...current,
    pendingConfirmation: confirmation,
    activity: [...current.activity, {
      kind: "confirmation-requested" as const,
      message: "The person was shown a confirmation before changing saved memory."
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      command.type === "forget-memory" ? "Forget this memory." : "Delete this memory.",
      guideResponseForState(nextState, confirmation.summary),
      [{ id: confirmation.id, kind: "confirmation", summary: confirmation.summary, undoable: false }]
    )
  };
}

function requestDismissalConfirmation(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): GooglePivotCommandResult {
  if (current.phase !== "recommended" || !current.recommendation) {
    return { kind: "invalid-command", message: "A recommendation must be available before dismissing this Pivot." };
  }
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending action before dismissing this Pivot." };
  }
  const confirmation: GooglePendingConfirmation = {
    id: `confirmation-${current.conversation.length + 1}`,
    kind: "dismiss-pivot",
    summary: "Dismiss this Pivot recommendation?"
  };
  const nextState = {
    ...current,
    pendingConfirmation: confirmation,
    activity: [...current.activity, {
      kind: "confirmation-requested" as const,
      message: "The person was shown a confirmation before dismissing the Pivot recommendation."
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      "Dismiss the Pivot recommendation.",
      guideResponseForState(nextState, confirmation.summary),
      [{ id: confirmation.id, kind: "confirmation", summary: confirmation.summary, undoable: false }]
    )
  };
}

function requestDiscardConfirmation(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): GooglePivotCommandResult {
  if (current.phase === "outcome" || current.phase === "dismissed") {
    return { kind: "invalid-command", message: "This Check-in is no longer available to discard." };
  }
  if (current.pendingConfirmation) {
    return { kind: "invalid-command", message: "Confirm or cancel the pending action before discarding this Check-in." };
  }
  const confirmation: GooglePendingConfirmation = {
    id: `confirmation-${current.conversation.length + 1}`,
    kind: "discard-check-in",
    summary: "Discard this Check-in and its temporary conversation?"
  };
  const nextState = {
    ...current,
    pendingConfirmation: confirmation,
    activity: [...current.activity, {
      kind: "confirmation-requested" as const,
      message: "The person was shown a confirmation before discarding the Check-in."
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      "Discard this Check-in.",
      guideResponseForState(nextState, confirmation.summary),
      [{ id: confirmation.id, kind: "confirmation", summary: confirmation.summary, undoable: false }]
    )
  };
}

async function applyMemoryControl(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  command: Extract<GooglePivotCommand, { type: "exclude-memory" | "forget-memory" | "delete-memory" }>,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  try {
    if (command.type === "exclude-memory" && adaptation?.excludeMemory && !(await adaptation.excludeMemory({ ownerSubject: adaptation.ownerSubject, memoryId: command.memoryId }))) {
      return { kind: "invalid-command", message: "That memory could not be excluded." };
    }
    if (command.type === "forget-memory" && adaptation?.forgetMemory && !(await adaptation.forgetMemory({ ownerSubject: adaptation.ownerSubject, memoryId: command.memoryId }))) {
      return { kind: "invalid-command", message: "That memory could not be forgotten." };
    }
    if (command.type === "delete-memory" && adaptation?.deleteMemory && !(await adaptation.deleteMemory({ ownerSubject: adaptation.ownerSubject, memoryId: command.memoryId }))) {
      return { kind: "invalid-command", message: "That memory could not be deleted." };
    }
  } catch {
    return {
      kind: "dependency-unavailable",
      message: "Memory controls are temporarily unavailable; the current Situation map was preserved.",
      state: current
    };
  }
  const nextExcluded = [...new Set([...current.excludedMemoryIds, command.memoryId])];
  if (!adaptation) {
    const nextState = {
      ...current,
      excludedMemoryIds: nextExcluded,
      memoryExplanations: current.memoryExplanations.filter((memory) => memory.memoryId !== command.memoryId),
      activity: [...current.activity, {
        kind: "recommendation-regenerated" as const,
        message: "The memory no longer informs this protocol."
      }]
    };
    return {
      kind: "ok",
      state: appendConversationTurn(
        nextState,
        `${command.type === "exclude-memory" ? "Exclude" : command.type === "forget-memory" ? "Forget" : "Delete"} memory.`,
        guideResponseForState(nextState, "The memory control was applied to this Check-in."),
        [{ id: `memory-control-${current.conversation.length + 1}`, kind: "confirmation", summary: "The memory was removed from the visible protocol context.", undoable: false }]
      )
    };
  }
  const nextAdaptation = { ...adaptation, excludedMemoryIds: nextExcluded };
  const nextSituationMap = removeMemoryPatterns(current.situationMap, nextExcluded);
  const generation = await generateAdaptedOutput(current.checkIn.quickDump, nextSituationMap, generator, current.clarification?.answers, nextAdaptation, current.retrievalAttempted ? current.retrievedMemories : undefined);
  const nextState = {
    ...current,
    phase: "recommended" as const,
    pendingConfirmation: undefined,
    selectedPivot: undefined,
    outcome: undefined,
    situationMap: preserveAcceptedMapItems(generation.output.situationMap, nextSituationMap, current.revisions),
    recommendation: recommendationFromOutput(generation.output),
    excludedMemoryIds: nextExcluded,
    memoryExplanations: generation.explanations,
    retrievedMemories: generation.memories,
    retrievalAttempted: generation.retrievalAttempted,
    guidancePreferenceIds: generation.preferenceIds,
    adaptationStatus: generation.status,
    fallback: current.fallback || generation.fallback,
    activity: [...current.activity, { kind: "recommendation-regenerated" as const, message: command.type === "exclude-memory" ? "The excluded memory no longer informs this recommendation." : "The removed memory no longer informs this recommendation." }, ...(generation.fallback ? [{ kind: "fallback" as const, message: "Personalization is unavailable; the accepted Situation map remains usable." }] : [])]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      `${command.type === "exclude-memory" ? "Exclude" : command.type === "forget-memory" ? "Forget" : "Delete"} memory.`,
      generation.output.guideResponse ?? guideResponseForState(nextState, "The recommendation was updated without that memory."),
      [{ id: `memory-control-${current.conversation.length + 1}`, kind: "recommendation", summary: "The recommendation was refreshed without that memory.", undoable: false }]
    )
  };
}

async function confirmAction(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  confirmationId: string,
  generator: GooglePivotGenerator,
  adaptation?: GooglePivotAdaptation
): Promise<GooglePivotCommandResult> {
  if (!current.pendingConfirmation) {
    return { kind: "invalid-command", message: "There is no pending action to confirm." };
  }
  if (current.pendingConfirmation.id !== confirmationId) {
    return { kind: "invalid-command", message: "That confirmation is no longer current." };
  }
  const pending = current.pendingConfirmation;
  const prepared = {
    ...current,
    pendingConfirmation: undefined,
    activity: [...current.activity, {
      kind: "confirmation-confirmed" as const,
      message: "The person explicitly confirmed the pending action."
    }]
  };
  if (pending.kind === "dismiss-pivot") {
    const nextState = {
      ...prepared,
      phase: "dismissed" as const,
      selectedPivot: undefined,
      activity: [...prepared.activity, {
        kind: "pivot-dismissed" as const,
        message: "The person explicitly confirmed dismissal of the Pivot recommendation."
      }]
    };
    return {
      kind: "ok",
      state: appendConversationTurn(
        nextState,
        "Confirm dismissal.",
        guideResponseForState(nextState, "The recommendation was dismissed; the Situation map remains available."),
        [{ id: `${pending.id}-confirmed`, kind: "confirmation", summary: "The Pivot recommendation was dismissed after explicit confirmation.", undoable: false }]
      )
    };
  }
  if (pending.kind === "discard-check-in") {
    const nextState = {
      ...prepared,
      phase: "dismissed" as const,
      selectedPivot: undefined,
      recommendation: undefined,
      activity: [...prepared.activity, {
        kind: "pivot-dismissed" as const,
        message: "The person explicitly confirmed discarding this Check-in."
      }]
    };
    return {
      kind: "ok",
      state: appendConversationTurn(
        nextState,
        "Confirm discarding this Check-in.",
        guideResponseForState(nextState, "The Check-in is ready to be discarded."),
        [{ id: `${pending.id}-confirmed`, kind: "confirmation", summary: "The Check-in was approved for discard after explicit confirmation.", undoable: false }]
      )
    };
  }
  if (pending.kind === "forget-memory" || pending.kind === "delete-memory") {
    if (!pending.memoryId || !adaptation) {
      return { kind: "invalid-command", message: "The pending memory action is unavailable." };
    }
    return applyMemoryControl(prepared, { type: pending.kind, memoryId: pending.memoryId }, generator, adaptation);
  }
  if (pending.kind !== "record-outcome" || !pending.outcome || !prepared.selectedPivot) {
    return { kind: "invalid-command", message: "The pending action is invalid." };
  }
  const result = await recordOutcome(prepared, prepared.selectedPivot, pending.outcome, generator);
  if (result.kind !== "ok") return result;
  return {
    kind: "ok",
    state: appendConversationTurn(
      result.state,
      `Confirm outcome: ${pending.outcome.status}`,
      guideResponseForState(result.state, "The outcome was recorded after your confirmation."),
      [{ id: `${pending.id}-confirmed`, kind: "confirmation", summary: "The outcome was recorded after explicit confirmation.", undoable: false }]
    )
  };
}

function cancelConfirmation(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  confirmationId: string
): GooglePivotCommandResult {
  if (!current.pendingConfirmation) {
    return { kind: "invalid-command", message: "There is no pending action to cancel." };
  }
  if (current.pendingConfirmation.id !== confirmationId) {
    return { kind: "invalid-command", message: "That confirmation is no longer current." };
  }
  const nextState = {
    ...current,
    pendingConfirmation: undefined,
    activity: [...current.activity, {
      kind: "confirmation-cancelled" as const,
      message: "The person cancelled the pending action; no change was made."
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      nextState,
      "Cancel confirmation.",
      guideResponseForState(nextState, "Nothing was recorded."),
      [{ id: `${confirmationId}-cancelled`, kind: "confirmation", summary: "The pending action was cancelled.", undoable: false }]
    )
  };
}

function undoUpdate(
  current: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  updateId: string
): GooglePivotCommandResult {
  const latest = current.undoableUpdates.at(-1);
  if (!latest) return { kind: "invalid-command", message: "There is no reversible update to undo." };
  if (latest.id !== updateId) return { kind: "invalid-command", message: "Only the most recent reversible update can be undone." };
  const restored = {
    ...current,
    ...latest.before,
    pendingConfirmation: undefined,
    undoableUpdates: current.undoableUpdates.slice(0, -1),
    activity: [...current.activity, {
      kind: "undo-applied" as const,
      message: `The person undid this visible update: ${latest.summary}`
    }]
  };
  return {
    kind: "ok",
    state: appendConversationTurn(
      restored,
      "Undo the last update.",
      guideResponseForState(restored, "The previous structured protocol state is visible again."),
      [{ id: `${latest.id}-undo`, kind: "situation-map", summary: `Undid: ${latest.summary}`, undoable: false }]
    )
  };
}

function adaptationForState(
  adaptation: GooglePivotAdaptation | undefined,
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): GooglePivotAdaptation | undefined {
  return adaptation ? { ...adaptation, excludedMemoryIds: state.excludedMemoryIds } : undefined;
}

async function generateAdaptedOutput(
  quickDump: string,
  situationMap: SituationMap,
  generator: GooglePivotGenerator,
  clarificationAnswers: ClarificationAnswer[] | undefined,
  adaptation: GooglePivotAdaptation | undefined,
  reuseMemories?: readonly GoogleRetrievedMemory[]
): Promise<{
  output: GooglePivotGeneratorOutput;
  fallback: boolean;
  status: "not-requested" | "personalized" | "no-match" | "unavailable";
  explanations: GoogleMemoryExplanation[];
  preferenceIds: string[];
  memories: GoogleRetrievedMemory[];
  retrievalAttempted: boolean;
  retrievalMode: "not-requested" | "tool" | "server-fallback" | "reused" | "direct" | "unavailable";
}> {
  const generated = await generateValidatedOutput(quickDump, situationMap, generator, clarificationAnswers);
  if (!adaptation || generated.output.clarificationQuestion) {
    return { ...generated, status: "not-requested", explanations: [], preferenceIds: [], memories: [], retrievalAttempted: false, retrievalMode: "not-requested" };
  }

  let currentDerivedContext: string;
  try {
    currentDerivedContext = validateDerivedMemoryContext(
      await (generator.prepareMemory?.({ situationMap: memorySafeSituationMap(situationMap) }) ?? Promise.resolve(defaultPendingMemory(situationMap)))
    );
  } catch {
    return {
      ...generated,
      fallback: true,
      status: "unavailable",
      explanations: [],
      preferenceIds: [],
      memories: [],
      retrievalAttempted: false,
      retrievalMode: "unavailable"
    };
  }

  const adapted = await adaptOutput({
    quickDump,
    situationMap: generated.output.situationMap,
    baseOutput: generated.output,
    currentDerivedContext,
    generator,
    adaptation,
    reuseMemories
  });
  return {
    output: adapted.output,
    fallback: generated.fallback || adapted.status === "unavailable",
    status: adapted.status,
    explanations: adapted.explanations,
    preferenceIds: adapted.preferenceIds,
    memories: adapted.memories,
    retrievalAttempted: adapted.retrievalAttempted,
    retrievalMode: adapted.retrievalMode
  };
}

async function adaptOutput({
  quickDump,
  situationMap,
  baseOutput,
  currentDerivedContext,
  generator,
  adaptation,
  reuseMemories
}: {
  quickDump: string;
  situationMap: SituationMap;
  baseOutput: GooglePivotGeneratorOutput;
  currentDerivedContext: string;
  generator: GooglePivotGenerator;
  adaptation: GooglePivotAdaptation;
  reuseMemories?: readonly GoogleRetrievedMemory[];
}): Promise<{
  output: GooglePivotGeneratorOutput;
  status: "personalized" | "no-match" | "unavailable";
  explanations: GoogleMemoryExplanation[];
  preferenceIds: string[];
  memories: GoogleRetrievedMemory[];
  retrievalAttempted: boolean;
  retrievalMode: "tool" | "server-fallback" | "reused" | "direct" | "unavailable";
}> {
  try {
    const excludedMemoryIds = adaptation.excludedMemoryIds ?? [];
    const toolState = reuseMemories ? undefined : createMemoryRetrievalTool(adaptation, currentDerivedContext);
    const retrieved = reuseMemories ?? (generator.usesMemoryTool ? [] : await retrieveMemories(adaptation, currentDerivedContext, excludedMemoryIds));
    const memories = sanitizeRetrievedMemories(retrieved, excludedMemoryIds);
    const guidancePreferences = [...await adaptation.listGuidancePreferences(adaptation.ownerSubject)];
    let adaptedOutput: unknown;
    let adaptationWasRepaired = false;
    if (generator.adapt && (generator.usesMemoryTool || memories.length > 0 || guidancePreferences.length > 0)) {
      try {
        adaptedOutput = await generator.adapt({
          situationMap: adaptationMap(situationMap),
          currentDerivedContext,
          retrievedMemories: generator.usesMemoryTool && !reuseMemories ? [] : memories,
          guidancePreferences,
          ...(toolState ? { memoryTool: toolState.tool } : {})
        });
      } catch (error) {
        if (!generator.repair) throw error;
        adaptationWasRepaired = true;
        adaptedOutput = await generator.repair({
          quickDump,
          situationMap,
          invalidOutput: error,
          retrievedMemories: memories
        });
      }
    }
    const toolWasSkipped = Boolean(generator.usesMemoryTool && !reuseMemories && toolState && !toolState.wasCalled());
    const toolMemories = toolState?.memories() ?? [];
    const fallbackMemories = toolWasSkipped
      ? await retrieveMemories(adaptation, currentDerivedContext, excludedMemoryIds)
      : [];
    const retrievalAttempted = Boolean(reuseMemories || toolState?.wasCalled() || toolWasSkipped || !generator.usesMemoryTool);
    const retrievalMode = reuseMemories
      ? "reused" as const
      : toolWasSkipped
        ? "server-fallback" as const
        : generator.usesMemoryTool
          ? "tool" as const
          : "direct" as const;
    const resolvedMemories = sanitizeRetrievedMemories(
      toolWasSkipped
        ? fallbackMemories
        : generator.usesMemoryTool && !reuseMemories ? toolMemories : memories,
      excludedMemoryIds
    );
    const explanations = resolvedMemories.map((memory) => ({
      memoryId: memory.id,
      protocolId: memory.protocolId,
      text: `A saved Check-in used “${memory.selectedActionTitle ?? memory.selectedPivotTitle}” and was marked ${memory.outcome.status}.`
    }));
    if (resolvedMemories.length === 0 && guidancePreferences.length === 0) {
      return { output: baseOutput, status: "no-match", explanations: [], preferenceIds: [], memories: [], retrievalAttempted, retrievalMode };
    }
    const fallbackOutputCandidate = fallbackAdaptation(situationMap, resolvedMemories, guidancePreferences);
    let output: GooglePivotGeneratorOutput;
    if (adaptedOutput !== undefined && !toolWasSkipped) {
      try {
        output = validatedGeneratedOutput(adaptedOutput, situationMap);
      } catch (error) {
        if (!generator.repair || adaptationWasRepaired) throw error;
        const repairedOutput = await generator.repair({
          quickDump,
          situationMap,
          invalidOutput: adaptedOutput,
          retrievedMemories: resolvedMemories
        });
        output = validatedGeneratedOutput(repairedOutput, situationMap);
      }
    } else {
      output = validatedGeneratedOutput(
        toolWasSkipped ? fallbackOutputCandidate : adaptedOutput ?? fallbackOutputCandidate,
        situationMap
      );
    }
    output = applyOutcomeSignals(output, situationMap, resolvedMemories, guidancePreferences);
    const preservedMap = preserveAcceptedMapItems(output.situationMap, situationMap, []);
    return {
      output: {
        ...output,
        situationMap: addPriorPatternItems(preservedMap, explanations)
      },
      status: "personalized",
      explanations,
      preferenceIds: guidancePreferences.map((preference) => preference.id),
      memories: [...resolvedMemories],
      retrievalAttempted,
      retrievalMode
    };
  } catch {
    return { output: { ...fallbackOutput("", situationMap), situationMap }, status: "unavailable", explanations: [], preferenceIds: [], memories: [], retrievalAttempted: true, retrievalMode: "unavailable" };
  }
}

function memoryRetrievalActivityMessage(
  retrievalMode: "not-requested" | "tool" | "server-fallback" | "reused" | "direct" | "unavailable"
): string {
  if (retrievalMode === "tool") return "Genkit called the server-bound retrieve_similar_memories tool once.";
  if (retrievalMode === "server-fallback") return "The server performed the required owner-scoped memory retrieval.";
  if (retrievalMode === "reused") return "The previously retrieved owner-scoped memories were reused for this Check-in.";
  return "The owner-scoped memory retrieval was unavailable; no memory results were used.";
}

async function retrieveMemories(
  adaptation: GooglePivotAdaptation,
  currentDerivedContext: string,
  excludedMemoryIds: readonly string[]
): Promise<readonly GoogleRetrievedMemory[]> {
  return adaptation.retrieveSimilarMemories({
    ownerSubject: adaptation.ownerSubject,
    queryEmbedding: validateGoogleEmbedding(await adaptation.embed(currentDerivedContext)),
    limit: Math.min(adaptation.limit ?? 3, 3),
    threshold: adaptation.threshold ?? 0.5,
    excludedMemoryIds
  });
}

function createMemoryRetrievalTool(
  adaptation: GooglePivotAdaptation,
  currentDerivedContext: string
): { tool: GoogleMemoryRetrievalTool; memories: () => readonly GoogleRetrievedMemory[]; wasCalled: () => boolean } {
  let called = false;
  let retrieved: readonly GoogleRetrievedMemory[] = [];
  const tool: GoogleMemoryRetrievalTool = {
    async retrieveSimilarMemories() {
      if (called) throw new Error("Only one retrieval is permitted per Check-in.");
      called = true;
      retrieved = await retrieveMemories(adaptation, currentDerivedContext, adaptation.excludedMemoryIds ?? []);
      return sanitizeRetrievedMemories(retrieved, adaptation.excludedMemoryIds ?? []);
    },
    wasCalled: () => called
  };
  return { tool, memories: () => retrieved, wasCalled: () => called };
}

function sanitizeRetrievedMemories(
  memories: readonly GoogleRetrievedMemory[],
  excludedMemoryIds: readonly string[]
): GoogleRetrievedMemory[] {
  return memories
    .filter((memory) => memory.approved === true && !excludedMemoryIds.includes(memory.id))
    .slice(0, 3)
    .map((memory) => ({ ...memory }));
}

function adaptationMap(situationMap: SituationMap): SituationMap {
  const sections = Object.fromEntries(
    (Object.keys(situationMap) as Array<keyof SituationMap>).map((section) => [
      section,
      situationMap[section]
        .filter((item) => item.provenance === "guide")
        .map((item) => ({ ...item }))
    ])
  ) as SituationMap;
  return {
    ...sections
  };
}

function fallbackAdaptation(
  situationMap: SituationMap,
  memories: readonly GoogleRetrievedMemory[],
  preferences: readonly GoogleGuidancePreference[]
): GooglePivotGeneratorOutput {
  const helpfulMemory = memories.find(isStrongHelpfulMemory);
  const cautionaryKinds = cautionaryMemoryKinds(memories);
  const avoidBreathing = preferences.some((preference) => /avoid.*breath|not.*breath/i.test(preference.text));
  const preferred = helpfulMemory
    ? requirePivot(helpfulMemory.selectedPivotKind)
    : preferredPivot(situationMap.shared.map((item) => item.text).join(" "));
  const primary = !(avoidBreathing && preferred.kind === "breathing-focus") && !cautionaryKinds.has(preferred.kind)
    ? preferred
    : PIVOT_LIBRARY.find((pivot) => !cautionaryKinds.has(pivot.kind) && !(avoidBreathing && pivot.kind === "breathing-focus")) ?? preferred;
  const alternatives = [
    ...PIVOT_LIBRARY.filter((pivot) => pivot.kind !== primary.kind && !cautionaryKinds.has(pivot.kind)),
    ...PIVOT_LIBRARY.filter((pivot) => pivot.kind !== primary.kind && cautionaryKinds.has(pivot.kind))
  ].slice(0, 2);
  const cautionaryPrimary = cautionaryKinds.has(primary.kind);
  const primaryAction = situationalActionForPivot(primary);
  return {
    situationMap,
    primaryPivotKind: primary.kind,
    alternativePivotKinds: alternatives.map((pivot) => pivot.kind),
    ...(cautionaryPrimary ? { primaryAction: smallerActionFor(primaryAction) } : {}),
    alternativeActions: alternatives.map((pivot) => cautionaryKinds.has(pivot.kind)
      ? smallerActionFor(situationalActionForPivot(pivot))
      : situationalActionForPivot(pivot)),
    whyThisPivot: helpfulMemory
      ? `A completed saved Check-in where you felt more able used “${helpfulMemory.selectedPivotTitle}”; this is one option to consider.`
      : memories.length > 0
        ? cautionaryPrimary
          ? "A prior saved Check-in raised a caution, so this option starts with one smaller step."
          : `A similar saved Check-in was marked ${memories[0].outcome.status}; this is one option to consider.`
      : "This recommendation follows your explicit Guidance preference.",
  };
}

function applyOutcomeSignals(
  output: GooglePivotGeneratorOutput,
  situationMap: SituationMap,
  memories: readonly GoogleRetrievedMemory[],
  preferences: readonly GoogleGuidancePreference[]
): GooglePivotGeneratorOutput {
  const cautionaryKinds = cautionaryMemoryKinds(memories);
  const primary = findPivot(output.primaryPivotKind);
  const relatedKinds = [output.primaryPivotKind, ...output.alternativePivotKinds]
    .flatMap((kind) => {
      const pivot = findPivot(kind);
      return pivot ? [pivot.kind] : [];
    });
  if (!primary || !relatedKinds.some((kind) => cautionaryKinds.has(kind))) {
    return output;
  }
  return fallbackAdaptation(situationMap, memories, preferences);
}

function cautionaryMemoryKinds(memories: readonly GoogleRetrievedMemory[]): Set<GoogleRetrievedMemory["selectedPivotKind"]> {
  const helpfulKinds = new Set(memories.filter(isStrongHelpfulMemory).map((memory) => memory.selectedPivotKind));
  return new Set(
    memories
      .filter(isCautionaryMemory)
      .map((memory) => memory.selectedPivotKind)
      .filter((kind) => !helpfulKinds.has(kind))
  );
}

function isStrongHelpfulMemory(memory: GoogleRetrievedMemory): boolean {
  return memory.outcome.status === "completed" && memory.outcome.agencyShift === "more-able";
}

function isCautionaryMemory(memory: GoogleRetrievedMemory): boolean {
  return memory.cautionarySignals?.includes("blocked") === true ||
    memory.outcome.status === "not-a-fit" ||
    memory.outcome.status === "skipped" ||
    memory.outcome.agencyShift === "less-able";
}

function addPriorPatternItems(
  situationMap: SituationMap,
  explanations: readonly GoogleMemoryExplanation[]
): SituationMap {
  if (explanations.length === 0) return situationMap;
  const existingIds = new Set(situationMap.priorPatterns.map((item) => item.id));
  const additions = explanations
    .filter((explanation) => !existingIds.has(`memory-${explanation.memoryId}`))
    .map((explanation) => createSituationMapItem(`memory-${explanation.memoryId}`, explanation.text, "guide"));
  return { ...situationMap, priorPatterns: [...situationMap.priorPatterns, ...additions] };
}

function removeMemoryPatterns(situationMap: SituationMap, memoryIds: readonly string[]): SituationMap {
  if (memoryIds.length === 0) return situationMap;
  return {
    ...situationMap,
    priorPatterns: situationMap.priorPatterns.filter((item) => !memoryIds.some((id) => item.id === `memory-${id}`))
  };
}

function validateGoogleEmbedding(embedding: readonly number[]): number[] {
  if (embedding.length !== 768) throw new Error("Expected a 768-dimensional Google embedding.");
  if (embedding.some((value) => !Number.isFinite(value))) throw new Error("Google embedding must contain finite values.");
  return [...embedding];
}

function recommendationFromOutput(output: GooglePivotGeneratorOutput) {
  const primary = requirePivot(output.primaryPivotKind);
  const alternatives = output.alternativePivotKinds.map(requirePivot);
  return {
    primary,
    primaryAction: output.primaryAction ?? situationalActionForPivot(primary),
    alternatives,
    alternativeActions: output.alternativeActions ?? alternatives.map(situationalActionForPivot),
    whyThisPivot: output.whyThisPivot
  };
}

function initialConversationTurn(
  quickDump: string,
  output: GooglePivotGeneratorOutput
): GoogleConversationalTurn {
  const turn = {
    id: "turn-1",
    userMessage: quickDump,
    guideResponse: output.guideResponse ?? guideResponseForOutput(output),
    updates: [
      {
        id: "map-created",
        kind: "situation-map" as const,
        summary: "Created a Situation map from the Quick dump.",
        undoable: false
      },
      output.clarificationQuestion
        ? {
            id: "clarification-1",
            kind: "clarification" as const,
            summary: "Asked one useful clarification question.",
            undoable: false
          }
        : {
            id: "recommendation-1",
            kind: "recommendation" as const,
            summary: "Prepared one bounded Pivot and two alternatives.",
            undoable: false
          }
    ]
  } satisfies GoogleConversationalTurn;
  validateConversationalTurn(turn);
  return turn;
}

function withUndoableUpdate(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  before: GoogleUndoSnapshot,
  kind: GoogleUndoableUpdate["kind"],
  summary: string,
  userMessage: string,
  guideResponse: GoogleGuideResponse,
  updates: Array<Omit<GoogleVisibleProtocolUpdate, "id">>
): Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  const id = `update-${state.conversation.length + 1}`;
  const undoableUpdate: GoogleUndoableUpdate = { id, kind, summary, before };
  const visibleUpdates = updates.map((update, index) => ({ ...update, id: index === 0 ? id : `${id}-${index + 1}` }));
  return appendConversationTurn(
    { ...state, undoableUpdates: [...state.undoableUpdates, undoableUpdate] },
    userMessage,
    guideResponse,
    visibleUpdates
  );
}

function appendConversationTurn(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  userMessage: string,
  guideResponse: GoogleGuideResponse,
  updates: GoogleVisibleProtocolUpdate[]
): Extract<GooglePivotResult, { kind: "pivot-protocol" }> {
  const turn: GoogleConversationalTurn = {
    id: `turn-${state.conversation.length + 1}`,
    userMessage: userMessage.trim(),
    guideResponse: validatedGuideResponse(guideResponse),
    updates
  };
  validateConversationalTurn(turn);
  return { ...state, conversation: [...state.conversation, turn] };
}

function snapshotForUndo(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>
): GoogleUndoSnapshot {
  return {
    situationMap: state.situationMap,
    phase: state.phase,
    ...(state.clarification ? { clarification: state.clarification } : {}),
    revisions: state.revisions,
    ...(state.selectedPivot ? { selectedPivot: state.selectedPivot } : {}),
    ...(state.selectedAction ? { selectedAction: state.selectedAction } : {}),
    ...(state.outcome ? { outcome: state.outcome } : {}),
    ...(state.recommendation ? { recommendation: state.recommendation } : {}),
    ...(state.miniPlan ? { miniPlan: state.miniPlan } : {}),
    memoryExplanations: state.memoryExplanations,
    retrievedMemories: state.retrievedMemories,
    retrievalAttempted: state.retrievalAttempted,
    adaptationStatus: state.adaptationStatus,
    excludedMemoryIds: state.excludedMemoryIds,
    guidancePreferenceIds: state.guidancePreferenceIds,
    fallback: state.fallback
  };
}

function smallerActionFor(action: SituationalPivotAction): SituationalPivotAction {
  const firstStep = action.steps[0] ?? action.fallbackInstruction;
  return {
    ...action,
    id: `${action.id}-smaller`,
    title: `Try one step: ${firstStep}`.slice(0, 160),
    instruction: action.fallbackInstruction,
    goal: "Make only one small part of the selected Pivot doable.",
    steps: [firstStep],
    doneWhen: "You have tried this one smaller step, or decided to stop.",
    estimatedMinutes: 1,
    fallbackInstruction: "Stop here; no smaller action is required.",
    whyThisFits: "Shrinking the selected action keeps the next step within the person's control."
  };
}

function guideResponseForState(
  state: Extract<GooglePivotResult, { kind: "pivot-protocol" }>,
  explanation: string
): GoogleGuideResponse {
  return validatedGuideResponse({
    acknowledgment: state.phase === "selected" ? "I’ve kept that change visible." : "I’ve updated the visible Situation map.",
    explanation,
    suggestedReplies: state.phase === "clarifying"
      ? ["Answer the question", "Skip the question"]
      : ["Choose a Pivot", "Tell me what to change"]
  });
}

function guideResponseForOutput(output: GooglePivotGeneratorOutput): GoogleGuideResponse {
  return validatedGuideResponse({
    acknowledgment: output.clarificationQuestion
      ? "I’ve mapped what you shared and have one useful question."
      : "I’ve mapped what you shared and prepared bounded options.",
    explanation: output.whyThisPivot,
    suggestedReplies: output.clarificationQuestion
      ? ["Answer the question", "Skip the question"]
      : ["Choose the recommended Pivot", "Choose another option"]
  });
}

function validatedGuideResponse(value: unknown): GoogleGuideResponse {
  if (!isRecord(value) || typeof value.acknowledgment !== "string" || typeof value.explanation !== "string" || !Array.isArray(value.suggestedReplies) || value.suggestedReplies.length > 3 || !value.suggestedReplies.every((reply) => typeof reply === "string")) {
    throw new Error("Generated conversational guide response is invalid.");
  }
  for (const text of [value.acknowledgment, value.explanation, ...value.suggestedReplies]) {
    if (!text.trim() || text.length > 600) throw new Error("Generated conversational guide response text is invalid.");
    validateSafeAgentText(text);
  }
  return {
    acknowledgment: value.acknowledgment.trim(),
    explanation: value.explanation.trim(),
    suggestedReplies: value.suggestedReplies.map((reply) => reply.trim())
  };
}

function validateConversationalTurn(turn: GoogleConversationalTurn): void {
  if (!turn.id.trim() || !turn.userMessage.trim() || turn.userMessage.length > 10_000 || !Array.isArray(turn.updates)) {
    throw new Error("Conversational turn is invalid.");
  }
  validatedGuideResponse(turn.guideResponse);
  for (const update of turn.updates) {
    if (!update.id.trim() || !update.summary.trim() || update.summary.length > 600 || !isVisibleUpdateKind(update.kind) || typeof update.undoable !== "boolean") {
      throw new Error("Conversational turn update is invalid.");
    }
  }
}

function isVisibleUpdateKind(value: unknown): value is GoogleVisibleProtocolUpdate["kind"] {
  return ["situation-map", "clarification", "recommendation", "feedback", "action-shrink", "confirmation"].includes(value as string);
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
  const primary = PIVOT_LIBRARY[nextIndex];
  const alternatives = [PIVOT_LIBRARY[(nextIndex + 1) % PIVOT_LIBRARY.length], PIVOT_LIBRARY[(nextIndex + 2) % PIVOT_LIBRARY.length]];
  return {
    primary,
    primaryAction: situationalActionForPivot(primary),
    alternatives,
    alternativeActions: alternatives.map(situationalActionForPivot),
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

async function reviewImage(
  image: GoogleImageArtifactInput | undefined,
  generator: GooglePivotGenerator,
  quickDump: string
): Promise<
  | { kind: "none" }
  | { kind: "accepted"; mimeType: string; claims: string[] }
  | { kind: "rejected"; message: string }
  | { kind: "safety-interruption"; result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }
> {
  if (!image) return { kind: "none" };
  const processed = await processGoogleImageArtifact(
    image,
    generator.extractImageClaims ?? (async () => {
      throw new Error("Image extraction is unavailable.");
    })
  );
  if (processed.kind === "rejected") return processed;
  if (indicatesImmediateDanger(processed.claims.join("\n"))) {
    return {
      kind: "safety-interruption",
      result: {
        kind: "safety-interruption",
        checkIn: { quickDump },
        activity: [
          { kind: "safety-completed", message: "Safety gate completed; normal Pivot processing was interrupted." },
          { kind: "fallback", message: "Safety interruption returned app-owned urgent-support guidance." }
        ]
      }
    };
  }
  return { kind: "accepted", mimeType: processed.mimeType, claims: processed.claims };
}

async function reviewSupportingArtifacts(
  inputs: readonly GoogleSupportingArtifactInput[],
  generator: GooglePivotGenerator,
  quickDump: string,
  existingAcceptedCount: number,
  existingBytes: number,
  existingArtifactCount = existingAcceptedCount
): Promise<{
  kind: "completed";
  accepted: Array<{ artifactId: string; claims: string[] }>;
  states: GoogleArtifactProcessingState[];
  acceptedBytes: number;
  fallback: boolean;
  activity: ActivityEvent[];
} | {
  kind: "safety-interruption";
  result: Extract<GooglePivotResult, { kind: "safety-interruption" }>;
  activity: ActivityEvent[];
}> {
  if (inputs.length === 0) {
    return { kind: "completed", accepted: [], states: [], acceptedBytes: 0, fallback: false, activity: [] };
  }

  const activity: ActivityEvent[] = [];
  const inspections = inputs.map((input) => inspectGoogleSupportingArtifact(input));
  const validCandidates = inspections.flatMap((inspection, index) => inspection.kind === "accepted" ? [{ index, input: inputs[index] }] : []);
  let availableSlots = Math.max(0, MAX_GOOGLE_ARTIFACT_COUNT - existingAcceptedCount);
  let availableBytes = Math.max(0, MAX_GOOGLE_ARTIFACT_TOTAL_BYTES - existingBytes);
  const selectedCandidates: typeof validCandidates = [];
  const limitRejections = new Map<number, string>();
  for (const candidate of validCandidates) {
    if (availableSlots === 0) {
      limitRejections.set(candidate.index, "This artifact was rejected because a Situation can include at most five artifacts.");
    } else if (candidate.input.bytes.length > availableBytes) {
      limitRejections.set(candidate.index, "This artifact was rejected because the Situation's combined artifact limit is 25 MB.");
    } else {
      selectedCandidates.push(candidate);
      availableSlots -= 1;
      availableBytes -= candidate.input.bytes.length;
    }
  }

  const extractor = supportingArtifactExtractor(generator);
  const processed: GoogleSupportingArtifactProcessing[] = [];
  for (const [index, inspection] of inspections.entries()) {
    if (inspection.kind === "rejected") {
      activity.push({ kind: "artifact-review", message: `Supporting artifact ${index + 1} was inspected without retaining its filename.` });
      activity.push({ kind: "artifact-rejected", message: inspection.message });
    }
    const limitMessage = limitRejections.get(index);
    if (limitMessage) {
      activity.push({ kind: "artifact-review", message: `Supporting artifact ${index + 1} was inspected without retaining its filename.` });
      activity.push({ kind: "artifact-rejected", message: limitMessage });
    }
  }
  for (const candidate of selectedCandidates) {
    const index = candidate.index;
    const input = candidate.input;
    const artifactId = `artifact-${existingArtifactCount + index + 1}`;
    const result = await processGoogleSupportingArtifact(artifactId, input, extractor, generator.temporaryPdfStorage);
    processed.push(result);
    activity.push({ kind: "artifact-review", message: `Supporting artifact ${index + 1} was inspected without retaining its filename.` });
    if (result.kind === "rejected") {
      activity.push({ kind: "artifact-rejected", message: result.message });
      continue;
    }
    activity.push({ kind: "artifact-safety-completed", message: `Supporting artifact ${index + 1} passed the second Safety gate.` });
    if (indicatesImmediateDanger(result.claims.join("\n"))) {
      return {
        kind: "safety-interruption",
        result: {
          kind: "safety-interruption",
          checkIn: { quickDump },
          activity: [
            { kind: "safety-completed", message: "Safety gate completed; normal Pivot processing was interrupted." },
            { kind: "artifact-safety-completed", message: "The extracted artifact content triggered the app-owned Safety interruption." },
            { kind: "fallback", message: "Safety interruption returned app-owned urgent-support guidance." }
          ]
        },
        activity: [...activity, { kind: "fallback", message: "The accepted Situation map was preserved when artifact Safety interrupted processing." }]
      };
    }
  }

  const accepted = processed.flatMap((result) => result.kind === "accepted" ? [{ artifactId: result.artifactId, claims: result.claims }] : []);
  const acceptedBytes = processed.reduce((total, result) => {
    if (result.kind !== "accepted") return total;
    const candidate = selectedCandidates.find(({ index }) => `artifact-${existingArtifactCount + index + 1}` === result.artifactId);
    return total + (candidate?.input.bytes.length ?? 0);
  }, 0);
  for (const result of processed) {
    if (result.kind === "accepted") {
      activity.push({ kind: "artifact-accepted", message: `${result.artifactId} claims were added as distinct artifact claims.` });
    }
  }
  if (processed.some((result) => result.kind === "rejected") || inspections.some((inspection) => inspection.kind === "rejected") || limitRejections.size > 0) {
    activity.push({ kind: "fallback", message: "The Quick dump and valid artifact claims remain sufficient to continue." });
  }
  return {
    kind: "completed",
    accepted,
    states: inputs.map((_, index) => {
      const result = processed.find((candidate) => candidate.artifactId === `artifact-${existingArtifactCount + index + 1}`);
      if (!result) {
        const inspection = inspections[index];
        return {
          artifactId: `artifact-${existingArtifactCount + index + 1}`,
          status: "rejected" as const,
          message: inspection.kind === "rejected"
            ? inspection.message
            : limitRejections.get(index) ?? "The artifact was not processed."
        };
      }
      return result.kind === "accepted"
      ? {
          artifactId: result.artifactId,
          status: "accepted",
          mimeType: result.mimeType,
          pageCount: result.pageCount,
          claimCount: result.claims.length,
          message: "The artifact claims passed Safety and are available as artifact claims."
        }
      : { artifactId: result.artifactId, status: "rejected" as const, message: result.message };
    }),
    acceptedBytes,
    fallback: processed.some((result) => result.kind === "rejected") || inspections.some((inspection) => inspection.kind === "rejected") || limitRejections.size > 0,
    activity
  };
}

function supportingArtifactExtractor(generator: GooglePivotGenerator): GoogleSupportingArtifactExtractor {
  if (generator.extractSupportingArtifactClaims) return generator.extractSupportingArtifactClaims;
  return async (input) => {
    if (input.mimeType !== "application/pdf" && generator.extractImageClaims && input.dataUri) {
      return generator.extractImageClaims({ mimeType: input.mimeType, dataUri: input.dataUri });
    }
    throw new Error("Supporting artifact extraction is unavailable.");
  };
}

function addImageClaims(situationMap: SituationMap, claims: readonly string[]): SituationMap {
  const nextId = situationMap.artifactClaims.length + 1;
  const additions = claims.map((text, index) => ({
    id: `artifact-image-${nextId + index}`,
    text,
    provenance: "artifact" as const
  }));
  return {
    ...situationMap,
    artifactClaims: [...situationMap.artifactClaims, ...additions]
  };
}

function addArtifactClaims(
  situationMap: SituationMap,
  artifacts: readonly { artifactId: string; claims: readonly string[] }[]
): SituationMap {
  const additions = artifacts.flatMap(({ artifactId, claims }) => claims.map((text, index) => ({
    id: `artifact-claim-${artifactId}-${index + 1}`,
    text,
    provenance: "artifact" as const
  })));
  return additions.length === 0
    ? situationMap
    : { ...situationMap, artifactClaims: [...situationMap.artifactClaims, ...additions] };
}

function memorySafeSituationMap(situationMap: SituationMap): SituationMap {
  return { ...situationMap, artifactClaims: [] };
}

function removeUnapprovedArtifactClaims(situationMap: SituationMap, approvedIds: readonly string[]): SituationMap {
  return {
    ...situationMap,
    artifactClaims: situationMap.artifactClaims.filter((item) => approvedIds.includes(item.id))
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
    validateSafeAgentText(clarificationQuestion.text);
  }
  validateSafeAgentText(output.whyThisPivot);
  if (output.guideResponse !== undefined) validatedGuideResponse(output.guideResponse);

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
      if (mapItem.provenance === "guide") validateSafeAgentText(mapItem.text);
    }
  }
  if (acceptedSituationMap) {
    validateGeneratedProvenance(output.situationMap, acceptedSituationMap);
  }
}

function validatedGeneratedOutput(output: unknown, acceptedSituationMap: SituationMap): GooglePivotGeneratorOutput {
  validateGeneratorOutput(output, acceptedSituationMap);
  const primaryPivot = requirePivot(output.primaryPivotKind);
  const alternativePivots = output.alternativePivotKinds.map(requirePivot);
  if (output.alternativeActions !== undefined && output.alternativeActions.length !== alternativePivots.length) {
    throw new Error("Generated situational Pivot alternatives are invalid.");
  }
  return {
    ...output,
    situationMap: preserveAcceptedMapItems(output.situationMap, acceptedSituationMap, []),
    primaryAction: validatedSituationalAction(output.primaryAction, primaryPivot),
    alternativeActions: alternativePivots.map((pivot, index) => validatedSituationalAction(output.alternativeActions?.[index], pivot)),
    guideResponse: output.guideResponse ? validatedGuideResponse(output.guideResponse) : guideResponseForOutput(output)
  };
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
  const alternatives = [
    PIVOT_LIBRARY[(primaryIndex + 1) % PIVOT_LIBRARY.length],
    PIVOT_LIBRARY[(primaryIndex + 2) % PIVOT_LIBRARY.length]
  ];
  return {
    situationMap,
    primaryPivotKind: primary.kind,
    alternativePivotKinds: alternatives.map((pivot) => pivot.kind),
    whyThisPivot: "This curated starting point keeps the next action small and within your control.",
    primaryAction: situationalActionForPivot(primary),
    alternativeActions: alternatives.map(situationalActionForPivot)
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

function defaultPendingMemory(situationMap: SituationMap): string {
  const mapContext = [...situationMap.progress, ...situationMap.constraints]
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(" ");
  return mapContext || "The person is working through a situation and chose to save this Check-in.";
}

function defaultDerivedMemory(situationMap: SituationMap, pivot: Pivot, selectedAction: SituationalPivotAction, outcome: PivotOutcome): string {
  return `${defaultPendingMemory(situationMap)} ${selectedAction.title} was ${outcome.status}${outcome.agencyShift ? `; agency felt ${outcome.agencyShift}` : ""}.`;
}

function validateDerivedMemoryContext(context: string): string {
  if (typeof context !== "string" || !context.trim() || context.length > 500) {
    throw new Error("Derived memory context is invalid.");
  }
  if (/\b(diagnos\w*|personality|motives?|trait\w*|permanent|predict\w*|crisis|suicid\w*|hidden preference|psychological profile|medical advice)\b/i.test(context)) {
    throw new Error("Derived memory context contains disallowed content.");
  }
  return context.trim();
}

function isValidPivotOutcome(outcome: unknown): outcome is PivotOutcome {
  if (!isRecord(outcome)) return false;
  if (Object.keys(outcome).some((key) => !["status", "agencyShift", "pivotTimeSeconds"].includes(key))) return false;
  return ["completed", "partly-helpful", "not-a-fit", "skipped"].includes(outcome.status as string) &&
    (outcome.agencyShift === undefined || ["more-able", "about-as-able", "less-able"].includes(outcome.agencyShift as string));
}

function isValidPivotStepFeedback(feedback: unknown): feedback is PivotStepFeedback {
  if (!isRecord(feedback)) return false;
  if (Object.keys(feedback).some((key) => !["status", "note"].includes(key))) return false;
  return ["completed", "partly-helpful", "not-a-fit", "skipped", "blocked"].includes(feedback.status as string) &&
    (feedback.note === undefined || (typeof feedback.note === "string" && feedback.note.trim().length <= 500));
}

function validatedSituationalAction(value: unknown, pivot: Pivot): SituationalPivotAction {
  if (value === undefined) return situationalActionForPivot(pivot);
  if (!isRecord(value) || value.kind !== pivot.kind || typeof value.id !== "string" ||
      typeof value.title !== "string" || typeof value.instruction !== "string" ||
      typeof value.goal !== "string" || !Array.isArray(value.steps) ||
      value.steps.length < 1 || value.steps.length > 3 ||
      !value.steps.every((step) => typeof step === "string") ||
      typeof value.doneWhen !== "string" ||
      typeof value.estimatedMinutes !== "number" || !Number.isInteger(value.estimatedMinutes) ||
      value.estimatedMinutes < 1 || value.estimatedMinutes > 30 ||
      typeof value.fallbackInstruction !== "string" || typeof value.whyThisFits !== "string") {
    throw new Error("Generated situational Pivot action is invalid.");
  }
  if (!isConcreteActionTitle(value.title)) {
    throw new Error("Generated situational Pivot action title is too vague.");
  }
  if (!isSpecificFitRationale(value.whyThisFits)) {
    throw new Error("Generated situational Pivot fit rationale is too vague.");
  }
  for (const text of [value.title, value.instruction, value.goal, value.doneWhen, value.fallbackInstruction, value.whyThisFits]) {
    if (!text.trim() || text.length > 600) throw new Error("Generated situational Pivot action text is invalid.");
    validateSafeAgentText(text);
  }
  if (value.goal.length > 300 || value.doneWhen.length > 300 || value.whyThisFits.length > 300 ||
      value.steps.some((step) => !step.trim() || step.length > 240)) {
    throw new Error("Generated situational Pivot action detail is invalid.");
  }
  value.steps.forEach(validateSafeAgentText);
  if (value.id.trim().length > 120) throw new Error("Generated situational Pivot action identifier is invalid.");
  return {
    id: value.id.trim(),
    kind: pivot.kind,
    title: value.title.trim(),
    instruction: value.instruction.trim(),
    goal: value.goal.trim(),
    steps: value.steps.map((step) => step.trim()),
    doneWhen: value.doneWhen.trim(),
    estimatedMinutes: value.estimatedMinutes,
    fallbackInstruction: value.fallbackInstruction.trim(),
    whyThisFits: value.whyThisFits.trim()
  };
}

export function defaultSituationalActionForPivot(pivot: Pivot): SituationalPivotAction {
  const defaults: Record<PivotKind, Omit<SituationalPivotAction, "id" | "kind">> = {
    grounding: {
      title: "Name five things in this room",
      instruction: "Look around and name five things you can see.",
      goal: "Bring attention back to the room around you.",
      steps: ["Name five things you can see.", "Name four things you can feel.", "Stop after the last item; nothing else is required."],
      doneWhen: "You have named five visible things and can stop.",
      estimatedMinutes: 5,
      fallbackInstruction: "Name one thing you can see, then stop.",
      whyThisFits: "This is a small, immediate action that does not require solving the whole situation."
    },
    "breathing-focus": {
      title: "Take five slower breaths",
      instruction: "Breathe in for four counts and out for six counts five times.",
      goal: "Create a short pause before choosing what to do next.",
      steps: ["Breathe in gently for four counts.", "Breathe out for six counts.", "Repeat for five breaths, without forcing the pace."],
      doneWhen: "Five breaths are complete, or you decide to stop sooner.",
      estimatedMinutes: 5,
      fallbackInstruction: "Take one comfortable breath and return to the room.",
      whyThisFits: "A brief pause can make the next choice easier without requiring a decision yet."
    },
    "reaching-out": {
      title: "Send one check-in message",
      instruction: "Text someone you trust: ‘I am having a hard moment. Can you check in with me later?’",
      goal: "Make one specific request for human connection.",
      steps: ["Choose one person you trust.", "Send the suggested check-in message or your own short version.", "Put the phone down after sending it."],
      doneWhen: "The message is sent; you do not need to explain everything.",
      estimatedMinutes: 5,
      fallbackInstruction: "Open the message thread and type ‘Can you check in later?’ without sending it.",
      whyThisFits: "One clear request keeps reaching out small and leaves the other person room to respond."
    },
    "basic-needs-reset": {
      title: "Get water or a few bites",
      instruction: "Get a glass of water, take a few bites, or move somewhere a little more comfortable.",
      goal: "Meet one immediate physical need before tackling the situation.",
      steps: ["Choose water, a few bites, or a more comfortable place.", "Move only far enough to get that one thing.", "Stop once the basic reset is available."],
      doneWhen: "You have water, food, or a more comfortable place in reach.",
      estimatedMinutes: 5,
      fallbackInstruction: "Take one sip of water or change one uncomfortable thing around you.",
      whyThisFits: "A basic reset can remove one immediate obstacle without asking you to solve the larger problem."
    },
    "task-first-step": {
      title: "Write one task under ten minutes",
      instruction: "Write the smallest task that takes less than ten minutes, then do only that task.",
      goal: "Turn an overwhelming task into one visible action.",
      steps: ["Write the larger task at the top of a page.", "Under it, write one action that takes less than ten minutes.", "Stop after writing it or do only that action."],
      doneWhen: "One task under ten minutes is written down; completion is optional.",
      estimatedMinutes: 5,
      fallbackInstruction: "Write only the name of the larger task and stop.",
      whyThisFits: "A visible, time-bounded first step reduces the size of an ambiguous task."
    }
  };
  return { id: `${pivot.id}-situational`, kind: pivot.kind, ...defaults[pivot.kind] };
}

const situationalActionForPivot = defaultSituationalActionForPivot;

function actionForPivot(
  recommendation: NonNullable<Extract<GooglePivotResult, { kind: "pivot-protocol" }>["recommendation"]>,
  kind: PivotKind
): SituationalPivotAction {
  if (recommendation.primary.kind === kind) return recommendation.primaryAction;
  const index = recommendation.alternatives.findIndex((pivot) => pivot.kind === kind);
  return index >= 0 ? recommendation.alternativeActions[index] : situationalActionForPivot(requirePivot(kind));
}

const defaultGenerator: GooglePivotGenerator = {
  async generate({ quickDump, situationMap }) {
    return fallbackOutput(quickDump, situationMap);
  }
};

function isConcreteActionTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase().replace(/[.!?]+$/, "");
  const words = normalized.split(/\s+/);
  if (normalized.split(/\s+/).length < 2) return false;
  if (/^(make a plan|work on it|take the next step|take action|do something|do the task|deal with it|feel better|feel less stuck|focus on yourself|get unstuck(?: now)?|get started|write something|start this)$/.test(normalized)) {
    return false;
  }
  if (!/^(ask|breathe|call|check|choose|circle|close|count|draft|drink|eat|find|get|hold|identify|list|look|make|mark|move|name|open|pause|pick|place|put|read|record|reply|review|select|send|set|sit|sort|stand|start|take|text|type|use|walk|write)\b/.test(normalized)) {
    return false;
  }
  const genericWords = new Set(["a", "an", "the", "this", "that", "it", "something", "anything", "action", "task", "thing", "step", "work", "unstuck", "stuck", "better", "progress", "now", "today", "one"]);
  return words.slice(1).some((word) => !genericWords.has(word));
}

function isSpecificFitRationale(rationale: string): boolean {
  const normalized = rationale.trim().toLowerCase().replace(/[.!?]+$/, "");
  return !/^(it fits|this fits|a good fit|this is a good fit|it is a good fit|a good choice|this is helpful|it is helpful|this should help|this is a small action(?: for your situation)?|this suits the task)$/.test(normalized);
}

function isProvenance(value: unknown): value is Provenance {
  return value === "person" || value === "artifact" || value === "guide";
}

function validateSafeAgentText(text: string): void {
  if (/\b(diagnos\w*|personality|motives?|trait\w*|permanent characteristic\w*|predict\w*|crisis|suicid\w*|hidden preference|psychological profile|medical advice)\b/i.test(text)) {
    throw new Error("Generated state contains disallowed personal inference.");
  }
}

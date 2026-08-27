import {
  getPivotByKind,
  type CurrentCheckIn,
  type Pivot,
  type PivotKind,
  type PivotProtocol,
  type PivotProtocolResult
} from "../app/pivot-protocol";
import { indicatesImmediateDanger } from "../app/safety-interruption";

export type HelpfulOutcomeKind = "completed" | "partly-helpful";

export type StoredMemorySummary = {
  id: string;
  derivedContext: string;
  selectedPivotKind: PivotKind;
  selectedPivotTitle: string;
  outcomeKind: HelpfulOutcomeKind;
};

export type InspectableMemory = {
  id: string;
  checkInId: string;
  quickDump: string;
  emotionalState: number;
  derivedContext: string;
  selectedPivotKind: PivotKind | null;
  selectedPivotTitle: string | null;
  outcomeKind: string | null;
  forgottenAt: string | null;
};

export type PendingCheckIn = {
  checkInId: string;
  memoryId: string;
};

export type DerivedMemoryDraft = {
  derivedContext: string;
};

export type ModelRecommendation = {
  primaryPivotKind: string;
  alternativePivotKinds: string[];
  whyThisPivot: string;
  memoryId?: string;
};

export type PivotModel = {
  deriveMemory: (input: { checkIn: CurrentCheckIn }) => Promise<DerivedMemoryDraft>;
  recommend: (input: {
    checkIn: CurrentCheckIn;
    currentDerivedContext: string;
    retrievedMemories: readonly StoredMemorySummary[];
    retrieveSimilarMemories: () => Promise<readonly StoredMemorySummary[]>;
  }) => Promise<ModelRecommendation>;
  updateDerivedMemory: (input: {
    currentDerivedContext: string;
    selectedPivot: Pivot;
    outcomeKind: string;
  }) => Promise<DerivedMemoryDraft>;
};

export type MemoryRepository = {
  ensureAccount: (subject: string) => Promise<string>;
  createPendingCheckIn: (input: {
    accountId: string;
    checkIn: CurrentCheckIn;
    derivedContext: string;
    embedding: readonly number[];
  }) => Promise<PendingCheckIn>;
  retrieveSimilarMemories: (input: {
    accountId: string;
    queryEmbedding: readonly number[];
    limit: number;
    threshold: number;
  }) => Promise<readonly StoredMemorySummary[]>;
  recordOutcome: (input: {
    accountId: string;
    checkInId: string;
    selectedPivotKind: PivotKind;
    outcomeKind: string;
    updatedEmotionalState?: number;
    pivotTimeSeconds?: number;
  }) => Promise<
    | { kind: "saved"; currentDerivedContext: string }
    | { kind: "already-saved"; currentDerivedContext: string }
    | { kind: "conflict" } 
  >;
  enrichDerivedMemory: (input: {
    accountId: string;
    checkInId: string;
    derivedContext: string;
    embedding: readonly number[];
  }) => Promise<void>;
  listMemories: (accountId: string) => Promise<readonly InspectableMemory[]>;
  deleteMemory: (input: { accountId: string; memoryId: string }) => Promise<boolean>;
  forgetMemory: (input: { accountId: string; memoryId: string }) => Promise<boolean>;
};

export type PivotProtocolServiceInput = {
  subject: string;
  requestId?: string;
  checkIn: CurrentCheckIn;
  consentGiven: boolean;
  saveRequested: boolean;
};

export type PivotProtocolServiceDependencies = {
  repository: MemoryRepository;
  model: PivotModel;
  embed: (text: string) => Promise<readonly number[]>;
  embeddingDimensions?: number;
  retrievalLimit?: number;
  retrievalThreshold?: number;
  logger?: PivotLogger;
};

export type PivotLogger = {
  event: (name: string, fields: Record<string, string | number | boolean | undefined>) => void;
};

export type RecordPivotOutcomeInput = {
  subject: string;
  requestId?: string;
  checkInId: string;
  selectedPivotKind: string;
  outcomeKind: string;
  updatedEmotionalState?: number;
  pivotTimeSeconds?: number;
};

export type RecordPivotOutcomeDependencies = {
  repository: MemoryRepository;
  model: PivotModel;
  embed: (text: string) => Promise<readonly number[]>;
  embeddingDimensions?: number;
  logger?: PivotLogger;
};

export type RecordPivotOutcomeResult =
  | { kind: "saved"; idempotent: boolean; enrichment: "saved" | "unavailable" | "already-saved" }
  | { kind: "conflict" };

export async function runPivotProtocolService(
  input: PivotProtocolServiceInput,
  dependencies: PivotProtocolServiceDependencies
): Promise<PivotProtocolResult | { kind: "consent-required" }> {
  log(dependencies.logger, "pivot-request", input.requestId, {
    saveRequested: input.saveRequested
  });

  if (indicatesImmediateDanger(input.checkIn.quickDump)) {
    log(dependencies.logger, "safety-interruption", input.requestId, {});
    return {
      kind: "safety-interruption",
      checkIn: input.checkIn,
      savedCheckIn: { privateEntry: false, derivedMemory: false }
    };
  }

  if (!input.consentGiven) {
    log(dependencies.logger, "consent-required", input.requestId, {});
    return { kind: "consent-required" };
  }

  let currentDerivedContext: string;
  let currentEmbedding: readonly number[];

  try {
    const draft = await dependencies.model.deriveMemory({ checkIn: input.checkIn });
    currentDerivedContext = validateDerivedContext(draft.derivedContext);
    currentEmbedding = validateEmbedding(
      await dependencies.embed(currentDerivedContext),
      dependencies.embeddingDimensions ?? 1024
    );
  } catch {
    log(dependencies.logger, "platform-fallback", input.requestId, {
      stage: "memory-preparation"
    });
    return fallbackResult(input.checkIn, "unavailable", "not-saved");
  }

  log(dependencies.logger, "memory-prepared", input.requestId, {});

  let accountId: string;
  try {
    accountId = await dependencies.repository.ensureAccount(input.subject);
  } catch {
    log(dependencies.logger, "platform-fallback", input.requestId, {
      stage: "account-bootstrap"
    });
    return fallbackResult(
      input.checkIn,
      "unavailable",
      input.saveRequested ? "unavailable" : "not-saved"
    );
  }

  let pendingCheckIn: PendingCheckIn | undefined;
  if (input.saveRequested) {
    try {
      pendingCheckIn = await dependencies.repository.createPendingCheckIn({
        accountId,
        checkIn: input.checkIn,
        derivedContext: currentDerivedContext,
        embedding: currentEmbedding
      });
    } catch {
      log(dependencies.logger, "platform-fallback", input.requestId, {
        stage: "pending-persistence"
      });
      return fallbackResult(input.checkIn, "unavailable", "unavailable");
    }
    log(dependencies.logger, "pending-persisted", input.requestId, {});
  }

  let retrievalStatus: "influenced" | "no-match" | "unavailable" = "no-match";
  let retrievedMemories: readonly StoredMemorySummary[] = [];
  let retrievalPromise: Promise<readonly StoredMemorySummary[]> | undefined;
  const retrieveSimilarMemories = () => {
    retrievalPromise ??= dependencies.repository
      .retrieveSimilarMemories({
        accountId,
        queryEmbedding: currentEmbedding,
        limit: dependencies.retrievalLimit ?? 3,
        threshold: dependencies.retrievalThreshold ?? 0.5
      })
      .then((memories) => {
        retrievedMemories = memories;
        retrievalStatus = memories.length > 0 ? "influenced" : "no-match";
        log(dependencies.logger, "memory-retrieved", input.requestId, {
          count: memories.length,
          status: retrievalStatus
        });
        return memories;
      })
      .catch(() => {
        retrievalStatus = "unavailable";
        log(dependencies.logger, "platform-fallback", input.requestId, {
          stage: "memory-retrieval"
        });
        throw new Error("Memory retrieval unavailable");
      });

    return retrievalPromise;
  };

  try {
    await retrieveSimilarMemories();
  } catch {
    log(dependencies.logger, "platform-fallback", input.requestId, {
      stage: "recommendation"
    });
    return fallbackResult(
      input.checkIn,
      "unavailable",
      input.saveRequested ? "saved" : "not-saved",
      pendingCheckIn?.checkInId
    );
  }

  try {
    const recommendation = await dependencies.model.recommend({
      checkIn: input.checkIn,
      currentDerivedContext,
      retrievedMemories,
      retrieveSimilarMemories
    });
    const protocol = buildValidatedProtocol(
      input.checkIn,
      recommendation,
      retrievedMemories
    );

    return {
      ...protocol,
      pendingCheckInId: pendingCheckIn?.checkInId,
      pendingMemoryId: pendingCheckIn?.memoryId,
      persistence: input.saveRequested ? "saved" : "not-saved",
      memoryStatus: retrievalStatus
    };
  } catch {
    const fallback = buildMemoryAwareFallback(input.checkIn, retrievedMemories);
    return {
      ...fallback,
      pendingCheckInId: pendingCheckIn?.checkInId,
      pendingMemoryId: pendingCheckIn?.memoryId,
      persistence: input.saveRequested ? "saved" : "not-saved",
      memoryStatus: retrievalStatus
    };
  }
}

export async function recordPivotOutcome(
  input: RecordPivotOutcomeInput,
  dependencies: RecordPivotOutcomeDependencies
): Promise<RecordPivotOutcomeResult> {
  log(dependencies.logger, "outcome-request", input.requestId, {});
  const selectedPivot = getPivotByKind(input.selectedPivotKind);
  if (!selectedPivot || !isOutcomeKind(input.outcomeKind)) {
    throw new Error("Invalid Pivot outcome");
  }

  const updatedEmotionalState = normalizeEmotionalState(input.updatedEmotionalState);
  const pivotTimeSeconds = normalizePivotTimeSeconds(input.pivotTimeSeconds);
  const accountId = await dependencies.repository.ensureAccount(input.subject);
  const stored = await dependencies.repository.recordOutcome({
    accountId,
    checkInId: input.checkInId,
    selectedPivotKind: selectedPivot.kind,
    outcomeKind: input.outcomeKind,
    updatedEmotionalState,
    pivotTimeSeconds
  });

  if (stored.kind === "conflict") {
    log(dependencies.logger, "outcome-conflict", input.requestId, {});
    return { kind: "conflict" };
  }

  if (stored.kind === "already-saved") {
    log(dependencies.logger, "outcome-idempotent", input.requestId, {});
    return { kind: "saved", idempotent: true, enrichment: "already-saved" };
  }

  try {
    const refreshed = await dependencies.model.updateDerivedMemory({
      currentDerivedContext: stored.currentDerivedContext,
      selectedPivot,
      outcomeKind: input.outcomeKind
    });
    const derivedContext = validateDerivedContext(refreshed.derivedContext);
    const embedding = validateEmbedding(
      await dependencies.embed(derivedContext),
      dependencies.embeddingDimensions ?? 1024
    );
    await dependencies.repository.enrichDerivedMemory({
      accountId,
      checkInId: input.checkInId,
      derivedContext,
      embedding
    });
    log(dependencies.logger, "outcome-enriched", input.requestId, {});
    return { kind: "saved", idempotent: false, enrichment: "saved" };
  } catch {
    log(dependencies.logger, "platform-fallback", input.requestId, {
      stage: "outcome-enrichment"
    });
    return { kind: "saved", idempotent: false, enrichment: "unavailable" };
  }
}

function buildValidatedProtocol(
  checkIn: CurrentCheckIn,
  recommendation: ModelRecommendation,
  retrievedMemories: readonly StoredMemorySummary[]
): PivotProtocol {
  const primary = requirePivot(recommendation.primaryPivotKind);
  const alternatives = recommendation.alternativePivotKinds.map(requirePivot);

  if (
    alternatives.length > 2 ||
    new Set([primary.kind, ...alternatives.map((pivot) => pivot.kind)]).size !==
      alternatives.length + 1
  ) {
    throw new Error("Invalid Pivot alternatives");
  }

  const whyThisPivot = validateWhy(recommendation.whyThisPivot);
  const memory = recommendation.memoryId
    ? retrievedMemories.find((candidate) => candidate.id === recommendation.memoryId)
    : undefined;

  if (recommendation.memoryId && !memory) {
    throw new Error("Recommendation referenced an unavailable memory");
  }

  return protocolFromParts({
    checkIn,
    primary,
    alternatives,
    whyThisPivot: memory
      ? memoryExplanationText(memory)
      : whyThisPivot,
    memory
  });
}

function buildMemoryAwareFallback(
  checkIn: CurrentCheckIn,
  retrievedMemories: readonly StoredMemorySummary[]
): PivotProtocol {
  const memory = retrievedMemories[0];
  if (!memory) {
    return fallbackResult(checkIn, "no-match", "not-saved");
  }

  const primary = requirePivot(memory.selectedPivotKind);
  const alternatives = [
    requirePivot("grounding"),
    requirePivot("reaching-out")
  ].filter((pivot) => pivot.kind !== primary.kind);

  return protocolFromParts({
    checkIn,
    primary,
    alternatives: alternatives.slice(0, 2),
    whyThisPivot: memoryExplanationText(memory),
    memory
  });
}

function fallbackResult(
  checkIn: CurrentCheckIn,
  memoryStatus: "no-match" | "unavailable",
  persistence: "saved" | "not-saved" | "unavailable",
  pendingCheckInId?: string
): PivotProtocol {
  const primary = requirePivot("task-first-step");
  const alternatives = [requirePivot("grounding"), requirePivot("reaching-out")];

  return {
    kind: "pivot-protocol",
    checkIn,
    recommendation: {
      primary,
      alternatives,
      whyThisPivot:
        "Start with one small, concrete action that gives this moment a little more shape.",
      source: "curated-fallback"
    },
    savedCheckIn: { privateEntry: false, derivedMemory: false },
    pendingCheckInId,
    persistence,
    memoryStatus
  };
}

function protocolFromParts({
  checkIn,
  primary,
  alternatives,
  whyThisPivot,
  memory
}: {
  checkIn: CurrentCheckIn;
  primary: Pivot;
  alternatives: Pivot[];
  whyThisPivot: string;
  memory?: StoredMemorySummary;
}): PivotProtocol {
  return {
    kind: "pivot-protocol",
    checkIn,
    recommendation: {
      primary,
      alternatives,
      whyThisPivot,
      source: memory ? "personalized-memory" : "curated-fallback",
      ...(memory
        ? {
            memoryExplanation: {
              memoryId: memory.id,
              pivotTitle: memory.selectedPivotTitle,
              outcome: memory.outcomeKind,
              text: memoryExplanationText(memory)
            }
          }
        : {})
    },
    savedCheckIn: { privateEntry: false, derivedMemory: false }
  };
}

function memoryExplanationText(memory: StoredMemorySummary): string {
  const outcome = memory.outcomeKind === "completed" ? "completed" : "partly helpful";
  return `A similar saved Check-in was followed by “${memory.selectedPivotTitle},” which you marked ${outcome}.`;
}

function requirePivot(kind: string): Pivot {
  const pivot = getPivotByKind(kind);
  if (!pivot) {
    throw new Error("Model returned an unsupported Pivot kind");
  }

  return pivot;
}

function validateWhy(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 280 ||
    /\b(?:diagnos(?:e|is|ed)?|therap(?:y|ist)|personality|crisis prediction|predict(?:s|ed)? a crisis)\b/i.test(
      normalized
    )
  ) {
    throw new Error("Model returned an invalid explanation");
  }

  return normalized;
}

function validateDerivedContext(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 500 ||
    /\b(?:diagnos(?:e|is|ed)?|therap(?:y|ist)|personality|crisis prediction|predict(?:s|ed)? a crisis)\b/i.test(
      normalized
    )
  ) {
    throw new Error("Model returned an invalid Derived memory");
  }

  return normalized;
}

function validateEmbedding(
  embedding: readonly number[],
  expectedDimensions: number
): readonly number[] {
  if (
    embedding.length !== expectedDimensions ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Embedding has an unexpected shape");
  }

  return embedding;
}

function isOutcomeKind(value: string): value is "completed" | "partly-helpful" | "not-a-fit" | "skipped" {
  return ["completed", "partly-helpful", "not-a-fit", "skipped"].includes(value);
}

function normalizeEmotionalState(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Emotional state must be an integer from 1 to 5");
  }

  return value;
}

function normalizePivotTimeSeconds(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Pivot time must be a non-negative number");
  }

  return Math.round(value);
}

function log(
  logger: PivotLogger | undefined,
  name: string,
  requestId: string | undefined,
  fields: Record<string, string | number | boolean | undefined>
): void {
  logger?.event(name, { requestId, ...fields });
}

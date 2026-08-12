import type { CurrentCheckIn, EmotionalState } from "./pivot-protocol";
import { runPivotProtocol } from "./pivot-protocol";
import type { PivotProtocolResult } from "./pivot-protocol";
import type { SavedCheckIn, PivotOutcomeKind } from "./check-in-memory";

export type Embedding = readonly number[];

export type EmbeddingProvider = {
  embed: (text: string) => Embedding;
};

type HelpfulSavedCheckIn = Omit<SavedCheckIn, "pivotOutcome"> & {
  pivotOutcome: Omit<SavedCheckIn["pivotOutcome"], "kind"> & {
    kind: "completed" | "partly-helpful";
  };
};

export type RetrievedMemory = HelpfulSavedCheckIn & {
  similarity: number;
};

export type SemanticRetrieval =
  | { kind: "match"; memory: RetrievedMemory; checkIn: CurrentCheckIn }
  | { kind: "no-match" }
  | { kind: "unavailable" };

export type PersonalizedPivotResult =
  | PivotProtocolResult
  | { kind: "consent-required" };

type Concept = {
  terms: readonly string[];
};

const CONCEPTS: readonly Concept[] = [
  {
    terms: [
      "task",
      "project",
      "work",
      "assignment",
      "deadline",
      "deliverable",
      "start",
      "starting",
      "started",
      "begin",
      "beginning",
      "avoid",
      "avoiding",
      "stuck",
      "get going",
      "next step"
    ]
  },
  {
    terms: [
      "overwhelmed",
      "overloaded",
      "racing",
      "panic",
      "anxious",
      "too much",
      "hard moment"
    ]
  },
  {
    terms: ["alone", "lonely", "friend", "talk", "text", "help", "support"]
  },
  {
    terms: ["hungry", "thirsty", "tired", "sleep", "food", "cold", "hot", "water"]
  },
  {
    terms: ["breathe", "breath", "breathing", "settle", "calm", "focus"]
  },
  {
    terms: ["ground", "grounding", "present", "notice", "around"]
  }
];

export const deterministicEmbeddingProvider: EmbeddingProvider = {
  embed: createEmbedding
};

export function runPersonalizedPivotProtocol({
  accountId,
  checkIn,
  consentGiven,
  memories,
  forgottenMemoryIds = [],
  embeddingProvider = deterministicEmbeddingProvider
}: {
  accountId: string;
  checkIn: CurrentCheckIn;
  consentGiven: boolean;
  memories: readonly SavedCheckIn[];
  forgottenMemoryIds?: readonly string[];
  embeddingProvider?: EmbeddingProvider;
}): PersonalizedPivotResult {
  const safetyResult = runPivotProtocol(checkIn);
  if (safetyResult.kind === "safety-interruption") {
    return safetyResult;
  }

  if (!consentGiven) {
    return { kind: "consent-required" };
  }

  const retrieval = retrieveSimilarMemory({
    accountId,
    checkIn,
    memories,
    forgottenMemoryIds,
    embeddingProvider
  });

  return runPivotProtocol(
    checkIn,
    0,
    retrieval.kind === "match" ? retrieval.memory : undefined
  );
}

export function createEmbedding(text: string): Embedding {
  const normalizedText = text.toLowerCase();
  const values = CONCEPTS.map(({ terms }) =>
    terms.reduce(
      (count, term) => count + (matchesTerm(normalizedText, term) ? 1 : 0),
      0
    )
  );
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return values;
  }

  return values.map((value) => value / magnitude);
}

export function retrieveSimilarMemory({
  accountId,
  checkIn,
  memories,
  forgottenMemoryIds = [],
  embeddingProvider = deterministicEmbeddingProvider
}: {
  accountId: string;
  checkIn: CurrentCheckIn;
  memories: readonly SavedCheckIn[];
  forgottenMemoryIds?: readonly string[];
  embeddingProvider?: EmbeddingProvider;
}): SemanticRetrieval {
  const ownerMemories = memories.filter(
    (memory): memory is HelpfulSavedCheckIn =>
      memory.accountId === accountId &&
      !forgottenMemoryIds.includes(memory.id) &&
      isHelpfulOutcome(memory.pivotOutcome.kind)
  );

  if (ownerMemories.length === 0) {
    return { kind: "no-match" };
  }

  try {
    const queryEmbedding = embeddingProvider.embed(checkIn.quickDump);
    const candidates = ownerMemories
      .map((memory) => {
        const embedding = memory.derivedMemory.embedding;
        if (!embedding || embedding.length !== queryEmbedding.length) {
          return undefined;
        }

        return {
          memory,
          similarity: cosineSimilarity(queryEmbedding, embedding)
        };
      })
      .filter(
        (candidate): candidate is { memory: HelpfulSavedCheckIn; similarity: number } =>
          candidate !== undefined && Number.isFinite(candidate.similarity)
      )
      .sort((left, right) => right.similarity - left.similarity);

    const best = candidates[0];
    if (!best || best.similarity < 0.5) {
      return { kind: "no-match" };
    }

    return {
      kind: "match",
      checkIn,
      memory: { ...best.memory, similarity: best.similarity }
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export function cosineSimilarity(left: Embedding, right: Embedding): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function matchesTerm(text: string, term: string): boolean {
  if (term.includes(" ")) {
    return text.includes(term);
  }

  return new RegExp(`\\b${term}\\b`).test(text);
}

function isHelpfulOutcome(outcome: PivotOutcomeKind): boolean {
  return outcome === "completed" || outcome === "partly-helpful";
}

export function derivedMemoryText({
  quickDump,
  emotionalState,
  selectedPivotKind,
  outcome
}: {
  quickDump: string;
  emotionalState: EmotionalState;
  selectedPivotKind: string;
  outcome: PivotOutcomeKind;
}): string {
  return `${quickDump} emotional state ${emotionalState} pivot ${selectedPivotKind} outcome ${outcome}`;
}

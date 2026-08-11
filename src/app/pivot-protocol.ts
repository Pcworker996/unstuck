import type { RetrievedMemory } from "./semantic-retrieval";
import { indicatesImmediateDanger } from "./safety-interruption";

export type EmotionalState = 1 | 2 | 3 | 4 | 5;

export type CurrentCheckIn = {
  quickDump: string;
  emotionalState: EmotionalState;
};

export type PivotKind =
  | "grounding"
  | "breathing-focus"
  | "reaching-out"
  | "basic-needs-reset"
  | "task-first-step";

export type Pivot = {
  id: string;
  kind: PivotKind;
  title: string;
  instruction: string;
};

export type PivotProtocol = {
  kind: "pivot-protocol";
  checkIn: CurrentCheckIn;
  recommendation: {
    primary: Pivot;
    alternatives: Pivot[];
    whyThisPivot: string;
    source: "curated-fallback" | "personalized-memory";
    memoryExplanation?: {
      memoryId: string;
      pivotTitle: string;
      outcome: "completed" | "partly-helpful";
    };
  };
  savedCheckIn: {
    privateEntry: false;
    derivedMemory: false;
  };
};

export type SafetyInterruption = {
  kind: "safety-interruption";
  checkIn: CurrentCheckIn;
  savedCheckIn: {
    privateEntry: false;
    derivedMemory: false;
  };
};

export type PivotProtocolResult = PivotProtocol | SafetyInterruption;

const PIVOT_LIBRARY: readonly Pivot[] = [
  {
    id: "grounding-five-things",
    kind: "grounding",
    title: "Notice five things around you",
    instruction: "Name five things you can see, four you can feel, and three you can hear."
  },
  {
    id: "breathing-four-six",
    kind: "breathing-focus",
    title: "Take five slower breaths",
    instruction: "Breathe in for four counts and out for six. Repeat five times without forcing it."
  },
  {
    id: "reaching-out-small-message",
    kind: "reaching-out",
    title: "Send one honest message",
    instruction: "Text someone you trust: “I am having a hard moment. Can you check in with me later?”"
  },
  {
    id: "basic-needs-water",
    kind: "basic-needs-reset",
    title: "Make one basic reset",
    instruction: "Get a glass of water, take a few bites, or move somewhere a little more comfortable."
  },
  {
    id: "task-first-visible-step",
    kind: "task-first-step",
    title: "Make the next step visible",
    instruction: "Write the smallest action that takes less than ten minutes, then do only that action."
  }
];

function preferredPivotIndex(quickDump: string, emotionalState: EmotionalState): number {
  const text = quickDump.toLowerCase();

  if (/(task|project|deadline|work|start|decision|stuck)/.test(text)) {
    return 4;
  }

  if (/(alone|lonely|friend|talk|text|help|support)/.test(text)) {
    return 2;
  }

  if (/(hungry|thirsty|tired|sleep|food|cold|hot|comfortable)/.test(text)) {
    return 3;
  }

  if (/(racing|panic|anxious|breathe|breath|overwhelmed|too much)/.test(text)) {
    return 1;
  }

  return emotionalState >= 4 ? 0 : 4;
}

function explanationFor(pivot: Pivot): string {
  switch (pivot.kind) {
    case "grounding":
      return "This gives your attention one small, present-moment place to land.";
    case "breathing-focus":
      return "This creates a short pause before you decide what needs to happen next.";
    case "reaching-out":
      return "A small, direct connection can make this moment less solitary.";
    case "basic-needs-reset":
      return "A basic reset can make the next choice a little easier to reach.";
    case "task-first-step":
      return "A visible first step can make an unclear task feel possible to begin.";
  }
}

export function runPivotProtocol(
  checkIn: CurrentCheckIn,
  regenerationOffset = 0,
  retrievedMemory?: RetrievedMemory
): PivotProtocolResult {
  if (indicatesImmediateDanger(checkIn.quickDump)) {
    return {
      kind: "safety-interruption",
      checkIn,
      savedCheckIn: {
        privateEntry: false,
        derivedMemory: false
      }
    };
  }

  const personalizedIndex = retrievedMemory
    ? PIVOT_LIBRARY.findIndex((pivot) => pivot.kind === retrievedMemory.selectedPivot.kind)
    : -1;
  const preferredIndex =
    personalizedIndex >= 0
      ? personalizedIndex
      : preferredPivotIndex(checkIn.quickDump, checkIn.emotionalState);
  const primaryIndex =
    (preferredIndex + regenerationOffset) % PIVOT_LIBRARY.length;
  const primary = PIVOT_LIBRARY[primaryIndex];
  const alternatives = [
    PIVOT_LIBRARY[(primaryIndex + 1) % PIVOT_LIBRARY.length],
    PIVOT_LIBRARY[(primaryIndex + 2) % PIVOT_LIBRARY.length]
  ];

  return {
    kind: "pivot-protocol",
    checkIn,
    recommendation: {
      primary,
      alternatives: [...alternatives],
      whyThisPivot: retrievedMemory
        ? `A similar prior Check-in was followed by “${retrievedMemory.selectedPivot.title},” which you marked ${outcomeLabel(retrievedMemory.pivotOutcome.kind)}.`
        : explanationFor(primary),
      source: retrievedMemory ? "personalized-memory" : "curated-fallback",
      ...(retrievedMemory
        ? {
            memoryExplanation: {
              memoryId: retrievedMemory.id,
              pivotTitle: retrievedMemory.selectedPivot.title,
              outcome: retrievedMemory.pivotOutcome.kind
            }
          }
        : {})
    },
    savedCheckIn: {
      privateEntry: false,
      derivedMemory: false
    }
  };
}

function outcomeLabel(outcome: "completed" | "partly-helpful"): string {
  return outcome === "completed" ? "completed" : "partly helpful";
}

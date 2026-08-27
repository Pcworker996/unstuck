import { indicatesImmediateDanger } from "./safety-interruption";
import { PIVOT_LIBRARY, type Pivot, type PivotKind } from "./pivot-protocol";

export type Provenance = "person" | "guide";

export type SituationMapItem = {
  id: string;
  text: string;
  provenance: Provenance;
};

export type SituationMap = {
  shared: SituationMapItem[];
  interpretations: SituationMapItem[];
  uncertainties: SituationMapItem[];
  constraints: SituationMapItem[];
  progress: SituationMapItem[];
};

export type ActivityEvent = {
  kind:
    | "safety-completed"
    | "consent-verified"
    | "map-created"
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
};

export type GooglePivotGenerator = {
  generate: (input: { quickDump: string; situationMap: SituationMap }) => Promise<unknown>;
  repair?: (input: {
    quickDump: string;
    situationMap: SituationMap;
    invalidOutput: unknown;
  }) => Promise<unknown>;
};

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
      recommendation: {
        primary: Pivot;
        alternatives: Pivot[];
        whyThisPivot: string;
      };
      activity: ActivityEvent[];
      fallback: boolean;
    };

export async function runGooglePivotProtocol(
  input: { quickDump: string; consentGiven: boolean },
  generator: GooglePivotGenerator = defaultGenerator
): Promise<GooglePivotResult> {
  const quickDump = input.quickDump.trim();
  if (indicatesImmediateDanger(quickDump)) {
    return {
      kind: "safety-interruption",
      checkIn: { quickDump },
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
    validateGeneratorOutput(generatedOutput);
    output = generatedOutput;
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
        validateGeneratorOutput(repairedOutput);
        output = repairedOutput;
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

  return {
    kind: "pivot-protocol",
    checkIn: { quickDump },
    situationMap: output.situationMap,
    recommendation: {
      primary: requirePivot(output.primaryPivotKind),
      alternatives: output.alternativePivotKinds.map(requirePivot),
      whyThisPivot: output.whyThisPivot
    },
    activity,
    fallback
  };
}

function createSituationMap(quickDump: string): SituationMap {
  const shared = createSituationMapItem("shared-1", quickDump, "person");
  return {
    shared: [shared],
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
    constraints: [],
    progress: [createSituationMapItem("progress-1", "Make one part of this situation clearer or more doable.", "person")]
  };
}

function createSituationMapItem(id: string, text: string, provenance: Provenance): SituationMapItem {
  return { id, text, provenance };
}

function validateGeneratorOutput(
  output: unknown
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
}

function isSituationMap(value: unknown): value is SituationMap {
  if (!isRecord(value)) return false;
  return (
    sectionHasProvenance(value.shared, "person") &&
    sectionHasProvenance(value.interpretations, "guide") &&
    sectionHasProvenance(value.uncertainties, "guide") &&
    sectionHasKnownProvenance(value.constraints) &&
    sectionHasProvenance(value.progress, "person")
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
  const pivot = PIVOT_LIBRARY.find((candidate) => candidate.kind === kind);
  if (!pivot) {
    throw new Error("Generated Pivot is outside the bounded library.");
  }
  return pivot;
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
  return value === "person" || value === "guide";
}

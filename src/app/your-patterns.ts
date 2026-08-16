import type { PivotKind } from "./pivot-protocol";
import { inspectSavedCheckIns, type SavedCheckIn } from "./check-in-memory";

export type HelpfulPivotPattern = {
  pivotId: string;
  pivotKind: PivotKind;
  pivotTitle: string;
  helpfulOutcomeCount: number;
  typicalPivotTimeSeconds?: number;
  memoryIds: string[];
};

export type YourPatterns = {
  helpfulPivots: HelpfulPivotPattern[];
  recurringContexts: SelfReportedContextPattern[];
};

export type SelfReportedContextPattern = {
  label: string;
  checkInCount: number;
  memoryIds: string[];
};

const SELF_REPORTED_CONTEXTS = [
  {
    label: "work or task",
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
      "next step"
    ]
  },
  {
    label: "feeling overloaded",
    terms: ["overwhelmed", "overloaded", "racing", "panic", "anxious", "too much"]
  },
  {
    label: "connection or support",
    terms: ["alone", "lonely", "friend", "talk", "text", "help", "support"]
  },
  {
    label: "basic needs",
    terms: ["hungry", "thirsty", "tired", "sleep", "food", "cold", "hot", "water"]
  },
  {
    label: "settling or focus",
    terms: [
      "breathe",
      "breath",
      "breathing",
      "settle",
      "calm",
      "focus",
      "ground",
      "grounding",
      "present",
      "notice",
      "around"
    ]
  }
] as const;

export function deriveYourPatterns({
  accountId,
  records,
  forgottenMemoryIds = []
}: {
  accountId: string;
  records: readonly SavedCheckIn[];
  forgottenMemoryIds?: readonly string[];
}): YourPatterns {
  const retainedRecords = inspectSavedCheckIns(accountId, records).filter(
    (record) => !forgottenMemoryIds.includes(record.id)
  );
  const helpfulRecords = retainedRecords.filter((record) => isHelpful(record));
  const groupedPivots = new Map<string, SavedCheckIn[]>();

  for (const record of helpfulRecords) {
    const existing = groupedPivots.get(record.selectedPivot.id) ?? [];
    groupedPivots.set(record.selectedPivot.id, [...existing, record]);
  }

  const groupedContexts = new Map<string, string[]>();
  for (const record of retainedRecords) {
    const selfReportedText = [
      record.privateEntry.quickDump,
      record.selectedPivot.kind,
      record.selectedPivot.title,
      record.pivotOutcome.kind
    ].join(" ");

    for (const context of SELF_REPORTED_CONTEXTS) {
      if (context.terms.some((term) => matchesTerm(selfReportedText, term))) {
        const existing = groupedContexts.get(context.label) ?? [];
        groupedContexts.set(context.label, [...existing, record.id]);
      }
    }
  }

  return {
    helpfulPivots: [...groupedPivots.values()]
      .map((pivotRecords) => {
        const firstRecord = pivotRecords[0];
        return {
          pivotId: firstRecord.selectedPivot.id,
          pivotKind: firstRecord.selectedPivot.kind,
          pivotTitle: firstRecord.selectedPivot.title,
          helpfulOutcomeCount: pivotRecords.length,
          typicalPivotTimeSeconds: median(
            pivotRecords
              .map((record) => record.derivedMemory.pivotTimeSeconds)
              .filter((seconds): seconds is number => seconds !== undefined)
          ),
          memoryIds: pivotRecords.map((record) => record.id)
        };
      })
      .sort((left, right) => right.helpfulOutcomeCount - left.helpfulOutcomeCount),
    recurringContexts: [...groupedContexts.entries()]
      .map(([label, memoryIds]) => ({
        label,
        checkInCount: memoryIds.length,
        memoryIds
      }))
      .filter((context) => context.checkInCount > 1)
      .sort((left, right) => right.checkInCount - left.checkInCount)
  };
}

function isHelpful(record: SavedCheckIn): boolean {
  return (
    record.pivotOutcome.kind === "completed" ||
    record.pivotOutcome.kind === "partly-helpful"
  );
}

function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function matchesTerm(text: string, term: string): boolean {
  const normalizedText = text.toLowerCase();
  if (term.includes(" ")) {
    return normalizedText.includes(term);
  }

  return new RegExp(`\\b${term}\\b`).test(normalizedText);
}

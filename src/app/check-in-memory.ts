import type { CurrentCheckIn, Pivot, PivotKind, EmotionalState } from "./pivot-protocol";

export type PivotOutcomeKind =
  | "completed"
  | "partly-helpful"
  | "not-a-fit"
  | "skipped";

export type PivotOutcome = {
  kind: PivotOutcomeKind;
  updatedEmotionalState?: EmotionalState;
};

export type SavedCheckIn = {
  id: string;
  accountId: string;
  privateEntry: CurrentCheckIn;
  derivedMemory: {
    emotionalState: EmotionalState;
    selectedPivotKind: PivotKind;
    outcome: PivotOutcomeKind;
    updatedEmotionalState?: EmotionalState;
  };
  selectedPivot: Pivot;
  pivotOutcome: PivotOutcome;
};

export type CompleteCheckInInput = {
  accountId: string;
  checkInId: string;
  checkIn: CurrentCheckIn;
  selectedPivot: Pivot;
  outcome: PivotOutcome;
  saveCheckIn: boolean;
};

export type CheckInCompletion = {
  outcome: PivotOutcome;
  savedCheckIn?: SavedCheckIn;
};

export function completeCheckIn({
  accountId,
  checkInId,
  checkIn,
  selectedPivot,
  outcome,
  saveCheckIn
}: CompleteCheckInInput): CheckInCompletion {
  if (!saveCheckIn) {
    return { outcome };
  }

  return {
    outcome,
    savedCheckIn: {
      id: checkInId,
      accountId,
      privateEntry: checkIn,
      derivedMemory: {
        emotionalState: checkIn.emotionalState,
        selectedPivotKind: selectedPivot.kind,
        outcome: outcome.kind,
        updatedEmotionalState: outcome.updatedEmotionalState
      },
      selectedPivot,
      pivotOutcome: outcome
    }
  };
}

const savedCheckInsStoragePrefix = "unstuck:saved-check-ins:";

export function loadSavedCheckIns(accountId: string): SavedCheckIn[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(savedCheckInsStorageKey(accountId));
    if (!stored) {
      return [];
    }

    const records = JSON.parse(stored) as unknown;
    if (!Array.isArray(records)) {
      return [];
    }

    return records.filter(
      (record): record is SavedCheckIn =>
        typeof record === "object" &&
        record !== null &&
        "accountId" in record &&
        record.accountId === accountId
    );
  } catch {
    return [];
  }
}

export function persistSavedCheckIns(
  accountId: string,
  records: readonly SavedCheckIn[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      savedCheckInsStorageKey(accountId),
      JSON.stringify(records)
    );
  } catch {
    // A storage failure should not interrupt the one-off Pivot flow.
  }
}

function savedCheckInsStorageKey(accountId: string): string {
  return `${savedCheckInsStoragePrefix}${encodeURIComponent(accountId)}`;
}

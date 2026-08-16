import type { CurrentCheckIn, Pivot, PivotKind, EmotionalState } from "./pivot-protocol";
import { createEmbedding, derivedMemoryText } from "./semantic-retrieval";

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
    pivotTimeSeconds?: number;
    embedding: readonly number[];
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
  pivotTimeSeconds?: number;
  saveCheckIn: boolean;
};

export type CheckInCompletion = {
  outcome: PivotOutcome;
  savedCheckIn?: SavedCheckIn;
};

export function inspectSavedCheckIns(
  accountId: string,
  records: readonly SavedCheckIn[]
): SavedCheckIn[] {
  return records.filter((record) => record.accountId === accountId);
}

export function deleteSavedCheckIn(
  records: readonly SavedCheckIn[],
  accountId: string,
  checkInId: string
): SavedCheckIn[] {
  return records.filter(
    (record) => record.accountId !== accountId || record.id !== checkInId
  );
}

export function forgetPattern({
  accountId,
  checkInId,
  records,
  forgottenMemoryIds
}: {
  accountId: string;
  checkInId: string;
  records: readonly SavedCheckIn[];
  forgottenMemoryIds: readonly string[];
}): string[] {
  const belongsToAccount = records.some(
    (record) => record.accountId === accountId && record.id === checkInId
  );

  if (!belongsToAccount) {
    return [...forgottenMemoryIds];
  }

  return [...new Set([...forgottenMemoryIds, checkInId])];
}

export function completeCheckIn({
  accountId,
  checkInId,
  checkIn,
  selectedPivot,
  outcome,
  pivotTimeSeconds,
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
        updatedEmotionalState: outcome.updatedEmotionalState,
        ...(pivotTimeSeconds === undefined
          ? {}
          : { pivotTimeSeconds: normalizePivotTimeSeconds(pivotTimeSeconds) }),
        embedding: createEmbedding(
          derivedMemoryText({
            quickDump: checkIn.quickDump,
            emotionalState: checkIn.emotionalState,
            selectedPivotKind: selectedPivot.kind,
            outcome: outcome.kind
          })
        )
      },
      selectedPivot,
      pivotOutcome: outcome
    }
  };
}

function normalizePivotTimeSeconds(pivotTimeSeconds: number): number {
  if (!Number.isFinite(pivotTimeSeconds)) {
    return 0;
  }

  return Math.max(0, Math.round(pivotTimeSeconds));
}

const savedCheckInsStoragePrefix = "unstuck:saved-check-ins:";
const forgottenMemoryIdsStoragePrefix = "unstuck:forgotten-memory-ids:";

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

export function loadForgottenMemoryIds(accountId: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(forgottenMemoryIdsStorageKey(accountId));
    if (!stored) {
      return [];
    }

    const records = JSON.parse(stored) as unknown;
    return Array.isArray(records)
      ? records.filter((record): record is string => typeof record === "string")
      : [];
  } catch {
    return [];
  }
}

export function persistForgottenMemoryIds(
  accountId: string,
  memoryIds: readonly string[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      forgottenMemoryIdsStorageKey(accountId),
      JSON.stringify([...new Set(memoryIds)])
    );
  } catch {
    // A storage failure should not interrupt the one-off Pivot flow.
  }
}

function savedCheckInsStorageKey(accountId: string): string {
  return `${savedCheckInsStoragePrefix}${encodeURIComponent(accountId)}`;
}

function forgottenMemoryIdsStorageKey(accountId: string): string {
  return `${forgottenMemoryIdsStoragePrefix}${encodeURIComponent(accountId)}`;
}

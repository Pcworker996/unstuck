"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { runPivotProtocol } from "./pivot-protocol";
import type {
  CurrentCheckIn,
  EmotionalState,
  Pivot,
  PivotProtocol,
  PivotProtocolResult
} from "./pivot-protocol";
import {
  completeCheckIn,
  loadSavedCheckIns,
  persistSavedCheckIns,
  type CheckInCompletion,
  type PivotOutcome,
  type PivotOutcomeKind,
  type SavedCheckIn
} from "./check-in-memory";
import type { PersonalAccount } from "./private-home-state";

const EMOTIONAL_STATE_RATINGS: readonly EmotionalState[] = [1, 2, 3, 4, 5];
const OUTCOME_OPTIONS: readonly { kind: PivotOutcomeKind; label: string }[] = [
  { kind: "completed", label: "Completed" },
  { kind: "partly-helpful", label: "Partly helpful" },
  { kind: "not-a-fit", label: "Not a fit" },
  { kind: "skipped", label: "Skipped" }
];

type PrivateHomeProps = {
  person: PersonalAccount;
  onSignOut: () => void;
};

export function PrivateHome({ person, onSignOut }: PrivateHomeProps) {
  const [quickDump, setQuickDump] = useState("");
  const [emotionalState, setEmotionalState] = useState<EmotionalState>(3);
  const [protocol, setProtocol] = useState<PivotProtocolResult>();
  const [regenerationOffset, setRegenerationOffset] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [saveCheckIn, setSaveCheckIn] = useState(false);
  const [flowState, setFlowState] = useState<
    "check-in" | "outcome" | "completed" | "dismissed"
  >("check-in");
  const [chosenPivot, setChosenPivot] = useState<Pivot>();
  const [completion, setCompletion] = useState<CheckInCompletion>();
  const [savedCheckIns, setSavedCheckIns] = useState<SavedCheckIn[]>(() =>
    loadSavedCheckIns(person.id)
  );

  useEffect(() => {
    persistSavedCheckIns(person.id, savedCheckIns);
  }, [person.id, savedCheckIns]);

  function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checkIn: CurrentCheckIn = {
      quickDump: quickDump.trim(),
      emotionalState
    };

    if (!checkIn.quickDump) {
      return;
    }

    const nextProtocol = runPivotProtocol(checkIn);
    if (nextProtocol.kind !== "safety-interruption" && !consentGiven) {
      return;
    }

    setProtocol(nextProtocol);
    setRegenerationOffset(0);
    setFlowState("check-in");
  }

  function regeneratePivot() {
    if (!protocol || protocol.kind !== "pivot-protocol") {
      return;
    }

    const nextOffset = regenerationOffset + 1;
    setProtocol(runPivotProtocol(protocol.checkIn, nextOffset));
    setRegenerationOffset(nextOffset);
  }

  function choosePivot(pivot: Pivot) {
    setChosenPivot(pivot);
    setFlowState("outcome");
  }

  function submitOutcome(outcome: PivotOutcome) {
    if (!protocol || protocol.kind !== "pivot-protocol" || !chosenPivot) {
      return;
    }

    const result = completeCheckIn({
      accountId: person.id,
      checkInId: createCheckInId(),
      checkIn: protocol.checkIn,
      selectedPivot: chosenPivot,
      outcome,
      saveCheckIn
    });

    const savedCheckIn = result.savedCheckIn;
    if (savedCheckIn) {
      setSavedCheckIns((current) => [...current, savedCheckIn]);
    }

    setCompletion(result);
    setFlowState("completed");
  }

  function startAnotherCheckIn() {
    setQuickDump("");
    setEmotionalState(3);
    setProtocol(undefined);
    setRegenerationOffset(0);
    setChosenPivot(undefined);
    setCompletion(undefined);
    setConsentGiven(false);
    setSaveCheckIn(false);
    setFlowState("check-in");
  }

  function deleteSavedCheckIn(checkInId: string) {
    setSavedCheckIns((current) => current.filter((record) => record.id !== checkInId));
  }

  return (
    <main className="private-home">
      <header className="private-home__header">
        <a className="wordmark" href="/" aria-label="Unstuck home">
          unstuck
        </a>
        <button className="quiet-button" onClick={onSignOut} type="button">
          Sign out
        </button>
      </header>

      <section aria-labelledby="welcome-heading" className="private-home__welcome">
        <p className="eyebrow">Your private space</p>
        <h1 id="welcome-heading">Welcome, {person.displayName}.</h1>
        <p>
          Your next check-in will start here. Nothing is saved or shared until you
          choose it.
        </p>
      </section>

      {flowState === "check-in" && !protocol ? (
        <section aria-labelledby="check-in-heading" className="check-in-card">
          <p className="eyebrow">A small starting point</p>
          <h2 id="check-in-heading">What is making this moment hard?</h2>
          <p className="check-in-card__description">
            Write the thought, task, or situation in your own words. This Check-in
            will only be retained if you consent and leave the save control enabled.
          </p>
          <form onSubmit={submitCheckIn}>
            <label htmlFor="quick-dump">Quick dump</label>
            <textarea
              id="quick-dump"
              onChange={(event) => setQuickDump(event.target.value)}
              placeholder="I keep circling around…"
              required
              rows={5}
              value={quickDump}
            />
            <fieldset>
              <legend>How intense is this moment?</legend>
              <div className="rating-options">
                {EMOTIONAL_STATE_RATINGS.map((rating) => (
                  <label key={rating}>
                    <input
                      checked={emotionalState === rating}
                      name="emotional-state"
                      onChange={() => setEmotionalState(rating)}
                      type="radio"
                      value={rating}
                    />
                    <span>{rating}</span>
                  </label>
                ))}
              </div>
              <div className="rating-legend" aria-hidden="true">
                <span>lighter</span>
                <span>more intense</span>
              </div>
            </fieldset>
            <div className="memory-controls">
              <label className="choice-control">
                <input
                  checked={consentGiven}
                  onChange={(event) => {
                    const nextConsent = event.target.checked;
                    setConsentGiven(nextConsent);
                    setSaveCheckIn(nextConsent);
                  }}
                  required
                  type="checkbox"
                />
                <span>
                  <strong>I consent to have this Private entry processed.</strong>
                  <small>
                    Unstuck is non-clinical and uses this Check-in only for this Pivot flow.
                  </small>
                </span>
              </label>
              <label className="choice-control">
                <input
                  checked={saveCheckIn}
                  disabled={!consentGiven}
                  onChange={(event) => setSaveCheckIn(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Save this Check-in to my private history.</strong>
                  <small>You can process it without saving by turning this off.</small>
                </span>
              </label>
            </div>
            <button type="submit">Suggest a Pivot</button>
          </form>
        </section>
      ) : null}

      {flowState === "check-in" && protocol?.kind === "safety-interruption" ? (
        <SafetyInterruptionNotice />
      ) : null}

      {flowState === "check-in" && protocol?.kind === "pivot-protocol" ? (
        <PivotRecommendation
          onChoose={choosePivot}
          onDismiss={() => setFlowState("dismissed")}
          onRegenerate={regeneratePivot}
          protocol={protocol}
          saveCheckIn={saveCheckIn}
        />
      ) : null}

      {flowState === "outcome" && chosenPivot ? (
        <PivotOutcomeForm
          onSubmit={submitOutcome}
          pivot={chosenPivot}
          saveCheckIn={saveCheckIn}
        />
      ) : null}

      {flowState === "completed" && completion ? (
        <CompletionNotice completion={completion} onStartAnother={startAnotherCheckIn} />
      ) : null}

      {flowState === "dismissed" ? (
        <section aria-labelledby="dismissed-heading" className="pivot-result">
          <p className="eyebrow">No problem</p>
          <h2 id="dismissed-heading">You do not have to choose a Pivot right now.</h2>
          <p>The Check-in is gone, and nothing was saved.</p>
          <button onClick={startAnotherCheckIn} type="button">
            Start another Check-in
          </button>
        </section>
      ) : null}

      {savedCheckIns.length > 0 ? (
        <SavedHistory onDelete={deleteSavedCheckIn} records={savedCheckIns} />
      ) : null}
    </main>
  );
}

function createCheckInId() {
  return globalThis.crypto?.randomUUID?.() ?? `check-in-${Date.now()}`;
}

function SafetyInterruptionNotice() {
  return (
    <section aria-labelledby="safety-heading" className="pivot-result safety-interruption">
      <p className="eyebrow">Pause here</p>
      <h2 id="safety-heading">Please move toward urgent human support now.</h2>
      <p>
        Unstuck cannot help with immediate danger. Call your local emergency number,
        go to an emergency department, or contact someone you trust and ask them to
        stay with you.
      </p>
      <a
        className="safety-link"
        href="sms:?body=I%20need%20support%20right%20now.%20Can%20you%20stay%20with%20me%3F"
      >
        Text someone I trust
      </a>
      <p className="privacy-note">This Check-in was not saved.</p>
    </section>
  );
}

function PivotRecommendation({
  onChoose,
  onDismiss,
  onRegenerate,
  protocol,
  saveCheckIn
}: {
  onChoose: (pivot: Pivot) => void;
  onDismiss: () => void;
  onRegenerate: () => void;
  protocol: PivotProtocol;
  saveCheckIn: boolean;
}) {
  const { primary, alternatives, whyThisPivot } = protocol.recommendation;

  return (
    <section aria-labelledby="pivot-heading" className="pivot-card">
      <p className="eyebrow">A possible next step</p>
      <h2 id="pivot-heading">{primary.title}</h2>
      <p>{primary.instruction}</p>
      <p className="pivot-explanation">{whyThisPivot}</p>
      <button onClick={() => onChoose(primary)} type="button">
        Choose this Pivot
      </button>

      <div className="alternatives">
        <h3>Other options</h3>
        {alternatives.map((pivot) => (
          <button key={pivot.id} onClick={() => onChoose(pivot)} type="button">
            {pivot.title}
          </button>
        ))}
      </div>

      <div className="pivot-actions">
        <button className="text-button" onClick={onRegenerate} type="button">
          Regenerate
        </button>
        <button className="text-button" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
      <p className="privacy-note">
        {saveCheckIn
          ? "This Check-in will be saved after you record its outcome."
          : "This Check-in will be processed once and not saved."}
      </p>
    </section>
  );
}

function PivotOutcomeForm({
  onSubmit,
  pivot,
  saveCheckIn
}: {
  onSubmit: (outcome: PivotOutcome) => void;
  pivot: Pivot;
  saveCheckIn: boolean;
}) {
  const [outcomeKind, setOutcomeKind] = useState<PivotOutcomeKind>();
  const [updatedEmotionalState, setUpdatedEmotionalState] = useState<EmotionalState>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!outcomeKind) {
      return;
    }

    onSubmit({ kind: outcomeKind, updatedEmotionalState });
  }

  return (
    <section aria-labelledby="outcome-heading" className="pivot-result">
      <p className="eyebrow">After your Pivot</p>
      <h2 id="outcome-heading">How did “{pivot.title}” go?</h2>
      <p>{pivot.instruction}</p>
      <form className="outcome-form" onSubmit={submit}>
        <fieldset>
          <legend>Record the outcome</legend>
          <div className="outcome-options">
            {OUTCOME_OPTIONS.map((option) => (
              <label className="choice-control" key={option.kind}>
                <input
                  checked={outcomeKind === option.kind}
                  name="pivot-outcome"
                  onChange={() => setOutcomeKind(option.kind)}
                  required
                  type="radio"
                  value={option.kind}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Update your emotional-state rating? <span className="optional">Optional</span>
          </legend>
          <div className="rating-options rating-options--outcome">
            <label>
              <input
                checked={updatedEmotionalState === undefined}
                name="updated-emotional-state"
                onChange={() => setUpdatedEmotionalState(undefined)}
                type="radio"
              />
              <span>—</span>
            </label>
            {EMOTIONAL_STATE_RATINGS.map((rating) => (
              <label key={rating}>
                <input
                  checked={updatedEmotionalState === rating}
                  name="updated-emotional-state"
                  onChange={() => setUpdatedEmotionalState(rating)}
                  type="radio"
                  value={rating}
                />
                <span>{rating}</span>
              </label>
            ))}
          </div>
          <div className="rating-legend" aria-hidden="true">
            <span>no update</span>
            <span>more intense</span>
          </div>
        </fieldset>
        <button type="submit">Save outcome</button>
      </form>
      <p className="privacy-note">
        {saveCheckIn
          ? "Your Private entry and Derived memory will be added to your private history."
          : "This one-off Check-in and its outcome will not be saved."}
      </p>
    </section>
  );
}

function CompletionNotice({
  completion,
  onStartAnother
}: {
  completion: CheckInCompletion;
  onStartAnother: () => void;
}) {
  const wasSaved = Boolean(completion.savedCheckIn);

  return (
    <section aria-labelledby="completion-heading" className="pivot-result">
      <p className="eyebrow">Check-in complete</p>
      <h2 id="completion-heading">
        {wasSaved ? "Saved to your private history." : "Your one-off Check-in is complete."}
      </h2>
      <p>
        {wasSaved
          ? "The Private entry, Derived memory, selected Pivot, and Pivot outcome belong to your Personal account."
          : "Your outcome was recorded for this moment only. Nothing from this Check-in was saved."}
      </p>
      <p className="privacy-note">Outcome: {outcomeLabel(completion.outcome.kind)}.</p>
      <button onClick={onStartAnother} type="button">
        Start another Check-in
      </button>
    </section>
  );
}

function SavedHistory({
  onDelete,
  records
}: {
  onDelete: (checkInId: string) => void;
  records: readonly SavedCheckIn[];
}) {
  return (
    <section aria-labelledby="history-heading" className="history-card">
      <p className="eyebrow">Private history</p>
      <h2 id="history-heading">Saved Check-ins</h2>
      <ul>
        {records.map((record) => (
          <li key={record.id}>
            <p>{record.privateEntry.quickDump}</p>
            <span>
              {record.selectedPivot.title} · {outcomeLabel(record.pivotOutcome.kind)}
            </span>
            <details>
              <summary>View Derived memory</summary>
              <p>Pivot type: {record.derivedMemory.selectedPivotKind}</p>
              <p>Check-in rating: {record.derivedMemory.emotionalState}</p>
              <p>Outcome: {outcomeLabel(record.derivedMemory.outcome)}</p>
              {record.derivedMemory.updatedEmotionalState ? (
                <p>Updated rating: {record.derivedMemory.updatedEmotionalState}</p>
              ) : null}
            </details>
            <button
              className="text-button history-delete"
              onClick={() => onDelete(record.id)}
              type="button"
            >
              Delete this Check-in
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function outcomeLabel(kind: PivotOutcomeKind) {
  return OUTCOME_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

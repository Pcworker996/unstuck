"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { runPivotProtocol } from "./pivot-protocol";
import type {
  CurrentCheckIn,
  EmotionalState,
  Pivot,
  PivotProtocol,
  PivotProtocolResult
} from "./pivot-protocol";
import type { PersonalAccount } from "./private-home-state";

const EMOTIONAL_STATE_RATINGS: readonly EmotionalState[] = [1, 2, 3, 4, 5];

type PrivateHomeProps = {
  person: PersonalAccount;
  onSignOut: () => void;
};

export function PrivateHome({ person, onSignOut }: PrivateHomeProps) {
  const [quickDump, setQuickDump] = useState("");
  const [emotionalState, setEmotionalState] = useState<EmotionalState>(3);
  const [protocol, setProtocol] = useState<PivotProtocolResult>();
  const [regenerationOffset, setRegenerationOffset] = useState(0);
  const [flowState, setFlowState] = useState<"check-in" | "chosen" | "dismissed">(
    "check-in"
  );
  const [chosenPivot, setChosenPivot] = useState<Pivot>();

  function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checkIn: CurrentCheckIn = {
      quickDump: quickDump.trim(),
      emotionalState
    };

    if (!checkIn.quickDump) {
      return;
    }

    setProtocol(runPivotProtocol(checkIn));
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
    setFlowState("chosen");
  }

  function startAnotherCheckIn() {
    setQuickDump("");
    setEmotionalState(3);
    setProtocol(undefined);
    setRegenerationOffset(0);
    setChosenPivot(undefined);
    setFlowState("check-in");
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
            is not saved in this slice.
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
        />
      ) : null}

      {flowState === "chosen" && chosenPivot ? (
        <section aria-labelledby="chosen-pivot-heading" className="pivot-result">
          <p className="eyebrow">Your choice</p>
          <h2 id="chosen-pivot-heading">{chosenPivot.title}</h2>
          <p>{chosenPivot.instruction}</p>
          <p className="privacy-note">Nothing from this Check-in is saved.</p>
          <button onClick={startAnotherCheckIn} type="button">
            Start another Check-in
          </button>
        </section>
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
    </main>
  );
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
  protocol
}: {
  onChoose: (pivot: Pivot) => void;
  onDismiss: () => void;
  onRegenerate: () => void;
  protocol: PivotProtocol;
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
      <p className="privacy-note">This Check-in is not saved.</p>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { getFirebaseGoogleAuthClient } from "../lib/firebase-google-auth";
import { googleImageBytesToBase64 } from "./google-image-artifact";
import type { GoogleConversationalTurn, GooglePendingConfirmation, GooglePivotResult, PivotStepFeedback, SituationMap } from "./google-pivot-protocol";

type Person = {
  id: string;
  displayName: string;
};

type Protocol = {
  id: string;
  version: number;
  createdAt: string;
  pivotState?: GooglePivotResult;
};

export function GoogleHome() {
  const [person, setPerson] = useState<Person>();
  const [protocol, setProtocol] = useState<Protocol>();
  const [pivotResult, setPivotResult] = useState<GooglePivotResult>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [startingNewCheckIn, setStartingNewCheckIn] = useState(false);

  useEffect(() => {
    getFirebaseGoogleAuthClient()
      .currentPerson()
      .then(setPerson)
      .catch(() => setMessage("Google sign-in is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!person) {
      return;
    }

    let active = true;
    loadWorkspace(person)
      .then((nextProtocol) => {
        if (active) {
          setProtocol(nextProtocol);
          if (nextProtocol.pivotState) {
            setPivotResult(nextProtocol.pivotState);
          }
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Your private workspace is unavailable.");
        }
      });

    return () => {
      active = false;
    };
  }, [person]);

  async function signIn() {
    setLoading(true);
    setMessage(undefined);
    try {
      setPerson(await getFirebaseGoogleAuthClient().signIn());
    } catch {
      setMessage("Google sign-in could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await getFirebaseGoogleAuthClient().signOut();
    setProtocol(undefined);
    setPerson(undefined);
  }

  async function discardProtocol() {
    if (!person || !protocol) return;
    if (!window.confirm("Discard this Check-in and its temporary conversation?")) return;
    try {
      await deleteGoogleHistory(protocol.id);
      await replaceWithNewProtocol("The incomplete Check-in was discarded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The incomplete Check-in could not be discarded.");
    }
  }

  async function startNewCheckIn() {
    if (!person || startingNewCheckIn) return;
    setStartingNewCheckIn(true);
    try {
      await replaceWithNewProtocol("A new Check-in is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A new Check-in could not be started.");
    } finally {
      setStartingNewCheckIn(false);
    }
  }

  async function replaceWithNewProtocol(statusMessage: string) {
    if (!person) return;
    setProtocol(await createProtocolForPerson(person));
    setPivotResult(undefined);
    setMessage(statusMessage);
  }

  if (loading && !person) {
    return <main className="loading-screen">Loading your private workspace…</main>;
  }

  if (!person) {
    return (
      <main className="auth-screen">
        <section aria-labelledby="google-auth-heading" className="auth-card">
          <a className="wordmark" href="/">unstuck</a>
          <p className="eyebrow">Private, user-initiated support</p>
          <h1 id="google-auth-heading">A small place to begin again.</h1>
          <p className="auth-card__boundary">
            Unstuck is non-clinical and is not a substitute for professional or emergency care.
          </p>
          {message ? <p aria-live="polite" className="form-message">{message}</p> : null}
          <button onClick={signIn} type="button">Sign in with Google</button>
        </section>
      </main>
    );
  }

  return (
    <main className="private-home">
      <header className="private-home__header">
        <a className="wordmark" href="/" aria-label="Unstuck home">unstuck</a>
        <button className="quiet-button" onClick={signOut} type="button">Sign out</button>
      </header>
      <section aria-labelledby="workspace-heading" className="private-home__welcome">
        <p className="eyebrow">Your private workspace</p>
        <h1 id="workspace-heading">Welcome, {person.displayName}.</h1>
        {protocol ? (
          <p aria-live="polite">Your private workspace is ready.</p>
        ) : (
          <p aria-live="polite">Preparing your private workspace…</p>
        )}
        {message ? <p aria-live="polite" className="form-message">{message}</p> : null}
      </section>
      {protocol ? (
        <GooglePivotWorkspace
          key={protocol.id}
          protocolId={protocol.id}
          protocolVersion={protocol.version}
          result={pivotResult}
          onDiscard={discardProtocol}
          onNewCheckIn={startNewCheckIn}
          startingNewCheckIn={startingNewCheckIn}
          onResult={(next) => {
            setPivotResult(next);
            if (next.kind === "pivot-protocol" && next.persistence === "saved") {
              setHistoryRefresh((value) => value + 1);
            }
          }}
        />
      ) : null}
      <GoogleSavedHistory refreshKey={historyRefresh} />
      <GoogleGuidancePreferences />
    </main>
  );
}

function GooglePivotWorkspace({
  protocolId,
  protocolVersion,
  result,
  onResult,
  onDiscard,
  onNewCheckIn,
  startingNewCheckIn
}: {
  protocolId: string;
  protocolVersion: number;
  result: GooglePivotResult | undefined;
  onResult: (result: GooglePivotResult) => void;
  onDiscard: () => Promise<void>;
  onNewCheckIn: () => Promise<void>;
  startingNewCheckIn: boolean;
}) {
  const [quickDump, setQuickDump] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const [artifactFiles, setArtifactFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const startIdempotencyKey = useRef<string | undefined>(undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await googleApiRequest<GooglePivotResult>("/api/google/pivot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolId,
          expectedVersion: result?.kind === "pivot-protocol" ? result.version : protocolVersion,
          idempotencyKey: startIdempotencyKey.current ?? (startIdempotencyKey.current = crypto.randomUUID()),
          type: "start",
          quickDump,
          consentGiven,
          saveRequested,
          ...(artifactFiles.length ? { artifacts: await Promise.all(artifactFiles.map(artifactPayload)) } : {})
        })
      });
      onResult(next);
      if (next.kind === "pivot-protocol" || next.kind === "safety-interruption") {
        startIdempotencyKey.current = undefined;
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Pivot Protocol is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="google-pivot-workspace" aria-label="Pivot Protocol">
      {!result || result.kind === "consent-required" ? (
        <form onSubmit={submit} className="check-in-card">
          <p className="eyebrow">Start with a Quick dump</p>
          <h2>What is making this moment hard?</h2>
          <p className="check-in-card__description">
            Write the situation in your own words. Supporting artifacts are optional and not needed.
          </p>
          <label htmlFor="google-quick-dump">Quick dump</label>
          <textarea
            id="google-quick-dump"
            value={quickDump}
            onChange={(event) => setQuickDump(event.target.value)}
            required
            rows={5}
            placeholder="I keep circling around…"
          />
          <label htmlFor="google-artifacts">Optional supporting artifacts</label>
          <input
            id="google-artifacts"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={(event) => setArtifactFiles(Array.from(event.target.files ?? []))}
          />
          <p className="privacy-note">Only add artifacts if useful: up to five JPEG, PNG, WebP, or PDF files, 10 MB each and 25 MB total. PDFs are temporary and deleted after review.</p>
          <label className="choice-control">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(event) => setConsentGiven(event.target.checked)}
            />
            <span>
              <strong>I consent to have this Private entry processed.</strong>
              <small>This is user-initiated, non-clinical support.</small>
            </span>
          </label>
          <label className="choice-control">
            <input
              type="checkbox"
              checked={saveRequested}
              onChange={(event) => setSaveRequested(event.target.checked)}
            />
            <span>
              <strong>Save and approve this Check-in after I record an outcome.</strong>
              <small>This keeps the Private entry, Situation map, selected Pivot, outcome, and a compact Derived memory for you to inspect or delete.</small>
            </span>
          </label>
          {result?.kind === "consent-required" ? (
            <p className="form-error" role="alert">Please confirm processing consent to continue.</p>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button disabled={submitting} type="submit">
            {submitting ? "Preparing…" : "Create Situation map"}
          </button>
        </form>
      ) : null}
      {result?.kind === "safety-interruption" ? <GoogleSafetyResult result={result} /> : null}
      {result?.kind === "pivot-protocol" ? (
        <GooglePivotResultView protocolId={protocolId} result={result} onResult={onResult} onDiscard={onDiscard} onNewCheckIn={onNewCheckIn} startingNewCheckIn={startingNewCheckIn} />
      ) : null}
    </section>
  );
}

function GoogleSafetyResult({ result }: { result: Extract<GooglePivotResult, { kind: "safety-interruption" }> }) {
  return (
    <section className="pivot-result safety-interruption" role="alert">
      <p className="eyebrow">Pause here</p>
      <h2>Please move toward urgent human support now.</h2>
      <p>
        Unstuck cannot help with immediate danger. Call your local emergency number, go to an emergency
        department, or contact someone you trust and ask them to stay with you.
      </p>
      <p className="privacy-note">This Quick dump was not saved or sent for normal generation.</p>
      {result.priorState ? <PriorSituationMap state={result.priorState} /> : null}
      <ActivityTrace events={result.activity} />
    </section>
  );
}

function PriorSituationMap({ state }: { state: Extract<GooglePivotResult, { kind: "pivot-protocol" }> }) {
  return (
    <details className="situation-map" open>
      <summary><p className="eyebrow">Prior Situation map preserved</p></summary>
      {Object.entries(state.situationMap).map(([section, items]) => (
        <section className="situation-map__section" key={section}>
          <h3>{section}</h3>
          {items.length === 0 ? <p className="privacy-note">Nothing identified yet.</p> : items.map((item) => <p key={item.id}><strong>{item.provenance}:</strong> {item.text}</p>)}
        </section>
      ))}
    </details>
  );
}

function GooglePivotResultView({
  protocolId,
  result,
  onResult,
  onDiscard,
  onNewCheckIn,
  startingNewCheckIn
}: {
  protocolId: string;
  result: Extract<GooglePivotResult, { kind: "pivot-protocol" }>;
  onResult: (result: GooglePivotResult) => void;
  onDiscard: () => Promise<void>;
  onNewCheckIn: () => Promise<void>;
  startingNewCheckIn: boolean;
}) {
  const [situationMap, setSituationMap] = useState(result.situationMap);
  const [error, setError] = useState<string>();
  const [savingItem, setSavingItem] = useState<string>();
  const commandKeys = useRef(new Map<string, string>());

  useEffect(() => setSituationMap(result.situationMap), [result.situationMap]);

  const recommendation = result.recommendation;
  const mapEditable = result.phase === "clarifying" || result.phase === "recommended";

  async function command(body: Record<string, unknown>) {
    setError(undefined);
    const signature = JSON.stringify(body);
    const idempotencyKey = commandKeys.current.get(signature) ?? crypto.randomUUID();
    commandKeys.current.set(signature, idempotencyKey);
    try {
      const endpoint = body.type === "record-outcome" ? "/api/google/pivot/outcome" : "/api/google/pivot";
      const next = await googleApiRequest<GooglePivotResult>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolId,
          expectedVersion: result.version,
          idempotencyKey,
          ...body
        })
      });
      onResult(next);
      commandKeys.current.delete(signature);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Pivot Protocol is unavailable.");
    }
  }

  function updateMapItem(section: keyof SituationMap, id: string, text: string) {
    setSituationMap((current) => ({
      ...current,
      [section]: current[section].map((item) => item.id === id ? { ...item, text } : item)
    }));
  }

  async function saveMapItem(section: keyof SituationMap, id: string) {
    const item = situationMap[section].find((candidate) => candidate.id === id);
    if (!item) return;
    setSavingItem(id);
    try {
      await command({ type: "correct-map", section, itemId: id, text: item.text });
    } finally {
      setSavingItem(undefined);
    }
  }

  return (
    <>
      <ConversationTimeline turns={result.conversation} undoableUpdates={result.undoableUpdates} onUndo={(updateId) => void command({ type: "undo-update", updateId })} />
      {result.phase !== "outcome" && result.phase !== "dismissed" ? <ConversationComposer onSubmit={(message) => void command({ type: "add-context", message })} /> : null}
      {result.artifacts?.length ? (
        <section className="history-card" aria-label="Supporting artifact processing">
          <p className="eyebrow">Supporting artifacts</p>
          {result.artifacts.map((artifact) => (
            <p key={artifact.artifactId}>
              <strong>{artifact.artifactId}:</strong> {artifact.status === "accepted" ? "accepted" : "rejected"}. {artifact.message}
            </p>
          ))}
        </section>
      ) : null}
      {mapEditable && (result.artifacts?.filter((artifact) => artifact.status === "accepted").length ?? 0) < 5 ? <OptionalArtifactUpload onAdd={(artifacts) => void command({ type: "add-artifacts", artifacts })} /> : null}
      <details className="situation-map" open={result.phase === "clarifying"}>
        <summary>
          <p className="eyebrow">Situation map</p>
          <h2 id="situation-map-heading">What we have so far</h2>
        </summary>
        <SituationMapSection editable={mapEditable} section="shared" title="You shared" items={situationMap.shared} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="artifactClaims" title="Artifact claims" items={situationMap.artifactClaims} approvedItemIds={result.approvedArtifactClaimIds} onChange={updateMapItem} onSave={saveMapItem} onApprove={(itemId) => void command({ type: "approve-artifact-claim", itemId })} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="interpretations" title="Guide interpretation" items={situationMap.interpretations} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="uncertainties" title="Uncertainties" items={situationMap.uncertainties} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="contradictions" title="Contradictions to resolve" items={situationMap.contradictions} onChange={updateMapItem} onSave={saveMapItem} onResolve={(itemId) => void command({ type: "resolve-contradiction", itemId })} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="constraints" title="Constraints" items={situationMap.constraints} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="progress" title="Immediate progress" items={situationMap.progress} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="pivotHistory" title="Pivot history" items={situationMap.pivotHistory} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="priorPatterns" title="Relevant prior patterns" items={situationMap.priorPatterns} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
      </details>
      {result.phase === "clarifying" && result.clarification ? (
        <section className="pivot-card" aria-labelledby="clarification-heading">
          <p className="eyebrow">One useful question</p>
          <h2 id="clarification-heading">{result.clarification.question.text}</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const answer = new FormData(form).get("answer");
            if (typeof answer === "string") void command({
              type: "answer-clarification",
              questionId: result.clarification?.question.id,
              answer
            });
            form.reset();
          }}>
            <label htmlFor="clarification-answer">Your answer</label>
            <textarea id="clarification-answer" name="answer" rows={3} />
            <div className="button-row">
              <button type="submit">Answer</button>
              <button className="quiet-button" onClick={() => void command({
                type: "skip-clarification",
                questionId: result.clarification?.question.id
              })} type="button">Skip</button>
            </div>
          </form>
          <p className="privacy-note">Question {result.clarification.answers.length + 1} of 2. You can continue without answering.</p>
        </section>
      ) : null}
      {result.memoryExplanations?.length ? (
        <section className="history-card" aria-label="Memory explanations">
          <p className="eyebrow">Why this was adapted</p>
          {result.memoryExplanations.map((memory) => (
            <p key={memory.memoryId}>
              {memory.text} <a href={`#saved-check-in-${encodeURIComponent(memory.protocolId)}`}>Inspect saved Check-in</a> <button className="text-button" onClick={() => {
                if (window.confirm("Exclude this memory from this recommendation?")) void command({ type: "exclude-memory", memoryId: memory.memoryId });
              }} type="button">Exclude before regenerating</button>
              <button className="text-button" onClick={() => void command({ type: "forget-memory", memoryId: memory.memoryId })} type="button">Forget</button>
              <button className="text-button" onClick={() => void command({ type: "delete-memory", memoryId: memory.memoryId })} type="button">Delete memory</button>
            </p>
          ))}
        </section>
      ) : null}
      {result.pendingConfirmation && result.phase !== "selected" ? (
        <ConfirmationControls confirmation={result.pendingConfirmation} onConfirm={(confirmationId) => void command({ type: "confirm-action", confirmationId })} onCancel={(confirmationId) => void command({ type: "cancel-confirmation", confirmationId })} />
      ) : null}
      {result.phase !== "clarifying" && result.phase !== "dismissed" && recommendation ? (
        <section className="pivot-card" aria-labelledby="google-pivot-heading">
          {(() => {
            const action = result.phase === "selected" && result.miniPlan
              ? result.miniPlan.currentAction
              : result.phase === "outcome"
                ? result.selectedAction ?? recommendation.primaryAction
              : recommendation.primaryAction;
            return (
              <>
                <p className="eyebrow">{result.phase === "outcome" ? "Pivot outcome" : result.phase === "selected" ? `Mini-plan step ${result.miniPlan?.stepNumber ?? 1} of ${result.miniPlan?.maxSteps ?? 3}` : "Recommended Pivot"}</p>
                <h2 id="google-pivot-heading">{action.title}</h2>
                {result.phase === "recommended" ? (
                  <p className="privacy-note">Choose this Pivot to see the step-by-step action.</p>
                ) : (
                  <>
                    <p>{action.instruction}</p>
                    <p><strong>Goal:</strong> {action.goal}</p>
                    <ol>
                      {action.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                    <p><strong>Done when:</strong> {action.doneWhen}</p>
                    <p className="privacy-note">Estimated time: {action.estimatedMinutes} minutes.</p>
                    <p className="privacy-note">If this feels too large: {action.fallbackInstruction}</p>
                    <p className="pivot-explanation"><strong>Why this fits:</strong> {action.whyThisFits}</p>
                  </>
                )}
              </>
            );
          })()}
          <p className="pivot-explanation">{recommendation.whyThisPivot}</p>
          {result.fallback ? <p className="privacy-note">A curated fallback is keeping your accepted Situation map available.</p> : null}
          {result.adaptationStatus === "unavailable" ? <p className="privacy-note">Personalization is temporarily unavailable; this recommendation uses only the current Situation map.</p> : null}
          <div className="alternatives">
            <h3>Two other options</h3>
            {recommendation.alternativeActions.map((action) => (
              <div className="alternative-option" key={action.id}>
                <p>{action.title}</p>
                {result.phase === "recommended" ? (
                  <button className="quiet-button" onClick={() => void command({ type: "select-pivot", pivotKind: action.kind })} type="button">
                    Choose this Pivot
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {result.phase === "recommended" ? (
            <div className="button-row">
              <button onClick={() => void command({ type: "select-pivot", pivotKind: recommendation.primary.kind })} type="button">Choose this Pivot</button>
              <button className="quiet-button" onClick={() => void command({ type: "regenerate-pivot" })} type="button">Show another</button>
              <button className="text-button" onClick={() => {
                if (window.confirm("Dismiss this Pivot recommendation?")) void command({ type: "dismiss-pivot" });
              }} type="button">Dismiss</button>
            </div>
          ) : null}
          {result.phase === "selected" ? (
            <>
              {!result.pendingConfirmation && result.miniPlan ? <MiniPlanFeedbackControls onSubmit={(feedback) => void command({ type: "record-step-feedback", feedback })} /> : null}
              {!result.pendingConfirmation ? <OutcomeControls onSubmit={(outcome) => void command({ type: "record-outcome", outcome })} /> : null}
              {!result.pendingConfirmation ? <button className="quiet-button" onClick={() => void command({ type: "shrink-action" })} type="button">Make this action smaller</button> : null}
              {result.pendingConfirmation ? <ConfirmationControls confirmation={result.pendingConfirmation} onConfirm={(confirmationId) => void command({ type: "confirm-action", confirmationId })} onCancel={(confirmationId) => void command({ type: "cancel-confirmation", confirmationId })} /> : null}
            </>
          ) : null}
          {result.outcome ? <p className="form-message">Recorded: {result.outcome.status}{result.outcome.agencyShift ? `, ${result.outcome.agencyShift}` : ""}.</p> : null}
          {result.phase === "outcome" ? (
            <section className="history-card" aria-label="Saved Check-in status">
              <p className="eyebrow">Retention</p>
              <h3>{result.persistence === "saved" ? "This Check-in is saved" : "This Check-in was not saved"}</h3>
              <p>{result.persistence === "saved"
                ? result.enrichment === "saved"
                  ? "Your selected Pivot, outcome, Situation map, and compact Derived memory are available in Saved Check-ins."
                  : "Your selected Pivot, outcome, and Situation map are saved. The Derived memory was not retained because personalization is temporarily unavailable."
                : "Only this session shows the result; it will not become personal history."}</p>
              {result.derivedMemory ? <p><strong>Derived memory:</strong> {result.derivedMemory.context}</p> : null}
            </section>
          ) : null}
          {result.phase === "outcome" ? (
            <button className="quiet-button" disabled={startingNewCheckIn} onClick={() => void onNewCheckIn()} type="button">
              {startingNewCheckIn ? "Starting…" : "Start a new Check-in"}
            </button>
          ) : null}
        </section>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {result.phase !== "outcome" ? (
        <button className="text-button" onClick={() => void onDiscard()} type="button">Discard this Check-in</button>
      ) : null}
      <ActivityTrace events={result.activity} />
    </>
  );
}

type SavedHistoryProtocol = {
  id: string;
  createdAt: string;
  pivotState?: Extract<GooglePivotResult, { kind: "pivot-protocol" }>;
};

function GoogleSavedHistory({ refreshKey }: { refreshKey: number }) {
  const [histories, setHistories] = useState<SavedHistoryProtocol[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    googleApiRequest<{ kind: "protocols"; protocols: SavedHistoryProtocol[] }>("/api/google/history")
      .then((response) => {
        if (active) {
          setHistories(response.protocols);
          setError(undefined);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Saved Check-ins are unavailable.");
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function deleteHistory(protocolId: string) {
    if (!window.confirm("Delete this saved Check-in and its Derived memory?")) return;
    try {
      await deleteGoogleHistory(protocolId);
      setHistories((current) => current.filter((history) => history.id !== protocolId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The saved Check-in could not be deleted.");
    }
  }

  return (
    <section className="history-card" aria-labelledby="saved-history-heading">
      <p className="eyebrow">Private history</p>
      <h2 id="saved-history-heading">Saved Check-ins</h2>
      <p className="patterns-card__description">Only Check-ins you chose to save after recording an outcome appear here.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {histories.length === 0 ? <p className="privacy-note">No saved Check-ins yet.</p> : (
        <ul>
          {histories.map((history) => {
            const state = history.pivotState;
            if (!state) return null;
            return (
              <li id={`saved-check-in-${encodeURIComponent(history.id)}`} key={history.id}>
                <p><strong>{state.outcome?.status}</strong>{state.outcome?.agencyShift ? ` · ${state.outcome.agencyShift}` : ""}</p>
                <span>{state.checkIn.quickDump}</span>
                <details>
                  <summary>Inspect retained state</summary>
                  <p><strong>Selected Pivot:</strong> {state.selectedAction?.title ?? state.selectedPivot?.title}</p>
                  <p><strong>Situation map:</strong> {state.situationMap.shared.map((item) => item.text).join(" ")}</p>
                  {state.derivedMemory ? <p><strong>Derived memory:</strong> {state.derivedMemory.context}</p> : <p>No Derived memory was retained.</p>}
                </details>
                <button className="history-delete quiet-button" onClick={() => void deleteHistory(history.id)} type="button">Delete saved Check-in</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GoogleGuidancePreferences() {
  const [preferences, setPreferences] = useState<{ id: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    googleApiRequest<{ preferences: { id: string; text: string }[] }>("/api/google/preferences")
      .then((response) => setPreferences(response.preferences))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Guidance preferences are unavailable."));
  }, []);

  async function addPreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await googleApiRequest<{ preference: { id: string; text: string } }>("/api/google/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      setPreferences((current) => [...current, response.preference]);
      setText("");
      setError(undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Guidance preference could not be saved.");
    }
  }

  async function removePreference(id: string) {
    try {
      await googleApiRequest(`/api/google/preferences/${encodeURIComponent(id)}`, { method: "DELETE" });
      setPreferences((current) => current.filter((preference) => preference.id !== id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Guidance preference could not be deleted.");
    }
  }

  return (
    <section className="history-card" aria-labelledby="guidance-preferences-heading">
      <p className="eyebrow">Guidance preferences</p>
      <h2 id="guidance-preferences-heading">How should support adapt?</h2>
      <p className="patterns-card__description">These are explicit choices, not inferred traits. You can remove them anytime.</p>
      <form onSubmit={addPreference}>
        <label htmlFor="guidance-preference">Add a preference</label>
        <input id="guidance-preference" value={text} onChange={(event) => setText(event.target.value)} placeholder="Prefer concrete steps" required maxLength={240} />
        <button type="submit">Save preference</button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {preferences.map((preference) => <p key={preference.id}>{preference.text} <button className="text-button" onClick={() => void removePreference(preference.id)} type="button">Delete</button></p>)}
    </section>
  );
}

function ConversationTimeline({
  turns,
  undoableUpdates,
  onUndo
}: {
  turns: GoogleConversationalTurn[];
  undoableUpdates: Extract<GooglePivotResult, { kind: "pivot-protocol" }>['undoableUpdates'];
  onUndo: (updateId: string) => void;
}) {
  const latestUndoableUpdate = undoableUpdates.at(-1);
  return (
    <section className="conversation-timeline" aria-label="Active conversation timeline">
      <p className="eyebrow">This Check-in</p>
      <h2>Conversation</h2>
      {turns.map((turn) => {
        const canUndo = latestUndoableUpdate && turn.updates.some((update) => update.id === latestUndoableUpdate.id);
        return (
          <article className="conversation-turn" key={turn.id}>
            <p className="conversation-turn__person"><strong>You</strong>{turn.userMessage}</p>
            <div className="conversation-turn__guide">
              <p><strong>Pivot guide</strong>{turn.guideResponse.acknowledgment}</p>
              <p>{turn.guideResponse.explanation}</p>
              {turn.guideResponse.suggestedReplies.length ? (
                <ul aria-label="Suggested replies">
                  {turn.guideResponse.suggestedReplies.map((reply) => <li key={reply}>{reply}</li>)}
                </ul>
              ) : null}
              {turn.updates.length ? (
                <ul className="conversation-updates" aria-label="Visible protocol updates">
                  {turn.updates.map((update) => <li key={update.id}>{update.summary}{update.undoable ? " Undoable." : ""}</li>)}
                </ul>
              ) : null}
              {canUndo ? <button className="text-button" onClick={() => onUndo(latestUndoableUpdate.id)} type="button">Undo update</button> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ConversationComposer({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return (
    <form className="conversation-composer" onSubmit={(event) => {
      event.preventDefault();
      const trimmed = message.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setMessage("");
    }}>
      <label htmlFor="conversation-message">Add context or tell the guide what changed</label>
      <textarea id="conversation-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={10_000} rows={3} placeholder="I want to correct or add…" />
      <button type="submit">Send to this Check-in</button>
    </form>
  );
}

function ConfirmationControls({
  confirmation,
  onConfirm,
  onCancel
}: {
  confirmation: GooglePendingConfirmation;
  onConfirm: (confirmationId: string) => void;
  onCancel: (confirmationId: string) => void;
}) {
  return (
    <section className="confirmation-card" aria-label="Confirmation required">
      <p><strong>{confirmation.summary}</strong></p>
      <p className="privacy-note">No change has been made yet.</p>
      <div className="button-row">
        <button onClick={() => onConfirm(confirmation.id)} type="button">Confirm</button>
        <button className="quiet-button" onClick={() => onCancel(confirmation.id)} type="button">Cancel</button>
      </div>
    </section>
  );
}

function OutcomeControls({ onSubmit }: { onSubmit: (outcome: { status: "completed" | "partly-helpful" | "not-a-fit" | "skipped"; agencyShift?: "more-able" | "about-as-able" | "less-able" }) => void }) {
  const [agencyShift, setAgencyShift] = useState<"more-able" | "about-as-able" | "less-able">();
  return (
    <div className="outcome-controls">
      <p><strong>How did it go?</strong></p>
      <div className="button-row">
        {(["completed", "partly-helpful", "not-a-fit", "skipped"] as const).map((status) => (
          <button key={status} className="quiet-button" onClick={() => onSubmit({ status, agencyShift })} type="button">{status}</button>
        ))}
      </div>
      <label htmlFor="agency-shift">Optional: how able do you feel to continue?</label>
      <select id="agency-shift" value={agencyShift ?? ""} onChange={(event) => setAgencyShift(event.target.value as typeof agencyShift)}>
        <option value="">Choose one</option>
        <option value="more-able">More able</option>
        <option value="about-as-able">About as able</option>
        <option value="less-able">Less able</option>
      </select>
    </div>
  );
}

function MiniPlanFeedbackControls({ onSubmit }: { onSubmit: (feedback: PivotStepFeedback) => void }) {
  return (
    <div className="outcome-controls">
      <p><strong>What happened with this step?</strong></p>
      <p className="privacy-note">Your answer helps the guide choose the next step. You can record the overall outcome separately below.</p>
      <div className="button-row">
        {([
          ["completed", "Completed"],
          ["partly-helpful", "Partly helpful"],
          ["blocked", "Blocked"],
          ["not-a-fit", "Not a fit"],
          ["skipped", "Skipped"]
        ] as const).map(([status, label]) => (
          <button key={status} className="quiet-button" onClick={() => onSubmit({ status })} type="button">{label}</button>
        ))}
      </div>
    </div>
  );
}

function SituationMapSection({
  editable,
  section,
  title,
  items,
  onChange,
  onSave,
  onResolve,
  onApprove,
  approvedItemIds,
  savingItem
}: {
  editable: boolean;
  section: keyof SituationMap;
  title: string;
  items: { id: string; text: string; provenance: string }[];
  onChange: (section: keyof SituationMap, id: string, text: string) => void;
  onSave: (section: keyof SituationMap, id: string) => Promise<void>;
  onResolve?: (id: string) => void;
  onApprove?: (id: string) => void;
  approvedItemIds?: readonly string[];
  savingItem: string | undefined;
}) {
  return (
    <details className="situation-map__section" open>
      <summary><h3>{title}</h3></summary>
      {items.length === 0 ? <p className="privacy-note">Nothing identified yet.</p> : null}
      {items.map((item) => (
        <div key={item.id} className="situation-map__item">
          <span><strong>{item.provenance}:</strong></span>
          {editable ? <textarea value={item.text} onChange={(event) => onChange(section, item.id, event.target.value)} rows={2} /> : <p>{item.text}</p>}
          {editable ? <button className="text-button" disabled={savingItem === item.id} onClick={() => void onSave(section, item.id)} type="button">
            {savingItem === item.id ? "Saving…" : "Save correction"}
          </button> : null}
          {section === "artifactClaims" && editable && onApprove && !approvedItemIds?.includes(item.id) ? (
            <button className="text-button" onClick={() => onApprove(item.id)} type="button">Approve for saved map</button>
          ) : null}
          {editable && onResolve ? <button className="text-button" onClick={() => onResolve(item.id)} type="button">Resolve contradiction</button> : null}
        </div>
      ))}
    </details>
  );
}

function ActivityTrace({ events }: { events: { kind: string; message: string }[] }) {
  return (
    <details className="activity-trace" open={events.some((event) => event.kind === "fallback")}>
      <summary>
        <p className="eyebrow">Activity trace</p>
        <h2 id="activity-trace-heading">Observable actions</h2>
      </summary>
      {events.map((event, index) => <p key={`${event.kind}-${index}`}>{event.message}</p>)}
    </details>
  );
}

function OptionalArtifactUpload({ onAdd }: { onAdd: (artifacts: { base64: string; mimeType: string }[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);

  async function addArtifacts() {
    if (!files.length) return;
    setWorking(true);
    try {
      onAdd(await Promise.all(files.map(artifactPayload)));
      setFiles([]);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="history-card" aria-labelledby="optional-artifacts-heading">
      <p className="eyebrow">Optional supporting artifact</p>
      <h2 id="optional-artifacts-heading">Add artifacts if useful</h2>
      <p className="privacy-note">The Quick dump is enough. Up to five JPEG, PNG, WebP, or PDF artifacts are reviewed without retaining original files.</p>
      <label htmlFor="later-google-artifacts">Optional supporting artifacts</label>
      <input id="later-google-artifacts" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
      <button className="quiet-button" disabled={!files.length || working} onClick={() => void addArtifacts()} type="button">{working ? "Reviewing…" : "Review artifacts"}</button>
    </section>
  );
}

async function artifactPayload(file: File): Promise<{ base64: string; mimeType: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { base64: googleImageBytesToBase64(bytes), mimeType: file.type };
}

async function loadWorkspace(person: Person): Promise<Protocol> {
  const storageKey = `unstuck.google.protocol.${person.id}`;
  const existingProtocolId = window.sessionStorage.getItem(storageKey);
  if (existingProtocolId) {
    const existing = await googleApiRequest<{ kind: "protocol" | "not-found"; protocol?: Protocol }>(
      `/api/google/protocol/${encodeURIComponent(existingProtocolId)}`,
      {},
      { allowNotFound: true }
    );
    if (existing.kind === "protocol" && existing.protocol) {
      return existing.protocol;
    }
  }

  const existing = await googleApiRequest<{
    kind: "protocol" | "not-found";
    protocol?: Protocol;
  }>("/api/google/protocol", {}, { allowNotFound: true });
  if (existing.kind === "protocol" && existing.protocol) {
    window.sessionStorage.setItem(storageKey, existing.protocol.id);
    return existing.protocol;
  }

  return createProtocolForPerson(person);
}

async function createProtocolForPerson(person: Person): Promise<Protocol> {
  const created = await googleApiRequest<{ kind: "protocol"; protocol: Protocol }>(
    "/api/google/protocol",
    { method: "POST" }
  );
  window.sessionStorage.setItem(`unstuck.google.protocol.${person.id}`, created.protocol.id);
  return created.protocol;
}

function deleteGoogleHistory(protocolId: string): Promise<unknown> {
  return googleApiRequest(`/api/google/history/${encodeURIComponent(protocolId)}`, { method: "DELETE" });
}

export async function googleApiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { allowNotFound?: boolean } = {}
): Promise<T> {
  const token = await getFirebaseGoogleAuthClient().idToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      authorization: token ? `Bearer ${token}` : ""
    }
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (options.allowNotFound && response.status === 404 && isNotFoundResponse(body)) {
    return body as T;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : "Your private workspace is unavailable.";
    throw new Error(message);
  }

  return body as T;
}

function isNotFoundResponse(body: unknown): body is { kind: "not-found" } {
  return typeof body === "object" && body !== null && "kind" in body && body.kind === "not-found";
}

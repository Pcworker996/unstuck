"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { getFirebaseGoogleAuthClient } from "../lib/firebase-google-auth";
import type { GooglePivotResult, SituationMap } from "./google-pivot-protocol";

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
          protocolId={protocol.id}
          protocolVersion={protocol.version}
          result={pivotResult}
          onResult={(next) => {
            setPivotResult(next);
            if (next.kind === "pivot-protocol" && next.persistence === "saved") {
              setHistoryRefresh((value) => value + 1);
            }
          }}
        />
      ) : null}
      <GoogleSavedHistory refreshKey={historyRefresh} />
    </main>
  );
}

function GooglePivotWorkspace({
  protocolId,
  protocolVersion,
  result,
  onResult
}: {
  protocolId: string;
  protocolVersion: number;
  result: GooglePivotResult | undefined;
  onResult: (result: GooglePivotResult) => void;
}) {
  const [quickDump, setQuickDump] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
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
          saveRequested
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
              <strong>Save this Check-in after I record an outcome.</strong>
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
        <GooglePivotResultView protocolId={protocolId} result={result} onResult={onResult} />
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
      <ActivityTrace events={result.activity} />
    </section>
  );
}

function GooglePivotResultView({
  protocolId,
  result,
  onResult
}: {
  protocolId: string;
  result: Extract<GooglePivotResult, { kind: "pivot-protocol" }>;
  onResult: (result: GooglePivotResult) => void;
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
      {result.phase !== "clarifying" && result.phase !== "dismissed" && recommendation ? (
        <section className="pivot-card" aria-labelledby="google-pivot-heading">
          <p className="eyebrow">{result.phase === "outcome" ? "Pivot outcome" : "Recommended Pivot"}</p>
          <h2 id="google-pivot-heading">{recommendation.primary.title}</h2>
          <p>{recommendation.primary.instruction}</p>
          <p className="pivot-explanation">{recommendation.whyThisPivot}</p>
          {result.fallback ? <p className="privacy-note">A curated fallback is keeping your accepted Situation map available.</p> : null}
          <div className="alternatives">
            <h3>Two other options</h3>
            {recommendation.alternatives.map((pivot) => <p key={pivot.id}>{pivot.title}</p>)}
          </div>
          {result.phase === "recommended" ? (
            <div className="button-row">
              <button onClick={() => void command({ type: "select-pivot", pivotKind: recommendation.primary.kind })} type="button">Choose this Pivot</button>
              <button className="quiet-button" onClick={() => void command({ type: "regenerate-pivot" })} type="button">Show another</button>
              <button className="text-button" onClick={() => void command({ type: "dismiss-pivot" })} type="button">Dismiss</button>
            </div>
          ) : null}
          {result.phase === "selected" ? <OutcomeControls onSubmit={(outcome) => void command({ type: "record-outcome", outcome })} /> : null}
          {result.outcome ? <p className="form-message">Recorded: {result.outcome.status}{result.outcome.agencyShift ? `, ${result.outcome.agencyShift}` : ""}.</p> : null}
          {result.phase === "outcome" ? (
            <section className="history-card" aria-label="Saved Check-in status">
              <p className="eyebrow">Retention</p>
              <h3>{result.persistence === "saved" ? "This Check-in is saved" : "This Check-in was not saved"}</h3>
              <p>{result.persistence === "saved"
                ? result.enrichment === "saved"
                  ? "Your selected Pivot, outcome, Situation map, and compact Derived memory are available in Saved Check-ins."
                  : "Your selected Pivot, outcome, and Situation map are saved. Adaptation is temporarily unavailable, so no Derived memory was added."
                : "Only this session shows the result; it will not become personal history."}</p>
              {result.derivedMemory ? <p><strong>Derived memory:</strong> {result.derivedMemory.context}</p> : null}
            </section>
          ) : null}
        </section>
      ) : null}
      <details className="situation-map" open>
        <summary>
          <p className="eyebrow">Situation map</p>
          <h2 id="situation-map-heading">What we have so far</h2>
        </summary>
        <SituationMapSection editable={mapEditable} section="shared" title="You shared" items={situationMap.shared} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="artifactClaims" title="Artifact claims" items={situationMap.artifactClaims} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="interpretations" title="Guide interpretation" items={situationMap.interpretations} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="uncertainties" title="Uncertainties" items={situationMap.uncertainties} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="contradictions" title="Contradictions to resolve" items={situationMap.contradictions} onChange={updateMapItem} onSave={saveMapItem} onResolve={(itemId) => void command({ type: "resolve-contradiction", itemId })} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="constraints" title="Constraints" items={situationMap.constraints} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="progress" title="Immediate progress" items={situationMap.progress} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="pivotHistory" title="Pivot history" items={situationMap.pivotHistory} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
        <SituationMapSection editable={mapEditable} section="priorPatterns" title="Relevant prior patterns" items={situationMap.priorPatterns} onChange={updateMapItem} onSave={saveMapItem} savingItem={savingItem} />
      </details>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
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
      await googleApiRequest(`/api/google/history/${encodeURIComponent(protocolId)}`, { method: "DELETE" });
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
              <li key={history.id}>
                <p><strong>{state.outcome?.status}</strong>{state.outcome?.agencyShift ? ` · ${state.outcome.agencyShift}` : ""}</p>
                <span>{state.checkIn.quickDump}</span>
                <details>
                  <summary>Inspect retained state</summary>
                  <p><strong>Selected Pivot:</strong> {state.selectedPivot?.title}</p>
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

function SituationMapSection({
  editable,
  section,
  title,
  items,
  onChange,
  onSave,
  onResolve,
  savingItem
}: {
  editable: boolean;
  section: keyof SituationMap;
  title: string;
  items: { id: string; text: string; provenance: string }[];
  onChange: (section: keyof SituationMap, id: string, text: string) => void;
  onSave: (section: keyof SituationMap, id: string) => Promise<void>;
  onResolve?: (id: string) => void;
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
          {editable && onResolve ? <button className="text-button" onClick={() => onResolve(item.id)} type="button">Resolve contradiction</button> : null}
        </div>
      ))}
    </details>
  );
}

function ActivityTrace({ events }: { events: { kind: string; message: string }[] }) {
  return (
    <details className="activity-trace" open>
      <summary>
        <p className="eyebrow">Activity trace</p>
        <h2 id="activity-trace-heading">Observable actions</h2>
      </summary>
      {events.map((event, index) => <p key={`${event.kind}-${index}`}>{event.message}</p>)}
    </details>
  );
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

  const created = await googleApiRequest<{ kind: "protocol"; protocol: Protocol }>(
    "/api/google/protocol",
    { method: "POST" }
  );
  window.sessionStorage.setItem(storageKey, created.protocol.id);
  return created.protocol;
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

"use client";

import { useEffect, useState } from "react";
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
          result={pivotResult}
          onResult={setPivotResult}
        />
      ) : null}
    </main>
  );
}

function GooglePivotWorkspace({
  protocolId,
  result,
  onResult
}: {
  protocolId: string;
  result: GooglePivotResult | undefined;
  onResult: (result: GooglePivotResult) => void;
}) {
  const [quickDump, setQuickDump] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await googleApiRequest<GooglePivotResult>("/api/google/pivot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolId, quickDump, consentGiven })
      });
      onResult(next);
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
      {result?.kind === "pivot-protocol" ? <GooglePivotResultView result={result} /> : null}
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

function GooglePivotResultView({ result }: { result: Extract<GooglePivotResult, { kind: "pivot-protocol" }> }) {
  const [situationMap, setSituationMap] = useState(result.situationMap);

  function updateMapItem(section: keyof SituationMap, id: string, text: string) {
    setSituationMap((current) => ({
      ...current,
      [section]: current[section].map((item) => item.id === id ? { ...item, text } : item)
    }));
  }

  return (
    <>
      <section className="pivot-card" aria-labelledby="google-pivot-heading">
        <p className="eyebrow">Recommended Pivot</p>
        <h2 id="google-pivot-heading">{result.recommendation.primary.title}</h2>
        <p>{result.recommendation.primary.instruction}</p>
        <p className="pivot-explanation">{result.recommendation.whyThisPivot}</p>
        <div className="alternatives">
          <h3>Two other options</h3>
          {result.recommendation.alternatives.map((pivot) => (
            <p key={pivot.id}>{pivot.title}</p>
          ))}
        </div>
      </section>
      <section className="situation-map" aria-labelledby="situation-map-heading">
        <p className="eyebrow">Situation map</p>
        <h2 id="situation-map-heading">What we have so far</h2>
        <SituationMapSection section="shared" title="You shared" items={situationMap.shared} onChange={updateMapItem} />
        <SituationMapSection section="interpretations" title="Guide interpretation" items={situationMap.interpretations} onChange={updateMapItem} />
        <SituationMapSection section="uncertainties" title="Uncertainties" items={situationMap.uncertainties} onChange={updateMapItem} />
        <SituationMapSection section="constraints" title="Constraints" items={situationMap.constraints} onChange={updateMapItem} />
        <SituationMapSection section="progress" title="Immediate progress" items={situationMap.progress} onChange={updateMapItem} />
      </section>
      <ActivityTrace events={result.activity} />
    </>
  );
}

function SituationMapSection({
  section,
  title,
  items,
  onChange
}: {
  section: keyof SituationMap;
  title: string;
  items: { id: string; text: string; provenance: string }[];
  onChange: (section: keyof SituationMap, id: string, text: string) => void;
}) {
  return (
    <section className="situation-map__section">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="privacy-note">Nothing identified yet.</p> : null}
      {items.map((item) => (
        <label key={item.id} className="situation-map__item">
          <span><strong>{item.provenance}:</strong></span>
          <textarea value={item.text} onChange={(event) => onChange(section, item.id, event.target.value)} rows={2} />
        </label>
      ))}
    </section>
  );
}

function ActivityTrace({ events }: { events: { kind: string; message: string }[] }) {
  return (
    <section className="activity-trace" aria-labelledby="activity-trace-heading">
      <p className="eyebrow">Activity trace</p>
      <h2 id="activity-trace-heading">Observable actions</h2>
      {events.map((event, index) => <p key={`${event.kind}-${index}`}>{event.message}</p>)}
    </section>
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

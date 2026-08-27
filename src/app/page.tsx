"use client";

import { FormEvent, useEffect, useState } from "react";

import "../lib/amplify-client";
import { authClient } from "../lib/auth-client";
import type { AuthMode } from "./auth-form";
import { authFormFields } from "./auth-form";
import { PrivateHome } from "./private-home";
import type { PersonalAccount } from "./private-home-state";
import { privateHomeState } from "./private-home-state";
import { GoogleHome } from "./google-home";

function AuthScreen({ onAuthenticated }: { onAuthenticated: (person: PersonalAccount) => void }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const fields = authFormFields(mode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(undefined);

    try {
      if (mode === "sign-up") {
        setMode(await authClient.createAccount(email, password));
        setMessage("Check your email to confirm your Personal account.");
      } else if (mode === "confirm") {
        await authClient.confirmAccount(email, confirmationCode);
        setMode("sign-in");
        setMessage("Your account is confirmed. Please sign in.");
      } else {
        const person = await authClient.signIn(email, password);
        if (person) {
          onAuthenticated(person);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not complete that request.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = mode === "sign-up" ? "Create account" : mode === "confirm" ? "Confirm account" : "Sign in";

  return (
    <main className="auth-screen">
      <section aria-labelledby="auth-heading" className="auth-card">
        <a className="wordmark" href="/">unstuck</a>
        <p className="eyebrow">Private, user-initiated support</p>
        <h1 id="auth-heading">A small place to begin again.</h1>
        <p className="auth-card__boundary">Unstuck is non-clinical and is not a substitute for professional or emergency care.</p>
        <form onSubmit={submit}>
          <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {fields.includes("password") ? <label>Password<input autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label> : null}
          {fields.includes("confirmation-code") ? <label>Confirmation code<input inputMode="numeric" onChange={(event) => setConfirmationCode(event.target.value)} required value={confirmationCode} /></label> : null}
          {message ? <p aria-live="polite" className="form-message">{message}</p> : null}
          <button disabled={submitting} type="submit">{submitting ? "Please wait…" : submitLabel}</button>
        </form>
        {mode === "sign-in" ? <button className="text-button" onClick={() => setMode("sign-up")} type="button">Create a Personal account</button> : null}
        {mode !== "sign-in" ? <button className="text-button" onClick={() => setMode("sign-in")} type="button">Back to sign in</button> : null}
      </section>
    </main>
  );
}

export default function HomePage() {
  if (process.env.NEXT_PUBLIC_UNSTUCK_RUNTIME === "google") {
    return <GoogleHome />;
  }

  return <LegacyHomePage />;
}

function LegacyHomePage() {
  const [person, setPerson] = useState<PersonalAccount>();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    authClient
      .currentPerson()
      .then(setPerson)
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <main className="loading-screen">Loading your private space…</main>;
  }

  const state = privateHomeState(person);

  if (state.kind === "sign-in") {
    return <AuthScreen onAuthenticated={setPerson} />;
  }

  return (
    <PrivateHome
      onSignOut={() => authClient.signOut().then(() => setPerson(undefined))}
      person={state.person}
    />
  );
}

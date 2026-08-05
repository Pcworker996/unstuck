import type { PersonalAccount } from "./private-home-state";

type PrivateHomeProps = {
  person: PersonalAccount;
  onSignOut: () => void;
};

export function PrivateHome({ person, onSignOut }: PrivateHomeProps) {
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

      <section aria-label="No check-ins yet" className="empty-state">
        <p className="empty-state__mark" aria-hidden="true">
          ·
        </p>
        <h2>A quiet place to begin.</h2>
        <p>Quick Dump and the Pivot guide are on their way.</p>
      </section>
    </main>
  );
}

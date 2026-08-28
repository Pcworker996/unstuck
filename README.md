# Unstuck

Unstuck is a non-clinical, user-controlled self-regulation companion. It
helps a person turn a voluntary Quick dump into a small, concrete Pivot
without diagnosing or offering emergency care.

## Current runtime

The active submission runtime is Google Cloud:

~~~text
Browser
  -> Firebase Authentication
  -> Cloud Run / Next.js
       -> Firebase Admin token verification
       -> Firestore protocol persistence
       -> Genkit + Gemini through Vertex AI

Local Docker build
  -> Artifact Registry
  -> Cloud Run revision
~~~

The server derives the owner from the verified Firebase ID token. It does not
accept an account ID from browser request data. Safety, consent, ownership,
bounded Pivot selection, schema validation, persistence, and fallbacks remain
application-owned.

## Google-native flow

An authenticated person can:

1. Sign in with Google through Firebase Authentication.
2. Start or load a private Firestore-backed Pivot Protocol.
3. Enter a Quick dump without attaching an artifact.
4. Give explicit processing consent.
5. Pass the direct-input Safety gate.
6. Receive a provenance-aware Situation map, one recommended Pivot, and two
   bounded alternatives.
7. Inspect the Activity trace and fallback status.

The Situation map distinguishes the person's statements from guide
interpretations and uncertainties, while keeping constraints and immediate
progress visible.

## Local development

Requirements:

- Node.js 22+
- Firebase project with Google Authentication enabled
- Cloud Firestore database
- Google Cloud CLI for local Application Default Credentials

Install dependencies and start the development server:

~~~bash
npm install
npm run dev
~~~

Create the local environment file:

~~~bash
cp .env.example .env.local
~~~

Fill in the Firebase web-app values in .env.local. Keep .env.local private;
it is ignored by Git. The Firebase web configuration values are browser
identifiers, but server credentials must never be committed.

For local Firebase Admin and Vertex AI access, authenticate Application
Default Credentials:

~~~bash
gcloud auth application-default login
~~~

If Firestore has not been created yet, create it in the Firebase console or
with the Firebase CLI. See [docs/google-runtime.md](docs/google-runtime.md)
for the runtime requirements and Firestore ownership path.

## Google Cloud setup and deployment

The complete setup guide explains:

- Selecting project unstuck-4605f
- Enabling Artifact Registry, Cloud Run, and Vertex AI APIs
- Creating the Docker repository
- Granting the Cloud Run runtime service account Vertex AI access
- Configuring Docker authentication
- Building, pushing, and deploying a new image
- Verifying the Cloud Run service

Read [docs/google-cloud-setup-and-deployment.md](docs/google-cloud-setup-and-deployment.md).
Use only clearly labeled synthetic data for demos and evaluation; see
[docs/synthetic-evaluation.md](docs/synthetic-evaluation.md).

After one-time setup, the recurring release path is:

~~~text
docker build -> docker push -> gcloud run deploy
~~~

A Git commit alone does not update Cloud Run. Each deployment creates a new
Cloud Run revision.

## Useful commands

Run the test suite:

~~~bash
npm test
~~~

Run TypeScript validation:

~~~bash
npx tsc --noEmit
~~~

Build the production application:

~~~bash
npm run build
~~~

Inspect the deployed service:

~~~bash
gcloud run services describe unstuck \
  --region us-central1 \
  --format="value(status.url)"
~~~

gcloud run deploy changes the live service. gcloud run services describe
only inspects it.

## Repository layout

- src/app/ — Next.js pages, UI state, and route handlers.
- src/server/ — authentication, Firestore persistence, Genkit adapter, and
  Pivot Protocol services.
- docs/ — runtime, deployment, ADR, and research documentation.
- firestore.rules — Firestore security rules.
- Dockerfile — production container build.

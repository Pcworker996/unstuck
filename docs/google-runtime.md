# Google-native runtime (ticket 01)

Set `NEXT_PUBLIC_UNSTUCK_RUNTIME=google` to select the Google-native workspace while the existing AWS path remains available during the migration.

The browser requires these Firebase web-app values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The Cloud Run service requires `FIREBASE_PROJECT_ID`. Firebase Admin uses Application Default Credentials, so Cloud Run should run with a service account that can verify Firebase ID tokens and read/write the Firestore `personalAccounts/{uid}/protocols/{protocolId}` documents. For local development, provide Google Application Default Credentials through the standard `GOOGLE_APPLICATION_CREDENTIALS` mechanism.

Enable Google as a Firebase Authentication provider and configure its authorized domains before using the sign-in flow. The browser sends its Firebase ID token as a bearer token; the server derives the owner from the verified token and never accepts an account ID from the request.

Ticket 2 generation uses Genkit with Gemini through Vertex AI. Enable
`aiplatform.googleapis.com` and grant the Cloud Run runtime service account the
Vertex AI User role (`roles/aiplatform.user`). Configure
`GOOGLE_CLOUD_LOCATION` (default `us-central1`) and
`VERTEX_GEMINI_MODEL_ID` (default `gemini-3.5-flash`). Genkit uses Application
Default Credentials locally and the attached Cloud Run service account in
production.

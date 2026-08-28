# Google-native runtime

The submitted application has one production runtime: Firebase Authentication,
Firestore, Genkit with Gemini on Vertex AI, and private temporary Cloud Storage,
hosted by Cloud Run.

The browser requires these Firebase web-app values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The Cloud Run service requires `FIREBASE_PROJECT_ID` and
`GOOGLE_TEMP_ARTIFACT_BUCKET`. Firebase Admin uses Application
Default Credentials, so Cloud Run should run with a service account that can
read/write Firestore `personalAccounts/{uid}/protocols/{protocolId}` documents
and create/delete objects plus verify the one-day lifecycle rule in the private
temporary bucket. Grant `roles/datastore.user` and a least-privilege custom
role containing `storage.buckets.get`, `storage.objects.create`,
`storage.objects.get`, and `storage.objects.delete`. The Firestore role is
project-scoped; Firebase Admin bypasses Firestore rules, so owner isolation is
enforced by verified-token ownership and application-controlled document paths,
not by IAM. Firebase ID-token
verification uses Google's public signing keys and does not require a separate
IAM role. For local development, provide Google Application Default
Credentials through the standard `GOOGLE_APPLICATION_CREDENTIALS` mechanism.

Enable Google as a Firebase Authentication provider and configure its authorized domains before using the sign-in flow. The browser sends its Firebase ID token as a bearer token; the server derives the owner from the verified token and never accepts an account ID from the request.

The runtime expects an empty Firestore database and performs no migration or
import from another persistence system. Protocols, memories, preferences, and
quota counters are created on demand under the authenticated owner. Use only
clearly labeled synthetic data for local demos and evaluation.

Ticket 2 generation uses Genkit with Gemini through Vertex AI. Enable
`aiplatform.googleapis.com` and grant the Cloud Run runtime service account the
Vertex AI User role (`roles/aiplatform.user`). Configure
`GOOGLE_CLOUD_LOCATION` (default `us-central1`) and
`VERTEX_GEMINI_MODEL_ID` (default `gemini-3.5-flash`). Genkit uses Application
Default Credentials locally and the attached Cloud Run service account in
production.

The temporary bucket must use public access prevention, must not grant
`allUsers` or `allAuthenticatedUsers` access, and must apply the lifecycle
configuration in `storage-lifecycle.json`. The application only returns an
internal `gs://` object reference and deletes each object after extraction;
the one-day lifecycle rule is the cleanup backstop.

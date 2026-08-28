# Google Cloud setup and deployment

This runbook explains the Google Cloud resources used by Unstuck and the
commands to rebuild and redeploy the application after code changes.

The deployment path is:

~~~text
Local source code
  -> Docker image
  -> Artifact Registry
  -> Cloud Run revision
  -> Public Cloud Run URL
~~~

## Project values

The current Google Cloud deployment uses:

~~~text
Project ID:        unstuck-4605f
Region:            us-central1
Cloud Run service: unstuck
Runtime account:   unstuck-runtime@unstuck-4605f.iam.gserviceaccount.com
Artifact repo:     unstuck
~~~

The project ID identifies the Firebase/Google Cloud project. The Cloud Run
service name and Artifact Registry repository name are separate names.

Set the shell variables used by the setup commands:

~~~bash
PROJECT_ID=unstuck-4605f
REGION=us-central1
~~~

## One-time setup

Run these commands from the repository directory.

### Select the project

~~~bash
gcloud config set project unstuck-4605f
~~~

This selects the project used by subsequent gcloud commands. Verify it with:

~~~bash
gcloud config get-value project
~~~

### Enable required APIs

~~~bash
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com
~~~

These APIs provide Docker image storage, Cloud Run hosting, and Vertex AI
access for Gemini through Genkit. Billing must be enabled before these
services can be activated.

### Initialize Firestore and its indexes

If the project does not already have a default Firestore database, create one
in the Cloud Run region:

~~~bash
gcloud firestore databases list
gcloud firestore databases create \
  --database="(default)" \
  --location="$REGION" \
  --type=firestore-native
~~~

Deploy the repository's deny-by-default rules and the vector index with the
Firebase CLI:

~~~bash
firebase use unstuck-4605f
firebase deploy --only firestore
~~~

Run `firebase use` with the actual project ID when deploying elsewhere. The
Cloud Run service uses Firebase Admin credentials, so the deny-by-default
client rules do not block server-side access.

### Create the private temporary PDF bucket

The application uploads only short-lived PDF artifacts under the
`unstuck/temporary-pdfs/` prefix. Create a private bucket with public access
prevention and install the checked-in one-day lifecycle rule:

~~~bash
PROJECT_ID=unstuck-4605f
REGION=us-central1
BUCKET="unstuck-temporary-pdfs-$PROJECT_ID"

gcloud storage buckets create "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --public-access-prevention
gcloud storage buckets update "gs://$BUCKET" \
  --lifecycle-file=storage-lifecycle.json
~~~

Create a project-level custom role for the runtime service account and grant
only the bucket metadata and object permissions used by the application:

~~~bash
gcloud iam roles create unstuckArtifactStorage \
  --project="$PROJECT_ID" \
  --title="Unstuck temporary artifact storage" \
  --permissions=storage.buckets.get,storage.buckets.update,storage.objects.create,storage.objects.delete \
  --stage=GA
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:unstuck-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="projects/$PROJECT_ID/roles/unstuckArtifactStorage"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:unstuck-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
~~~

The custom role is needed because the runtime verifies and installs the
lifecycle rule on first use. Do not grant the bucket public access. Use the
same `$BUCKET` value as `GOOGLE_TEMP_ARTIFACT_BUCKET` below.

### Create the Docker repository

Create the repository once:

~~~bash
gcloud artifacts repositories create unstuck \
  --repository-format=docker \
  --location=us-central1
~~~

If it already exists, do not recreate it. Check with:

~~~bash
gcloud artifacts repositories list --location=us-central1
~~~

### Grant Vertex AI access to Cloud Run

~~~bash
gcloud projects add-iam-policy-binding unstuck-4605f \
  --member="serviceAccount:unstuck-runtime@unstuck-4605f.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
~~~

This gives the Cloud Run runtime service account permission to call Gemini
through Vertex AI.

### Configure Docker authentication

~~~bash
gcloud auth configure-docker us-central1-docker.pkg.dev
~~~

This configures the local Docker client to authenticate when pushing images to
Artifact Registry. It does not build, push, or deploy an image.

## Rebuild and redeploy after code changes

Repeat this section whenever application code changes.

### 1. Choose an image tag

Use a unique tag for each deployment:

~~~bash
PROJECT_ID=unstuck-4605f
REGION=us-central1
SERVICE=unstuck
BUCKET="unstuck-temporary-pdfs-$PROJECT_ID"
TAG=$(git rev-parse --short HEAD)
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/unstuck/$SERVICE:$TAG"
~~~

If the code has not been committed, use a timestamp instead:

~~~bash
TAG=$(date +%Y%m%d-%H%M%S)
~~~

### 2. Load local Firebase values

~~~bash
set -a
source .env.local
set +a
~~~

Do not commit .env.local or print its contents. Private credentials must
never be passed as Docker build arguments.

### 3. Build the production image

~~~bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --tag "$IMAGE" .
~~~

This packages the current source code into a production Docker image.
linux/amd64 keeps it compatible when building on an Apple Silicon Mac.

### 4. Push the image

~~~bash
docker push "$IMAGE"
~~~

This uploads the image to Artifact Registry. Cloud Run cannot deploy the new
version until it has been pushed.

### 5. Deploy the image to Cloud Run

~~~bash
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "unstuck-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --min 0 \
  --max 3 \
  --allow-unauthenticated \
  --set-env-vars \
"FIREBASE_PROJECT_ID=$PROJECT_ID,GOOGLE_TEMP_ARTIFACT_BUCKET=$BUCKET,GOOGLE_CLOUD_LOCATION=$REGION,VERTEX_GEMINI_MODEL_ID=gemini-3.5-flash,GOOGLE_DAILY_MODEL_ACCOUNT_LIMIT=100,GOOGLE_DAILY_MODEL_GLOBAL_LIMIT=1000,GOOGLE_DAILY_ARTIFACT_ACCOUNT_LIMIT=10,GOOGLE_DAILY_ARTIFACT_GLOBAL_LIMIT=100"
~~~

gcloud run deploy creates a new revision and routes traffic to it. The service
URL normally remains unchanged.

allow-unauthenticated allows the browser to load the application. The
application's API routes still require a Firebase ID token.

## Verify the deployment

Get the current service URL:

~~~bash
gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format="value(status.url)"
~~~

The distinction is:

~~~text
gcloud run deploy              changes or creates the service
gcloud run services describe   inspects the existing service
~~~

## Complete repeatable deployment block

After one-time setup is complete:

~~~bash
PROJECT_ID=unstuck-4605f
REGION=us-central1
SERVICE=unstuck
BUCKET="unstuck-temporary-pdfs-$PROJECT_ID"
TAG=$(git rev-parse --short HEAD)
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/unstuck/$SERVICE:$TAG"

set -a
source .env.local
set +a

docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --tag "$IMAGE" .

docker push "$IMAGE"

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "unstuck-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --min 0 \
  --max 3 \
  --allow-unauthenticated \
  --set-env-vars \
"FIREBASE_PROJECT_ID=$PROJECT_ID,GOOGLE_TEMP_ARTIFACT_BUCKET=$BUCKET,GOOGLE_CLOUD_LOCATION=$REGION,VERTEX_GEMINI_MODEL_ID=gemini-3.5-flash,GOOGLE_DAILY_MODEL_ACCOUNT_LIMIT=100,GOOGLE_DAILY_MODEL_GLOBAL_LIMIT=1000,GOOGLE_DAILY_ARTIFACT_ACCOUNT_LIMIT=10,GOOGLE_DAILY_ARTIFACT_GLOBAL_LIMIT=100"
~~~

## Important notes

- A Git commit alone does not deploy the application.
- docker push uploads an image but does not update Cloud Run.
- gcloud run deploy changes the live application.
- Do not put service-account keys, database passwords, or API secrets in the
  image or Docker build arguments.
- If a NEXT_PUBLIC_* build value changes, rebuild the image because it is
  compiled into the browser bundle.
- Each deployment creates a new immutable Cloud Run revision.
- `--min 0` enables scale-to-zero and `--max 3` keeps the judging deployment bounded.
- Daily model and artifact counters are transactionally reserved in Firestore for
  each account and for the global deployment. A rejected reservation returns a
  typed quota response without changing the current protocol state.
- The documented limits are intentionally conservative; lower them for public
  demonstrations or raise them only with a matching budget review.

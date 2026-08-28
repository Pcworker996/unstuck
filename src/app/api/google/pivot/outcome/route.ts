import { authenticateFirebaseRequest } from "../../../../../server/firebase-auth";
import { handleGooglePivotOutcomePost } from "../../../../../server/google-pivot-http";
import { getGoogleProtocolRuntime } from "../../../../../server/google-runtime";
import { createGenkitGooglePivotGenerator } from "../../../../../server/genkit-google-pivot-generator";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const runtime = getGoogleProtocolRuntime();
  return handleGooglePivotOutcomePost(
    request,
    authenticateFirebaseRequest,
    runtime.repository,
    createGenkitGooglePivotGenerator(),
    runtime.adaptation
  );
}

import { authenticateFirebaseRequest } from "../../../../server/firebase-auth";
import { handleGooglePivotPost } from "../../../../server/google-pivot-http";
import { getGoogleProtocolRuntime } from "../../../../server/google-runtime";
import { createGenkitGooglePivotGenerator } from "../../../../server/genkit-google-pivot-generator";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleGooglePivotPost(
    request,
    authenticateFirebaseRequest,
    getGoogleProtocolRuntime().repository,
    createGenkitGooglePivotGenerator()
  );
}

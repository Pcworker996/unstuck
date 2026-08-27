import { authenticateFirebaseRequest } from "../../../../server/firebase-auth";
import { handleGoogleSavedHistoryGet } from "../../../../server/google-protocol-http";
import { getGoogleProtocolRuntime } from "../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleGoogleSavedHistoryGet(
    request,
    getGoogleProtocolRuntime(),
    authenticateFirebaseRequest
  );
}

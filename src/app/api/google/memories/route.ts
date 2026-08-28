import { authenticateFirebaseRequest } from "../../../../server/firebase-auth";
import { handleGoogleMemoriesGet } from "../../../../server/google-memory-http";
import { getGoogleProtocolRuntime } from "../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const runtime = getGoogleProtocolRuntime();
  if (!runtime.adaptation) throw new Error("Google memory runtime is unavailable.");
  return handleGoogleMemoriesGet(request, runtime.adaptation.memoryRepository, authenticateFirebaseRequest);
}

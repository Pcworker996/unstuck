import { authenticateFirebaseRequest } from "../../../../server/firebase-auth";
import { handleGooglePreferencePost, handleGooglePreferencesGet } from "../../../../server/google-memory-http";
import { getGoogleProtocolRuntime } from "../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const runtime = getGoogleProtocolRuntime();
  if (!runtime.adaptation) throw new Error("Google memory runtime is unavailable.");
  return handleGooglePreferencesGet(request, runtime.adaptation.memoryRepository, authenticateFirebaseRequest);
}

export async function POST(request: Request): Promise<Response> {
  const runtime = getGoogleProtocolRuntime();
  if (!runtime.adaptation) throw new Error("Google memory runtime is unavailable.");
  return handleGooglePreferencePost(request, runtime.adaptation.memoryRepository, authenticateFirebaseRequest);
}

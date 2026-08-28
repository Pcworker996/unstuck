import { authenticateFirebaseRequest } from "../../../../../server/firebase-auth";
import { handleGooglePreferenceDelete } from "../../../../../server/google-memory-http";
import { getGoogleProtocolRuntime } from "../../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const runtime = getGoogleProtocolRuntime();
  if (!runtime.adaptation) throw new Error("Google memory runtime is unavailable.");
  return handleGooglePreferenceDelete(request, id, runtime.adaptation.memoryRepository, authenticateFirebaseRequest);
}

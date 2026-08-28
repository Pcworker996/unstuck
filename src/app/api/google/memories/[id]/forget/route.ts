import { authenticateFirebaseRequest } from "../../../../../../server/firebase-auth";
import { handleGoogleMemoryControl } from "../../../../../../server/google-memory-http";
import { getGoogleProtocolRuntime } from "../../../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const runtime = getGoogleProtocolRuntime();
  if (!runtime.adaptation) throw new Error("Google memory runtime is unavailable.");
  return handleGoogleMemoryControl(request, id, "forget", runtime.adaptation.memoryRepository, authenticateFirebaseRequest);
}

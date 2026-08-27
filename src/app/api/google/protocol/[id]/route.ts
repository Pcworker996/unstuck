import { authenticateFirebaseRequest } from "../../../../../server/firebase-auth";
import { handleGoogleProtocolGet } from "../../../../../server/google-protocol-http";
import { getGoogleProtocolRuntime } from "../../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  try {
    return await handleGoogleProtocolGet(
      request,
      id,
      getGoogleProtocolRuntime(),
      authenticateFirebaseRequest
    );
  } catch {
    return new Response(
      JSON.stringify({
        kind: "server-error",
        message: "Your private workspace is temporarily unavailable."
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

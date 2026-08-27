import { authenticateFirebaseRequest } from "../../../../../server/firebase-auth";
import { handleGoogleSavedHistoryDelete } from "../../../../../server/google-protocol-http";
import { getGoogleProtocolRuntime } from "../../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handleGoogleSavedHistoryDelete(
    request,
    id,
    getGoogleProtocolRuntime(),
    authenticateFirebaseRequest
  );
}

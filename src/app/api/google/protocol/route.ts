import { authenticateFirebaseRequest } from "../../../../server/firebase-auth";
import {
  handleGoogleProtocolList,
  handleGoogleProtocolPost
} from "../../../../server/google-protocol-http";
import { getGoogleProtocolRuntime } from "../../../../server/google-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    return await handleGoogleProtocolList(
      request,
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

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleGoogleProtocolPost(
      request,
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

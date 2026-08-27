import { handleOutcomePost } from "../../../../server/pivot-http";
import { getPivotRuntime } from "../../../../server/runtime";

export async function POST(request: Request): Promise<Response> {
  return handleOutcomePost(request, getPivotRuntime().outcome);
}

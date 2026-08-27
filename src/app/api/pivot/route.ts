import { handlePivotPost } from "../../../server/pivot-http";
import { getPivotRuntime } from "../../../server/runtime";

export async function POST(request: Request): Promise<Response> {
  return handlePivotPost(request, getPivotRuntime().pivot);
}

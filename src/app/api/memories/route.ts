import { handleMemoriesGet } from "../../../server/pivot-http";
import { getPivotRuntime } from "../../../server/runtime";

export async function GET(request: Request): Promise<Response> {
  return handleMemoriesGet(request, getPivotRuntime().pivot.repository);
}

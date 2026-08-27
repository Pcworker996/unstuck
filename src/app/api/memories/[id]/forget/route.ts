import { handleMemoryForget } from "../../../../../server/pivot-http";
import { getPivotRuntime } from "../../../../../server/runtime";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handleMemoryForget(request, id, getPivotRuntime().pivot.repository);
}

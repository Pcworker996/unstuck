import { handleMemoryDelete } from "../../../../server/pivot-http";
import { getPivotRuntime } from "../../../../server/runtime";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handleMemoryDelete(request, id, getPivotRuntime().pivot.repository);
}

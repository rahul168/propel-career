import { buildOpenApiSpec } from "@/lib/swagger/spec";

export const dynamic = "force-static";

export function GET() {
  const spec = buildOpenApiSpec();
  return Response.json(spec);
}

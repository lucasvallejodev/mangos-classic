import { checkName } from "@/lib/names";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  return Response.json(await checkName(name), { headers: { "Cache-Control": "no-store" } });
}

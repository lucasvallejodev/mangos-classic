import { listAccounts } from "@/lib/characters";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const accounts = await listAccounts(sp.get("q")?.trim() || undefined, sp.get("bots") === "1");
  return Response.json(accounts, { headers: { "Cache-Control": "no-store" } });
}

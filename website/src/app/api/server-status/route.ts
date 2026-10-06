import { isWorldServerRunning } from "@/lib/server-status";

export async function GET() {
  return Response.json({ running: await isWorldServerRunning() }, { headers: { "Cache-Control": "no-store" } });
}

import { exportCharacter } from "@/lib/export";

export async function GET(_request: Request, { params }: { params: Promise<{ guid: string }> }) {
  const guid = Number((await params).guid);
  if (!Number.isInteger(guid) || guid <= 0) return Response.json({ error: "Invalid character id." }, { status: 400 });

  const data = await exportCharacter(guid);
  if (!data) return Response.json({ error: "Character not found." }, { status: 404 });

  return new Response(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(data.character.name)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

import { z } from "zod";
import { characterFile } from "@/lib/format";
import { ImportError, importCharacter } from "@/lib/import";

const body = z.object({ file: characterFile, accountId: z.number().int().positive(), name: z.string() });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request or character file." }, { status: 400 });

  try {
    return Response.json(await importCharacter(parsed.data.file, parsed.data.accountId, parsed.data.name));
  } catch (e) {
    if (e instanceof ImportError) return Response.json({ error: e.message, code: e.code }, { status: 409 });
    console.error("import failed", e);
    return Response.json({ error: "Import failed; nothing was imported. See the server log." }, { status: 500 });
  }
}

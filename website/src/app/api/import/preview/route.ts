import { z } from "zod";
import { characterFile } from "@/lib/format";
import { previewImport } from "@/lib/import";

const body = z.object({ file: z.unknown(), accountId: z.number().int().positive().optional(), name: z.string().optional() });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const file = characterFile.safeParse(parsed.data.file);
  if (!file.success) {
    const issue = file.error.issues[0];
    return Response.json(
      { error: `Not a valid character file: ${issue.path.join(".") || "file"}: ${issue.message}` },
      { status: 422 },
    );
  }
  return Response.json(await previewImport(file.data, parsed.data.accountId, parsed.data.name));
}

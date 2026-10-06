import { C, W, q, type Querier, pool } from "./db";

export interface NameCheck {
  ok: boolean;
  name: string; // normalized the way the server does it: First letter upper, rest lower
  reason?: string;
}

// Mirrors normalizePlayerName + ObjectMgr::CheckPlayerName with the default config
// (MinPlayerName = 2, max 12, letters only).
export function normalizeName(raw: string) {
  const s = raw.trim();
  return s ? s[0].toLocaleUpperCase() + s.slice(1).toLocaleLowerCase() : s;
}

export async function checkName(raw: string, conn: Querier = pool): Promise<NameCheck> {
  const name = normalizeName(raw);
  const length = [...name].length;
  if (length < 2) return { ok: false, name, reason: "Name must be at least 2 letters." };
  if (length > 12) return { ok: false, name, reason: "Name can be at most 12 letters." };
  if (!/^\p{L}+$/u.test(name)) return { ok: false, name, reason: "Name can only contain letters." };

  const [reserved] = await q(`SELECT 1 FROM ${W}.reserved_name WHERE name = ? LIMIT 1`, [name], conn);
  if (reserved) return { ok: false, name, reason: "That name is reserved on this server." };
  const [taken] = await q(`SELECT 1 FROM ${C}.characters WHERE name = ? LIMIT 1`, [name], conn);
  if (taken) return { ok: false, name, reason: "That name is already taken." };
  return { ok: true, name };
}

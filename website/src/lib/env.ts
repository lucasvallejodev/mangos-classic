import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// The server's own .env (one level up) already holds the DB credentials and realm
// settings, so read it instead of duplicating secrets. process.env wins.
function loadRootEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), "..", ".env");
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const root = loadRootEnv();
const get = (key: string, fallback: string) => process.env[key] ?? root[key] ?? fallback;

export const env = {
  db: {
    host: get("DB_HOST", "127.0.0.1"),
    port: Number(get("DB_HOST_PORT", "3307")),
    user: get("DB_USER", "mangos"),
    password: get("DB_PASSWORD", ""),
  },
  charDb: get("CHAR_DB", "classiccharacters"),
  worldDb: get("WORLD_DB", "classicmangos"),
  realmDb: get("REALM_DB", "classicrealmd"),
  realmId: Number(get("REALM_ID", "1")),
  worldHost: get("WORLD_HOST", "127.0.0.1"),
  worldPort: Number(get("REALM_PORT", "8085")),
  botAccountPrefix: get("BOT_ACCOUNT_PREFIX", "RNDBOT"),
  charactersPerRealm: Number(get("CHARACTERS_PER_REALM", "10")),
  allowTwoSideAccounts: get("ALLOW_TWO_SIDE_ACCOUNTS", "0") === "1",
};

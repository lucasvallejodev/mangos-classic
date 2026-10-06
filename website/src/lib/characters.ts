import { C, R, q } from "./db";
import { env } from "./env";
import { ALLIANCE_RACES, HORDE_RACES } from "./gamedata";

export const PAGE_SIZES = [25, 50, 100];

const SORTS = {
  name: "c.name", level: "c.level", account: "a.username", race: "c.race", class: "c.class",
  zone: "c.zone", money: "c.money", played: "c.totaltime", logout: "c.logout_time", online: "c.online",
} as const;
export type SortKey = keyof typeof SORTS;

export interface CharacterFilters {
  name?: string;
  account?: string;
  race?: number;
  class?: number;
  faction?: "alliance" | "horde";
  minLevel?: number;
  maxLevel?: number;
  online?: boolean;
  showBots?: boolean;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CharacterRow {
  guid: number;
  name: string;
  account: number;
  accountName: string | null;
  isBot: number;
  race: number;
  class: number;
  gender: number;
  level: number;
  zone: number;
  map: number;
  online: number;
  money: number;
  totaltime: number;
  logout_time: number;
}

// LIKE with the user's text taken literally
const like = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
const botLike = () => `${env.botAccountPrefix.replace(/[\\%_]/g, "\\$&")}%`;

export function parseFilters(sp: Record<string, string | string[] | undefined>): CharacterFilters {
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])?.toString().trim() || undefined;
  const num = (k: string) => {
    const n = Number(str(k));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const faction = str("faction");
  const sort = str("sort");
  const pageSize = num("size");
  return {
    name: str("name"),
    account: str("account"),
    race: num("race"),
    class: num("class"),
    faction: faction === "alliance" || faction === "horde" ? faction : undefined,
    minLevel: num("min"),
    maxLevel: num("max"),
    online: str("online") === "1",
    showBots: str("bots") === "1",
    sort: sort && sort in SORTS ? (sort as SortKey) : "name",
    dir: str("dir") === "desc" ? "desc" : "asc",
    page: num("page") ?? 1,
    pageSize: pageSize && PAGE_SIZES.includes(pageSize) ? pageSize : PAGE_SIZES[0],
  };
}

export async function listCharacters(f: CharacterFilters) {
  const where: string[] = ["c.deleteDate IS NULL"];
  const params: unknown[] = [];
  const add = (sql: string, ...p: unknown[]) => {
    where.push(sql);
    params.push(...p);
  };

  // Bots are hidden unless explicitly asked for
  if (!f.showBots) add("(a.username IS NULL OR a.username NOT LIKE ?)", botLike());
  if (f.name) add("c.name LIKE ?", like(f.name));
  if (f.account) add("a.username LIKE ?", like(f.account));
  if (f.race) add("c.race = ?", f.race);
  if (f.class) add("c.class = ?", f.class);
  if (f.faction) add("c.race IN (?)", f.faction === "alliance" ? ALLIANCE_RACES : HORDE_RACES);
  if (f.minLevel) add("c.level >= ?", f.minLevel);
  if (f.maxLevel) add("c.level <= ?", f.maxLevel);
  if (f.online) add("c.online = 1");

  const from = `FROM ${C}.characters c LEFT JOIN ${R}.account a ON a.id = c.account WHERE ${where.join(" AND ")}`;
  const pageSize = f.pageSize ?? PAGE_SIZES[0];
  const [{ total }] = await q<{ total: number }>(`SELECT COUNT(*) total ${from}`, params);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(f.page ?? 1, pages);

  const rows = await q<CharacterRow>(
    `SELECT c.guid, c.name, c.account, a.username accountName, COALESCE(a.username LIKE ?, 0) isBot,
            c.race, c.class, c.gender, c.level, c.zone, c.map, c.online, c.money, c.totaltime, c.logout_time
     ${from}
     ORDER BY ${SORTS[f.sort ?? "name"]} ${f.dir === "desc" ? "DESC" : "ASC"}, c.guid ASC
     LIMIT ? OFFSET ?`,
    [botLike(), ...params, pageSize, (page - 1) * pageSize],
  );
  return { rows, total, page, pages, pageSize };
}

export interface AccountRow {
  id: number;
  username: string;
  characters: number;
  alliance: number;
  horde: number;
}

export async function listAccounts(search: string | undefined, includeBots: boolean): Promise<AccountRow[]> {
  const where: string[] = [];
  const params: unknown[] = [ALLIANCE_RACES, HORDE_RACES];
  if (!includeBots) {
    where.push("a.username NOT LIKE ?");
    params.push(botLike());
  }
  if (search) {
    where.push("a.username LIKE ?");
    params.push(like(search));
  }
  return q<AccountRow>(
    `SELECT a.id, a.username, COUNT(c.guid) characters,
            COALESCE(SUM(c.race IN (?)), 0) alliance, COALESCE(SUM(c.race IN (?)), 0) horde
     FROM ${R}.account a LEFT JOIN ${C}.characters c ON c.account = a.id AND c.deleteDate IS NULL
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     GROUP BY a.id, a.username ORDER BY a.username LIMIT 50`,
    params,
  );
}

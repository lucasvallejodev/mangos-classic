import Link from "next/link";
import { Suspense } from "react";
import { CharacterFilters } from "@/components/character-filters";
import { PAGE_SIZES, listCharacters, parseFilters, type SortKey } from "@/lib/characters";
import { CLASSES, CLASS_COLORS, RACES, factionOf, formatDuration, formatMoney, mapName, zoneName } from "@/lib/gamedata";

type SearchParams = Record<string, string | string[] | undefined>;

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "name", label: "Name" },
  { key: "account", label: "Account" },
  { key: "race", label: "Race" },
  { key: "class", label: "Class" },
  { key: "level", label: "Level", className: "text-right" },
  { key: "zone", label: "Location" },
  { key: "money", label: "Money", className: "text-right" },
  { key: "played", label: "Played", className: "text-right" },
  { key: "logout", label: "Last seen" },
  { key: null, label: "" },
];

function href(sp: SearchParams, changes: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...changes })) if (typeof v === "string" && v) next.set(k, v);
  return `/?${next}`;
}

function lastSeen(online: number, logout: number) {
  if (online) return <span className="text-emerald-400">Online</span>;
  if (!logout) return <span className="text-gray-500">Never</span>;
  return new Date(logout * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export default async function CharactersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { rows, total, page, pages } = await listCharacters(filters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Characters</h1>
        <span className="text-sm text-gray-400">
          {total.toLocaleString("en-US")} found{filters.showBots ? "" : " (bots hidden)"}
        </span>
      </div>

      <Suspense>
        <CharacterFilters pageSizes={PAGE_SIZES} />
      </Suspense>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              {COLUMNS.map((col) => {
                const active = col.key && filters.sort === col.key;
                const dir = active && filters.dir === "asc" ? "desc" : "asc";
                return (
                  <th key={col.label} className={`px-3 py-2 font-medium ${col.className ?? ""}`}>
                    {col.key ? (
                      <Link href={href(sp, { sort: col.key, dir, page: undefined })} className="hover:text-white">
                        {col.label}
                        {active ? (filters.dir === "asc" ? " ▲" : " ▼") : ""}
                      </Link>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.guid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/characters/${c.guid}`} className="hover:underline" style={{ color: CLASS_COLORS[c.class] }}>{c.name}</Link>
                </td>
                <td className="px-3 py-2 text-gray-300">
                  {c.accountName ?? `#${c.account}`}
                  {c.isBot ? <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-gray-400">bot</span> : null}
                </td>
                <td className="px-3 py-2">
                  <span className={factionOf(c.race) === "alliance" ? "text-sky-300" : "text-red-300"}>{RACES[c.race] ?? c.race}</span>
                </td>
                <td className="px-3 py-2">{CLASSES[c.class] ?? c.class}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.level}</td>
                <td className="px-3 py-2">
                  {zoneName(c.zone)}
                  <span className="ml-2 text-xs text-gray-500">{mapName(c.map)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-200/90">{formatMoney(c.money)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-300">{formatDuration(c.totaltime)}</td>
                <td className="px-3 py-2 tabular-nums text-gray-300">{lastSeen(c.online, c.logout_time)}</td>
                <td className="px-3 py-1.5 text-right">
                  <a
                    href={`/api/characters/${c.guid}/export`}
                    download
                    className="btn h-7 px-2 text-xs"
                    title={c.online ? "Character is online: the export can be up to one save interval old" : "Download as JSON"}
                  >
                    Export{c.online ? " ⚠" : ""}
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-gray-500">
                  No characters match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <>
              <Link className="btn" href={href(sp, { page: undefined })}>First</Link>
              <Link className="btn" href={href(sp, { page: String(page - 1) })}>Previous</Link>
            </>
          ) : null}
          {page < pages ? (
            <>
              <Link className="btn" href={href(sp, { page: String(page + 1) })}>Next</Link>
              <Link className="btn" href={href(sp, { page: String(pages) })}>Last</Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

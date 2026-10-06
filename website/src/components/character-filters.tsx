"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CLASSES, RACES } from "@/lib/gamedata";

export function CharacterFilters({ pageSizes }: { pageSizes: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Any filter change goes to the URL and resets to page 1
  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    apply(Object.fromEntries(["name", "account", "min", "max"].map((k) => [k, String(data.get(k) ?? "").trim()])));
  }

  const hasFilters = [...sp.keys()].some((k) => !["sort", "dir", "page", "size"].includes(k));

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-3" key={sp.toString()}>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Name
        <input name="name" defaultValue={sp.get("name") ?? ""} placeholder="Search name" className="input w-40" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Account
        <input name="account" defaultValue={sp.get("account") ?? ""} placeholder="Search account" className="input w-40" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Faction
        <select className="input" value={sp.get("faction") ?? ""} onChange={(e) => apply({ faction: e.target.value })}>
          <option value="">Any</option>
          <option value="alliance">Alliance</option>
          <option value="horde">Horde</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Race
        <select className="input" value={sp.get("race") ?? ""} onChange={(e) => apply({ race: e.target.value })}>
          <option value="">Any</option>
          {Object.entries(RACES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Class
        <select className="input" value={sp.get("class") ?? ""} onChange={(e) => apply({ class: e.target.value })}>
          <option value="">Any</option>
          {Object.entries(CLASSES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Level
        <span className="flex items-center gap-1">
          <input name="min" type="number" min={1} max={60} defaultValue={sp.get("min") ?? ""} placeholder="1" className="input w-16" />
          <span>–</span>
          <input name="max" type="number" min={1} max={60} defaultValue={sp.get("max") ?? ""} placeholder="60" className="input w-16" />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Per page
        <select className="input" value={sp.get("size") ?? String(pageSizes[0])} onChange={(e) => apply({ size: e.target.value })}>
          {pageSizes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="flex h-9 items-center gap-2 text-sm text-gray-200">
        <input type="checkbox" checked={sp.get("online") === "1"} onChange={(e) => apply({ online: e.target.checked ? "1" : "" })} />
        Online only
      </label>
      <label className="flex h-9 items-center gap-2 text-sm text-gray-200" title="Hides characters that belong to bot accounts">
        <input type="checkbox" checked={sp.get("bots") !== "1"} onChange={(e) => apply({ bots: e.target.checked ? "" : "1" })} />
        Hide bots
      </label>

      <div className="ml-auto flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>Search</button>
        {hasFilters && (
          <button type="button" className="btn" onClick={() => startTransition(() => router.replace(pathname))}>
            Reset
          </button>
        )}
      </div>
    </form>
  );
}

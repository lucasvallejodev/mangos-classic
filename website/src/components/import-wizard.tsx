"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountRow } from "@/lib/characters";
import { CLASSES, RACES, formatMoney, zoneName } from "@/lib/gamedata";
import type { ImportPreview } from "@/lib/import";
import type { NameCheck } from "@/lib/names";

type Result = { guid: number; name: string; items: number; pets: number };

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string; code?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export function ImportWizard() {
  const [file, setFile] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [showBotAccounts, setShowBotAccounts] = useState(false);
  const [account, setAccount] = useState<AccountRow | null>(null);

  const [name, setName] = useState("");
  const [nameCheck, setNameCheck] = useState<NameCheck | null>(null);
  const [checkedName, setCheckedName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onFile(f: File | undefined) {
    setFile(null); setPreview(null); setFileError(""); setError(""); setResult(null); setAccount(null);
    if (!f) return;
    setFileName(f.name);
    let json: unknown;
    try {
      json = JSON.parse(await f.text());
    } catch {
      return setFileError("That file is not valid JSON.");
    }
    const res = await post<ImportPreview>("/api/import/preview", { file: json });
    if (!res.ok) return setFileError(res.data.error ?? "Could not read the file.");
    setFile(json);
    setPreview(res.data);
    setName(res.data.name.name);
    setNameCheck(res.data.name);
    setCheckedName(res.data.name.name);
  }

  // Account list, searched server-side
  useEffect(() => {
    if (!file) return;
    const timer = setTimeout(() => {
      fetch(`/api/accounts?q=${encodeURIComponent(accountSearch)}${showBotAccounts ? "&bots=1" : ""}`)
        .then((r) => r.json())
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [file, accountSearch, showBotAccounts]);

  // Live name check while typing
  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/names/check?name=${encodeURIComponent(name)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: NameCheck) => { setNameCheck(d); setCheckedName(name); })
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [file, name]);

  // Account-specific checks (character limit, faction) and a fresh server-status check
  useEffect(() => {
    if (!file || !account) return;
    post<ImportPreview>("/api/import/preview", { file, accountId: account.id }).then((res) => res.ok && setPreview(res.data));
  }, [file, account]);

  async function submit() {
    if (!file || !account) return;
    setBusy(true); setError("");
    const res = await post<Result>("/api/import", { file, accountId: account.id, name });
    setBusy(false);
    if (res.ok) return setResult(res.data);
    setError(res.data.error ?? "Import failed.");
    // Someone took the name between the live check and the import: ask again
    if (res.data.code === "name") setNameCheck({ ok: false, name, reason: res.data.error });
    else post<ImportPreview>("/api/import/preview", { file, accountId: account.id }).then((r) => r.ok && setPreview(r.data));
  }

  if (result) {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold text-emerald-300">Imported {result.name}</h2>
        <p className="text-sm text-gray-300">
          Created as character #{result.guid} on account {account?.username} with {result.items} items
          {result.pets ? ` and ${result.pets} pet(s)` : ""}. Start the world server and log in to play it.
        </p>
        <div className="flex gap-2">
          <Link href={`/?name=${encodeURIComponent(result.name)}`} className="btn btn-primary">Show in list</Link>
          <button className="btn" onClick={() => onFile(undefined)}>Import another</button>
        </div>
      </div>
    );
  }

  const s = preview?.summary;
  const checking = checkedName !== name;
  const nameOk = !!nameCheck?.ok && !checking;
  const canImport = !!preview && !!account && nameOk && preview.errors.length === 0 && !busy;

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-4">
        <h2 className="font-medium">1. Character file</h2>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm text-gray-300 file:mr-3 file:h-9 file:rounded-md file:border file:border-white/10 file:bg-white/5 file:px-3 file:text-sm file:text-gray-100"
        />
        {fileError && <p className="text-sm text-red-300">{fileName}: {fileError}</p>}
        {s && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            {[
              ["Name", s.name],
              ["Race / class", `${RACES[s.race] ?? s.race} ${CLASSES[s.class] ?? s.class}`],
              ["Level", s.level],
              ["Money", formatMoney(s.money)],
              ["Location", zoneName(s.zone)],
              ["Items", s.items],
              ["Spells", s.spells],
              ["Quests", s.quests],
              ["Pets", s.pets],
              ["Mail", s.mailSkipped ? `${s.mail - s.mailSkipped} of ${s.mail}` : s.mail],
              ["Exported", new Date(s.exportedAt * 1000).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {preview?.warnings.map((w) => (
          <p key={w} className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{w}</p>
        ))}
      </section>

      {preview && (
        <>
          <section className="card flex flex-col gap-3 p-4">
            <h2 className="font-medium">2. Target account</h2>
            <div className="flex flex-wrap items-center gap-3">
              <input className="input w-56" placeholder="Search account" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={showBotAccounts} onChange={(e) => setShowBotAccounts(e.target.checked)} />
                Include bot accounts
              </label>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border border-white/10">
              {accounts.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-2 text-sm last:border-0 ${account?.id === a.id ? "bg-amber-400/10" : "hover:bg-white/5"}`}>
                  <input type="radio" name="account" checked={account?.id === a.id} onChange={() => setAccount(a)} />
                  <span className="font-medium">{a.username}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {a.characters} character{Number(a.characters) === 1 ? "" : "s"}
                    {Number(a.characters) > 0 && ` (${a.alliance} Alliance, ${a.horde} Horde)`}
                  </span>
                </label>
              ))}
              {accounts.length === 0 && <p className="px-3 py-4 text-sm text-gray-500">No accounts found.</p>}
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-4">
            <h2 className="font-medium">3. Character name</h2>
            <div className="flex flex-wrap items-center gap-3">
              <input className="input w-56" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} aria-invalid={!nameOk} />
              {checking ? (
                <span className="text-sm text-gray-400">Checking…</span>
              ) : nameCheck?.ok ? (
                <span className="text-sm text-emerald-300">{nameCheck.name} is available</span>
              ) : (
                <span className="text-sm text-red-300">{nameCheck?.reason} Choose another name.</span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            {preview.errors.map((e) => (
              <p key={e} className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{e}</p>
            ))}
            {error && !preview.errors.includes(error) && (
              <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>
            )}
            <div>
              <button className="btn btn-primary" disabled={!canImport} onClick={submit}>
                {busy ? "Importing…" : account && nameOk ? `Import ${nameCheck?.name} into ${account.username}` : "Import"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

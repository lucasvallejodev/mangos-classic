import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, ItemSlot, ItemTooltip, QUALITY_COLORS } from "@/components/item";
import { getCharacterDetails, type CharacterDetails, type SpellView } from "@/lib/details";
import { CLASSES, CLASS_COLORS, RACES, factionOf, formatDuration, formatMoney, mapName, zoneName } from "@/lib/gamedata";

const POWER_NAMES = ["Mana", "Rage", "Focus", "Energy", "Happiness"];
const STAT_ROWS: [string, string, string?][] = [
  ["Health", "maxhealth"], ["Strength", "strength"], ["Agility", "agility"], ["Stamina", "stamina"],
  ["Intellect", "intellect"], ["Spirit", "spirit"], ["Armor", "armor"],
  ["Attack power", "attackPower"], ["Ranged attack power", "rangedAttackPower"],
  ["Crit", "critPct", "%"], ["Ranged crit", "rangedCritPct", "%"], ["Dodge", "dodgePct", "%"], ["Parry", "parryPct", "%"], ["Block", "blockPct", "%"],
  ["Fire resistance", "resFire"], ["Nature resistance", "resNature"], ["Frost resistance", "resFrost"],
  ["Shadow resistance", "resShadow"], ["Arcane resistance", "resArcane"],
];
const REP_COLORS = ["#cc2222", "#ff0000", "#ee6622", "#ffff00", "#00ff00", "#00ff88", "#00ffcc", "#00ffff"];

function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-baseline gap-2 font-medium">
        {title}
        {count !== undefined && <span className="text-xs font-normal text-gray-500">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Bar({ value, max, color = "#f59e0b" }: { value: number; max: number; color?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded bg-white/10">
      <span className="block h-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </span>
  );
}

function SpellList({ spells }: { spells: SpellView[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {spells.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-sm">
          <Icon name={s.icon} size={24} />
          <span className="truncate">{s.name}</span>
          {s.rank && <span className="shrink-0 text-xs text-gray-500">{s.rank}</span>}
        </li>
      ))}
    </ul>
  );
}

function Container({ title, size, slots }: CharacterDetails["inventory"]["bags"][number]) {
  const cells = Array.from({ length: Math.max(size, ...slots.map((s) => s.slot + 1)) }, (_, i) => slots.find((s) => s.slot === i)?.item ?? null);
  return (
    <div>
      <h3 className="mb-1.5 text-xs text-gray-400">{title}</h3>
      <div className="flex max-w-[11.5rem] flex-wrap gap-1">
        {cells.map((item, i) => (
          <ItemSlot key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

export default async function CharacterPage({ params }: { params: Promise<{ guid: string }> }) {
  const guid = Number((await params).guid);
  const d = Number.isInteger(guid) && guid > 0 ? await getCharacterDetails(guid) : null;
  if (!d) notFound();
  const c = d.character;
  const talentPoints = d.talents.reduce((sum, t) => sum + t.points, 0);
  const activeQuests = d.quests.filter((x) => x.active);
  const bankUsed = d.inventory.bank.some((b) => b.slots.length);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-gray-400 hover:text-white">← All characters</Link>

      <header className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: CLASS_COLORS[c.class] }}>{c.name}</h1>
          <p className="text-sm text-gray-300">
            Level {c.level}{" "}
            <span className={factionOf(c.race) === "alliance" ? "text-sky-300" : "text-red-300"}>{RACES[c.race]}</span> {CLASSES[c.class]}
            {d.guild && <span className="text-gray-400"> · &lt;{d.guild}&gt;</span>}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {[
            ["Account", `${d.account.name ?? `#${d.account.id}`}${d.account.isBot ? " (bot)" : ""}`],
            ["Location", `${zoneName(c.position.zone)}, ${mapName(c.position.map)}`],
            ["Hearthstone", c.homebind ? zoneName(c.homebind.zone) : "None"],
            ["Money", formatMoney(c.money)],
            ["Played", formatDuration(c.played.total)],
            ["Status", d.online ? "Online" : "Offline"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className={value === "Online" ? "text-emerald-400" : ""}>{value}</dd>
            </div>
          ))}
        </dl>
        <a href={`/api/characters/${d.guid}/export`} download className="btn btn-primary ml-auto">Export JSON</a>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section title="Equipment">
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {d.inventory.equipment.map(({ label, item }, i) => (
              <li key={i} className="group relative flex items-center gap-2.5 text-sm">
                <Icon name={item?.icon ?? null} border={item ? QUALITY_COLORS[item.quality] : undefined} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-gray-500">{label}</span>
                  {item ? (
                    <span className="truncate" style={{ color: QUALITY_COLORS[item.quality] }}>{item.name}</span>
                  ) : (
                    <span className="text-gray-600">Empty</span>
                  )}
                </span>
                {item && <ItemTooltip item={item} />}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Stats">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-400">Health (saved)</dt>
            <dd className="text-right tabular-nums">{c.vitals.health}</dd>
            {c.vitals.powers.map((value, i) =>
              value ? (
                <div key={i} className="contents">
                  <dt className="text-gray-400">{POWER_NAMES[i]} (saved)</dt>
                  <dd className="text-right tabular-nums">{i === 1 ? value / 10 : value}</dd>
                </div>
              ) : null,
            )}
            <dt className="text-gray-400">Experience</dt>
            <dd className="text-right tabular-nums">{c.xp.toLocaleString("en-US")}</dd>
            <dt className="text-gray-400">Honorable kills</dt>
            <dd className="text-right tabular-nums">{c.honor.storedHonorableKills}</dd>
            {d.stats &&
              STAT_ROWS.map(([label, key, unit]) => (
                <div key={key} className="contents">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="text-right tabular-nums">{unit ? `${Number(d.stats![key]).toFixed(2)}${unit}` : d.stats![key]}</dd>
                </div>
              ))}
          </dl>
          {!d.stats && (
            <p className="mt-3 text-xs text-gray-500">
              Attributes, armor and crit are only stored when the server runs with PlayerSave.Stats.MinLevel ≥ 1, and
              are written when the character logs out.
            </p>
          )}
        </Section>
      </div>

      <Section title="Bags">
        <div className="flex flex-wrap gap-6">
          {d.inventory.bags.map((bag) => <Container key={bag.title} {...bag} />)}
          {d.inventory.keyring.length > 0 && <Container title="Keyring" size={0} slots={d.inventory.keyring} />}
        </div>
      </Section>

      {bankUsed && (
        <Section title="Bank">
          <div className="flex flex-wrap gap-6">
            {d.inventory.bank.map((bag) => <Container key={bag.title} {...bag} />)}
          </div>
        </Section>
      )}

      <Section title="Talents" count={`${d.talents.map((t) => t.points).join(" / ")} · ${talentPoints} points spent`}>
        <div className="flex flex-wrap gap-8">
          {d.talents.map((tab) => (
            <div key={tab.name}>
              <h3 className="mb-2 text-sm text-gray-300">
                {tab.name} <span className="text-gray-500">({tab.points})</span>
              </h3>
              <div className="grid grid-cols-4 gap-2" style={{ gridTemplateRows: `repeat(${tab.rows}, auto)` }}>
                {tab.talents.map((t) => (
                  <div
                    key={`${t.row}-${t.col}`}
                    title={`${t.name} ${t.rank}/${t.maxRank}`}
                    className={`relative ${t.rank ? "" : "opacity-35 grayscale"}`}
                    style={{ gridRow: t.row + 1, gridColumn: t.col + 1 }}
                  >
                    <Icon name={t.icon} border={t.rank === t.maxRank ? "#f59e0b" : t.rank ? "#22c55e" : undefined} />
                    <span className="absolute -bottom-1 -right-1 rounded bg-black px-1 text-[10px] tabular-nums text-gray-200">
                      {t.rank}/{t.maxRank}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Skills">
          <div className="flex flex-col gap-4">
            {d.skills.map((group) => (
              <div key={group.title}>
                <h3 className="mb-1.5 text-xs text-gray-400">{group.title}</h3>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {group.skills.map((s) => (
                    <li key={s.name} className="text-sm">
                      <span className="flex justify-between">
                        <span>{s.name}</span>
                        {s.max > 1 && <span className="tabular-nums text-gray-400">{s.value} / {s.max}</span>}
                      </span>
                      {s.max > 1 && <Bar value={s.value} max={s.max} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Reputation" count={d.reputation.length}>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {d.reputation.map((r) => (
              <li key={r.name} className="text-sm">
                <span className="flex justify-between gap-2">
                  <span className="truncate">{r.name}{r.atWar && <span className="ml-1 text-xs text-red-400">at war</span>}</span>
                  <span className="shrink-0 text-xs text-gray-400">{r.rank} {r.value}/{r.max}</span>
                </span>
                <Bar value={r.value} max={r.max} color={REP_COLORS[r.rankIndex]} />
              </li>
            ))}
          </ul>
          {d.reputation.length === 0 && <p className="text-sm text-gray-500">No known factions.</p>}
        </Section>
      </div>

      <Section title="Quests" count={`${activeQuests.length} in log · ${d.quests.length - activeQuests.length} completed`}>
        {activeQuests.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1 text-sm">
            {activeQuests.map((x) => (
              <li key={x.id} className="flex gap-3">
                <span className="w-8 text-right tabular-nums text-gray-500">{x.level > 0 ? x.level : ""}</span>
                <span>{x.title}</span>
                <span className={x.status === "Ready to turn in" ? "text-emerald-400" : "text-gray-500"}>{x.status}</span>
              </li>
            ))}
          </ul>
        )}
        {d.quests.length > activeQuests.length && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-white">Completed quests</summary>
            <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {d.quests.filter((x) => !x.active).map((x) => (
                <li key={x.id} className="truncate text-gray-300">{x.title}</li>
              ))}
            </ul>
          </details>
        )}
        {d.quests.length === 0 && <p className="text-sm text-gray-500">No quests.</p>}
      </Section>

      <Section title="Spells and abilities" count={d.spells.length}>
        {d.spells.length ? (
          <SpellList spells={d.spells} />
        ) : (
          <p className="text-sm text-gray-500">Only the default race and class spells, which the server does not store.</p>
        )}
      </Section>

      {d.recipes.length > 0 && (
        <Section title="Recipes" count={d.recipes.reduce((sum, r) => sum + r.spells.length, 0)}>
          <div className="flex flex-col gap-2">
            {d.recipes.map((r) => (
              <details key={r.profession} className="text-sm">
                <summary className="cursor-pointer text-gray-300 hover:text-white">
                  {r.profession} <span className="text-gray-500">({r.spells.length})</span>
                </summary>
                <div className="mt-2">
                  <SpellList spells={r.spells} />
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}

      {d.pets.length > 0 && (
        <Section title="Pets" count={d.pets.length}>
          <div className="flex flex-col gap-4">
            {d.pets.map((p, i) => (
              <div key={i}>
                <h3 className="mb-2 text-sm">
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-gray-400">
                    Level {p.level} {p.species} · {p.kind} · {p.where}
                    {p.loyalty !== null && ` · Loyalty ${p.loyalty} · ${p.trainingPoints} training points`}
                  </span>
                </h3>
                <SpellList spells={p.spells} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.mail.length > 0 && (
        <Section title="Mailbox" count={d.mail.length}>
          <ul className="flex flex-col gap-2 text-sm">
            {d.mail.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3">
                <span className="w-32 shrink-0 text-gray-400">{m.from}</span>
                <span>{m.subject || "(no subject)"}</span>
                {m.money > 0 && <span className="text-amber-200/90">{formatMoney(m.money)}</span>}
                {m.cod > 0 && <span className="text-red-300">COD {formatMoney(m.cod)}</span>}
                <span className="flex gap-1">{m.items.map((item) => <ItemSlot key={item.ref} item={item} />)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.auras.length > 0 && (
        <Section title="Active effects" count={d.auras.length}>
          <SpellList spells={d.auras} />
        </Section>
      )}
    </div>
  );
}

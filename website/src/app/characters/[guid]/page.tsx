import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, ItemSlot, ItemTooltip, QUALITY_COLORS } from "@/components/item";
import { getCharacterDetails, type CharacterDetails, type ItemView, type SpellView } from "@/lib/details";
import { CLASSES, CLASS_COLORS, RACES, factionOf, formatDuration, formatMoney, mapName, zoneName } from "@/lib/gamedata";

type Details = CharacterDetails;

const TABS = [
  ["character", "Character"],
  ["bags", "Bags & Bank"],
  ["talents", "Talents"],
  ["skills", "Skills"],
  ["reputation", "Reputation"],
  ["quests", "Quests"],
  ["spells", "Spells"],
  ["pets", "Pets & Mail"],
] as const;
type Tab = (typeof TABS)[number][0];

// Paper doll: equipment slot indexes down the left and right edges, weapons along the bottom
const LEFT_SLOTS = [0, 1, 2, 14, 4, 3, 18, 8];
const RIGHT_SLOTS = [9, 5, 6, 7, 10, 11, 12, 13];
const WEAPON_SLOTS = [15, 16, 17];

// Rage for warriors, energy for rogues, mana for everyone else
const POWER: Record<number, [number, string, string, string]> = { 1: [1, "Rage", "#e0483c", "RG"], 4: [3, "Energy", "#f5d442", "EN"] };
const REP_COLORS = ["#cc2222", "#ff0000", "#ee6622", "#ffff00", "#00ff00", "#00ff88", "#00ffcc", "#00ffff"];

const heading = "text-sm font-bold uppercase tracking-wider text-white";

function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <h2 className={`${heading} mb-4 flex items-baseline gap-3 border-b border-white/15 pb-2`}>
      {children}
      {note !== undefined && <span className="text-xs font-normal normal-case tracking-normal text-gray-400">{note}</span>}
    </h2>
  );
}

function Bar({ value, max, color = "#f59e0b" }: { value: number; max: number; color?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden bg-white/10">
      <span className="block h-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </span>
  );
}

function SpellList({ spells }: { spells: SpellView[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {spells.map((s) => (
        <li key={s.id} className="flex items-center gap-3 text-sm">
          <Icon name={s.icon} size={56} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{s.name}</span>
            {s.rank && <span className="text-xs text-gray-400">{s.rank}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- character tab

function GearSlot({ label, item, align }: { label: string; item: ItemView | null; align: "left" | "right" | "center" }) {
  const enchant = item?.lines.find((l) => l.startsWith("Enchant: "))?.slice(9);
  const text = (
    <span className={`hidden min-w-0 flex-col lg:flex ${align === "right" ? "items-end text-right" : ""}`}>
      {item ? (
        <>
          <span className="max-w-52 truncate text-sm font-medium" style={{ color: QUALITY_COLORS[item.quality] }}>{item.name}</span>
          <span className="text-xs text-gray-400">
            {label}{item.itemLevel > 0 && ` · ${item.itemLevel}`}
          </span>
          {enchant && <span className="max-w-52 truncate text-xs text-emerald-300">{enchant}</span>}
        </>
      ) : (
        <span className="text-xs text-gray-600">{label}</span>
      )}
    </span>
  );
  return (
    <div className={`group relative flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""} ${item ? "" : "opacity-60"}`} title={item ? undefined : label}>
      <Icon name={item?.icon ?? null} size={56} border={item ? QUALITY_COLORS[item.quality] : undefined} />
      {align !== "center" && text}
      {item && <ItemTooltip item={item} side={align === "right" ? "left" : align === "center" ? "top" : "right"} />}
    </div>
  );
}

function StatTile({ label, value, color, glyph }: { label: string; value: React.ReactNode; color: string; glyph: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold"
        style={{ borderColor: color, color, boxShadow: `inset 0 0 0 3px #0b0e16, inset 0 0 0 4px ${color}55` }}
      >
        {glyph}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-base tabular-nums" style={{ color }}>{value}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-white">{label}</span>
      </span>
    </div>
  );
}

function CharacterTab({ d }: { d: Details }) {
  const c = d.character;
  const eq = d.inventory.equipment;
  const [powerIndex, powerName, powerColor, powerGlyph] = POWER[c.class] ?? [0, "Mana", "#4a9eff", "MP"];
  const power = c.vitals.powers[powerIndex];
  const s = d.stats;
  const pct = (v: number) => `${Number(v).toFixed(1)}%`;

  const tiles: [string, React.ReactNode, string, string][] = [
    ["Health", (s?.maxhealth ?? c.vitals.health).toLocaleString("en-US"), "#3ddc5a", "HP"],
    [powerName, (powerIndex === 1 ? power / 10 : power).toLocaleString("en-US"), powerColor, powerGlyph],
    ...(s
      ? ([
          ["Strength", s.strength, "#e0483c", "STR"], ["Agility", s.agility, "#f5d442", "AGI"],
          ["Stamina", s.stamina, "#f08a3c", "STA"], ["Intellect", s.intellect, "#c77dff", "INT"],
          ["Spirit", s.spirit, "#5ad1c9", "SPI"], ["Armor", s.armor.toLocaleString("en-US"), "#b0b7c3", "ARM"],
          ["Attack power", s.attackPower, "#e0483c", "AP"], ["Ranged power", s.rangedAttackPower, "#abd473", "RAP"],
          ["Critical strike", pct(s.critPct), "#ff5c7a", "CRT"], ["Dodge", pct(s.dodgePct), "#5ad1c9", "DDG"],
          ["Parry", pct(s.parryPct), "#f5d442", "PRY"], ["Block", pct(s.blockPct), "#b0b7c3", "BLK"],
        ] as [string, React.ReactNode, string, string][])
      : ([
          ["Honorable kills", c.honor.storedHonorableKills.toLocaleString("en-US"), "#e0483c", "HK"],
          ["Experience", c.xp.toLocaleString("en-US"), "#c77dff", "XP"],
        ] as [string, React.ReactNode, string, string][])),
  ];
  const resistances = s
    ? ([["Fire", s.resFire, "#f08a3c"], ["Nature", s.resNature, "#3ddc5a"], ["Frost", s.resFrost, "#69ccf0"], ["Shadow", s.resShadow, "#c77dff"], ["Arcane", s.resArcane, "#f5d442"]] as const).filter((r) => r[1] > 0)
    : [];

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-6">
        <div className="flex flex-col gap-2.5">
          {LEFT_SLOTS.map((i) => <GearSlot key={i} label={eq[i].label} item={eq[i].item} align="left" />)}
        </div>

        <div className="flex min-w-0 flex-col items-center justify-between gap-6">
          <div className="grid w-full max-w-md grid-cols-2 gap-x-6 gap-y-5 self-center pt-2">
            {tiles.map(([label, value, color, glyph]) => <StatTile key={label} label={label} value={value} color={color} glyph={glyph} />)}
          </div>
          {resistances.length > 0 && (
            <p className="flex flex-wrap justify-center gap-x-4 text-xs uppercase tracking-wide text-gray-400">
              {resistances.map(([name, value, color]) => (
                <span key={name}>{name} resistance <span style={{ color }}>{value}</span></span>
              ))}
            </p>
          )}
          {!s && (
            <p className="max-w-sm text-center text-xs text-gray-500">
              Attributes, armor and crit appear here after this character next logs out of a server running with
              PLAYER_SAVE_STATS_MIN_LEVEL ≥ 1. Health and {powerName.toLowerCase()} are the last saved values.
            </p>
          )}
          <div className="flex gap-2.5">
            {WEAPON_SLOTS.map((i) => <GearSlot key={i} label={eq[i].label} item={eq[i].item} align="center" />)}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {RIGHT_SLOTS.map((i) => <GearSlot key={i} label={eq[i].label} item={eq[i].item} align="right" />)}
        </div>
      </div>

      <section>
        <SectionTitle>Details</SectionTitle>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Account", `${d.account.name ?? `#${d.account.id}`}${d.account.isBot ? " (bot)" : ""}`],
            ["Location", `${zoneName(c.position.zone)}, ${mapName(c.position.map)}`],
            ["Hearthstone", c.homebind ? zoneName(c.homebind.zone) : "None"],
            ["Played", `${formatDuration(c.played.total)} (${formatDuration(c.played.level)} this level)`],
            ["Last seen", d.online ? "Online now" : c.rest.logoutTime ? new Date(c.rest.logoutTime * 1000).toISOString().slice(0, 16).replace("T", " ") : "Never"],
            ["Bank bag slots", c.bankBagSlots],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className={value === "Online now" ? "text-emerald-400" : ""}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {d.auras.length > 0 && (
        <section>
          <SectionTitle note={d.auras.length}>Active effects</SectionTitle>
          <SpellList spells={d.auras} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- other tabs

function Container({ title, size, slots, columns = 4 }: Details["inventory"]["bags"][number] & { columns?: number }) {
  const cells = Array.from({ length: Math.max(size, ...slots.map((s) => s.slot + 1)) }, (_, i) => slots.find((s) => s.slot === i)?.item ?? null);
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="grid w-max gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, auto)` }}>
        {cells.map((item, i) => <ItemSlot key={i} item={item} />)}
      </div>
    </div>
  );
}

function BagsTab({ d }: { d: Details }) {
  const bank = d.inventory.bank;
  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionTitle note={formatMoney(d.character.money)}>Bags</SectionTitle>
        <div className="flex flex-wrap gap-x-8 gap-y-6">
          {d.inventory.bags.map((bag) => <Container key={bag.title} {...bag} />)}
          {d.inventory.keyring.length > 0 && <Container title="Keyring" size={0} slots={d.inventory.keyring} />}
        </div>
      </section>
      <section>
        <SectionTitle>Bank</SectionTitle>
        {bank.some((b) => b.slots.length) ? (
          <div className="flex flex-wrap gap-x-8 gap-y-6">
            <Container {...bank[0]} columns={6} />
            {bank.slice(1).map((bag) => <Container key={bag.title} {...bag} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-500">The bank is empty.</p>
        )}
      </section>
    </div>
  );
}

function TalentsTab({ d }: { d: Details }) {
  const spent = d.talents.reduce((sum, t) => sum + t.points, 0);
  return (
    <section>
      <SectionTitle note={`${d.talents.map((t) => t.points).join(" / ")} · ${spent} points spent`}>Talents</SectionTitle>
      <div className="flex flex-wrap gap-x-12 gap-y-8">
        {d.talents.map((tab) => (
          <div key={tab.name}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-300">
              {tab.name} <span className="text-amber-400">{tab.points}</span>
            </h3>
            <div className="grid grid-cols-4 gap-4 border border-white/10 bg-black/30 p-4" style={{ gridTemplateRows: `repeat(${tab.rows}, auto)` }}>
              {tab.talents.map((t) => (
                <div
                  key={`${t.row}-${t.col}`}
                  title={`${t.name} ${t.rank}/${t.maxRank}`}
                  className={`relative ${t.rank ? "" : "opacity-30 grayscale"}`}
                  style={{ gridRow: t.row + 1, gridColumn: t.col + 1 }}
                >
                  <Icon name={t.icon} size={56} border={t.rank === t.maxRank ? "#f59e0b" : t.rank ? "#22c55e" : undefined} />
                  <span className="absolute -bottom-1.5 -right-1.5 bg-black px-1 text-xs tabular-nums" style={{ color: t.rank === t.maxRank ? "#f59e0b" : "#86efac" }}>
                    {t.rank}/{t.maxRank}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillsTab({ d }: { d: Details }) {
  return (
    <div className="flex flex-col gap-10">
      {d.skills.map((group) => (
        <section key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.skills.map((s) => (
              <li key={s.name} className="flex items-center gap-3 text-sm">
                <Icon name={s.icon} size={56} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex justify-between gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.max > 1 && <span className="shrink-0 tabular-nums text-gray-400">{s.value} / {s.max}</span>}
                  </span>
                  {s.max > 1 && <Bar value={s.value} max={s.max} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReputationTab({ d }: { d: Details }) {
  return (
    <section>
      <SectionTitle note={d.reputation.length}>Reputation</SectionTitle>
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {d.reputation.map((r) => (
          <li key={r.name} className="text-sm">
            <span className="mb-1 flex justify-between gap-2">
              <span className="truncate">{r.name}{r.atWar && <span className="ml-2 text-xs text-red-400">at war</span>}</span>
              <span className="shrink-0 text-xs" style={{ color: REP_COLORS[r.rankIndex] }}>
                {r.rank} <span className="text-gray-500">{r.value}/{r.max}</span>
              </span>
            </span>
            <Bar value={r.rankIndex === 7 ? 1 : r.value} max={r.rankIndex === 7 ? 1 : r.max} color={REP_COLORS[r.rankIndex]} />
          </li>
        ))}
      </ul>
      {d.reputation.length === 0 && <p className="text-sm text-gray-500">No known factions.</p>}
    </section>
  );
}

function QuestsTab({ d }: { d: Details }) {
  const active = d.quests.filter((x) => x.active);
  const done = d.quests.filter((x) => !x.active);
  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionTitle note={active.length}>Quest log</SectionTitle>
        {active.length ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {active.map((x) => (
              <li key={x.id} className="flex gap-3">
                <span className="w-8 text-right tabular-nums text-amber-400">{x.level > 0 ? x.level : ""}</span>
                <span>{x.title}</span>
                <span className={x.status === "Ready to turn in" ? "text-emerald-400" : "text-gray-500"}>{x.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">The quest log is empty.</p>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <SectionTitle note={done.length}>Completed</SectionTitle>
          <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {done.map((x) => <li key={x.id} className="truncate text-gray-300">{x.title}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function SpellsTab({ d }: { d: Details }) {
  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionTitle note={d.spells.length}>Spells and abilities</SectionTitle>
        {d.spells.length ? (
          <SpellList spells={d.spells} />
        ) : (
          <p className="text-sm text-gray-500">Only the default race and class spells, which the server does not store.</p>
        )}
      </section>
      {d.recipes.map((r) => (
        <section key={r.profession}>
          <SectionTitle note={r.spells.length}>{r.profession} recipes</SectionTitle>
          <SpellList spells={r.spells} />
        </section>
      ))}
    </div>
  );
}

function PetsTab({ d }: { d: Details }) {
  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionTitle note={d.pets.length}>Pets</SectionTitle>
        {d.pets.length === 0 && <p className="text-sm text-gray-500">No pets.</p>}
        <div className="flex flex-col gap-6">
          {d.pets.map((p, i) => (
            <div key={i}>
              <h3 className="mb-3 text-sm">
                <span className="font-bold text-amber-400">{p.name}</span>{" "}
                <span className="text-gray-400">
                  Level {p.level} {p.species} · {p.kind} · {p.where}
                  {p.loyalty !== null && ` · Loyalty ${p.loyalty} · ${p.trainingPoints} training points`}
                </span>
              </h3>
              <SpellList spells={p.spells} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle note={d.mail.length}>Mailbox</SectionTitle>
        {d.mail.length === 0 && <p className="text-sm text-gray-500">The mailbox is empty.</p>}
        <ul className="flex flex-col gap-2.5 text-sm">
          {d.mail.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3">
              <span className="w-32 shrink-0 text-gray-400">{m.from}</span>
              <span>{m.subject || "(no subject)"}</span>
              {m.money > 0 && <span className="text-amber-300">{formatMoney(m.money)}</span>}
              {m.cod > 0 && <span className="text-red-300">COD {formatMoney(m.cod)}</span>}
              <span className="flex gap-1">{m.items.map((item) => <ItemSlot key={item.ref} item={item} />)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- page

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ guid: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const guid = Number((await params).guid);
  const d = Number.isInteger(guid) && guid > 0 ? await getCharacterDetails(guid) : null;
  if (!d) notFound();
  const c = d.character;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.some(([id]) => id === requested) ? (requested as Tab) : "character";

  // Shirt and tabard do not count, as in the game's own average
  const levels = d.inventory.equipment.filter((s, i) => s.item && i !== 3 && i !== 18).map((s) => s.item!.itemLevel);
  const itemLevel = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0;
  const alliance = factionOf(c.race) === "alliance";

  return (
    <div
      className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] px-4 pb-16"
      style={{
        background: `radial-gradient(60rem 28rem at 50% -6rem, ${alliance ? "rgba(40,90,190,0.35)" : "rgba(170,40,30,0.32)"}, transparent 70%), linear-gradient(#0b0e16, #07090e)`,
      }}
    >
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-block pt-5 text-xs uppercase tracking-wide text-gray-400 hover:text-white">← All characters</Link>

        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-5 pt-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight" style={{ color: CLASS_COLORS[c.class] }}>{c.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-5 text-lg text-amber-400">
              {itemLevel > 0 && <span>{itemLevel} ILVL</span>}
              <span>{formatMoney(c.money)}</span>
              <span>{c.honor.storedHonorableKills} HK</span>
            </p>
            <p className="mt-1 text-sm text-white">
              {c.level} {RACES[c.race]} {CLASSES[c.class]}
              {d.guild && <span className="text-amber-400"> ❮{d.guild}❯</span>}
              <span className={alliance ? " text-sky-300" : " text-red-300"}> {alliance ? "Alliance" : "Horde"}</span>
              {d.online && <span className="text-emerald-400"> · Online</span>}
            </p>
          </div>
          <a href={`/api/characters/${d.guid}/export`} download className="btn btn-primary ml-auto">Export JSON</a>
        </header>

        <nav className="mb-8 flex gap-6 overflow-x-auto border-b border-white/15 [scrollbar-width:none]">
          {TABS.map(([id, label]) => (
            <Link
              key={id}
              href={id === "character" ? `/characters/${d.guid}` : `/characters/${d.guid}?tab=${id}`}
              scroll={false}
              className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-bold uppercase tracking-wide ${
                tab === id ? "border-amber-400 text-white" : "border-transparent text-amber-400 hover:text-amber-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === "character" && <CharacterTab d={d} />}
        {tab === "bags" && <BagsTab d={d} />}
        {tab === "talents" && <TalentsTab d={d} />}
        {tab === "skills" && <SkillsTab d={d} />}
        {tab === "reputation" && <ReputationTab d={d} />}
        {tab === "quests" && <QuestsTab d={d} />}
        {tab === "spells" && <SpellsTab d={d} />}
        {tab === "pets" && <PetsTab d={d} />}
      </div>
    </div>
  );
}

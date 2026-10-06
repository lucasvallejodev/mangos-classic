import enchants from "@/data/enchants.json";
import factions from "@/data/factions.json";
import itemIcons from "@/data/item-icons.json";
import randomProperties from "@/data/random-properties.json";
import recipeSkills from "@/data/recipe-skills.json";
import skillLines from "@/data/skills.json";
import spellIcons from "@/data/spell-icons.json";
import talentTabs from "@/data/talent-tabs.json";
import talentData from "@/data/talents.json";
import { C, R, W, q, type Row } from "./db";
import { env } from "./env";
import { exportCharacter } from "./export";
import type { CharacterFile } from "./format";

type Dict<T> = Record<string, T>;
const n = (v: unknown) => Number(v ?? 0);
const ids = (list: number[]) => (list.length ? [...new Set(list)] : [0]);

export const EQUIPMENT_SLOTS = [
  "Head", "Neck", "Shoulders", "Shirt", "Chest", "Waist", "Legs", "Feet", "Wrists", "Hands",
  "Finger", "Finger", "Trinket", "Trinket", "Back", "Main hand", "Off hand", "Ranged", "Tabard",
];

const STAT_NAMES: Dict<string> = { 0: "Mana", 1: "Health", 3: "Agility", 4: "Strength", 5: "Intellect", 6: "Spirit", 7: "Stamina" };
const RESISTANCES = ["holy", "fire", "nature", "frost", "shadow", "arcane"];
const SKILL_CATEGORIES: [number, string][] = [
  [11, "Professions"], [9, "Secondary skills"], [6, "Weapon skills"], [8, "Armor proficiencies"], [10, "Languages"], [7, "Class skills"],
];
const AUCTION_RESULTS = ["Outbid on", "Auction won:", "Auction successful:", "Auction expired:", "Auction cancelled:", "Auction cancelled:"];

// Reputation ranks, lowest first, with the number of points each one spans (ReputationMgr::PointsInRank)
const REP_RANKS: [string, number][] = [
  ["Hated", 36000], ["Hostile", 3000], ["Unfriendly", 3000], ["Neutral", 3000],
  ["Friendly", 6000], ["Honored", 12000], ["Revered", 21000], ["Exalted", 1000],
];

export interface ItemView {
  ref: number;
  entry: number;
  name: string;
  quality: number;
  icon: string | null;
  count: number;
  itemLevel: number;
  requiredLevel: number;
  bagSlots: number;
  suffix: string | null;
  soulbound: boolean;
  lines: string[]; // tooltip body: armor, damage, stats, enchants...
}

export interface SpellView {
  id: number;
  name: string;
  rank: string;
  icon: string | null;
}

export interface TalentView {
  row: number;
  col: number;
  name: string;
  icon: string | null;
  rank: number;
  maxRank: number;
}

export async function getCharacterDetails(guid: number) {
  const file = await exportCharacter(guid);
  if (!file) return null;
  const c = file.character;

  const [meta] = await q(
    `SELECT c.online, c.account, a.username, COALESCE(a.username LIKE ?, 0) isBot
     FROM ${C}.characters c LEFT JOIN ${R}.account a ON a.id = c.account WHERE c.guid = ?`,
    [`${env.botAccountPrefix}%`, guid],
  );

  // ---- items
  const templates = new Map(
    (await q(`SELECT * FROM ${W}.item_template WHERE entry IN (?)`, [ids(file.items.map((i) => i.entry))])).map((t) => [n(t.entry), t]),
  );
  const items = new Map(file.items.map((it) => [it.ref, itemView(it, templates.get(it.entry))]));
  const at = (bag: number | null, from: number, to: number) =>
    file.inventory
      .filter((s) => s.bag === bag && s.slot >= from && s.slot < to)
      .map((s) => ({ slot: s.slot - from, item: items.get(s.item)! }));
  const containers = (from: number, to: number, label: string) =>
    at(null, from, to).map(({ slot, item }) => ({
      title: `${label} ${slot + 1}: ${item.name}`,
      size: item.bagSlots,
      slots: at(item.ref, 0, 255),
    }));
  const inventory = {
    equipment: EQUIPMENT_SLOTS.map((label, slot) => ({ label, item: at(null, slot, slot + 1)[0]?.item ?? null })),
    bags: [{ title: "Backpack", size: 16, slots: at(null, 23, 39) }, ...containers(19, 23, "Bag")],
    bank: [{ title: "Bank", size: 24, slots: at(null, 39, 63) }, ...containers(63, 69, "Bank bag")],
    keyring: at(null, 81, 97),
  };

  // ---- spells and talents
  const myTabs = Object.entries(talentTabs as Dict<{ name: string; classMask: number; order: number }>)
    .filter(([, t]) => t.classMask & (1 << (c.class - 1)))
    .sort((a, b) => a[1].order - b[1].order);
  const myTalents = Object.values(talentData as Dict<{ tab: number; row: number; col: number; ranks: number[] }>).filter((t) =>
    myTabs.some(([id]) => Number(id) === t.tab),
  );
  const known = new Set(file.spells.filter((s) => !n(s.disabled)).map((s) => n(s.spell)));
  const petSpellIds = file.pets.flatMap((p) => p.spells.map((s) => n(s.spell)));
  const spellRows = new Map(
    (
      await q(`SELECT Id, SpellName, Rank1, SpellIconID, Attributes FROM ${W}.spell_template WHERE Id IN (?)`, [
        ids([...known, ...myTalents.flatMap((t) => t.ranks), ...petSpellIds, ...file.auras.map((a) => n(a.spell))]),
      ])
    ).map((s) => [n(s.Id), s]),
  );
  const spellView = (id: number): SpellView => {
    const s = spellRows.get(id);
    return {
      id,
      name: s ? String(s.SpellName) : `Spell ${id}`,
      rank: s ? String(s.Rank1 ?? "") : "",
      icon: s ? ((spellIcons as Dict<string>)[n(s.SpellIconID)] ?? null) : null,
    };
  };

  const talentSpells = new Set(myTalents.flatMap((t) => t.ranks));
  const talents = myTabs.map(([id, tab]) => {
    const list: TalentView[] = myTalents
      .filter((t) => t.tab === Number(id))
      .map((t) => {
        const rank = t.ranks.reduce((best, spell, i) => (known.has(spell) ? i + 1 : best), 0);
        const view = spellView(t.ranks[Math.max(rank, 1) - 1]);
        return { row: t.row, col: t.col, name: view.name, icon: view.icon, rank, maxRank: t.ranks.length };
      });
    return { name: tab.name, points: list.reduce((sum, t) => sum + t.rank, 0), rows: Math.max(...list.map((t) => t.row)) + 1, talents: list };
  });

  // Hide passives (0x40) and spells the client never shows (0x80); talents have their own section
  const byName = (a: SpellView, b: SpellView) => a.name.localeCompare(b.name) || a.id - b.id;
  const shown = [...known].filter((id) => !talentSpells.has(id) && !(n(spellRows.get(id)?.Attributes) & 0xc0));
  const recipeSkill = (id: number) => (recipeSkills as Dict<number>)[id];
  const spells = shown.filter((id) => !recipeSkill(id)).map(spellView).sort(byName);
  // Profession spells are mostly recipes; list them per profession
  const recipes = [...new Set(shown.map(recipeSkill).filter(Boolean))]
    .map((skill) => ({
      profession: (skillLines as Dict<{ name: string }>)[skill]?.name ?? `Skill ${skill}`,
      spells: shown.filter((id) => recipeSkill(id) === skill).map(spellView).sort(byName),
    }))
    .sort((a, b) => a.profession.localeCompare(b.profession));

  // ---- skills
  const skills = SKILL_CATEGORIES.map(([category, title]) => ({
    title,
    skills: file.skills
      .map((s) => ({ ...(skillLines as Dict<{ name: string; category: number }>)[n(s.skill)], value: n(s.value), max: n(s.max) }))
      .filter((s) => s.category === category && s.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.skills.length);

  // ---- reputation: the DB stores the offset from a race/class dependent base value
  const raceBit = 1 << (c.race - 1), classBit = 1 << (c.class - 1);
  const reputation = file.reputation
    .filter((r) => n(r.flags) & 0x01) // FACTION_FLAG_VISIBLE
    .flatMap((r) => {
      const f = (factions as Dict<{ name: string; raceMask: number[]; classMask: number[]; base: number[] }>)[n(r.faction)];
      if (!f) return [];
      const i = [0, 1, 2, 3].find(
        (k) => (f.raceMask[k] & raceBit || (f.raceMask[k] === 0 && f.classMask[k] !== 0)) && (f.classMask[k] & classBit || f.classMask[k] === 0),
      );
      let left = (i === undefined ? 0 : f.base[i]) + n(r.standing) + 42000;
      let rank = 0;
      while (rank < REP_RANKS.length - 1 && left >= REP_RANKS[rank][1]) left -= REP_RANKS[rank++][1];
      return [{ name: f.name, rank: REP_RANKS[rank][0], rankIndex: rank, value: Math.max(0, left), max: REP_RANKS[rank][1], atWar: !!(n(r.flags) & 0x02) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---- quests
  const questRows = new Map(
    (await q(`SELECT entry, Title, QuestLevel FROM ${W}.quest_template WHERE entry IN (?)`, [ids(file.quests.map((x) => n(x.quest)))])).map((r) => [n(r.entry), r]),
  );
  const quests = file.quests
    .map((x) => {
      const t = questRows.get(n(x.quest));
      const status = n(x.rewarded) ? "Completed" : n(x.status) === 1 ? "Ready to turn in" : n(x.status) === 5 ? "Failed" : n(x.status) === 3 ? "In progress" : "Other";
      return { id: n(x.quest), title: t ? String(t.Title) : `Quest ${x.quest}`, level: n(t?.QuestLevel), status, active: !n(x.rewarded) };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.level - b.level || a.title.localeCompare(b.title));

  // ---- pets
  const creatures = new Map(
    (await q(`SELECT Entry, Name FROM ${W}.creature_template WHERE Entry IN (?)`, [
      ids([...file.pets.map((p) => p.entry), ...file.mail.filter((m) => m.messageType === 3).map((m) => n(m.sender))]),
    ])).map((r) => [n(r.Entry), String(r.Name)]),
  );
  const pets = file.pets.map((p) => ({
    name: p.name,
    level: p.level,
    species: creatures.get(p.entry) ?? `Creature ${p.entry}`,
    kind: n(p.PetType) === 1 ? "Hunter pet" : "Summoned",
    where: n(p.slot) === 0 ? "Active" : n(p.slot) <= 2 ? `Stable slot ${p.slot}` : "Not summoned",
    loyalty: n(p.PetType) === 1 ? n(p.loyalty) : null,
    trainingPoints: n(p.PetType) === 1 ? n(p.trainpoint) : null,
    spells: p.spells.map((s) => spellView(n(s.spell))).sort((a, b) => a.name.localeCompare(b.name)),
  }));

  // ---- mail
  const mailItemNames = new Map(
    (await q(`SELECT entry, name FROM ${W}.item_template WHERE entry IN (?)`, [
      ids(file.mail.filter((m) => m.messageType === 2).map((m) => Number(String(m.subject).split(":")[0]) || 0)),
    ])).map((r) => [n(r.entry), String(r.name)]),
  );
  const mail = file.mail.map((m) => {
    let subject = m.subject ?? "";
    let from = "Unknown";
    if (m.messageType === 2) {
      // auction mail encodes "item:randomProperty:result" in the subject
      const [entry, , result] = subject.split(":").map(Number);
      subject = `${AUCTION_RESULTS[result] ?? "Auction:"} ${mailItemNames.get(entry) ?? `item ${entry}`}`;
      from = "Auction House";
    } else if (m.messageType === 3) from = creatures.get(n(m.sender)) ?? "NPC";
    else if (m.messageType === 0 && m.sender && typeof m.sender === "object")
      from = "self" in m.sender ? c.name : (m.sender.name ?? "Unknown player");
    return { from, subject, money: m.money, cod: m.cod, items: m.items.map((ref) => items.get(ref)!).filter(Boolean) };
  });

  const auras = file.auras.map((a) => spellView(n(a.spell))).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i);

  return {
    guid,
    character: c,
    online: !!n(meta?.online),
    account: { id: n(meta?.account), name: (meta?.username as string) ?? null, isBot: !!n(meta?.isBot) },
    guild: file.display?.guild ? String(file.display.guild.name) : null,
    stats: (file.display?.stats ?? null) as Dict<number> | null,
    inventory,
    talents,
    spells,
    recipes,
    skills,
    reputation,
    quests,
    pets,
    mail,
    auras,
  };
}

export type CharacterDetails = NonNullable<Awaited<ReturnType<typeof getCharacterDetails>>>;

function itemView(it: CharacterFile["items"][number], t: Row | undefined): ItemView {
  const suffix = it.randomPropertyId > 0 ? ((randomProperties as Dict<string>)[it.randomPropertyId] ?? null) : null;
  const base = {
    ref: it.ref, entry: it.entry, count: it.count, suffix, soulbound: !!(it.flags & 0x01),
  };
  if (!t)
    return { ...base, name: `Unknown item ${it.entry}`, quality: 0, icon: null, itemLevel: 0, requiredLevel: 0, bagSlots: 0, lines: ["Not in this server's item database"] };

  const lines: string[] = [];
  if (base.soulbound) lines.push("Soulbound");
  if (n(t.ContainerSlots)) lines.push(`${t.ContainerSlots} slot bag`);
  if (n(t.dmg_max1)) {
    const speed = n(t.delay) / 1000;
    lines.push(`${Math.round(n(t.dmg_min1))} - ${Math.round(n(t.dmg_max1))} damage, speed ${speed.toFixed(2)}`);
    if (speed) lines.push(`(${((n(t.dmg_min1) + n(t.dmg_max1)) / 2 / speed).toFixed(1)} damage per second)`);
  }
  if (n(t.armor)) lines.push(`${t.armor} Armor`);
  if (n(t.block)) lines.push(`${t.block} Block`);
  for (let i = 1; i <= 10; i++) {
    const value = n(t[`stat_value${i}`]);
    if (value) lines.push(`${value > 0 ? "+" : ""}${value} ${STAT_NAMES[n(t[`stat_type${i}`])] ?? "stat"}`);
  }
  for (const r of RESISTANCES) if (n(t[`${r}_res`])) lines.push(`+${t[`${r}_res`]} ${r[0].toUpperCase()}${r.slice(1)} Resistance`);
  // slots 0-1 are real enchants; 3-6 hold what the random suffix grants
  for (const e of it.enchantments) {
    const name = (enchants as Dict<string>)[e.id];
    if (name) lines.push(e.slot === 1 ? `${name} (temporary)` : e.slot === 0 ? `Enchant: ${name}` : name);
  }
  if (n(t.MaxDurability)) lines.push(`Durability ${it.durability} / ${t.MaxDurability}`);
  if (n(t.RequiredLevel) > 1) lines.push(`Requires level ${t.RequiredLevel}`);
  if (t.description) lines.push(`"${t.description}"`);

  return {
    ...base,
    name: String(t.name) + (suffix ? ` ${suffix}` : ""),
    quality: n(t.Quality),
    icon: (itemIcons as Dict<string>)[n(t.displayid)] ?? null,
    itemLevel: n(t.ItemLevel),
    requiredLevel: n(t.RequiredLevel),
    bagSlots: n(t.ContainerSlots),
    lines,
  };
}

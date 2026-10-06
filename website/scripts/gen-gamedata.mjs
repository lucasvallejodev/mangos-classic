// Generates src/data/areas.json and maps.json from the client DBC files in ../data/dbc.
// Run: npm run gamedata
import { readFileSync, writeFileSync } from "node:fs";

function readDbc(file) {
  const b = readFileSync(file);
  if (b.toString("latin1", 0, 4) !== "WDBC") throw new Error(`${file}: not a DBC file`);
  const [records, fields, recordSize, stringSize] = [4, 8, 12, 16].map((o) => b.readUInt32LE(o));
  const strings = b.subarray(20 + records * recordSize, 20 + records * recordSize + stringSize);
  const str = (off) => strings.toString("utf8", off, strings.indexOf(0, off));
  const rows = [];
  for (let i = 0; i < records; i++) {
    const base = 20 + i * recordSize;
    rows.push({ u32: (f) => b.readUInt32LE(base + f * 4), str: (f) => str(b.readUInt32LE(base + f * 4)) });
  }
  return { rows, fields };
}

const dbc = new URL("../../data/dbc/", import.meta.url);
const out = new URL("../src/data/", import.meta.url);

// AreaTable.dbc (1.12): 0 id, 1 map, 2 parent zone, 11 name (enUS)
const areas = {};
for (const r of readDbc(new URL("AreaTable.dbc", dbc)).rows) areas[r.u32(0)] = r.str(11);
writeFileSync(new URL("areas.json", out), JSON.stringify(areas));

// Map.dbc (1.12): 0 id, 4 name (enUS)
const maps = {};
for (const r of readDbc(new URL("Map.dbc", dbc)).rows) maps[r.u32(0)] = r.str(4);
writeFileSync(new URL("maps.json", out), JSON.stringify(maps));

// ---- lookups for the character detail page
const table = (file, fn) => {
  const out = {};
  for (const r of readDbc(new URL(file, dbc)).rows) {
    const v = fn(r);
    if (v !== undefined) out[r.u32(0)] = v;
  }
  return out;
};
const save = (name, data) => {
  writeFileSync(new URL(name, out), JSON.stringify(data));
  return `${name}: ${Object.keys(data).length}`;
};
const iconName = (path) => path.split("\\").pop().toLowerCase();
const range = (r, from, n) => Array.from({ length: n }, (_, i) => r.u32(from + i) | 0);

const report = [
  // SkillLine.dbc: 1 category, 3 name
  save("skills.json", table("SkillLine.dbc", (r) => ({ name: r.str(3), category: r.u32(1) }))),
  // Faction.dbc: 1 reputation list id (-1 = no reputation), 2-5 race masks, 6-9 class masks, 10-13 base values, 19 name
  save("factions.json", table("Faction.dbc", (r) =>
    (r.u32(1) | 0) < 0 ? undefined
      : { name: r.str(19), raceMask: range(r, 2, 4), classMask: range(r, 6, 4), base: range(r, 10, 4) })),
  // ItemDisplayInfo.dbc: 5 inventory icon
  save("item-icons.json", table("ItemDisplayInfo.dbc", (r) => r.str(5).toLowerCase() || undefined)),
  // SpellIcon.dbc: 1 texture path
  save("spell-icons.json", table("SpellIcon.dbc", (r) => iconName(r.str(1)) || undefined)),
  // SpellItemEnchantment.dbc: 13 name
  save("enchants.json", table("SpellItemEnchantment.dbc", (r) => r.str(13) || undefined)),
  // ItemRandomProperties.dbc: 7 name suffix
  save("random-properties.json", table("ItemRandomProperties.dbc", (r) => r.str(7) || undefined)),
  // TalentTab.dbc: 1 name, 12 class mask, 13 tab order
  save("talent-tabs.json", table("TalentTab.dbc", (r) => ({ name: r.str(1), classMask: r.u32(12), order: r.u32(13) }))),
  // Talent.dbc: 1 tab, 2 row, 3 column, 4-8 rank spells
  save("talents.json", table("Talent.dbc", (r) =>
    ({ tab: r.u32(1), row: r.u32(2), col: r.u32(3), ranks: range(r, 4, 5).filter(Boolean) }))),
];

// SkillLineAbility.dbc: 1 skill, 2 spell. Kept for professions only, to tell recipes from abilities.
const skills = JSON.parse(readFileSync(new URL("skills.json", out)));
const recipes = {};
for (const r of readDbc(new URL("SkillLineAbility.dbc", dbc)).rows)
  if ([9, 11].includes(skills[r.u32(1)]?.category)) recipes[r.u32(2)] = r.u32(1);
report.push(save("recipe-skills.json", recipes));
console.log(report.join(", "));
console.log(`areas: ${Object.keys(areas).length}, maps: ${Object.keys(maps).length}`);

import areas from "@/data/areas.json";
import maps from "@/data/maps.json";

export const RACES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll",
};

export const CLASSES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};

export const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569", 5: "#FFFFFF", 7: "#0070DE", 8: "#69CCF0", 9: "#9482C9", 11: "#FF7D0A",
};

export type Faction = "alliance" | "horde";
export const ALLIANCE_RACES = [1, 3, 4, 7];
export const HORDE_RACES = [2, 5, 6, 8];
export const factionOf = (race: number): Faction => (ALLIANCE_RACES.includes(race) ? "alliance" : "horde");

export const zoneName = (id: number) => (areas as Record<string, string>)[id] ?? (id ? `Zone ${id}` : "Unknown");
export const mapName = (id: number) => (maps as Record<string, string>)[id] ?? `Map ${id}`;

export function formatMoney(copper: number) {
  const g = Math.floor(copper / 10000), s = Math.floor((copper % 10000) / 100), c = copper % 100;
  return [g ? `${g}g` : "", g || s ? `${s}s` : "", `${c}c`].filter(Boolean).join(" ");
}

export function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

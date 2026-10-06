import { z } from "zod";

// Character export file, version 1. Shape documented in temp/character-export-import-research.md.
export const FORMAT = "cmangos-classic-character";
export const VERSION = 1;

const int = z.number().int();
const num = z.number();
// Plain table rows: column -> scalar. Columns are whitelisted again on import.
const row = z.record(z.string(), z.union([z.number(), z.string(), z.null()]));
// A reference to a player: only "the character itself" survives a transfer.
const playerRef = z.union([z.object({ self: z.literal(true) }), z.object({ name: z.string().nullable() })]).nullable();

const item = z.object({
  ref: int,
  entry: int,
  count: int,
  duration: int,
  charges: z.array(int).max(5),
  flags: int,
  enchantments: z.array(z.object({ slot: int.min(0).max(6), id: int, duration: int, charges: int })),
  randomPropertyId: int,
  durability: int,
  creator: playerRef,
  giftCreator: playerRef,
  text: z.string().nullable(),
  loot: z.array(z.object({ itemid: int, amount: int, property: int })),
  gift: z.object({ entry: int, flags: int }).nullable(),
});

// Remaining character_pet columns ride along as extra keys; import whitelists them.
const pet = z
  .looseObject({
    entry: int,
    name: z.string(),
    level: int,
    actionBar: z.array(z.object({ type: int, action: int })),
    teachSpells: z.array(int),
    spells: z.array(row),
    spellCooldowns: z.array(row),
    auras: z.array(row),
  });

const mail = z.object({
  messageType: int,
  stationery: int,
  mailTemplateId: int,
  sender: z.union([int, playerRef]),
  subject: z.string().nullable(),
  expire_time: int,
  deliver_time: int,
  money: int,
  cod: int,
  checked: int,
  body: z.string().nullable(),
  items: z.array(int),
});

export const characterFile = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  source: z.object({
    core: z.string(),
    characterDbVersion: z.string().nullable(),
    exportedAt: int,
    originalGuid: int,
  }),
  character: z.object({
    name: z.string(),
    race: int,
    class: int,
    gender: int,
    level: int,
    xp: int,
    money: int,
    appearance: z.object({ skin: int, face: int, hairStyle: int, hairColor: int, facialHair: int }),
    bankBagSlots: int,
    playerBytes: int,
    playerBytes2: int,
    playerFlags: int,
    position: z.object({ map: int, zone: int, x: num, y: num, z: num, o: num }),
    homebind: z.object({ map: int, zone: int, x: num, y: num, z: num }).nullable(),
    played: z.object({ total: int, level: int }),
    rest: z.object({ bonus: num, isLogoutResting: int, logoutTime: int }),
    talentReset: z.object({ cost: int, time: int }),
    taxi: z.object({ mask: z.array(int), path: z.string().nullable() }),
    exploredZones: z.array(int),
    honor: z.object({
      highestRank: int,
      standing: int,
      storedRating: num,
      storedDishonorableKills: int,
      storedHonorableKills: int,
    }),
    vitals: z.object({ health: int, powers: z.array(int).length(5) }),
    ammoId: int,
    actionBars: int,
    stableSlots: int,
    watchedFaction: int,
    drunk: int,
    fishingSteps: int,
    cinematic: int,
    extraFlags: int,
    atLogin: int,
    deathExpireTime: int,
  }),
  skills: z.array(row),
  forgottenSkills: z.array(row),
  spells: z.array(row),
  spellCooldowns: z.array(row),
  actions: z.array(row),
  auras: z.array(row),
  reputation: z.array(row),
  quests: z.array(row),
  questsWeekly: z.array(int),
  honorCp: z.array(row),
  items: z.array(item),
  inventory: z.array(z.object({ bag: int.nullable(), slot: int, item: int })),
  pets: z.array(pet),
  mail: z.array(mail),
  // Never imported
  display: z.object({ guild: row.nullable(), stats: row.nullable() }).optional(),
});

export type CharacterFile = z.infer<typeof characterFile>;

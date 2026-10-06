import type { PoolConnection } from "mysql2/promise";
import { C, R, W, pool, q } from "./db";
import { env } from "./env";
import { getCharacterDbVersion } from "./export";
import type { CharacterFile } from "./format";
import { factionOf, ALLIANCE_RACES, HORDE_RACES } from "./gamedata";
import { checkName, type NameCheck } from "./names";
import { isWorldServerRunning } from "./server-status";

type Scalar = number | string | null;
type Values = Record<string, Scalar | undefined>;

// Columns accepted from the file for the pass-through tables. Keys in the JSON are
// never trusted as column names.
const COLUMNS = {
  character_skills: ["skill", "value", "max"],
  character_forgotten_skills: ["skill", "value"],
  character_spell: ["spell", "active", "disabled"],
  character_spell_cooldown: ["SpellId", "SpellExpireTime", "Category", "CategoryExpireTime", "ItemId"],
  character_action: ["button", "action", "type"],
  character_reputation: ["faction", "standing", "flags"],
  character_queststatus: [
    "quest", "status", "rewarded", "explored", "timer", "mobcount1", "mobcount2", "mobcount3", "mobcount4",
    "itemcount1", "itemcount2", "itemcount3", "itemcount4",
  ],
  character_aura: [
    "spell", "stackcount", "remaincharges", "basepoints0", "basepoints1", "basepoints2",
    "periodictime0", "periodictime1", "periodictime2", "maxduration", "remaintime", "effIndexMask",
  ],
  character_pet: [
    "entry", "modelid", "CreatedBySpell", "PetType", "level", "exp", "Reactstate", "loyaltypoints", "loyalty",
    "xpForNextLoyalty", "trainpoint", "name", "renamed", "slot", "curhealth", "curmana", "curhappiness", "savetime",
    "resettalents_cost", "resettalents_time",
  ],
  pet_spell: ["spell", "active"],
  pet_spell_cooldown: ["spell", "time"],
} as const;

// MyISAM in the stock schema: a rollback does not undo them, so they are written last.
const NON_TRANSACTIONAL = ["character_spell_cooldown", "character_forgotten_skills"];

const isScalar = (v: unknown): v is Scalar => v === null || typeof v === "number" || typeof v === "string";
const pick = (row: Record<string, unknown>, table: keyof typeof COLUMNS): Values =>
  Object.fromEntries(COLUMNS[table].filter((c) => isScalar(row[c])).map((c) => [c, row[c] as Scalar]));

const isSelf = (ref: unknown) => !!ref && typeof ref === "object" && "self" in ref;

// Player mail has a sender that means nothing on another server, and COD mail owes money to them.
const isPortableMail = (m: CharacterFile["mail"][number]) => m.messageType !== 0 && !m.cod;

export interface ImportPreview {
  summary: {
    name: string;
    race: number;
    class: number;
    level: number;
    money: number;
    zone: number;
    items: number;
    spells: number;
    quests: number;
    pets: number;
    mail: number;
    mailSkipped: number;
    exportedAt: number;
  };
  worldServerRunning: boolean;
  name: NameCheck;
  errors: string[];
  warnings: string[];
}

export async function previewImport(file: CharacterFile, accountId?: number, name?: string): Promise<ImportPreview> {
  const c = file.character;
  const errors: string[] = [];
  const warnings: string[] = [];

  const worldServerRunning = await isWorldServerRunning();
  if (worldServerRunning) errors.push("The world server is running. Stop mangosd before importing.");

  const dbVersion = await getCharacterDbVersion();
  if (file.source.characterDbVersion !== dbVersion)
    warnings.push("This file was exported from a different character database version.");

  const entries = [...new Set(file.items.map((i) => i.entry))];
  if (entries.length) {
    const known = new Set(
      (await q<{ entry: number }>(`SELECT entry FROM ${W}.item_template WHERE entry IN (?)`, [entries])).map((r) => r.entry),
    );
    const missing = entries.filter((e) => !known.has(e));
    if (missing.length)
      warnings.push(`${missing.length} item type(s) do not exist on this server and will be deleted at login: ${missing.join(", ")}`);
  }

  const mailSkipped = file.mail.filter((m) => !isPortableMail(m)).length;
  if (mailSkipped) warnings.push(`${mailSkipped} player/COD mail(s) and their attachments will not be imported.`);

  if (accountId !== undefined) {
    const [account] = await q(`SELECT id FROM ${R}.account WHERE id = ?`, [accountId]);
    if (!account) errors.push("Target account does not exist.");
    else {
      const [counts] = await q<{ total: number; alliance: number; horde: number }>(
        `SELECT COUNT(*) total, COALESCE(SUM(race IN (?)), 0) alliance, COALESCE(SUM(race IN (?)), 0) horde
         FROM ${C}.characters WHERE account = ? AND deleteDate IS NULL`,
        [ALLIANCE_RACES, HORDE_RACES, accountId],
      );
      if (Number(counts.total) >= env.charactersPerRealm)
        errors.push(`Target account already has ${counts.total} characters (limit ${env.charactersPerRealm}).`);
      const other = factionOf(c.race) === "alliance" ? Number(counts.horde) : Number(counts.alliance);
      if (other > 0 && !env.allowTwoSideAccounts)
        warnings.push("Target account has characters of the opposite faction. PvP realms refuse mixed accounts unless AllowTwoSide.Accounts is on.");
    }
  }

  const nameCheck = await checkName(name ?? c.name);

  return {
    summary: {
      name: c.name, race: c.race, class: c.class, level: c.level, money: c.money, zone: c.position.zone,
      items: file.items.length, spells: file.spells.length, quests: file.quests.length, pets: file.pets.length,
      mail: file.mail.length, mailSkipped, exportedAt: file.source.exportedAt,
    },
    worldServerRunning,
    name: nameCheck,
    errors,
    warnings,
  };
}

export class ImportError extends Error {
  constructor(message: string, public code: "name" | "blocked") {
    super(message);
  }
}

async function insert(conn: PoolConnection, table: string, values: Values) {
  const cols = Object.keys(values).filter((k) => values[k] !== undefined);
  await conn.query(`INSERT INTO ${C}.?? (??) VALUES (?)`, [table, cols, cols.map((k) => values[k])]);
}

async function nextId(conn: PoolConnection, table: string, column: string) {
  const [row] = await q<{ next: number | null }>(`SELECT MAX(??) + 1 next FROM ${C}.??`, [column, table], conn);
  return Number(row.next ?? 1);
}

export async function importCharacter(file: CharacterFile, accountId: number, requestedName: string) {
  const conn = await pool.getConnection();
  let locked = false;
  let newGuid = 0;
  try {
    const [lock] = await q<{ l: number }>("SELECT GET_LOCK('character_import', 10) l", [], conn);
    if (!lock.l) throw new ImportError("Another import is in progress.", "blocked");
    locked = true;

    // Re-run every check now that we hold the lock; the preview may be stale.
    const preview = await previewImport(file, accountId, requestedName);
    if (preview.errors.length) throw new ImportError(preview.errors[0], "blocked");

    await conn.beginTransaction();
    const name = await checkName(requestedName, conn);
    if (!name.ok) throw new ImportError(name.reason ?? "Invalid name.", "name");

    const c = file.character;
    const guid = (newGuid = await nextId(conn, "characters", "guid"));
    let nextItem = await nextId(conn, "item_instance", "guid");
    let nextMail = await nextId(conn, "mail", "id");
    let nextText = await nextId(conn, "item_text", "id");
    let nextPet = await nextId(conn, "character_pet", "id");
    const deferred: [string, Values][] = [];
    const put = async (table: string, values: Values) =>
      NON_TRANSACTIONAL.includes(table) ? void deferred.push([table, values]) : insert(conn, table, values);
    const text = async (body: string | null) => {
      if (body === null) return 0;
      await insert(conn, "item_text", { id: nextText, text: body });
      return nextText++;
    };
    const list = (values: number[]) => values.join(" ") + " ";

    const p = c.position;
    await insert(conn, "characters", {
      guid, account: accountId, name: name.name, race: c.race, class: c.class, gender: c.gender,
      level: c.level, xp: c.xp, money: c.money,
      playerBytes: c.playerBytes, playerBytes2: c.playerBytes2, playerFlags: c.playerFlags,
      position_x: p.x, position_y: p.y, position_z: p.z, map: p.map, orientation: p.o, zone: p.zone,
      taximask: list(c.taxi.mask), online: 0, cinematic: c.cinematic,
      totaltime: c.played.total, leveltime: c.played.level,
      logout_time: c.rest.logoutTime, is_logout_resting: c.rest.isLogoutResting, rest_bonus: c.rest.bonus,
      resettalents_cost: c.talentReset.cost, resettalents_time: c.talentReset.time,
      trans_x: 0, trans_y: 0, trans_z: 0, trans_o: 0, transguid: 0, // never carry a transport
      extra_flags: c.extraFlags & ~0x0433, // strip GM on/tickets/invisible/chat/unkillable
      stable_slots: c.stableSlots, at_login: c.atLogin & ~0x01, death_expire_time: c.deathExpireTime,
      taxi_path: "", // never resume a flight
      honor_highest_rank: c.honor.highestRank, honor_standing: 0, stored_honor_rating: c.honor.storedRating,
      stored_dishonorable_kills: c.honor.storedDishonorableKills, stored_honorable_kills: c.honor.storedHonorableKills,
      watchedFaction: c.watchedFaction, drunk: 0, health: c.vitals.health,
      power1: c.vitals.powers[0], power2: c.vitals.powers[1], power3: c.vitals.powers[2],
      power4: c.vitals.powers[3], power5: c.vitals.powers[4],
      exploredZones: list(c.exploredZones), equipmentCache: "", // rebuilt by the server on first save
      ammoId: c.ammoId, actionBars: c.actionBars, fishingSteps: c.fishingSteps,
    });
    if (c.homebind)
      await insert(conn, "character_homebind", {
        guid, map: c.homebind.map, zone: c.homebind.zone,
        position_x: c.homebind.x, position_y: c.homebind.y, position_z: c.homebind.z,
      });

    const passthrough = [
      ["skills", "character_skills"], ["forgottenSkills", "character_forgotten_skills"], ["spells", "character_spell"],
      ["spellCooldowns", "character_spell_cooldown"], ["actions", "character_action"],
      ["reputation", "character_reputation"], ["quests", "character_queststatus"],
    ] as const;
    for (const [key, table] of passthrough) for (const row of file[key]) await put(table, { guid, ...pick(row, table) });
    for (const quest of file.questsWeekly) await insert(conn, "character_queststatus_weekly", { guid, quest });

    // Items. Attachments of mail that is not imported are left out with it.
    const skippedRefs = new Set(file.mail.filter((m) => !isPortableMail(m)).flatMap((m) => m.items));
    const items = file.items.filter((it) => !skippedRefs.has(it.ref));
    const itemMap = new Map(items.map((it) => [it.ref, nextItem++]));
    const entryOf = new Map(items.map((it) => [it.ref, it.entry]));
    for (const it of items) {
      const newGuid = itemMap.get(it.ref)!;
      const ench = new Array(21).fill(0);
      for (const e of it.enchantments) ench.splice(e.slot * 3, 3, e.id, e.duration, e.charges);
      await insert(conn, "item_instance", {
        guid: newGuid, owner_guid: guid, itemEntry: it.entry,
        creatorGuid: isSelf(it.creator) ? guid : 0, giftCreatorGuid: isSelf(it.giftCreator) ? guid : 0,
        count: it.count, duration: it.duration, charges: list([...it.charges, 0, 0, 0, 0, 0].slice(0, 5)),
        flags: it.flags, enchantments: list(ench), randomPropertyId: it.randomPropertyId,
        durability: it.durability, itemTextId: await text(it.text),
      });
      for (const l of it.loot)
        await insert(conn, "item_loot", { guid: newGuid, owner_guid: guid, itemid: l.itemid, amount: l.amount, property: l.property });
      if (it.gift) await insert(conn, "character_gifts", { guid, item_guid: newGuid, entry: it.gift.entry, flags: it.gift.flags });
    }
    for (const slot of file.inventory) {
      const item = itemMap.get(slot.item);
      if (item === undefined || (slot.bag !== null && !itemMap.has(slot.bag))) throw new ImportError("Inventory references an unknown item.", "blocked");
      await insert(conn, "character_inventory", {
        guid, bag: slot.bag === null ? 0 : itemMap.get(slot.bag), slot: slot.slot, item, item_template: entryOf.get(slot.item),
      });
    }

    // Auras: only self-cast ones survive; other casters are guids that mean nothing here.
    for (const a of file.auras) {
      if (a.caster_guid !== file.source.originalGuid) continue;
      await insert(conn, "character_aura", {
        guid, caster_guid: guid, item_guid: itemMap.get(Number(a.item_guid)) ?? 0, ...pick(a, "character_aura"),
      });
    }

    for (const pet of file.pets) {
      const id = nextPet++;
      await insert(conn, "character_pet", {
        id, owner: guid, ...pick(pet, "character_pet"),
        abdata: list(pet.actionBar.flatMap((b) => [b.type, b.action])), teachspelldata: list(pet.teachSpells),
      });
      for (const s of pet.spells) await insert(conn, "pet_spell", { guid: id, ...pick(s, "pet_spell") });
      for (const s of pet.spellCooldowns) await insert(conn, "pet_spell_cooldown", { guid: id, ...pick(s, "pet_spell_cooldown") });
      // pet auras are dropped: their caster guids do not survive
    }

    for (const m of file.mail.filter(isPortableMail)) {
      const id = nextMail++;
      await insert(conn, "mail", {
        id, messageType: m.messageType, stationery: m.stationery, mailTemplateId: m.mailTemplateId,
        sender: typeof m.sender === "number" ? m.sender : 0, receiver: guid, subject: m.subject,
        itemTextId: await text(m.body), has_items: m.items.length ? 1 : 0, expire_time: m.expire_time,
        deliver_time: m.deliver_time, money: m.money, cod: 0, checked: m.checked,
      });
      for (const ref of m.items)
        await insert(conn, "mail_items", { mail_id: id, item_guid: itemMap.get(ref), item_template: entryOf.get(ref), receiver: guid });
    }

    await conn.query(
      `REPLACE INTO ${R}.realmcharacters (realmid, acctid, numchars)
       SELECT ?, ?, COUNT(*) FROM ${C}.characters WHERE account = ? AND deleteDate IS NULL`,
      [env.realmId, accountId, accountId],
    );

    for (const [table, values] of deferred) await insert(conn, table, values);
    await conn.commit();
    return { guid, name: name.name, items: items.length, pets: file.pets.length };
  } catch (e) {
    await conn.rollback();
    // the rollback cannot undo these
    if (newGuid) for (const table of NON_TRANSACTIONAL) await conn.query(`DELETE FROM ${C}.?? WHERE guid = ?`, [table, newGuid]);
    throw e;
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('character_import')");
    conn.release();
  }
}

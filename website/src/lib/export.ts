import { C, q, type Row } from "./db";
import { FORMAT, VERSION, type CharacterFile } from "./format";

const ints = (s: unknown) => String(s ?? "").split(" ").filter(Boolean).map(Number);
const n = (v: unknown) => Number(v ?? 0);

function drop(row: Row, ...keys: string[]) {
  const out: Record<string, number | string | null> = {};
  for (const [k, v] of Object.entries(row)) if (!keys.includes(k)) out[k] = v as number | string | null;
  return out;
}

export async function getCharacterDbVersion(): Promise<string | null> {
  const cols = await q<{ Field: string }>(`SHOW COLUMNS FROM ${C}.character_db_version`);
  return cols.find((c) => c.Field.startsWith("required_"))?.Field ?? null;
}

export async function exportCharacter(guid: number): Promise<CharacterFile | null> {
  const [c] = await q(`SELECT * FROM ${C}.characters WHERE guid = ? AND deleteDate IS NULL`, [guid]);
  if (!c) return null;

  const table = async (name: string) =>
    (await q(`SELECT * FROM ${C}.${name} WHERE guid = ?`, [guid])).map((r) => drop(r, "guid"));

  const pb = n(c.playerBytes), pb2 = n(c.playerBytes2);
  const [homebind] = await q(
    `SELECT map, zone, position_x x, position_y y, position_z z FROM ${C}.character_homebind WHERE guid = ?`,
    [guid],
  );

  // Items: everything carried, banked or sitting in the mailbox
  const inv = await q(`SELECT bag, slot, item FROM ${C}.character_inventory WHERE guid = ? ORDER BY bag, slot`, [guid]);
  const mails = await q(`SELECT * FROM ${C}.mail WHERE receiver = ? ORDER BY id`, [guid]);
  const mailItems = await q(`SELECT * FROM ${C}.mail_items WHERE receiver = ?`, [guid]);
  const itemGuids = [...new Set([...inv.map((r) => n(r.item)), ...mailItems.map((r) => n(r.item_guid))])];
  const inList = (ids: number[]) => (ids.length ? ids : [0]);

  const rawItems = await q(`SELECT * FROM ${C}.item_instance WHERE guid IN (?) ORDER BY guid`, [inList(itemGuids)]);
  const loot = await q(`SELECT * FROM ${C}.item_loot WHERE guid IN (?)`, [inList(itemGuids)]);
  const gifts = await q(`SELECT * FROM ${C}.character_gifts WHERE item_guid IN (?)`, [inList(itemGuids)]);
  const textIds = [...rawItems, ...mails].map((r) => n(r.itemTextId)).filter(Boolean);
  const texts = new Map(
    (await q(`SELECT id, text FROM ${C}.item_text WHERE id IN (?)`, [inList(textIds)])).map((r) => [n(r.id), r.text as string]),
  );
  const others = rawItems.flatMap((r) => [n(r.creatorGuid), n(r.giftCreatorGuid)]).filter(Boolean);
  const names = new Map(
    (await q(`SELECT guid, name FROM ${C}.characters WHERE guid IN (?)`, [inList(others)])).map((r) => [n(r.guid), r.name as string]),
  );
  const who = (g: number) => (!g ? null : g === guid ? { self: true as const } : { name: names.get(g) ?? null });

  const items = rawItems.map((it) => {
    const e = ints(it.enchantments);
    const enchantments = [];
    for (let i = 0; i * 3 + 2 < e.length; i++)
      if (e[i * 3]) enchantments.push({ slot: i, id: e[i * 3], duration: e[i * 3 + 1], charges: e[i * 3 + 2] });
    const gift = gifts.find((g) => g.item_guid === it.guid);
    return {
      ref: n(it.guid), // only meaningful inside this file
      entry: n(it.itemEntry),
      count: n(it.count),
      duration: n(it.duration),
      charges: ints(it.charges),
      flags: n(it.flags),
      enchantments,
      randomPropertyId: n(it.randomPropertyId),
      durability: n(it.durability),
      creator: who(n(it.creatorGuid)),
      giftCreator: who(n(it.giftCreatorGuid)),
      text: texts.get(n(it.itemTextId)) ?? null,
      loot: loot
        .filter((l) => l.guid === it.guid)
        .map((l) => ({ itemid: n(l.itemid), amount: n(l.amount), property: n(l.property) })),
      gift: gift ? { entry: n(gift.entry), flags: n(gift.flags) } : null,
    };
  });

  const pets = [];
  for (const p of await q(`SELECT * FROM ${C}.character_pet WHERE owner = ? ORDER BY id`, [guid])) {
    const ab = ints(p.abdata);
    const actionBar = [];
    for (let i = 0; i + 1 < ab.length; i += 2) actionBar.push({ type: ab[i], action: ab[i + 1] });
    const sub = async (t: string) => (await q(`SELECT * FROM ${C}.${t} WHERE guid = ?`, [p.id])).map((r) => drop(r, "guid"));
    pets.push({
      ...drop(p, "id", "owner", "abdata", "teachspelldata"),
      entry: n(p.entry),
      name: String(p.name),
      level: n(p.level),
      actionBar,
      teachSpells: ints(p.teachspelldata),
      spells: await sub("pet_spell"),
      spellCooldowns: await sub("pet_spell_cooldown"),
      auras: await sub("pet_aura"),
    });
  }

  const [guild] = await q(
    `SELECT g.name, gm.rank FROM ${C}.guild_member gm JOIN ${C}.guild g ON g.guildid = gm.guildid WHERE gm.guid = ?`,
    [guid],
  );
  const [stats] = await q(`SELECT * FROM ${C}.character_stats WHERE guid = ?`, [guid]);

  return {
    format: FORMAT,
    version: VERSION,
    source: {
      core: "cmangos-classic",
      characterDbVersion: await getCharacterDbVersion(),
      exportedAt: Math.floor(Date.now() / 1000),
      originalGuid: guid,
    },
    character: {
      name: String(c.name), race: n(c.race), class: n(c.class), gender: n(c.gender),
      level: n(c.level), xp: n(c.xp), money: n(c.money),
      appearance: {
        skin: pb & 0xff, face: (pb >>> 8) & 0xff, hairStyle: (pb >>> 16) & 0xff, hairColor: (pb >>> 24) & 0xff,
        facialHair: pb2 & 0xff,
      },
      bankBagSlots: (pb2 >>> 16) & 0xff,
      playerBytes: pb, playerBytes2: pb2, playerFlags: n(c.playerFlags),
      position: { map: n(c.map), zone: n(c.zone), x: n(c.position_x), y: n(c.position_y), z: n(c.position_z), o: n(c.orientation) },
      homebind: homebind
        ? { map: n(homebind.map), zone: n(homebind.zone), x: n(homebind.x), y: n(homebind.y), z: n(homebind.z) }
        : null,
      played: { total: n(c.totaltime), level: n(c.leveltime) },
      rest: { bonus: n(c.rest_bonus), isLogoutResting: n(c.is_logout_resting), logoutTime: n(c.logout_time) },
      talentReset: { cost: n(c.resettalents_cost), time: n(c.resettalents_time) },
      taxi: { mask: ints(c.taximask), path: (c.taxi_path as string) ?? "" },
      exploredZones: ints(c.exploredZones),
      honor: {
        highestRank: n(c.honor_highest_rank), standing: n(c.honor_standing), storedRating: n(c.stored_honor_rating),
        storedDishonorableKills: n(c.stored_dishonorable_kills), storedHonorableKills: n(c.stored_honorable_kills),
      },
      vitals: { health: n(c.health), powers: [1, 2, 3, 4, 5].map((i) => n(c[`power${i}`])) },
      ammoId: n(c.ammoId), actionBars: n(c.actionBars), stableSlots: n(c.stable_slots),
      watchedFaction: n(c.watchedFaction), drunk: n(c.drunk), fishingSteps: n(c.fishingSteps),
      cinematic: n(c.cinematic), extraFlags: n(c.extra_flags), atLogin: n(c.at_login),
      deathExpireTime: n(c.death_expire_time),
    },
    skills: await table("character_skills"),
    forgottenSkills: await table("character_forgotten_skills"),
    spells: await table("character_spell"),
    spellCooldowns: await table("character_spell_cooldown"),
    actions: await table("character_action"),
    auras: await table("character_aura"),
    reputation: await table("character_reputation"),
    quests: await table("character_queststatus"),
    questsWeekly: (await table("character_queststatus_weekly")).map((r) => n(r.quest)),
    honorCp: await table("character_honor_cp"),
    items,
    inventory: inv.map((r) => ({ bag: n(r.bag) || null, slot: n(r.slot), item: n(r.item) })),
    pets,
    mail: mails.map((m) => ({
      messageType: n(m.messageType),
      stationery: n(m.stationery),
      mailTemplateId: n(m.mailTemplateId),
      // For system mail the sender is a creature/auction-house id, not a player
      sender: n(m.messageType) !== 0 ? n(m.sender) : who(n(m.sender)),
      subject: (m.subject as string) ?? null,
      expire_time: n(m.expire_time),
      deliver_time: n(m.deliver_time),
      money: n(m.money),
      cod: n(m.cod),
      checked: n(m.checked),
      body: texts.get(n(m.itemTextId)) ?? null,
      items: mailItems.filter((mi) => mi.mail_id === m.id).map((mi) => n(mi.item_guid)),
    })),
    display: { guild: guild ? drop(guild) : null, stats: stats ? drop(stats, "guid") : null },
  };
}

# Character export / import — research findings

Scope: CMaNGOS Classic (1.12) as vendored in this repo, with Playerbots. Checked against the
running `cmangos-db` container (character DB version `required_z2819_01_characters_item_instance_text_id_fix`).

Files in this folder:

| File | What it is |
|---|---|
| `export_character.py` | Working prototype: one character -> JSON (read-only) |
| `import_dryrun.py` | Working prototype: JSON -> SQL with new ids; `--dry-run` runs it in a transaction and rolls back |
| `samples/*.json` | Real exports (Marta lvl 3, Nanmo/Pyklatli lvl 60 with pet, Imwohglu with 5 mails) |
| `samples/*.import.sql` | SQL the importer generated for two of them |
| `_columns.txt`, `_tables.txt` | Live schema dump of every relevant table |

## 1. What was verified, and what was not

Verified:
- Export of 4 real characters, including gear with enchants/random suffixes, bags, a hunter pet, auction mail with attachments.
- Import SQL for 2 of them inserted cleanly into the live schema with fresh ids (433 statements for a level 60) and the
  server's own login query (`character_inventory JOIN item_instance`) returned every item. Rolled back; DB unchanged.

Not verified:
- **Logging in with an imported character.** Only the database was running. This is the real test and is still open.
- `character_spell_cooldown` and `character_forgotten_skills` inserts (MyISAM, cannot be rolled back, so left out of the dry run).
- Items with text, wrapped gifts, item loot, crafted items with a creator: none exist in this DB (0 rows), so those
  paths are written from the source code only.

## 2. Which tables are "the character"

The server's own `.pdump` ([PlayerDump.cpp:35](../src/game/Tools/PlayerDump.cpp)) is the reference. Cross-checked with
`Player::LoadFromDB` / `SaveToDB` and the login queries in [CharacterHandler.cpp:184](../src/game/Entities/CharacterHandler.cpp).

### Include

| Table | Key | Content | Id remap on import |
|---|---|---|---|
| `characters` | guid | level, xp, money, appearance, position, played time, rest, honor totals, taxi nodes, explored zones | guid, account |
| `character_homebind` | guid | hearthstone location | guid |
| `character_skills` | guid | skill id, value, max (professions, weapon skills, languages) | guid |
| `character_forgotten_skills` | guid | value of dropped professions (not in pdump) | guid |
| `character_spell` | guid | learned spells. **Talents are just rows here**, there is no talent table in Classic | guid |
| `character_spell_cooldown` | guid | absolute unix expiry times | guid |
| `character_action` | guid | action bar buttons (type 0 spell, 64 macro, 128 item) | guid |
| `character_aura` | guid | active buffs/debuffs | guid, caster_guid, item_guid |
| `character_reputation` | guid | faction, standing, flags | guid |
| `character_queststatus` | guid | status, rewarded, objective counters | guid |
| `character_queststatus_weekly` | guid | (not in pdump; empty here) | guid |
| `character_honor_cp` | guid | this week's individual honor kills | guid (victim is a foreign guid) |
| `character_inventory` | item | where each item sits: `bag` (0 or the bag's item guid) + `slot` | guid, bag, item |
| `item_instance` | guid | the item itself | guid, owner_guid, creatorGuid, giftCreatorGuid, itemTextId |
| `item_loot` | guid+itemid | unopened lockbox/container contents | guid, owner_guid |
| `item_text` | id | text written on items and **mail bodies** | id |
| `character_gifts` | item_guid | wrapped presents | guid, item_guid |
| `character_pet` | id | hunter pets and warlock demons, incl. stabled | id, owner |
| `pet_spell`, `pet_spell_cooldown`, `pet_aura` | guid (= pet id) | | guid |
| `mail`, `mail_items` | id | mailbox | id, receiver, sender, itemTextId, item_guid |

### Exclude (belongs to something other than the character)

| Table | Why |
|---|---|
| `guild_member`, `guild*`, `petition*` | guild (the "clan"). Export the guild name for display only |
| `group_member`, `groups`, `group_instance` | party/raid |
| `character_social` | friends/ignore: guids of other players |
| `character_instance`, `instance*`, `account_instances_entered` | raid/dungeon lockouts tied to instance ids of this server |
| `character_battleground_data` | transient BG state |
| `corpse` | world object; the server recreates state from `playerFlags` ghost + position |
| `auction` | items listed on the AH have left the character |
| `character_tutorial`, `account_data` | per **account**, not per character |
| `character_stats` | derived cache, recomputed at login. Display only (see 6) |
| `characters.equipmentCache` | derived, rewritten on save. Import as empty |
| `ai_playerbot_random_bots`, `ai_playerbot_*_cache` | random-bot bookkeeping |

### Optional

| Table | Note |
|---|---|
| `character_account_data` | per-character client blobs (macros, UI layout). Empty in this DB. Safe to carry, guid remap only |
| `ai_playerbot_db_store` | per-character bot strategy settings (`guid`). Your own characters have rows here. Only useful if you use them as alt-bots |
| `ai_playerbot_custom_strategy` | keyed by `owner` |
| `playerbot_saved_data` | old playerbot module, empty |

## 3. Packed fields, decoded

| Column | Format |
|---|---|
| `characters.playerBytes` | bytes: skin, face, hairStyle, hairColor |
| `characters.playerBytes2` | byte 0 facial hair, byte 2 bank bag slots bought, byte 3 rest state |
| `characters.taximask` | 8 space-separated uint32 bitmasks of known flight nodes (TaxiNodes.dbc id - 1) |
| `characters.exploredZones` | 64 uint32 bitmasks, bit index = AreaTable.dbc exploreFlag |
| `characters.taxi_path` | in-progress flight. Clear on import |
| `characters.extra_flags` | GM state bits 0x1/0x2/0x10/0x20/0x400 should be stripped on import |
| `characters.at_login` | 0x01 forces rename, 0x02 reset spells, 0x04 reset talents |
| `item_instance.charges` | 5 ints, one per item spell |
| `item_instance.enchantments` | 7 slots x (id, duration, charges). Slot 0 permanent, 1 temporary, 3-6 random-suffix properties |
| `item_instance.flags` | 0x1 soulbound, 0x4 unlocked, 0x8 wrapped, 0x200 readable |
| `character_inventory.slot` when `bag`=0 | 0-18 equipped, 19-22 bags, 23-38 backpack, 39-62 bank, 63-68 bank bags, 69-80 buyback, 81-96 keyring |
| `character_pet.abdata` | 10 x (type, action) pet bar |
| `character_pet.slot` | 0 current, 1-2 stabled, 100 not in slot |
| `character_pet.PetType` | 0 summon (warlock), 1 hunter |
| `mail.messageType` | 0 player, 2 auction, 3 creature, 4 gameobject. For non-0 `sender` is an entry id, not a player |

Default race/class spells and starting skills are **not stored** (re-learned at every login), so a low-level character
legitimately has 0 rows in `character_spell`.

## 4. References that do not survive a transfer

| Field | Rule used in the prototype |
|---|---|
| `characters.account` | target account |
| `characters.transguid`, `trans_*` | zero (never import on a boat/zeppelin) |
| `characters.online` | 0 |
| `characters.honor_standing` | 0 (rank position on the source realm) |
| `item_instance.creatorGuid` / `giftCreatorGuid` | new guid if it was the character itself, else 0. Export keeps the crafter's name for display |
| `character_aura.caster_guid` | keep self-cast auras only |
| `character_aura.item_guid` | remap through the item map |
| `pet_aura` | dropped |
| `mail` from players (type 0) or with COD | skipped, and its attachments with it. System mail kept |
| `character_honor_cp.victim` | foreign player guids. Harmless but meaningless; dropping is the clean choice |
| position inside an instance/BG | server already relocates to the entrance or homebind at login |

Anything the target world DB does not know is cleaned up by the server at login: unknown item entries are **deleted**,
unknown spells and quests are dropped. So a file is only portable between servers of the same expansion and a similar
world DB. The export stamps core + character DB version for that reason.

## 5. Import: the constraints that matter

1. **The world server caches id counters in memory.** `ObjectMgr::SetHighestGuids`
   ([ObjectMgr.cpp:6783](../src/game/Globals/ObjectMgr.cpp)) reads `MAX(guid)` for characters, items, mail, item text and pets
   once at startup. Inserting rows behind its back while it runs will make it hand out the same ids again and corrupt data.
   A direct-SQL import therefore needs `mangosd` stopped. The DB container can stay up.
2. The only safe way while the server runs is through the server: `.pdump load` (console, or RA/SOAP, both disabled in
   the default config). A website could convert JSON -> pdump text and call that. pdump is positional (`SELECT *`), so
   the file must match the exact column order of the running schema.
3. Checks the importer must do itself: max 10 characters per realm per account; name unique and valid (else set
   `at_login |= 1` to force a rename, as pdump does); faction mixing if `AllowTwoSide.Accounts = 0`; character must be
   offline on export.
4. After inserting, update `realmd.realmcharacters.numchars` for the account (shown on the realm list).
5. `character_spell_cooldown` and `character_forgotten_skills` are MyISAM: not covered by the transaction.

### Bugs found in the stock pdump (reasons not to rely on it blindly)

- Item text of inventory items is never dumped: the writer still parses the old `data` blob
  ([PlayerDump.cpp:321](../src/game/Tools/PlayerDump.cpp)) which no longer exists, and `item_instance.itemTextId` is not remapped on load.
- Mail with `itemTextId = 0` gets a fresh non-existent text id on load (missing `nonzero` flag at line 637).
- `mail.sender`, `item_instance.creatorGuid`, `character_aura.caster_guid` are copied unchanged, so they point at
  whoever owns that guid on the target server.
- `character_forgotten_skills` and `character_queststatus_weekly` are not dumped.

## 6. What the website needs beyond the export

- **Stats** (strength, armor, crit...): `character_stats` is empty because `PlayerSave.Stats.MinLevel = 0`. Set it to 1
  and the server fills the table on logout. Otherwise the site has to recompute stats from base stats + gear + talents.
- **Names**: the export holds ids only.
  - World DB: `item_template` (name, quality, displayid, stats), `quest_template.Title`, `creature_template.Name` (pets),
    `spell_template.SpellName` + `SpellIconID`, `locales_*` for translations.
  - DBC files in `data/dbc`: `SkillLine`, `Faction`, `AreaTable`, `Talent`/`TalentTab`, `ChrRaces`/`ChrClasses`,
    `ItemRandomProperties`, `SpellItemEnchantment`, `ItemDisplayInfo` + `SpellIcon` (icon names), `TaxiNodes`.
- Talents: join `character_spell` against `Talent.dbc` rank spell ids to rebuild the tree.

## 7. Proposed JSON shape (v1)

See `samples/Nanmo.json` for a full real example.

```
format, version
source      { core, characterDbVersion, exportedAt, originalGuid }
character   { name, race, class, gender, level, xp, money, appearance{}, position{}, homebind{},
              played{}, rest{}, taxi{mask[8]}, exploredZones[64], honor{}, vitals{}, ... }
skills[] forgottenSkills[] spells[] spellCooldowns[] actions[] auras[] reputation[] quests[] questsWeekly[] honorCp[]
items[]     { ref, entry, count, charges[5], enchantments[{slot,id,duration,charges}], randomPropertyId,
              durability, flags, creator, text, loot[], gift }
inventory[] { bag: ref|null, slot, item: ref }
pets[]      { entry, name, level, ..., actionBar[], spells[], spellCooldowns[], auras[] }
mail[]      { messageType, sender, subject, body, money, items: [ref] }
display     { guild, stats }      <- never imported
```

Item `ref` is the source item guid, used only to link `inventory`, `mail.items` and aura `item_guid` inside the file.

## 8. Open questions

- Log in with an imported character (needs `mangosd` up once after an import with it stopped).
- Decide the import route: offline SQL (simple, needs a server stop) vs JSON -> pdump through SOAP (live, more moving parts).
- Whether to carry player-to-player mail at all.
- Whether `ai_playerbot_db_store` should travel with the character.

#!/usr/bin/env python3
"""Research prototype: export one CMaNGOS Classic character to JSON.

Read-only. Talks to the DB through `docker exec cmangos-db mariadb`, so no
port mapping or password is needed on the host.

    python temp/export_character.py <name-or-guid> [out.json]
"""
import json
import subprocess
import sys
import time

CHAR_DB = "classiccharacters"
WORLD_DB = "classicmangos"
FORMAT = "cmangos-classic-character"
VERSION = 1

_UNESC = {"n": "\n", "t": "\t", "0": "\0", "\\": "\\"}


def _unescape(s):
    out, i = [], 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            out.append(_UNESC.get(s[i + 1], s[i + 1]))
            i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def _convert(v):
    if v == "NULL":
        return None
    v = _unescape(v)
    try:
        return int(v)
    except ValueError:
        pass
    return v


def query(sql, db=CHAR_DB, text_cols=()):
    """Run a SELECT, return a list of dicts. Columns in text_cols stay strings."""
    cmd = ["docker", "exec", "cmangos-db", "sh", "-c",
           'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --batch --default-character-set=utf8mb4 %s -e "$0"' % db, sql]
    res = subprocess.run(cmd, capture_output=True, check=True)
    lines = res.stdout.decode("utf-8").split("\n")
    if not lines or not lines[0]:
        return []
    cols = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        if line == "":
            continue
        vals = line.split("\t")
        row = {}
        for c, v in zip(cols, vals):
            if c in text_cols:
                row[c] = None if v == "NULL" else _unescape(v)
            elif "." in v and c not in text_cols:
                try:
                    row[c] = float(v)
                except ValueError:
                    row[c] = _convert(v)
            else:
                row[c] = _convert(v)
        rows.append(row)
    return rows


def ints(s):
    return [int(x) for x in (s or "").split()]


def drop(row, *keys):
    return {k: v for k, v in row.items() if k not in keys}


def in_list(ids):
    return ",".join(str(i) for i in ids) or "0"


def export(ident):
    where = "guid = %d" % int(ident) if str(ident).isdigit() else "name = '%s'" % ident.replace("'", "")
    rows = query("SELECT * FROM characters WHERE %s" % where,
                 text_cols=("name", "taximask", "taxi_path", "exploredZones", "equipmentCache", "deleteInfos_Name"))
    if not rows:
        sys.exit("character not found: %s" % ident)
    c = rows[0]
    guid = c["guid"]

    dbver = [k for k in query("SELECT * FROM character_db_version LIMIT 1")[0] if k.startswith("required_")]

    pb, pb2 = c["playerBytes"], c["playerBytes2"]
    character = {
        "name": c["name"], "race": c["race"], "class": c["class"], "gender": c["gender"],
        "level": c["level"], "xp": c["xp"], "money": c["money"],
        "appearance": {"skin": pb & 0xFF, "face": (pb >> 8) & 0xFF, "hairStyle": (pb >> 16) & 0xFF,
                       "hairColor": (pb >> 24) & 0xFF, "facialHair": pb2 & 0xFF},
        "bankBagSlots": (pb2 >> 16) & 0xFF,
        "playerBytes": pb, "playerBytes2": pb2, "playerFlags": c["playerFlags"],
        "position": {"map": c["map"], "zone": c["zone"], "x": c["position_x"], "y": c["position_y"],
                     "z": c["position_z"], "o": c["orientation"]},
        "played": {"total": c["totaltime"], "level": c["leveltime"]},
        "rest": {"bonus": c["rest_bonus"], "isLogoutResting": c["is_logout_resting"], "logoutTime": c["logout_time"]},
        "talentReset": {"cost": c["resettalents_cost"], "time": c["resettalents_time"]},
        "taxi": {"mask": ints(c["taximask"]), "path": c["taxi_path"]},
        "exploredZones": ints(c["exploredZones"]),
        "honor": {"highestRank": c["honor_highest_rank"], "standing": c["honor_standing"],
                  "storedRating": c["stored_honor_rating"], "storedDishonorableKills": c["stored_dishonorable_kills"],
                  "storedHonorableKills": c["stored_honorable_kills"]},
        "vitals": {"health": c["health"], "powers": [c["power%d" % i] for i in range(1, 6)]},
        "ammoId": c["ammoId"], "actionBars": c["actionBars"], "stableSlots": c["stable_slots"],
        "watchedFaction": c["watchedFaction"], "drunk": c["drunk"], "fishingSteps": c["fishingSteps"],
        "cinematic": c["cinematic"], "extraFlags": c["extra_flags"], "atLogin": c["at_login"],
        "deathExpireTime": c["death_expire_time"],
    }

    hb = query("SELECT map,zone,position_x x,position_y y,position_z z FROM character_homebind WHERE guid=%d" % guid)
    character["homebind"] = hb[0] if hb else None

    def table(name, key="guid", text_cols=()):
        return [drop(r, key) for r in query("SELECT * FROM %s WHERE %s=%d" % (name, key, guid), text_cols=text_cols)]

    # ---- items: everything in inventory/bank/bags + mail attachments
    inv = query("SELECT bag,slot,item,item_template FROM character_inventory WHERE guid=%d ORDER BY bag,slot" % guid)
    mails = query("SELECT * FROM mail WHERE receiver=%d ORDER BY id" % guid, text_cols=("subject",))
    mail_items = query("SELECT * FROM mail_items WHERE receiver=%d" % guid)
    item_guids = sorted({r["item"] for r in inv} | {r["item_guid"] for r in mail_items})

    raw_items = query("SELECT * FROM item_instance WHERE guid IN (%s)" % in_list(item_guids),
                      text_cols=("charges", "enchantments"))
    loot = query("SELECT * FROM item_loot WHERE guid IN (%s)" % in_list(item_guids))
    gifts = query("SELECT * FROM character_gifts WHERE item_guid IN (%s)" % in_list(item_guids))
    text_ids = {r["itemTextId"] for r in raw_items if r["itemTextId"]} | {m["itemTextId"] for m in mails if m["itemTextId"]}
    texts = {r["id"]: r["text"] for r in query("SELECT * FROM item_text WHERE id IN (%s)" % in_list(text_ids), text_cols=("text",))}
    creators = {r["creatorGuid"] for r in raw_items if r["creatorGuid"]} | {r["giftCreatorGuid"] for r in raw_items if r["giftCreatorGuid"]}
    names = {r["guid"]: r["name"] for r in query("SELECT guid,name FROM characters WHERE guid IN (%s)" % in_list(creators), text_cols=("name",))}

    def who(g):
        """Foreign player reference -> portable form."""
        if not g:
            return None
        return {"self": True} if g == guid else {"name": names.get(g)}

    items = []
    for it in raw_items:
        e = ints(it["enchantments"])
        items.append({
            "ref": it["guid"],                       # only meaningful inside this file
            "entry": it["itemEntry"], "count": it["count"], "duration": it["duration"],
            "charges": ints(it["charges"]), "flags": it["flags"],
            "enchantments": [{"slot": i, "id": e[i * 3], "duration": e[i * 3 + 1], "charges": e[i * 3 + 2]}
                             for i in range(len(e) // 3) if e[i * 3]],
            "randomPropertyId": it["randomPropertyId"], "durability": it["durability"],
            "creator": who(it["creatorGuid"]), "giftCreator": who(it["giftCreatorGuid"]),
            "text": texts.get(it["itemTextId"]) if it["itemTextId"] else None,
            "loot": [drop(l, "guid", "owner_guid") for l in loot if l["guid"] == it["guid"]],
            "gift": next(({"entry": g["entry"], "flags": g["flags"]} for g in gifts if g["item_guid"] == it["guid"]), None),
        })

    inventory = [{"bag": r["bag"] or None, "slot": r["slot"], "item": r["item"]} for r in inv]

    mail = []
    for m in mails:
        mm = drop(m, "id", "receiver", "itemTextId", "has_items")
        mm["sender"] = m["sender"] if m["messageType"] != 0 else who(m["sender"])
        mm["body"] = texts.get(m["itemTextId"]) if m["itemTextId"] else None
        mm["items"] = [mi["item_guid"] for mi in mail_items if mi["mail_id"] == m["id"]]
        mail.append(mm)

    # ---- pets
    pets = []
    for p in query("SELECT * FROM character_pet WHERE owner=%d" % guid, text_cols=("name", "abdata", "teachspelldata")):
        pid = p["id"]
        ab = ints(p["abdata"])
        pet = drop(p, "id", "owner", "abdata", "teachspelldata")
        pet["actionBar"] = [{"type": ab[i], "action": ab[i + 1]} for i in range(0, len(ab) - 1, 2)]
        pet["teachSpells"] = ints(p["teachspelldata"])
        pet["spells"] = [drop(r, "guid") for r in query("SELECT * FROM pet_spell WHERE guid=%d" % pid)]
        pet["spellCooldowns"] = [drop(r, "guid") for r in query("SELECT * FROM pet_spell_cooldown WHERE guid=%d" % pid)]
        pet["auras"] = [drop(r, "guid") for r in query("SELECT * FROM pet_aura WHERE guid=%d" % pid)]
        pets.append(pet)

    # ---- display-only extras (never imported)
    guild = query("SELECT g.name, gm.rank FROM guild_member gm JOIN guild g ON g.guildid=gm.guildid WHERE gm.guid=%d" % guid,
                  text_cols=("name",))
    stats = query("SELECT * FROM character_stats WHERE guid=%d" % guid)

    return {
        "format": FORMAT, "version": VERSION,
        "source": {"core": "cmangos-classic", "characterDbVersion": dbver[0] if dbver else None,
                   "exportedAt": int(time.time()), "originalGuid": guid},
        "character": character,
        "skills": table("character_skills"),
        "forgottenSkills": table("character_forgotten_skills"),
        "spells": table("character_spell"),
        "spellCooldowns": table("character_spell_cooldown"),
        "actions": table("character_action"),
        "auras": table("character_aura"),
        "reputation": table("character_reputation"),
        "quests": table("character_queststatus"),
        "questsWeekly": [r["quest"] for r in table("character_queststatus_weekly")],
        "honorCp": table("character_honor_cp"),
        "items": items,
        "inventory": inventory,
        "pets": pets,
        "mail": mail,
        "display": {"guild": guild[0] if guild else None, "stats": drop(stats[0], "guid") if stats else None},
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    data = export(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else "temp/samples/%s.json" % data["character"]["name"]
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print("%s: %d items, %d spells, %d quests, %d pets, %d mails -> %s" % (
        data["character"]["name"], len(data["items"]), len(data["spells"]), len(data["quests"]),
        len(data["pets"]), len(data["mail"]), out))

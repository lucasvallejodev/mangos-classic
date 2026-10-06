#!/usr/bin/env python3
"""Research prototype: turn an exported character JSON back into SQL.

    python temp/import_dryrun.py <file.json> <account-id> [new-name]            # print SQL to temp/samples/<name>.import.sql
    python temp/import_dryrun.py <file.json> <account-id> [new-name] --dry-run  # also run it in a transaction and ROLL BACK

The dry run never commits. The two MyISAM tables (character_spell_cooldown,
character_forgotten_skills) cannot be rolled back, so they are left out of the
dry run and only written to the .sql file.

World server must be STOPPED for a real import: it caches the next free
guid/item/mail/pet ids in memory at startup.
"""
import json
import subprocess
import sys

CHAR_DB = "classiccharacters"
NON_TRANSACTIONAL = ("character_spell_cooldown", "character_forgotten_skills")


def run_sql(sql, db=CHAR_DB):
    cmd = ["docker", "exec", "-i", "cmangos-db", "sh", "-c",
           'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --batch --default-character-set=utf8mb4 %s' % db]
    res = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    if res.returncode:
        sys.exit("SQL failed (nothing committed):\n" + res.stderr.decode())
    return res.stdout.decode("utf-8")


def scalar(sql):
    out = run_sql(sql).split("\n")
    return int(out[1]) if len(out) > 1 and out[1] not in ("", "NULL") else 0


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"


class Sql:
    def __init__(self):
        self.stmts = []

    def insert(self, table, row):
        self.stmts.append((table, "INSERT INTO `%s` (%s) VALUES (%s);" % (
            table, ",".join("`%s`" % k for k in row), ",".join(lit(v) for v in row.values()))))


def build(d, account, new_name):
    assert d["format"] == "cmangos-classic-character" and d["version"] == 1
    c = d["character"]
    live_ver = [l for l in run_sql("SHOW COLUMNS FROM character_db_version").split("\n") if l.startswith("required_")]
    if live_ver and live_ver[0].split("\t")[0] != d["source"]["characterDbVersion"]:
        print("WARNING: character DB version differs from the export", file=sys.stderr)

    # ---- allocate ids (valid only while mangosd is stopped)
    guid = scalar("SELECT MAX(guid)+1 FROM characters") or 1
    next_item = scalar("SELECT MAX(guid)+1 FROM item_instance") or 1
    next_mail = scalar("SELECT MAX(id)+1 FROM mail") or 1
    next_text = scalar("SELECT MAX(id)+1 FROM item_text") or 1
    next_pet = scalar("SELECT MAX(id)+1 FROM character_pet") or 1

    name = new_name or c["name"]
    at_login = c["atLogin"]
    if scalar("SELECT COUNT(*) FROM characters WHERE name=%s" % lit(name)):
        at_login |= 0x01                                   # AT_LOGIN_RENAME, same as pdump
    if scalar("SELECT COUNT(*) FROM characters WHERE account=%d" % account) >= 10:
        sys.exit("account already has 10 characters on this realm")

    item_map = {it["ref"]: next_item + i for i, it in enumerate(d["items"])}
    s = Sql()
    hb = c["homebind"]

    def text(body):
        nonlocal next_text
        if body is None:
            return 0
        s.insert("item_text", {"id": next_text, "text": body})
        next_text += 1
        return next_text - 1

    def player_ref(ref):
        """Only a reference to the character itself survives a transfer."""
        return guid if ref and ref.get("self") else 0

    p = c["position"]
    s.insert("characters", {
        "guid": guid, "account": account, "name": name, "race": c["race"], "class": c["class"], "gender": c["gender"],
        "level": c["level"], "xp": c["xp"], "money": c["money"],
        "playerBytes": c["playerBytes"], "playerBytes2": c["playerBytes2"], "playerFlags": c["playerFlags"],
        "position_x": p["x"], "position_y": p["y"], "position_z": p["z"], "map": p["map"], "orientation": p["o"],
        "taximask": " ".join(map(str, c["taxi"]["mask"])) + " ",
        "online": 0, "cinematic": c["cinematic"],
        "totaltime": c["played"]["total"], "leveltime": c["played"]["level"],
        "logout_time": c["rest"]["logoutTime"], "is_logout_resting": c["rest"]["isLogoutResting"],
        "rest_bonus": c["rest"]["bonus"],
        "resettalents_cost": c["talentReset"]["cost"], "resettalents_time": c["talentReset"]["time"],
        "trans_x": 0, "trans_y": 0, "trans_z": 0, "trans_o": 0, "transguid": 0,     # never carry a transport
        "extra_flags": c["extraFlags"] & ~0x0433,           # strip GM on/tickets/invisible/chat/unkillable
        "stable_slots": c["stableSlots"], "at_login": at_login, "zone": p["zone"],
        "death_expire_time": c["deathExpireTime"], "taxi_path": "",                 # never resume a flight
        "honor_highest_rank": c["honor"]["highestRank"], "honor_standing": 0,
        "stored_honor_rating": c["honor"]["storedRating"],
        "stored_dishonorable_kills": c["honor"]["storedDishonorableKills"],
        "stored_honorable_kills": c["honor"]["storedHonorableKills"],
        "watchedFaction": c["watchedFaction"], "drunk": 0,
        "health": c["vitals"]["health"], **{"power%d" % (i + 1): v for i, v in enumerate(c["vitals"]["powers"])},
        "exploredZones": " ".join(map(str, c["exploredZones"])) + " ",
        "equipmentCache": "",                               # rebuilt by the server on first save
        "ammoId": c["ammoId"], "actionBars": c["actionBars"], "fishingSteps": c["fishingSteps"],
    })
    if hb:
        s.insert("character_homebind", {"guid": guid, "map": hb["map"], "zone": hb["zone"],
                                        "position_x": hb["x"], "position_y": hb["y"], "position_z": hb["z"]})

    for key, table in (("skills", "character_skills"), ("forgottenSkills", "character_forgotten_skills"),
                       ("spells", "character_spell"), ("spellCooldowns", "character_spell_cooldown"),
                       ("actions", "character_action"), ("reputation", "character_reputation"),
                       ("quests", "character_queststatus")):
        for row in d[key]:
            s.insert(table, {"guid": guid, **row})
    for q in d["questsWeekly"]:
        s.insert("character_queststatus_weekly", {"guid": guid, "quest": q})

    # auras: keep only self-cast ones; anything cast by another unit points at a guid that means nothing here
    orig = d["source"]["originalGuid"]
    for a in d["auras"]:
        if a["caster_guid"] != orig:
            continue
        s.insert("character_aura", {"guid": guid, **a, "caster_guid": guid,
                                    "item_guid": item_map.get(a["item_guid"], 0)})

    # ---- items
    mailed = {ref for m in d["mail"] for ref in m["items"]}
    for it in d["items"]:
        new = item_map[it["ref"]]
        ench = [0] * 21
        for e in it["enchantments"]:
            ench[e["slot"] * 3:e["slot"] * 3 + 3] = [e["id"], e["duration"], e["charges"]]
        s.insert("item_instance", {
            "guid": new, "owner_guid": guid, "itemEntry": it["entry"],
            "creatorGuid": player_ref(it["creator"]), "giftCreatorGuid": player_ref(it["giftCreator"]),
            "count": it["count"], "duration": it["duration"],
            "charges": " ".join(map(str, it["charges"])) + " ", "flags": it["flags"],
            "enchantments": " ".join(map(str, ench)) + " ",
            "randomPropertyId": it["randomPropertyId"], "durability": it["durability"],
            "itemTextId": text(it["text"])})
        for l in it["loot"]:
            s.insert("item_loot", {"guid": new, "owner_guid": guid, **l})
        if it["gift"]:
            s.insert("character_gifts", {"guid": guid, "item_guid": new, **it["gift"]})
    for slot in d["inventory"]:
        s.insert("character_inventory", {
            "guid": guid, "bag": item_map[slot["bag"]] if slot["bag"] else 0, "slot": slot["slot"],
            "item": item_map[slot["item"]],
            "item_template": next(i["entry"] for i in d["items"] if i["ref"] == slot["item"])})

    # ---- pets
    for i, pet in enumerate(d["pets"]):
        pid = next_pet + i
        row = {k: v for k, v in pet.items() if k not in ("actionBar", "teachSpells", "spells", "spellCooldowns", "auras")}
        s.insert("character_pet", {
            "id": pid, "owner": guid, **row,
            "abdata": " ".join("%d %d" % (b["type"], b["action"]) for b in pet["actionBar"]) + " ",
            "teachspelldata": " ".join(map(str, pet["teachSpells"])) + " "})
        for sp in pet["spells"]:
            s.insert("pet_spell", {"guid": pid, **sp})
        for cd in pet["spellCooldowns"]:
            s.insert("pet_spell_cooldown", {"guid": pid, **cd})
        # pet auras are dropped: caster guids are pet/unit guids that do not survive

    # ---- mail: only system mail (auction/creature/gameobject) without COD; player mail has a foreign sender
    for m in d["mail"]:
        if m["messageType"] == 0 or m["cod"]:
            # keep the attachments reachable instead of losing them: skipped mail => items are not imported
            for ref in m["items"]:
                s.stmts = [(t, q) for t, q in s.stmts if not (t in ("item_instance", "item_loot") and "(%d," % item_map[ref] in q)]
            continue
        mid = next_mail
        next_mail += 1
        s.insert("mail", {
            "id": mid, "messageType": m["messageType"], "stationery": m["stationery"],
            "mailTemplateId": m["mailTemplateId"], "sender": m["sender"], "receiver": guid, "subject": m["subject"],
            "itemTextId": text(m["body"]), "has_items": 1 if m["items"] else 0,
            "expire_time": m["expire_time"], "deliver_time": m["deliver_time"], "money": m["money"], "cod": 0,
            "checked": m["checked"]})
        for ref in m["items"]:
            s.insert("mail_items", {"mail_id": mid, "item_guid": item_map[ref],
                                    "item_template": next(i["entry"] for i in d["items"] if i["ref"] == ref),
                                    "receiver": guid})
    return guid, name, s.stmts


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        sys.exit(__doc__)
    data = json.load(open(args[0], encoding="utf-8"))
    account = int(args[1])
    guid, name, stmts = build(data, account, args[2] if len(args) > 2 else None)

    out = "temp/samples/%s.import.sql" % name
    with open(out, "w", encoding="utf-8") as f:
        f.write("-- generated by import_dryrun.py; run with mangosd STOPPED\nSTART TRANSACTION;\n")
        f.write("\n".join(q for _, q in stmts))
        f.write("\nCOMMIT;\n-- then: UPDATE realmd.realmcharacters numchars for account %d\n" % account)
    print("new guid %d, name %s, %d statements -> %s" % (guid, name, len(stmts), out))

    if "--dry-run" in sys.argv:
        tables = sorted({t for t, _ in stmts if t not in NON_TRANSACTIONAL})
        key = {"characters": "guid", "character_pet": "owner", "item_instance": "owner_guid", "item_loot": "owner_guid",
               "mail": "receiver", "mail_items": "receiver"}
        checks = "".join("SELECT '%s' t, COUNT(*) n FROM `%s` WHERE `%s`=%d;\n" % (t, t, key.get(t, "guid"), guid)
                         for t in tables if t not in ("item_text", "pet_spell", "pet_spell_cooldown"))
        login_join = ("SELECT 'inventory_join' t, COUNT(*) n FROM character_inventory ci JOIN item_instance ii "
                      "ON ci.item=ii.guid WHERE ci.guid=%d;\n" % guid)
        sql = ("START TRANSACTION;\n" + "\n".join(q for t, q in stmts if t not in NON_TRANSACTIONAL) + "\n"
               + checks + login_join + "ROLLBACK;\nSELECT 'after_rollback' t, COUNT(*) n FROM characters WHERE guid=%d;\n" % guid)
        rows = [l.split("\t") for l in run_sql(sql).split("\n") if l and not l.startswith("t\t")]
        for t, n in rows:
            print("  %-28s %s" % (t, n))

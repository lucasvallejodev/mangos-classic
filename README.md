# C(ontinued)-MaNGOS -- README
[![Windows](../../actions/workflows/windows.yml/badge.svg)](../../actions/workflows/windows.yml) [![Ubuntu](../../actions/workflows/ubuntu.yml/badge.svg)](../../actions/workflows/ubuntu.yml) [![MacOS](../../actions/workflows/macos.yml/badge.svg)](../../actions/workflows/macos.yml)

This file is part of the CMaNGOS Project. See [AUTHORS](AUTHORS.md) and [COPYRIGHT](COPYRIGHT.md) files for Copyright information

## Welcome to C(ontinued)-MaNGOS

CMaNGOS is a free project with the following goal:

  **Doing Emulation Right!**

This means, we want to focus on:

* Doing
  * This project is focused on developing software!
  * Also there are many other aspects that need to be done and are
    considered equally important.
  * Anyone who wants to do stuff is very welcome to do so!

* Emulation
  * This project is about developing a server software that is able to
    emulate a well known MMORPG service.

* Right
  * Our goal must always be to provide the best code that we can.
  * Being 'right' is defined by the behaviour of the system
    we want to emulate.
  * Developing things right also includes documenting and discussing
    _how_ to do things better, hence...
  * Learning and teaching are very important in our view, and must
    always be a part of what we do.

To be able to accomplish these goals, we support and promote:

* Freedom
  * of our work: Our work - including our code - is released under the GPL.
    So everybody is free to use and contribute to this open source project.
  * for our developers and contributors on things that interest them.
    No one here is telling anybody _what_ to do.
    If you want somebody to do something for you, pay them,
    but we are here to enjoy.
  * to have FUN with developing.

* A friendly environment
  * We try to leave personal issues behind us.
  * We only argue about content and not about thin air!
  * We follow the [Netiquette](http://tools.ietf.org/html/rfc1855).

-- The C(ontinued)-MaNGOS Team!

## Running with Docker

This fork includes a Docker setup with the Auction House Bot and Playerbots enabled. It runs on any 64-bit Linux host with Docker 23+ and the compose plugin, including a Raspberry Pi 5. Everything needed to build is in this repository (see [VENDORED.md](VENDORED.md)). See [docker/README.md](docker/README.md) for details.

### First setup

1. Clone the repository:
   ```bash
   git clone https://github.com/lucasvallejodev/mangos-classic.git
   cd mangos-classic
   ```
2. Put the extracted client data (1.12.1, build 5875) in `./data`, so it contains `dbc/`, `maps/`, `vmaps/` and `mmaps/`.
3. Create your settings file, then set the passwords and `REALM_ADDRESS` (the server's LAN IP):
   ```bash
   cp .env.example .env
   nano .env
   ```
4. Build and start. The first build takes a while on a Raspberry Pi, and the first start installs the databases and creates the bot accounts:
   ```bash
   docker compose up -d --build
   docker compose logs -f db-init mangosd
   ```
5. Create your game account from the server console:
   ```bash
   docker attach cmangos-mangosd
   ```
   ```
   account create <name> <password>
   account set gmlevel <name> 3 -1
   ```
   Detach with **Ctrl-P Ctrl-Q**. Ctrl-C stops the server.
6. In your client's `realmlist.wtf`, set `set realmlist <REALM_ADDRESS>`.

### Everyday commands

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop (saves characters) | `docker compose down` |
| Restart the world server | `docker compose restart mangosd` |
| Status | `docker compose ps` |
| Follow logs | `docker compose logs -f mangosd realmd` |
| Server console | `docker attach cmangos-mangosd` (detach with Ctrl-P Ctrl-Q) |
| Apply `.env` changes | `docker compose up -d` |
| Rebuild after code changes | `docker compose up -d --build` |
| Back up characters and accounts | `docker compose exec db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --databases classiccharacters classicrealmd' > backup.sql` |

Rates, the auction house bot, Playerbots (random bots are off by default), Warden and any other setting can be configured in `.env`. See the reference below.

### Configuration reference (`.env`)

All settings live in `.env`, created from [.env.example](.env.example). After changing a value run `docker compose up -d`, which recreates only the containers whose settings changed. Values in `.env` take precedence over the files in `./config`. Defaults match the standard CMaNGOS values unless noted.

Notes:
- `BUILD_JOBS` only applies when building (`docker compose up -d --build`).
- `DB_USER`, `DB_PASSWORD` and the database names are used when the databases are first installed. Changing them later also requires changing them in MariaDB by hand.
- Passwords must not contain `;` `"` `'` `$` `` ` `` or spaces.

#### General and build

| Variable | Default | Description |
|---|---|---|
| `TZ` | `UTC` | Time zone of the containers (e.g. `Europe/Madrid`) |
| `PUID` / `PGID` | `1000` | Owner of `./config` and `./logs` on the host (`id -u` / `id -g`) |
| `BUILD_JOBS` | `0` | Parallel compile jobs, `0` = all cores. Use `2` on a 4GB Raspberry Pi |

#### Database

| Variable | Default | Description |
|---|---|---|
| `DB_ROOT_PASSWORD` | `change-me-root` | MariaDB root password, used by the installer |
| `DB_USER` | `mangos` | Database user the servers connect with |
| `DB_PASSWORD` | `change-me` | Password of `DB_USER` |
| `WORLD_DB` | `classicmangos` | World database name |
| `CHAR_DB` | `classiccharacters` | Characters database name |
| `REALM_DB` | `classicrealmd` | Accounts / realm list database name |
| `LOGS_DB` | `classiclogs` | Logs database name |
| `DB_BUFFER_POOL_SIZE` | `512M` | MariaDB InnoDB cache. `512M` for a Pi 5 8GB, `256M` for 4GB |
| `DB_AUTO_UPDATE` | `1` | `1` = apply pending core SQL updates on every start |
| `DB_LOCALES` | `YES` | Install localized texts on the first install |

#### Realm

| Variable | Default | Description |
|---|---|---|
| `REALM_ID` | `1` | Realm id in the realm list |
| `REALM_NAME` | `CMaNGOS Classic` | Name shown in the realm list |
| `REALM_ADDRESS` | `127.0.0.1` | IP/hostname clients use to reach the world server, e.g. the Pi's LAN IP |
| `REALMD_PORT` | `3724` | Host port of the login server |
| `REALM_PORT` | `8085` | Host port of the world server |
| `REALM_TYPE` | `1` | `0` Normal, `1` PvP, `6` RP, `8` RP-PvP |
| `REALM_TIMEZONE` | `1` | Realm zone: `1` Development, `2` United States, `8` English (EU)... |
| `REALM_SECURITY_LEVEL` | `0` | Minimum account security level allowed to log in (`0` = everyone) |
| `MOTD` | `Welcome to CMaNGOS Classic` | Message of the day |
| `PLAYER_LIMIT` | `100` | Maximum players online |

#### Server

| Variable | Default | Description |
|---|---|---|
| `CONSOLE_ENABLED` | `1` | Server console on the container TTY (`docker attach cmangos-mangosd`) |
| `LOG_LEVEL` | `1` | Console log level, `0` (minimum) to `3` (debug) |
| `MMAPS_ENABLED` | `1` | Movement maps, needed for good creature and bot pathing |

#### Characters

| Variable | Default | Description |
|---|---|---|
| `MAX_PLAYER_LEVEL` | `60` | Maximum level |
| `START_PLAYER_LEVEL` | `1` | Level of new characters |
| `START_PLAYER_MONEY` | `0` | Money of new characters, in copper |
| `ALLOW_TWO_SIDE_ACCOUNTS` | `0` | `1` = Horde and Alliance characters on the same account |
| `CHARACTERS_PER_REALM` | `10` | Characters per account on this realm (1-10) |
| `MAX_PRIMARY_PROFESSIONS` | `2` | Primary professions per character (0-10). `10` = learn them all |
| `SKIP_CINEMATICS` | `0` | Intro cinematic: `0` always, `1` first character of each race, `2` never |
| `ALL_FLIGHT_PATHS` | `0` | `1` = characters start with all flight paths (both factions) |
| `ALWAYS_MAX_WEAPON_SKILL` | `0` | `1` = weapon and defense skills always at max for your level |
| `DEATH_SICKNESS_LEVEL` | `11` | Level resurrection sickness starts at. `MAX_PLAYER_LEVEL + 1` disables it |
| `MAIL_DELIVERY_DELAY` | `3600` | Seconds before mail with items arrives. `0` = instant |
| `PLAYER_SAVE_INTERVAL` | `900000` | Character autosave interval in ms. `300000` (5 min) loses less on a power cut |

#### Cross-faction

| Variable | Default | Description |
|---|---|---|
| `ALLOW_TWO_SIDE_INTERACTION` | `0` | `1` = Horde and Alliance can chat, group, guild, trade, mail and share the auction house |

#### Instances

| Variable | Default | Description |
|---|---|---|
| `INSTANCE_IGNORE_LEVEL` | `0` | `1` = ignore the minimum level to enter dungeons and raids |
| `INSTANCE_IGNORE_RAID` | `0` | `1` = enter raids without being in a raid group |
| `QUESTS_IGNORE_RAID` | `0` | `1` = complete normal quests while in a raid group |
| `RATE_INSTANCE_RESET_TIME` | `1` | Multiplier for days between raid resets (`0.5` = twice as often) |

#### Difficulty

Multipliers below `1` make content easier to do alone or with a few bots. "Normal" covers normal and rare creatures; "elite" covers elites, rare elites and world bosses. Damage includes spell damage.

| Variable | Default | Description |
|---|---|---|
| `RATE_CREATURE_NORMAL_HP` | `1` | Health of normal and rare creatures |
| `RATE_CREATURE_NORMAL_DAMAGE` | `1` | Damage of normal and rare creatures |
| `RATE_CREATURE_ELITE_HP` | `1` | Health of elites, rare elites and world bosses |
| `RATE_CREATURE_ELITE_DAMAGE` | `1` | Damage of elites, rare elites and world bosses |

#### Rates

| Variable | Default | Description |
|---|---|---|
| `RATE_XP_KILL` | `1` | Experience from kills |
| `RATE_XP_QUEST` | `1` | Experience from quests |
| `RATE_XP_EXPLORE` | `1` | Experience from exploration |
| `RATE_REST` | `1` | Rested experience gain, in game and offline |
| `RATE_DROP_MONEY` | `1` | Money drops |
| `RATE_DROP_ITEMS` | `1` | Item drops, poor to epic quality |
| `RATE_REPUTATION` | `1` | Reputation gain |
| `RATE_HONOR` | `1` | Honor gain |
| `RATE_SKILL_GAIN` | `1` | Skill points per skill-up (crafting, gathering, weapon, defense) |
| `RATE_TALENT` | `1` | Talent points per level |
| `RATE_PET_XP` | `1` | Hunter pet experience from kills |

#### Anticheat

| Variable | Default | Description |
|---|---|---|
| `ANTICHEAT_ENABLED` | `1` | Server-side anticheat (movement, spam checks) |
| `WARDEN_ENABLED` | `0` | Warden client scanning (off for a local server; CMaNGOS default is on) |

#### Auction House Bot

| Variable | Default | Description |
|---|---|---|
| `AHBOT_CHANCE_SELL` | `10` | Percent chance per cycle to post items (`0` = never sells) |
| `AHBOT_CHANCE_BUY` | `10` | Percent chance per cycle to buy player items (`0` = never buys) |
| `AHBOT_MAX_REQUIRED_LEVEL` | `60` | Highest required level of items the bot sells |

#### Playerbots

| Variable | Default | Description |
|---|---|---|
| `PLAYERBOTS_ENABLED` | `1` | Enable the Playerbots module |
| `PLAYERBOTS_AUTO_CREATE_ACCOUNTS` | `1` | Create the random bot accounts and characters on startup |
| `PLAYERBOTS_ACCOUNT_COUNT` | `50` | Number of bot accounts (up to 9 characters each) |
| `PLAYERBOTS_MIN_RANDOM_BOTS` | `0` | Minimum random bots logged into the world (this setup's default; upstream is 1000) |
| `PLAYERBOTS_MAX_RANDOM_BOTS` | `0` | Maximum random bots logged into the world. On a Pi 5 start around 50-100 |
| `PLAYERBOTS_MIN_LEVEL` | `1` | Minimum level of random bots |
| `PLAYERBOTS_MAX_LEVEL` | `60` | Maximum level of random bots |
| `PLAYERBOTS_JOIN_LFG` | `1` | Random bots queue for dungeons |
| `PLAYERBOTS_JOIN_BG` | `1` | Random bots queue for battlegrounds |
| `PLAYERBOTS_ALTS_AUTOLOGIN` | `0` | `1` = log in all your other characters as bots when you log in |
| `PLAYERBOTS_AUTO_LEARN_TRAINER_SPELLS` | `0` | `1` = bots learn trainer spells automatically when they level |
| `PLAYERBOTS_AUTO_LEARN_QUEST_SPELLS` | `0` | `1` = bots learn class quest spells automatically when they level |
| `PLAYERBOTS_AUTO_EQUIP_UPGRADES` | `1` | Bots equip upgrades they loot or get from quests |
| `PLAYERBOTS_SYNC_QUESTS` | `0` | `1` = bots in your group complete quests when you hand them in |

#### Any other setting

Any key from the server config files can be set in `.env` too, using a prefix plus the key name with dots replaced by underscores. Names are case-sensitive and must match the key as written in the `.conf` file (see the `.conf.dist` files in `./config`).

| Config file | Prefix | Example |
|---|---|---|
| `mangosd.conf`, `ahbot.conf` | `Mangosd_` | `Mangosd_Rate_Mining_Amount=2` |
| `realmd.conf` | `Realmd_` | `Realmd_WrongPass_MaxCount=5` |
| `aiplayerbot.conf` | `PlayerBots_` | `PlayerBots_AiPlayerbot_RandomBotGuildCount=5` |
| `anticheat.conf` | `Anticheat_` | `Anticheat_Movement_SpeedHack_Enable=0` |

### Syncing with upstream CMaNGOS

Once per clone, add the original repository as `upstream`:

```bash
git remote add upstream https://github.com/cmangos/mangos-classic.git
```

Then, to pull in its latest changes:

```bash
git fetch upstream
git merge upstream/master
docker compose up -d --build
```

If the server then reports a database version mismatch, update the vendored Playerbots and classic-db as described in [VENDORED.md](VENDORED.md).

## Further information

  You can find further information about CMaNGOS at the following places:
  * [CMaNGOS Discord](https://discord.gg/Dgzerzb)
  * [GitHub repositories](https://github.com/cmangos/)
  * [Issue tracker](https://github.com/cmangos/issues/issues)
  * [Pull Requests](https://github.com/cmangos/mangos-classic/pulls)
  * [Wiki](https://github.com/cmangos/issues/wiki) with additional information on installation
  * [Contributing Guidelines](CONTRIBUTING.md)
  * Documentation can be found in the doc/ subdirectory and on the GitHub wiki

## License

  CMaNGOS is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA


  You can find the full license text in the file [COPYING](COPYING) delivered with this package.

### Exceptions to GPL

  World of Warcraft® ©2004 Blizzard Entertainment, Inc. All rights reserved.
  World of Warcraft® content and materials mentioned or referenced are copyrighted by
  Blizzard Entertainment, Inc. or its licensors.
  World of Warcraft, WoW, Warcraft, The Frozen Throne, The Burning Crusade, Wrath of the Lich King,
  Cataclysm, Mists of Pandaria, Ashbringer, Dark Portal, Darkmoon Faire, Frostmourne, Onyxia's Lair,
  Diablo, Hearthstone, Heroes of Azeroth, Reaper of Souls, Starcraft, Battle Net, Blizzcon, Glider,
  Blizzard and Blizzard Entertainment are trademarks or registered trademarks of
  Blizzard Entertainment, Inc. in the U.S. and/or other countries.

  Any World of Warcraft® content and materials mentioned or referenced are copyrighted by
  Blizzard Entertainment, Inc. or its licensors.
  CMaNGOS project is not affiliated with Blizzard Entertainment, Inc. or its licensors.

  Some third-party libraries CMaNGOS uses have other licenses, that must be
  upheld.  These libraries are located within the dep/ directory

  In addition, as a special exception, the CMaNGOS project
  gives permission to link the code of its release of MaNGOS with the
  OpenSSL project's "OpenSSL" library (or with modified versions of it
  that use the same license as the "OpenSSL" library), and distribute
  the linked executables.  You must obey the GNU General Public License
  in all respects for all of the code used other than "OpenSSL".  If you
  modify this file, you may extend this exception to your version of the
  file, but you are not obligated to do so.  If you do not wish to do
  so, delete this exception statement from your version.

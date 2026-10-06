# Character Manager

Small Next.js app to browse the characters of this CMaNGOS Classic server, export one to a JSON file and import
it back as a new character under any account.

## Run with Docker

```bash
docker compose up -d --build website
```

Open http://localhost:8080. `WEBSITE_PORT` and `WEBSITE_BIND` in the root `.env` change the port and the interface
(default `127.0.0.1`, this machine only). Icons are mounted from `website/public/icons`, so fetch them once with
`npm run icons`.

## Run for development

The database must be up and published on the host (`DB_HOST_PORT` in the root `.env`, default 3307):

```bash
docker compose up -d db
```

```bash
cd website && npm install && npm run dev
```

Open http://127.0.0.1:3000. The app binds to localhost only and has **no login**: it can write to the character
database, so do not expose it.

Database credentials and realm settings are read from the root `../.env` (`DB_USER`, `DB_PASSWORD`, `CHAR_DB`,
`WORLD_DB`, `REALM_DB`, `REALM_ID`, `REALM_PORT`, `CHARACTERS_PER_REALM`, `ALLOW_TWO_SIDE_ACCOUNTS`). Extra,
optional: `BOT_ACCOUNT_PREFIX` (default `RNDBOT`, must match `AiPlayerbot.RandomBotAccountPrefix`).

## What it does

- **Characters** (`/`): paginated, sortable list with filters. Characters on bot accounts are hidden unless
  "Hide bots" is unchecked. Each row has an Export button.
- **Character page** (`/characters/<guid>`): equipment and bags with tooltips, bank, talents, skills, reputation,
  quests, spells, recipes, pets, mailbox and active effects. Names come from the world database and the DBC files.
- **Import** (`/import`): upload an exported file, pick the target account, confirm the name. The name is checked
  live and again inside the import transaction; if it is taken you are asked for another.

## Import rules

- **The world server must be stopped.** `mangosd` caches the next free character/item/mail/pet ids at startup, so
  inserting rows while it runs corrupts data. The app refuses to import while the world port accepts connections.
- A new character is always created; nothing is overwritten.
- Not carried over: guild, group, friends, instance locks, auctions, weekly honor kills, pet auras, auras cast by
  others, player-to-player and COD mail (with their attachments).
- Items whose template does not exist in the target world database are deleted by the server at login; the
  preview warns about them.

File format and the research behind it: `../temp/character-export-import-research.md`.

## Game data and icons

- `src/data/*.json` (zones, skills, factions, talents, enchants, icon names) are generated from `../data/dbc`.
  Regenerate with `npm run gamedata`.
- Icons are not in git. `npm run icons` downloads them (about 48 MB) from
  https://github.com/MarkusNemesis/vanillawowdb into `public/icons`. Without them the page shows "?" tiles.
- Attributes, armor and crit on the character page come from `character_stats`, which the server only fills when
  `PLAYER_SAVE_STATS_MIN_LEVEL` is 1 or more (the compose default), and only when a character logs out.

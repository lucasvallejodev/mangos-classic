# CMaNGOS Classic on Docker (AHBot + Playerbots)

Runs on any 64-bit Linux host with Docker 23+, including Raspberry Pi 5 (arm64). Images are built locally for the host architecture from the sources in this repository only: Playerbots and the classic-db world database are vendored (see [VENDORED.md](../VENDORED.md)).

| Service   | Purpose                                                        | Port |
|-----------|----------------------------------------------------------------|------|
| `db`      | MariaDB 11.4                                                   | -    |
| `db-init` | One-shot: installs classic-db + AHBot + Playerbots SQL, then exits | -    |
| `realmd`  | Login server                                                   | 3724 |
| `mangosd` | World server with AHBot and Playerbots                         | 8085 |

## Requirements

- 64-bit OS (`uname -m` prints `aarch64` or `x86_64`), Docker Engine and the compose plugin.
- Extracted client data from a 1.12.1 (5875) client in `./data`: `dbc/`, `maps/`, `vmaps/`, `mmaps/`.
- On a Pi: an SSD rather than the SD card. On 4GB boards add swap and set `BUILD_JOBS=2`.

## First start

```bash
cp .env.example .env
nano .env                       # passwords, REALM_ADDRESS (the server's LAN IP), rates...
docker compose up -d --build    # first build takes a long time on a Pi
docker compose logs -f db-init mangosd
```

`db-init` installs the databases on the first run only. Later runs apply pending core SQL updates (`DB_AUTO_UPDATE=1`) and sync the realmlist with the `REALM_*` settings. Data is never wiped.

The first `mangosd` start creates the Playerbots accounts and characters (`PLAYERBOTS_ACCOUNT_COUNT`), which takes a while.

## Create your account

```bash
docker attach cmangos-mangosd
```

Then on the console:

```
account create myname mypassword
account set gmlevel myname 3
```

Detach with **Ctrl-P Ctrl-Q**. Pressing Ctrl-C stops the server.

In the client's `realmlist.wtf`: `set realmlist <REALM_ADDRESS>`.

## Configuration

- `.env` covers the common settings. Any other key from the config files can be set with `Mangosd_`, `Realmd_`, `PlayerBots_` or `Anticheat_` + the key name with dots replaced by underscores. See the end of `.env.example`.
- `./config` holds the generated `.conf` files (editable) plus fresh `.conf.dist` copies to diff after upgrades. Values from `.env` take precedence.
- Apply changes with `docker compose up -d` (recreates containers whose settings changed).
- Logs are in `./logs`.

## Bots

- Random bots: set `PLAYERBOTS_MIN_RANDOM_BOTS` / `PLAYERBOTS_MAX_RANDOM_BOTS` (default 0). On a Pi 5, start around 50-100 and watch CPU and the server's update time.
- Your own alts as bots, in game: `.bot add <character>` (characters from your account).
- AHBot: `AHBOT_CHANCE_SELL` / `AHBOT_CHANCE_BUY`, 0 disables a side.

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

Playerbots and classic-db are vendored in the repository (see [VENDORED.md](../VENDORED.md)), so builds don't download them. Update them together with the core, otherwise mangosd refuses to start with a database version error.

## Backup

```bash
docker compose exec db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --databases classiccharacters classicrealmd' > backup.sql
```

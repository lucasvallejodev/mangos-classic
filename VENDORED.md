# Vendored third-party sources

These projects are copied into this repository as plain files (no submodules) so the server can be built and installed without fetching anything from GitHub.

| Project | Location | Upstream | Commit | Commit date |
|---|---|---|---|---|
| Playerbots | `src/modules/PlayerBots` | https://github.com/cmangos/playerbots | `14ccaa25ba5040098ebecee35ce6233ff5eefded` | 2026-10-01 |
| classic-db | `contrib/classic-db` | https://github.com/cmangos/classic-db | `ec4f596146be6467ea93c57397858e329e2db852` | 2026-09-22 |
| zlib 1.3.2 | `dep/zlib` | https://github.com/madler/zlib | `da607da739fa6047df13e66a2af6b8bec7c2a498` (tag `v1.3.2`) | 2026-02-17 |

Both were taken from upstream `master` on 2026-10-02 against core commit `8ec338a17`. Only `.git/` and `.github/` (upstream CI) were left out. The files are byte-identical to upstream: `.gitattributes` disables line-ending conversion for both folders.

- **Playerbots** is compiled into `mangosd` with `-DBUILD_PLAYERBOTS=ON`. `src/CMakeLists.txt` uses this copy whenever it exists instead of cloning from GitHub. Its `sql/` folder is applied to the world and characters databases by the classic-db installer.
- **zlib** is needed because the core requires zlib 1.3.2 or newer and most distributions ship older versions. `dep/src/CMakeLists.txt` uses this copy instead of cloning it from GitHub. Update it only when the core bumps the version it requires (the `GIT_TAG` in `dep/src/CMakeLists.txt`).
- **classic-db** provides the world database (`Full_DB/ClassicDB_*.sql.gz`, content `Updates/`, `locales/`) and `InstallFullDB.sh`, which the `db-init` container runs.

## Updating

The core, Playerbots and classic-db must stay compatible: each tracks the core's database revisions. Update them together:

```bash
git clone --depth 1 https://github.com/cmangos/playerbots.git /tmp/playerbots
git clone --depth 1 https://github.com/cmangos/classic-db.git /tmp/classic-db
rm -rf src/modules/PlayerBots contrib/classic-db
mkdir -p src/modules/PlayerBots contrib/classic-db
tar -C /tmp/playerbots --exclude=.git --exclude=.github -cf - . | tar -C src/modules/PlayerBots -xf -
tar -C /tmp/classic-db --exclude=.git --exclude=.github -cf - . | tar -C contrib/classic-db -xf -
```

Then update the commit hashes in the table above.

## Other external dependencies

The Docker build still pulls the `debian:bookworm-slim` and `mariadb:11.4` images and Debian packages. To keep those too, save the built images once they work:

```bash
docker save cmangos-classic:local cmangos-classic-dbinit:local mariadb:11.4 | gzip > cmangos-images.tar.gz
```

Restore them later with `docker load -i cmangos-images.tar.gz`. `docker compose up -d` then works without network access as long as you don't rebuild.

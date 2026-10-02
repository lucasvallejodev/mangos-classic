#!/usr/bin/env bash
# One-shot database installer.
#  - First run (world DB missing): creates the DB user and all databases, then installs
#    classic-db, AHBot and Playerbots SQL plus all core updates.
#  - Later runs: applies pending core SQL updates only (DB_AUTO_UPDATE=1). Data is never wiped.
#  - Every run: syncs the realmlist entry with the REALM_* settings.
set -euo pipefail

: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD must be set}"
: "${DB_PASSWORD:?DB_PASSWORD must be set}"

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-mangos}"
WORLD_DB="${WORLD_DB:-classicmangos}"
CHAR_DB="${CHAR_DB:-classiccharacters}"
REALM_DB="${REALM_DB:-classicrealmd}"
LOGS_DB="${LOGS_DB:-classiclogs}"

log() { echo "[db-init] $*"; }

root_sql()
{
    MYSQL_PWD="${DB_ROOT_PASSWORD}" mariadb -h"${DB_HOST}" -P"${DB_PORT}" -uroot -sN "$@"
}

sql_escape() { printf '%s' "$1" | sed "s/'/''/g"; }

tries=0
until root_sql -e 'SELECT 1' >/dev/null 2>&1; do
    tries=$((tries + 1))
    if (( tries > 60 )); then
        log "Cannot connect to ${DB_HOST}:${DB_PORT} as root"
        exit 1
    fi
    log "Waiting for database..."
    sleep 2
done

# InstallFullDB.sh sources this file, so it must be valid bash.
cat > InstallFullDB.config <<EOF
MYSQL_HOST="${DB_HOST}"
MYSQL_PORT="${DB_PORT}"
MYSQL_USERNAME="${DB_USER}"
MYSQL_PASSWORD="${DB_PASSWORD}"
MYSQL_USERIP="%"
WORLD_DB_NAME="${WORLD_DB}"
REALM_DB_NAME="${REALM_DB}"
CHAR_DB_NAME="${CHAR_DB}"
LOGS_DB_NAME="${LOGS_DB}"
MYSQL_PATH="/usr/bin/mariadb"
MYSQL_DUMP_PATH="/usr/bin/mariadb-dump"
CORE_PATH="/cmangos"
LOCALES="${DB_LOCALES:-YES}"
DEV_UPDATES="NO"
AHBOT="YES"
PLAYERBOTS_DB="YES"
FORCE_WAIT="NO"
EOF

installed="$(root_sql -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$(sql_escape "${WORLD_DB}")' AND table_name='db_version'")"

if [[ "${installed}" == "0" ]]; then
    log "No world database found, running full install (this takes a while)..."
    ./InstallFullDB.sh -InstallAll root "${DB_ROOT_PASSWORD}" DeleteAll
elif [[ "${DB_AUTO_UPDATE:-1}" == "1" ]]; then
    log "Databases present, applying pending core updates..."
    ./InstallFullDB.sh -UpdateCore
else
    log "Databases present, skipping updates (DB_AUTO_UPDATE=0)"
fi

log "Syncing realmlist entry ${REALM_ID:-1} -> ${REALM_ADDRESS:-127.0.0.1}:${REALM_PORT:-8085}"
root_sql -D"${REALM_DB}" -e "
INSERT INTO realmlist (id, name, address, port, icon, timezone, allowedSecurityLevel)
VALUES (${REALM_ID:-1}, '$(sql_escape "${REALM_NAME:-CMaNGOS Classic}")', '$(sql_escape "${REALM_ADDRESS:-127.0.0.1}")',
        ${REALM_PORT:-8085}, ${REALM_TYPE:-1}, ${REALM_TIMEZONE:-1}, ${REALM_SECURITY_LEVEL:-0})
ON DUPLICATE KEY UPDATE
    name = VALUES(name), address = VALUES(address), port = VALUES(port),
    icon = VALUES(icon), timezone = VALUES(timezone), allowedSecurityLevel = VALUES(allowedSecurityLevel);"

log "Done"

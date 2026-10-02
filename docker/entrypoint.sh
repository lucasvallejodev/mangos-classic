#!/usr/bin/env bash
# Seeds config files, waits for the database and starts mangosd or realmd.
# Any setting can be overridden with environment variables (see .env.example).
set -euo pipefail

CMANGOS_DIR=/opt/cmangos
ETC_DIR="${CMANGOS_DIR}/etc"
DIST_DIR="${CMANGOS_DIR}/etc.dist"
LOGS_DIR="${CMANGOS_DIR}/logs"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

log() { echo "[entrypoint] $*"; }

seed_configs()
{
    mkdir -p "${ETC_DIR}" "${LOGS_DIR}"
    for dist in "${DIST_DIR}"/*.conf.dist; do
        local name
        name="$(basename "${dist}" .dist)"
        # Always refresh the .dist reference copy so changes can be diffed after an upgrade
        cp -f "${dist}" "${ETC_DIR}/${name}.dist"
        if [[ ! -f "${ETC_DIR}/${name}" ]]; then
            log "Creating ${name} from defaults"
            cp "${dist}" "${ETC_DIR}/${name}"
        fi
    done
    chown -R "${PUID}:${PGID}" "${ETC_DIR}" "${LOGS_DIR}"
}

wait_for_db()
{
    local host="${DB_HOST:-db}" port="${DB_PORT:-3306}" tries=0
    until (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; do
        tries=$((tries + 1))
        if (( tries > 120 )); then
            log "Database ${host}:${port} not reachable, giving up"
            exit 1
        fi
        log "Waiting for database ${host}:${port}..."
        sleep 2
    done
}

run_as_user()
{
    exec setpriv --reuid="${PUID}" --regid="${PGID}" --clear-groups "$@"
}

case "${1:-mangosd}" in
    mangosd)
        seed_configs
        wait_for_db
        log "Starting mangosd"
        run_as_user "${CMANGOS_DIR}/bin/mangosd" \
            --config "${ETC_DIR}/mangosd.conf" \
            --ahbot "${ETC_DIR}/ahbot.conf" \
            --aiplayerbot "${ETC_DIR}/aiplayerbot.conf"
        ;;
    realmd)
        seed_configs
        wait_for_db
        log "Starting realmd"
        run_as_user "${CMANGOS_DIR}/bin/realmd" --config "${ETC_DIR}/realmd.conf"
        ;;
    *)
        exec "$@"
        ;;
esac

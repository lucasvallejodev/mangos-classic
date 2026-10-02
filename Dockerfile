#
# CMaNGOS Classic with AHBot and Playerbots.
# Multi-arch (amd64 / arm64): builds natively for whatever host runs `docker compose build`.
#
# Self-contained: Playerbots (src/modules/PlayerBots) and classic-db (contrib/classic-db) are
# vendored in this repository, nothing is downloaded from GitHub. See VENDORED.md.
# Requires Docker 23+ (BuildKit is the default builder).
#
# Targets:
#   runtime - mangosd + realmd binaries (default)
#   dbinit  - one-shot database installer (classic-db + core/playerbots SQL)

ARG DEBIAN_RELEASE=bookworm

############################################################
# Build
############################################################
FROM debian:${DEBIAN_RELEASE}-slim AS builder
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential cmake ccache \
      libboost-program-options-dev libboost-thread-dev libboost-regex-dev \
      libboost-serialization-dev libboost-filesystem-dev libboost-system-dev \
      libmariadb-dev libmariadb-dev-compat libssl-dev zlib1g-dev libbz2-dev \
 && rm -rf /var/lib/apt/lists/*

# Only what the server build needs, so SQL/database changes don't trigger a recompile
COPY CMakeLists.txt /src/
COPY cmake /src/cmake
COPY dep /src/dep
COPY src /src/src

# Parallel compile jobs. 0 = all cores. Lower it (e.g. 2) on 4GB boards if the build runs out of memory.
ARG BUILD_JOBS=0
ENV CCACHE_DIR=/ccache \
    CCACHE_SLOPPINESS=pch_defines,time_macros,include_file_mtime,include_file_ctime

# FETCHCONTENT_FULLY_DISCONNECTED guarantees CMake never tries to download the Playerbots module.
RUN --mount=type=cache,target=/ccache,id=cmangos-classic-ccache \
    cmake -S /src -B /build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/opt/cmangos \
      -DPCH=ON \
      -DBUILD_GAME_SERVER=ON \
      -DBUILD_LOGIN_SERVER=ON \
      -DBUILD_SCRIPTDEV=ON \
      -DBUILD_AHBOT=ON \
      -DBUILD_PLAYERBOTS=ON \
      -DBUILD_EXTRACTORS=OFF \
      -DFETCHCONTENT_FULLY_DISCONNECTED=ON \
      -DFETCHCONTENT_SOURCE_DIR_PLAYERBOTS=/src/src/modules/PlayerBots \
 && JOBS="${BUILD_JOBS}"; [ "${JOBS}" -gt 0 ] || JOBS="$(nproc)"; \
    cmake --build /build --parallel "${JOBS}" \
 && cmake --install /build \
 && if [ ! -f /opt/cmangos/etc/aiplayerbot.conf.dist ]; then \
      cp /src/src/modules/PlayerBots/playerbot/aiplayerbot.conf.dist.in /opt/cmangos/etc/aiplayerbot.conf.dist; \
    fi \
 && rm -rf /build

############################################################
# Database installer
############################################################
FROM debian:${DEBIAN_RELEASE}-slim AS dbinit
RUN apt-get update \
 && apt-get install -y --no-install-recommends mariadb-client gzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# InstallFullDB.sh reads SQL from CORE_PATH/sql and CORE_PATH/src/modules/PlayerBots/sql
COPY sql /cmangos/sql
COPY src/modules/PlayerBots/sql /cmangos/src/modules/PlayerBots/sql
COPY contrib/classic-db /classic-db
COPY --chmod=755 docker/db-init.sh /usr/local/bin/db-init.sh
RUN chmod 755 /classic-db/InstallFullDB.sh

ENV TERM=dumb
WORKDIR /classic-db
ENTRYPOINT ["/usr/local/bin/db-init.sh"]

############################################################
# Runtime
############################################################
FROM debian:${DEBIAN_RELEASE}-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libmariadb3 libssl3 zlib1g libbz2-1.0 ca-certificates util-linux \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/cmangos /opt/cmangos

# Pristine *.conf.dist files live in etc.dist; the entrypoint seeds /opt/cmangos/etc (a volume) from them.
RUN mv /opt/cmangos/etc /opt/cmangos/etc.dist \
 && mkdir -p /opt/cmangos/etc /opt/cmangos/logs /opt/cmangos/data \
 && if ldd /opt/cmangos/bin/mangosd /opt/cmangos/bin/realmd | grep 'not found'; then exit 1; fi

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Config paths for ahbot/anticheat/playerbots are resolved relative to ../etc from the working dir.
WORKDIR /opt/cmangos/bin
EXPOSE 3724 8085
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["mangosd"]

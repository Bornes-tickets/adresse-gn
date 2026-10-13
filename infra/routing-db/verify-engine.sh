#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PG_MAJOR="16"
EXPECTED_POSTGIS="3.6.4"
EXPECTED_PGROUTING="4.0.2"

fail() {
    printf '%s\n' "VERIFY_ENGINE=FAIL"
    printf '%s\n' "$1" >&2
    exit 1
}

case "$(uname -s)" in
    Linux)
        ;;
    *)
        fail "Unexpected operating system."
        ;;
esac

case "$(uname -m)" in
    x86_64|amd64)
        ;;
    *)
        fail "Unexpected architecture."
        ;;
esac

command -v postgres >/dev/null 2>&1 ||
    fail "postgres executable missing."

command -v pg_config >/dev/null 2>&1 ||
    fail "pg_config executable missing."

PG_VERSION="$(postgres --version)"
PG_CONFIG_VERSION="$(pg_config --version)"

printf '%s\n' "POSTGRES_VERSION=${PG_VERSION}"
printf '%s\n' "PG_CONFIG_VERSION=${PG_CONFIG_VERSION}"

printf '%s\n' "${PG_VERSION}" |
    grep -Eq "PostgreSQL[[:space:]]+${EXPECTED_PG_MAJOR}([.]|[[:space:]])" ||
    fail "PostgreSQL major mismatch."

POSTGIS_PACKAGE_VERSION="$(
    dpkg-query \
        -W \
        -f='${Version}' \
        postgresql-16-postgis-3 \
        2>/dev/null
)" || fail "PostGIS package missing."

PGROUTING_PACKAGE_VERSION="$(
    dpkg-query \
        -W \
        -f='${Version}' \
        postgresql-16-pgrouting \
        2>/dev/null
)" || fail "pgRouting package missing."

printf '%s\n' "POSTGIS_PACKAGE_VERSION=${POSTGIS_PACKAGE_VERSION}"
printf '%s\n' "PGROUTING_PACKAGE_VERSION=${PGROUTING_PACKAGE_VERSION}"

case "${POSTGIS_PACKAGE_VERSION}" in
    "${EXPECTED_POSTGIS}"+dfsg-2.pgdg12+1)
        ;;
    *)
        fail "PostGIS package version mismatch."
        ;;
esac

case "${PGROUTING_PACKAGE_VERSION}" in
    "${EXPECTED_PGROUTING}"-1.pgdg12+1)
        ;;
    *)
        fail "pgRouting package version mismatch."
        ;;
esac

printf '%s\n' "VERIFY_ENGINE=GO"

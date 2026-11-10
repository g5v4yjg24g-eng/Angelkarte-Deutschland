#!/usr/bin/env bash
# Server-Regeln mit echten Rechten prüfen (lokales PostgreSQL 16, kein Supabase nötig).
# stub.sql bildet nur das Nötigste von Supabase nach (auth.uid, storage.objects, net.http_post).
# Aufruf: supabase/tests/run.sh <test.sql>   (als Nutzer mit Rechten auf createdb/psql, z. B. postgres)
set -euo pipefail
cd "$(dirname "$0")/.."
db="fp_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/stub.sql >/dev/null
for f in migrations/*.sql; do
  sed '/create extension if not exists pg_net/d' "$f" | psql -q -v ON_ERROR_STOP=1 -d "$db" >/dev/null
done
t="${1:-publish_post.sql}"
# Ergebnis mit der erwarteten Ausgabe vergleichen (tests/<name>.expected)
psql -q -d "$db" -f "tests/$t" | diff -u "tests/${t%.sql}.expected" - && echo "OK: $t"

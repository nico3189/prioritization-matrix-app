#!/usr/bin/env bash
# Dumper Postgres-databasen fra live/production.
# Kræver: pg_dump (brew install libpq && brew link --force libpq)
#
# Brug:
#   DATABASE_URL="postgresql://..." ./scripts/db-dump-live.sh
#   eller sæt DATABASE_URL i .env og kør: source .env 2>/dev/null; ./scripts/db-dump-live.sh
#
# Output: prisma/dump.sql

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_FILE="$PROJECT_ROOT/prisma/dump.sql"

if [ -z "$DATABASE_URL" ]; then
  echo "Fejl: DATABASE_URL er ikke sat."
  echo "Sæt den til din live database-URL, fx:"
  echo '  export DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"'
  exit 1
fi

# Tilføj sslmode hvis URL'en kommer fra Heroku/cloud og ikke allerede har det
if [[ "$DATABASE_URL" != *"sslmode"* ]]; then
  if [[ "$DATABASE_URL" != *"?"* ]]; then
    DATABASE_URL="${DATABASE_URL}?sslmode=require"
  else
    DATABASE_URL="${DATABASE_URL}&sslmode=require"
  fi
fi

echo "Dumper database til $DUMP_FILE ..."
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "$DUMP_FILE"

echo "Done. Dump gemt i prisma/dump.sql"

#!/usr/bin/env bash
# Én kommando: dump fra live + gendan lokalt.
# Kræver: pg_dump, psql (brew install libpq)
#
# Brug (én gang, eller når du vil have friske data):
#   LIVE_DATABASE_URL="postgresql://..." npm run db:sync-from-live

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_FILE="$PROJECT_ROOT/prisma/dump.sql"
LOCAL_USER=$(whoami)
LOCAL_URL="postgresql://${LOCAL_USER}@localhost:5432/prioritization_matrix"

if [ -z "$LIVE_DATABASE_URL" ]; then
  echo "Fejl: LIVE_DATABASE_URL er ikke sat."
  echo ""
  echo "Brug: LIVE_DATABASE_URL=\"postgresql://...\" npm run db:sync-from-live"
  echo ""
  echo "Hent URL fra Heroku: heroku config:get DATABASE_URL -a <din-app>"
  exit 1
fi

# Start lokal Postgres (Homebrew) hvis ikke kører
brew services start postgresql@16 2>/dev/null || true
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/libpq/bin:$PATH"
sleep 2

# Tilføj sslmode til live URL hvis nødvendigt
LIVE_URL="$LIVE_DATABASE_URL"
if [[ "$LIVE_URL" != *"sslmode"* ]]; then
  if [[ "$LIVE_URL" != *"?"* ]]; then
    LIVE_URL="${LIVE_URL}?sslmode=require"
  else
    LIVE_URL="${LIVE_URL}&sslmode=require"
  fi
fi

echo "1/2 Dumper fra live..."
pg_dump "$LIVE_URL" --no-owner --no-acl --clean --if-exists -f "$DUMP_FILE"

echo "2/2 Gendanner lokalt..."
createdb prioritization_matrix 2>/dev/null || true
# Fjern transaction_timeout (Postgres 17+) for kompatibilitet
grep -v "transaction_timeout" "$DUMP_FILE" | psql "$LOCAL_URL" -v ON_ERROR_STOP=1

echo ""
echo "Done. Lokal database er opdateret."
echo "Kør 'npm run dev' for at starte appen."

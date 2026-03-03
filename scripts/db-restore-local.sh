#!/usr/bin/env bash
# Gendanner database fra dump til lokal Postgres.
# Kræver: Lokal Postgres kører (docker compose up -d) og psql
#
# Brug:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prioritization_matrix" ./scripts/db-restore-local.sh
#   eller med .env: source .env 2>/dev/null; ./scripts/db-restore-local.sh
#
# Input: prisma/dump.sql (oprettet af db-dump-live.sh)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_FILE="$PROJECT_ROOT/prisma/dump.sql"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Fejl: $DUMP_FILE findes ikke."
  echo "Kør først: ./scripts/db-dump-live.sh (med DATABASE_URL sat til live)"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Fejl: DATABASE_URL er ikke sat."
  echo "Brug lokal URL, fx:"
  echo '  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prioritization_matrix"'
  exit 1
fi

echo "Gendanner database fra $DUMP_FILE ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 < "$DUMP_FILE"

echo "Done. Kør 'npx prisma generate' hvis nødvendigt."

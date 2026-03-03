#!/usr/bin/env bash
# Gendan eksisterende dump til lokal Postgres (Homebrew).
# Kræver: brew install postgresql@16 libpq
set -e
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/libpq/bin:$PATH"
LOCAL_USER=$(whoami)
LOCAL_URL="postgresql://${LOCAL_USER}@localhost:5432/prioritization_matrix"
if [ ! -f prisma/dump.sql ]; then
  echo "Fejl: prisma/dump.sql findes ikke. Kør først: LIVE_DATABASE_URL=\"...\" npm run db:sync-from-live"
  exit 1
fi
echo "Sikrer at Postgres kører..."
brew services start postgresql@16 2>/dev/null || true
sleep 2
echo "Opretter database hvis den ikke findes..."
createdb prioritization_matrix 2>/dev/null || true
echo "Gendanner dump..."
# Fjern transaction_timeout (Postgres 17+) for kompatibilitet med ældre versioner
grep -v "transaction_timeout" prisma/dump.sql | psql "$LOCAL_URL" -v ON_ERROR_STOP=1
echo "Done."

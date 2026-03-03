#!/usr/bin/env bash
# Opsæt lokal Postgres via Homebrew (uden Docker).
# Kør: npm run db:setup-local
set -e
echo "Installerer PostgreSQL..."
brew install postgresql@16 libpq 2>/dev/null || true
brew link --force libpq 2>/dev/null || true
echo "Starter Postgres..."
brew services start postgresql@16 2>/dev/null || true
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/libpq/bin:$PATH"
echo "Venter på at Postgres er klar..."
sleep 3
echo "Opretter database prioritization_matrix..."
createdb prioritization_matrix 2>/dev/null || echo "(findes allerede)"
echo ""
echo "Done. Brug i .env:"
echo "DATABASE_URL=\"postgresql://$(whoami)@localhost:5432/prioritization_matrix\""
echo ""
echo "Kør derefter: npm run db:restore-now"

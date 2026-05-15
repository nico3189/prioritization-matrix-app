# Prioritization Matrix

Eisenhower todo app with AI Smart Input and Google Calendar (Google SSO only).

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Prisma + PostgreSQL
- NextAuth.js (Google only, Calendar read-only scope)
- OpenAI for Smart Input parsing
- TanStack React Query

## Local setup

1. Copy `.env.example` to `.env` og udfyld Google, NextAuth, OpenAI. Sæt `DATABASE_URL` til `postgresql://$(whoami)@localhost:5432/prioritization_matrix`.

2. Install:
   ```bash
   npm install
   ```

3. *(Første gang)* Opsæt lokal Postgres (Homebrew, ingen Docker):
   ```bash
   npm run db:setup-local
   ```

4. *(Første gang)* Hent data fra live:
   ```bash
   set -a && source .env && set +a
   LIVE_DATABASE_URL="${DATABASE_URL}" npm run db:sync-from-live
   ```
   Eller med Heroku: `LIVE_DATABASE_URL="$(heroku config:get DATABASE_URL -a <din-app>)" npm run db:sync-from-live`

5. Kør:
   ```bash
   npm run dev
   ```

## Deploy to Heroku (personal app)

The Heroku MCP deploy failed with 401 (invalid credentials). Deploy manually:

1. Log in and create app (no team):
   ```bash
   heroku login
   heroku create prioritization-matrix-app
   ```

2. Add Postgres:
   ```bash
   heroku addons:create heroku-postgresql:essential-0 -a prioritization-matrix-app
   ```

3. Set config vars (Dashboard → Settings → Config Vars or CLI):
   ```bash
   heroku config:set \
     GOOGLE_CLIENT_ID="..." \
     GOOGLE_CLIENT_SECRET="..." \
     NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
     NEXTAUTH_URL="https://prioritization-matrix-app-d588e59b39f7.herokuapp.com" \
     OPENAI_API_KEY="..." \
     -a prioritization-matrix-app
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

5. Run migrations (if not run by postdeploy):
   ```bash
   heroku run npx prisma migrate deploy -a prioritization-matrix-app
   ```

Ensure the Google OAuth redirect URI is set to:
`https://prioritization-matrix-app-d588e59b39f7.herokuapp.com/api/auth/callback/google`

MCP (Streamable HTTP): `https://prioritization-matrix-app-d588e59b39f7.herokuapp.com/api/mcp` med `Authorization: Bearer pm_...`.

### Hourly sync of urgency (optional)

Hastegrad for opgaver med deadline opdateres automatisk mod “effektiv” hastegrad. For at køre det hver time:

1. Tilføj Heroku Scheduler: Dashboard → Resources → Add-ons → Heroku Scheduler.
2. Sæt Config Var `CRON_SECRET` (fx `openssl rand -base64 32`).
3. I Scheduler: New Job, kør **hver time**, kommando:
   ```bash
   curl -X POST https://<din-app>.herokuapp.com/api/cron/sync-urgency -H "x-cron-secret: $CRON_SECRET"
   ```
   Erstat `<din-app>` med din app-navn. Heroku indsætter Config Vars som `$CRON_SECRET` når jobbet kører.

## Scripts

- `npm run dev` – development
- `npm run build` – production build
- `npm run start` – start production server
- `npm run db:setup-local` – opsæt lokal Postgres (Homebrew)
- `npm run db:sync-from-live` – hent data fra live til lokal
- `npm run db:restore-now` – gendan eksisterende dump

# Millmoor Takes Over

An independent, persistent multiplayer football empire browser game. HTML/CSS/TypeScript frontend, Cloudflare Worker API and Neon PostgreSQL. No Floot, Lovable or Replit runtime. Original crest, pitch art, player names and football content.

Start with [PROJECT_STATUS.md](PROJECT_STATUS.md). [GAME_SPEC.md](GAME_SPEC.md) records the recovered agreement and current balancing. [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) preserves all 48 comparison rows and honest implementation status. [DEPLOYMENT.md](DEPLOYMENT.md) describes test deployment, credentials and production gates.

## Local setup

Requires Node.js 24 and npm. `npm ci`, then `npm run build`.

Create gitignored `.dev.vars.test` with `DATABASE_URL` for the **game test project only**. Optional `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google sign-in. `npm run dev:worker -- --env test` runs the built game. For frontend hot reload, run `npm run dev` alongside the Worker on port 8787.

Run `npm test` for validation checks. Database and API tests require `.env.integration` with a connection string for the dedicated verification branch: `npm run test:integration`, `npm run test:api` and `npm run test:client`. Never point these fixture-generating tests at the playable world or an existing club application.

## Deployments

`npm run deploy:test` deploys **only the test Worker**. No production environment or automatic deployment exists. GitHub Actions verifies source; it does not deploy. Test accounts are disabled unless both `ENVIRONMENT=test` and `ALLOW_TEST_ACCOUNTS=true` are set.

No existing Floot data has been reset or copied. Import is a separate, pending read-only recovery and mapping step.

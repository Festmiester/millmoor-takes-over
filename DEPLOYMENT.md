# Deployment and operations

## Latest pacing release

Deployment `014dcd68c97e4521b9ca1bf5ebd311b8`. Migrations 011–014 committed together on the playable branch through the Neon connector after verification. Existing player cash/ranks/rosters untouched; waiting readiness intentionally cleared because costs changed. Capacity constraint widened to 300, without a stamina refill/reset. Google secrets and owner allowlist preserved, signup remains false.

118 assertion/workflow groups passed across unit, API, old/new database and client suites plus asset checks; the final three pacing groups used tests/pacing-final.sql via the Neon connector after host egress failed. Build and Worker dry-run pass. See PROJECT_STATUS.md for precise counts and native-visual limits. Legacy Worker-only rollback can show stale stamina/venture terms against the new database: prefer a reviewed corrective release preserving current rules/data. Never drop players, posts, practice or duty rows to roll back.

## Current — 17 November 2026

Deployment `cacb984315c442f8bf33a0947e853239`: persistent empire/multiplayer. Migrations 009–010 applied to verification and playable branches. Migration 009 source recovered from previously verified database definitions; migration runner skips recorded versions. No live fixture accounts created.

100 checks pass: 10 unit, 14 original integration, 15 API, 40 client, 12 empire transaction/privacy, five full empire form workflows and four binary asset checks. Build and Worker dry-run pass. Three live clubs snapshotted: two unchanged; owner's club has legitimate ledgered activity during rollout, including saved business purchases/upgrades and alliance founding. No reset.

Keep secret_text, owner allowlist and signup=false. No paid placement hints. Roll back Worker to `cb4340f2d98047db99644589de1347bb` if necessary; added tables can remain unused. Never drop player/social data as rollback. Browser profile is signed out; protected workflows verified with separate verification accounts through real client/Worker.

Latest deployment `cb4340f2d98047db99644589de1347bb`: modal results, compact cards and chapter shortcut. No migrations/auth changes; secret_text retained and signup false. Upload omitted placement hints: region-style hint failed validation and geographic hint requires an unavailable plan feature. Standard placement deployed successfully. Do not add paid placement or request credential reconnection for those feature errors.

Current visual release: `2c059f057a664818aa384e63814accf8`. No migrations. Binary WebP/WOFF2 assets are base64-embedded by package-plugin-deploy.mjs and returned as bytes with correct MIME. Run build, packaging and scripts/assets-smoke.mjs before upload. Live browser portrait verified. All secret_text retained and ALLOW_TEST_ACCOUNTS=false. This supersedes IDs below.

Latest release: `cd844ec787db4b22984e9c8252ebdbdc`, Lovable-inspired usability and scouting expansion. Migrations 1–8 applied to both game branches, with pending 005–008 committed together on live. Live config keeps google=true/testAccounts=false; catalog exposes five real scout contacts/capacity/profiles and manifest MIME is application/manifest+json. Live browser office review passed with previous cash preserved. Secret bindings retained. Historical deployment IDs below are superseded.

New scouting batch uses migrations 005–008. Apply pending files as ONE transaction with updated migrate.ts, so intermediate function fixes cannot be observed by live gameplay. Package-plugin-deploy supports application/manifest+json for the new manifest. Preserve all secret_text and ALLOW_TEST_ACCOUNTS=false.

CURRENT: Latest deployment `5f276b5f37694de5907ac35fad84e82e`, daily assignments live. Google configured but a playable-world database check found no Google-linked identity yet; retain existing sessions pending completed linkage. ALLOW_TEST_ACCOUNTS=false blocks all new disposable registrations. Every future deployment MUST preserve secret_text bindings (DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_GOOGLE_EMAILS) and must not re-enable temporary signup. User prohibits TinyFish. Migration 004 applied to both game branches without resetting assets/progress. Older pending-Google/keep-signup instructions below are historical and superseded.

Latest test deployment: `809f0ea3503940ae8fa4d6ebfe3b540f` (16 Nov 2026). Manager File and Google-readiness batch. Live browser verified saved progress and character/skills panels. Google is still not configured.

Current Google blocker: credentials absent; TinyFish wallet empty. No payment authorised or made. GOOGLE_AUTH_SETUP.md contains exact settings. Next API deployment must preserve existing secret bindings (`keep_bindings: ["secret_text"]`) so user-entered Google credentials cannot be wiped. Keep disposable signup available until the owner successfully links the existing club and re-login is verified.

## Live test deployment — 16 November 2026

URL: https://millmoor-takes-over-test.kurttev327.workers.dev/
Worker: `millmoor-takes-over-test`; account `f4a22d9ed0da8861ada7f65faa6fcac6`.
Deployment ID: `58eb020b60f94cb58fb5c7e968ee9826`.
Deployed through authenticated Cloudflare plugin multipart API. Build with `npm run build`, then `node scripts/package-plugin-deploy.mjs`; upload `.wrangler/plugin/worker.js` as module with ENVIRONMENT=test, ALLOW_TEST_ACCOUNTS=true and DATABASE_URL as secret_text from the existing game test secret store. Never print or commit its value. Uses compatibility date 2026-11-01, nodejs_compat, targeted London database placement and observability/traces. Enable script workers.dev route, leave version previews disabled. Normal Wrangler deployment remains an alternative when CLI credentials exist.
Google OAuth is not yet configured. Disposable test accounts work using a seven-day browser cookie. QA profile is explicitly named Deployment QA. Test URL works without ChatGPT credits; future development still needs an active coding session. Existing Juniors resources untouched. Repository is public as created by owner; secrets are excluded.
Historical blocked status below is superseded by this section.

Last updated: 16 November 2026. **Not deployed. No production approval given.**

## Resource inventory

| Resource               | Game allocation                                        | Status                                                |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Neon project           | `billowing-lake-52144871` — Millmoor Takes Over — Test | Created                                               |
| Region                 | AWS London `aws-eu-west-2`                             | Configured                                            |
| Playable-world branch  | `br-summer-voice-za1jzfnf` / `test`                    | Schema migrations 1–3 applied                         |
| Verification branch    | `br-purple-field-za1hfpw1` / `verification-20261116`   | Separate copied schema; test fixtures only            |
| Database               | `takes_over`                                           | Separate from Juniors                                 |
| Compute                | 0.25 CU min/max, plan-default suspend                  | Created, no plan upgrade                              |
| Cloudflare test Worker | Intended name `millmoor-takes-over-test`               | Source packaged; deployment blocked by authentication |
| GitHub repository      | Intended name `millmoor-takes-over`                    | Local Git created; remote not yet created             |
| Google OAuth client    | Game-specific web client                               | Credentials not configured                            |

Existing Neon project `muddy-scene-56344781` (Millmoor Juniors) is excluded. Existing GitHub repositories were listed read-only and not modified. Do not deploy into them.

## Exact blockers

1. Cloudflare has no authenticated CLI session. The dashboard opened at its sign-in page. No Cloudflare connector was found in plugin discovery. Account/resource inspection and test deployment need secure sign-in or a securely provisioned Worker deployment credential. Never ask for secrets pasted into chat.
2. GitHub has two connected owners, `Festmiester` and `developmentmillmoorjuniors-oss`. A write owner must be selected. The connector supports file/tree/commit operations but does not expose repository creation, and `gh` is not authenticated. Creating a separate private repo requires GitHub UI access or creation by the selected owner. Do not use an existing app repository as a substitute.
3. Google OAuth needs a game-specific client ID/secret plus the verified test origin and callback URL. No Google account or token has been reused from Juniors.
4. Floot code inspection is refused until the action allowance resets. This blocks verified source parity and legacy data migration, not independent development.

## Test deployment sequence

1. Finish the owner/account decisions and authenticate through the supported secure flow.
2. Create a separate **private** GitHub repository `millmoor-takes-over` under the selected owner. Push this source and all five living documents. Confirm the remote commit SHA. No secrets or verification fixtures belong in Git.
3. In the authorised Cloudflare account, inspect existing account/project names, then create only the game test Worker. Keep all existing resources unchanged.
4. Set the Worker secret `DATABASE_URL` from the game test project's connection string. Never print it or commit `.dev.vars.test` or `.env.integration`.
5. `npm ci`, `npm test`, `npm run build`, `npm run check:worker`, then `npm run deploy:test`. CLI default `workers_dev=false`; only the explicit test environment enables its HTTPS route.
6. Record the actual returned URL here. Open it over HTTPS, register two managers and exercise isolated accounts, office timers, bank, gear, persistence, online lists and transfers. Capture 390px phone and desktop renders. Fix any layout/CSP/runtime defects before inviting Kurt.
7. Configure Google with JavaScript origin equal to the verified test origin and redirect URI `<verified-origin>/auth/callback`. Store the client secret only in Cloudflare secrets. Test both fresh Google registration and claiming a disposable test club.
8. Invite a small test group. No production world, paid service or domain purchase is authorised by this step.

Do not report an intended Worker name as a deployed URL. Do not register a paid domain or upgrade a plan without approval.

## Commands and tests

- `npm run build`: TypeScript checking plus Vite assets.
- `npm test`: input validation and source boundary tests, no external services.
- `npm run check:worker`: real Wrangler dry-run bundle, no deployment.
- `npm run test:integration`: direct PostgreSQL integration/concurrency tests on `.env.integration` only.
- `npm run test:api`: real Worker handlers against verification PostgreSQL, no mock database.
- `npm run test:client`: real client DOM/navigation/actions through Worker handlers and verification PostgreSQL. JSDOM checks do not prove browser rendering.
- `npm run migrate -- .dev.vars.test --game-test-approved`: applies unapplied numbered SQL migrations. Requires Node.js 24 and Python 3. Review target first. Refuses database names other than `takes_over`.
- `npm run deploy:test`: explicit test-only deployment.

The first Wrangler local-server attempt failed on restricted network-interface enumeration (`uv_interface_addresses`). The test runner's original tsx CLI also hit an IPC restriction; using `node --import tsx` resolved the test-runner issue. Browser file loading was blocked by administrative policy. No restrictions were bypassed. Unit, SQL, API and client DOM tests can run without a listening server.

## Production gate

No production environment, production database or deployment automation has been created. Before production: complete Google sign-in, live HTTPS and browser QA, run the concurrency suite, review anti-abuse limits, backup/export and retention rules, review original content and legacy migration, then present the concrete release and actual test URL to Kurt for approval. GitHub CI only verifies source and never deploys.

## Recovery and continuation

Resume by reading PROJECT_STATUS.md, GAME_SPEC.md and FEATURE_CHECKLIST.md, then checking remote state. Do not re-provision this Neon project. Keep credentials in secret stores. Local secret files are excluded from commits and source archives. The source archive is an interim checkpoint until the separate GitHub repository exists.

## Platform references checked

Cloudflare's current first-party guidance was checked while preparing the source: [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Worker/asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) and [Versions/deployments](https://developers.cloudflare.com/workers/versions-and-deployments/). Static responses receive `public/_headers`; API and OAuth responses receive explicit Worker headers. The configured game test environment is a separately named Worker, not a promotion of any existing application.

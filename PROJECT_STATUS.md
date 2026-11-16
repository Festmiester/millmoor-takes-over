# Project status — start here

Updated 16 November 2026. Owner: Kurt Knowles. Project: **Millmoor Takes Over**, independent browser game, v0.1.0.

## Current position

### Follow-up batch — 16 November 2026

Deployed this batch to the existing test URL, deployment `809f0ea3503940ae8fa4d6ebfe3b540f`. Live browser verified saved QA cash remained £295, Manager File opens and Skills displays saved coaching proficiency. Existing secret bindings preserved. Google credentials remain missing.

Reviewed Lovable AppShell, CharacterModal and nav-config at commit `feb6b086253a0dfce3b63fdf64c571452e9403bd` read-only. Added compact mobile category buttons/two-column submenus and seven in-place Manager File panels using actual saved state. Google now requests verified email for an optional owner allowlist, handles cancellation/configuration errors and exposes existing-club linking. 7 unit, 12 real-database API and 28 real-backend client DOM checks passed. Native modal rendering must still be checked on deployment.
Google credentials are still absent. TinyFish could not inspect Google Console because its wallet is empty; no payment made. See GOOGLE_AUTH_SETUP.md for exact setup. Do not claim Google login or owner-only access is live yet. Keep current browser test access until Kurt has linked his club.

### Live test checkpoint — 16 November 2026, 15:29 UTC

Test game is now deployed: https://millmoor-takes-over-test.kurttev327.workers.dev/
Cloudflare plugin authenticated successfully. Separate Worker `millmoor-takes-over-test`, deployment `58eb020b60f94cb58fb5c7e968ee9826`. Existing Juniors Worker unchanged.
Live HTTPS config endpoint passed. Browser registration created clearly labelled `Deployment QA` / `Deployment QA FC`, with database-backed profile and two starter activities. Google OAuth remains unconfigured. Test account access uses the same browser cookie for seven days; signing out loses access until Google linking is implemented/configured.
GitHub repository is `Festmiester/millmoor-takes-over`; owner created it PUBLIC (do not assume private). Source upload contains no credentials. Cloudflare DATABASE_URL is a secret binding from the existing game test database, not verification or Juniors.
Build and six unit tests rerun successfully. API plugin deployment packages static client inside the Worker via `scripts/package-plugin-deploy.mjs`; normal Wrangler asset deployment remains supported. No paid plan or production deployment.
The older paragraphs below describe the pre-deployment checkpoint and are superseded by this dated live checkpoint where they conflict.

The independent source, persistent backend and first playable core are implemented and the Cloudflare test game is live. Production has not been deployed or approved. This is not full feature parity with the old Floot game.

Next: configure Google OAuth, link Kurt's existing club and disable disposable registration after verifying re-login. Cloudflare plugin and GitHub repository access now work.

## Completed

- Recovered prior hidden-rank agreement: all 13 names/thresholds, invisible advancement, exactly two starters.
- Recovered and read the 48-row comparison workbook; every row is preserved with current implementation/backlog status in FEATURE_CHECKLIST.md.
- Recovered/sampled Bootleggers videos `19148(2).mp4`, `19149(2).mp4` and existing Takes Over `19258.mp4`. Original user files remain available separately.
- Created separate Neon game project `billowing-lake-52144871`, playable-world branch `br-summer-voice-za1jzfnf`, database `takes_over`, London region.
- Created separate verification branch `br-purple-field-za1hfpw1`. All automated fixture accounts stay there; the playable-world database has no synthetic test population.
- Applied numbered SQL migrations 1–3 to both game branches. No Juniors schema/data changed.
- Implemented compact responsive navigation/header, character, equipment, bank, persistent energy/countdowns, Flyers/Coaching and rank locks, proficiency/approaches, scouting/recruitment assets, player transfers, rivals, online presence, rankings, facilities, travel, 18 chapters, profile and activity history.
- Implemented server-side Google OAuth PKCE/state/nonce/JWKS validation and secure hashed sessions. Google credentials have **not** been configured or exercised end to end.
- Implemented isolated disposable test accounts with strict test-environment checks. These use seven-day browser sessions; logout ends access unless Google linking was completed.
- Local Git source repository initialised. CI verifies only; no deployment workflow.
- All five requested living project documents created and included in the source checkpoint. GitHub upload awaits the new repository.

## Verified evidence

| Check                            | Result  | Limit                                                                                                                                                                     |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + Vite build          | PASS    | Client and Worker source typechecked; client assets built                                                                                                                 |
| Wrangler test dry-run            | PASS    | Actual Worker bundle and asset bindings; no live deployment                                                                                                               |
| Input/source boundary unit tests | 6 PASS  | Money validation, UUIDs, names, hidden progression and production deployment boundary                                                                                     |
| PostgreSQL integration suite     | 14 PASS | Real verification branch; rank boundaries, starter locks, timers, concurrent replay, bank rollback, equipment, energy, transfer races, beginner protection, rate limiting |
| Worker API smoke suite           | 11 PASS | Real handlers/database; session isolation, origin enforcement, hidden data, invalid amounts, direct rank bypass, logout and fail-closed OAuth                             |
| Client DOM workflow suite        | 21 PASS | Real client → real Worker → real PostgreSQL; office action, bank form and all current destinations                                                                        |
| Native visual QA                 | BLOCKED | File viewing is administratively blocked; local Worker server hit environment network-interface restrictions                                                              |
| Cloudflare HTTPS smoke tests     | BLOCKED | No authenticated Cloudflare account/CLI                                                                                                                                   |
| Google sign-in                   | NOT RUN | No game OAuth client/secret configured                                                                                                                                    |
| Legacy source/data parity        | BLOCKED | Fresh Floot action-allowance refusal; old source not inspected                                                                                                            |

A database test exposed an ambiguous receipt-column reference, fixed in migration 3. One initial rollback assertion incorrectly compared the regenerating energy timestamp; it was corrected to verify the consequential balances and counters. The test runner's IPC restriction was resolved using `node --import tsx`. No failed checks are counted as passes.

## Necessary user decisions/access

1. GitHub owner: `Festmiester` or `developmentmillmoorjuniors-oss`. Both are connected; do not guess a write owner. Repository creation is not exposed by the connector, and `gh` is unauthenticated. Create `millmoor-takes-over` privately under the selected owner, then push this source.
2. Cloudflare secure sign-in/deployment access. Discovery found no connector. Dashboard is at sign-in; CLI is unauthenticated. Use a supported secure sign-in flow, never pasted secrets. Do not buy a subscription or use an unrelated hosting provider.
3. Google game-specific OAuth setup once the actual HTTPS origin exists. Optional secure Juniors linking comes later.

## Outstanding game work

Full prior-source recovery; verified old-account import preserving money/items/unlocks; organised multiplayer operations; merchandise contracts/trading; staff/headquarters/businesses; richer regional effects; messaging and remaining original systems. See the 48-row checklist. Do not add inert “coming soon” routes or claim these are implemented.

Current balance choices are recorded in GAME_SPEC.md. They are a new test-world baseline where the previous material lacked final mapping, not a verified copy of Bootleggers' private formulas. Existing Floot players have not been reset or imported.

## Resume instructions

1. Read this file, GAME_SPEC.md, FEATURE_CHECKLIST.md and DEPLOYMENT.md.
2. Reuse the existing game Neon project/branches above. Never touch `muddy-scene-56344781` (Juniors).
3. Inspect Git remote and Cloudflare authentication state before creating anything. If the remote is still missing, finish the owner/repository step.
4. Deploy test only, verify live HTTPS and phone/desktop layout, configure/test Google and update these documents with actual URL/commit/test evidence.
5. Inspect Floot read-only when its allowance permits; map missing original systems and data explicitly. Never modify Floot in this project.
6. Update all five living files with each substantial batch. Keep production for Kurt's final approval. NQDArena is excluded.

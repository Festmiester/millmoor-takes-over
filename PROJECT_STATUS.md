# Millmoor Takes Over — current project status

Updated 16 November 2026. Read this file first when continuing.

## Live game

### Current release — modal results and compact phone cards

Deployment `cb4340f2d98047db99644589de1347bb` supersedes IDs below. Action results use a centred native dialog outside page flow, with focus, backdrop, Escape and dismiss support. Errors float above the page. Activities now show cost/energy/time, net payout and chance, with descriptions/full odds behind Details & odds. Phone actions sit alongside content. Shared mobile panels, profile, shop, squad and chapter rows tightened; long lists intentionally scroll. Added live next-chapter progress and conditional reward claim in Office using existing server chapter action, not new economy rules. Build and packaged assets pass; focused client modal/placement checks added. Live retained QA session completed Flyers, received centred modal and preserved saved state. Physical Android layout still needs owner review. No schema/auth changes. Lucien needs Google allowlist entry; do not open signup globally or re-enable test accounts.

### Current visual release — illustrated manager

Deployment `2c059f057a664818aa384e63814accf8` supersedes deployment IDs below. Original illustrated manager now appears in the header, profile and Manager File. Warm black-and-gold panels, compact layout and self-hosted Oswald/PT Sans typography follow the inspected Lovable direction. No gameplay, database or authentication changes. Live browser verified the portrait and Manager File using the retained Deployment QA session. Build, 9 unit tests, 16 focused client checks and 4 byte-exact packaged image/font checks passed. Mobile CSS updated; physical Android rendering has not been independently tested. See ASSET_PROVENANCE.md.

### Latest live batch — scouting and Lovable adaptations

Deployment `cd844ec787db4b22984e9c8252ebdbdc` is live. See LOVABLE_REVIEW.md for the inspected reference and exact adaptations. Added net/expected quotes, action reasons, richer outcomes, equipment slots, bank-all, squad filters/sorting, standalone manifest and offline feedback. Added five real scouting contacts, rarity-sensitive asset values/age and server capacity of 30 including listings. Existing players preserved. Migrations 005–008 applied atomically to the playable world after verification. Live browser confirmed the new office cards and saved cash; live catalog returns five contacts, capacity 30 and five profiles. Manifest serves with correct MIME type. Temporary signup remains off; Google settings preserved.

Latest deployment: `5f276b5f37694de5907ac35fad84e82e`. Live browser verified Daily Assignments shows three real goals, saved same-day progress and UTC reset countdown. Google secrets retained; signup disabled. Existing QA session intentionally retained until user linkage is verified.

https://millmoor-takes-over-test.kurttev327.workers.dev/

Repository: https://github.com/Festmiester/millmoor-takes-over (public as created by owner; no secrets committed).
Independent Cloudflare test Worker: millmoor-takes-over-test.
Account: f4a22d9ed0da8861ada7f65faa6fcac6.
Production release remains subject to Kurt's approval.

## Authentication — configured; club linkage still awaiting verification

Kurt entered game-specific Google credentials in Cloudflare and reported Google sign-in working. Live /api/config reports google=true and testAccounts=false. The Google redirect uses the correct HTTPS callback, PKCE S256 and secure cookie.
IMPORTANT: a subsequent read-only check found 0 google identities and 2 test identities in the playable-world database. Thus completed account linkage is NOT independently verified despite the user's successful sign-in report. Keep existing sessions and club visibility intact; do not invalidate old temporary sessions until actual linkage is confirmed. New temporary registration is disabled and its live POST returns Test accounts are disabled.
Preserve ALL secret_text bindings on deployments: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_GOOGLE_EMAILS. Never reset the world or re-enable test signup to run live QA.
Owner allowlist is checked against Google-verified email at sign-in. Use Connect Google from Kurt's existing club; do not create another club or edit identity manually. Investigate any error returned by Google callback and verify identity prefix becomes google on the real playable branch after consent.

## Latest gameplay batch — daily assignments

Added Daily Assignments under Main with three server-tracked objectives:
- Complete 5 activities: £40.
- Make one bank deposit: £25.
- Complete 3 net-profitable activities: £75.
Maximum £140/day. All counts are per player and UTC day, reset at 00:00 UTC. Banking and daily claims do not award rank progress.
Migration 004 adds claims table, daily status function and transaction-safe reward function. Claims use the existing receipt ledger, player locks and unique per-player/day/objective constraint. Replay and two-key concurrency tests pass.
Daily progress counts existing same-day activity history. No player balances, ranks, assets or legacy data reset.

## Implemented foundation

Compact responsive navigation/header, mobile category menus and two-column submenus; seven real Manager File sections; 13 ranks with hidden progression; two starter office activities; approaches and proficiency; server energy/cooldowns; bank/equipment; scouting/recruitment and owned players; transfer market; rivals; presence/rankings; facilities/travel; 18 campaign chapters; profile and history.
Lovable AppShell/CharacterModal/nav-config reviewed read-only at feb6b086253a0dfce3b63fdf64c571452e9403bd and informed UI changes. No builder runtime dependency.

## Database and verification

Separate Neon project billowing-lake-52144871, database takes_over, London.
Playable-world branch br-summer-voice-za1jzfnf. Verification branch br-purple-field-za1hfpw1.
Migrations 1–8 applied to both branches. Tests create fixtures ONLY on verification.
Current batch passed: 9 unit checks, 14 API checks, 14 original database integration checks (including competing buyers), 6 new scouting checks, 5 daily checks, 33 full client DOM checks plus a 16-check focused run covering Manager File transaction continuity. Build and Worker dry-run pass. Tests found two SQL naming ambiguities and an old cooldown assertion that depended on network speed; all corrected before live rollout. Browser office layout verified; actual phone review remains with Kurt.
Latest: 7 unit tests, 14 API checks, 5 daily database tests and 29 client checks passed. Daily tests cover UTC reset, player isolation, incomplete goals, duplicate replay, concurrent claims and no rank rewards. API checks verify that closing new registration preserves both current temporary-club sessions and Google-linked sessions. Build and Worker dry-run pass.
Earlier: 14 original database integration checks passed. Kurt reported successful Google sign-in, but completed database account linkage remains unverified as described above.

## Deploy/recover

Cloudflare plugin is authenticated; CLI may remain unauthenticated. Use plugin API rather than assuming CLI access. Build npm run build then node scripts/package-plugin-deploy.mjs for plugin multipart packaging; this embeds the small static client and Worker together.
Preserve secret_text bindings with keep_bindings. ENVIRONMENT=test and ALLOW_TEST_ACCOUNTS=false. Compatibility 2026-11-01, nodejs_compat, London placement, observability/traces. No paid plan.
GitHub source is updated with connector Git tree/commit/ref operations under Festmiester. Local Git history can lag those API commits; inspect remote main before writing, use expected head lease, and do not blindly push the older local branch.

## Next substantial work

Continue business/staff/passive economy, organised cooperative ventures, richer regional effects and messaging. Complete actual Google-club linkage verification without resetting the saved club. Full old Floot read-only recovery/legacy-import mapping and proficiency refinement remain. Scouting/rarity/capacity expansion is now live. FEATURE_CHECKLIST.md preserves all 48 comparisons. Current formulas are the independent game's test baseline, not verified Bootleggers internals.
Do not claim all Floot parity is complete. No legacy players imported yet.

## Non-negotiable boundaries

- No TinyFish. Kurt explicitly prohibited further usage after its credits ran out.
- Never change Millmoor Juniors repository, Worker or Neon project muddy-scene-56344781.
- Floot is read-only; NQDArena/The Grange is separate.
- No paid services, production deployment, data reset or secret exposure.
- Continue coherent tested batches; maintain PROJECT_STATUS.md, GAME_SPEC.md, FEATURE_CHECKLIST.md, CHANGELOG.md and DEPLOYMENT.md.

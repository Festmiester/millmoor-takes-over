# Millmoor Takes Over — engineering checkpoint

Updated 17 November 2026. Read this first, alongside the permanent reference and comparison workbook.

## Current live release — stamina, squad operations and boards

Deployment `014dcd68c97e4521b9ca1bf5ebd311b8`. Migrations 1–14 applied to verification and playable branches. Full balance rationale, source links and rules: PACING_REVIEW.md.

Base stamina 200; fitness adds up to 100 more. Five regeneration every 30 seconds (20-minute base refill). Client uses server-supplied limits/ticks. Existing balances, ranks and owned players are preserved.

Ventures: eight-hour manager timer shared across modes. Human mode: two managers at the host location, £500/20 stamina each, £8,000 gross on success. Public local rooms no longer require an alliance; historical private rooms remain private. Solo mode: three different available owned/unlisted players, £750/20 stamina, £4,500 success gross. Selected assets recover for eight hours even after transfer. Cancel partnered rooms explicitly before solo; empty rooms close automatically. Existing readiness cleared for changed entry terms; prior completed-run timers retained.

Messaging → Community Board now has a local whiteboard, Questions & Help and Venture Classifieds, with threads/replies, author removal, region enforcement, limits and links to open ventures. Practice now improves after success/failure with diminishing gains, without losing legacy bonuses. Advanced office expected cash returns were repaired, while failure costs remain. All four training attributes have real effects, shown in their rows.

Validation: 13 unit, 14 original integration, 41 client, 12 empire integration, 15 API, eight empire client workflows, 11 pacing assertion groups and four byte/MIME checks = 118 checks. Build/dry-run pass. Network latency exposed two timing assumptions in tests; those checks now use controlled server timestamps. Host-to-Neon egress later failed mid-suite; the remaining practice/training/partner-guard assertions passed through the Neon connector, using the saved tests/pacing-final.sql on verification only. Do not imply one uninterrupted pacing-script run passed after that network interruption. Live schema/cap/regeneration checks pass for all three clubs. Protected native visual QA remains limited to the signed-out browser profile.

## Previous empire release

Deployment `cacb984315c442f8bf33a0947e853239` at https://millmoor-takes-over-test.kurttev327.workers.dev/
Repository: https://github.com/Festmiester/millmoor-takes-over

Retains the accepted compact illustrated-manager layout. Five new real destinations: Club Businesses, Merchandise Trading, Alliances, Joint Ventures and Manager Mail. Persistent server systems, not placeholders.

- Businesses: three enterprises, rank 1/3/5, five levels, ten-minute income cycles, eight-hour storage cap, collection and old-rate upgrade settlement. No energy/rank rewards.
- Trade: three goods, server region/day quotes, £3 spread, 100-unit storage, 1–20 units/transaction and a 15-second trade timer. Travel changes quotes; no rank rewards.
- Alliances: found for £250 at Pee Wee; 12-manager limit, join/leave, automatic owner succession and private room. Leaving cancels waiting ventures involving that manager.
- Ventures: two Thug-or-higher alliance members; both explicitly ready. Host resolves after atomic checks of £80 and ten energy each and both cooldowns. Success £400 gross each; failure £0. Both receive a 30-minute timer. Combined power raises chance from 65% to a 90% cap. Waiting rooms expire after 24 hours. Hidden advancement stays server-side.
- Mail: private and alliance messages, read markers, 1,000 characters, 100 sends/day. Only participants/current members get bodies. Latest 50 relevant messages shown. World pages poll outside focused forms/dialogs every 30 seconds.

## Verification

100 passing checks: 10 unit, 14 original database integration, 15 API, 40 client routes/workflows, 12 empire transaction/privacy, five full empire form workflows and four image/font byte/MIME checks. Build and Worker dry-run pass. Forms tested through real client → Worker → verification database, including partner state after a venture. All fixtures remain on verification. Live HTTP confirms current client, Google configuration and authenticated empire API. Live ledger also confirms business purchases/upgrades and alliance founding are saving in the owner's active club. Native browser is now signed out; protected visual review is limited by that session. Do not re-enable registration for QA. Physical Android review remains with owner.

## Database, authentication and preservation

Neon project billowing-lake-52144871; database takes_over. Playable br-summer-voice-za1jzfnf; verification br-purple-field-za1hfpw1. Migrations 1–14 are now applied to both. Migration 009 source recovered exactly from previously verified database functions after scratch resumed with older source. Migration 010 is additive. Three live clubs snapshotted: two unchanged, owner club actively progressed during rollout with normal activity/bank/daily/business/alliance entries. Do not describe active balances as byte-identical. No reset, live fixtures or manual identity changes.

17 November read-only check now confirms ONE Google-linked club and two retained temporary clubs, superseding old zero-link notes. Live config keeps google=true and testAccounts=false. Keep all sessions/allowlist intact. Lucien access explicitly deferred.

## Existing core

13 hidden-advancement ranks, exactly Flyers/Coaching initially, approaches/tiers/proficiency, server energy and timers, five scouts with weighted rarity/age/value, 30-player capacity including listings, recruitment, equipment, bank/ledger, escrowed transfers, training/facilities/travel/rivals, presence/rankings, daily assignments, 18 chapters, profiles, Manager File, history and modal results.

## Remaining scope — not full old-game parity

Staff/upkeep, timed item modifiers, richer moderation/blocking and mailbox pagination, legacy Floot recovery/import and broader balance/load work remain. Broader forum moderation/history and club statistics/find-manager tools remain backlog. Optional Club Games/physio/discipline are not implemented and have no fake routes. No claim of exact Bootleggers internals or full Floot parity.

## Deployment and recovery

Cloudflare account f4a22d9ed0da8861ada7f65faa6fcac6; Worker millmoor-takes-over-test. Test only; no paid upgrades. Build then scripts/package-plugin-deploy.mjs. Preserve ALL secret_text: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_GOOGLE_EMAILS. ENVIRONMENT=test, ALLOW_TEST_ACCOUNTS=false. No paid placement hints.

GitHub main is authoritative. A resumed scratch checkout had unrelated older history; a new worktree was made from fetched main. Do not push an older checkout. Verify head and use expected-SHA leases. Keep this file, GAME_SPEC.md, FEATURE_CHECKLIST.md, CHANGELOG.md and DEPLOYMENT.md current.

No TinyFish. Millmoor Juniors, Floot and The Grange/NQDArena remain separate and untouched. No production rollout, resets, subscriptions or real-money play.

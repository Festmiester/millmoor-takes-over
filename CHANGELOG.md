# Changelog

## 2026-11-16 — illustrated manager and visual refresh
- Added an original illustrated manager to header, profile and Manager File.
- Applied compact warm black-and-gold styling and self-hosted Oswald/PT Sans fonts.
- Added byte-safe image/font packaging and four asset smoke checks. No gameplay or schema changes.

## 2026-11-16 — Lovable review, scouting depth and usability
- Adapted the strongest verified Lovable UI details; full comparison in LOVABLE_REVIEW.md.
- Added net/expected cash quotes, clear blocked action labels, richer outcome feedback and signing cards.
- Added four further scouting tiers, public rarity profiles, server-generated age and rarity-sensitive values.
- Enforced 30 owned players including active transfer listings, with receipt replay checked before capacity.
- Added squad position filters/sorting, rarity badges, equipment slot cards and bank-all shortcuts.
- Kept Manager File open after actions; added standalone app manifest and offline feedback.
- Migrations 005–008 preserve existing assets. Verification found SQL naming conflicts; follow-up migrations fix these before live rollout. Pending migrations now apply as one atomic batch.

## 2026-11-16 — Google private test and daily assignments
- Disabled temporary registrations. Google settings and redirect work, but database check found existing clubs are not yet Google-linked. Preserve existing sessions until linkage completes.
- No temporary player data deleted or sessions revoked.
- Added three server-tracked daily assignments: 5 activity attempts (£40), one bank deposit (£25) and 3 profitable activities (£75).
- UTC midnight reset, independent once-per-day claims, transaction ledger and replay/concurrency protection. No rank progression awarded for claims or banking.
- Added migration 004 and real-database daily tests on the verification branch. No TinyFish usage permitted going forward.

## 2026-11-16 — Navigation, manager file and Google readiness
- Added Lovable-inspired mobile category buttons with two-column destination menus.
- Added Character, Items, Players, Skills, Bank, Wallet and Perks panels inside the Manager File.
- Added verified-email Google allowlisting, cancellation handling and account-link status.
- Passed 7 unit, 12 API and 28 client DOM checks. Real Google credentials remain pending.

## 2026-11-16 — First public test deployment
- Published independent test Worker and HTTPS game URL.
- Confirmed live test manager registration and profile rendering.
- Added reproducible API-plugin packaging for the small static client and backend.
- Google sign-in remains pending; test browser sessions enabled.

## 0.1.0 — 16 November 2026

### Implemented

- Independent HTML/CSS/TypeScript client, Cloudflare Worker and Neon schema, with no Floot/Lovable/Replit runtime dependency.
- Isolated game test project and separate verification branch in London.
- All 13 agreed hidden ranks, rank-gated progression and two initial activities.
- Persistent balances, offline energy, independent activity timers, mastery and Safe/Steady/Bold approaches.
- Owned scouting/recruitment assets, equipment slots and player market with atomic transfers and cancellation.
- Secure server sessions, Google OAuth code path, presence, rankings and protected rival friendlies.
- Training, club ground investment, travel, profile, activity log and 18-chapter original campaign.
- Compact responsive navigation, persistent resources and character panel with original SVG/CSS artwork.
- Five living documents, 48 recovered comparison rows, local Git and verification-only CI.

### Fixed during verification

- Qualified the receipt result column to remove a PL/pgSQL ambiguity (migration 3).
- Preserved pending request keys after uncertain network responses, with explicit retry before another move.
- Prevented pending actions crossing browser-account changes.
- Added bounded integer/UUID validation, same-origin JSON/header checks and test-only registration gates.
- Switched tests to Node's tsx import path after a restricted IPC failure.

### Verified

6 unit checks, 14 PostgreSQL integration checks, 11 Worker API checks and 21 client DOM checks. TypeScript/Vite build and Wrangler test packaging pass. All database fixtures are isolated on the verification branch.

### Pending / blocked

GitHub owner/repository creation, Cloudflare authentication/test deployment, Google credentials and actual OAuth test, live browser visual/HTTPS review, read-only old Floot source recovery and data import, plus the remaining systems explicitly listed in FEATURE_CHECKLIST.md. No production deployment and no changes to Millmoor Juniors or Floot.

# Millmoor Takes Over — game specification

## Current pacing rules — supersede earlier numbers below

See PACING_REVIEW.md for research and full rules. Base stamina 200, fitness +5 per level up to 300; regenerate +5 per 30 seconds. No existing balance/asset reset. Human ventures: two managers in the host location, £500 and 20 stamina each, £8,000 gross success payout, shared eight-hour cooldown. New public rooms require no alliance. Solo: manager plus three different owned/unlisted players, £750 and 20 stamina, £4,500 gross success payout; both manager and asset IDs recover eight hours. Fatigue follows transfers. Human success/failure hidden progress 1500/100; solo 750/50. Withdraw readiness for changed terms; do not retroactively extend old completed timers.

Local whiteboard, Questions and Venture Classifieds support threads/replies and author-only soft removal, 1,000-character posts, eight seconds between posts and 60/day. No cash/rank/stamina reward/cost for posting. Existing mail stays private.

Practice rises +1 on success/+0.5 on failure; capped 30-point bonus with diminishing returns and preserved nonnegative legacy bonuses. Advanced office rewards target positive fresh cash expectation in every approach. Focus gives +1 power/level and +1 activity chance per four levels (max five chance points). Resilience +2 power/level, leadership +1, fitness +5 capacity/level to cap and +1 power per four levels. Equipment and facility effects persist.

## 17 November — persistent empire expansion

Businesses unlock at ranks 1/3/5: Matchday Programmes (£180, £4 per ten minutes), Merchandise Stall (£900, £14) and Community Academy (£3,000, £40). Five levels multiply base income by level. Upgrade cost = purchase price × next level. Only completed cycles accrue, capped at 48/eight hours. Below-cap collection retains partial time; capped collection restarts the clock. Upgrades settle completed cycles at the old rate, resetting partial time. No energy/rank rewards.

Regional merchandise quotes are server-derived by region and UTC day. Sell quote = buy quote minus £3. Storage 100 units, transaction 1–20, shared trade cooldown 15 seconds. Existing £50 travel/two-minute timer applies. No rank rewards for trading.

Alliances unlock at Pee Wee, cost £250 to found and hold 12 managers. Open join/leave, private room and owner succession to longest-serving remaining member. Empty alliance becomes inactive. Leaving cancels the manager's waiting ventures.

Joint tournaments require two Thug-or-higher alliance members, both ready. Each must have £80, ten energy and no venture timer when the host starts. Both are checked/locked atomically. Chance = min(90,65+integer(combined power/20)) percent. Success pays £400 gross and awards 550 hidden progress each; failure pays £0 and awards 25 hidden progress. Both receive a 30-minute cooldown. Waiting rooms expire after 24 hours. These are original test balance decisions, not Bootleggers formulas.

Private/alliance mail is plain text, 1–1,000 characters and 100 sends/day. Only participants/current alliance members get bodies. Inbox read markers and latest 50 relevant messages. World views poll every 30 seconds outside focused forms/dialogs. No email or club-app records exposed.

Action results are modal overlays rather than page banners. Activity summaries retain cost, energy, timer, chance and net reward; detailed assumptions and rarity odds are expandable. Office exposes existing campaign successful-move progress and a claim shortcut when both rank and move requirements are satisfied. It does not expose hidden rank progress or change chapter payouts.

## Visual identity

Warm black/brown surfaces and antique-gold panels/actions, condensed Oswald headings and PT Sans body text. Compact responsive shell. An original illustrated football gaffer is the default character portrait across the header, profile and Manager File; it is not a user photograph or a change to account identity.

## Scouting and usability follow-up

Five scouting contacts unlock at ranks 1/2/4/7/10, with costs £25/90/300/1000/3500 and existing per-action energy/cooldowns. New acquisitions get age 17–33, power tier×5 through tier×5+9, and weighted rarity from mto_scout_profile (normalise returned weights for probabilities). Base value is max(cost×2+40, power×12), multiplied Local×1, Promising×2, Elite×4, Legendary×8. Existing players retain original values and metadata. These are independent-game test balance choices.

Capacity is 30 OWNED players including active listings; buying/scouting at capacity is rejected before costs. Replays return the original receipt even when full. Listing cannot bypass capacity. Oversized legacy squads are retained and may sell/release players.

Quotes show outlay, gross payout, net success payout and expected cash using actual approach/chance/facility adjustments; expected cash explicitly excludes asset value. No heat/fines or promotion skill-point system is implied. See LOVABLE_REVIEW.md for adopted UI versus deliberately separate gameplay designs.

Current private test: Google configured; completed club linkage remains unverified after database inspection. New temporary signup disabled; existing sessions retained to avoid lockout. Daily Assignments under Main: 5 activities (£40), one bank deposit (£25), 3 net-profitable activities (£75). All recorded on server per player and UTC date, maximum £140/day, claimable once per objective. No XP from daily claims. No player data deleted.

Follow-up UI: compact mobile categories and seven real Manager File panels. Private Google testing uses verified-email allowlisting; credentials and live consent remain pending. See GOOGLE_AUTH_SETUP.md.

Last updated: 16 November 2026. Independent browser game, version 0.1.0.

## Scope and separation

HTML/CSS/TypeScript client, Cloudflare Workers server, Neon PostgreSQL persistence and GitHub source control. Original football content and assets. Millmoor Juniors, Floot project `158110d8-0fb3-439f-9355-f08e69991070` and future NQDArena are separate. Never write to their code or databases. No AI-builder runtime or subscription is required by this source.

Production deployment requires Kurt's explicit approval. The authorised deployment target now is an isolated playable **test** world. Do not claim a live URL until Cloudflare deployment and HTTPS smoke tests succeed.

## Recovered sources and precedence

1. Current user brief: independent stack, Google sign-in, multiplayer, isolated resources.
2. Prior agreed hidden-rank specification, recovered from conversations on 16 November: exactly two starter activities, hidden advancement and increasing rank thresholds.
3. `bootleggers_vs_takes_over_next_update.xlsx` (48 comparison rows), recovered and read in full.
4. `19148(2).mp4` and `19149(2).mp4`: Bootleggers reference videos. Sampled contact sheets show compact category menus, persistent resources, character panel, rank locks, shops, banking and online lists.
5. `19258.mp4`: current Takes Over footage. Sampled throughout. It shows visible owner XP/levels, repeated external club links, character tabs, office outcomes, regional trading, development, recruitment and bank. These are evidence of the old interface, not proof of its backend.
6. Existing Floot code recovery is **blocked** by a fresh daily-allowance refusal. No code parity or data import is claimed. Do not substitute guessed source or modify Floot.

The workbook's migration/no-reset requirement applies to existing accounts. This new test world creates separate beginner accounts. It does not replace or reset any existing player data. A reviewed export/import mapping remains pending.

## Core loop

A new manager receives £250 cash, £0 bank savings and 100 energy in Rotherham. Only Deliver Flyers and Community Coaching can be played initially. Successful actions earn money, hidden rank progress and activity-specific proficiency. Failures consume the displayed entry fee and energy, then apply the same cooldown.

Server time, server randomness and database row locks determine the result. The browser never supplies rewards, rank progress, ownership, effective odds or balances. Every action has a client-generated UUID receipt key; replay returns the original result without applying it twice.

## Hidden ranks — internal specification only

These thresholds were the **agreed Takes Over proposal**, not a verified reproduction of Bootleggers' undisclosed formula. Never expose them through the client, catalogue, API responses, progress bar, percentage or result messages.

| Index | Rank                  | Internal threshold |
| ----: | --------------------- | -----------------: |
|     0 | Scum                  |                  0 |
|     1 | Pee Wee               |                450 |
|     2 | Thug                  |              1,500 |
|     3 | Gangster              |              4,000 |
|     4 | Hitman                |              9,000 |
|     5 | Assassin              |             18,000 |
|     6 | Boss                  |             35,000 |
|     7 | Respectable Boss      |             65,000 |
|     8 | Godfather             |            110,000 |
|     9 | Respectable Godfather |            180,000 |
|    10 | Don                   |            290,000 |
|    11 | Respectable Don       |            460,000 |
|    12 | Legendary Don         |            750,000 |

## Current test-world balancing

These are explicit initial implementation choices where the recovered material did not supply a final rank-to-activity mapping. They remain adjustable after playtesting and old-source recovery.

| Activity               | Unlock                |   Cost | Base payout on success | Energy | Cooldown | Base chance |
| ---------------------- | --------------------- | -----: | ---------------------: | -----: | -------: | ----------: |
| Deliver Flyers         | Scum                  |     £0 |                    £30 |      3 |      15s |         68% |
| Community Coaching     | Scum                  |     £0 |                    £45 |      5 |      20s |         65% |
| Local Sponsorship      | Pee Wee               |    £40 |                   £125 |      8 |      35s |         48% |
| Regional Kit Deal      | Thug                  |   £100 |                   £330 |     12 |      75s |         40% |
| Regional Cup           | Gangster              |   £250 |                   £750 |     18 |     120s |         38% |
| National Exhibition    | Hitman                |   £600 |                 £1,800 |     25 |     180s |         32% |
| Broadcast Partnership  | Boss                  | £1,800 |                 £5,500 |     35 |     300s |         25% |
| Global Football Rights | Respectable Godfather | £6,000 |                £18,000 |     45 |     600s |         20% |
| Scout Local Talent     | Pee Wee               |    £25 |     £70 + owned player |      6 |      35s |         55% |
| Talk to Local Agents   | Pee Wee               |    £60 |    £150 + owned player |      8 |      45s |         48% |
| Youth Trials           | Thug                  |   £120 |    £300 + owned player |     12 |      75s |         40% |
| Professional Deals     | Hitman                |   £400 |  £1,000 + owned player |     20 |     180s |         32% |
| Elite Representatives  | Respectable Boss      | £1,500 |  £4,000 + owned player |     30 |     300s |         25% |
| Football Legends       | Don                   | £5,000 | £14,000 + owned player |     40 |     600s |         18% |

Safe: +10 percentage points success, payout ×0.8. Steady: baseline. Bold: −10 points, payout ×1.3. Final odds clamp to 10–95%. Each activity has its own mastery, capped −20 to +30 points. Success increases mastery by 4 initially with diminishing returns; failure reduces it by 3. Facilities contribute at most 6 points. Displayed exposure is a tier label, not a separate heat/jail mechanic.

All activities have a payout greater than their entry cost on success. Expected value is not guaranteed positive for every advanced action at low mastery. No real-money features or gambling prizes exist.

## Persistence and multiplayer

- PostgreSQL stores accounts, balances, hidden advancement, independent timers, proficiency, inventory, squad, attributes, region, facility and campaign chapter.
- Lazy energy regeneration: +2 per whole minute, maximum 100, including time offline. Server state is refreshed every 30 seconds while visible; local countdown uses server clock offset.
- Presence: online means an authenticated state request in the last two minutes. No socket server is required for this asynchronous game.
- Hall of Fame: top 50 by hidden progress and wins. It exposes rank names, fictional wealth, club, region and online state, never progress totals.
- Scouting/recruitment succeeds into permanent original player assets, weighted Local/Promising/Elite/Legendary. Duplicate names do not imply duplicate asset IDs.
- Transfer listings escrow owned players. Cancelling restores the asset. Buying atomically charges buyer, credits seller and transfers ownership. Ordered participant locks prevent deadlocks; listing locks prevent double purchases.
- Rival friendlies unlock at Thug. Beginners are protected. Winner earns £75 and hidden progress; opponent loses no money. Challenge timer 180 seconds, cost 15 energy.
- Eight original equipment items. One equipped item per slot. Equipped power affects rival odds; unequipped items do not.
- Training opens at Pee Wee; £20 and 10 energy, shared 60-second training timer. Fitness, Focus, Leadership and Resilience are separate attributes; current friendly power uses Leadership plus gear/facilities. The other attributes are recorded but do not yet influence match mechanics.
- Club facilities open at Thug, cap 10, cost £500 × next level², add power and bounded activity odds.
- Travel opens at Pee Wee. Four regions: Rotherham, Sheffield, Doncaster and Barnsley. £50 fare, 120-second timer. Region currently changes location; regional market pricing is pending.
- Road to Legend: 18 original chapters. Each requires another 10 successful moves plus its specified rank. Claiming rewards is atomic and sequential.

## Authentication and security boundaries

Google OAuth code flow uses PKCE, state and nonce cookies, server-side token exchange and Google JWKS validation of signature, issuer, audience and nonce. Tokens never go into browser localStorage. Google subject is the account identity; email is not required or stored. New Google accounts can set their names in My Manager.

Test accounts exist only with both `ENVIRONMENT=test` and `ALLOW_TEST_ACCOUNTS=true`. Sessions are random 256-bit bearer cookies, hashed in PostgreSQL, HttpOnly, SameSite=Lax and Secure over HTTPS, with seven-day expiry. Test sign-out ends access unless the club has been linked to Google. Linking can claim only the currently authenticated test identity. If Google already owns a different club, it signs into that existing club; it does not silently merge.

Every mutation checks same-origin plus a custom header and JSON content type. The Worker resolves the account from its session; clients cannot select their acting player. Inputs are bounded and parameterised. PostgreSQL performs gameplay atomically. Rate limits are 90 actions/minute/account and 5 test registrations/minute/IP hash. This is a starting test-world limit, not a comprehensive bot defence.

Future Juniors linking must use a separate consented proof flow. Do not share cookies, copy patient/child information, trust an email match as proof or reuse another application's database credentials.

## Design direction

Original red/charcoal identity, restrained cream highlights, narrow desktop sidebar, central activity area and right manager status. Small rectangular controls, maroon section strips, concise rows and no oversized tile navigation. On small screens, Menu opens grouped two-column destinations. Persistent compact header contains character, club, rank, region, cash and energy/countdown. No external Back to Millmoor Juniors link in game navigation. Original SVG crest, CSS pitch art and CSS manager silhouette; no Bootleggers images or copied writing.

Client DOM checks cover all current destinations and real action/bank responses. Native browser visual review is blocked by this environment's file-view policy and local server restrictions. Live mobile and desktop screenshots remain required after test deployment.

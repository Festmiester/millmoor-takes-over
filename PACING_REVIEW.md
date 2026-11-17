# Stamina, ventures and community review — 17 November 2026

## Reference and decisions

Bootleggers' public wiki describes a four-person Organised Crime and an eight-hour base timer, with Classifieds used to recruit a team:
https://www.bootleggers.us/w/index.php?title=Organized_Crime
Its energy page describes a 400 starting capacity and training extensions:
https://www.bootleggers.us/w/index.php?title=Criminal_Energy
Older Buzz articles describe different timers, so they are historical evidence, not the current baseline. An exact current recharge rate was not established. Millmoor figures below are original balance choices, not claimed Bootleggers formulas.

## Stamina

Base capacity 200. Fitness adds five per level above one, capped at 300. Recover five per completed 30-second interval, including offline time. A base empty bar takes 20 minutes to fill, versus the old 50 minutes. Active starter interleaving lasts substantially longer; activity costs/timers are retained. Existing stored stamina is preserved rather than gifting a refill. Client prediction uses the server's capacity, interval and regeneration fields.

## Ventures

| Mode | Team | Entry | Success gross | Success net | Timer |
|---|---|---:|---:|---:|---|
| Human | Two Thug-or-higher managers in the host location | £500 each | £8,000 each | £7,500 each | 8 hours each |
| Squad | Manager plus three different owned, unlisted players | £750 | £4,500 | £3,750 | 8 hours for manager and selected players |

Both cost 20 stamina. Failure still pays the entry and gives no cash reward. Human success 65–90%, based on combined club power. Squad success 55–85%, based on selected player power and facilities. No fake online players. Squad recovery follows player IDs through transfers. Both modes share the manager timer. A waiting partnered venture must be explicitly cancelled/completed before using the squad; an empty host room closes when the solo action succeeds. No alliance is needed for a new public location-based tournament; historical private alliance rooms stay private.

Existing readiness is cleared because the entry terms changed; existing completed-run cooldowns are not retroactively extended. Human success/failure hidden progress 1500/100; squad 750/50. Hidden totals never appear in player screens. At base human odds, expected cash is £4,700 per attempt; a 65% squad example gives £2,175. Human teamwork is deliberately better than the fallback.

## Community

Location whiteboard, Questions & Help and Venture Classifieds. Topics, replies, author names/clubs, timestamps, links to open ventures and author-only soft removal. Plain text, 1,000-character body, eight seconds between posts and 60 posts/day. No stamina cost, cash or rank reward. Visibility and reply permissions use server-side current region, not client-supplied location. Latest 100 relevant post rows are shown; extended history/moderation remains future scope. Existing private mail and alliance chat remain separate.

## Worthwhile actions

Office rewards now target a positive fresh-proficiency expected return for each approach, including high-rank activities that previously had negative expected cash. Integer payout rounding has a small buffer. Scouting still yields owned player assets; its cash-only quote excludes that asset value and is labelled accordingly. Rewards do not guarantee success.

Practice grows by one on success and half on failure. Bonus has diminishing returns and a 30-point cap; earned legacy bonuses are retained and negative legacy modifiers no longer trap players in a failure spiral. Purchases/blocked actions do not grant practice. Replays cannot grant it twice.

Leadership adds club power; focus adds power plus a bounded activity-chance bonus every four levels; resilience adds two power per level; fitness improves capacity and contributes power every four levels. Training costs/timers are unchanged and its actual benefits are shown.

## Verification scope

Separate verification database tests cover stamina ticks/caps, same-location ventures, costs/replay, solo ownership/duplicates/fatigue/transfer, partner protection, regional board/replies/removal/rate limit, practice/diminishing returns, fresh office expectations and real training effects. Client workflows exercise solo selection and recovery, posting to the whiteboard and creating a classified topic. No live fixture posts/messages or invented online accounts are created.

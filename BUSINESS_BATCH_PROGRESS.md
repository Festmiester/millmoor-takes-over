# Business economy integration — safe development branch

## Important discovery
The live Neon database already contains a complete business system, apparently built during the earlier Work session, but not exposed in the checked-in Worker/frontend:
- `mto_business_catalog`: programmes (£180, £4/10 min), merchandise (£900, £14/10 min), academy (£3,000, £40/10 min).
- `mto_businesses`: player_id, business_id, level, collected_at.
- `mto_business_action(pid,request_key,action_kind,bid)`: buyBusiness, collectBusiness, upgradeBusiness, with receipt idempotency.
- `mto_business_status(pid)`: catalog, owned levels, available income, rates, costs, 10-minute ticks and eight-hour cap.

The initially proposed `009_business_foundation.sql` conflicted with the existing table structure; **it was removed from this branch**. It must never be applied to the playable database.

## Implemented on development branch
- Worker authenticated `GET /api/businesses` using `mto_business_status`.
- Worker action dispatch for buyBusiness, collectBusiness, upgradeBusiness using `mto_business_action`.
- Validation of business IDs and action types.
- Compact Club Businesses page showing ownership, earnings, buy, collect and upgrade controls.
- Business action validation tests.

## Database test
Created a separate Neon branch `feature-business-verification` (`br-curly-smoke-za4tsgdo`). Ran a transaction-backed SQL test on the copied database using a disposable player. Assertions passed for purchase debit, duplicate UUID retry, 30-minute earnings collection and status catalog. No production data was modified.

## Before merge/deploy
- Check GitHub Actions build/test results for the latest commit.
- Run full browser/API integration against a test Worker configured to use the verification branch.
- Check 8-hour cap, upgrade settlement, concurrent collection and low-funds/rank paths.
- Review main branch for new changes by the other Work session.
- No changes to main or the live Worker until all checks pass.

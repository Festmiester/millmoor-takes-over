# Feature completion — development branch

## Batch 1: business economy foundation (not deployed)

The additive migration `009_business_foundation.sql` introduces three purchasable business types, per-player ownership, and two database functions:

- `mto_business_purchase(player_id, request_uuid, business_type)`: locks the player row, checks rank, funds and duplicate ownership, debits cash and records an idempotent receipt and event.
- `mto_business_claim(player_id, request_uuid, owned_business_uuid)`: locks the player and owned business, pays whole-hour income, preserves sub-hour remainder, caps accrual at 12 hours per claim and records an idempotent receipt.

The migration **has not been applied to Neon**. The live Worker, main branch, current accounts and balances remain unchanged. A compact Club Businesses page and authenticated API routes have now been written on this development branch, but they are not deployed and cannot work until the migration is applied.

### Required verification before integration

1. Run the migration against a dedicated disposable Neon test branch, never the playable database.
2. Verify purchase: unknown business, low rank, insufficient funds, duplicate purchase, correct debit, event and receipt.
3. Verify claim: zero-hour, partial-hour remainder, exactly one hour, 12-hour cap, retry with the same UUID, wrong owner and simultaneous claims.
4. Verify that existing actions, sessions, transfers and daily rewards still work.
5. DONE IN SOURCE: Added authenticated Worker endpoints, request validation, a compact Club Businesses screen and input-validation tests. Still requires execution and integration verification.
6. Run unit, integration, API and client tests; review diff against latest main before considering a merge.
7. Apply migration to playable database only after tests pass and an approved backup/rollback plan exists.

### Current known limitation

The purchase and claim functions are now wired to the client in source only. The database functions, UI and endpoints have NOT passed a build or database integration test. An attempt to clone the public repository from the local test environment failed due to unavailable DNS/network access. Do not merge or deploy until tests are run and any failures corrected. No deployment or production database migration has been performed.

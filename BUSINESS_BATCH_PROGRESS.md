# Feature completion — development branch

## Batch 1: business economy foundation (not deployed)

The additive migration `009_business_foundation.sql` introduces three purchasable business types, per-player ownership, and two database functions:

- `mto_business_purchase(player_id, request_uuid, business_type)`: locks the player row, checks rank, funds and duplicate ownership, debits cash and records an idempotent receipt and event.
- `mto_business_claim(player_id, request_uuid, owned_business_uuid)`: locks the player and owned business, pays whole-hour income, preserves sub-hour remainder, caps accrual at 12 hours per claim and records an idempotent receipt.

The migration **has not been applied to Neon**. The live Worker, main branch, current accounts and balances remain unchanged. The feature is not yet accessible from the UI.

### Required verification before integration

1. Run the migration against a dedicated disposable Neon test branch, never the playable database.
2. Verify purchase: unknown business, low rank, insufficient funds, duplicate purchase, correct debit, event and receipt.
3. Verify claim: zero-hour, partial-hour remainder, exactly one hour, 12-hour cap, retry with the same UUID, wrong owner and simultaneous claims.
4. Verify that existing actions, sessions, transfers and daily rewards still work.
5. Add authenticated Worker endpoints, request validation and a compact Club Businesses screen with accurate server-derived figures.
6. Run unit, integration, API and client tests; review diff against latest main before considering a merge.
7. Apply migration to playable database only after tests pass and an approved backup/rollback plan exists.

### Current known limitation

The purchase and claim functions are foundations only. They must not be exposed as working gameplay until tested end-to-end. No deployment or production database migration has been performed.

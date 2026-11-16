# Google sign-in — remaining setup

CONFIGURED, LINKAGE STILL PENDING: Kurt entered secrets and reported sign-in working on 16 November 2026. Later database check found 0 Google identities and 2 temporary clubs in the playable world. API reports google=true/testAccounts=false. Preserve current sessions and use Connect Google from the saved club, then verify actual database identity/second-browser access. Do not use TinyFish: owner explicitly prohibited further use.

Live game: https://millmoor-takes-over-test.kurttev327.workers.dev/

Server code is ready for authorization-code OIDC with PKCE, state, nonce, issuer/audience/signature checks and verified-email allowlisting. A real Google sign-in has NOT completed. Cloudflare plugin works; TinyFish Google Console inspection could not start because its wallet is empty.

## Google configuration

Open https://console.cloud.google.com/auth/overview. Use a separate Millmoor Takes Over project or separate game client in an appropriate personal project; do not alter Juniors credentials. Set branding to Millmoor Takes Over with your support/contact email. Keep audience External in Testing and add your own email as the only test user. Create a Web application OAuth client called Millmoor Takes Over Test.

| Setting | Exact value |
| --- | --- |
| JavaScript origin | `https://millmoor-takes-over-test.kurttev327.workers.dev` |
| Redirect URI | `https://millmoor-takes-over-test.kurttev327.workers.dev/auth/callback` |
| Scopes | `openid profile email` |

## Secure credential entry

Cloudflare Dashboard → Workers & Pages → millmoor-takes-over-test → Settings → Variables and Secrets. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ALLOWED_GOOGLE_EMAILS` as Secret entries. The allowlist contains only your exact Google email. Do not paste secrets into chat or GitHub. Leave DATABASE_URL intact. No paid plan is required for this setup.

Return to the browser containing your current game club session and select Connect Google to claim that club. Signing into Google first in another browser creates a new club. If that happened, do not overwrite either club: inspect and arrange an intentional merge. Existing Google identity wins when linking an already-linked Google account.

After configuration, the coding chat must verify config and redirect parameters without revealing secrets/codes, then user completes Google consent. Confirm the SAME player ID, cash, squad and rank, and re-login from a second browser. Only then set ALLOW_TEST_ACCOUNTS=false. This closes new disposable registrations but does not revoke existing test sessions; strict owner-only isolation requires inspecting and revoking non-owner sessions separately, not deleting players.

Required evidence: config google=true; owner consent and account linkage work; second browser opens same player; unlisted verified email rejected; cancellation safe; logout/re-login work. Do not mark complete merely because OAuth code or a button exists.

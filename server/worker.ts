import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  GameError,
  text,
  validateAction,
  verifyGoogleAccess,
} from "./validation";
interface Env {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOW_TEST_ACCOUNTS?: string;
  ENVIRONMENT?: string;
  ALLOWED_GOOGLE_EMAILS?: string;
  ASSETS: Fetcher;
}
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
const cookies = (r: Request) =>
  Object.fromEntries(
    (r.headers.get("Cookie") || "").split(";").map((s) => s.trim().split("=")),
  );
const cookie = (name: string, value: string, r: Request, age = 604800) =>
  `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
async function body(r: Request) {
  if (Number(r.headers.get("content-length")) > 2048)
    throw new GameError("Request too large", 413);
  const raw = await r.text();
  if (raw.length > 2048) throw new GameError("Request too large", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new GameError("Invalid JSON");
  }
}
async function session(r: Request, sql: NeonQueryFunction<false, false>) {
  const value = cookies(r).mto_session;
  if (!value) return null;
  const rows =
    await sql`SELECT player_id FROM mto_sessions WHERE token_hash=${await hash(value)} AND expires_at>now()`;
  return rows[0]?.player_id as string | undefined;
}
async function startSession(
  pid: string,
  r: Request,
  sql: NeonQueryFunction<false, false>,
) {
  const t = token();
  await sql`INSERT INTO mto_sessions(token_hash,player_id,expires_at) VALUES(${await hash(t)},${pid},now()+interval '7 days')`;
  return cookie("mto_session", t, r);
}
async function throttle(
  sql: NeonQueryFunction<false, false>,
  key: string,
  limit: number,
) {
  const rows = await sql`SELECT mto_throttle(${key},${limit}) AS ok`;
  if (!rows[0]?.ok)
    throw new GameError("Too many requests. Please try again in a minute", 429);
}
async function handle(r: Request, env: Env) {
  const url = new URL(r.url),
    path = url.pathname;
  if (path === "/api/config")
    return json({
      testAccounts:
        env.ENVIRONMENT === "test" && env.ALLOW_TEST_ACCOUNTS === "true",
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      environment: env.ENVIRONMENT || "local",
    });
  if (path === "/api/health")
    return json({
      service: "millmoor-takes-over",
      environment: env.ENVIRONMENT || "local",
      status: env.DATABASE_URL ? "configured" : "database_missing",
    });
  if (!path.startsWith("/api/") && !path.startsWith("/auth/"))
    return env.ASSETS.fetch(r);
  if (!env.DATABASE_URL)
    throw new GameError("The game database has not been configured", 503);
  const sql = neon(env.DATABASE_URL);
  if (r.method === "POST") {
    if (
      r.headers.get("Origin") !== url.origin ||
      r.headers.get("X-MTO-Request") !== "1" ||
      !r.headers.get("content-type")?.includes("application/json")
    )
      throw new GameError("Request origin rejected", 403);
  }
  if (path === "/api/catalog" && r.method === "GET") {
    const results = await sql.transaction([
      sql`SELECT id,name FROM mto_ranks ORDER BY id`,
      sql`SELECT id,title,description,category,tier,rank_required AS "rankRequired",cost,reward,energy,seconds,chance,asset FROM mto_activities ORDER BY rank_required,tier,id`,
      sql`SELECT id,title,slot,price,power,rank_required AS "rankRequired",description FROM mto_items ORDER BY price`,
    ]);
    return json({
      ranks: results[0],
      activities: results[1],
      items: results[2],
    });
  }
  if (path === "/api/test-account" && r.method === "POST") {
    if (env.ENVIRONMENT !== "test" || env.ALLOW_TEST_ACCOUNTS !== "true")
      throw new GameError("Test accounts are disabled", 403);
    await throttle(
      sql,
      "signup:" + (await hash(r.headers.get("CF-Connecting-IP") || "local")),
      5,
    );
    const b = await body(r);
    const name = text(b.name, 2, 24, "Manager name"),
      club = text(b.club, 2, 32, "Club name");
    const rows =
      await sql`INSERT INTO mto_players(identity,name,club) VALUES(${"test:" + crypto.randomUUID()},${name},${club}) RETURNING id`;
    const response = json({ ok: true });
    response.headers.append(
      "Set-Cookie",
      await startSession(rows[0].id as string, r, sql),
    );
    return response;
  }
  if (path === "/auth/google" && r.method === "GET") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
      throw new GameError(
        "Google sign-in is awaiting game OAuth credentials",
        503,
      );
    const state = token(),
      nonce = token(),
      verifier = token();
    const challenge = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
          ),
        ),
      ),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: url.origin + "/auth/callback",
      response_type: "code",
      scope: "openid profile email",
      prompt: "select_account",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    const response = new Response(null, {
      status: 302,
      headers: { Location: u.toString(), "Cache-Control": "no-store" },
    });
    response.headers.append(
      "Set-Cookie",
      cookie("mto_oauth", `${state}.${nonce}.${verifier}`, r, 600),
    );
    return response;
  }
  if (path === "/auth/callback" && r.method === "GET") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
      throw new GameError("Google sign-in has not been configured", 503);
    if (url.searchParams.has("error")) {
      const response = new Response(null, {
        status: 302,
        headers: {
          Location: "/?signin=cancelled",
          "Cache-Control": "no-store",
        },
      });
      response.headers.append("Set-Cookie", cookie("mto_oauth", "", r, 0));
      return response;
    }
    const [state, nonce, verifier] = (cookies(r).mto_oauth || "").split(".");
    if (
      !state ||
      url.searchParams.get("state") !== state ||
      !url.searchParams.get("code")
    )
      throw new GameError("Sign-in expired. Please try again", 401);
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: url.searchParams.get("code")!,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: url.origin + "/auth/callback",
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!exchange.ok)
      throw new GameError("Google could not complete sign-in", 401);
    const tokens = (await exchange.json()) as { id_token: string };
    const { payload } = await jwtVerify(tokens.id_token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    });
    if (payload.nonce !== nonce || !payload.sub)
      throw new GameError("Invalid sign-in response", 401);
    verifyGoogleAccess(
      { email: payload.email, email_verified: payload.email_verified },
      env.ALLOWED_GOOGLE_EMAILS,
    );
    const identity = "google:" + payload.sub;
    let rows = await sql`SELECT id FROM mto_players WHERE identity=${identity}`;
    if (!rows.length) {
      const current = await session(r, sql);
      if (current)
        rows =
          await sql`UPDATE mto_players SET identity=${identity} WHERE id=${current} AND identity LIKE 'test:%' RETURNING id`;
      if (!rows.length)
        rows =
          await sql`INSERT INTO mto_players(identity,name,club) VALUES(${identity},'New Manager','New Club') ON CONFLICT(identity) DO UPDATE SET identity=EXCLUDED.identity RETURNING id`;
    }
    const response = new Response(null, {
      status: 302,
      headers: { Location: "/", "Cache-Control": "no-store" },
    });
    response.headers.append(
      "Set-Cookie",
      await startSession(rows[0].id as string, r, sql),
    );
    response.headers.append("Set-Cookie", cookie("mto_oauth", "", r, 0));
    return response;
  }
  const pid = await session(r, sql);
  if (!pid) throw new GameError("Sign in to open your club", 401);
  if (path === "/api/logout" && r.method === "POST") {
    await sql`DELETE FROM mto_sessions WHERE token_hash=${await hash(cookies(r).mto_session || "")}`;
    const response = json({ ok: true });
    response.headers.append("Set-Cookie", cookie("mto_session", "", r, 0));
    return response;
  }
  if (path === "/api/state" && r.method === "GET") {
    const rows =
      await sql`SELECT mto_public(mto_refresh(${pid}::uuid)) AS player, identity LIKE 'google:%' AS "googleLinked" FROM mto_players WHERE id=${pid}::uuid`;
    return json({
      player: rows[0].player,
      googleLinked: rows[0].googleLinked,
      serverTime: new Date().toISOString(),
    });
  }
  if (path === "/api/action" && r.method === "POST") {
    await throttle(sql, "action:" + pid, 90);
    const d = validateAction(await body(r));
    if (d.kind === "claimDaily") {
      const rows =
        await sql`SELECT mto_claim_daily(${pid}::uuid,${d.key}::uuid,${String(d.input.id)}) AS result`;
      return json(rows[0].result);
    }
    const rows =
      await sql`SELECT mto_action(${pid}::uuid,${d.key}::uuid,${d.kind},${JSON.stringify(d.input)}::jsonb) AS result`;
    return json(rows[0].result);
  }
  if (path === "/api/daily" && r.method === "GET") {
    const rows = await sql`SELECT mto_daily(${pid}::uuid) AS daily`;
    return json(rows[0].daily);
  }
  if (path === "/api/profile" && r.method === "POST") {
    const b = await body(r);
    const name = text(b.name, 2, 24, "Manager name"),
      club = text(b.club, 2, 32, "Club name");
    await sql`UPDATE mto_players SET name=${name},club=${club} WHERE id=${pid}`;
    return json({ ok: true });
  }
  if (path === "/api/world" && r.method === "GET") {
    const showTest = true; // Keep current clubs visible until Google linkage is verified.
    const results = await sql.transaction([
      sql`SELECT id,name,club,mto_rank(xp) AS rank,(SELECT name FROM mto_ranks WHERE id=mto_rank(xp)) AS "rankName",cash+bank AS wealth,mto_power(mto_players) AS power,region,last_seen>now()-interval '2 minutes' AS online FROM mto_players WHERE (${showTest} OR identity LIKE 'google:%') ORDER BY xp DESC,wins DESC,created_at LIMIT 50`,
      sql`SELECT count(*)::integer AS total,count(*) FILTER(WHERE last_seen>now()-interval '2 minutes')::integer AS online FROM mto_players WHERE (${showTest} OR identity LIKE 'google:%')`,
      sql`SELECT l.id,l.seller,l.asset,l.price,p.club FROM mto_listings l JOIN mto_players p ON p.id=l.seller WHERE l.buyer IS NULL AND (${showTest} OR p.identity LIKE 'google:%') ORDER BY l.created_at DESC LIMIT 50`,
    ]);
    return json({
      managers: results[0],
      counts: results[1][0],
      listings: results[2],
    });
  }
  if (path === "/api/events" && r.method === "GET")
    return json({
      events:
        await sql`SELECT id,kind,message,cash_delta AS "cashDelta",created_at AS "createdAt" FROM mto_events WHERE player_id=${pid} ORDER BY id DESC LIMIT 30`,
    });
  throw new GameError("Page not found", 404);
}
export default {
  async fetch(r: Request, env: Env) {
    let response: Response;
    try {
      response = await handle(r, env);
    } catch (e) {
      if (e instanceof GameError)
        response = json({ error: e.message }, e.status);
      else if ((e as { code?: string })?.code === "P0001")
        response = json({ error: (e as Error).message }, 409);
      else {
        console.error("Game request failed", {
          path: new URL(r.url).pathname,
          code: (e as { code?: string })?.code || "unknown",
        });
        response = json(
          {
            error:
              "The club office is temporarily unavailable. Please retry shortly",
          },
          503,
        );
      }
    }
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "same-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    return new Response(response.body, { status: response.status, headers });
  },
};

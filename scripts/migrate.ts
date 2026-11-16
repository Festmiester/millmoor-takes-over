import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const path = process.argv[2] || ".dev.vars.test";
const url = readFileSync(path, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1];
if (!url) throw new Error("DATABASE_URL missing");
const parsed = new URL(url);
if (parsed.pathname !== "/takes_over")
  throw new Error("Refusing to migrate a database outside the Takes Over game");
if (!process.argv.includes("--game-test-approved"))
  throw new Error(
    "Review the target, then supply --game-test-approved for the game test database only",
  );
const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS mto_migrations(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`;
const applied = new Set(
  (await sql`SELECT version FROM mto_migrations`).map((x) => x.version),
);
for (const file of readdirSync("migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const version = Number(file.split("_")[0]);
  if (applied.has(version)) continue;
  const statements = JSON.parse(
    execFileSync("python3", ["scripts/sql-split.py", "migrations/" + file], {
      encoding: "utf8",
    }),
  ) as string[];
  await sql.transaction(statements.map((s) => sql.query(s, [])));
  console.log("Applied", file);
}

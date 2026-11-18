// Check `bongbetic` headroom before creating the Coolify Postgres resource
// (spec §7, issue #32 unverified list). Run with DATABASE_URL set to the
// server probe target. Fails closed when unset or unreachable.

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Refusing to create the Postgres resource.");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 8000 });
try {
  const client = await pool.connect();
  try {
    const version = await client.query("SHOW server_version;");
    const dbSize = await client.query("SELECT pg_database_size(current_database()) AS bytes;");
    console.log(
      JSON.stringify({
        ok: true,
        serverVersion: version.rows[0]?.server_version ?? "unknown",
        databaseBytes: Number(dbSize.rows[0]?.bytes ?? 0),
        note: "Confirm free CPU/RAM/disk on bongbetic in Coolify before adding the one-click Postgres.",
      }),
    );
  } finally {
    client.release();
  }
} catch (error) {
  console.error(`Postgres probe failed: ${(error as Error).message}`);
  process.exit(1);
} finally {
  await pool.end();
}

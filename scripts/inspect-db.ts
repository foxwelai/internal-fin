/** Read-only look at whatever DATABASE_URL currently points at. */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const host = new URL(url).host;
  console.log("host:    ", host);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const [version, identity, tables] = await Promise.all([
    client.query("select version()"),
    client.query("select current_database() as db, current_user as usr"),
    client.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')
      order by table_schema, table_name
    `),
  ]);

  console.log("server:  ", version.rows[0].version.split(" ").slice(0, 2).join(" "));
  console.log("database:", identity.rows[0].db, "| user:", identity.rows[0].usr);
  console.log(`\nexisting tables: ${tables.rowCount}`);
  for (const row of tables.rows) console.log("  -", `${row.table_schema}.${row.table_name}`);

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

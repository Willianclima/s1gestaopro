import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./drizzle.ts";

/**
 * Executes Drizzle ORM migrations automatically on PostgreSQL using the database instance from drizzle.ts.
 */
export async function runMigrations(migrationsFolder = "./drizzle") {
  console.log("⏳ Executando migrações do Drizzle ORM no PostgreSQL...");
  try {
    const startTime = Date.now();
    await migrate(db, { migrationsFolder });
    const durationMs = Date.now() - startTime;
    console.log(`✅ Migrações executadas com sucesso em ${durationMs}ms!`);
  } catch (error) {
    console.error("❌ Falha ao executar as migrações no PostgreSQL:", error);
    throw error;
  }
}

// Execute directly if launched as a standalone script (e.g. npx tsx src/db/migrate.ts)
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/migrate.ts");

if (isMainModule) {
  runMigrations()
    .then(async () => {
      await client.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async () => {
      await client.end({ timeout: 5 });
      process.exit(1);
    });
}

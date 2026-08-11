import { seedDatabaseBatch } from "../src/db/seed.ts";

export async function syncLocalDataToPostgres() {
  return await seedDatabaseBatch();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncLocalDataToPostgres()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

import { sql } from "drizzle-orm";
import { db, client } from "./drizzle.ts";

/**
 * Diagnostic script to verify PostgreSQL database connection using Drizzle ORM instance.
 */
async function testConnection() {
  console.log("🔍 Testando conexão com o banco de dados PostgreSQL usando Drizzle ORM...");

  try {
    const startTime = Date.now();
    const result = await db.execute(sql`SELECT 1 as result`);
    const durationMs = Date.now() - startTime;

    console.log("✅ Conexão estabelecida com sucesso!");
    console.log("⏱️ Tempo de resposta:", `${durationMs}ms`);
    console.log("📊 Resultado da consulta ('SELECT 1'):", result);

    process.exitCode = 0;
  } catch (error: any) {
    console.error("❌ Falha na conexão com o banco de dados PostgreSQL:");
    console.error(error?.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await client.end({ timeout: 5 });
      console.log("🔒 Pool de conexões encerrado com sucesso.");
    } catch {
      // Ignore pool close errors on cleanup
    }
  }
}

// Execute connection test
testConnection();

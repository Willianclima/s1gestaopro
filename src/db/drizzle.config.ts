import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carrega variáveis do arquivo .env para o process.env
dotenv.config();

/**
 * ============================================================================
 * CONFIGURAÇÃO DO DRIZZLE KIT (drizzle.config.ts)
 * ============================================================================
 * O Drizzle Kit é a ferramenta de CLI que gerencia migrações de banco de dados,
 * introspecção (push/pull de schemas) e execução do Drizzle Studio.
 */

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_CONNECTION_STRING || "";
const sqlHost = process.env.SQL_HOST || process.env.PGHOST || "localhost";
const sqlPort = Number(process.env.SQL_PORT || process.env.PGPORT || 5432);
const sqlDbName = process.env.SQL_DB_NAME || process.env.PGDATABASE || "postgres";
const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || "postgres";
const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD || "";

export default defineConfig({
  schema: "./src/db/schema.ts",   // Caminho onde o schema TypeScript do banco está definido
  out: "./drizzle",              // Pasta onde os arquivos de migração SQL (.sql) são gerados
  dialect: "postgresql",         // Dialeto do banco de dados (postgresql)
  schemaFilter: ["public"],      // Filtra o schema público padrão do PostgreSQL
  dbCredentials: connectionString
    ? { url: connectionString }
    : {
        host: sqlHost,
        port: sqlPort,
        user: user,
        password: password,
        database: sqlDbName,
        ssl: false,
      },
  verbose: true,                 // Exibe logs detalhados de queries geradas no terminal
});



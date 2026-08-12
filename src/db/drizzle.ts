import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as schema from "./schema.ts";

dotenv.config();

/**
 * ============================================================================
 * CONEXÃO E CLIENTE DO BANCO DE DADOS POSTGRESQL (postgres-js + Drizzle ORM)
 * ============================================================================
 *
 * Este módulo é responsável por:
 * 1. Estabelecer o pool de conexões resiliente com o PostgreSQL utilizando `postgres-js`.
 * 2. Suportar Múltiplas Ambientes: URLs de conexão SQL padrão, Sockets Unix do Cloud SQL
 *    e variáveis de ambiente individuais (`SQL_HOST`, `SQL_USER`, `PGHOST`, etc.).
 * 3. Inicializar a instância `db` do Drizzle ORM tipada com o nosso `schema`.
 */

function createPostgresClient() {
  // Leitura com prioridade de variáveis de ambiente
  const urlStr = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    ""
  ).trim();

  // Configurações do Pool de Conexão do postgres-js:
  // - max: Número máximo de conexões simultâneas no pool
  // - idle_timeout: Segundos antes de fechar uma conexão ociosa
  // - connect_timeout: Limite de tempo (segundos) para estabelecer conexão
  const options: postgres.Options<{}> = {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  };

  if (urlStr) {
    // 1. Tenta tratar como URL Postgres padrão (ex: postgresql://user:pass@localhost:5432/dbname)
    try {
      if (!urlStr.includes("@/")) {
        new URL(urlStr);
        return postgres(urlStr, options);
      }
    } catch {
      // Caso a URL contenha sintaxe de socket Unix do Cloud SQL, avança para o tratamento específico
    }

    // 2. Trata formato de Socket Unix do Cloud SQL (GCP):
    // Formato: postgres://USER:PASS@/cloudsql/PROJECT:REGION:INSTANCE/DBNAME
    if (urlStr.includes("@/")) {
      const atIdx = urlStr.indexOf("@/");
      const userInfoStr = urlStr.substring(0, atIdx).replace(/^postgres(?:ql)?:\/\//, "");
      const rest = urlStr.substring(atIdx + 2);

      const colonIdx = userInfoStr.indexOf(":");
      const username = colonIdx !== -1 ? decodeURIComponent(userInfoStr.substring(0, colonIdx)) : "postgres";
      const password = colonIdx !== -1 ? decodeURIComponent(userInfoStr.substring(colonIdx + 1)) : "";

      const lastSlashIdx = rest.lastIndexOf("/");
      const socketAndPort = "/" + (lastSlashIdx !== -1 ? rest.substring(0, lastSlashIdx) : rest);
      const database = lastSlashIdx !== -1 ? rest.substring(lastSlashIdx + 1) : "postgres";

      let host = socketAndPort;
      let port = 5432;
      const portMatch = socketAndPort.match(/^(.*):(\d+)$/);
      if (portMatch) {
        host = portMatch[1];
        port = parseInt(portMatch[2], 10);
      }

      return postgres({
        ...options,
        host,
        port,
        database,
        username,
        password,
      });
    }

    // Fallback genérico para string de conexão simples
    return postgres(urlStr, options);
  }

  // 3. Fallback para variáveis individuais SQL_* ou PG*
  const host = process.env.SQL_HOST || process.env.PGHOST || "localhost";
  const port = Number(process.env.SQL_PORT || process.env.PGPORT || 5432);
  const username = process.env.SQL_USER || process.env.PGUSER || "postgres";
  const password = process.env.SQL_PASSWORD || process.env.PGPASSWORD || "";
  const database = process.env.SQL_DB_NAME || process.env.PGDATABASE || "postgres";

  return postgres({
    ...options,
    host,
    port,
    username,
    password,
    database,
  });
}

/**
 * Cliente nativo de conexão `postgres-js` utilizado para queries e gerenciamento do pool.
 */
export const client = createPostgresClient();

/**
 * Instância principal do Drizzle ORM (`db`).
 * Passamos a propriedade `{ schema }` para habilitar autocompletar e tipagem estática
 * completa em todas as operações de banco de dados (`db.select()`, `db.insert()`, etc.).
 */
export const db = drizzle(client, { schema });

export { schema };


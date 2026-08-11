import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/**
 * Creates and configures the `postgres-js` connection client safely,
 * supporting standard database URLs, Cloud SQL unix sockets, and individual environment variables.
 */
function createPostgresClient() {
  const urlStr = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    ""
  ).trim();

  const options: postgres.Options<{}> = {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  };

  if (urlStr) {
    // Attempt standard postgres(urlStr) first if it's a valid standard URL
    try {
      if (!urlStr.includes("@/")) {
        new URL(urlStr);
        return postgres(urlStr, options);
      }
    } catch {
      // Fall through to custom socket / parameter parsing if standard URL parsing fails
    }

    // Handle Cloud SQL / Unix Domain Socket connection string format:
    // e.g., postgres://USER:PASS@/path/to/socket:PORT/DBNAME
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

    // Direct fallback attempt for any other string format
    return postgres(urlStr, options);
  }

  // Fallback to individual SQL_* or PG* environment variables
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
 * Connection client initialized with postgres-js
 */
export const client = createPostgresClient();

/**
 * Initialized Drizzle ORM instance using postgres-js and schema
 */
export const db = drizzle(client, { schema });

export { schema };

/**
 * ============================================================================
 * S1 Gestão Pro — Módulo de Isolamento e Validação Positiva de Ambiente de Teste
 * ============================================================================
 * 
 * Este módulo implementa a verificação positiva, estrita e fail-closed para
 * garantir que nenhuma suíte de testes realize escritas (INSERT/UPDATE/DELETE)
 * em bancos de dados de produção ou instâncias não verificadas.
 * 
 * Regras principais:
 * 1. Exige identificação explícita através de TEST_DATABASE_NAME.
 * 2. Valida o cliente PostgreSQL efetivo contra allowlist de bancos de teste.
 * 3. Valida a instância/projeto do Cloud SQL ou host de conexão.
 * 4. Valida a identidade e privilégios limitados do usuário de banco.
 * 5. Rejeita qualquer indício de produção em host, banco, usuário ou URL.
 * 6. Falha fechado antes da primeira operação de escrita.
 * 7. Nunca vaza senhas, URLs completas ou credenciais nos erros e logs.
 */

export interface EffectivePostgresConfig {
  database: string;
  host: string;
  port: number;
  username: string;
  hasUrl: boolean;
  isConfigured: boolean;
  cloudSqlInstance?: string;
  isUnixSocket: boolean;
}

export interface IsolatedTestCheckResult {
  isIsolated: boolean;
  reason: string;
  databaseName?: string;
  instanceId?: string;
  username?: string;
}

/**
 * Allowlist estrita de nomes de bancos autorizados para execução de testes.
 */
export const AUTHORIZED_TEST_DATABASES: readonly string[] = [
  "cloud_sql_development_database",
  "s1gestao_test",
  "s1_gestaopro_test",
  "test_db",
  "s1gestaopro_testing_isolated"
];

/**
 * Allowlist de instâncias/projetos autorizados para execução de testes.
 */
export const AUTHORIZED_TEST_INSTANCES: readonly string[] = [
  "snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf",
  "localhost",
  "127.0.0.1",
  "::1",
  "localhost:5432",
  "127.0.0.1:5432",
  "test-instance",
  "postgres-test"
];

/**
 * Allowlist de usuários de banco autorizados para conexão de testes.
 */
export const AUTHORIZED_TEST_USERS: readonly string[] = [
  "ai_studio_app_user",
  "test_user",
  "postgres_test",
  "s1_test_user",
  "test"
];

/**
 * Extrai a configuração efetiva que o cliente PostgreSQL usará,
 * sem expor credenciais em logs ou exceptions.
 */
export function getEffectivePostgresConfig(
  env: Record<string, string | undefined> = process.env
): EffectivePostgresConfig {
  const urlStr = (
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.DATABASE_CONNECTION_STRING ||
    ""
  ).trim();

  if (urlStr) {
    // Trata formato de Socket Unix do Cloud SQL: postgres://USER:PASS@/cloudsql/PROJECT:REGION:INSTANCE/DBNAME
    if (urlStr.includes("@/")) {
      const atIdx = urlStr.indexOf("@/");
      const userInfoStr = urlStr.substring(0, atIdx).replace(/^postgres(?:ql)?:\/\//, "");
      const rest = urlStr.substring(atIdx + 2);

      const colonIdx = userInfoStr.indexOf(":");
      const username = colonIdx !== -1 ? decodeURIComponent(userInfoStr.substring(0, colonIdx)) : "postgres";

      const lastSlashIdx = rest.lastIndexOf("/");
      const socketAndPort = "/" + (lastSlashIdx !== -1 ? rest.substring(0, lastSlashIdx) : rest);
      const database = lastSlashIdx !== -1 ? rest.substring(lastSlashIdx + 1) : "";

      let host = socketAndPort;
      let port = 5432;
      const portMatch = socketAndPort.match(/^(.*):(\d+)$/);
      if (portMatch) {
        host = portMatch[1];
        port = parseInt(portMatch[2], 10);
      }

      // Extrai PROJECT:REGION:INSTANCE do socket
      const cloudSqlMatch = host.match(/(?:^|\/cloudsql\/)([a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+)/);
      const cloudSqlInstance = cloudSqlMatch ? cloudSqlMatch[1] : undefined;

      return {
        database: database.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        hasUrl: true,
        isConfigured: Boolean(database.trim()),
        cloudSqlInstance,
        isUnixSocket: true
      };
    }

    try {
      const parsed = new URL(urlStr);
      const database = parsed.pathname.replace(/^\//, "").trim();
      const host = parsed.hostname.trim();
      const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
      const username = decodeURIComponent(parsed.username || "postgres").trim();

      const cloudSqlMatch = host.match(/(?:^|\/cloudsql\/)([a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+)/);

      return {
        database,
        host,
        port,
        username,
        hasUrl: true,
        isConfigured: Boolean(database),
        cloudSqlInstance: cloudSqlMatch ? cloudSqlMatch[1] : undefined,
        isUnixSocket: host.startsWith("/")
      };
    } catch {
      return {
        database: "",
        host: "",
        port: 5432,
        username: "",
        hasUrl: true,
        isConfigured: false,
        isUnixSocket: false
      };
    }
  }

  // Fallback: variáveis individuais SQL_* ou PG*
  const host = (env.SQL_HOST || env.PGHOST || "").trim();
  const port = Number(env.SQL_PORT || env.PGPORT || 5432);
  const username = (env.SQL_USER || env.PGUSER || "").trim();
  const database = (env.SQL_DB_NAME || env.PGDATABASE || "").trim();

  const isUnixSocket = host.startsWith("/") || host.includes("cloudsql");
  const cloudSqlMatch = host.match(/(?:^|\/cloudsql\/)([a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+)/);
  const cloudSqlInstance = cloudSqlMatch ? cloudSqlMatch[1] : undefined;

  const isConfigured = Boolean(database || host);

  return {
    database,
    host,
    port,
    username,
    hasUrl: false,
    isConfigured,
    cloudSqlInstance,
    isUnixSocket
  };
}

/**
 * Validação mandatória e estrita de ambiente isolado de teste (Função de Decisão Pura).
 * Executável em testes unitários sem abrir nenhuma conexão real com banco de dados.
 */
export function isIsolatedTestEnvironment(
  overrideEnv?: Record<string, string | undefined>
): IsolatedTestCheckResult {
  const env = overrideEnv || process.env;
  const config = getEffectivePostgresConfig(env);

  const nodeEnv = (env.NODE_ENV || "").toLowerCase().trim();
  const declaredTestDb = (env.TEST_DATABASE_NAME || env.TEST_DB_NAME || "").trim();
  const declaredTestUser = (env.TEST_DB_USER || "").trim();
  const declaredTestInstance = (env.TEST_INSTANCE_ID || env.TEST_SQL_INSTANCE || "").trim();

  const effectiveDb = config.database.trim();
  const effectiveHost = config.host.trim().toLowerCase();
  const effectiveUser = config.username.trim().toLowerCase();
  const urlCheck = (env.DATABASE_URL || env.POSTGRES_URL || env.DATABASE_CONNECTION_STRING || "").toLowerCase();

  // 1. Rejeição imediata se houver qualquer indício de produção em qualquer variável
  const isProduction =
    nodeEnv === "production" ||
    effectiveDb.toLowerCase().includes("prod") ||
    effectiveDb.toLowerCase().includes("production") ||
    declaredTestDb.toLowerCase().includes("prod") ||
    declaredTestDb.toLowerCase().includes("production") ||
    effectiveHost.includes("prod") ||
    effectiveHost.includes("production") ||
    effectiveUser.includes("prod") ||
    effectiveUser.includes("production") ||
    urlCheck.includes("prod") ||
    urlCheck.includes("production");

  if (isProduction) {
    return {
      isIsolated: false,
      reason: "Execução rejeitada: Configuração identificada como ambiente de produção ou com terminologia produtiva."
    };
  }

  // 2. Rejeição se a identificação explícita de teste (TEST_DATABASE_NAME) estiver ausente
  // Não aceita NODE_ENV=test, NODE_ENV=development, localhost ou cloudsql isoladamente
  if (!declaredTestDb) {
    return {
      isIsolated: false,
      reason: "Execução com escrita recusada: Marcador explícito de banco de teste ausente. Defina a variável TEST_DATABASE_NAME com o nome exato do banco isolado autorizado para testes."
    };
  }

  // 3. Rejeição se a configuração do cliente PostgreSQL estiver ausente ou incompleta
  if (!effectiveDb) {
    return {
      isIsolated: false,
      reason: "Execução rejeitada: Configuração de banco de dados ausente no cliente PostgreSQL (DATABASE_URL, SQL_DB_NAME ou PGDATABASE não definidos)."
    };
  }

  if (!config.hasUrl && !effectiveHost) {
    return {
      isIsolated: false,
      reason: "Execução rejeitada: Host do PostgreSQL ausente (SQL_HOST ou PGHOST não definidos)."
    };
  }

  // 4. Rejeição de bancos genéricos ou compartilhados do sistema
  if (["postgres", "template0", "template1", "defaultdb", "rdsadmin"].includes(effectiveDb.toLowerCase())) {
    return {
      isIsolated: false,
      reason: `Execução rejeitada: O banco configurado é genérico/compartilhado ('${effectiveDb}'). Exige banco de teste dedicado.`
    };
  }

  // 5. Rejeição por divergência entre o banco declarado de teste e a conexão do cliente
  if (effectiveDb.toLowerCase() !== declaredTestDb.toLowerCase()) {
    return {
      isIsolated: false,
      reason: `Divergência de configuração: O banco declarado para testes (${declaredTestDb}) não coincide com o banco configurado para a conexão do cliente (${effectiveDb}).`
    };
  }

  // 6. Verificação de autorização explícita do Banco na Allowlist ou nomenclatura de teste
  const isDbAuthorized =
    AUTHORIZED_TEST_DATABASES.map(d => d.toLowerCase()).includes(effectiveDb.toLowerCase()) ||
    effectiveDb.toLowerCase().endsWith("_test") ||
    effectiveDb.toLowerCase().startsWith("test_");

  if (!isDbAuthorized) {
    return {
      isIsolated: false,
      reason: `Banco não autorizado: O banco de dados '${effectiveDb}' não consta na allowlist de bancos de teste autorizados.`
    };
  }

  // 7. Validação Estrita de Instância / Socket Cloud SQL
  // Não aceita o caminho "/cloudsql/" ou "/app/cloudsql/" sem projeto/instância autorizados
  if (config.isUnixSocket || effectiveHost.includes("cloudsql")) {
    const instance = config.cloudSqlInstance;
    if (!instance) {
      return {
        isIsolated: false,
        reason: "Instância Cloud SQL não verificada: Caminho de socket não contém o formato obrigatório 'PROJECT:REGION:INSTANCE'."
      };
    }

    if (declaredTestInstance && instance.toLowerCase() !== declaredTestInstance.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de instância: A instância declarada (${declaredTestInstance}) não coincide com a conexão (${instance}).`
      };
    }

    const isInstanceAuthorized =
      AUTHORIZED_TEST_INSTANCES.map(i => i.toLowerCase()).includes(instance.toLowerCase()) ||
      (declaredTestInstance && instance.toLowerCase() === declaredTestInstance.toLowerCase()) ||
      instance.toLowerCase().includes("test") ||
      instance.toLowerCase().includes("ai-studio");

    if (!isInstanceAuthorized) {
      return {
        isIsolated: false,
        reason: `Instância Cloud SQL não autorizada: A instância '${instance}' não consta na allowlist de instâncias de teste.`
      };
    }
  } else {
    // Para conexão TCP / IP:
    // Se declaredTestInstance ou TEST_HOST estiver definido, deve coincidir
    if (declaredTestInstance && effectiveHost !== declaredTestInstance.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de host: O host declarado (${declaredTestInstance}) não coincide com o host configurado (${effectiveHost}).`
      };
    }

    // Rejeita conexões para hosts externos não verificados
    const isLocalOrTestHost =
      AUTHORIZED_TEST_INSTANCES.map(h => h.toLowerCase()).includes(effectiveHost) ||
      effectiveHost === "localhost" ||
      effectiveHost === "127.0.0.1" ||
      effectiveHost === "::1" ||
      effectiveHost.endsWith(".local") ||
      effectiveHost.endsWith("_test") ||
      effectiveHost.startsWith("test_");

    if (!isLocalOrTestHost && !declaredTestInstance) {
      return {
        isIsolated: false,
        reason: `Host de banco de dados não verificado: '${effectiveHost}' não é um host de teste autorizado.`
      };
    }
  }

  // 8. Validação de Usuário de Conexão de Teste (Identidade e Privilégios Declarados)
  if (declaredTestUser && effectiveUser !== declaredTestUser.toLowerCase()) {
    return {
      isIsolated: false,
      reason: `Divergência de usuário: O usuário declarado para testes (${declaredTestUser}) não coincide com o configurado (${effectiveUser}).`
    };
  }

  // Rejeita usuários perigosos / de produção conhecidos
  const isDangerousUser = ["root", "admin", "administrator", "prod_user", "prod_app"].includes(effectiveUser);
  if (isDangerousUser) {
    return {
      isIsolated: false,
      reason: `Usuário de conexão não autorizado para testes: Usuário com perfil privilegiado/administrativo ('${effectiveUser}'). Exige usuário com privilégios limitados de teste.`
    };
  }

  const isUserAuthorized =
    AUTHORIZED_TEST_USERS.map(u => u.toLowerCase()).includes(effectiveUser) ||
    (declaredTestUser && effectiveUser === declaredTestUser.toLowerCase()) ||
    effectiveUser.startsWith("test") ||
    effectiveUser.endsWith("test") ||
    effectiveUser === "postgres" && (effectiveHost === "localhost" || effectiveHost === "127.0.0.1");

  if (!isUserAuthorized && !declaredTestUser) {
    return {
      isIsolated: false,
      reason: `Usuário de banco sem identidade de teste confirmada: '${effectiveUser}' não consta na allowlist de usuários de teste autorizados.`
    };
  }

  return {
    isIsolated: true,
    reason: `Ambiente isolado de teste confirmado positivamente: banco autorizado '${effectiveDb}' e instância/usuário validados contra a conexão do cliente.`,
    databaseName: effectiveDb,
    instanceId: config.cloudSqlInstance || config.host,
    username: config.username
  };
}

/**
 * Validação ao vivo da conexão PostgreSQL aberta pelo cliente.
 * Consulta diretamente o servidor PostgreSQL para confirmar nome do banco, usuário
 * ativo e ausência de privilégios globais excessivos (superuser) antes da primeira escrita.
 */
export async function verifyLiveTestConnection(
  dbExecutor: { execute: (query: any) => Promise<any[]> },
  sqlTag: (strings: TemplateStringsArray, ...values: any[]) => any,
  overrideEnv?: Record<string, string | undefined>
): Promise<IsolatedTestCheckResult> {
  // 1. Primeiro executa a validação pura de configuração
  const configDecision = isIsolatedTestEnvironment(overrideEnv);
  if (!configDecision.isIsolated) {
    return configDecision;
  }

  // 2. Consulta a identidade real no servidor PostgreSQL
  try {
    const result = await dbExecutor.execute(sqlTag`
      SELECT 
        current_database() as current_db,
        current_user as current_usr,
        session_user as session_usr,
        current_setting('is_superuser') as is_superuser,
        has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
        has_database_privilege(current_user, current_database(), 'CREATE') as can_create;
    `);

    const row = result[0] as any;
    const currentDb = String(row?.current_db || "").trim();
    const currentUsr = String(row?.current_usr || "").trim();
    const isSuperuser = String(row?.is_superuser || "").trim().toLowerCase();
    const canConnect = Boolean(row?.can_connect);

    const declaredDb = (overrideEnv?.TEST_DATABASE_NAME || process.env.TEST_DATABASE_NAME || "").trim();

    // Valida se o banco realmente conectado corresponde ao banco declarado de teste
    if (currentDb.toLowerCase() !== declaredDb.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência entre conexão real e configuração: O banco real conectado é '${currentDb}', mas o teste exige '${declaredDb}'.`
      };
    }

    // Valida se o usuário tem privilégio de conexão
    if (!canConnect) {
      return {
        isIsolated: false,
        reason: `Privilégio insuficiente: O usuário '${currentUsr}' não possui privilégio CONNECT no banco '${currentDb}'.`
      };
    }

    // Valida privilégios limitados: rejeita superuser a menos que expressamente autorizado para container descartável
    const allowSuperuser = (overrideEnv?.TEST_ALLOW_SUPERUSER || process.env.TEST_ALLOW_SUPERUSER) === "true";
    if (isSuperuser === "on" && !allowSuperuser) {
      return {
        isIsolated: false,
        reason: `Credenciais de teste com privilégios excessivos: O usuário ativo '${currentUsr}' possui privilégio de superusuário no banco. Utilize credenciais de teste com privilégios limitados ao banco de teste.`
      };
    }

    return {
      isIsolated: true,
      reason: `Conexão real validada com sucesso: Banco '${currentDb}', usuário '${currentUsr}', privilégios limitados confirmados.`,
      databaseName: currentDb,
      username: currentUsr
    };
  } catch (err: any) {
    return {
      isIsolated: false,
      reason: `Falha ao consultar identidade da conexão real com o PostgreSQL: ${err?.message || "Erro desconhecido"}`
    };
  }
}

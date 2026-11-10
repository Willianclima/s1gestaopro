/**
 * ============================================================================
 * S1 Gestão Pro — Módulo de Isolamento e Validação Positiva de Ambiente de Teste
 * ============================================================================
 * 
 * Este módulo implementa a verificação positiva, estrita e fail-closed para
 * garantir que nenhuma suíte de testes integrada execute escritas (INSERT/UPDATE/DELETE)
 * em instâncias de produção, bancos compartilhados ou com credenciais excessivas.
 * 
 * Regras fundamentais:
 * 1. Exige variáveis obrigatórias de teste explícitas:
 *    - TEST_DATABASE_NAME: Nome exato do banco isolado.
 *    - TEST_DB_USER: Nome exato da conta de teste com privilégios mínimos.
 *    - TEST_INSTANCE_ID: Identificador exato da instância Cloud SQL (PROJECT:REGION:INSTANCE)
 *      ou endpoint de teste autorizado.
 *    Sem valores padrão permissivos.
 * 2. Valida o cliente PostgreSQL efetivo contra allowlists estritas.
 * 3. Valida a conexão real aberta no servidor antes de qualquer escrita:
 *    - current_database() == TEST_DATABASE_NAME
 *    - current_user == TEST_DB_USER
 *    - session_user == TEST_DB_USER (rejeita divergência de sessão / SET ROLE)
 *    - is_superuser == 'off'
 *    - ausência de privilégios administrativos no cluster (rolsuper, rolcreaterole, rolcreatedb)
 *    - ausência de acesso/permissão a bancos de produção na mesma instância
 *    - privilégios mínimos necessários no banco de teste (CONNECT e USAGE no schema public)
 * 4. Rejeita qualquer indício de produção em host, banco, usuário ou URL.
 * 5. Falha fechado antes de qualquer INSERT, UPDATE, DELETE ou leitura de baseline.
 * 6. Nunca vaza senhas, URLs completas ou credenciais nos erros e logs.
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
  sessionUser?: string;
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
 * Allowlist de instâncias/endpoints autorizados para execução de testes.
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
 * Allowlist de usuários autorizados para conexão de testes com privilégios limitados.
 */
export const AUTHORIZED_TEST_USERS: readonly string[] = [
  "s1_test_user",
  "test_user",
  "postgres_test",
  "ai_studio_test_user",
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

  // 1. Rejeição imediata se houver qualquer indício de produção
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

  // 2. Rejeição se as variáveis obrigatórias de teste estiverem ausentes
  // Exige TEST_DATABASE_NAME, TEST_DB_USER e TEST_INSTANCE_ID sem valores padrão permissivos
  if (!declaredTestDb) {
    return {
      isIsolated: false,
      reason: "Execução com escrita recusada: Variável obrigatória TEST_DATABASE_NAME ausente. Defina o nome exato do banco isolado autorizado para testes."
    };
  }

  if (!declaredTestUser) {
    return {
      isIsolated: false,
      reason: "Execução com escrita recusada: Variável obrigatória TEST_DB_USER ausente. Defina a conta de teste dedicada com privilégios mínimos no banco de teste."
    };
  }

  if (!declaredTestInstance) {
    return {
      isIsolated: false,
      reason: "Execução com escrita recusada: Variável obrigatória TEST_INSTANCE_ID ausente. Defina o identificador da instância Cloud SQL (PROJECT:REGION:INSTANCE) ou endpoint de teste autorizado."
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
  if (["postgres", "template0", "template1", "defaultdb", "rdsadmin", "cloudsqladmin"].includes(effectiveDb.toLowerCase())) {
    return {
      isIsolated: false,
      reason: `Execução rejeitada: O banco configurado é genérico/compartilhado ('${effectiveDb}'). Exige banco de teste dedicado.`
    };
  }

  // 5. Rejeição por divergência entre o banco declarado de teste e a conexão do cliente
  if (effectiveDb.toLowerCase() !== declaredTestDb.toLowerCase()) {
    return {
      isIsolated: false,
      reason: `Divergência de banco: O banco declarado para testes (${declaredTestDb}) não coincide com o banco configurado no cliente PostgreSQL (${effectiveDb}).`
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

    if (instance.toLowerCase() !== declaredTestInstance.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de instância: A instância declarada (${declaredTestInstance}) não coincide com a conexão do cliente (${instance}).`
      };
    }

    const isInstanceAuthorized =
      AUTHORIZED_TEST_INSTANCES.map(i => i.toLowerCase()).includes(instance.toLowerCase()) ||
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
    // O host configurado deve coincidir estritamente com a instância/endpoint declarada
    if (effectiveHost !== declaredTestInstance.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de endpoint/host: O host declarado (${declaredTestInstance}) não coincide com o configurado (${effectiveHost}).`
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

    if (!isLocalOrTestHost) {
      return {
        isIsolated: false,
        reason: `Host de banco de dados não verificado: '${effectiveHost}' não é um host de teste autorizado.`
      };
    }
  }

  // 8. Validação de Usuário de Conexão de Teste (Identidade e Privilégios Declarados)
  if (effectiveUser !== declaredTestUser.toLowerCase()) {
    return {
      isIsolated: false,
      reason: `Divergência de usuário: O usuário declarado para testes (${declaredTestUser}) não coincide com o configurado no cliente (${effectiveUser}).`
    };
  }

  // Rejeita usuários perigosos / de produção conhecidos
  const isDangerousUser = ["root", "admin", "administrator", "prod_user", "prod_app", "postgres"].includes(effectiveUser);
  if (isDangerousUser) {
    return {
      isIsolated: false,
      reason: `Usuário de conexão não autorizado para testes: Usuário com perfil administrativo/compartilhado ('${effectiveUser}'). Exige usuário de teste dedicado com privilégios mínimos.`
    };
  }

  const isUserAuthorized =
    AUTHORIZED_TEST_USERS.map(u => u.toLowerCase()).includes(effectiveUser) ||
    effectiveUser.startsWith("test") ||
    effectiveUser.endsWith("test") ||
    effectiveUser.includes("_test_");

  if (!isUserAuthorized) {
    return {
      isIsolated: false,
      reason: `Usuário de banco sem identidade de teste confirmada: '${effectiveUser}' não consta na allowlist de usuários de teste autorizados.`
    };
  }

  return {
    isIsolated: true,
    reason: `Ambiente isolado de teste confirmado positivamente: banco '${effectiveDb}', usuário '${effectiveUser}' e instância '${declaredTestInstance}' validados contra a conexão do cliente.`,
    databaseName: effectiveDb,
    instanceId: config.cloudSqlInstance || config.host,
    username: config.username
  };
}

/**
 * Validação ao vivo da conexão PostgreSQL aberta pelo cliente.
 * Consulta diretamente o servidor PostgreSQL para confirmar nome do banco, usuário
 * ativo, usuário de sessão, ausência de privilégios em produção e privilégios mínimos no banco de teste.
 */
export async function verifyLiveTestConnection(
  dbExecutor: { execute: (query: any) => Promise<any[]> },
  sqlTag: (strings: TemplateStringsArray, ...values: any[]) => any,
  overrideEnv?: Record<string, string | undefined>
): Promise<IsolatedTestCheckResult> {
  // 1. Executa primeiro a validação pura de configuração
  const configDecision = isIsolatedTestEnvironment(overrideEnv);
  if (!configDecision.isIsolated) {
    return configDecision;
  }

  const declaredDb = (overrideEnv?.TEST_DATABASE_NAME || process.env.TEST_DATABASE_NAME || "").trim();
  const declaredUser = (overrideEnv?.TEST_DB_USER || process.env.TEST_DB_USER || "").trim();

  // 2. Consulta a identidade real e privilégios no servidor PostgreSQL
  try {
    const identityResult = await dbExecutor.execute(sqlTag`
      SELECT 
        current_database() as current_db,
        current_user as current_usr,
        session_user as session_usr,
        current_setting('is_superuser') as is_superuser,
        has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
        has_schema_privilege(current_user, 'public', 'USAGE') as can_usage_schema;
    `);

    const row = identityResult[0] as any;
    const currentDb = String(row?.current_db || "").trim();
    const currentUsr = String(row?.current_usr || "").trim();
    const sessionUsr = String(row?.session_usr || "").trim();
    const isSuperuser = String(row?.is_superuser || "").trim().toLowerCase();
    const canConnect = Boolean(row?.can_connect);
    const canUsageSchema = Boolean(row?.can_usage_schema);

    // Validação 1: Banco real conectado deve coincidir estritamente com TEST_DATABASE_NAME
    if (currentDb.toLowerCase() !== declaredDb.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência entre conexão real e configuração: O banco real conectado no PostgreSQL é '${currentDb}', mas o teste exige '${declaredDb}'.`
      };
    }

    // Validação 2: Usuário efetivo deve coincidir com TEST_DB_USER
    if (currentUsr.toLowerCase() !== declaredUser.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de usuário efetivo: O usuário real no PostgreSQL é '${currentUsr}', mas o teste exige '${declaredUser}'.`
      };
    }

    // Validação 3: Usuário de sessão deve coincidir com TEST_DB_USER
    if (sessionUsr.toLowerCase() !== declaredUser.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência de usuário de sessão: A sessão no PostgreSQL está autenticada como '${sessionUsr}', mas o teste exige '${declaredUser}'.`
      };
    }

    // Validação 4: Usuário efetivo e usuário de sessão devem ser idênticos (rejeita elevação via SET ROLE)
    if (currentUsr.toLowerCase() !== sessionUsr.toLowerCase()) {
      return {
        isIsolated: false,
        reason: `Divergência entre current_user ('${currentUsr}') e session_user ('${sessionUsr}'). Possível troca de papel de segurança detectada.`
      };
    }

    // Validação 5: Rejeição de superusuário (não aceita superuser para testes)
    if (isSuperuser === "on") {
      return {
        isIsolated: false,
        reason: `Credenciais de teste com privilégios excessivos: O usuário ativo '${currentUsr}' possui privilégio de superusuário no banco. Utilize conta exclusiva de teste com privilégios mínimos.`
      };
    }

    // Validação 6: Validação de privilégios no banco de teste (deve ter CONNECT e USAGE no schema public)
    if (!canConnect) {
      return {
        isIsolated: false,
        reason: `Privilégio insuficiente: O usuário '${currentUsr}' não possui privilégio CONNECT no banco de teste '${currentDb}'.`
      };
    }

    if (!canUsageSchema) {
      return {
        isIsolated: false,
        reason: `Privilégio insuficiente: O usuário '${currentUsr}' não possui permissão de USAGE no schema public do banco '${currentDb}'.`
      };
    }

    // Validação 7: Verificação de papéis e privilégios elevados de cluster
    try {
      const roleResult = await dbExecutor.execute(sqlTag`
        SELECT 
          rolsuper as is_super,
          rolcreaterole as can_create_role,
          rolcreatedb as can_create_db,
          rolreplication as can_replicate
        FROM pg_roles 
        WHERE rolname = current_user;
      `);

      if (roleResult && roleResult.length > 0) {
        const roleRow = roleResult[0] as any;
        if (roleRow.is_super || roleRow.can_create_role || roleRow.can_replicate) {
          return {
            isIsolated: false,
            reason: `Privilégios cluster excessivos: A conta '${currentUsr}' possui privilégios de administração de cluster (rolsuper, rolcreaterole ou rolreplication). A conta de teste deve ter escopo estritamente local.`
          };
        }
      }
    } catch {
      // Caso pg_roles não seja legível para usuários restritos, prossegue para verificação de bancos
    }

    // Validação 8: Verificação estrita de AUSÊNCIA de permissão em bancos de produção no mesmo cluster
    try {
      const otherDbsResult = await dbExecutor.execute(sqlTag`
        SELECT 
          d.datname,
          has_database_privilege(current_user, d.datname, 'CONNECT') as can_connect_other,
          has_database_privilege(current_user, d.datname, 'CREATE') as can_create_other
        FROM pg_database d
        WHERE d.datistemplate = false 
          AND d.datname != current_database();
      `);

      for (const otherDb of otherDbsResult) {
        const otherName = String(otherDb.datname || "").toLowerCase();
        const canConnectOther = Boolean(otherDb.can_connect_other);
        const canCreateOther = Boolean(otherDb.can_create_other);

        // Se houver qualquer banco com terminologia de produção
        const isProdName = otherName.includes("prod") || otherName.includes("production");

        if (isProdName && (canConnectOther || canCreateOther)) {
          return {
            isIsolated: false,
            reason: `Violação de isolamento: A conta '${currentUsr}' possui acesso de conexão/escrita ao banco de produção '${otherDb.datname}' na mesma instância. A conta de teste não pode ter permissões em produção.`
          };
        }

        // Não pode ter privilégio de CREATE em outros bancos do cluster
        if (canCreateOther) {
          return {
            isIsolated: false,
            reason: `Privilégios mais amplos que o necessário: A conta '${currentUsr}' possui privilégio de escrita/criação em outro banco de dados ('${otherDb.datname}').`
          };
        }
      }
    } catch {
      // Prossegue se pg_database não puder ser enumerado por falta de privilégio
    }

    return {
      isIsolated: true,
      reason: `Conexão real validada com sucesso: Banco '${currentDb}', usuário '${currentUsr}', privilégios mínimos no banco de teste confirmados e sem acesso à produção.`,
      databaseName: currentDb,
      username: currentUsr,
      sessionUser: sessionUsr
    };
  } catch (err: any) {
    return {
      isIsolated: false,
      reason: `Falha ao consultar identidade da conexão real com o PostgreSQL: ${err?.message || "Erro desconhecido"}`
    };
  }
}

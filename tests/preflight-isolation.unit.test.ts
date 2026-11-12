import {
  isIsolatedTestEnvironment,
  verifyLiveTestConnection,
  AUTHORIZED_TEST_DATABASES,
  AUTHORIZED_TEST_INSTANCES,
  AUTHORIZED_TEST_USERS
} from "../src/utils/testIsolation.ts";

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, expected: string, actual: string, details?: string) {
  const passed = Boolean(condition);
  results.push({ name, passed, expected, actual, details });
  if (passed) {
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name} | Esperado: ${expected} | Obtido: ${actual} ${details ? `| Detalhes: ${details}` : ''}`);
  }
}

// Mock SQL Tag que preserva o SQL para inspeção pelo executor mock
const mockSqlTag = (strings: TemplateStringsArray, ..._values: any[]) => ({
  sql: strings.join("?")
});

function createMockDbExecutor(config: {
  identityRow?: any;
  roleRows?: any[];
  otherDbRows?: any[];
  roleError?: Error;
  databaseError?: Error;
  identityError?: Error;
}) {
  return {
    execute: async (queryObj: any) => {
      const sqlText = queryObj?.sql || queryObj?.text || String(queryObj);
      if (sqlText.includes("pg_roles")) {
        if (config.roleError) {
          throw config.roleError;
        }
        return config.roleRows !== undefined ? config.roleRows : [
          { is_super: false, can_create_role: false, can_create_db: false, can_replicate: false }
        ];
      }
      if (sqlText.includes("pg_database")) {
        if (config.databaseError) {
          throw config.databaseError;
        }
        return config.otherDbRows !== undefined ? config.otherDbRows : [];
      }
      if (config.identityError) {
        throw config.identityError;
      }
      return [
        config.identityRow || {
          current_db: "s1gestao_test",
          current_usr: "test_user",
          session_usr: "test_user",
          is_superuser: "off",
          can_connect: true,
          can_usage_schema: true
        }
      ];
    }
  };
}

async function runUnitTests() {
  console.log("\n=======================================================");
  console.log("🧪 TESTES UNITÁRIOS DE PREFLIGHT E ISOLAMENTO DE BANCO");
  console.log("   (Execução pura em memória — sem conexão ou escrita real)");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // Bloco 1: Validação de Variáveis Mandatórias
  // -------------------------------------------------------------
  console.log("📌 Bloco 1: Variáveis Obrigatórias de Teste sem Valores Padrão Permissivos");

  // 1.1 Falta TEST_DATABASE_NAME
  const checkMissingDb = isIsolatedTestEnvironment({
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkMissingDb.isIsolated === false && checkMissingDb.reason.includes("TEST_DATABASE_NAME ausente"),
    "Variáveis Obrigatórias: Falta TEST_DATABASE_NAME é rejeitada",
    "false",
    String(checkMissingDb.isIsolated),
    checkMissingDb.reason
  );

  // 1.2 Falta TEST_DB_USER
  const checkMissingUser = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkMissingUser.isIsolated === false && checkMissingUser.reason.includes("TEST_DB_USER ausente"),
    "Variáveis Obrigatórias: Falta TEST_DB_USER é rejeitada",
    "false",
    String(checkMissingUser.isIsolated),
    checkMissingUser.reason
  );

  // 1.3 Falta TEST_INSTANCE_ID
  const checkMissingInstance = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkMissingInstance.isIsolated === false && checkMissingInstance.reason.includes("TEST_INSTANCE_ID ausente"),
    "Variáveis Obrigatórias: Falta TEST_INSTANCE_ID é rejeitada",
    "false",
    String(checkMissingInstance.isIsolated),
    checkMissingInstance.reason
  );

  // -------------------------------------------------------------
  // Bloco 2: Heurísticas Insuficientes Rejeitadas
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 2: Heurísticas Fracas Rejeitadas por Si Sós");

  // 2.1 NODE_ENV=test sozinho é rejeitado
  const checkNodeEnvTest = isIsolatedTestEnvironment({ NODE_ENV: "test" });
  assert(
    checkNodeEnvTest.isIsolated === false,
    "Heurística Fraca: NODE_ENV=test sozinho é rejeitado",
    "false",
    String(checkNodeEnvTest.isIsolated)
  );

  // 2.2 NODE_ENV=development sozinho é rejeitado
  const checkNodeEnvDev = isIsolatedTestEnvironment({ NODE_ENV: "development" });
  assert(
    checkNodeEnvDev.isIsolated === false,
    "Heurística Fraca: NODE_ENV=development sozinho é rejeitado",
    "false",
    String(checkNodeEnvDev.isIsolated)
  );

  // 2.3 Host localhost sozinho é rejeitado
  const checkLocalhost = isIsolatedTestEnvironment({ SQL_HOST: "localhost" });
  assert(
    checkLocalhost.isIsolated === false,
    "Heurística Fraca: Host localhost sozinho é rejeitado",
    "false",
    String(checkLocalhost.isIsolated)
  );

  // -------------------------------------------------------------
  // Bloco 3: Rejeição de Sockets Cloud SQL e Instâncias Não Verificadas
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 3: Validação de Socket Cloud SQL e Instâncias");

  // 3.1 Socket sem formato PROJECT:REGION:INSTANCE
  const checkMalformedSocket = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "socket-invalido",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "/app/cloudsql/socket-invalido"
  });
  assert(
    checkMalformedSocket.isIsolated === false && checkMalformedSocket.reason.includes("PROJECT:REGION:INSTANCE"),
    "Socket Cloud SQL: Formato sem PROJECT:REGION:INSTANCE é rejeitado",
    "false",
    String(checkMalformedSocket.isIsolated),
    checkMalformedSocket.reason
  );

  // 3.2 Socket com instância externa não autorizada
  const checkUnauthorizedSocket = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "unauthorized-corp:us-central1:corp-instance",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "/app/cloudsql/unauthorized-corp:us-central1:corp-instance"
  });
  assert(
    checkUnauthorizedSocket.isIsolated === false && checkUnauthorizedSocket.reason.includes("não autorizada"),
    "Socket Cloud SQL: Instância não presente na allowlist é rejeitada",
    "false",
    String(checkUnauthorizedSocket.isIsolated),
    checkUnauthorizedSocket.reason
  );

  // 3.3 Host externo não verificado com banco da allowlist
  const checkUnverifiedHost = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "external-unverified-db.cloud.corp",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "external-unverified-db.cloud.corp"
  });
  assert(
    checkUnverifiedHost.isIsolated === false && checkUnverifiedHost.reason.includes("não é um host de teste autorizado"),
    "Instância Não Verificada: Host externo com banco autorizado é rejeitado",
    "false",
    String(checkUnverifiedHost.isIsolated),
    checkUnverifiedHost.reason
  );

  // -------------------------------------------------------------
  // Bloco 4: Validação de Usuários e Privilégios Declarados
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 4: Contas de Conexão e Perfis Administrativos");

  // 4.1 Usuário root é rejeitado
  const checkRoot = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "root",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "root",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkRoot.isIsolated === false && checkRoot.reason.includes("administrativo/compartilhado"),
    "Contas: Usuário root é rejeitado",
    "false",
    String(checkRoot.isIsolated),
    checkRoot.reason
  );

  // 4.2 Usuário admin é rejeitado
  const checkAdmin = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "admin",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "admin",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkAdmin.isIsolated === false && checkAdmin.reason.includes("administrativo/compartilhado"),
    "Contas: Usuário admin é rejeitado",
    "false",
    String(checkAdmin.isIsolated),
    checkAdmin.reason
  );

  // 4.3 Usuário desconhecido / não autorizado
  const checkUnknownUser = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "developer_generic",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "developer_generic",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkUnknownUser.isIsolated === false && checkUnknownUser.reason.includes("não consta na allowlist de usuários"),
    "Contas: Usuário sem identidade de teste autorizada é rejeitado",
    "false",
    String(checkUnknownUser.isIsolated),
    checkUnknownUser.reason
  );

  // -------------------------------------------------------------
  // Bloco 5: Divergências de Configuração (Fail-Closed)
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 5: Divergências entre Declarado e Conexão Efetiva");

  // 5.1 Divergência de Banco
  const checkDbDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "banco_outro",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkDbDiv.isIsolated === false && checkDbDiv.reason.includes("Divergência de banco"),
    "Divergência: TEST_DATABASE_NAME !== SQL_DB_NAME é rejeitada",
    "false",
    String(checkDbDiv.isIsolated),
    checkDbDiv.reason
  );

  // 5.2 Divergência de Usuário
  const checkUserDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "s1_test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkUserDiv.isIsolated === false && checkUserDiv.reason.includes("Divergência de usuário"),
    "Divergência: TEST_DB_USER !== SQL_USER é rejeitada",
    "false",
    String(checkUserDiv.isIsolated),
    checkUserDiv.reason
  );

  // 5.3 Divergência de Instância
  const checkInstDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "cloud_sql_development_database",
    TEST_DB_USER: "ai_studio_test_user",
    TEST_INSTANCE_ID: "snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf",
    SQL_DB_NAME: "cloud_sql_development_database",
    SQL_USER: "ai_studio_test_user",
    SQL_HOST: "/app/cloudsql/other-proj:us-west2:other-inst"
  });
  assert(
    checkInstDiv.isIsolated === false && checkInstDiv.reason.includes("Divergência de instância"),
    "Divergência: TEST_INSTANCE_ID !== socket Cloud SQL é rejeitada",
    "false",
    String(checkInstDiv.isIsolated),
    checkInstDiv.reason
  );

  // -------------------------------------------------------------
  // Bloco 6: Rejeição de Terminologia e Hosts de Produção
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 6: Rejeição de Terminologia Produtiva e Sanitização");

  const checkProdDb = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1_production",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1_production",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkProdDb.isIsolated === false,
    "Produção: Banco com 'production' é rejeitado",
    "false",
    String(checkProdDb.isIsolated)
  );

  const checkProdUrl = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    DATABASE_URL: "postgresql://test_user:segredo_super_secreto@prod-db.internal:5432/s1gestao_test"
  });
  assert(
    checkProdUrl.isIsolated === false,
    "Produção: URL contendo host prod-db é rejeitada",
    "false",
    String(checkProdUrl.isIsolated)
  );

  assert(
    !checkProdUrl.reason.includes("segredo_super_secreto") && !checkProdUrl.reason.includes("password"),
    "Sanitização: Mensagem de erro nunca exibe senhas ou credenciais",
    "true",
    String(!checkProdUrl.reason.includes("segredo_super_secreto"))
  );

  // -------------------------------------------------------------
  // Bloco 7: Configurações Válidas de Teste (Local e Cloud SQL)
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 7: Aceitação de Configurações Dedicadas Válidas");

  const checkValidLocal = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    checkValidLocal.isIsolated === true,
    "Válido: Configuração local dedicada com todas as variáveis obrigatórias é aceita",
    "true",
    String(checkValidLocal.isIsolated),
    checkValidLocal.reason
  );

  const checkValidCloudSql = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "cloud_sql_development_database",
    TEST_DB_USER: "ai_studio_test_user",
    TEST_INSTANCE_ID: "snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf",
    SQL_DB_NAME: "cloud_sql_development_database",
    SQL_USER: "ai_studio_test_user",
    SQL_HOST: "/app/cloudsql/snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf"
  });
  assert(
    checkValidCloudSql.isIsolated === true,
    "Válido: Configuração Cloud SQL dedicada com instância e usuário autorizados é aceita",
    "true",
    String(checkValidCloudSql.isIsolated),
    checkValidCloudSql.reason
  );

  // -------------------------------------------------------------
  // Bloco 8: Validação ao Vivo de Conexão com Mocks (verifyLiveTestConnection)
  // -------------------------------------------------------------
  console.log("\n📌 Bloco 8: Testes de verifyLiveTestConnection (Mocks de Consulta ao Servidor)");

  const validEnv = {
    TEST_DATABASE_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    TEST_INSTANCE_ID: "127.0.0.1",
    SQL_DB_NAME: "s1gestao_test",
    SQL_USER: "test_user",
    SQL_HOST: "127.0.0.1"
  };

  // 8.1 Divergência de current_database() real
  const mockDbDivergent = createMockDbExecutor({
    identityRow: {
      current_db: "banco_operacional_real",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    }
  });
  const checkLiveDbDiv = await verifyLiveTestConnection(mockDbDivergent, mockSqlTag, validEnv);
  assert(
    checkLiveDbDiv.isIsolated === false && checkLiveDbDiv.reason.includes("Divergência entre conexão real"),
    "Live Mock: current_database() real divergente do declarado é rejeitado",
    "false",
    String(checkLiveDbDiv.isIsolated),
    checkLiveDbDiv.reason
  );

  // 8.2 Divergência de current_user real
  const mockUserDivergent = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "outro_usuario_real",
      session_usr: "outro_usuario_real",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    }
  });
  const checkLiveUserDiv = await verifyLiveTestConnection(mockUserDivergent, mockSqlTag, validEnv);
  assert(
    checkLiveUserDiv.isIsolated === false && checkLiveUserDiv.reason.includes("Divergência de usuário efetivo"),
    "Live Mock: current_user real divergente de TEST_DB_USER é rejeitado",
    "false",
    String(checkLiveUserDiv.isIsolated),
    checkLiveUserDiv.reason
  );

  // 8.3 Divergência de session_user real vs declarado
  const mockSessionUserDiv = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "sessao_divergente",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    }
  });
  const checkLiveSessionDiv = await verifyLiveTestConnection(mockSessionUserDiv, mockSqlTag, validEnv);
  assert(
    checkLiveSessionDiv.isIsolated === false && checkLiveSessionDiv.reason.includes("Divergência de usuário de sessão"),
    "Live Mock: session_user real divergente de TEST_DB_USER é rejeitado",
    "false",
    String(checkLiveSessionDiv.isIsolated),
    checkLiveSessionDiv.reason
  );

  // 8.4 Divergência entre current_user e session_user (SET ROLE / troca de papel)
  const mockSetRoleElevation = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "different_login_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    }
  });
  const checkLiveSetRole = await verifyLiveTestConnection(mockSetRoleElevation, mockSqlTag, {
    ...validEnv,
    TEST_DB_USER: "test_user"
  });
  assert(
    checkLiveSetRole.isIsolated === false,
    "Live Mock: Divergência entre current_user e session_user (elevação via SET ROLE) é rejeitada",
    "false",
    String(checkLiveSetRole.isIsolated),
    checkLiveSetRole.reason
  );

  // 8.5 Rejeição de superusuário (is_superuser = 'on')
  const mockSuperuser = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "on",
      can_connect: true,
      can_usage_schema: true
    }
  });
  const checkLiveSuper = await verifyLiveTestConnection(mockSuperuser, mockSqlTag, validEnv);
  assert(
    checkLiveSuper.isIsolated === false && checkLiveSuper.reason.includes("privilégios excessivos"),
    "Live Mock: is_superuser = 'on' é rejeitado",
    "false",
    String(checkLiveSuper.isIsolated),
    checkLiveSuper.reason
  );

  // 8.6 Rejeição de privilégios elevados de cluster em pg_roles (ex: rolcreaterole)
  const mockClusterAdminRole = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    },
    roleRows: [
      { is_super: false, can_create_role: true, can_create_db: false, can_replicate: false }
    ]
  });
  const checkLiveClusterAdmin = await verifyLiveTestConnection(mockClusterAdminRole, mockSqlTag, validEnv);
  assert(
    checkLiveClusterAdmin.isIsolated === false && checkLiveClusterAdmin.reason.includes("Privilégios cluster excessivos"),
    "Live Mock: Privilégios administrativos de cluster (rolcreaterole) são rejeitados",
    "false",
    String(checkLiveClusterAdmin.isIsolated),
    checkLiveClusterAdmin.reason
  );

  // 8.6b Rejeição de rolcreatedb = true
  const mockCreateDbRole = createMockDbExecutor({
    roleRows: [
      { is_super: false, can_create_role: false, can_create_db: true, can_replicate: false }
    ]
  });
  const checkLiveCreateDb = await verifyLiveTestConnection(mockCreateDbRole, mockSqlTag, validEnv);
  assert(
    checkLiveCreateDb.isIsolated === false && checkLiveCreateDb.reason.includes("rolcreatedb"),
    "Live Mock: Privilégio rolcreatedb = true é rejeitado",
    "false",
    String(checkLiveCreateDb.isIsolated),
    checkLiveCreateDb.reason
  );

  // 8.6c Consulta a pg_roles rejeitada (lança erro / permissão negada)
  const mockRolesError = createMockDbExecutor({
    roleError: new Error("permission denied for table pg_roles")
  });
  const checkLiveRolesError = await verifyLiveTestConnection(mockRolesError, mockSqlTag, validEnv);
  assert(
    checkLiveRolesError.isIsolated === false && checkLiveRolesError.reason.includes("Falha ao verificar privilégios em pg_roles"),
    "Live Mock: Consulta a pg_roles que falha/gera exceção é rejeitada (fail-closed)",
    "false",
    String(checkLiveRolesError.isIsolated),
    checkLiveRolesError.reason
  );

  // 8.6d Consulta a pg_roles vazia ([])
  const mockRolesEmpty = createMockDbExecutor({
    roleRows: []
  });
  const checkLiveRolesEmpty = await verifyLiveTestConnection(mockRolesEmpty, mockSqlTag, validEnv);
  assert(
    checkLiveRolesEmpty.isIsolated === false && checkLiveRolesEmpty.reason.includes("vazia ou incompleta"),
    "Live Mock: Consulta a pg_roles vazia é rejeitada (fail-closed)",
    "false",
    String(checkLiveRolesEmpty.isIsolated),
    checkLiveRolesEmpty.reason
  );

  // 8.6e Consulta a pg_roles incompleta / tipos inválidos
  const mockRolesIncomplete = createMockDbExecutor({
    roleRows: [
      { is_super: false, can_create_role: false, can_create_db: null, can_replicate: false }
    ]
  });
  const checkLiveRolesIncomplete = await verifyLiveTestConnection(mockRolesIncomplete, mockSqlTag, validEnv);
  assert(
    checkLiveRolesIncomplete.isIsolated === false && checkLiveRolesIncomplete.reason.includes("incompleto, ausente ou com tipos inválidos"),
    "Live Mock: Consulta a pg_roles com campos ausentes ou tipos inválidos é rejeitada",
    "false",
    String(checkLiveRolesIncomplete.isIsolated),
    checkLiveRolesIncomplete.reason
  );

  // 8.7 Rejeição quando a conta tem acesso de conexão a banco de produção no cluster
  const mockProdAccess = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    },
    otherDbRows: [
      { datname: "cloud_sql_production_database", can_connect_other: true, can_create_other: false }
    ]
  });
  const checkLiveProdAccess = await verifyLiveTestConnection(mockProdAccess, mockSqlTag, validEnv);
  assert(
    checkLiveProdAccess.isIsolated === false && checkLiveProdAccess.reason.includes("Violação de isolamento"),
    "Live Mock: Conta com acesso a banco de produção no mesmo cluster é rejeitada",
    "false",
    String(checkLiveProdAccess.isIsolated),
    checkLiveProdAccess.reason
  );

  // 8.7b Consulta a pg_database rejeitada (lança erro / exceção)
  const mockDatabaseError = createMockDbExecutor({
    databaseError: new Error("permission denied for relation pg_database")
  });
  const checkLiveDatabaseError = await verifyLiveTestConnection(mockDatabaseError, mockSqlTag, validEnv);
  assert(
    checkLiveDatabaseError.isIsolated === false && checkLiveDatabaseError.reason.includes("Falha ao inspecionar bancos de dados"),
    "Live Mock: Consulta a pg_database que falha/gera exceção é rejeitada (fail-closed)",
    "false",
    String(checkLiveDatabaseError.isIsolated),
    checkLiveDatabaseError.reason
  );

  // 8.7c Consulta a pg_database incompleta / estrutura inesperada
  const mockDatabaseIncomplete = createMockDbExecutor({
    otherDbRows: [
      { datname: "banco_desconhecido", can_connect_other: null, can_create_other: false }
    ]
  });
  const checkLiveDatabaseIncomplete = await verifyLiveTestConnection(mockDatabaseIncomplete, mockSqlTag, validEnv);
  assert(
    checkLiveDatabaseIncomplete.isIsolated === false && checkLiveDatabaseIncomplete.reason.includes("incompleto ou ambíguo"),
    "Live Mock: Consulta a pg_database com campos ausentes/inválidos é rejeitada",
    "false",
    String(checkLiveDatabaseIncomplete.isIsolated),
    checkLiveDatabaseIncomplete.reason
  );

  // 8.7d Acesso a banco adicional não autorizado (fora da allowlist de testes)
  const mockUnauthorizedExtraDb = createMockDbExecutor({
    otherDbRows: [
      { datname: "financeiro_operacional_db", can_connect_other: true, can_create_other: false }
    ]
  });
  const checkLiveExtraDb = await verifyLiveTestConnection(mockUnauthorizedExtraDb, mockSqlTag, validEnv);
  assert(
    checkLiveExtraDb.isIsolated === false && checkLiveExtraDb.reason.includes("Acesso a banco adicional não autorizado"),
    "Live Mock: Conta com privilégio CONNECT em banco adicional fora da allowlist é rejeitada",
    "false",
    String(checkLiveExtraDb.isIsolated),
    checkLiveExtraDb.reason
  );

  // 8.8 Rejeição quando a conta não tem privilégio de USAGE no schema public do banco de teste
  const mockMissingUsage = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: false
    }
  });
  const checkLiveMissingUsage = await verifyLiveTestConnection(mockMissingUsage, mockSqlTag, validEnv);
  assert(
    checkLiveMissingUsage.isIsolated === false && checkLiveMissingUsage.reason.includes("Privilégio insuficiente"),
    "Live Mock: Falta de permissão USAGE no schema public é rejeitada",
    "false",
    String(checkLiveMissingUsage.isIsolated),
    checkLiveMissingUsage.reason
  );

  // 8.8b Erro ou resultado ambíguo na verificação de identidade/privilégios
  const mockIdentityAmbiguous = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: null // Ambíguo / não booleano
    }
  });
  const checkLiveIdentityAmbiguous = await verifyLiveTestConnection(mockIdentityAmbiguous, mockSqlTag, validEnv);
  assert(
    checkLiveIdentityAmbiguous.isIsolated === false && checkLiveIdentityAmbiguous.reason.includes("Estrutura incompleta ou tipos inválidos"),
    "Live Mock: Identidade com campos ausentes ou tipos não-booleanos é rejeitada",
    "false",
    String(checkLiveIdentityAmbiguous.isIsolated),
    checkLiveIdentityAmbiguous.reason
  );

  const mockIdentityError = createMockDbExecutor({
    identityError: new Error("connection terminated unexpectedly")
  });
  const checkLiveIdentityError = await verifyLiveTestConnection(mockIdentityError, mockSqlTag, validEnv);
  assert(
    checkLiveIdentityError.isIsolated === false && checkLiveIdentityError.reason.includes("Falha ao consultar identidade ou privilégios"),
    "Live Mock: Exceção durante consulta de identidade é capturada com mensagem segura e bloqueia",
    "false",
    String(checkLiveIdentityError.isIsolated),
    checkLiveIdentityError.reason
  );

  // 8.9 Conexão real válida com conta isolada e privilégios mínimos confirmados
  const mockLiveValid = createMockDbExecutor({
    identityRow: {
      current_db: "s1gestao_test",
      current_usr: "test_user",
      session_usr: "test_user",
      is_superuser: "off",
      can_connect: true,
      can_usage_schema: true
    },
    roleRows: [
      { is_super: false, can_create_role: false, can_create_db: false, can_replicate: false }
    ],
    otherDbRows: []
  });
  const checkLiveValid = await verifyLiveTestConnection(mockLiveValid, mockSqlTag, validEnv);
  assert(
    checkLiveValid.isIsolated === true,
    "Live Mock: Conexão real com banco coincidente, usuário restrito e sem acesso produtivo é aceita",
    "true",
    String(checkLiveValid.isIsolated),
    checkLiveValid.reason
  );

  // -------------------------------------------------------------
  // Resumo dos Resultados
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n=======================================================");
  console.log(`📊 RESULTADO DOS TESTES UNITÁRIOS: ${passed}/${total} APROVADOS (${failed} falhas)`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runUnitTests().catch((err) => {
  console.error("Erro fatal ao executar testes unitários de preflight:", err);
  process.exit(1);
});

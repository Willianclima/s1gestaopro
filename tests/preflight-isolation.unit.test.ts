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

async function runUnitTests() {
  console.log("\n=======================================================");
  console.log("🧪 TESTES UNITÁRIOS DE PREFLIGHT E ISOLAMENTO DE BANCO");
  console.log("   (Execução pura em memória — sem conexão ou escrita real)");
  console.log("=======================================================\n");

  // 1. NODE_ENV=test sozinho é rejeitado
  const check1 = isIsolatedTestEnvironment({ NODE_ENV: "test" });
  assert(
    check1.isIsolated === false,
    "Preflight Unitário: NODE_ENV=test sozinho é rejeitado",
    "false",
    String(check1.isIsolated)
  );

  // 2. NODE_ENV=development sozinho é rejeitado
  const check2 = isIsolatedTestEnvironment({ NODE_ENV: "development" });
  assert(
    check2.isIsolated === false,
    "Preflight Unitário: NODE_ENV=development sozinho é rejeitado",
    "false",
    String(check2.isIsolated)
  );

  // 3. Host localhost sozinho é rejeitado
  const check3 = isIsolatedTestEnvironment({ SQL_HOST: "localhost" });
  assert(
    check3.isIsolated === false,
    "Preflight Unitário: Host localhost sozinho é rejeitado",
    "false",
    String(check3.isIsolated)
  );

  // 4. Socket Cloud SQL sem projeto/instância autorizados é rejeitado
  const check4 = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "/app/cloudsql/instance-id-invalido"
  });
  assert(
    check4.isIsolated === false,
    "Preflight Unitário: Socket Cloud SQL sem formato PROJECT:REGION:INSTANCE é rejeitado",
    "false",
    String(check4.isIsolated),
    check4.reason
  );

  const check4b = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "/app/cloudsql/unauthorized-corp:us-central1:prod-db"
  });
  assert(
    check4b.isIsolated === false,
    "Preflight Unitário: Socket Cloud SQL com instância não autorizada é rejeitado",
    "false",
    String(check4b.isIsolated),
    check4b.reason
  );

  // 5. Banco da allowlist conectado a uma instância não verificada é rejeitado
  const check5 = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "external-unverified-db.cloud.corp",
    SQL_USER: "test_user"
  });
  assert(
    check5.isIsolated === false,
    "Preflight Unitário: Banco da allowlist conectado a uma instância não verificada é rejeitado",
    "false",
    String(check5.isIsolated),
    check5.reason
  );

  // 6. Usuário de banco sem identidade ou privilégios de teste confirmados é rejeitado
  const check6Root = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "root"
  });
  assert(
    check6Root.isIsolated === false,
    "Preflight Unitário: Usuário root (perfil administrativo perigoso) é rejeitado",
    "false",
    String(check6Root.isIsolated),
    check6Root.reason
  );

  const check6Admin = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "admin"
  });
  assert(
    check6Admin.isIsolated === false,
    "Preflight Unitário: Usuário admin (perfil não confirmado de teste) é rejeitado",
    "false",
    String(check6Admin.isIsolated),
    check6Admin.reason
  );

  const check6Unverified = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "unknown_developer"
  });
  assert(
    check6Unverified.isIsolated === false,
    "Preflight Unitário: Usuário sem identidade de teste confirmada é rejeitado",
    "false",
    String(check6Unverified.isIsolated),
    check6Unverified.reason
  );

  // 7. Divergência entre configuração declarada e conexão real é rejeitada
  const check7DbDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "banco_divergente",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "test_user"
  });
  assert(
    check7DbDiv.isIsolated === false,
    "Preflight Unitário: Divergência entre TEST_DATABASE_NAME e SQL_DB_NAME é rejeitada",
    "false",
    String(check7DbDiv.isIsolated),
    check7DbDiv.reason
  );

  const check7UserDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    TEST_DB_USER: "test_user",
    SQL_USER: "outro_usuario",
    SQL_HOST: "127.0.0.1"
  });
  assert(
    check7UserDiv.isIsolated === false,
    "Preflight Unitário: Divergência entre TEST_DB_USER e SQL_USER é rejeitada",
    "false",
    String(check7UserDiv.isIsolated),
    check7UserDiv.reason
  );

  const check7InstDiv = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    TEST_INSTANCE_ID: "snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf",
    SQL_HOST: "/app/cloudsql/other-project:us-west2:other-instance",
    SQL_USER: "ai_studio_app_user"
  });
  assert(
    check7InstDiv.isIsolated === false,
    "Preflight Unitário: Divergência entre TEST_INSTANCE_ID e socket conectado é rejeitada",
    "false",
    String(check7InstDiv.isIsolated),
    check7InstDiv.reason
  );

  // 8. Banco ou URL explicitamente identificados como produção são rejeitados
  const check8Prod = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1_production",
    SQL_DB_NAME: "s1_production",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "test_user"
  });
  assert(
    check8Prod.isIsolated === false,
    "Preflight Unitário: Banco identificado com 'production' é rejeitado",
    "false",
    String(check8Prod.isIsolated)
  );

  const check8Url = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    DATABASE_URL: "postgresql://test_user:segredo@prod-db.internal:5432/s1gestao_test"
  });
  assert(
    check8Url.isIsolated === false,
    "Preflight Unitário: URL apontando para host 'prod-db' é rejeitada",
    "false",
    String(check8Url.isIsolated)
  );

  // 9. Configuração dedicada e completa de banco de teste autorizado é aceita
  const check9ValidLocal = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "s1gestao_test",
    SQL_DB_NAME: "s1gestao_test",
    SQL_HOST: "127.0.0.1",
    SQL_USER: "test_user"
  });
  assert(
    check9ValidLocal.isIsolated === true,
    "Preflight Unitário: Configuração local dedicada e autorizada é aceita",
    "true",
    String(check9ValidLocal.isIsolated)
  );

  const check9ValidCloudSql = isIsolatedTestEnvironment({
    TEST_DATABASE_NAME: "cloud_sql_development_database",
    SQL_DB_NAME: "cloud_sql_development_database",
    SQL_HOST: "/app/cloudsql/snappy-champion-zsx2c:us-west2:ai-studio-b5818bcf",
    SQL_USER: "ai_studio_app_user"
  });
  assert(
    check9ValidCloudSql.isIsolated === true,
    "Preflight Unitário: Configuração Cloud SQL autorizada (instância e usuário válidos) é aceita",
    "true",
    String(check9ValidCloudSql.isIsolated)
  );

  // 10. Sanitização de logs e segredos
  assert(
    !check8Url.reason.includes("segredo") && !check8Url.reason.includes("password"),
    "Preflight Unitário: Motivo de erro não vaza senhas ou tokens",
    "true",
    String(!check8Url.reason.includes("segredo"))
  );

  // 11. Validação simulada de conexão ao vivo (verifyLiveTestConnection)
  // 11.1 Mock rejeita divergência entre o banco retornado pelo PostgreSQL e o declarado
  const mockDbDivergent = {
    execute: async () => [
      {
        current_db: "banco_operacional_real",
        current_usr: "test_user",
        is_superuser: "off",
        can_connect: true
      }
    ]
  };
  const check11a = await verifyLiveTestConnection(
    mockDbDivergent,
    () => ({}),
    {
      TEST_DATABASE_NAME: "s1gestao_test",
      SQL_DB_NAME: "s1gestao_test",
      SQL_HOST: "127.0.0.1",
      SQL_USER: "test_user"
    }
  );
  assert(
    check11a.isIsolated === false && check11a.reason.includes("Divergência entre conexão real"),
    "Preflight Conexão Real: Rejeita quando current_database() real diverge do declarado",
    "false",
    String(check11a.isIsolated),
    check11a.reason
  );

  // 11.2 Mock rejeita superusuário quando privilégios limitados são exigidos
  const mockDbSuperuser = {
    execute: async () => [
      {
        current_db: "s1gestao_test",
        current_usr: "test_user",
        is_superuser: "on",
        can_connect: true
      }
    ]
  };
  const check11b = await verifyLiveTestConnection(
    mockDbSuperuser,
    () => ({}),
    {
      TEST_DATABASE_NAME: "s1gestao_test",
      SQL_DB_NAME: "s1gestao_test",
      SQL_HOST: "127.0.0.1",
      SQL_USER: "test_user"
    }
  );
  assert(
    check11b.isIsolated === false && check11b.reason.includes("privilégios excessivos"),
    "Preflight Conexão Real: Rejeita quando usuário conectado possui privilégio de superusuário",
    "false",
    String(check11b.isIsolated),
    check11b.reason
  );

  // 11.3 Mock aceita conexão real com credenciais limitadas e banco coincidente
  const mockDbValid = {
    execute: async () => [
      {
        current_db: "s1gestao_test",
        current_usr: "test_user",
        is_superuser: "off",
        can_connect: true
      }
    ]
  };
  const check11c = await verifyLiveTestConnection(
    mockDbValid,
    () => ({}),
    {
      TEST_DATABASE_NAME: "s1gestao_test",
      SQL_DB_NAME: "s1gestao_test",
      SQL_HOST: "127.0.0.1",
      SQL_USER: "test_user"
    }
  );
  assert(
    check11c.isIsolated === true,
    "Preflight Conexão Real: Aceita quando identidade real do banco e privilégios limitados são confirmados",
    "true",
    String(check11c.isIsolated),
    check11c.reason
  );

  // Relatório Final
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

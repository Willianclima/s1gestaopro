/**
 * Suite de Testes Automatizados de Segurança, Autenticação e Autorização (RBAC)
 * S1 Gestão Pro — Etapa 1
 *
 * Executa testes de integração contra a API Express para validar os 8 requisitos mandatórios:
 * 1. Requisição sem token é recusada nas rotas protegidas (401).
 * 2. Token inválido, expirado ou forjado é recusado (401).
 * 3. Cabeçalhos falsos (X-App-Auth, X-User-Role, etc.) não concedem acesso (401).
 * 4. Token válido de usuário comum não permite operações administrativas (403).
 * 5. A rota de migração é recusada para usuários não administradores (403).
 * 6. Usuário não acessa registros fora do seu escopo (403 / isolamento).
 * 7. Usuário autorizado executa operações previstas para seu perfil (200).
 * 8. Fluxos legítimos de cadastro e autenticação de administrador continuam funcionando (200/201).
 */

import http from "http";
import { app } from "../server.ts";
import { signServerSessionToken } from "../src/middleware/auth.ts";

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, expected: string, actual: string, details?: string) {
  results.push({
    name,
    passed: condition,
    expected,
    actual,
    details
  });
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name} | Esperado: ${expected} | Obtido: ${actual} | Detalhes: ${details || ""}`);
  }
}

async function runSecurityTestSuite() {
  console.log("\n=======================================================");
  console.log("🔒 INICIANDO SUITE DE TESTES AUTOMATIZADOS DE SEGURANÇA");
  console.log("=======================================================\n");

  // Inicia servidor em porta efêmera para testes
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Servidor de teste operacional em: ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // Geração de Tokens de Teste (Criptograficamente assinados)
    // -------------------------------------------------------------
    const adminToken = signServerSessionToken({
      uid: "admin-tester-01",
      email: "willianclima@gmail.com",
      role: "admin",
      name: "Willian C. Lima",
      document: "36911121884"
    });

    const gestorToken = signServerSessionToken({
      uid: "gestor-tester-01",
      email: "gestor@s1gestaopro.local",
      role: "gestor",
      name: "Gestor Operacional",
      document: "22233344455"
    });

    const profissionalToken = signServerSessionToken({
      uid: "prof-tester-01",
      email: "carlos.tecnico@s1gestaopro.local",
      role: "profissional",
      name: "Carlos Henrique",
      document: "44455566677"
    });

    const requisitanteToken = signServerSessionToken({
      uid: "req-tester-01",
      email: "cidadao@s1gestaopro.local",
      role: "requisitante",
      name: "Cidadão Requisitante",
      document: "11122233344"
    });

    const expiredToken = signServerSessionToken({
      uid: "expired-user",
      role: "admin"
    }, -3600); // Expirado há 1 hora

    const tamperedToken = adminToken.substring(0, adminToken.length - 6) + "xxxxxx";

    // =============================================================
    // GRUPO 1: Requisições sem token são recusadas (401)
    // =============================================================
    console.log("📌 Grupo 1: Requisição sem token é recusada nas rotas protegidas (401)");

    const resNoTokenUsers = await fetch(`${baseUrl}/api/postgres/users/req-tester-01`);
    assert(resNoTokenUsers.status === 401, "GET /api/postgres/users/:uid sem token", "401", String(resNoTokenUsers.status));

    const resNoTokenUsuarios = await fetch(`${baseUrl}/api/usuarios`);
    assert(resNoTokenUsuarios.status === 401, "GET /api/usuarios sem token", "401", String(resNoTokenUsuarios.status));

    const resNoTokenOrders = await fetch(`${baseUrl}/api/postgres/service-orders`);
    assert(resNoTokenOrders.status === 401, "GET /api/postgres/service-orders sem token", "401", String(resNoTokenOrders.status));

    const resNoTokenLogs = await fetch(`${baseUrl}/api/postgres/system-logs`);
    assert(resNoTokenLogs.status === 401, "GET /api/postgres/system-logs sem token", "401", String(resNoTokenLogs.status));

    const resNoTokenMigrate = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, { method: "POST" });
    assert(resNoTokenMigrate.status === 401, "POST /api/postgres/migrate-from-firestore sem token", "401", String(resNoTokenMigrate.status));

    const resNoTokenProxy = await fetch(`${baseUrl}/api/whatsapp/proxy`, { method: "POST" });
    assert(resNoTokenProxy.status === 401, "POST /api/whatsapp/proxy sem token", "401", String(resNoTokenProxy.status));

    const resNoTokenAssist = await fetch(`${baseUrl}/api/gemini/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draft_description", title: "Reparo" })
    });
    assert(resNoTokenAssist.status === 401, "POST /api/gemini/assist sem token", "401", String(resNoTokenAssist.status));

    // =============================================================
    // GRUPO 2: Token inválido, expirado ou forjado é recusado (401)
    // =============================================================
    console.log("\n📌 Grupo 2: Token inválido, expirado ou forjado é recusado (401)");

    const resExpired = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${expiredToken}` }
    });
    assert(resExpired.status === 401, "Token expirado é recusado", "401", String(resExpired.status));

    const resTampered = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tamperedToken}` }
    });
    assert(resTampered.status === 401, "Token com assinatura adulterada é recusado", "401", String(resTampered.status));

    const resGarbage = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer string-aleatoria-invalida` }
    });
    assert(resGarbage.status === 401, "Token de formato malformado é recusado", "401", String(resGarbage.status));

    // =============================================================
    // GRUPO 3: Cabeçalhos falsos e papéis adulterados não concedem acesso (401)
    // =============================================================
    console.log("\n📌 Grupo 3: Cabeçalhos falsos e papéis adulterados no cliente não concedem acesso");

    const resSpoofedHeaders = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: {
        "X-App-Auth": "true",
        "X-User-Role": "admin",
        "Authorization": "Bearer app-session-active"
      }
    });
    assert(resSpoofedHeaders.status === 401, "Tentativa de bypass com X-App-Auth e X-User-Role rejeitada", "401", String(resSpoofedHeaders.status));

    const resSpoofedLegacyToken = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: {
        "Authorization": "Bearer gestor-admin:admin:369.111.218-84"
      }
    });
    assert(resSpoofedLegacyToken.status === 401, "Token sintético legado do localStorage rejeitado", "401", String(resSpoofedLegacyToken.status));

    // =============================================================
    // GRUPO 4: Token de usuário comum não permite operações administrativas (403)
    // =============================================================
    console.log("\n📌 Grupo 4: Token válido de usuário comum não permite operações administrativas (403)");

    const resReqLogs = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resReqLogs.status === 403, "Requisitante impedido de ler logs de auditoria (GET /system-logs)", "403", String(resReqLogs.status));

    const resReqLoginAttempts = await fetch(`${baseUrl}/api/postgres/login-attempts`, {
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resReqLoginAttempts.status === 403, "Requisitante impedido de ler tentativas de login (GET /login-attempts)", "403", String(resReqLoginAttempts.status));

    const resReqProfiles = await fetch(`${baseUrl}/api/postgres/access-profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: "hacked", name: "Hacked", permissions: {} })
    });
    assert(resReqProfiles.status === 403, "Requisitante impedido de editar matriz de perfis (POST /access-profiles)", "403", String(resReqProfiles.status));

    const resReqProfs = await fetch(`${baseUrl}/api/postgres/professionals`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: "p1", name: "Prof" })
    });
    assert(resReqProfs.status === 403, "Requisitante impedido de criar profissionais (POST /professionals)", "403", String(resReqProfs.status));

    const resReqDeleteUser = await fetch(`${baseUrl}/api/usuarios/some-user-id`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resReqDeleteUser.status === 403, "Requisitante impedido de excluir usuários (DELETE /usuarios/:id)", "403", String(resReqDeleteUser.status));

    const resReqProxy = await fetch(`${baseUrl}/api/whatsapp/proxy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: "https://api.whatsapp.com/v1" })
    });
    assert(resReqProxy.status === 403, "Requisitante impedido de utilizar proxy WhatsApp", "403", String(resReqProxy.status));

    const resReqAiLogs = await fetch(`${baseUrl}/api/gemini/assist`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "analyze_system_logs" })
    });
    assert(resReqAiLogs.status === 403, "Requisitante impedido de executar auditoria de logs com IA", "403", String(resReqAiLogs.status));

    // =============================================================
    // GRUPO 5: Rota de migração recusada para não administradores (403)
    // =============================================================
    console.log("\n📌 Grupo 5: Rota de migração recusada para não administradores (403)");

    const resMigrateReq = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resMigrateReq.status === 403, "Requisitante bloqueado na rota de migração ETL", "403", String(resMigrateReq.status));

    const resMigrateProf = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${profissionalToken}` }
    });
    assert(resMigrateProf.status === 403, "Profissional bloqueado na rota de migração ETL", "403", String(resMigrateProf.status));

    const resMigrateGestor = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${gestorToken}` }
    });
    assert(resMigrateGestor.status === 403, "Gestor bloqueado na rota de migração (apenas Administrador)", "403", String(resMigrateGestor.status));

    // =============================================================
    // GRUPO 6: Usuário comum não acessa registros fora do seu escopo (403 / Isolamento)
    // =============================================================
    console.log("\n📌 Grupo 6: Usuário comum não acessa registros fora do seu escopo");

    const resAccessOtherProfile = await fetch(`${baseUrl}/api/postgres/users/admin-tester-01`, {
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resAccessOtherProfile.status === 403, "Requisitante impedido de acessar perfil de outro usuário (GET /users/:uid)", "403", String(resAccessOtherProfile.status));

    const resModifyOtherProfile = await fetch(`${baseUrl}/api/postgres/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uid: "admin-tester-01", email: "admin@test.com" })
    });
    assert(resModifyOtherProfile.status === 403, "Requisitante impedido de modificar perfil de outro usuário (POST /users)", "403", String(resModifyOtherProfile.status));

    const resModifyOtherUsuario = await fetch(`${baseUrl}/api/usuarios/admin-tester-01`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Hacked Name" })
    });
    assert(resModifyOtherUsuario.status === 403, "Requisitante impedido de alterar cadastro de outro usuário (PUT /usuarios/:id)", "403", String(resModifyOtherUsuario.status));

    // =============================================================
    // GRUPO 7: Usuário autorizado consegue executar operações previstas (200)
    // =============================================================
    console.log("\n📌 Grupo 7: Usuário autorizado consegue executar operações previstas");

    const resAdminLogs = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminLogs.status === 200, "Administrador autorizado a consultar logs de auditoria", "200", String(resAdminLogs.status));

    const resAdminProfs = await fetch(`${baseUrl}/api/postgres/professionals`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminProfs.status === 200, "Administrador autorizado a consultar profissionais", "200", String(resAdminProfs.status));

    const resAdminCats = await fetch(`${baseUrl}/api/postgres/service-categories`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminCats.status === 200, "Administrador autorizado a consultar categorias de serviço", "200", String(resAdminCats.status));

    const resAdminProfiles = await fetch(`${baseUrl}/api/postgres/access-profiles`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminProfiles.status === 200, "Administrador autorizado a consultar matriz de perfis", "200", String(resAdminProfiles.status));

    const resAdminOrders = await fetch(`${baseUrl}/api/postgres/service-orders`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminOrders.status === 200, "Administrador autorizado a consultar todas as ordens de serviço", "200", String(resAdminOrders.status));

    // =============================================================
    // GRUPO 8: Fluxos legítimos de cadastro e autenticação continuam funcionando
    // =============================================================
    console.log("\n📌 Grupo 8: Fluxos legítimos de cadastro e autenticação de administrador funcionam");

    // 8.1 Validação de Falha Segura do endpoint /api/auth/verify-admin quando ADMIN_PASSWORD não configurada
    const originalAdminPass = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;

    const resVerifyAdminMissingPass = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: "qualquer-senha" })
    });
    assert(
      resVerifyAdminMissingPass.status === 503,
      "POST /api/auth/verify-admin falha de forma segura (503 Service Unavailable) se ADMIN_PASSWORD não estiver configurada",
      "503",
      String(resVerifyAdminMissingPass.status)
    );

    // 8.2 Autenticação de Administrador com ADMIN_PASSWORD configurada
    const testAdminSecret = "SuperSecureAdminPassword2026!";
    process.env.ADMIN_PASSWORD = testAdminSecret;

    // Tentativa com senha errada (deve retornar 401)
    const resVerifyAdminWrongPass = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: "senha-completamente-incorreta" })
    });
    assert(
      resVerifyAdminWrongPass.status === 401,
      "POST /api/auth/verify-admin rejeita senha incorreta com 401",
      "401",
      String(resVerifyAdminWrongPass.status)
    );

    // Tentativa com senha correta (deve emitir token de administrador e retornar 200)
    const resVerifyAdminSuccess = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: testAdminSecret })
    });
    assert(
      resVerifyAdminSuccess.status === 200,
      "POST /api/auth/verify-admin com credenciais corretas retorna 200",
      "200",
      String(resVerifyAdminSuccess.status)
    );

    const dataVerifyAdmin = await resVerifyAdminSuccess.json();
    assert(
      dataVerifyAdmin.success === true && typeof dataVerifyAdmin.token === "string",
      "POST /api/auth/verify-admin emite token de sessão criptografado válido",
      "true + token",
      `${dataVerifyAdmin.success} + ${typeof dataVerifyAdmin.token}`
    );

    // Testa se o token emitido pelo endpoint verify-admin tem acesso administrativo
    const resTestIssuedToken = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${dataVerifyAdmin.token}` }
    });
    assert(
      resTestIssuedToken.status === 200,
      "Token emitido pelo verify-admin autentica rota administrativa",
      "200",
      String(resTestIssuedToken.status)
    );

    // Restaura ambiente original
    if (originalAdminPass) {
      process.env.ADMIN_PASSWORD = originalAdminPass;
    }

    // 8.2 Auto-cadastro público (anônimo) força status 'pendente_autorizacao' e papel 'requisitante'
    const resAutoCadastro = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cidadão Teste Auto Cadastro",
        document: "123.456.789-00",
        phone: "(18) 99999-8888",
        status: "ativo", // Tentativa de auto-aprovação maliciosa
        userType: "admin" // Tentativa de auto-elevação para administrador
      })
    });
    assert(resAutoCadastro.status === 201, "Auto-cadastro público permitido sem token (201 Created)", "201", String(resAutoCadastro.status));
    const autoCadData = await resAutoCadastro.json();
    assert(
      autoCadData.usuario?.status === "pendente_autorizacao",
      "Auto-cadastro público força estritamente status 'pendente_autorizacao'",
      "pendente_autorizacao",
      String(autoCadData.usuario?.status)
    );
    assert(
      autoCadData.usuario?.userType === "requisitante",
      "Auto-cadastro público previne auto-elevação e força papel 'requisitante'",
      "requisitante",
      String(autoCadData.usuario?.userType)
    );

    // 8.3 Rota pública de validação de CPF (suporte ao auto-cadastro)
    const resValidateCpf = await fetch(`${baseUrl}/api/gemini/validate-cpf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: "11122233344" })
    });
    assert(resValidateCpf.status === 200 || resValidateCpf.status === 400, "POST /api/gemini/validate-cpf operacional para validação pública", "200 ou 400", String(resValidateCpf.status));

  } finally {
    // Encerra servidor de teste
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("\nServidor de testes encerrado com sucesso.");
  }

  // -------------------------------------------------------------
  // Relatório Final
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n=======================================================");
  console.log(`📊 RESULTADO DA SUITE DE TESTES: ${passed}/${total} APROVADOS (${failed} falhas)`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Executa caso chamado diretamente
runSecurityTestSuite().catch((err) => {
  console.error("Erro fatal ao executar testes de segurança:", err);
  process.exit(1);
});

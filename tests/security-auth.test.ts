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
import crypto from "crypto";
import { app } from "../server.ts";
import {
  signServerSessionToken,
  getSessionSecret,
  revokeSessionToken,
  revokeTokenByJti,
  revokeUserSessions,
  resetRevocationStore,
  validateSecretEntropy,
  calculateShannonEntropy
} from "../src/middleware/auth.ts";
import { upsertUser, deleteUser } from "../src/db/repository.ts";

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
    console.log("\n📌 Grupo 2: Token inválido, expirado, forjado ou malformado é recusado (401)");

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

    // 2.1 Token sem expiração (exp ausente) deve ser sumariamente recusado
    const validSecret = getSessionSecret();
    const validHeaderB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    
    const payloadNoExp = {
      uid: "user-no-exp",
      role: "admin",
      iss: "s1gestaopro-backend",
      iat: Math.floor(Date.now() / 1000)
    };
    const b64NoExp = Buffer.from(JSON.stringify(payloadNoExp)).toString("base64url");
    const sigNoExp = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64NoExp}`).digest("base64url");
    const tokenWithoutExp = `${validHeaderB64}.${b64NoExp}.${sigNoExp}`;

    const resNoExp = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenWithoutExp}` }
    });
    assert(resNoExp.status === 401, "Token sem campo 'exp' é expressamente recusado", "401", String(resNoExp.status));

    // 2.2 Token com emissor incorreto (iss malicioso ou estranho)
    const payloadWrongIss = {
      uid: "user-wrong-iss",
      role: "admin",
      iss: "forged-issuer-s1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64WrongIss = Buffer.from(JSON.stringify(payloadWrongIss)).toString("base64url");
    const sigWrongIss = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64WrongIss}`).digest("base64url");
    const tokenWrongIss = `${validHeaderB64}.${b64WrongIss}.${sigWrongIss}`;

    const resWrongIss = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenWrongIss}` }
    });
    assert(resWrongIss.status === 401, "Token com emissor (iss) incorreto é recusado", "401", String(resWrongIss.status));

    // 2.3 Token com emissor ausente
    const payloadMissingIss = {
      uid: "user-missing-iss",
      role: "admin",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64MissingIss = Buffer.from(JSON.stringify(payloadMissingIss)).toString("base64url");
    const sigMissingIss = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64MissingIss}`).digest("base64url");
    const tokenMissingIss = `${validHeaderB64}.${b64MissingIss}.${sigMissingIss}`;

    const resMissingIss = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenMissingIss}` }
    });
    assert(resMissingIss.status === 401, "Token sem campo 'iss' é recusado", "401", String(resMissingIss.status));

    // 2.4 Token com papel fora da matriz autorizada (role: 'super_root')
    const payloadInvalidRole = {
      uid: "user-bad-role",
      role: "super_root",
      iss: "s1gestaopro-backend",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64InvalidRole = Buffer.from(JSON.stringify(payloadInvalidRole)).toString("base64url");
    const sigInvalidRole = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64InvalidRole}`).digest("base64url");
    const tokenInvalidRole = `${validHeaderB64}.${b64InvalidRole}.${sigInvalidRole}`;

    const resInvalidRole = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenInvalidRole}` }
    });
    assert(resInvalidRole.status === 401, "Token com papel (role) inválido é recusado", "401", String(resInvalidRole.status));

    // 2.5 Token revogado individualmente
    const tokenToRevoke = signServerSessionToken({
      uid: "user-revocation-test",
      role: "admin"
    });
    revokeSessionToken(tokenToRevoke);

    const resRevokedToken = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenToRevoke}` }
    });
    // 2.7 Validação rigorosa do campo iat (issued-at)
    // 2.7.1 Token sem iat deve ser recusado
    const payloadNoIat = {
      uid: "user-no-iat",
      role: "admin",
      iss: "s1gestaopro-backend",
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64NoIat = Buffer.from(JSON.stringify(payloadNoIat)).toString("base64url");
    const sigNoIat = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64NoIat}`).digest("base64url");
    const tokenNoIat = `${validHeaderB64}.${b64NoIat}.${sigNoIat}`;

    const resNoIat = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenNoIat}` }
    });
    assert(resNoIat.status === 401, "Token sem campo 'iat' é recusado (401)", "401", String(resNoIat.status));

    // 2.7.2 Token com iat não-numérico (string) deve ser recusado
    const payloadStringIat = {
      uid: "user-string-iat",
      role: "admin",
      iss: "s1gestaopro-backend",
      iat: "2026-10-19T00:00:00Z",
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64StringIat = Buffer.from(JSON.stringify(payloadStringIat)).toString("base64url");
    const sigStringIat = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64StringIat}`).digest("base64url");
    const tokenStringIat = `${validHeaderB64}.${b64StringIat}.${sigStringIat}`;

    const resStringIat = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenStringIat}` }
    });
    assert(resStringIat.status === 401, "Token com campo 'iat' não-numérico é recusado (401)", "401", String(resStringIat.status));

    // 2.7.3 Token com iat negativo ou zero deve ser recusado
    const payloadZeroIat = {
      uid: "user-zero-iat",
      role: "admin",
      iss: "s1gestaopro-backend",
      iat: 0,
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64ZeroIat = Buffer.from(JSON.stringify(payloadZeroIat)).toString("base64url");
    const sigZeroIat = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64ZeroIat}`).digest("base64url");
    const tokenZeroIat = `${validHeaderB64}.${b64ZeroIat}.${sigZeroIat}`;

    const resZeroIat = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenZeroIat}` }
    });
    assert(resZeroIat.status === 401, "Token com campo 'iat' menor ou igual a zero é recusado (401)", "401", String(resZeroIat.status));

    // 2.7.4 Token com iat no futuro além de 60s (clock skew > 60s, ex: +120s) deve ser recusado
    const payloadFutureIat = {
      uid: "user-future-iat",
      role: "admin",
      iss: "s1gestaopro-backend",
      iat: Math.floor(Date.now() / 1000) + 120, // 2 minutos no futuro
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64FutureIat = Buffer.from(JSON.stringify(payloadFutureIat)).toString("base64url");
    const sigFutureIat = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64FutureIat}`).digest("base64url");
    const tokenFutureIat = `${validHeaderB64}.${b64FutureIat}.${sigFutureIat}`;

    const resFutureIat = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenFutureIat}` }
    });
    assert(resFutureIat.status === 401, "Token com 'iat' no futuro (>60s clock skew) é recusado (401)", "401", String(resFutureIat.status));

    // 2.7.5 Token com iat com clock skew aceitável (ex: +30s no futuro) deve ser aceito
    const payloadAcceptableIat = {
      uid: "admin-tester-01",
      role: "admin",
      iss: "s1gestaopro-backend",
      iat: Math.floor(Date.now() / 1000) + 30, // 30s no futuro (dentro da tolerância de 60s)
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const b64AcceptableIat = Buffer.from(JSON.stringify(payloadAcceptableIat)).toString("base64url");
    const sigAcceptableIat = crypto.createHmac("sha256", validSecret).update(`${validHeaderB64}.${b64AcceptableIat}`).digest("base64url");
    const tokenAcceptableIat = `${validHeaderB64}.${b64AcceptableIat}.${sigAcceptableIat}`;

    const resAcceptableIat = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenAcceptableIat}` }
    });
    assert(resAcceptableIat.status === 200, "Token com 'iat' dentro da tolerância de 60s de clock skew é aceito (200)", "200", String(resAcceptableIat.status));

    // 2.8 Identificador único JTI (JWT ID) e revogação por JTI
    const customJti = `jti-test-${crypto.randomUUID()}`;
    const tokenWithCustomJti = signServerSessionToken({
      uid: "user-jti-test",
      role: "admin",
      jti: customJti
    });
    const parsedPayloadJti = JSON.parse(Buffer.from(tokenWithCustomJti.split(".")[1], "base64url").toString("utf-8"));
    assert(parsedPayloadJti.jti === customJti, "Token gerado pelo servidor emite campo 'jti' único", customJti, String(parsedPayloadJti.jti));

    // Revoga o token pelo seu JTI
    revokeTokenByJti(customJti);
    const resRevokedByJti = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenWithCustomJti}` }
    });
    assert(resRevokedByJti.status === 401, "Token de sessão revogado especificamente pelo 'jti' é recusado (401)", "401", String(resRevokedByJti.status));

    // 2.9 Revogação em lote de sessões de usuário
    const tokenBeforeUserRevoke = signServerSessionToken({
      uid: "user-batch-revoke",
      role: "admin"
    });
    revokeUserSessions("user-batch-revoke");

    const resUserRevoked = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${tokenBeforeUserRevoke}` }
    });
    assert(resUserRevoked.status === 401, "Tokens anteriores à revogação de usuário são recusados (401)", "401", String(resUserRevoked.status));

    // 2.10 Revogação em lote de sessões da conta de administrador mestre (gestor-admin)
    const adminTokenToRevoke = signServerSessionToken({
      uid: "gestor-admin",
      role: "admin"
    });
    revokeUserSessions("gestor-admin");

    const resAdminRevoked = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${adminTokenToRevoke}` }
    });
    assert(resAdminRevoked.status === 401, "Tokens da conta administrativa mestre são invalidados por revokeUserSessions (401)", "401", String(resAdminRevoked.status));

    // Limpeza isolada do repositório de revogações após a bateria de testes de revogação
    resetRevocationStore();

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

    // 8.1.1 Teste de Rate Limiting Administrativo (Máximo de 5 tentativas por IP em 15 minutos)
    // Já realizamos 3 tentativas (missing pass, wrong pass, success).
    // Tentativa 4:
    const resAttempt4 = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: testAdminSecret })
    });
    assert(resAttempt4.status === 200, "Tentativa 4/5 de login administrativo aceita pelo rate limiter", "200", String(resAttempt4.status));

    // Tentativa 5:
    const resAttempt5 = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: testAdminSecret })
    });
    assert(resAttempt5.status === 200, "Tentativa 5/5 de login administrativo aceita pelo rate limiter", "200", String(resAttempt5.status));

    // Tentativa 6: Deve ser bloqueada com status 429 Too Many Requests
    const resAttempt6Exceeded = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "369.111.218-84", password: testAdminSecret })
    });
    assert(
      resAttempt6Exceeded.status === 429,
      "adminLoginRateLimiter bloqueia 6ª tentativa consecutiva com HTTP 429 (Too Many Requests)",
      "429",
      String(resAttempt6Exceeded.status)
    );

    const rateLimitData = await resAttempt6Exceeded.json();
    assert(
      rateLimitData.success === false && typeof rateLimitData.message === "string" && rateLimitData.message.includes("Muitas tentativas"),
      "adminLoginRateLimiter retorna payload seguro informando bloqueio de tentativas",
      "success: false + mensagem de bloqueio",
      `${rateLimitData.success} + ${rateLimitData.message}`
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
        name: "Cidadão Teste Auto Cadastro Isolado",
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

    // Limpeza segura e imediata do registro de teste gerado no banco persistente
    if (autoCadData?.usuario?.id) {
      const resCleanup = await fetch(`${baseUrl}/api/usuarios/${autoCadData.usuario.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${adminToken}` }
      });
      assert(resCleanup.status === 200, "Limpeza segura de registros de teste concluída sem persistência residual (DELETE)", "200", String(resCleanup.status));
    }

    // 8.3 Rota pública de validação de CPF (suporte ao auto-cadastro)
    const resValidateCpf = await fetch(`${baseUrl}/api/gemini/validate-cpf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: "11122233344" })
    });
    assert(resValidateCpf.status === 200 || resValidateCpf.status === 400, "POST /api/gemini/validate-cpf operacional para validação pública", "200 ou 400", String(resValidateCpf.status));

    // =============================================================
    // GRUPO 9: Conferência Técnica dos 4 Pilares de Segurança
    // =============================================================
    console.log("\n📌 Grupo 9: Conferência Técnica dos 4 Pilares (Entropia, iat, Revogação e Permissões Dinâmicas)");

    // 9.1 Entropia de SESSION_SECRET
    const checkShort = validateSecretEntropy("curta-com-menos-de-32-chars");
    assert(!checkShort.valid, "validateSecretEntropy rejeita segredos com tamanho < 32", "false", String(checkShort.valid));

    const checkUniform = validateSecretEntropy("a".repeat(32));
    assert(!checkUniform.valid, "validateSecretEntropy rejeita senhas repetitivas de 32 chars (baixa variedade/entropia zero)", "false", String(checkUniform.valid));

    const checkRepetitive = validateSecretEntropy("12341234123412341234123412341234");
    assert(!checkRepetitive.valid, "validateSecretEntropy rejeita sequência cíclica de baixa entropia de Shannon", "false", String(checkRepetitive.valid));

    const cryptoSecret = crypto.randomBytes(32).toString("hex"); // 64 chars hexadecimais = 256 bits de entropia
    const checkCrypto = validateSecretEntropy(cryptoSecret);
    const entropyBits = calculateShannonEntropy(cryptoSecret);
    assert(checkCrypto.valid && entropyBits >= 3.0, "validateSecretEntropy aceita chave criptográfica com alta entropia (openssl rand -hex 32)", "true", `${checkCrypto.valid} (${entropyBits.toFixed(2)} bits/char)`);

    // 9.2 Revalidação dinâmica de permissões no backend (Prevenção de privilégios antigos em tokens assinados)
    const testStaleUid = `stale-user-${Date.now()}`;
    await upsertUser({
      uid: testStaleUid,
      email: `${testStaleUid}@s1gestao.local`,
      name: "Usuário Teste Revalidação Dinâmica",
      document: "11122233399",
      userType: "requisitante", // Papel REAL no banco
      status: "ativo"
    });

    // Forja um token assinado onde o payload alega role 'admin'
    const staleAdminClaimToken = signServerSessionToken({
      uid: testStaleUid,
      email: `${testStaleUid}@s1gestao.local`,
      role: "admin", // Alegação de privilégio elevado no token
      name: "Usuário Teste Revalidação Dinâmica"
    });

    // Envia para rota restrita a administradores (/api/postgres/system-logs)
    const resStaleAttempt = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${staleAdminClaimToken}` }
    });
    assert(
      resStaleAttempt.status === 403,
      "requireAuth revalida papel no PostgreSQL em tempo real e bloqueia token desatualizado com alegação antiga (403)",
      "403",
      String(resStaleAttempt.status)
    );

    // 9.3 Revalidação dinâmica de status bloqueado/desativado no banco
    await upsertUser({
      uid: testStaleUid,
      email: `${testStaleUid}@s1gestao.local`,
      userType: "requisitante",
      status: "bloqueado" // Bloqueio imediato da conta pela administração
    });

    const resBlockedUser = await fetch(`${baseUrl}/api/postgres/users/${testStaleUid}`, {
      headers: { "Authorization": `Bearer ${staleAdminClaimToken}` }
    });
    assert(
      resBlockedUser.status === 403,
      "requireAuth consulta status do banco e bloqueia imediatamente conta desativada/suspensa (403)",
      "403",
      String(resBlockedUser.status)
    );

    // Limpeza segura do usuário de teste
    await deleteUser(testStaleUid);

    // 9.4 Desativação segura da conta especial de administrador mestre (gestor-admin)
    const currentAdminPass = process.env.ADMIN_PASSWORD;
    try {
      delete process.env.ADMIN_PASSWORD; // Desativação das credenciais mestres no ambiente
      const tokenAdminMaster = signServerSessionToken({
        uid: "gestor-admin",
        role: "admin"
      });

      const resDisabledAdminMaster = await fetch(`${baseUrl}/api/postgres/system-logs`, {
        headers: { "Authorization": `Bearer ${tokenAdminMaster}` }
      });
      assert(
        resDisabledAdminMaster.status === 503,
        "requireAuth desativa com HTTP 503 tokens do administrador mestre quando ADMIN_PASSWORD é removida",
        "503",
        String(resDisabledAdminMaster.status)
      );
    } finally {
      if (currentAdminPass) {
        process.env.ADMIN_PASSWORD = currentAdminPass;
      }
    }

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

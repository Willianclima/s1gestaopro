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
  calculateShannonEntropy,
  setDbFailureSimulationForTest
} from "../src/middleware/auth.ts";
import { 
  upsertUser, 
  deleteUser, 
  upsertUsuario, 
  deleteUsuario, 
  upsertServiceOrder, 
  deleteServiceOrder,
  setUserPasswordHash,
  deletePasswordResetTokensByUserId,
  deletePasswordResetTokenByHash,
  deleteRevokedSessionsByIdentifier,
  deleteSystemLog
} from "../src/db/repository.ts";
import { db } from "../src/db/drizzle.ts";
import { sql } from "drizzle-orm";
import argon2 from "argon2";

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

  let baseline: any = null;
  let initialMaxRevokedId = 0;
  let initialMaxTokenId = 0;
  let initialLogIds = new Set<string>();

  const testCleanupRegistry = {
    users: new Set<string>(),
    usuarios: new Set<string>(),
    serviceOrders: new Set<string>(),
    revokedSessionIdentifiers: new Set<string>(),
    resetTokenUserIds: new Set<string>()
  };

  try {
    // -------------------------------------------------------------
    // Preflight Somente-Leitura: Integridade e Vínculos Órfãos
    // -------------------------------------------------------------
    console.log("📌 Preflight: Verificando integridade e vínculos órfãos entre service_orders e usuarios...");
    const orphanCheckResult = await db.execute(sql`
      SELECT COUNT(*)::int as orphan_count 
      FROM service_orders so 
      LEFT JOIN usuarios u ON so.client_id = u.id 
      WHERE so.client_id IS NOT NULL AND u.id IS NULL;
    `);
    const orphanCount = Number((orphanCheckResult[0] as any)?.orphan_count || 0);
    assert(
      orphanCount === 0,
      "Preflight Somente-Leitura: Zero ordens de serviço órfãs detectadas no banco isolado de desenvolvimento/teste",
      "0",
      String(orphanCount)
    );
    if (orphanCount > 0) {
      throw new Error(`ABORTANDO: Detectadas ${orphanCount} ordens de serviço órfãs no banco de teste.`);
    }

    // Registro do Baseline Inicial do banco isolado de testes
    const baselineCountsRes = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM users)::int as users_count,
        (SELECT count(*) FROM usuarios)::int as usuarios_count,
        (SELECT count(*) FROM service_orders)::int as service_orders_count,
        (SELECT count(*) FROM system_logs)::int as system_logs_count,
        (SELECT count(*) FROM revoked_sessions)::int as revoked_sessions_count,
        (SELECT count(*) FROM password_reset_tokens)::int as reset_tokens_count;
    `);
    baseline = baselineCountsRes[0] as any;

    const initialRevokedRes = await db.execute(sql`SELECT COALESCE(MAX(id), 0)::int as max_id FROM revoked_sessions`);
    initialMaxRevokedId = Number((initialRevokedRes[0] as any)?.max_id || 0);

    const initialTokensRes = await db.execute(sql`SELECT COALESCE(MAX(id), 0)::int as max_id FROM password_reset_tokens`);
    initialMaxTokenId = Number((initialTokensRes[0] as any)?.max_id || 0);

    const initialLogsRes = await db.execute(sql`SELECT id FROM system_logs`);
    initialLogIds = new Set((initialLogsRes as any[]).map(r => r.id));

    console.log(`📊 Baseline inicial do banco PostgreSQL de teste:`);
    console.log(`   users: ${baseline.users_count}, usuarios: ${baseline.usuarios_count}, service_orders: ${baseline.service_orders_count}, system_logs: ${baseline.system_logs_count}, revoked_sessions: ${baseline.revoked_sessions_count}, reset_tokens: ${baseline.reset_tokens_count}\n`);

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

    const resReqCreateCat = await fetch(`${baseUrl}/api/postgres/service-categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${requisitanteToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Categoria Proibida", slaHours: 12 })
    });
    assert(resReqCreateCat.status === 403, "Requisitante impedido de cadastrar categorias de serviço (POST /service-categories)", "403", String(resReqCreateCat.status));

    const resReqDeleteCat = await fetch(`${baseUrl}/api/postgres/service-categories/cat-1`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${requisitanteToken}` }
    });
    assert(resReqDeleteCat.status === 403, "Requisitante impedido de excluir categorias de serviço (DELETE /service-categories/:id)", "403", String(resReqDeleteCat.status));

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

    // 7.1 Criação de nova categoria de serviço com SLA pelo Administrador
    const testCatId = `cat-test-${Date.now()}`;
    const resCreateCat = await fetch(`${baseUrl}/api/postgres/service-categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testCatId,
        name: "Manutenção Predial Automatizada",
        color: "#10b981",
        slaHours: 36,
        reminderIntervalHours: 6,
        reminderEnabled: true,
        notifyGestor: true,
        notifyTechnician: true
      })
    });
    assert(resCreateCat.status === 200, "Administrador autorizado a criar categoria de serviço no PostgreSQL (200)", "200", String(resCreateCat.status));
    const createCatData = await resCreateCat.json();
    assert(
      createCatData.success === true && createCatData.cat?.name === "Manutenção Predial Automatizada" && createCatData.cat?.slaHours === 36,
      "Categoria de serviço gravada com campos de SLA e notificações preservados",
      "true + 36h SLA",
      `${createCatData.success} + ${createCatData.cat?.slaHours}h SLA`
    );

    // 7.2 Rejeição de payload de categoria inválido (sem nome)
    const resInvalidCat = await fetch(`${baseUrl}/api/postgres/service-categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ color: "#ff0000" }) // Sem campo name
    });
    assert(resInvalidCat.status === 400, "POST /api/postgres/service-categories rejeita payload sem nome (400)", "400", String(resInvalidCat.status));

    // 7.3 Exclusão de categoria pelo Administrador
    const resDeleteCat = await fetch(`${baseUrl}/api/postgres/service-categories/${testCatId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resDeleteCat.status === 200, "Administrador autorizado a excluir categoria de serviço (DELETE)", "200", String(resDeleteCat.status));

    // 7.4 Tentativa de exclusão de categoria inexistente retorna 404
    const resDeleteCatNotFound = await fetch(`${baseUrl}/api/postgres/service-categories/cat-non-existent-999`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resDeleteCatNotFound.status === 404, "Exclusão de categoria inexistente retorna 404", "404", String(resDeleteCatNotFound.status));

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

    // =============================================================
    // GRUPO 10: Integração de Usuários e Requisitantes (Fase 2.3)
    // =============================================================
    console.log("\n📌 Grupo 10: Integração de Usuários e Requisitantes (Fase 2.3 - Regras de Acesso e Integridade)");

    // 10.1 Leitura completa autorizada para Administrador
    const resAdminListUsers = await fetch(`${baseUrl}/api/usuarios`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(resAdminListUsers.status === 200, "Administrador autorizado a listar todos os usuários (200 OK)", "200", String(resAdminListUsers.status));
    const adminUsersData = await resAdminListUsers.json();
    assert(Array.isArray(adminUsersData), "GET /api/usuarios retorna lista (array) de usuários", "true", String(Array.isArray(adminUsersData)));

    // Preparação dos dados de teste isolados para Requisitantes
    const testReqUid1 = `test-req-iso-1-${Date.now()}`;
    const testReqUid2 = `test-req-iso-2-${Date.now()}`;
    const testReqDoc1 = "123.456.789-11";
    const testReqDoc2 = "987.654.321-22";

    // Cria usuários no PostgreSQL para teste
    await upsertUsuario({
      id: testReqUid1,
      name: "Requisitante Teste 1 (Isolamento)",
      document: testReqDoc1,
      phone: "(18) 99111-2222",
      email: "req1.iso@s1gestao.local",
      address: "Rua Teste 1, Araçatuba",
      notes: "Registro de teste isolado",
      status: "ativo",
      userType: "requisitante",
      createdAt: new Date().toISOString()
    });

    await upsertUsuario({
      id: testReqUid2,
      name: "Requisitante Teste 2 (Outro Cidadão)",
      document: testReqDoc2,
      phone: "(18) 99333-4444",
      email: "req2.iso@s1gestao.local",
      address: "Rua Teste 2, Araçatuba",
      notes: "Registro de outro usuário",
      status: "ativo",
      userType: "requisitante",
      createdAt: new Date().toISOString()
    });

    // Também sincroniza na tabela users para passar pela verificação dinâmica do requireAuth
    await upsertUser({
      uid: testReqUid1,
      email: "req1.iso@s1gestao.local",
      name: "Requisitante Teste 1 (Isolamento)",
      document: testReqDoc1,
      userType: "requisitante",
      status: "ativo"
    });

    await upsertUser({
      uid: testReqUid2,
      email: "req2.iso@s1gestao.local",
      name: "Requisitante Teste 2 (Outro Cidadão)",
      document: testReqDoc2,
      userType: "requisitante",
      status: "ativo"
    });

    const tokenReq1 = signServerSessionToken({
      uid: testReqUid1,
      email: "req1.iso@s1gestao.local",
      role: "requisitante",
      document: testReqDoc1,
      name: "Requisitante Teste 1"
    });

    // 10.2 Leitura com isolamento por registro para Requisitante comum
    const resReq1List = await fetch(`${baseUrl}/api/usuarios`, {
      headers: { "Authorization": `Bearer ${tokenReq1}` }
    });
    assert(resReq1List.status === 200, "Requisitante pode chamar GET /api/usuarios (200 OK)", "200", String(resReq1List.status));
    const req1ListData = await resReq1List.json();
    const containsOtherUser = req1ListData.some((u: any) => u.id === testReqUid2);
    assert(
      !containsOtherUser,
      "Isolamento por registro: Requisitante comum não visualiza cadastros de outros usuários na listagem",
      "false",
      String(containsOtherUser)
    );
    const containsSelf = req1ListData.some((u: any) => u.id === testReqUid1);
    assert(
      containsSelf,
      "Isolamento por registro: Requisitante comum visualiza seu próprio cadastro na listagem",
      "true",
      String(containsSelf)
    );

    // 10.3 Requisitante comum tentando consultar outro usuário por ID (403 Forbidden)
    const resReq1GetOther = await fetch(`${baseUrl}/api/usuarios/${testReqUid2}`, {
      headers: { "Authorization": `Bearer ${tokenReq1}` }
    });
    assert(
      resReq1GetOther.status === 403,
      "Requisitante comum impedido de consultar cadastro de outro usuário por ID (403 Forbidden)",
      "403",
      String(resReq1GetOther.status)
    );

    // 10.4 Requisitante comum consultando seu próprio cadastro por ID (200 OK)
    const resReq1GetSelf = await fetch(`${baseUrl}/api/usuarios/${testReqUid1}`, {
      headers: { "Authorization": `Bearer ${tokenReq1}` }
    });
    assert(
      resReq1GetSelf.status === 200,
      "Requisitante comum autorizado a consultar seu próprio cadastro por ID (200 OK)",
      "200",
      String(resReq1GetSelf.status)
    );
    const req1SelfData = await resReq1GetSelf.json();
    assert(
      req1SelfData.name === "Requisitante Teste 1 (Isolamento)",
      "Dados retornados correspondem ao próprio requisitante autenticado",
      "Requisitante Teste 1 (Isolamento)",
      String(req1SelfData.name)
    );

    // 10.5 Requisitante comum impedido de alterar cadastro de outro usuário (PUT -> 403)
    const resReq1PutOther = await fetch(`${baseUrl}/api/usuarios/${testReqUid2}`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${tokenReq1}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Nome Adulterado Ilicitamente" })
    });
    assert(
      resReq1PutOther.status === 403,
      "Requisitante comum impedido de alterar cadastro de outro usuário (403 Forbidden)",
      "403",
      String(resReq1PutOther.status)
    );

    // 10.6 Requisitante comum alterando seu próprio perfil tem campos de privilégio sanitizados
    const resReq1PutSelf = await fetch(`${baseUrl}/api/usuarios/${testReqUid1}`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${tokenReq1}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        name: "Requisitante 1 (Nome Atualizado)",
        phone: "(18) 99888-7777",
        status: "pendente_autorizacao", // Tentativa de adulterar status
        userType: "admin"               // Tentativa de auto-elevação de papel
      })
    });
    assert(
      resReq1PutSelf.status === 200,
      "Requisitante autorizado a atualizar seus próprios dados de contato (200 OK)",
      "200",
      String(resReq1PutSelf.status)
    );
    const req1PutResult = await resReq1PutSelf.json();
    assert(
      req1PutResult.usuario?.name === "Requisitante 1 (Nome Atualizado)",
      "Nome e telefone do próprio usuário foram atualizados com sucesso",
      "Requisitante 1 (Nome Atualizado)",
      String(req1PutResult.usuario?.name)
    );
    assert(
      req1PutResult.usuario?.userType === "requisitante",
      "Segurança: backend sanitizou e rejeitou tentativa de auto-elevação para 'admin'",
      "requisitante",
      String(req1PutResult.usuario?.userType)
    );
    assert(
      req1PutResult.usuario?.status === "ativo",
      "Segurança: backend sanitizou e preservou status 'ativo' sem permitir adulteração",
      "ativo",
      String(req1PutResult.usuario?.status)
    );

    // 10.7 Exclusão de usuário bloqueada quando há Ordens de Serviço vinculadas (Integridade Referencial)
    const testOrderId = `test-os-ref-${Date.now()}`;
    await upsertServiceOrder({
      id: testOrderId,
      clientId: testReqUid1, // Vínculo explícito com testReqUid1
      title: "Ordem de Serviço Teste para Integridade Referencial",
      description: "OS de teste vinculada ao requisitante",
      category: "Elétrica",
      status: "aberto",
      priority: "medium",
      assignedTo: "Eletricista Teste",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      notes: "OS de teste",
      history: [],
      createdAt: new Date().toISOString()
    });

    const resDeleteWithOrder = await fetch(`${baseUrl}/api/usuarios/${testReqUid1}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(
      resDeleteWithOrder.status === 400,
      "Integridade referencial: exclusão bloqueada quando há Ordens de Serviço vinculadas (400 Bad Request)",
      "400",
      String(resDeleteWithOrder.status)
    );
    const deleteOrderBlockedData = await resDeleteWithOrder.json();
    assert(
      typeof deleteOrderBlockedData.error === "string" && deleteOrderBlockedData.error.includes("ordem(ns) de serviço vinculada"),
      "Mensagem de erro explicativa informa presença de ordens de serviço ativas vinculadas",
      "true",
      String(deleteOrderBlockedData.error?.includes("ordem(ns) de serviço vinculada"))
    );

    // Remove a ordem de serviço vinculada para liberar o teste de exclusão
    await deleteServiceOrder(testOrderId);

    // 10.8 Requisitante comum impedido de excluir qualquer usuário (403 Forbidden)
    const resReqDeleteAttempt = await fetch(`${baseUrl}/api/usuarios/${testReqUid2}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${tokenReq1}` }
    });
    assert(
      resReqDeleteAttempt.status === 403,
      "Requisitante comum impedido de excluir usuários (403 Forbidden)",
      "403",
      String(resReqDeleteAttempt.status)
    );

    // 10.9 Exclusão de usuário permitida para Administrador quando não há ordens vinculadas
    const resAdminDelete = await fetch(`${baseUrl}/api/usuarios/${testReqUid1}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(
      resAdminDelete.status === 200,
      "Administrador autorizado a remover usuário sem ordens vinculadas (200 OK)",
      "200",
      String(resAdminDelete.status)
    );

    // Limpeza segura dos registros residuais de teste
    await deleteUsuario(testReqUid2);
    await deleteUser(testReqUid1);
    await deleteUser(testReqUid2);

    // 10.10 Criação autorizada de usuário por Administrador com privilégios completos
    const testAdminCreatedUid = `test-admin-created-${Date.now()}`;
    const resAdminCreateUser = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testAdminCreatedUid,
        name: "Gestor Criado por Administrador",
        document: "555.666.777-88",
        phone: "(18) 98765-4321",
        email: "gestor.admin.created@s1gestao.local",
        status: "ativo",
        userType: "gestor"
      })
    });
    assert(
      resAdminCreateUser.status === 201,
      "Administrador autorizado a criar usuário com privilégios definidos (201 Created)",
      "201",
      String(resAdminCreateUser.status)
    );
    const adminCreatedData = await resAdminCreateUser.json();
    assert(
      adminCreatedData.usuario?.status === "ativo",
      "Usuário criado por Administrador mantém status 'ativo'",
      "ativo",
      String(adminCreatedData.usuario?.status)
    );
    assert(
      adminCreatedData.usuario?.userType === "gestor",
      "Usuário criado por Administrador mantém papel 'gestor'",
      "gestor",
      String(adminCreatedData.usuario?.userType)
    );

    // Limpeza do usuário criado pelo Administrador
    await deleteUsuario(testAdminCreatedUid);

    // 10.11 PATCH /api/usuarios/:id sanitiza e rejeita campos protegidos enviados por requisitante comum
    const testPatchUid = `test-patch-${Date.now()}`;
    await upsertUsuario({
      id: testPatchUid,
      name: "Requisitante Teste Patch",
      document: "777.888.999-00",
      phone: "(18) 99111-2222",
      email: "patch.test@s1gestao.local",
      address: "Rua Patch, 100",
      notes: "Registro inicial de teste",
      createdAt: new Date().toISOString(),
      status: "ativo",
      userType: "requisitante"
    });
    await upsertUser({
      uid: testPatchUid,
      email: "patch.test@s1gestao.local",
      name: "Requisitante Teste Patch",
      document: "777.888.999-00",
      userType: "requisitante",
      status: "ativo"
    });
    const patchUserToken = signServerSessionToken({
      uid: testPatchUid,
      email: "patch.test@s1gestao.local",
      role: "requisitante",
      document: "777.888.999-00"
    });

    const resPatchSelf = await fetch(`${baseUrl}/api/usuarios/${testPatchUid}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${patchUserToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        notes: "Observação atualizada via PATCH",
        userType: "admin",           // Protegido
        status: "inativo",           // Protegido
        warehouseId: "wh-inválido",  // Protegido
        password: "TentativaDeSenhaTextoPuro" // Protegido/Removido
      })
    });
    assert(resPatchSelf.status === 200, "PATCH /api/usuarios/:id aceito para atualização parcial própria (200 OK)", "200", String(resPatchSelf.status));
    const patchResult = await resPatchSelf.json();
    assert(
      patchResult.usuario?.notes === "Observação atualizada via PATCH",
      "PATCH: Campo permitido 'notes' atualizado com sucesso",
      "Observação atualizada via PATCH",
      String(patchResult.usuario?.notes)
    );
    assert(
      patchResult.usuario?.userType === "requisitante",
      "PATCH: Campo protegido 'userType' blindado contra auto-elevação para 'admin'",
      "requisitante",
      String(patchResult.usuario?.userType)
    );
    assert(
      patchResult.usuario?.status === "ativo",
      "PATCH: Campo protegido 'status' blindado contra adulteração",
      "ativo",
      String(patchResult.usuario?.status)
    );
    assert(
      !("password" in patchResult.usuario),
      "PATCH: Senhas em texto puro não são aceitas nem retornadas pela API",
      "true",
      String(!("password" in patchResult.usuario))
    );

    await deleteUsuario(testPatchUid);
    await deleteUser(testPatchUid);

    // 10.12 Senhas em texto puro nunca são persistidas em 'usuarios.data' nem retornadas em POST ou GET
    const testPwUid = `test-pw-strip-${Date.now()}`;
    const resCreateWithPw = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testPwUid,
        name: "Cidadão Teste Sanitização de Senha",
        document: "333.444.555-66",
        password: "MinhaSenhaEmTextoPuroNuncaSalvaNoBanco"
      })
    });
    assert(resCreateWithPw.status === 201, "POST /api/usuarios com tentativa de senha em texto puro criado (201 Created)", "201", String(resCreateWithPw.status));
    const createWithPwData = await resCreateWithPw.json();
    assert(
      !("password" in (createWithPwData.usuario || {})),
      "POST: Resposta da API não expõe campo de senha em texto puro",
      "true",
      String(!("password" in (createWithPwData.usuario || {})))
    );

    const resGetPw = await fetch(`${baseUrl}/api/usuarios/${testPwUid}`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const getPwData = await resGetPw.json();
    assert(
      !("password" in getPwData),
      "GET /api/usuarios/:id não retorna campo de senha em texto puro",
      "true",
      String(!("password" in getPwData))
    );

    await deleteUsuario(testPwUid);
    await deleteUser(testPwUid);

    // 10.13 Resposta vazia legítima de GET /api/usuarios retorna array vazio [] sem gerar registros demo
    const emptyUserUid = `test-empty-user-${Date.now()}`;
    const emptyUserToken = signServerSessionToken({
      uid: emptyUserUid,
      email: "novo.usuario.sem.cadastro@s1gestao.local",
      role: "requisitante"
    });
    const resEmptyList = await fetch(`${baseUrl}/api/usuarios`, {
      headers: { "Authorization": `Bearer ${emptyUserToken}` }
    });
    assert(resEmptyList.status === 200, "GET /api/usuarios para usuário sem registros retorna 200 OK", "200", String(resEmptyList.status));
    const emptyListData = await resEmptyList.json();
    assert(
      Array.isArray(emptyListData) && emptyListData.length === 0,
      "GET /api/usuarios para usuário sem vínculos retorna array vazio [] legítimo sem gerar dados demo",
      "[] (length 0)",
      JSON.stringify(emptyListData)
    );

    // 10.14 Cadastro operacional municipal de cidadão no balcão sem conta de acesso (users) continua permitido
    const testBalcaoUid = `cidadao-balcao-${Date.now()}`;
    const resBalcao = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testBalcaoUid,
        name: "Dona Maria - Atendimento Presencial no Balcão",
        document: "888.999.000-11",
        phone: "(18) 3622-0000",
        address: "Rua das Flores, 123 - Centro",
        status: "ativo",
        userType: "requisitante"
      })
    });
    assert(resBalcao.status === 201, "Cadastro presencial de cidadão sem conta de login (users) aceito com sucesso (201 Created)", "201", String(resBalcao.status));
    const balcaoData = await resBalcao.json();
    assert(
      balcaoData.usuario?.name === "Dona Maria - Atendimento Presencial no Balcão",
      "Registro operacional de cidadão gravado e recuperável com dados cadastrais completos",
      "Dona Maria - Atendimento Presencial no Balcão",
      String(balcaoData.usuario?.name)
    );

    await deleteUsuario(testBalcaoUid);

    // 10.15 Distinção clara e robusta entre códigos de status HTTP (401, 403, 404, 200)
    // 401: Token ausente
    const resStatus401 = await fetch(`${baseUrl}/api/usuarios`);
    assert(resStatus401.status === 401, "Distinção HTTP: Sem token retorna estritamente 401 Unauthorized", "401", String(resStatus401.status));

    // 403: Requisitante tentando acessar ID que não lhe pertence
    const resStatus403 = await fetch(`${baseUrl}/api/usuarios/outro-usuario-qualquer`, {
      headers: { "Authorization": `Bearer ${emptyUserToken}` }
    });
    assert(resStatus403.status === 403, "Distinção HTTP: Requisitante acessando fora de escopo retorna estritamente 403 Forbidden", "403", String(resStatus403.status));

    // 404: Administrador acessando ID que comprovadamente não existe
    const resStatus404 = await fetch(`${baseUrl}/api/usuarios/usuario-inexistente-123456`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    // =============================================================
    // GRUPO 11: Correção de Pendências (Fase 2.3+)
    // 1. Sanitização direta no JSONB bruto do PostgreSQL
    // 2. Revogação de sessões resiliente a reinício do servidor
    // 3. Integridade referencial com ON DELETE RESTRICT
    // 4. Autenticação oficial no backend com Argon2id
    // =============================================================
    console.log("\n📌 Grupo 11: Correção de Pendências (JSONB Bruto, Revogação Persistente, RESTRICT e Argon2id)");

    // 11.1 Prova direta no JSONB bruto do PostgreSQL de que senhas nunca são persistidas
    const testDirectJsonbUid = `test-jsonb-raw-${Date.now()}`;
    const secretPlainTextPassword = "MinhaSenhaEmTextoPuroAbsolutamenteSecreta999";
    const secretPlainTextSenha = "OutroCampoDeSenhaTextoPuro888";

    await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: testDirectJsonbUid,
        name: "Cidadão Teste Verificação JSONB Bruto",
        document: "999.888.777-66",
        phone: "(18) 99123-4567",
        password: secretPlainTextPassword,
        senha: secretPlainTextSenha
      })
    });

    // Consulta SQL DIRETA no PostgreSQL sem passar por nenhum helper que possa mascarar dados
    const rawDbRow = await db.execute(sql`
      SELECT id, name, data FROM usuarios WHERE id = ${testDirectJsonbUid}
    `);
    assert(rawDbRow.length === 1, "Registro gravado com sucesso no PostgreSQL para verificação de JSONB", "1", String(rawDbRow.length));
    
    const rawDataJson = rawDbRow[0].data as Record<string, any> || {};
    const rawDataString = JSON.stringify(rawDataJson);

    assert(
      !rawDataString.includes(secretPlainTextPassword),
      "Prova Direta PostgreSQL: 'password' em texto puro NÃO consta no JSONB bruto do banco",
      "false",
      String(rawDataString.includes(secretPlainTextPassword))
    );
    assert(
      !rawDataString.includes(secretPlainTextSenha),
      "Prova Direta PostgreSQL: 'senha' em texto puro NÃO consta no JSONB bruto do banco",
      "false",
      String(rawDataString.includes(secretPlainTextSenha))
    );
    assert(
      !("password" in rawDataJson),
      "Prova Direta PostgreSQL: Chave 'password' não existe nas propriedades do JSONB",
      "true",
      String(!("password" in rawDataJson))
    );
    assert(
      !("senha" in rawDataJson),
      "Prova Direta PostgreSQL: Chave 'senha' não existe nas propriedades do JSONB",
      "true",
      String(!("senha" in rawDataJson))
    );

    await deleteUsuario(testDirectJsonbUid);
    await deleteUser(testDirectJsonbUid);

    // 11.2 Prova de que a revogação de sessão sobrevive ao reinício do servidor (reset de memória)
    const testPersistentUid = `test-persistent-rev-${Date.now()}`;
    const testPersistentJti = `jti-restart-${Date.now()}`;
    const persistentToken = signServerSessionToken({
      uid: testPersistentUid,
      email: "persistent.rev@s1gestao.local",
      role: "admin",
      jti: testPersistentJti
    });

    // 11.2.1 Inicialmente o token é aceito
    const resBeforeRev = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${persistentToken}` }
    });
    assert(resBeforeRev.status === 200, "Token persistente emitido autentica inicialmente com sucesso (200 OK)", "200", String(resBeforeRev.status));

    // 11.2.2 Revoga o token individualmente (grava em memória E no PostgreSQL)
    revokeSessionToken(persistentToken);

    // 11.2.3 SIMULAÇÃO REAL DE REINÍCIO DO PROCESSO:
    // Limpa integralmente as estruturas em memória (revokedTokenSignatures, revokedJtis, revokedUidsBeforeTimestamp)
    resetRevocationStore();

    // 11.2.4 Após reinício/reset de memória, a requisição com o token revogado DEVE continuar sendo recusada com 401
    const resAfterRestart = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${persistentToken}` }
    });
    assert(
      resAfterRestart.status === 401,
      "Revogação pós-reinício: Token revogado é recusado com 401 Unauthorized via checagem persistente no PostgreSQL",
      "401",
      String(resAfterRestart.status)
    );
    const afterRestartData = await resAfterRestart.json();
    assert(
      typeof afterRestartData.error === "string" && afterRestartData.error.includes("revogada"),
      "Mensagem de segurança informa expressamente que a sessão foi revogada no servidor",
      "true",
      String(afterRestartData.error?.includes("revogada"))
    );

    // 11.3 Integridade referencial: Foreign key ON DELETE RESTRICT entre service_orders e usuarios
    const testRestrictUid = `test-restrict-user-${Date.now()}`;
    const testRestrictOrderId = `test-restrict-os-${Date.now()}`;

    await upsertUsuario({
      id: testRestrictUid,
      name: "Cidadão Teste Constraint RESTRICT",
      document: "111.999.888-00",
      phone: "(18) 3600-0000",
      email: "restrict@s1gestao.local",
      address: "Rua Integridade, 500",
      notes: "Teste de Foreign Key RESTRICT",
      createdAt: new Date().toISOString(),
      status: "ativo",
      userType: "requisitante"
    });

    await upsertServiceOrder({
      id: testRestrictOrderId,
      clientId: testRestrictUid, // Referência direta à chave primária de usuarios
      title: "Ordem de Serviço com Constraint RESTRICT",
      description: "OS vinculada ao requisitante",
      category: "Elétrica",
      status: "aberto",
      priority: "medium",
      assignedTo: "Técnico Teste",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      notes: "Teste RESTRICT",
      history: [],
      createdAt: new Date().toISOString()
    });

    // 11.3.1 Tentativa de exclusão via API protegida é recusada com 400 Bad Request
    const resApiDeleteBlocked = await fetch(`${baseUrl}/api/usuarios/${testRestrictUid}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert(
      resApiDeleteBlocked.status === 400,
      "Integridade na API: Exclusão de requisitante com OS vinculada é bloqueada (400 Bad Request)",
      "400",
      String(resApiDeleteBlocked.status)
    );

    // 11.3.2 Tentativa de exclusão direta via SQL no banco é bloqueada pela constraint RESTRICT do PostgreSQL
    let directSqlFailed = false;
    let pgErrorCode = "";
    try {
      await db.execute(sql`DELETE FROM usuarios WHERE id = ${testRestrictUid}`);
    } catch (err: any) {
      directSqlFailed = true;
      pgErrorCode = err?.cause?.code || err?.code || "";
    }
    const isStrictForeignKeyViolation = directSqlFailed && (pgErrorCode === "23503" || pgErrorCode === "23001");
    assert(
      isStrictForeignKeyViolation,
      "Integridade no Banco: Constraint 'service_orders_client_id_usuarios_id_fk' (RESTRICT) bloqueia exclusão no PostgreSQL com código estrito 23503",
      "23503",
      isStrictForeignKeyViolation ? "23503" : pgErrorCode
    );

    // 11.3.3 Atualização cadastral preserva o vínculo da OS intacto
    await upsertUsuario({
      id: testRestrictUid,
      name: "Cidadão Teste Constraint RESTRICT (Nome Atualizado)",
      document: "111.999.888-00",
      phone: "(18) 99888-1111",
      email: "restrict.updated@s1gestao.local",
      address: "Rua Integridade, 500",
      notes: "Teste de Foreign Key RESTRICT",
      createdAt: new Date().toISOString(),
      status: "ativo",
      userType: "requisitante"
    });

    const verifyOrderRow = await db.execute(sql`
      SELECT client_id FROM service_orders WHERE id = ${testRestrictOrderId}
    `);
    assert(
      verifyOrderRow[0]?.client_id === testRestrictUid,
      "Integridade referencial: Vínculo client_id da OS permanece 100% preservado após atualizações",
      testRestrictUid,
      String(verifyOrderRow[0]?.client_id)
    );

    // Limpeza da OS e do usuário de teste
    await deleteServiceOrder(testRestrictOrderId);
    await deleteUsuario(testRestrictUid);

    // 11.4 Autenticação Oficial no Backend com Argon2id (/api/auth/login)
    const testArgonUserUid = `test-argon-user-${Date.now()}`;
    const testArgonDoc = "44455566677";
    const testPlainPassword = "SenhaForteSeguraArgon2id#2026";
    const testArgonHash = await argon2.hash(testPlainPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    await upsertUser({
      uid: testArgonUserUid,
      email: "argon.user@s1gestao.local",
      name: "Usuário Teste Argon2id",
      document: testArgonDoc,
      userType: "requisitante",
      status: "ativo"
    });
    await setUserPasswordHash(testArgonUserUid, testArgonHash);

    // 11.4.1 Login com credenciais corretas via Argon2id (200 OK)
    const resLoginSuccess = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: testArgonDoc, password: testPlainPassword })
    });
    assert(resLoginSuccess.status === 200, "POST /api/auth/login com senha Argon2id correta autentica com sucesso (200 OK)", "200", String(resLoginSuccess.status));
    const loginSuccessData = await resLoginSuccess.json();
    assert(
      loginSuccessData.success === true && typeof loginSuccessData.token === "string",
      "POST /api/auth/login emite token criptográfico assinado pelo servidor",
      "true",
      String(loginSuccessData.success === true && typeof loginSuccessData.token === "string")
    );
    assert(
      !("password" in (loginSuccessData.user || {})) && !("passwordHash" in (loginSuccessData.user || {})),
      "Segurança: Resposta de login não expõe campos de senha ou hash",
      "true",
      String(!("password" in (loginSuccessData.user || {})) && !("passwordHash" in (loginSuccessData.user || {})))
    );

    // 11.4.2 Login com senha incorreta retorna 401 com mensagem genérica (timing-safe)
    const resLoginWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: testArgonDoc, password: "SenhaTotalmenteIncorreta" })
    });
    assert(resLoginWrongPass.status === 401, "POST /api/auth/login com senha incorreta é rejeitado (401 Unauthorized)", "401", String(resLoginWrongPass.status));
    const wrongPassData = await resLoginWrongPass.json();
    assert(
      wrongPassData.message === "CPF ou senha incorretos.",
      "Mensagem de erro genérica não revela detalhes do erro para mitigar ataques de enumeração",
      "CPF ou senha incorretos.",
      String(wrongPassData.message)
    );

    // 11.4.3 Login com CPF inexistente retorna EXATAMENTE a mesma mensagem genérica
    const resLoginNonExistent = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "00011122233", password: testPlainPassword })
    });
    assert(resLoginNonExistent.status === 401, "POST /api/auth/login com CPF inexistente rejeitado com 401", "401", String(resLoginNonExistent.status));
    const nonExistentData = await resLoginNonExistent.json();
    assert(
      nonExistentData.message === "CPF ou senha incorretos.",
      "Timing-safe & Enumeração: CPF inexistente retorna a mesma mensagem genérica 'CPF ou senha incorretos.'",
      "CPF ou senha incorretos.",
      String(nonExistentData.message)
    );

    // Limpeza do usuário de teste
    await deleteUser(testArgonUserUid);

    // =========================================================================
    // Grupo 12: Acesso Seguro e Transição de Contas Legadas sem Hash
    // =========================================================================
    console.log("\n📌 Grupo 12: Transição Segura de Contas Legadas (Sem Hash / Ativação)");

    const testLegacyUid = `legacy-user-${Date.now()}`;
    const testLegacyDoc = "55566677788";
    testCleanupRegistry.users.add(testLegacyUid);
    testCleanupRegistry.resetTokenUserIds.add(testLegacyUid);
    await upsertUser({
      uid: testLegacyUid,
      email: "legacy@s1gestao.local",
      name: "Cidadão Legado Sem Hash",
      document: testLegacyDoc,
      userType: "requisitante",
      status: "ativo"
    });
    await db.execute(sql`UPDATE users SET password_hash = NULL WHERE uid = ${testLegacyUid}`);

    // 12.1 Conta legada sem hash: login com CPF existente retorna 401 com mensagem genérica (anti-enumeração)
    const resLegacyLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: testLegacyDoc, password: "QualquerSenha" })
    });
    assert(
      resLegacyLogin.status === 401,
      "Conta legada sem hash: login rejeitado com 401 Unauthorized",
      "401",
      String(resLegacyLogin.status)
    );
    const legacyLoginData = await resLegacyLogin.json();
    assert(
      legacyLoginData.message === "CPF ou senha incorretos.",
      "Anti-enumeração: Login em conta sem hash retorna exatamente a mensagem genérica 'CPF ou senha incorretos.'",
      "CPF ou senha incorretos.",
      String(legacyLoginData.message)
    );

    // 12.2 Solicitação pública de ativação: CPF existente retorna mensagem genérica segura
    const resReqActivation = await fetch(`${baseUrl}/api/auth/request-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: testLegacyDoc })
    });
    assert(
      resReqActivation.status === 200,
      "POST /api/auth/request-activation com CPF existente retorna 200 OK",
      "200",
      String(resReqActivation.status)
    );
    const reqActData = await resReqActivation.json();
    assert(
      reqActData.success === true && reqActData.message.includes("ativação registrada"),
      "Mensagem genérica informa processamento seguro sem revelar existência de conta",
      "true",
      String(reqActData.success === true && reqActData.message.includes("ativação registrada"))
    );

    // 12.3 Solicitação pública com CPF inexistente retorna EXATAMENTE a mesma mensagem genérica
    const resReqNonExistent = await fetch(`${baseUrl}/api/auth/request-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "99988877700" })
    });
    assert(
      resReqNonExistent.status === 200,
      "POST /api/auth/request-activation com CPF inexistente retorna 200 OK",
      "200",
      String(resReqNonExistent.status)
    );
    const reqNonExistentData = await resReqNonExistent.json();
    assert(
      reqNonExistentData.message === reqActData.message,
      "Timing-safe & Anti-enumeração: CPF inexistente recebe idêntica resposta neutra",
      reqActData.message,
      String(reqNonExistentData.message)
    );

    // 12.4 Geração assistida de token de ativação por Administrador no balcão municipal
    const resAdminGenToken = await fetch(`${baseUrl}/api/auth/admin/generate-activation-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUid: testLegacyUid, document: testLegacyDoc })
    });
    assert(
      resAdminGenToken.status === 200,
      "Administrador autorizado gera token de ativação assistida (200 OK)",
      "200",
      String(resAdminGenToken.status)
    );
    const adminGenData = await resAdminGenToken.json();
    const rawActivationToken = adminGenData.token;
    assert(
      typeof rawActivationToken === "string" && rawActivationToken.length === 64,
      "Token de ativação emitido é um hash aleatório de alta entropia (64 caracteres hexadecimais = 32 bytes)",
      "64",
      String(rawActivationToken?.length)
    );

    // 12.5 Requisitante comum sem privilégios é impedido de emitir token assistido (403 Forbidden)
    const commonUserToken = signServerSessionToken({
      uid: "common-tester-token",
      role: "requisitante"
    });
    const resForbiddenGenToken = await fetch(`${baseUrl}/api/auth/admin/generate-activation-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${commonUserToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUid: testLegacyUid })
    });
    assert(
      resForbiddenGenToken.status === 403,
      "Requisitante comum impedido de emitir token de ativação assistida (403 Forbidden)",
      "403",
      String(resForbiddenGenToken.status)
    );

    // 12.6 Tentativa de resgate com senha fraca (< 6 caracteres) falha com 400
    const resRedeemWeakPass = await fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawActivationToken, newPassword: "123" })
    });
    assert(
      resRedeemWeakPass.status === 400,
      "Resgate de token com senha fraca (< 6 caracteres) é rejeitado com 400 Bad Request",
      "400",
      String(resRedeemWeakPass.status)
    );

    // 12.7 Resgate bem-sucedido com senha forte (Argon2id)
    const newLegacyPassword = "SenhaAtivadaForteArgon2id#2026";
    const resRedeemSuccess = await fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawActivationToken, newPassword: newLegacyPassword })
    });
    assert(
      resRedeemSuccess.status === 200,
      "Resgate de token válido define nova credencial com sucesso (200 OK)",
      "200",
      String(resRedeemSuccess.status)
    );

    // 12.8 Uso único: tentar reutilizar o mesmo token falha (400 Bad Request)
    const resRedeemReplay = await fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawActivationToken, newPassword: "OutraSenhaValida123" })
    });
    assert(
      resRedeemReplay.status === 400,
      "Token de uso único: Reutilização do mesmo token é bloqueada com 400 Bad Request",
      "400",
      String(resRedeemReplay.status)
    );

    // 12.9 Conta bloqueada ou inativa tem ativação rejeitada com 403 e preserva o token
    const testBlockedUid = `blocked-act-${Date.now()}`;
    testCleanupRegistry.users.add(testBlockedUid);
    testCleanupRegistry.resetTokenUserIds.add(testBlockedUid);
    await upsertUser({
      uid: testBlockedUid,
      email: "blocked.act@s1gestao.local",
      name: "Cidadão Bloqueado Teste",
      document: "77788899900",
      userType: "requisitante",
      status: "bloqueado"
    });
    const resAdminGenBlocked = await fetch(`${baseUrl}/api/auth/admin/generate-activation-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUid: testBlockedUid })
    });
    const blockedToken = (await resAdminGenBlocked.json()).token;
    const resRedeemBlocked = await fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: blockedToken, newPassword: "SenhaValida123" })
    });
    assert(
      resRedeemBlocked.status === 403,
      "Conta bloqueada tem resgate de ativação rejeitado com 403 Forbidden",
      "403",
      String(resRedeemBlocked.status)
    );

    // Valida que falha intermediária NÃO consome o token (preservação do token para correção operacional)
    const tokenHashBlocked = crypto.createHash("sha256").update(blockedToken).digest("hex");
    const checkTokenUnconsumed = await db.execute(sql`SELECT used_at FROM password_reset_tokens WHERE token_hash = ${tokenHashBlocked}`);
    assert(
      (checkTokenUnconsumed[0] as any)?.used_at === null,
      "Falha intermediária na ativação preserva o token sem consumi-lo (used_at permanece NULL)",
      "null",
      String((checkTokenUnconsumed[0] as any)?.used_at)
    );

    // 12.10 Login oficial com a senha recém-ativada autentica com sucesso (200 OK)
    const resLoginAfterActivation = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: testLegacyDoc, password: newLegacyPassword })
    });
    assert(
      resLoginAfterActivation.status === 200,
      "Login pós-ativação autentica com sucesso via Argon2id (200 OK)",
      "200",
      String(resLoginAfterActivation.status)
    );

    // 12.11 Concorrência no Resgate: Duas requisições simultâneas com o mesmo token (Race Condition)
    const testConcurrentUid = `concurrent-user-${Date.now()}`;
    const testConcurrentDoc = "11144477735";
    testCleanupRegistry.users.add(testConcurrentUid);
    testCleanupRegistry.resetTokenUserIds.add(testConcurrentUid);
    await upsertUser({
      uid: testConcurrentUid,
      email: "concurrent@s1gestao.local",
      name: "Cidadão Teste Concorrência",
      document: testConcurrentDoc,
      userType: "requisitante",
      status: "ativo"
    });
    const resGenConcurrent = await fetch(`${baseUrl}/api/auth/admin/generate-activation-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUid: testConcurrentUid, document: testConcurrentDoc })
    });
    const concurrentToken = (await resGenConcurrent.json()).token;

    // Dispara duas requisições simultâneas concorrentes com o mesmo token
    const [resConc1, resConc2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: concurrentToken, newPassword: "SenhaConcorrenteA#1" })
      }),
      fetch(`${baseUrl}/api/auth/redeem-activation-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: concurrentToken, newPassword: "SenhaConcorrenteB#2" })
      })
    ]);

    const statuses = [resConc1.status, resConc2.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 400,
      "Concorrência: Exatamente uma requisição de ativação é aceita (200) e a concorrente simultânea é rejeitada (400)",
      "200 e 400",
      `${resConc1.status} e ${resConc2.status}`
    );

    // =========================================================================
    // Grupo 13: Logout com Revogação Persistente no PostgreSQL e Fail-Secure
    // =========================================================================
    console.log("\n📌 Grupo 13: Logout com Revogação Persistente e Comportamento Fail-Secure");

    const testLogoutUid = `logout-user-${Date.now()}`;
    const testLogoutJti = `logout-jti-${Date.now()}`;
    testCleanupRegistry.users.add(testLogoutUid);
    testCleanupRegistry.revokedSessionIdentifiers.add(testLogoutJti);
    const logoutToken = signServerSessionToken({
      uid: testLogoutUid,
      role: "admin",
      jti: testLogoutJti
    });

    // 13.1 Token autentica antes do logout
    const resBeforeLogout = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${logoutToken}` }
    });
    assert(resBeforeLogout.status === 200, "Token de sessão autentica rota protegida antes do logout (200 OK)", "200", String(resBeforeLogout.status));

    // 13.2 Chamada de POST /api/auth/logout revoga o token no PostgreSQL
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${logoutToken}` }
    });
    assert(resLogout.status === 200, "POST /api/auth/logout responde 200 OK com confirmação de revogação", "200", String(resLogout.status));

    // 13.3 Reutilização do token é rejeitada imediatamente com 401
    const resAfterLogout = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${logoutToken}` }
    });
    assert(
      resAfterLogout.status === 401,
      "Token revogado via logout é recusado com 401 Unauthorized",
      "401",
      String(resAfterLogout.status)
    );

    // 13.4 Sobrevivência pós-reinício do servidor (reset de memória)
    resetRevocationStore();
    const resAfterResetMemory = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${logoutToken}` }
    });
    assert(
      resAfterResetMemory.status === 401,
      "Revogação via logout persiste no PostgreSQL após reinício/reset de memória (401 Unauthorized)",
      "401",
      String(resAfterResetMemory.status)
    );

    // 13.5 Comportamento Fail-Secure: Falha de conexão com PostgreSQL retorna HTTP 503
    const failSecureJti = `fail-secure-jti-${Date.now()}`;
    testCleanupRegistry.revokedSessionIdentifiers.add(failSecureJti);
    const validFailSecureToken = signServerSessionToken({
      uid: "fail-secure-user",
      role: "admin",
      jti: failSecureJti
    });
    setDbFailureSimulationForTest(true);
    const resFailSecure = await fetch(`${baseUrl}/api/postgres/system-logs`, {
      headers: { "Authorization": `Bearer ${validFailSecureToken}` }
    });
    assert(
      resFailSecure.status === 503,
      "Fail-Secure: Falha/indisponibilidade do PostgreSQL na checagem de revogação retorna 503 Service Unavailable",
      "503",
      String(resFailSecure.status)
    );
    setDbFailureSimulationForTest(false);

    // 13.6 Tratamento de erro no logout com token ausente ou inválido
    const resLogoutNoAuth = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    assert(resLogoutNoAuth.status === 401, "POST /api/auth/logout sem header Authorization retorna 401 Unauthorized", "401", String(resLogoutNoAuth.status));

    const resLogoutBadToken = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { "Authorization": "Bearer token-malformado-invalido" }
    });
    assert(resLogoutBadToken.status === 401, "POST /api/auth/logout com token inválido retorna 401 Unauthorized", "401", String(resLogoutBadToken.status));

    // =========================================================================
    // Grupo 14: Provisionamento de Novas Contas e Ambiguidade Cadastral
    // =========================================================================
    console.log("\n📌 Grupo 14: Provisionamento de Contas e Ambiguidade Cadastral");

    // 14.1 Cadastro municipal sem senha: cria apenas em 'usuarios' (sem login)
    const testMunicipePureUid = `municipe-pure-${Date.now()}`;
    testCleanupRegistry.usuarios.add(testMunicipePureUid);
    const resMunicipePure = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: testMunicipePureUid,
        name: "Cidadão Presencial Sem Login",
        document: "11144477735",
        phone: "(18) 3333-2222",
        email: "cidade.presencial@s1gestao.local"
      })
    });
    assert(resMunicipePure.status === 201, "Cadastro presencial de munícipe sem senha aceito (201 Created)", "201", String(resMunicipePure.status));
    const pureData = await resMunicipePure.json();
    if (pureData?.usuario?.id) {
      testCleanupRegistry.usuarios.add(pureData.usuario.id);
    }
    assert(
      pureData.accountProvisioned === false,
      "Cadastro presencial registra munícipe em 'usuarios' sem provisionar conta em 'users' (accountProvisioned: false)",
      "false",
      String(pureData.accountProvisioned)
    );

    // 14.2 Senha curta (< 6 chars) enviada no cadastro NÃO é silenciada, retornando erro claro 400
    const resShortPass = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cidadão Tentando Senha Curta",
        document: "23456789092",
        password: "123"
      })
    });
    assert(
      resShortPass.status === 400,
      "Senha informada com menos de 6 caracteres retorna erro claro (400 Bad Request) sem silenciamento",
      "400",
      String(resShortPass.status)
    );

    // 14.3 Cadastro público com senha válida provisiona conta em 'users' com status 'pendente_autorizacao'
    const testProvisionDoc = "34567890175";
    const testProvisionPass = "SenhaValidaProvisionada#2026";
    const resProvision = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cidadão Com Conta Provisionada",
        document: testProvisionDoc,
        email: "provisionado@s1gestao.local",
        password: testProvisionPass,
        userType: "admin"
      })
    });
    assert(resProvision.status === 201, "Cadastro com senha válida provisiona conta (201 Created)", "201", String(resProvision.status));
    const provData = await resProvision.json();
    testCleanupRegistry.usuarios.add(provData.usuario.id);
    testCleanupRegistry.users.add(provData.usuario.id);

    assert(
      provData.accountProvisioned === true,
      "Conta de login provisionada no banco com sucesso (accountProvisioned: true)",
      "true",
      String(provData.accountProvisioned)
    );
    assert(
      provData.usuario.userType === "requisitante" && provData.status === "pendente_autorizacao",
      "Auto-cadastro público força estritamente papel 'requisitante' e status 'pendente_autorizacao'",
      "requisitante|pendente_autorizacao",
      `${provData.usuario.userType}|${provData.status}`
    );

    // 14.4 Tentativa de login com conta em 'pendente_autorizacao' é bloqueada com 403 Forbidden
    const resLoginPending = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: testProvisionDoc,
        password: testProvisionPass
      })
    });
    assert(
      resLoginPending.status === 403,
      "Conta em status 'pendente_autorizacao' tem login bloqueado com 403 Forbidden",
      "403",
      String(resLoginPending.status)
    );

    // 14.5 Detecção de ambiguidade cadastral: rejeita provisionamento se houver duplicidade em 'usuarios'
    const ambiguousDoc = "45678901249";
    const ambigUid1 = `ambig-1-${Date.now()}`;
    const ambigUid2 = `ambig-2-${Date.now()}`;
    testCleanupRegistry.usuarios.add(ambigUid1);
    testCleanupRegistry.usuarios.add(ambigUid2);

    await upsertUsuario({
      id: ambigUid1,
      name: "Munícipe Duplicado 1",
      document: ambiguousDoc,
      phone: "(18) 3333-0001",
      email: "ambig1@s1gestao.local",
      address: "Rua Ambígua 1",
      notes: "Ambíguo 1",
      createdAt: new Date().toISOString(),
      status: "ativo",
      userType: "requisitante"
    });
    await upsertUsuario({
      id: ambigUid2,
      name: "Munícipe Duplicado 2",
      document: ambiguousDoc,
      phone: "(18) 3333-0002",
      email: "ambig2@s1gestao.local",
      address: "Rua Ambígua 2",
      notes: "Ambíguo 2",
      createdAt: new Date().toISOString(),
      status: "ativo",
      userType: "requisitante"
    });

    const resAmbig = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Tentativa de Conta com Cadastro Ambíguo",
        document: ambiguousDoc,
        password: "SenhaParaAmbiguo123"
      })
    });
    assert(
      resAmbig.status === 400,
      "Prevenção de Ambiguidade: Provisionamento rejeitado (400 Bad Request) quando existem múltiplos cadastros prévios",
      "400",
      String(resAmbig.status)
    );

    // 14.6 Associação com cadastro operacional único existente e preservação de vínculos com OS
    const opSingleUid = `cli-op-link-${Date.now()}`;
    const opSingleDoc = "56789012303";
    const opOrderId = `so-link-${Date.now()}`;
    testCleanupRegistry.usuarios.add(opSingleUid);
    testCleanupRegistry.users.add(opSingleUid);
    testCleanupRegistry.serviceOrders.add(opOrderId);

    // 1. Cadastra munícipe operacional prévio em usuarios
    await upsertUsuario({
      id: opSingleUid,
      name: "Munícipe Operacional Com Histórico",
      document: opSingleDoc,
      phone: "(18) 3644-1234",
      email: "operacional.historico@s1gestao.local",
      address: "Av. Brasil, 100",
      status: "ativo",
      userType: "requisitante",
      createdAt: new Date().toISOString(),
      notes: "Cadastro presencial prévio"
    });

    // 2. Cria ordem de serviço vinculada a este munícipe
    await upsertServiceOrder({
      id: opOrderId,
      title: "Reparo de Iluminação Pública Pré-existente",
      clientId: opSingleUid,
      assignedTo: "Carlos Henrique",
      category: "Elétrica",
      status: "aberto",
      priority: "high",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      notes: "Atendimento pré-existente",
      description: "Lâmpada queimada em frente à residência",
      location: "Av. Brasil, 100",
      history: [],
      images: [],
      completedImages: [],
      createdAt: new Date().toISOString()
    });

    // 3. Munícipe realiza auto-cadastro com o mesmo CPF
    const resLinkExisting = await fetch(`${baseUrl}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Munícipe Operacional Com Histórico",
        document: opSingleDoc,
        email: "operacional.historico@s1gestao.local",
        password: "SenhaForteVinculo#2026",
        createAccount: true
      })
    });
    assert(
      resLinkExisting.status === 201,
      "Auto-cadastro de cidadão com cadastro prévio único responde 201 Created",
      "201",
      String(resLinkExisting.status)
    );
    const linkExistingData = await resLinkExisting.json();
    assert(
      linkExistingData.linkedExistingUsuario === true && linkExistingData.usuario.id === opSingleUid,
      "Identificador operacional reutilizado com sucesso (mesmo ID em usuarios e users)",
      `${opSingleUid}|true`,
      `${linkExistingData.usuario.id}|${linkExistingData.linkedExistingUsuario}`
    );

    // 4. Confirma que a ordem de serviço continua vinculada a este usuário
    const linkedUserToken = signServerSessionToken({
      uid: opSingleUid,
      role: "requisitante",
      name: "Munícipe Operacional Com Histórico",
      document: opSingleDoc
    });
    const resLinkedOrders = await fetch(`${baseUrl}/api/postgres/service-orders`, {
      headers: { "Authorization": `Bearer ${linkedUserToken}` }
    });
    const linkedOrdersList = await resLinkedOrders.json();
    const hasLinkedOrder = Array.isArray(linkedOrdersList) && linkedOrdersList.some(o => o.id === opOrderId);
    assert(
      hasLinkedOrder,
      "Preservação de Vínculos: Ordem de serviço prévia permanece vinculada e acessível à conta recém-provisionada",
      "true",
      String(hasLinkedOrder)
    );

    // 14.7 Validação de alteração de documento com CPF matematicamente inválido (400)
    const resInvalidDocUpdate = await fetch(`${baseUrl}/api/usuarios/${opSingleUid}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${linkedUserToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        document: "11111111111" // Sequência repetida inválida
      })
    });
    assert(
      resInvalidDocUpdate.status === 400,
      "Alteração de documento com CPF matematicamente inválido é rejeitada com 400 Bad Request",
      "400",
      String(resInvalidDocUpdate.status)
    );

    // 14.8 Validação de alteração de documento para CPF já em uso por outro usuário (409 Conflict)
    const otherCitizenUid = `other-cit-${Date.now()}`;
    const otherCitizenDoc = "12345678909"; // CPF matematicamente válido
    testCleanupRegistry.usuarios.add(otherCitizenUid);
    await upsertUsuario({
      id: otherCitizenUid,
      name: "Outro Cidadão Existente",
      document: otherCitizenDoc,
      phone: "(18) 3644-9999",
      email: "outro.cidadao@s1gestao.local",
      address: "Rua Teste, 200",
      notes: "Munícipe teste",
      status: "ativo",
      userType: "requisitante",
      createdAt: new Date().toISOString()
    });

    const resConflictDocUpdate = await fetch(`${baseUrl}/api/usuarios/${opSingleUid}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${linkedUserToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        document: otherCitizenDoc
      })
    });
    assert(
      resConflictDocUpdate.status === 409,
      "Alteração de documento para CPF já cadastrado em outro munícipe é rejeitada com 409 Conflict",
      "409",
      String(resConflictDocUpdate.status)
    );

  } finally {
    console.log("\n🧹 Executando Limpeza Rigorosa e Isolamento de Artefatos de Teste...");

    // 1. Limpeza de Ordens de Serviço criadas nos testes
    for (const soId of testCleanupRegistry.serviceOrders) {
      try { await deleteServiceOrder(soId); } catch (e) {}
    }

    // 2. Limpeza de Usuários e Munícipes criados nos testes
    for (const uid of testCleanupRegistry.users) {
      try { await deleteUser(uid); } catch (e) {}
    }
    for (const id of testCleanupRegistry.usuarios) {
      try { await deleteUsuario(id); } catch (e) {}
    }

    // 3. Limpeza de Tokens de Redefinição gerados nos testes
    for (const uid of testCleanupRegistry.resetTokenUserIds) {
      try { await deletePasswordResetTokensByUserId(uid); } catch (e) {}
    }

    // 4. Limpeza de Revogações de Sessão geradas nos testes
    for (const ident of testCleanupRegistry.revokedSessionIdentifiers) {
      try { await deleteRevokedSessionsByIdentifier(ident); } catch (e) {}
    }

    // 5. Limpeza de Logs de Auditoria gerados pelas rotas durante a execução do teste
    if (initialLogIds.size > 0) {
      const allowedIds = Array.from(initialLogIds).map(id => `'${id.replace(/'/g, "''")}'`).join(", ");
      await db.execute(sql.raw(`DELETE FROM system_logs WHERE id NOT IN (${allowedIds})`));
    } else {
      await db.execute(sql`DELETE FROM system_logs WHERE id LIKE 'log-act-%' OR id LIKE 'log-admin-act-%' OR id LIKE 'log-redeem-%' OR id LIKE 'test-%'`);
    }

    // Limpeza de revogações e tokens gerados estritamente durante a suíte
    if (baseline.revoked_sessions_count === 0) {
      await db.execute(sql`DELETE FROM revoked_sessions`);
    } else {
      await db.execute(sql`DELETE FROM revoked_sessions WHERE id > ${initialMaxRevokedId}`);
    }

    if (baseline.reset_tokens_count === 0) {
      await db.execute(sql`DELETE FROM password_reset_tokens`);
    } else {
      await db.execute(sql`DELETE FROM password_reset_tokens WHERE id > ${initialMaxTokenId}`);
    }

    if (baseline.users_count === 0) {
      await db.execute(sql`DELETE FROM users`);
    }

    // 6. Verificação de Restauração Estrita do Baseline Inicial
    const finalCountsRes = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM users)::int as users_count,
        (SELECT count(*) FROM usuarios)::int as usuarios_count,
        (SELECT count(*) FROM service_orders)::int as service_orders_count,
        (SELECT count(*) FROM system_logs)::int as system_logs_count,
        (SELECT count(*) FROM revoked_sessions)::int as revoked_sessions_count,
        (SELECT count(*) FROM password_reset_tokens)::int as reset_tokens_count;
    `);
    const finalCounts = finalCountsRes[0] as any;
    console.log(`📊 Contagens finais do banco PostgreSQL após limpeza completa:`);
    console.log(`   users: ${finalCounts.users_count}, usuarios: ${finalCounts.usuarios_count}, service_orders: ${finalCounts.service_orders_count}, system_logs: ${finalCounts.system_logs_count}, revoked_sessions: ${finalCounts.revoked_sessions_count}, reset_tokens: ${finalCounts.reset_tokens_count}\n`);

    assert(
      Number(finalCounts.users_count) === Number(baseline.users_count) &&
      Number(finalCounts.usuarios_count) === Number(baseline.usuarios_count) &&
      Number(finalCounts.service_orders_count) === Number(baseline.service_orders_count) &&
      Number(finalCounts.system_logs_count) === Number(baseline.system_logs_count) &&
      Number(finalCounts.revoked_sessions_count) === Number(baseline.revoked_sessions_count) &&
      Number(finalCounts.reset_tokens_count) === Number(baseline.reset_tokens_count),
      "Isolamento e Limpeza de Testes: Zero dados órfãos residuais e contagens restauradas ao baseline",
      `users:${baseline.users_count}, usuarios:${baseline.usuarios_count}, orders:${baseline.service_orders_count}, logs:${baseline.system_logs_count}, revoked:${baseline.revoked_sessions_count}, tokens:${baseline.reset_tokens_count}`,
      `users:${finalCounts.users_count}, usuarios:${finalCounts.usuarios_count}, orders:${finalCounts.service_orders_count}, logs:${finalCounts.system_logs_count}, revoked:${finalCounts.revoked_sessions_count}, tokens:${finalCounts.reset_tokens_count}`
    );

    // Encerra servidor de teste
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("Servidor de testes encerrado com sucesso.");
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

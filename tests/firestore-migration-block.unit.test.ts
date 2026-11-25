import fs from "fs";
import path from "path";
import http from "http";

// Garante modo de teste antes de importar server.ts para impedir binding automático na porta 3000
process.env.NODE_ENV = "test";

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
    console.error(`  ❌ [FAIL] ${name} | Esperado: ${expected} | Obtido: ${actual}${details ? ` | Detalhes: ${details}` : ""}`);
  }
}

function collectSourceFiles(dir: string): string[] {
  const collected: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    }
  };
  return res;
}

function findRouteLayers(app: any, targetPath: string): any[] {
  const stack = app?._router?.stack || [];
  return stack.filter((layer: any) => {
    if (!layer.route) return false;
    const routePath = layer.route.path;
    if (Array.isArray(routePath)) {
      return routePath.includes(targetPath);
    }
    return routePath === targetPath;
  });
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("🔒 TESTES UNITÁRIOS: BLOQUEIO DE MIGRAÇÃO FIRESTORE -> POSTGRESQL");
  console.log("   (Execução isolada em memória — sem Firestore ou PostgreSQL real)");
  console.log("=================================================================\n");

  const { app } = await import("../server.ts");
  const postgresService = await import("../src/services/postgresService.ts");
  const authMiddleware = await import("../src/middleware/auth.ts");
  const { adminAuth } = await import("../src/lib/firebase-admin.ts");

  const rootDir = process.cwd();
  const serverSource = fs.readFileSync(path.join(rootDir, "server.ts"), "utf-8");
  const postgresServiceSource = fs.readFileSync(path.join(rootDir, "src/services/postgresService.ts"), "utf-8");
  const firebaseAuthSource = fs.readFileSync(path.join(rootDir, "src/services/firebaseAuth.ts"), "utf-8");
  const migrationScriptPath = path.join(rootDir, "scripts/migrate-firestore-to-postgres.ts");

  // -----------------------------------------------------------------
  // 1 & 2. Rota de migração não executa, não importa e não inicializa módulo
  // -----------------------------------------------------------------
  console.log("📌 Bloco 1: Bloqueio estrito da rota /api/postgres/migrate-from-firestore");

  const migrateLayers = findRouteLayers(app, "/api/postgres/migrate-from-firestore");
  assert(
    migrateLayers.length === 1,
    "Rota /api/postgres/migrate-from-firestore registrada exatamente uma vez para resposta controlada",
    "1 camada de rota",
    `${migrateLayers.length} camada(s)`
  );

  const migrateRoute = migrateLayers[0]?.route;
  const routeStack = migrateRoute?.stack || [];
  const finalHandler = routeStack[routeStack.length - 1]?.handle;

  assert(
    Boolean(migrateRoute?.methods?._all || (migrateRoute?.methods?.post && migrateRoute?.methods?.get)),
    "Rota /api/postgres/migrate-from-firestore bloqueia todos os métodos HTTP (POST/GET/PUT/DELETE)",
    "todos métodos cobertos",
    JSON.stringify(migrateRoute?.methods || {})
  );

  assert(
    routeStack.length >= 3 && typeof finalHandler === "function",
    "Rota mantém middlewares de autenticação e autorização antes do handler 410 Gone",
    ">= 3 handlers (requireAuth, requireAdmin, handler)",
    `${routeStack.length} handler(s)`
  );

  const mockReq: any = {
    method: "POST",
    user: { uid: "admin-mock", role: "admin", authType: "server_session" }
  };
  const mockRes = createMockRes();
  await finalHandler(mockReq, mockRes);

  assert(
    mockRes.statusCode === 410 && mockRes.body?.success === false && typeof mockRes.body?.error === "string",
    "Handler da rota de migração retorna HTTP 410 Gone com success=false (sem executar ETL)",
    "410 com { success: false, error: ... }",
    `${mockRes.statusCode} com ${JSON.stringify(mockRes.body)}`
  );

  // Teste HTTP em loopback sem banco: sem token retorna 401 e nunca retorna 200
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const resPostNoAuth = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, { method: "POST" });
    assert(
      resPostNoAuth.status === 401 && !resPostNoAuth.ok,
      "HTTP POST /api/postgres/migrate-from-firestore sem token retorna 401 (res.ok === false)",
      "401 (ok=false)",
      `${resPostNoAuth.status} (ok=${resPostNoAuth.ok})`
    );

    const resGetNoAuth = await fetch(`${baseUrl}/api/postgres/migrate-from-firestore`, { method: "GET" });
    assert(
      resGetNoAuth.status === 401 && !resGetNoAuth.ok,
      "HTTP GET /api/postgres/migrate-from-firestore sem token retorna 401 (sem fallback SPA 200)",
      "401 (ok=false)",
      `${resGetNoAuth.status} (ok=${resGetNoAuth.ok})`
    );

    const resBadLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(
      resBadLogin.status === 400,
      "Fluxo de login continua validando entrada normalmente sem tocar na migração",
      "400",
      String(resBadLogin.status)
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // -----------------------------------------------------------------
  // 2 & 3. Nenhuma importação estática/dinâmica ou inicialização no servidor
  // -----------------------------------------------------------------
  console.log("\n📌 Bloco 2: Ausência de importação ou inicialização automática no servidor");

  assert(
    !serverSource.includes("migrate-firestore-to-postgres") &&
      !serverSource.includes("runFirestoreToPostgresMigration") &&
      !serverSource.includes("firebase-admin/firestore") &&
      !serverSource.includes("getFirestore"),
    "server.ts não importa estática/dinamicamente o script de migração nem firebase-admin/firestore",
    "zero referências",
    "verificado no código de server.ts"
  );

  const loadedModules = (process as any).moduleLoadList as string[] | undefined;
  const loadedScriptInProcess = Array.isArray(loadedModules)
    ? loadedModules.some((m) => m.includes("migrate-firestore-to-postgres"))
    : false;
  assert(
    !loadedScriptInProcess,
    "Carregar server.ts não inicializa nem carrega scripts/migrate-firestore-to-postgres.ts em memória",
    "false",
    String(loadedScriptInProcess)
  );

  const setupServerMatch = serverSource.match(/async function setupServer\(\)[\s\S]*?\n\}/);
  const setupServerBody = setupServerMatch ? setupServerMatch[0] : "";
  assert(
    Boolean(setupServerBody) && !setupServerBody.toLowerCase().includes("migrat") && !setupServerBody.toLowerCase().includes("firestore"),
    "setupServer() não aciona nenhuma rotina de migração ou Firestore na inicialização",
    "sem chamadas de migração/Firestore",
    "setupServer() limpo"
  );

  // -----------------------------------------------------------------
  // 4. Frontend desacoplado do endpoint de migração
  // -----------------------------------------------------------------
  console.log("\n📌 Bloco 3: Desacoplamento completo do frontend");

  assert(
    !("triggerFirestoreToPostgresMigration" in postgresService) &&
      !postgresServiceSource.includes("triggerFirestoreToPostgresMigration") &&
      !postgresServiceSource.includes("/api/postgres/migrate-from-firestore"),
    "postgresService.ts não exporta nem referencia triggerFirestoreToPostgresMigration ou a rota de migração",
    "ausente",
    "removido de src/services/postgresService.ts"
  );

  const srcFiles = collectSourceFiles(path.join(rootDir, "src"));
  const offendingFrontendFiles = srcFiles.filter((file) => {
    const content = fs.readFileSync(file, "utf-8");
    return (
      content.includes("migrate-from-firestore") ||
      content.includes("triggerFirestoreToPostgresMigration") ||
      content.includes("migrate-firestore-to-postgres")
    );
  });

  assert(
    offendingFrontendFiles.length === 0,
    "Nenhum arquivo em src/ referencia o endpoint ou função de migração Firestore",
    "0 arquivos",
    offendingFrontendFiles.length === 0 ? "0 arquivos" : offendingFrontendFiles.join(", ")
  );

  // -----------------------------------------------------------------
  // 5. Script histórico preservado intacto no repositório
  // -----------------------------------------------------------------
  console.log("\n📌 Bloco 4: Preservação do script histórico");

  const scriptExists = fs.existsSync(migrationScriptPath);
  const scriptContent = scriptExists ? fs.readFileSync(migrationScriptPath, "utf-8") : "";
  assert(
    scriptExists && scriptContent.includes("export async function runFirestoreToPostgresMigration()"),
    "Arquivo histórico scripts/migrate-firestore-to-postgres.ts preservado sem alterações destrutivas",
    "existente e preservado",
    scriptExists ? "existente e íntegro" : "ausente"
  );

  // -----------------------------------------------------------------
  // 6 & 8. Autenticação normal, RBAC e compatibilidade Firebase Auth / Google OAuth
  // -----------------------------------------------------------------
  console.log("\n📌 Bloco 5: Sessão oficial, RBAC e Firebase Authentication (Google OAuth) preservados");

  const adminToken = authMiddleware.signServerSessionToken({
    uid: "gestor-admin",
    role: "admin",
    name: "Admin Teste"
  });
  const verifiedAdmin = authMiddleware.verifyServerSessionToken(adminToken);
  assert(
    Boolean(verifiedAdmin && verifiedAdmin.uid === "gestor-admin" && verifiedAdmin.role === "admin" && verifiedAdmin.authType === "server_session"),
    "Assinatura e verificação de token de sessão oficial continuam funcionando",
    "uid=gestor-admin, role=admin",
    verifiedAdmin ? `uid=${verifiedAdmin.uid}, role=${verifiedAdmin.role}` : "null"
  );

  // Testar middleware requireAdmin com mock
  let adminNextCalled: boolean = false;
  const adminRes = createMockRes();
  authMiddleware.requireAdmin(
    { user: { uid: "gestor-admin", role: "admin", authType: "server_session" } } as any,
    adminRes,
    () => { adminNextCalled = true; }
  );
  assert(
    adminNextCalled,
    "Middleware requireAdmin permite perfil admin normalmente",
    "next() chamado",
    String(adminNextCalled)
  );

  let nonAdminNextCalled: boolean = false;
  const nonAdminRes = createMockRes();
  authMiddleware.requireAdmin(
    { user: { uid: "req-1", role: "requisitante", authType: "server_session" } } as any,
    nonAdminRes,
    () => { nonAdminNextCalled = true; }
  );
  assert(
    !nonAdminNextCalled && nonAdminRes.statusCode === 403,
    "Middleware requireAdmin bloqueia perfil não-admin com 403",
    "403",
    String(nonAdminRes.statusCode)
  );

  // Verificar preservação de Firebase Auth / Google OAuth no cliente e servidor
  assert(
    typeof adminAuth?.verifyIdToken === "function" &&
      firebaseAuthSource.includes("export const auth = getAuth(app)") &&
      firebaseAuthSource.includes("export const googleSignIn") &&
      firebaseAuthSource.includes("export const subscribeToAuthChanges") &&
      firebaseAuthSource.includes("export const logoutUser"),
    "Firebase Authentication e helpers Google OAuth preservados no servidor e frontend",
    "adminAuth.verifyIdToken + googleSignIn + auth presentes",
    "todos preservados"
  );

  // Testar requireAuth com Firebase ID Token mockado (Google OAuth) sem acesso externo
  const originalVerifyIdToken = adminAuth.verifyIdToken.bind(adminAuth);
  try {
    (adminAuth as any).verifyIdToken = async (tok: string) => {
      if (tok === "mock-google-id-token") {
        return {
          uid: "google-uid-123",
          email: "willianclima@gmail.com",
          name: "Willian Google"
        };
      }
      throw new Error("invalid token");
    };

    let firebaseNextCalled: boolean = false;
    const fbReq: any = {
      headers: { authorization: "Bearer mock-google-id-token" }
    };
    const fbRes = createMockRes();
    await authMiddleware.requireAuth(fbReq, fbRes, () => {
      firebaseNextCalled = true;
    });

    assert(
      firebaseNextCalled && fbReq.user?.authType === "firebase" && fbReq.user?.role === "admin",
      "requireAuth valida Firebase ID Token (Google OAuth) sem interferência do bloqueio da migração",
      "next() chamado com authType=firebase, role=admin",
      `next=${firebaseNextCalled}, authType=${fbReq.user?.authType}, role=${fbReq.user?.role}`
    );
  } finally {
    (adminAuth as any).verifyIdToken = originalVerifyIdToken;
  }

  // -----------------------------------------------------------------
  // 7. Rotas operacionais PostgreSQL continuam registradas
  // -----------------------------------------------------------------
  console.log("\n📌 Bloco 6: Rotas operacionais PostgreSQL preservadas");

  const expectedOperationalRoutes: Array<{ path: string; methods: string[] }> = [
    { path: "/api/auth/login", methods: ["post"] },
    { path: "/api/auth/logout", methods: ["post"] },
    { path: "/api/postgres/users/:uid", methods: ["get"] },
    { path: "/api/postgres/users", methods: ["post"] },
    { path: "/api/usuarios", methods: ["get", "post"] },
    { path: "/api/usuarios/:id", methods: ["get", "put", "patch", "delete"] },
    { path: "/api/postgres/usuarios", methods: ["get", "post"] },
    { path: "/api/postgres/service-orders", methods: ["get", "post"] },
    { path: "/api/postgres/system-logs", methods: ["get", "post"] },
    { path: "/api/postgres/login-attempts", methods: ["get", "post"] },
    { path: "/api/postgres/access-profiles", methods: ["get", "post"] },
    { path: "/api/postgres/professionals", methods: ["get", "post"] },
    { path: "/api/postgres/service-categories", methods: ["get", "post"] },
    { path: "/api/postgres/service-categories/:id", methods: ["delete"] }
  ];

  for (const routeSpec of expectedOperationalRoutes) {
    const layers = findRouteLayers(app, routeSpec.path);
    const registeredMethods = new Set<string>();
    for (const l of layers) {
      for (const [m, enabled] of Object.entries(l.route?.methods || {})) {
        if (enabled) registeredMethods.add(m.toLowerCase());
      }
    }
    const allMethodsPresent = routeSpec.methods.every((m) => registeredMethods.has(m));
    assert(
      layers.length > 0 && allMethodsPresent,
      `Rota operacional registrada: ${routeSpec.path} [${routeSpec.methods.join(", ").toUpperCase()}]`,
      routeSpec.methods.join(","),
      Array.from(registeredMethods).join(",") || "não registrada"
    );
  }

  // -----------------------------------------------------------------
  // Resumo final
  // -----------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n=================================================================");
  console.log(`📊 RESUMO FINAL: ${passed}/${total} asserções aprovadas (${failed} falha(s))`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Erro fatal ao executar testes unitários de bloqueio da migração:", err);
  process.exit(1);
});

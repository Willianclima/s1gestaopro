import { spawn } from "child_process";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * ============================================================================
 * INICIALIZADOR DO DRIZZLE STUDIO (src/db/studio.ts)
 * ============================================================================
 * Este utilitário cria um processo filho (`child_process.spawn`) para executar a
 * interface gráfica do Drizzle Studio (`drizzle-kit studio`).
 *
 * Como Funciona:
 * 1. Lê as configurações do banco de dados em `src/db/drizzle.config.ts`.
 * 2. Inicia um servidor HTTP local na porta parametrizada (padrão: 4983).
 * 3. Disponibiliza uma interface web interativa no navegador para:
 *    - Inspecionar tabelas e colunas.
 *    - Filtrar, ordenar e buscar registros.
 *    - Inserir ou alterar dados diretamente via interface gráfica.
 */
export function startStudio(options?: { port?: number; host?: string }) {
  const port = options?.port || Number(process.env.DRIZZLE_STUDIO_PORT || 4983);
  const host = options?.host || process.env.DRIZZLE_STUDIO_HOST || "0.0.0.0";
  const configPath = path.resolve(process.cwd(), "src/db/drizzle.config.ts");

  console.log("🎨 Inicializando Drizzle Studio...");
  console.log(`📍 Arquivo de Configuração: ${configPath}`);
  console.log(`🌐 Endereço HTTP: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  console.log("📊 Tabelas Inspecionáveis no Schema PostgreSQL:");
  console.log("   - 👥 usuarios (Clientes e Requisitantes)");
  console.log("   - 🛠️ professionals (Corpo Técnico e Especialistas)");
  console.log("   - 📋 service_orders (Ordens de Serviço e Atendimentos)");
  console.log("   - 🛡️ system_logs (Trilha de Auditoria e Logs)");
  console.log("   - 🔐 users (Autenticação e Credenciais)");
  console.log("   - 🏷️ service_categories (Categorias de Atendimento)");
  console.log("   - 🔑 access_profiles & login_attempts (Perfis e Segurança)\n");

  const env = {
    ...process.env,
  };

  // Executa 'npx drizzle-kit studio' passando o arquivo de configuração e parâmetros de rede
  const studioProcess = spawn(
    "npx",
    ["drizzle-kit", "studio", `--config=${configPath}`, `--port=${port}`, `--host=${host}`],
    {
      stdio: "inherit",
      env,
      shell: true,
    }
  );

  studioProcess.on("error", (error) => {
    console.error("❌ Erro ao iniciar o Drizzle Studio:", error);
  });

  studioProcess.on("close", (code) => {
    if (code !== 0) {
      console.log(`⚠️ Drizzle Studio encerrado com código: ${code}`);
    } else {
      console.log("🔒 Drizzle Studio encerrado com sucesso.");
    }
  });

  return studioProcess;
}

// Executa diretamente se invocado via linha de comando (ex: npx tsx src/db/studio.ts ou npm run studio)
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/studio.ts");

if (isMainModule) {
  startStudio();
}


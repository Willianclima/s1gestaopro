import { spawn } from "child_process";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Script para inicializar e configurar o Drizzle Studio.
 * Permite a visualização gráfica e manipulação direta dos dados no banco PostgreSQL.
 */
export function startStudio(options?: { port?: number; host?: string }) {
  const port = options?.port || Number(process.env.DRIZZLE_STUDIO_PORT || 4983);
  const host = options?.host || process.env.DRIZZLE_STUDIO_HOST || "0.0.0.0";
  const configPath = path.resolve(process.cwd(), "src/db/drizzle.config.ts");

  console.log("🎨 Inicializando Drizzle Studio...");
  console.log(`📍 Configuração: ${configPath}`);
  console.log(`🌐 Host: ${host}:${port}`);

  const env = {
    ...process.env,
  };

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

// Executa diretamente se invocado via linha de comando (ex: npx tsx src/db/studio.ts)
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/studio.ts");

if (isMainModule) {
  startStudio();
}

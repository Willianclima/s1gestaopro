import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

import dns from "dns";
import { promisify } from "util";
import { URL } from "url";

const dnsLookup = promisify(dns.lookup);

// Proteção robusta contra SSRF (Server-Side Request Forgery)
async function validateUrlForSsrf(urlStr: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const parsed = new URL(urlStr);
    
    // 1. Apenas HTTPS seguro é permitido para conexões de gateway
    if (parsed.protocol !== "https:") {
      return { safe: false, reason: "Apenas conexões HTTPS seguras são permitidas." };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // 2. Bloqueio de hosts locais e de metadados de nuvem conhecidos
    const forbiddenHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"];
    if (forbiddenHosts.includes(hostname)) {
      return { safe: false, reason: "Acesso a endereços locais bloqueado por segurança (SSRF Prevention)." };
    }
    
    // 3. Regex para validação de faixas de IP privadas
    const privateIpRegex = /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/;
    if (privateIpRegex.test(hostname)) {
      return { safe: false, reason: "Acesso a redes privadas e subredes internas bloqueado por segurança (SSRF Prevention)." };
    }

    // 4. Resolve DNS e verifica IP resultante para prevenir DNS Rebinding e evasão por hosts customizados
    try {
      const { address } = await dnsLookup(hostname);
      if (forbiddenHosts.includes(address) || privateIpRegex.test(address)) {
        return { safe: false, reason: "O domínio informado resolve para uma faixa de IP local ou privada restrita." };
      }
    } catch {
      return { safe: false, reason: "Não foi possível resolver o domínio DNS informado." };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Formato de URL inválido." };
  }
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini client to prevent startup crash if GEMINI_API_KEY is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A variável de ambiente GEMINI_API_KEY não foi configurada. Configure-a no menu Configurações > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Cache local em memória para respostas do Gemini para otimizar tokens e tolerar picos de demanda
const geminiCache = new Map<string, { resultText: string; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutos de TTL
const MAX_CACHE_SIZE = 150;

function generateCacheKey(body: any): string {
  const { action, title, clientName, price, category, description, categoriesList, professionalsList, teamsList } = body;
  return JSON.stringify({
    action: action || "",
    title: title || "",
    clientName: clientName || "",
    price: price || "",
    category: category || "",
    description: description || "",
    categoriesList: categoriesList || [],
    professionalsList: professionalsList || [],
    teamsList: teamsList || []
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithRetry(ai: any, model: string, contents: string, maxAttempts = 4, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });
      return response;
    } catch (error: any) {
      attempt++;
      const errorMsg = error?.message || String(error);
      const isRetryable = 
        errorMsg.includes("503") || 
        errorMsg.includes("UNAVAILABLE") || 
        errorMsg.includes("high demand") || 
        errorMsg.includes("temporary") || 
        errorMsg.includes("429") || 
        errorMsg.includes("ResourceExhausted") ||
        errorMsg.includes("Overloaded") ||
        errorMsg.includes("rate limit") ||
        attempt < maxAttempts;
      
      if (!isRetryable || attempt >= maxAttempts) {
        throw error;
      }
      
      // Cálculo de backoff exponencial: initialDelayMs * 2^(attempt-1) + jitter aleatório
      const jitter = Math.random() * 200; // jitter para evitar que retentativas simultâneas congestionem o servidor
      const backoffDelay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[Gemini Retry] Tentativa ${attempt} falhou devido a alta demanda ou indisponibilidade temporária. Retentando em ${Math.round(backoffDelay)}ms... Erro: ${errorMsg}`);
      await delay(backoffDelay);
    }
  }
  throw new Error("Falha ao se comunicar com o serviço do Gemini após múltiplas tentativas.");
}

// API: AI Service Assistants
app.post("/api/gemini/assist", async (req, res) => {
  try {
    const { action, title, clientName, price, category, description, categoriesList, professionalsList, teamsList } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: "Parâmetro 'action' é obrigatório." });
    }

    // 1. Verificar Cache Local para otimização e mitigação de indisponibilidade
    const cacheKey = generateCacheKey(req.body);
    const cachedEntry = geminiCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL_MS)) {
      console.log(`[Gemini Cache] Hit! Retornando resposta em cache para a ação: "${action}"`);
      return res.json({ result: cachedEntry.resultText, cached: true });
    }

    const ai = getAiClient();
    let prompt = "";
    
    if (action === "draft_description") {
      prompt = `Aja como um especialista técnico altamente qualificado. Crie uma proposta técnica profissional, descrição de escopo e diagnóstico preliminar detalhado para o seguinte serviço:
      Título do Serviço: "${title}"
      Categoria: "${category || 'Geral'}"
      
      Retorne uma resposta em formato markdown bem estruturada contendo:
      1. **Diagnóstico Técnico Preliminar** (O que pode estar causando o problema)
      2. **Escopo do Serviço** (Lista de passos detalhados para execução segura do conserto ou serviço)
      3. **Peças/Ferramentas Comuns Necessárias**
      4. **Prazo Recomendado e Recomendações de Garantia** para o requisitante.
      Seja profissional, extremamente técnico e utilize português do Brasil impecável. Não canônico nem fictício, focado em situações reais de prestação de serviço.`;
    } 
    else if (action === "suggest_materials") {
      prompt = `Aja como um especialista em planejamento de serviços técnicos no Brasil.
      Para a requisição de serviço a seguir:
      Título do Serviço: "${title}"
      Categoria: "${category || 'Geral'}"
      
      Forneça as seguintes indicações técnicas em formato estruturado (com negritos e tópicos legíveis):
      1. **Especificação de Materiais Recomendados**: Liste as peças, componentes sobressalentes e consumíveis que o requisitante deve providenciar ou que o gestor deve adquirir.
      2. **Lista de Ferramentário Especializado**: Quais chaves, aparelhos de medição (ex: multímetro, aferidores) ou EPIs são obrigatórios para realizar o conserto.
      3. **Grau de Criticidade Operacional**: Nível de risco e dificuldade técnica do atendimento.
      4. **Prazo de Execução Estimado**: Tempo aproximado de duração para o técnico realizar a intervenção física no maquinário/equipamento.`;
    } 
    else if (action === "create_message") {
      prompt = `Aja como um assistente de atendimento ao cliente extremamente simpático, atencioso e profissional de uma empresa prestadora de serviços.
      Gere uma mensagem amigável e direta de conclusão de serviço para o WhatsApp do requisitante.
      Dados do Serviço:
      - Nome do Requisitante: "${clientName}"
      - Título do Serviço: "${title}"
      
      Regras da mensagem:
      1. Deve começar com um cumprimento amigável (ex: Olá, ${clientName}!)
      2. Deve informar com alegria que a requisição de serviço para "${title}" foi executada com sucesso pelo nosso técnico e está concluída.
      3. Perguntar se há alguma dúvida técnica em relação ao relatório do atendimento ou o laudo entregue pelo profissional.
      4. Concluir desejando um excelente dia e deixando o contato aberto para novas solicitações.
      5. Adicione emojis leves onde apropriado (como ✅, 🛠️, 📱, ✨), mas mantenha o tom profissional e sem poluir visualmente.
      Apenas retorne o texto da mensagem formatado pronto para copiar e enviar.`;
    } 
    else if (action === "triage_os") {
      prompt = `Você é o cerebro de IA de uma central inteligente de serviços técnicos.
      Sua missão é triar a nova ordem de serviço descrita abaixo e sugerir a melhor categoria, nível de prioridade estimado, um resumo descritivo técnico e o melhor profissional ou equipe de campo de acordo com suas especialidades e competências.

      DADOS DO CHAMADO:
      - Título: "${title}"
      - Sintomas / Descrição Inicial: "${description || 'Não detalhado'}"

      CATEGORIAS TÉCNICAS DISPONÍVEIS:
      ${JSON.stringify(categoriesList || [])}

      TÉCNICOS DISPONÍVEIS (Nome, Cargo, Especialidade):
      ${JSON.stringify(professionalsList || [])}

      EQUIPES DE CAMPO DISPONÍVEIS (Nome, Integrantes):
      ${JSON.stringify(teamsList || [])}

      INSTRUÇÕES DE PREENCHIMENTO:
      - Categoria Recomendada: Deve ser EXATAMENTE um dos nomes de categorias descritas acima na lista de categorias técnicas (Ex: se na lista tem "Elétrica", recomende "Elétrica", sensível a maiúsculas/minúsculas).
      - Prioridade: Escolha estritamente um valor textual entre: "Baixa", "Média", "Alta", "Crítica".
      - Escopo Técnico: Forneça um breve laudo preliminar e instruções sobre o que o técnico deve testar primeiro.
      - Alocação Recomendada: recomende o profissional técnico ou uma das equipes de campo recomendadas que mais se alinham ao problema técnico apresentado de acordo com as competências demonstradas na descrição do técnico. Se nenhum se adequar, recomende uma alocação plausível.
      - Justificativa da Escolha: Uma linha curta justificando o motivo de ter indicado essa alocação em especial.

      RETORNE EXCLUSIVAMENTE UM OBJETO JSON VÁLIDO. NÃO USE BACKTICKS OU BLOCOS DE MARKDOWN DE TIPO \`\`\`json. APENAS O JSON:
      {
        "recommendedCategory": "nome exato da categoria",
        "priority": "Baixa/Média/Alta/Crítica",
        "technicalScope": "breve guia do laudo técnico do problema e o que fazer",
        "recommendedAssignee": "Nome do técnico ou da equipe sugerida",
        "whyAssignee": "motivo de sua indicação"
      }`;
    }
    else if (action === "analyze_os_details") {
      prompt = `Você é um engenheiro de planejamento e alocação de serviços técnicos de campo de alta performance.
      Por favor, analise detalhadamente a Ordem de Serviço (OS) abaixo para sugerir automaticamente possíveis materiais necessários, ferramentas de precisão e a equipe ideal para o atendimento.

      DADOS DA ORDEM DE SERVIÇO:
      - Título da OS: "${title}"
      - Categoria Cadastrada: "${category || 'Geral'}"
      - Descrição do Problema: "${description || 'Não detalhado'}"

      Por favor, retorne uma resposta técnica formatada em markdown com as seguintes seções estruturadas:
      
      ### 📋 Diagnóstico Inicial IA
      Uma breve análise técnica em 2-3 linhas do que possivelmente está causando o problema relatado.

      ### 🛠️ Materiais & Peças Recomendadas
      Uma lista em tópicos dos materiais, insumos, peças de reposição e componentes necessários para realizar este atendimento específico.

      ### 🧰 Ferramentas & EPIs Necessários
      Quais equipamentos de proteção, ferramentas especializadas e aparelhos de medição (ex: multímetro, chaves específicas) o técnico/equipe deve levar.

      ### 👥 Tipo de Equipe & Especialidade Ideal
      Qual o perfil ideal do profissional ou equipe (ex: dupla de eletricistas, técnico sênior de TI, mecânico hidráulico) e justificativa técnica do porquê.
      
      Mantenha um tom profissional, extremamente técnico e prático, voltado para manutenção de campo e prestação de serviços no Brasil.`;
    }
    else {
      return res.status(400).json({ error: "Ação desconhecida ou inválida." });
    }

    const response = await generateContentWithRetry(ai, "gemini-2.5-flash", prompt);

    let resultText = response.text || "Erro ao gerar resposta com a IA. Tente novamente.";
    
    // Safety check and cleanup for JSON coding blocks if the model ignored our formatting rule
    if (action === "triage_os") {
      let cleanText = resultText.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      resultText = cleanText.trim();
    }

    // Salvar no cache local para otimização e resiliência a picos de carga
    if (geminiCache.size >= MAX_CACHE_SIZE) {
      const firstKey = geminiCache.keys().next().value;
      if (firstKey) {
        geminiCache.delete(firstKey);
      }
    }
    geminiCache.set(cacheKey, { resultText, timestamp: Date.now() });

    return res.json({ result: resultText, cached: false });
    
  } catch (error: any) {
    console.error("Gemini API error:", error);
    let userMsg = error?.message || "Ocorreu um erro interno no servidor ao falar com a IA.";
    if (typeof userMsg === "string" && (
      userMsg.includes("high demand") || 
      userMsg.includes("UNAVAILABLE") || 
      userMsg.includes("503") || 
      userMsg.includes("temporary")
    )) {
      userMsg = "O serviço de Inteligência Artificial do Gemini está sob alta demanda ou temporariamente indisponível. Por favor, tente clicar novamente no botão em alguns instantes.";
    }
    return res.status(500).json({ error: userMsg });
  }
});

// Proxy route for secure WhatsApp API calls (avoiding CORS and browser limits)
app.post("/api/whatsapp/proxy", async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "O parâmetro 'url' é obrigatório." });
    }

    // Validação contra SSRF
    const urlValidation = await validateUrlForSsrf(url);
    if (!urlValidation.safe) {
      console.warn(`[Proxy Securitas] Bloqueada requisição suspeita de SSRF para: ${url}. Motivo: ${urlValidation.reason}`);
      return res.status(403).json({
        ok: false,
        status: 403,
        error: `Requisição bloqueada por política de segurança: ${urlValidation.reason}`
      });
    }

    console.log(`[Proxy WhatsApp] Encaminhando chamada para ${url}`);
    
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "aistudio-build-proxy"
    };

    if (headers && typeof headers === "object") {
      for (const [key, val] of Object.entries(headers)) {
        if (typeof val === "string") {
          fetchHeaders[key] = val;
        }
      }
    }

    // Set request body appropriately
    let finalBody: any = body;
    if (body && typeof body === "object" && fetchHeaders["Content-Type"]?.includes("application/json")) {
      finalBody = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method: method || "POST",
      headers: fetchHeaders,
      body: finalBody
    });

    const responseText = await response.text();
    console.log(`[Proxy WhatsApp] Resposta com código HTTP ${response.status}`);

    // Return the response details structure to client
    return res.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseText
    });

  } catch (error: any) {
    console.error("Erro no proxy de envio de WhatsApp:", error);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: error.message || "Erro interno de rede ao tentar encaminhar requisição do WhatsApp"
    });
  }
});

// Configure Vite middleware in development or express static files in production
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando Vite em modo desenvolvimento...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Iniciando Express em modo produção...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Porta de entrada no ar: rodando no endereço http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Falha ao inicializar o servidor Express:", err);
});

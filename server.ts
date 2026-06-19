import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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

// API: AI Service Assistants
app.post("/api/gemini/assist", async (req, res) => {
  try {
    const { action, title, clientName, price, category, description, categoriesList, professionalsList, teamsList } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: "Parâmetro 'action' é obrigatório." });
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
    else {
      return res.status(400).json({ error: "Ação desconhecida ou inválida." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

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

    return res.json({ result: resultText });
    
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: error?.message || "Ocorreu um erro interno no servidor ao falar com a IA." });
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

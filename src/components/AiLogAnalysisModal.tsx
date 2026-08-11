import React, { useState, useEffect } from "react";
import { SystemLog, LoginAttempt } from "../types";
import { 
  Sparkles, ShieldCheck, AlertTriangle, X, Copy, Check, Download, Loader2, 
  Bot, FileText, RefreshCw, SlidersHorizontal, ShieldAlert, CheckCircle2, 
  Activity, Clock, Lock, Shield
} from "lucide-react";
import { getApiAuthHeaders } from "../services/apiAuth";
import { useToast } from "./ToastContext";

interface AiLogAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SystemLog[];
  loginAttempts: LoginAttempt[];
  initialScope?: "all" | "permissions" | "access";
  onAddSystemLog?: (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => void;
}

export default function AiLogAnalysisModal({
  isOpen,
  onClose,
  logs = [],
  loginAttempts = [],
  initialScope = "all",
  onAddSystemLog
}: AiLogAnalysisModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [scope, setScope] = useState<"all" | "permissions" | "access">(initialScope);
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
      setAnalysisResult("");
    }
  }, [isOpen, initialScope]);

  if (!isOpen) return null;

  // Filter logs according to scope and timeFilter
  const getFilteredData = () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let filteredLogs = [...logs];
    let filteredAccess = [...loginAttempts];

    // Time filter
    if (timeFilter !== "all") {
      const days = timeFilter === "24h" ? 1 : timeFilter === "7d" ? 7 : 30;
      const cutoff = now - (days * oneDay);

      filteredLogs = filteredLogs.filter(l => new Date(l.timestamp).getTime() >= cutoff);
      filteredAccess = filteredAccess.filter(a => new Date(a.timestamp).getTime() >= cutoff);
    }

    // Scope filter
    if (scope === "permissions") {
      filteredLogs = filteredLogs.filter(l => 
        l.category === "sistema" || 
        l.action.toLowerCase().includes("perfil") || 
        l.action.toLowerCase().includes("permiss") ||
        l.action.toLowerCase().includes("matriz") ||
        l.details.toLowerCase().includes("perfil") ||
        l.details.toLowerCase().includes("permiss")
      );
      filteredAccess = []; // only system permission logs
    } else if (scope === "access") {
      filteredLogs = filteredLogs.filter(l => l.category === "requisitante" || l.action.toLowerCase().includes("login") || l.action.toLowerCase().includes("senha"));
    }

    return { filteredLogs, filteredAccess };
  };

  const handleRunAnalysis = async () => {
    setLoading(true);
    setAnalysisResult("");
    setCached(false);

    const { filteredLogs, filteredAccess } = getFilteredData();

    if (filteredLogs.length === 0 && filteredAccess.length === 0) {
      setAnalysisResult("⚠️ Nenhum registro de SystemLog ou tentativa de acesso encontrado para os filtros selecionados.");
      setLoading(false);
      return;
    }

    try {
      const scopeLabel = 
        scope === "permissions" ? "Alterações em Perfis e Matriz de Permissões" :
        scope === "access" ? "Tentativas de Login e Autenticação" : "Todos os Registros (SystemLog + Acessos)";

      const timeLabel = 
        timeFilter === "24h" ? "Últimas 24 Horas" :
        timeFilter === "7d" ? "Últimos 7 Dias" :
        timeFilter === "30d" ? "Últimos 30 Dias" : "Período Completo";

      const body = {
        action: "analyze_system_logs",
        logsList: filteredLogs.slice(0, 150).map(l => ({
          timestamp: l.timestamp,
          action: l.action,
          details: l.details,
          category: l.category
        })),
        accessLogsList: filteredAccess.slice(0, 100).map(a => ({
          timestamp: a.timestamp,
          username: a.username,
          userId: a.userId,
          status: a.status,
          userType: a.userType,
          details: a.details
        })),
        timeWindow: `${scopeLabel} | ${timeLabel}`
      };

      const response = await fetch("/api/gemini/assist", {
        method: "POST",
        headers: getApiAuthHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let errText = "Erro na comunicação com o serviço de IA.";
        try {
          const errData = await response.json();
          if (errData.error) errText = errData.error;
        } catch (e) {}
        throw new Error(errText);
      }

      const data = await response.json();
      setAnalysisResult(data.result || "Nenhum resultado retornado.");
      setCached(!!data.cached);

      toastSuccess("Análise de anomalias e auditoria concluída com sucesso!", "Análise IA Concluída");

      if (onAddSystemLog) {
        onAddSystemLog(
          "Análise de Anomalias IA Executada",
          `O administrador executou uma auditoria automatizada por IA na trilha de logs (${filteredLogs.length} logs, ${filteredAccess.length} tentativas de acesso analisadas). Escopo: ${scopeLabel}.`,
          "sistema"
        );
      }

    } catch (err: any) {
      console.error("Erro na análise do SystemLog:", err);
      toastError(err?.message || "Ocorreu uma falha ao gerar o relatório de anomalias com a IA.", "Erro no Assistente IA");
      setAnalysisResult(`❌ **Falha ao processar análise**: ${err?.message || "Servidor indisponível"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    toastInfo("Relatório copiado para a área de transferência!", "Copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!analysisResult) return;
    const blob = new Blob([analysisResult], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_auditoria_systemlog_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastSuccess("Relatório de auditoria exportado em Markdown!", "Download Concluído");
  };

  const { filteredLogs, filteredAccess } = getFilteredData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold tracking-tight">Análise de Anomalias & Auditoria com IA</h3>
                <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Gemini 3.6
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Detecção inteligente de acessos incomuns, picos de alterações em perfis e comportamento do SystemLog.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Ribbon */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase px-2 text-slate-400 dark:text-slate-500">Escopo:</span>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  scope === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Todos ({logs.length + loginAttempts.length})
              </button>
              <button
                type="button"
                onClick={() => setScope("permissions")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  scope === "permissions"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Perfis & Permissões
              </button>
              <button
                type="button"
                onClick={() => setScope("access")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  scope === "access"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Autenticações ({loginAttempts.length})
              </button>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase px-2 text-slate-400 dark:text-slate-500">Período:</span>
              {(["all", "24h", "7d", "30d"] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeFilter(tf)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    timeFilter === tf
                      ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tf === "all" ? "Tudo" : tf === "24h" ? "24h" : tf === "7d" ? "7d" : "30d"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisando Trilha...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Analisar com IA</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Summary Banner of Data being sent */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-medium">
              <Activity className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Pronto para auditar <strong className="font-extrabold text-slate-900 dark:text-white">{filteredLogs.length}</strong> registros do SystemLog e <strong className="font-extrabold text-slate-900 dark:text-white">{filteredAccess.length}</strong> tentativas de login.
              </span>
            </div>

            {cached && (
              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                Cache Ativo
              </span>
            )}
          </div>

          {/* Loading State Skeleton */}
          {loading && (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-500 animate-bounce">
                <Bot className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800 dark:text-white">Processando Trilha de Auditoria via IA Gemini</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Correlacionando alterações em permissões, horários de acesso e registros do SystemLog para detectar desvios de segurança...
                </p>
              </div>
            </div>
          )}

          {/* Report Result Render */}
          {!loading && analysisResult && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Relatório Técnico de Auditoria</h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Exportar .md</span>
                  </button>
                </div>
              </div>

              {/* Formatted Markdown Box */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-200 text-xs font-sans leading-relaxed whitespace-pre-wrap font-medium max-h-[450px] overflow-y-auto">
                {analysisResult}
              </div>
            </div>
          )}

          {/* Default Empty State before running analysis */}
          {!loading && !analysisResult && (
            <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">Pronto para Iniciar o Diagnóstico Inteligente</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Clique no botão <strong>"Analisar com IA"</strong> acima para processar automaticamente os registros do SystemLog, detectar escaladas de privilégios e validar a conformidade dos acessos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full max-w-lg pt-2">
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Matriz de Permissões</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Identifica concedimentos atípicos ou remoções bruscas de privilégios.</p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Tentativas de Autenticação</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Analisa picos de erros de senha e tentativas em massa.</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Última atualização: {new Date().toLocaleTimeString("pt-BR")}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

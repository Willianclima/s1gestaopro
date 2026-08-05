import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useToast } from "./ToastContext";
import { ServiceOrder, Client, CurrentUser, Professional, SystemLog, Almoxarifado } from "../types";
import { playNotificationSound } from "../utils/notificationSound";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert,
  TrendingUp, X, Search, MapPin, User, Activity, Wrench, FileText, ChevronDown, ChevronUp, Printer, Download, Database, Server, Shield, Check, Calendar, Bell, BellOff
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import ServiceOrdersMap from "./ServiceOrdersMap";

interface DashboardProps {
  orders: ServiceOrder[];
  rawOrders?: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  currentUser?: CurrentUser | null;
  logs?: SystemLog[];
  onNavigate: (tab: "dashboard" | "clients" | "orders" | "scheduler" | "professionals" | "assistant" | "reports" | "bi") => void;
  onSelectOrder: (order: ServiceOrder) => void;
  onApproveClient?: (clientId: string, type: "gestor" | "requisitante" | "gestor_servicos" | "admin", warehouseId?: string, workLocation?: string) => void;
  onRejectClient?: (clientId: string) => void;
  onResetPassword?: (id: string, type: "client" | "professional") => void;
  almoxarifados?: Almoxarifado[];
  notificationPermission?: NotificationPermission;
  isInIframe?: boolean;
  onRequestNotificationPermission?: () => void;
}

export function getPriorityBadge(priority?: 'low' | 'medium' | 'high' | 'urgent') {
  const prio = priority || 'medium';
  const config = {
    low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Baixa', dot: 'bg-emerald-500' },
    medium: { bg: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Média', dot: 'bg-blue-500' },
    high: { bg: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Alta', dot: 'bg-amber-500' },
    urgent: { bg: 'bg-red-50 text-red-700 border-red-100', label: 'Urgente', dot: 'bg-red-500' },
  };
  const active = config[prio] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border uppercase tracking-wider ${active.bg}`}>
      <span className={`w-1 h-1 rounded-full ${active.dot}`}></span>
      {active.label}
    </span>
  );
}

// Auxiliar para calcular dias úteis (Segunda a Sexta) entre uma data de início e hoje
function getBusinessDaysBetweenDates(startDateStr: string, endDate: Date = new Date()): number {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;
  
  let count = 0;
  const current = new Date(start);
  
  current.setHours(0, 0, 0, 0);
  const endCompare = new Date(endDate);
  endCompare.setHours(0, 0, 0, 0);

  if (current > endCompare) return 0;

  while (current < endCompare) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 é Domingo, 6 é Sábado
      count++;
    }
  }
  return count;
}

// Verifica se um chamado está com status 'aberto' por mais de 5 dias úteis sem atualização
function isDelayedOpen(os: ServiceOrder): boolean {
  if (os.status !== "aberto") return false;
  
  let lastUpdateStr = os.createdAt;
  if (os.history && os.history.length > 0) {
    const dates = os.history.map(h => new Date(h.date).getTime()).filter(t => !isNaN(t));
    if (dates.length > 0) {
      const maxTime = Math.max(...dates);
      lastUpdateStr = new Date(maxTime).toISOString();
    }
  }
  
  const businessDays = getBusinessDaysBetweenDates(lastUpdateStr);
  return businessDays > 5;
}

// Estrutura e Função de Análise da Média Móvel de 30 Dias e Risco de Backlog / Pico de Manutenção
export interface BacklogAnalysisResult {
  hasSpikeOrBacklogAlert: boolean;
  alertType: 'none' | 'spike' | 'backlog' | 'critical_surge';
  movingAverageDaily: number;
  recentDailyAverage7d: number;
  ordersIn30DaysCount: number;
  recentOrders7dCount: number;
  activeBacklogCount: number;
  urgentHighBacklogCount: number;
  percentageChange: number;
  recommendation: string;
  summaryMessage: string;
  analyzedAt: string;
}

/**
 * Analisa as ordens de serviço dos últimos 30 dias para identificar picos operacionais
 * ou acúmulo de backlog com base na média móvel diária.
 */
export function analyze30DayMovingAverageAndBacklog(ordersList: ServiceOrder[]): BacklogAnalysisResult {
  if (!ordersList || ordersList.length === 0) {
    return {
      hasSpikeOrBacklogAlert: false,
      alertType: 'none',
      movingAverageDaily: 0,
      recentDailyAverage7d: 0,
      ordersIn30DaysCount: 0,
      recentOrders7dCount: 0,
      activeBacklogCount: 0,
      urgentHighBacklogCount: 0,
      percentageChange: 0,
      recommendation: "Nenhuma ordem de serviço cadastrada para análise de volume.",
      summaryMessage: "Sem dados suficientes de chamados para análise móvel.",
      analyzedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
  }

  // Determina a data de referência mais recente entre os chamados ou o momento atual
  let latestTimestamp = Date.now();
  const validDates = ordersList
    .map(o => new Date(o.createdAt || o.startDate).getTime())
    .filter(t => !isNaN(t));

  if (validDates.length > 0) {
    latestTimestamp = Math.max(...validDates);
  }

  const msIn30Days = 30 * 24 * 60 * 60 * 1000;
  const msIn7Days = 7 * 24 * 60 * 60 * 1000;

  const timestamp30DaysAgo = latestTimestamp - msIn30Days;
  const timestamp7DaysAgo = latestTimestamp - msIn7Days;

  // Filtragem dos chamados criados nos últimos 30 dias
  const orders30d = ordersList.filter(o => {
    const t = new Date(o.createdAt || o.startDate).getTime();
    return !isNaN(t) && t >= timestamp30DaysAgo;
  });

  // Filtragem dos chamados criados nos últimos 7 dias
  const orders7d = ordersList.filter(o => {
    const t = new Date(o.createdAt || o.startDate).getTime();
    return !isNaN(t) && t >= timestamp7DaysAgo;
  });

  // Chamados atualmente no backlog ativo ('aberto', 'em_progresso', 'aguardando')
  const activeBacklog = ordersList.filter(
    o => o.status === "aberto" || o.status === "em_progresso" || o.status === "aguardando"
  );

  const urgentHighBacklog = activeBacklog.filter(
    o => o.priority === "urgent" || o.priority === "high"
  );

  const movingAverageDaily = parseFloat((orders30d.length / 30).toFixed(2));
  const recentDailyAverage7d = parseFloat((orders7d.length / 7).toFixed(2));

  let percentageChange = 0;
  if (movingAverageDaily > 0) {
    percentageChange = Math.round(((recentDailyAverage7d - movingAverageDaily) / movingAverageDaily) * 100);
  } else if (recentDailyAverage7d > 0) {
    percentageChange = 100;
  }

  const isSpike = recentDailyAverage7d >= (movingAverageDaily * 1.25) && orders7d.length >= 3;
  const isBacklogSurge = activeBacklog.length >= Math.max(5, Math.ceil(movingAverageDaily * 7));
  const isCriticalUrgent = urgentHighBacklog.length >= 3;

  let alertType: 'none' | 'spike' | 'backlog' | 'critical_surge' = 'none';
  let hasSpikeOrBacklogAlert = false;

  if (isCriticalUrgent || (isSpike && isBacklogSurge)) {
    alertType = 'critical_surge';
    hasSpikeOrBacklogAlert = true;
  } else if (isSpike) {
    alertType = 'spike';
    hasSpikeOrBacklogAlert = true;
  } else if (isBacklogSurge) {
    alertType = 'backlog';
    hasSpikeOrBacklogAlert = true;
  }

  let summaryMessage = "";
  let recommendation = "";

  if (alertType === 'critical_surge') {
    summaryMessage = `ALERTA CRÍTICO DE SOBRECARGA: O volume recente de chamados (${recentDailyAverage7d} OS/dia nos últimos 7 dias) subiu ${percentageChange}% acima da média móvel histórica de 30 dias (${movingAverageDaily} OS/dia), resultando em ${activeBacklog.length} chamados no backlog (${urgentHighBacklog.length} urgentes/altos).`;
    recommendation = "Recomenda-se acionamento emergencial das equipes técnicas de plantão, redistribuição prioritária de rotas e acompanhamento junto aos gestores de área.";
  } else if (alertType === 'spike') {
    summaryMessage = `PICO DE MANUTENÇÃO DETECTADO: A média diária recente de chamados (${recentDailyAverage7d} OS/dia nos últimos 7 dias) está ${percentageChange}% acima da média móvel de 30 dias (${movingAverageDaily} OS/dia).`;
    recommendation = "Recomenda-se verificar a disponibilidade de insumos no almoxarifado e pré-alocar técnicos para evitar represamento nas fases de triagem e execução.";
  } else if (alertType === 'backlog') {
    summaryMessage = `ACÚMULO DE BACKLOG OPERACIONAL: O total de chamados ativos em aberto/progresso (${activeBacklog.length} OS) ultrapassou a capacidade diária estimada de vazão (equivalente a mais de 7 dias de carga média móvel).`;
    recommendation = "Recomenda-se realizar mutirão de encerramento das ordens de serviço pendentes de baixa e priorizar os chamados parados por falta de material.";
  } else {
    summaryMessage = `OPERAÇÃO ESTÁVEL: Volume diário recente (${recentDailyAverage7d} OS/dia) alinhado à média móvel de 30 dias (${movingAverageDaily} OS/dia). Backlog sob controle (${activeBacklog.length} OS ativas).`;
    recommendation = "Manter o ritmo operacional habitual de atendimento e triagem diária.";
  }

  return {
    hasSpikeOrBacklogAlert,
    alertType,
    movingAverageDaily,
    recentDailyAverage7d,
    ordersIn30DaysCount: orders30d.length,
    recentOrders7dCount: orders7d.length,
    activeBacklogCount: activeBacklog.length,
    urgentHighBacklogCount: urgentHighBacklog.length,
    percentageChange,
    recommendation,
    summaryMessage,
    analyzedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  };
}

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    {/* Metrics Cards Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} className="bg-white border border-slate-100 rounded-2xl p-4 h-24" />
      ))}
    </div>
    <div className="bg-white border border-slate-100 rounded-2xl p-6 h-64" />
  </div>
);

export default function Dashboard({ 
  orders, 
  rawOrders,
  clients, 
  professionals,
  currentUser, 
  onNavigate, 
  onSelectOrder,
  almoxarifados = [],
  notificationPermission,
  isInIframe,
  onRequestNotificationPermission
}: DashboardProps) {
  const { success: toastSuccess, info: toastInfo, system: toastSystem, warn: toastWarn, critical: toastCritical } = useToast();
  const [backlogAnalysis, setBacklogAnalysis] = useState<BacklogAnalysisResult | null>(null);
  const [showAnalysisCard, setShowAnalysisCard] = useState<boolean>(true);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [cacheValue, setCacheValue] = useState<any>(null);
  const [cacheKey, setCacheKey] = useState<string>("");

  /**
   * Função que analisa os últimos 30 dias de ordens de serviço para calcular a média móvel diária
   * e emitir notificações de nível de sistema em caso de picos de manutenção ou acúmulo de backlog.
   */
  const run30DayBacklogAnalysis = useCallback((isManual = false) => {
    const ordersToAnalyze = rawOrders && rawOrders.length > 0 ? rawOrders : (orders || []);
    const result = analyze30DayMovingAverageAndBacklog(ordersToAnalyze);
    setBacklogAnalysis(result);

    if (result.hasSpikeOrBacklogAlert || isManual) {
      setShowAnalysisCard(true);

      const sessionKey = `30d_backlog_notified_${result.alertType}_${result.activeBacklogCount}`;
      const alreadyNotified = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(sessionKey) : null;

      if (isManual || !alreadyNotified) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(sessionKey, "true");
        }

        if (result.alertType === "critical_surge") {
          toastCritical(result.summaryMessage, "⚠️ Alerta Crítico: Sobrecarga & Backlog de Manutenção");
        } else if (result.alertType === "spike") {
          toastWarn(result.summaryMessage, "📈 Pico de Manutenção Detectado");
        } else if (result.alertType === "backlog") {
          toastWarn(result.summaryMessage, "📦 Acúmulo de Backlog Operacional");
        } else if (isManual) {
          toastSuccess("Análise da média móvel dos últimos 30 dias concluída com sucesso. Operação dentro do fluxo esperado.", "Média Móvel Reanalisada");
        }

        // Executa sinal sonoro via Web Audio API
        playNotificationSound(result.hasSpikeOrBacklogAlert ? "alert" : "chime");

        // Emite notificação nativa do sistema via Browser HTML5 Notifications API
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(
              result.hasSpikeOrBacklogAlert
                ? "⚠️ Alerta de Sobrecarga de Manutenção - Securitas OS"
                : "📊 Análise de Média Móvel Concluída",
              {
                body: result.summaryMessage,
                tag: "30d-backlog-analysis"
              }
            );
          } catch (err) {
            console.error("Erro ao disparar notificação nativa do sistema:", err);
          }
        }
      }
    }
  }, [orders, rawOrders, toastCritical, toastWarn, toastSuccess]);

  useEffect(() => {
    if (orders && orders.length > 0) {
      run30DayBacklogAnalysis(false);
    }
  }, [orders, run30DayBacklogAnalysis]);

  const loadCaches = () => {
    if (!currentUser) return;
    let key = "";
    if (["admin", "gestor", "gestor_servicos"].includes(currentUser.userType)) {
      key = `service_mgt_seen_orders_${currentUser.id}`;
    } else if (currentUser.userType === "profissional") {
      key = `service_mgt_seen_assignments_${currentUser.id}`;
    } else if (currentUser.userType === "requisitante") {
      key = `service_mgt_seen_statuses_${currentUser.id}`;
    }
    setCacheKey(key);
    try {
      const val = localStorage.getItem(key);
      setCacheValue(val ? JSON.parse(val) : null);
    } catch (e) {
      setCacheValue(null);
    }
  };

  useEffect(() => {
    if (diagnosticOpen) {
      loadCaches();
    }
  }, [diagnosticOpen, currentUser]);
  
  const [metricModal, setMetricModal] = useState<{
    title: string;
    description: string;
    ordersList: ServiceOrder[];
  } | null>(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [techModal, setTechModal] = useState(false);
  const [techSearch, setTechSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getClientAddress = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.address : "Endereço não cadastrado";
  };

  const getClientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name : "Desconhecido";
  };

  // Counts
  const completedOrders = orders.filter(o => o.status === "concluido");
  const missingMaterialOrders = orders.filter(o => o.hasMissingMaterial || o.status === "aguardando");
  const cancelledOrders = orders.filter(o => o.status === "cancelado");
  const countPending = orders.filter(o => o.status === "aberto").length;
  const countRunning = orders.filter(o => o.status === "em_progresso").length;
  const pendingClients = clients.filter(c => c.status === "pendente_autorizacao");

  // Today's Date representation matching the mock environment: June 15, 2026
  const todayStr = "2026-06-15";
  const todaySchedule = orders.filter(os => os.startDate === todayStr || os.endDate === todayStr);

  // Volume de ordens de serviço por categoria para o gráfico
  const categoryData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const cat = o.category || "Outros";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    }));
  }, [orders]);

  // Volume de ordens de serviço por categoria agrupados por prioridade para o gráfico
  const priorityCategoryData = React.useMemo(() => {
    const counts: Record<string, { name: string; low: number; medium: number; high: number; urgent: number; total: number }> = {};
    orders.forEach(o => {
      const cat = o.category || "Outros";
      if (!counts[cat]) {
        counts[cat] = { name: cat, low: 0, medium: 0, high: 0, urgent: 0, total: 0 };
      }
      const prio = o.priority || "medium";
      if (prio === "low") counts[cat].low++;
      else if (prio === "medium") counts[cat].medium++;
      else if (prio === "high") counts[cat].high++;
      else if (prio === "urgent") counts[cat].urgent++;
      counts[cat].total++;
    });
    return Object.values(counts);
  }, [orders]);

  return (
    <div className="space-y-8">
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Welcome Banner */}
          <div className="bg-slate-900 rounded-3xl border border-slate-950/10 shadow-xl p-6 sm:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="z-10 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Painel de Triagem & Atividades</h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Resumo operacional em tempo real e visualização consolidada dos atendimentos agendados para hoje.
              </p>
            </div>

            <div className="z-10 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => run30DayBacklogAnalysis(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl border border-slate-700/80 shadow-md active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Executar análise da média móvel dos últimos 30 dias e verificar acúmulo de backlog"
              >
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Analisar Média Móvel (30d)
              </button>
              <button
                onClick={() => onNavigate("assistant")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-lg shadow-emerald-900/40 border border-emerald-500/30 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                IA Diagnósticos
              </button>
            </div>

            {/* Backdrop visual gradient effect */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-teal-500/10 to-transparent rounded-full pointer-events-none transform translate-x-20 -translate-y-20" />
          </div>

          {/* Painel / Alerta de Análise da Média Móvel de 30 Dias e Risco de Backlog */}
          {backlogAnalysis && showAnalysisCard && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl p-5 sm:p-6 text-slate-900 shadow-md border-2 transition-all text-left relative overflow-hidden ${
                backlogAnalysis.alertType === "critical_surge"
                  ? "bg-gradient-to-r from-red-500/15 via-red-500/10 to-amber-500/10 border-red-500/50"
                  : backlogAnalysis.alertType === "spike" || backlogAnalysis.alertType === "backlog"
                  ? "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/10 border-amber-500/50"
                  : "bg-slate-900 text-white border-slate-800"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 ${
                      backlogAnalysis.hasSpikeOrBacklogAlert
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}>
                      <Activity className="w-3 h-3" />
                      Análise de Média Móvel (30 Dias)
                    </span>

                    <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "bg-black/10 border border-black/10 text-slate-900" : "bg-white/10 border border-white/20 text-slate-200"
                    }`}>
                      Atualizado às {backlogAnalysis.analyzedAt}
                    </span>

                    {backlogAnalysis.percentageChange !== 0 && (
                      <span className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                        backlogAnalysis.percentageChange > 0
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}>
                        {backlogAnalysis.percentageChange > 0 ? "▲ +" : "▼ "}
                        {backlogAnalysis.percentageChange}% vs Média Histórica
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className={`font-extrabold text-base sm:text-lg tracking-tight ${
                      backlogAnalysis.hasSpikeOrBacklogAlert
                        ? "text-slate-900"
                        : "text-white"
                    }`}>
                      {backlogAnalysis.hasSpikeOrBacklogAlert
                        ? "⚠️ Alerta de Sistema: Pico de Volume ou Acúmulo de Backlog Detectado"
                        : "✅ Fluxo Operacional Dentro da Média Móvel Esperada"}
                    </h3>
                    <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "text-slate-800 font-medium" : "text-slate-300 font-normal"
                    }`}>
                      {backlogAnalysis.summaryMessage}
                    </p>
                  </div>

                  {/* Métricas dinâmicas da análise móvel */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className={`p-3 rounded-2xl border shadow-2xs ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "bg-white/70 border-slate-300/80 text-slate-900" : "bg-slate-800/80 border-slate-700/80 text-white"
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 block">Média Móvel 30d</span>
                      <span className="text-base font-black font-mono block">{backlogAnalysis.movingAverageDaily} OS/dia</span>
                      <span className="text-[9px] opacity-70 block">({backlogAnalysis.ordersIn30DaysCount} chamados nos últimos 30d)</span>
                    </div>

                    <div className={`p-3 rounded-2xl border shadow-2xs ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "bg-white/70 border-slate-300/80 text-slate-900" : "bg-slate-800/80 border-slate-700/80 text-white"
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 block">Média Recente 7d</span>
                      <span className="text-base font-black font-mono block">{backlogAnalysis.recentDailyAverage7d} OS/dia</span>
                      <span className="text-[9px] opacity-70 block">({backlogAnalysis.recentOrders7dCount} chamados nos últimos 7d)</span>
                    </div>

                    <div className={`p-3 rounded-2xl border shadow-2xs ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "bg-white/70 border-slate-300/80 text-slate-900" : "bg-slate-800/80 border-slate-700/80 text-white"
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 block">Backlog Ativo</span>
                      <span className="text-base font-black font-mono block">{backlogAnalysis.activeBacklogCount} Chamados</span>
                      <span className="text-[9px] opacity-70 block">({backlogAnalysis.urgentHighBacklogCount} com prioridade alta/urgente)</span>
                    </div>

                    <div className={`p-3 rounded-2xl border shadow-2xs ${
                      backlogAnalysis.hasSpikeOrBacklogAlert ? "bg-white/70 border-slate-300/80 text-slate-900" : "bg-slate-800/80 border-slate-700/80 text-white"
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 block">Recomendação</span>
                      <p className="text-[10px] font-bold line-clamp-2 leading-tight mt-0.5">
                        {backlogAnalysis.recommendation}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row lg:flex-col items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => run30DayBacklogAnalysis(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Reanalisar
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAnalysisCard(false)}
                    className="bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-bold text-xs py-3 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    title="Ocultar Painel de Análise"
                  >
                    <X className="w-4 h-4" />
                    Ocultar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notificação de Cadastros Pendentes de Aprovação */}
          {pendingClients.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-600/10 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 text-slate-900 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-md animate-pulse">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                      Notificação do Administrador
                    </span>
                    <span className="text-xs font-black text-amber-900 font-mono bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/50">
                      {pendingClients.length} {pendingClients.length === 1 ? 'usuário aguardando autorização' : 'usuários aguardando autorização'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Existem novos cadastros de requisitantes e solicitações de teste de 15 dias pendentes de aprovação.
                  </h3>
                  <p className="text-slate-700 text-xs leading-relaxed max-w-3xl font-medium">
                    Os usuários cadastrados por auto-serviço estão organizados na aba de <strong>Usuários</strong>. O Administrador do sistema deve analisar e conceder formalmente a permissão de acesso para que o login seja liberado.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate("clients")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-lg hover:shadow-xl active:translate-y-[1px] transition-all shrink-0 flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
              >
                Analisar e Aprovar Usuários
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* SECTION: QUICK OPERATIONAL RESUME */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-left">
              <span className="w-1.5 h-4.5 bg-indigo-600 rounded-full animate-pulse" />
              <h2 className="font-extrabold text-slate-850 text-xs tracking-widest uppercase">Resumo Operacional</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
              {/* Card 1: Total de OS Abertas */}
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço Abertas",
                  description: "Lista de todos os chamados abertos que aguardam triagem ou alocação inicial de equipe técnica.",
                  ordersList: orders.filter(o => o.status === "aberto")
                })}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 relative overflow-hidden flex items-center justify-between group hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">OS Abertas</span>
                  <span className="text-xl font-black text-slate-850 block">{countPending} Chamados</span>
                  <span className="text-[9px] text-slate-500 font-medium block truncate">Aguardando início</span>
                </div>
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-650 shrink-0 group-hover:scale-105 transition-transform duration-150 ml-2">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </motion.div>

              {/* Card 2: OS em Progresso */}
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço em Progresso",
                  description: "Lista de todos os chamados atualmente em atendimento ativo de campo ou na oficina.",
                  ordersList: orders.filter(o => o.status === "em_progresso")
                })}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 relative overflow-hidden flex items-center justify-between group hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Em Progresso</span>
                  <span className="text-xl font-black text-slate-850 block">{countRunning} Ativos</span>
                  <span className="text-[9px] text-slate-500 font-medium block truncate">Equipes em atendimento</span>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shrink-0 group-hover:scale-105 transition-transform duration-150 ml-2">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </motion.div>

              {/* Card 3: Falta de Material / Atrasos */}
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                onClick={() => setMetricModal({
                  title: "Atendimentos com Falta de Material (Parados)",
                  description: "Ordens de serviço pausadas ou paradas aguardando aquisição de componentes ou materiais no local.",
                  ordersList: missingMaterialOrders
                })}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 relative overflow-hidden flex items-center justify-between group hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">OS Paradas</span>
                  <span className="text-xl font-black text-amber-650 block">{missingMaterialOrders.length} Pendentes</span>
                  <span className="text-[9px] text-slate-500 font-medium block truncate">Falta de material</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0 group-hover:scale-105 transition-transform duration-150 ml-2">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </motion.div>

              {/* Card 4: OS Concluídas */}
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                onClick={() => setMetricModal({
                  title: "Atendimentos Concluídos",
                  description: "Histórico completo de ordens de serviço concluídas e finalizadas com sucesso no sistema.",
                  ordersList: completedOrders
                })}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 relative overflow-hidden flex items-center justify-between group hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Concluídas</span>
                  <span className="text-xl font-black text-emerald-600 block">{completedOrders.length} OS</span>
                  <span className="text-[9px] text-slate-500 font-medium block truncate">Sucesso / Finalizados</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shrink-0 group-hover:scale-105 transition-transform duration-150 ml-2">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </motion.div>

              {/* Card 5: OS Canceladas */}
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
                onClick={() => setMetricModal({
                  title: "Atendimentos Cancelados",
                  description: "Histórico completo de ordens de serviço que foram canceladas no sistema.",
                  ordersList: cancelledOrders
                })}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 relative overflow-hidden flex items-center justify-between group hover:border-rose-400 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Canceladas</span>
                  <span className="text-xl font-black text-rose-600 block">{cancelledOrders.length} OS</span>
                  <span className="text-[9px] text-slate-500 font-medium block truncate">Histórico de cancelamentos</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 shrink-0 group-hover:scale-105 transition-transform duration-150 ml-2">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* SECTION: MAPA GEOGRÁFICO DAS ORDENS DE SERVIÇO */}
          <ServiceOrdersMap
            orders={orders}
            clients={clients}
            onSelectOrder={onSelectOrder}
            onNavigate={onNavigate}
          />

          {/* SECTION: ATENDIMENTOS HOJE */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-650" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                  Agenda de Atendimentos de Hoje
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl">
                15 de Junho, 2026 (Segunda-feira)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySchedule.length > 0 ? (
                todaySchedule.map(os => {
                  const delayed = isDelayedOpen(os);
                  const prio = os.priority || 'medium';
                  const priorityStripeColor = 
                    prio === 'low' ? 'border-l-emerald-500' :
                    prio === 'high' ? 'border-l-amber-500' :
                    prio === 'urgent' ? 'border-l-red-500' :
                    'border-l-blue-500'; // medium
                  return (
                    <div 
                      key={os.id} 
                      className={`p-4 pl-3 rounded-2xl border border-l-4 ${priorityStripeColor} duration-150 text-xs transition-all flex flex-col justify-between h-44 cursor-pointer hover:shadow-xs ${
                        delayed 
                          ? "bg-red-50/40 border-red-250 hover:border-red-300" 
                          : "bg-slate-50/50 border-slate-200/40 hover:border-indigo-200"
                      }`}
                      onClick={() => onSelectOrder(os)}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                            #{os.id}
                          </span>
                          <div className="flex items-center gap-1">
                            {getPriorityBadge(os.priority)}
                            {delayed && (
                              <span className="bg-red-100 text-red-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse" title="Sem atualização há mais de 5 dias úteis!">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Atrasado
                              </span>
                            )}
                            <span className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              os.status === "concluido" ? "bg-green-150 text-green-800" :
                              os.status === "em_progresso" ? "bg-blue-150 text-blue-800" : 
                              os.status === "aguardando" ? "bg-amber-100 text-amber-850" : "bg-slate-200 text-slate-700"
                            }`}>
                              {os.status === "concluido" ? "Concluído" :
                               os.status === "em_progresso" ? "Em Execução" : 
                               os.status === "aguardando" ? "Falta de Material" : "Aberto"}
                            </span>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-slate-800 text-xs line-clamp-2">{os.title}</h4>
                      </div>

                      <div className="pt-3 border-t border-slate-200/50 space-y-1">
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          Requisitante: <strong className="text-slate-700 font-bold">{getClientName(os.clientId)}</strong>
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          Técnico: <strong className="text-indigo-650 font-bold">{os.assignedTo || "Triagem pendente"}</strong>
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-16 border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 bg-slate-50/20">
                  <CheckCircle className="w-10 h-10 text-slate-350 mx-auto mb-2 animate-bounce" />
                  <p className="font-bold text-sm text-slate-700">Tudo em dia! 🎉</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Não existem visitas ou atendimentos técnicos agendados para a data de hoje.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => onNavigate("scheduler")}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                Acessar Calendário Operacional de Campo
                <ArrowRight className="w-4 h-4 text-indigo-500" />
              </button>
            </div>
          </div>

          {/* SEÇÃO: GRÁFICO DE ORDENS DE SERVIÇO POR CATEGORIA */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <TrendingUp className="w-5 h-5 text-indigo-650" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                Volume de Ordens de Serviço por Categoria
              </h3>
            </div>

            {priorityCategoryData.length > 0 ? (
              <div className="h-96 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={priorityCategoryData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: 'none', 
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ fontSize: '11px' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={40}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11.5px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="low" name="Prioridade Baixa" stackId="a" fill="#10b981" />
                    <Bar dataKey="medium" name="Prioridade Média" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="high" name="Prioridade Alta" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="urgent" name="Prioridade Urgente" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 bg-slate-50/20">
                <ClipboardList className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                <p className="font-bold text-xs text-slate-600">Nenhum dado de categoria disponível</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Drill-down modal for Service Orders Metrics */}
      {metricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col text-slate-805"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-500/5 text-left">
              <div>
                <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-650" />
                  {metricModal.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{metricModal.description}</p>
              </div>
              <button 
                onClick={() => {
                  setMetricModal(null);
                  setMetricSearch("");
                }}
                className="p-1.5 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-850 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por descrição, requisitante ou responsável..."
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                  className="w-full text-xs text-slate-850 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-all bg-slate-50/50"
                />
              </div>
              {metricSearch && (
                <button 
                  onClick={() => setMetricSearch("")}
                  className="text-xs text-slate-550 hover:text-slate-800 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3.5 max-h-[60vh]">
              {(() => {
                const searchLow = metricSearch.toLowerCase().trim();
                const filtered = metricModal.ordersList.filter(o => {
                  if (!searchLow) return true;
                  const clientName = getClientName(o.clientId).toLowerCase();
                  const title = o.title.toLowerCase();
                  const desc = o.description.toLowerCase();
                  const assigned = o.assignedTo?.toLowerCase() || "";
                  const ostId = o.id.toLowerCase();
                  return title.includes(searchLow) || desc.includes(searchLow) || clientName.includes(searchLow) || assigned.includes(searchLow) || ostId.includes(searchLow);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                      <Clock className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                      <p className="font-semibold text-xs text-slate-505">Nenhum atendimento correspondente encontrado</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto text-left">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                          <th className="px-4 py-2.5">ID</th>
                          <th className="px-4 py-2.5">Título / Requisitante</th>
                          <th className="px-4 py-2.5">Categoria</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                          <th className="px-4 py-2.5">Profissional Técnico</th>
                          <th className="px-4 py-2.5 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {filtered.map(os => {
                          const delayed = isDelayedOpen(os);
                          return (
                            <tr key={os.id} className={`hover:bg-slate-50/50 transition-colors ${delayed ? "bg-red-50/15" : ""}`}>
                              <td className="px-4 py-3 font-mono text-slate-450 font-bold">{os.id}</td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5 max-w-[250px]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-slate-805 line-clamp-1">{os.title}</span>
                                    {delayed && (
                                      <span className="bg-red-100 text-red-700 text-[8.5px] font-black px-1.5 py-0.5 rounded border border-red-200/50 animate-pulse">Atrasado</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-normal flex items-center flex-wrap gap-2 mt-0.5">
                                    <span>{getClientName(os.clientId)}</span>
                                    <span className="text-slate-300">•</span>
                                    {getPriorityBadge(os.priority)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  {os.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                  os.status === "concluido" ? "bg-green-100 text-green-800" :
                                  os.status === "em_progresso" ? "bg-blue-100 text-blue-800" :
                                  os.status === "aguardando" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {os.status === "concluido" ? "Concluído" :
                                   os.status === "em_progresso" ? "Em Execução" :
                                   os.status === "aguardando" ? "Falta Material" : "Aberto"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-650">
                                {os.assignedTo || <span className="text-slate-400 italic font-normal">Não designado</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setMetricModal(null);
                                    setMetricSearch("");
                                    onSelectOrder(os);
                                  }}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-202 text-slate-500 transition-colors font-bold text-[10.5px]"
                                >
                                  Interagir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500 flex justify-between">
              <span>Total listados: {metricModal.ordersList.length} OS</span>
              <span className="text-indigo-650 font-bold">Resumo Técnico</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Drill-down modal for Technicians in the Field */}
      {techModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col text-slate-808"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-500/5 text-left">
              <div>
                <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Painel de Técnicos em Campo & Designações
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ocupação atual, workloads de campo e listagem de escalas em Araçatuba.
                </p>
              </div>
              <button 
                onClick={() => {
                  setTechModal(false);
                  setTechSearch("");
                }}
                className="p-1.5 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-850 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar técnico por nome, cargo ou especialidade..."
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  className="w-full text-xs text-slate-805 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 bg-slate-50/50"
                />
              </div>
              {techSearch && (
                <button 
                  onClick={() => setTechSearch("")}
                  className="text-xs text-slate-505 hover:text-slate-800 px-2 py-1 bg-slate-100 hover:bg-slate-202 rounded-lg font-bold"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 max-h-[60vh] bg-slate-50/30 text-left">
              {(() => {
                const searchLow = techSearch.toLowerCase().trim();
                const filteredTechs = (professionals || []).filter(p => {
                  if (!searchLow) return true;
                  return p.name.toLowerCase().includes(searchLow) || 
                         p.role.toLowerCase().includes(searchLow) || 
                         p.specialty.toLowerCase().includes(searchLow);
                });

                if (filteredTechs.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl bg-white">
                      <User className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                      <p className="font-semibold text-xs text-slate-550">Nenhum profissional técnico correspondente encontrado</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredTechs.map(p => {
                      const techActiveOrders = orders.filter(
                        o => o.assignedTo === p.name && o.status !== "concluido" && o.status !== "cancelado"
                      );
                      const isFieldActive = techActiveOrders.length > 0;

                      return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isFieldActive 
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                                  : "bg-slate-100 text-slate-505 border border-slate-202"
                              }`}>
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900">{p.name}</h4>
                                <p className="text-[10px] text-slate-505 font-medium">
                                  {p.role} • <span className="text-slate-400 font-semibold">{p.specialty}</span>
                                </p>
                              </div>
                            </div>

                            <div>
                              {isFieldActive ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  Em Campo ({techActiveOrders.length})
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full border border-slate-200/40">
                                  Disponível
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                              Ordens Ativas sob Designação:
                            </span>

                            {isFieldActive ? (
                              <div className="space-y-2">
                                {techActiveOrders.map(os => (
                                  <div key={os.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9.5px] font-mono bg-slate-200 text-slate-700 px-1.5 font-bold rounded">
                                          {os.id}
                                        </span>
                                        <span className="font-extrabold text-slate-800">{os.title}</span>
                                      </div>
                                      <p className="text-[10.5px] text-slate-505 font-medium">
                                        Requisitante: {getClientName(os.clientId)} • Local: {os.location || getClientAddress(os.clientId)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setTechModal(false);
                                        setTechSearch("");
                                        onSelectOrder(os);
                                      }}
                                      className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-[10.5px]"
                                    >
                                      Interagir com OS
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10.5px] italic text-slate-400 py-1 border border-dashed border-slate-200 rounded-xl px-3 bg-slate-50/50">
                                Técnico sem chamados designados no momento. Disponível na fila.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500 flex justify-between">
              <span>Profissionais listados: {professionals?.length || 0}</span>
              <span className="text-emerald-650 font-bold">Triagem Central</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

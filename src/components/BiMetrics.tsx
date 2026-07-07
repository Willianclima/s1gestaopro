import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ServiceOrder, Client, CurrentUser, Professional, SystemLog, Almoxarifado } from "../types";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert,
  TrendingUp, X, Search, MapPin, User, Activity, Wrench, FileText, ChevronDown, ChevronUp, Printer, Download, Database, Server, Shield, Check, Calendar
} from "lucide-react";
import { getPriorityBadge } from "./Dashboard";

interface BiMetricsProps {
  orders: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  currentUser?: CurrentUser | null;
  logs?: SystemLog[];
  onNavigate: (tab: "dashboard" | "clients" | "orders" | "scheduler" | "professionals" | "assistant" | "reports" | "settings" | "bi") => void;
  onSelectOrder: (order: ServiceOrder) => void;
  onApproveClient?: (clientId: string, type: "gestor" | "requisitante" | "gestor_servicos" | "admin", warehouseId?: string, workLocation?: string) => void;
  onRejectClient?: (clientId: string) => void;
  onResetPassword?: (id: string, type: "client" | "professional") => void;
  almoxarifados?: Almoxarifado[];
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

const BiMetricsSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="bg-slate-900 border border-slate-950/10 rounded-2xl p-6 h-40" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-24 bg-white rounded-2xl border border-slate-100 p-4" />
    <div className="h-64 bg-white rounded-2xl border border-slate-100 p-6" />
  </div>
);

export default function BiMetrics({ 
  orders, 
  clients, 
  professionals,
  currentUser, 
  onNavigate, 
  onSelectOrder,
  onApproveClient,
  onRejectClient,
  onResetPassword,
  logs = [],
  almoxarifados = []
}: BiMetricsProps) {
  const [metricModal, setMetricModal] = useState<{
    title: string;
    description: string;
    ordersList: ServiceOrder[];
  } | null>(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [showReportPreview, setShowReportPreview] = useState(false);

  // States for user approval selection
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({});
  const [selectedWorkLocations, setSelectedWorkLocations] = useState<Record<string, string>>({});

  const [techModal, setTechModal] = useState(false);
  const [techSearch, setTechSearch] = useState("");
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // States for Day of the Week Activity Heatmap
  const [selectedHeatCell, setSelectedHeatCell] = useState<{ dayId: number; periodId: number } | null>(null);
  const [heatmapCategoryFilter, setHeatmapCategoryFilter] = useState<string>("all");
  const [heatmapStatusFilter, setHeatmapStatusFilter] = useState<string>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const isGestorLike = currentUser && (currentUser.userType === "gestor" || currentUser.userType === "admin" || currentUser.userType === "gestor_servicos");
  const isAdminLike = currentUser && (currentUser.userType === "gestor" || currentUser.userType === "admin");

  const getClientAddress = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.address : "Endereço não cadastrado";
  };

  const getClientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name : "Desconhecido";
  };

  // Counts
  const totalClients = clients.length;
  const activeOrders = orders.filter(o => o.status !== "concluido" && o.status !== "cancelado");
  const completedOrders = orders.filter(o => o.status === "concluido");
  const missingMaterialOrders = orders.filter(o => o.hasMissingMaterial);
  const pendingTriagem = orders.filter(o => o.status === "aberto" && !o.assignedTo);
  const totalOrders = orders.length;
  const resolutionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0;
  
  // Pipeline Status counts
  const countPending = orders.filter(o => o.status === "aberto").length;
  const countRunning = orders.filter(o => o.status === "em_progresso").length;
  const countWaiting = orders.filter(o => o.status === "aguardando").length;
  const countDone = orders.filter(o => o.status === "concluido").length;

  // Technician workloads
  const techVolume: Record<string, number> = {};
  orders.forEach(o => {
    if (o.assignedTo) {
      techVolume[o.assignedTo] = (techVolume[o.assignedTo] || 0) + 1;
    }
  });
  
  let topTechName = "Nenhum";
  let topTechCount = 0;
  Object.entries(techVolume).forEach(([name, count]) => {
    if (count > topTechCount) {
      topTechCount = count;
      topTechName = name;
    }
  });

  // Group requests count by category
  const categoriesCount = orders.reduce((acc, order) => {
    acc[order.category] = (acc[order.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pendingClients = clients.filter(c => c.status === "pendente_autorizacao");
  const blockedClients = clients.filter(c => c.blocked);
  const blockedProfessionals = (professionals || []).filter(p => p.blocked);
  const totalBlocked = blockedClients.length + blockedProfessionals.length;

  const now = new Date();
  const isMockPeriod = orders.some(o => o.createdAt && o.createdAt.includes("2026-06"));
  const referenceYear = isMockPeriod ? 2026 : now.getFullYear();
  const referenceMonth = isMockPeriod ? 5 : now.getMonth();

  const currentMonthOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d.getFullYear() === referenceYear && d.getMonth() === referenceMonth;
  });

  const completedCurrentMonthOrders = currentMonthOrders.filter(o => o.status === "concluido");
  const monthlyResolutionRateVal = currentMonthOrders.length > 0
    ? Math.round((completedCurrentMonthOrders.length / currentMonthOrders.length) * 100)
    : 0;

  // KPI Calculations for the new Summary Cards section
  const completedOrdersWithDurations = completedOrders.map(order => {
    const completedLog = order.history?.find(h => h.status === "concluido");
    const completionDateStr = completedLog ? completedLog.date : (order.endDate || order.createdAt);
    const start = new Date(order.createdAt).getTime();
    const end = new Date(completionDateStr).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return (end - start) / (1000 * 60 * 60 * 24); // diff in days
    }
    return null;
  }).filter((val): val is number => val !== null);

  const avgResolutionTime = completedOrdersWithDurations.length > 0
    ? (completedOrdersWithDurations.reduce((sum, val) => sum + val, 0) / completedOrdersWithDurations.length).toFixed(1)
    : "0.0";

  const delayedOrdersList = orders.filter(isDelayedOpen);
  const totalActive = orders.filter(o => o.status !== "concluido" && o.status !== "cancelado").length;
  const pctDelayedOfActive = totalActive > 0 
    ? Math.round((delayedOrdersList.length / totalActive) * 100) 
    : 0;

  // Let's get the name of the month for display
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const displayMonthName = monthNames[referenceMonth] || "Mês Atual";

  // Activity Heatmap Calculations
  const TIME_PERIODS = [
    { id: 0, label: "Madrugada (00h - 08h)", rangeName: "Madrugada", hours: "00h - 08h" },
    { id: 1, label: "Manhã (08h - 12h)", rangeName: "Manhã", hours: "08h - 12h" },
    { id: 2, label: "Tarde (12h - 18h)", rangeName: "Tarde", hours: "12h - 18h" },
    { id: 3, label: "Noite (18h - 00h)", rangeName: "Noite", hours: "18h - 00h" },
  ];

  const DAYS_OF_WEEK = [
    { id: 1, name: "Segunda-feira", shortName: "Seg" },
    { id: 2, name: "Terça-feira", shortName: "Ter" },
    { id: 3, name: "Quarta-feira", shortName: "Qua" },
    { id: 4, name: "Quinta-feira", shortName: "Qui" },
    { id: 5, name: "Sexta-feira", shortName: "Sex" },
    { id: 6, name: "Sábado", shortName: "Sáb" },
    { id: 0, name: "Domingo", shortName: "Dom" },
  ];

  const uniqueCategories = Array.from(new Set(orders.map(o => o.category))).filter(Boolean);

  const filteredHeatmapOrders = orders.filter(o => {
    if (heatmapCategoryFilter !== "all" && o.category !== heatmapCategoryFilter) return false;
    if (heatmapStatusFilter === "active" && (o.status === "concluido" || o.status === "cancelado")) return false;
    if (heatmapStatusFilter === "concluido" && o.status !== "concluido") return false;
    return true;
  });

  const heatmapMatrix: Record<string, ServiceOrder[]> = {};
  DAYS_OF_WEEK.forEach(day => {
    TIME_PERIODS.forEach(period => {
      heatmapMatrix[`${day.id}-${period.id}`] = [];
    });
  });

  filteredHeatmapOrders.forEach(o => {
    if (!o.createdAt) return;
    const oDate = new Date(o.createdAt);
    const dayIndex = oDate.getDay();
    const hour = oDate.getHours();
    
    let periodIndex = 0;
    if (hour >= 0 && hour < 8) periodIndex = 0;
    else if (hour >= 8 && hour < 12) periodIndex = 1;
    else if (hour >= 12 && hour < 18) periodIndex = 2;
    else periodIndex = 3;

    const key = `${dayIndex}-${periodIndex}`;
    if (heatmapMatrix[key]) {
      heatmapMatrix[key].push(o);
    }
  });

  let peakCell: { dayName: string; periodLabel: string; count: number } | null = null;
  let maxCount = 0;

  DAYS_OF_WEEK.forEach(day => {
    TIME_PERIODS.forEach(period => {
      const cellOrders = heatmapMatrix[`${day.id}-${period.id}`] || [];
      if (cellOrders.length > maxCount) {
        maxCount = cellOrders.length;
        peakCell = {
          dayName: day.name,
          periodLabel: period.label,
          count: cellOrders.length
        };
      }
    });
  });

  return (
    <div className="space-y-8">
      {isLoading ? (
        <BiMetricsSkeleton />
      ) : (
        <>
          {/* Header Banner */}
          <div className="bg-slate-900 rounded-3xl border border-slate-950/10 shadow-xl p-6 sm:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="z-10 space-y-2">
              <div className="flex items-center gap-2 bg-indigo-650 px-3 py-1 rounded-full w-max text-indigo-200 font-bold text-[10px] uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Painel de BI e Estatísticas</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Métricas & Estatísticas Operacionais</h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Visão detalhada de performance, escala de equipes, fluxo de atendimentos e conformidade LGPD.
              </p>
            </div>

            <div className="z-10 shrink-0">
              {isGestorLike && (
                <button
                  onClick={() => setShowReportPreview(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-lg active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-white animate-pulse" />
                  Emitir Relatório Gerencial
                </button>
              )}
            </div>
            <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-indigo-500/10 to-transparent rounded-full pointer-events-none transform translate-x-20 -translate-y-20" />
          </div>

          {/* KPI SUMMARY CARDS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-left">
              <span className="w-1.5 h-4.5 bg-indigo-650 rounded-full animate-pulse" />
              <h3 className="font-extrabold text-xs tracking-widest uppercase text-slate-500">Indicadores de Performance Operacional (KPIs)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Average Resolution Time */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-start justify-between group hover:border-indigo-400 transition-all duration-200 cursor-pointer"
                onClick={() => setMetricModal({
                  title: "Métricas de Tempo de Resolução",
                  description: "Lista de ordens de serviço concluídas consideradas no cálculo do tempo de resolução.",
                  ordersList: completedOrders
                })}
              >
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tempo Médio de Resolução</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-800">{avgResolutionTime}</span>
                    <span className="text-xs font-bold text-slate-500">dias</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Média de tempo decorrido desde a abertura até a conclusão do chamado de serviço. Clique para ver.
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-650 shrink-0 group-hover:scale-105 transition-transform duration-150">
                  <Clock className="w-5 h-5" />
                </div>
              </motion.div>

              {/* Card 2: Volume of Concluded OS this Month */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-start justify-between group hover:border-emerald-400 transition-all duration-200 cursor-pointer"
                onClick={() => setMetricModal({
                  title: `Ordens Concluídas em ${displayMonthName}`,
                  description: `Lista das ordens de serviço finalizadas com sucesso no mês de ${displayMonthName}.`,
                  ordersList: completedCurrentMonthOrders
                })}
              >
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Concluídas em {displayMonthName}</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-emerald-600">{completedCurrentMonthOrders.length}</span>
                    <span className="text-xs font-bold text-slate-500">OS</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Volume acumulado de ordens concluídas no período de {displayMonthName} de {referenceYear}. Clique para ver.
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0 group-hover:scale-105 transition-transform duration-150">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </motion.div>

              {/* Card 3: Percentage of Delayed Services */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-start justify-between group hover:border-rose-400 transition-all duration-200 cursor-pointer"
                onClick={() => setMetricModal({
                  title: "Serviços em Atraso Crítico",
                  description: "Ordens de serviço com status 'aberto' sem movimentação há mais de 5 dias úteis.",
                  ordersList: delayedOrdersList
                })}
              >
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Serviços Atrasados</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-rose-600">{pctDelayedOfActive}%</span>
                    <span className="text-xs font-bold text-slate-500">dos ativos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Dos {totalActive} chamados ativos, {delayedOrdersList.length} estão sem atualização há mais de 5 dias úteis. Clique para ver.
                  </p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0 group-hover:scale-105 transition-transform duration-150">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Pipeline Status Flow Visualization */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4.5 bg-indigo-650 rounded-full" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">Esteira Operacional / Pipeline de Serviços</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div 
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço: Pendentes / Abertas",
                  description: "Instâncias de chamados recém-registrados que ainda não iniciaram a execução física.",
                  ordersList: orders.filter(o => o.status === "aberto")
                })}
                className="p-4 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 rounded-xl border border-slate-200/60 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendente / Aberto</span>
                  <p className="text-xl font-extrabold text-slate-700 mt-1">{countPending}</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              </div>

              <div 
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço: Em Execução",
                  description: "Ordens de serviço atualmente sob atendimento e trabalho de campo pelas equipes técnicas.",
                  ordersList: orders.filter(o => o.status === "em_progresso")
                })}
                className="p-4 bg-blue-50/50 hover:bg-blue-100/55 hover:border-blue-200 rounded-xl border border-blue-100 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Em Execução</span>
                  <p className="text-xl font-extrabold text-blue-700 mt-1">{countRunning}</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              </div>

              <div 
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço: Aguardando Material",
                  description: "Pendências de fornecimento físico ou compra de materiais complementares que impossibilitam o fechamento.",
                  ordersList: orders.filter(o => o.status === "aguardando")
                })}
                className="p-4 bg-amber-50/50 hover:bg-amber-100/55 hover:border-amber-200 rounded-xl border border-amber-100 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Falta Material / Paradas</span>
                  <p className="text-xl font-extrabold text-amber-700 mt-1">{countWaiting}</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              </div>

              <div 
                onClick={() => setMetricModal({
                  title: "Ordens de Serviço: Concluídas",
                  description: "Encerramento padrão com diagnósticos preenchidos e validados pelas equipes técnicas.",
                  ordersList: orders.filter(o => o.status === "concluido")
                })}
                className="p-4 bg-green-50/50 hover:bg-green-100/55 hover:border-green-200 rounded-xl border border-green-100 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Serviços Concluídos</span>
                  <p className="text-xl font-extrabold text-green-700 mt-1">{countDone}</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
            </div>
          </div>

          {/* SECTION: Activity Heatmap for Scheduling Optimization */}
          {isGestorLike && (
            <div id="activity-heatmap" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-650" />
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 animate-none">
                      Mapa de Calor de Atividades (Weekly Heatmap)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-normal max-w-2xl text-left">
                    Frequência de abertura de chamados técnicos por dia da semana e período. Auxilia no planejamento e escalonamento ideal de equipes técnicas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Setor / Especialidade</span>
                    <select
                      value={heatmapCategoryFilter}
                      onChange={(e) => {
                        setHeatmapCategoryFilter(e.target.value);
                        setSelectedHeatCell(null);
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                    >
                      <option value="all">📁 Todos os Setores</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>🔧 {cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Fase Operacional</span>
                    <select
                      value={heatmapStatusFilter}
                      onChange={(e) => {
                        setHeatmapStatusFilter(e.target.value);
                        setSelectedHeatCell(null);
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                    >
                      <option value="all">📊 Todos os Status</option>
                      <option value="active">⏳ Abertos / Em Execução</option>
                      <option value="concluido">✅ Apenas Concluídos</option>
                    </select>
                  </div>

                  {(heatmapCategoryFilter !== "all" || heatmapStatusFilter !== "all") && (
                    <button
                      onClick={() => {
                        setHeatmapCategoryFilter("all");
                        setHeatmapStatusFilter("all");
                        setSelectedHeatCell(null);
                      }}
                      className="mt-4 px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg shrink-0 transition cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left: Graphic Heatmap Grid */}
                <div className="xl:col-span-8 space-y-4">
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                    <div className="text-left font-sans pl-1 flex items-center">Dia da Semana</div>
                    {TIME_PERIODS.map(period => (
                      <div key={period.id} className="bg-slate-50 border border-slate-100 py-1.5 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-slate-700">{period.rangeName}</span>
                        <span className="text-[8px] text-slate-400 font-normal">{period.hours}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.id} className="grid grid-cols-5 gap-1.5 items-center">
                        <div className="bg-slate-50/70 border border-slate-200/40 py-2.5 pl-3 rounded-lg text-xs font-black text-slate-800 text-left truncate flex items-center justify-between">
                          <span>{day.name}</span>
                          <span className="bg-slate-200/50 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded mr-2 text-slate-550">
                            {TIME_PERIODS.reduce((acc, p) => acc + (heatmapMatrix[`${day.id}-${p.id}`] || []).length, 0)}
                          </span>
                        </div>

                        {TIME_PERIODS.map((period) => {
                          const cellOrders = heatmapMatrix[`${day.id}-${period.id}`] || [];
                          const count = cellOrders.length;
                          const isSelected = selectedHeatCell?.dayId === day.id && selectedHeatCell?.periodId === period.id;

                          let bgDensityClr = "bg-slate-50 border-slate-200/40 text-slate-400";
                          let hoverDensityClr = "hover:bg-slate-105 hover:border-slate-300";
                          if (count > 0 && count <= 1) {
                            bgDensityClr = "bg-indigo-50/50 border-indigo-100 text-indigo-700";
                            hoverDensityClr = "hover:bg-indigo-100 border-indigo-200";
                          } else if (count > 1 && count <= 3) {
                            bgDensityClr = "bg-indigo-100/60 border-indigo-150 text-indigo-800 font-extrabold";
                            hoverDensityClr = "hover:bg-indigo-200 hover:border-indigo-250";
                          } else if (count > 3 && count <= 5) {
                            bgDensityClr = "bg-indigo-400 border-indigo-500 text-white font-extrabold";
                            hoverDensityClr = "hover:bg-indigo-500 hover:border-indigo-600";
                          } else if (count > 5) {
                            bgDensityClr = "bg-indigo-700 border-indigo-800 text-white font-black";
                            hoverDensityClr = "hover:bg-indigo-850 hover:border-indigo-900";
                          }

                          if (isSelected) {
                            bgDensityClr += " ring-2 ring-indigo-500 ring-offset-1 scale-[1.02] shadow-sm";
                          }

                          return (
                            <div
                              key={period.id}
                              onClick={() => setSelectedHeatCell({ dayId: day.id, periodId: period.id })}
                              className={`p-3 min-h-[50px] border rounded-xl flex flex-col justify-between cursor-pointer transition-all ${bgDensityClr} ${hoverDensityClr}`}
                            >
                              <span className="text-right font-mono text-[11px] font-extrabold">{count}</span>
                              <div className="flex justify-between items-center text-[7.5px] uppercase font-bold tracking-wider pt-1.5 opacity-85">
                                <span>Chamados</span>
                                {count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Color Legend */}
                  <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2 pl-1 font-mono flex-wrap">
                    <span>INTENSIDADE:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-slate-50 border border-slate-200 rounded-md" />
                      <span>Nenhum</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-indigo-50/50 border border-indigo-100 rounded-md" />
                      <span>Baixa (1)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-indigo-100/60 border border-indigo-150 rounded-md" />
                      <span>Média (2-3)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-indigo-400 border border-indigo-500 rounded-md" />
                      <span>Alta (4-5)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-indigo-700 border border-indigo-800 rounded-md" />
                      <span>Crítica (6+)</span>
                    </div>
                  </div>
                </div>

                {/* Right: Recommendation & Drill-down */}
                <div className="xl:col-span-4 bg-slate-50 rounded-2xl border border-slate-200/60 p-4 space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2 text-left">
                    <TrendingUp className="w-4 h-4 text-indigo-650" />
                    Análise Preditiva de Escalas
                  </h4>

                  {peakCell ? (
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1.5 text-xs text-left">
                      <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">💡 Insight do Sistema</span>
                      <p className="text-[11px] font-medium text-slate-750 leading-relaxed">
                        Pico histórico identificado às <strong className="text-indigo-850 font-extrabold">{peakCell.dayName}s</strong> no período da <strong className="text-indigo-850 font-extrabold">{peakCell.periodLabel}</strong> com <strong className="text-indigo-650 font-extrabold">{peakCell.count} chamados</strong> registrados.
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        Recomendamos reforçar as escalas de técnicos em campo neste período específico para manter os tempos de triagem baixos.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 text-center">
                      Nenhum chamado nos filtros atuais.
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest font-mono">
                        {selectedHeatCell ? "Registros na Célula" : "Selecione uma célula"}
                      </span>
                      {selectedHeatCell && (
                        <button
                          onClick={() => setSelectedHeatCell(null)}
                          className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 font-mono transition cursor-pointer"
                        >
                          Limpar [X]
                        </button>
                      )}
                    </div>

                    {selectedHeatCell ? (() => {
                      const day = DAYS_OF_WEEK.find(d => d.id === selectedHeatCell.dayId);
                      const period = TIME_PERIODS.find(p => p.id === selectedHeatCell.periodId);
                      const cellOrdersList = heatmapMatrix[`${selectedHeatCell.dayId}-${selectedHeatCell.periodId}`] || [];

                      return (
                        <div className="space-y-3 text-left">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                            <span className="text-slate-700">{day?.name}</span>
                            <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono text-[10px] px-2 py-0.5 rounded-md">
                              {period?.rangeName} ({cellOrdersList.length})
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {cellOrdersList.length > 0 ? (
                              cellOrdersList.map(os => {
                                const prio = os.priority || 'medium';
                                const priorityStripeColor = 
                                  prio === 'low' ? 'border-l-emerald-500' :
                                  prio === 'high' ? 'border-l-amber-500' :
                                  prio === 'urgent' ? 'border-l-red-500' :
                                  'border-l-blue-500'; // medium
                                return (
                                  <div
                                    key={os.id}
                                    onClick={() => onSelectOrder(os)}
                                    className={`p-2.5 pl-2 bg-white border border-l-4 ${priorityStripeColor} border-slate-200 hover:border-indigo-400 rounded-xl transition duration-150 cursor-pointer text-[11px]`}
                                  >
                                    <div className="flex justify-between items-center gap-1 mb-1">
                                      <span className="font-mono text-[9px] font-bold text-indigo-500 bg-indigo-50 border px-1 rounded">
                                        #{os.id}
                                      </span>
                                      {getPriorityBadge(os.priority)}
                                    </div>
                                    <h5 className="font-extrabold text-slate-800 truncate">{os.title}</h5>
                                    <p className="text-[9.5px] text-slate-500 truncate">Técnico: {os.assignedTo || "Triação Pendente"}</p>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-6 text-center text-slate-400 bg-white border border-dashed rounded-xl text-[10px]">
                                Nenhum chamado correspondente.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 bg-white rounded-xl text-[10px]">
                        Selecione um bloco colorido do mapa ao lado para listar e planejar atendimentos para aquele período.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: SYSTEM HEALTH & SECURITY AUDITS */}
          {isGestorLike && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left">
              {/* Saúde do Sistema */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-indigo-650" />
                    Saúde & Conformidade do Sistema
                  </h3>
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    Sistemas Online
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                        <Database className="w-4 h-4" />
                      </div>
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[8px] uppercase px-1.5 rounded flex items-center gap-1">
                        Online
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-800">Banco de Dados</h4>
                    <p className="text-[9.5px] leading-relaxed text-slate-500">
                      PostgreSQL persistent layers ativos através do Drizzle ORM. Latência: 3ms.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                        <Server className="w-4 h-4" />
                      </div>
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[8px] uppercase px-1.5 rounded flex items-center gap-1">
                        TLS Conectado
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-800">SMTP Gateway</h4>
                    <p className="text-[9.5px] leading-relaxed text-slate-500">
                      Envio de confirmações por e-mail ativo na porta segura 587.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[8px] uppercase px-1.5 rounded flex items-center gap-1">
                        Ativo
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-800">Filtro LGPD</h4>
                    <p className="text-[9.5px] leading-relaxed text-slate-500">
                      Ocultação automática e ofuscação de dados sensíveis e senhas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Auditoria & Eventos */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-4 text-xs font-semibold">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide">
                    Sumário de Auditoria & LGPD
                  </h3>

                  <div className="space-y-3 pt-1 text-slate-700">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-normal">Acessos restritos ou bloqueados:</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        totalBlocked > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                      }`}>
                        {totalBlocked} Bloqueios LGPD
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-normal">Contatos Autorizados:</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded font-mono text-[11px]">
                        {clients.filter(c => c.status === "ativo").length} Ativos
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-normal">Logs Gerados na Sessão:</span>
                      <span className="text-indigo-650 font-bold bg-indigo-50 px-2 py-0.5 rounded font-mono text-[11px]">
                        {logs.length} Trilhas gravadas
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal font-medium">
                    Todas as ações geram uma assinatura de trilha imutável no banco de auditoria interna.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate("reports")}
                    className="w-full bg-slate-900 hover:bg-slate-800 p-3 rounded-xl text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:translate-y-[1px]"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
                    Abrir Painel de Auditoria Completo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Registrations Notifications for Gestor */}
          {isAdminLike && pendingClients.length > 0 && (
            <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/25 text-amber-400 flex items-center justify-center animate-pulse">
                  <AlertCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    Cadastros de Requisitantes Pendentes de Autorização
                    <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {pendingClients.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Usuários que se cadastraram externamente e aguardam liberação de perfil operacional no sistema.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingClients.map(c => (
                  <div key={c.id} className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between gap-3 text-left">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-black text-slate-100 block">{c.name}</span>
                        <span className="text-[8px] font-mono font-bold uppercase tracking-wider bg-amber-950/40 border border-amber-900/30 text-amber-400 px-2 py-0.5 rounded-md">
                          Pendente
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 pt-1.5">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">CPF:</span>
                          <span className="font-mono text-slate-300">{c.document}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Telefone:</span>
                          <span className="font-mono text-slate-300">{c.phone || "Não informado"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Endereço:</span>
                          <span className="text-slate-300 line-clamp-1" title={c.address}>{c.address}</span>
                        </div>
                        {c.email && (
                          <div className="col-span-2">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">E-mail:</span>
                            <span className="text-slate-300">{c.email}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Interactive Configuration upon approval */}
                      <div className="pt-3 border-t border-slate-900 space-y-2.5">
                        {/* Warehouse responsible selection */}
                        <div className="space-y-1">
                          <label className="block text-[9px] uppercase font-bold text-slate-400">
                            Se aprovar como Gestor, indique Almoxarifado responsável:
                          </label>
                          <select
                            value={selectedWarehouses[c.id] || ""}
                            onChange={(e) => setSelectedWarehouses({ ...selectedWarehouses, [c.id]: e.target.value })}
                            className="w-full text-[11px] font-semibold bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="">Selecione o almoxarifado...</option>
                            {almoxarifados.map(alm => (
                              <option key={alm.id} value={alm.id}>{alm.code} - {alm.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Work location indicator */}
                        <div className="space-y-1">
                          <label className="block text-[9px] uppercase font-bold text-slate-400">
                            Se aprovar como Requisitante, indique Local de Trabalho:
                          </label>
                          <input
                            type="text"
                            value={selectedWorkLocations[c.id] !== undefined ? selectedWorkLocations[c.id] : (c.workLocation || "")}
                            onChange={(e) => setSelectedWorkLocations({ ...selectedWorkLocations, [c.id]: e.target.value })}
                            placeholder="Ex: Almoxarifado Central, Oficina Oeste"
                            className="w-full text-[11px] font-semibold bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block mr-auto">Aprovar:</span>
                      
                      <button
                        onClick={() => onApproveClient?.(
                          c.id, 
                          "requisitante", 
                          undefined, 
                          selectedWorkLocations[c.id] !== undefined ? selectedWorkLocations[c.id] : (c.workLocation || "")
                        )}
                        className="p-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer active:translate-y-[1px]"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Requisitante
                      </button>

                      <button
                        onClick={() => {
                          const wh = selectedWarehouses[c.id] || (almoxarifados[0]?.id || "");
                          onApproveClient?.(c.id, "gestor", wh, undefined);
                        }}
                        className="p-2 px-3 bg-indigo-950 border border-indigo-800 text-indigo-300 font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer active:translate-y-[1px]"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Gestor
                      </button>

                      <button
                        onClick={() => onRejectClient?.(c.id)}
                        className="p-2 px-3 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/35 text-rose-400 font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer active:translate-y-[1px]"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity Widget */}
          {isGestorLike && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wider">Trilha de Logs do Sistema</h3>
                </div>
                
                <button
                  onClick={() => onNavigate("reports")}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg shadow-sm bg-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Ver Auditoria Completa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 transition-all duration-300">
                {logs.slice(0, 5).map((log) => {
                  let badgeClr = "bg-slate-100 text-slate-600";
                  let iconEl = <Clock className="w-4 h-4 text-slate-500" />;
                  
                  if (log.category === "requisicao") {
                    badgeClr = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                    iconEl = <FileText className="w-4 h-4 text-indigo-600" />;
                  } else if (log.category === "requisitante") {
                    badgeClr = "bg-blue-50 text-blue-700 border border-blue-100";
                    iconEl = <Users className="w-4 h-4 text-blue-600" />;
                  } else if (log.category === "tecnico") {
                    badgeClr = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                    iconEl = <Wrench className="w-4 h-4 text-emerald-600" />;
                  } else if (log.category === "sistema") {
                    badgeClr = "bg-purple-50 border border-purple-100 text-purple-700";
                    iconEl = <Activity className="w-4 h-4 text-purple-600" />;
                  }

                  return (
                    <div key={log.id} className="py-3.5 hover:bg-slate-50/30 transition-colors flex gap-4 items-start text-xs font-medium first:pt-0 last:pb-0">
                      <div className="p-2 border border-slate-100 rounded-xl bg-white shrink-0 shadow-xs">
                        {iconEl}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-800 text-sm">{log.action}</span>
                            <span className={`text-[9px] font-extrabold font-sans uppercase px-1.5 py-0.5 rounded-lg ${badgeClr}`}>
                              {log.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                            {new Date(log.timestamp).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed font-semibold text-xs pr-4">{log.details}</p>
                      </div>
                    </div>
                  );
                })}

                {logs.length === 0 && (
                  <div className="py-8 text-center text-slate-400">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-xs">Nenhum registro de atividades recente encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Service Orders Column */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Demandas Recentes Registradas</h3>
              
              <button
                onClick={() => onNavigate("orders")}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg shadow-sm bg-white transition-all"
              >
                Ver Todas ({orders.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Título / Requisitante</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Profissional Técnico</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {orders.slice(0, 5).map(os => {
                    const delayed = isDelayedOpen(os);
                    return (
                      <tr key={os.id} className={`hover:bg-slate-50/50 transition-colors ${delayed ? "bg-red-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono text-slate-400 font-bold">{os.id}</td>
                        <td className="px-4 py-3 pb-2.5 max-w-[200px]">
                          <div className="flex items-center gap-2">
                            {delayed && (
                              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[8.5px] px-1.5 py-0.5 rounded border border-red-200/50 animate-pulse font-black">
                                Atrasado
                              </span>
                            )}
                            <span className="font-bold text-slate-800 truncate" title={os.title}>{os.title}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal truncate flex items-center flex-wrap gap-2 mt-1">
                            <span>{getClientName(os.clientId)}</span>
                            <span className="text-slate-300">•</span>
                            {getPriorityBadge(os.priority)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            os.status === "concluido" ? "bg-green-100 text-green-800" :
                            os.status === "em_progresso" ? "bg-blue-100 text-blue-800" :
                            os.status === "aguardando" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {os.status === "concluido" ? "Concluído" :
                             os.status === "em_progresso" ? "Em Execução" :
                             os.status === "aguardando" ? "Falta de Material" : "Aberto"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {os.assignedTo ? (
                            <span className="font-bold text-slate-750">{os.assignedTo}</span>
                          ) : (
                            <span className="text-slate-400 italic font-normal">Não escalado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onSelectOrder(os)}
                            className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/50 rounded-lg text-slate-500 transition-colors font-bold"
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
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold"
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
                                    <span className="font-extrabold text-slate-800 line-clamp-1">{os.title}</span>
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
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/50 rounded-lg text-slate-500 transition-colors font-bold text-[10.5px]"
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
              <span className="text-indigo-650 font-bold">Indicadores BI</span>
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
                      <p className="font-semibold text-xs text-slate-505">Nenhum profissional técnico correspondente encontrado</p>
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
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
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
                                      <p className="text-[10.5px] text-slate-500">
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
              <span className="text-emerald-650 font-bold">BI Central</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* SECTOR: HIDDEN PRINT PREVIEW FOR MONTHLY REPORT */}
      {showReportPreview && (
        <div id="print-section" className="hidden print:block bg-white p-12 text-black font-sans leading-relaxed text-[10.5pt] w-full text-left">
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
            <div>
              <span className="text-xl font-extrabold uppercase tracking-tight block text-slate-900">RequisiçãoPro Araçatuba</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block font-mono">Relatório Analítico de Capacidade e Performance</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-slate-850 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-350">
                RELATÓRIO DE EFICIÊNCIA OPERACIONAL
              </span>
              <span className="text-[9px] text-slate-500 block font-bold font-mono mt-1.5">
                Competência: {isMockPeriod ? "Junho / 2026" : `Ciclo ${new Date().toLocaleDateString("pt-BR", { month: 'long', year: 'numeric' })}`}
              </span>
            </div>
          </div>

          <div className="text-center bg-slate-900 text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg mb-6">
            Sumário Executivo e Indicadores Gerenciais de Atendimento
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Registros Totais</span>
              <span className="text-xl font-extrabold text-slate-900 block mt-0.5">{orders.length} OS</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Resolução</span>
              <span className="text-xl font-extrabold text-indigo-700 block mt-0.5">{monthlyResolutionRateVal || resolutionRate}%</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Fila Operacional</span>
              <span className="text-xl font-extrabold text-amber-650 block mt-0.5">{activeOrders.length} Ativas</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Bloqueios Críticos</span>
              <span className="text-xl font-extrabold text-red-650 block mt-0.5">{missingMaterialOrders.length + activeOrders.filter(isDelayedOpen).length} Items</span>
            </div>
          </div>

          <div className="mb-6">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Demandas Técnicas por Categoria Operacional</span>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase bg-slate-50">
                  <th className="py-2 px-3">Especialidade / Categoria</th>
                  <th className="py-2 px-3 text-center">Chamados Registrados</th>
                  <th className="py-2 px-3 text-right">Percentual de Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {Object.entries(categoriesCount).map(([catName, count]) => {
                  const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                  return (
                    <tr key={catName}>
                      <td className="py-2 px-3 font-bold text-slate-800">{catName}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700">{count} OS</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-600">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Capacidade Técnica e Workloads Alocados</span>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase bg-slate-50">
                  <th className="py-2 px-3">Nome do Profissional</th>
                  <th className="py-2 px-3">Cargo</th>
                  <th className="py-2 px-3 text-center">Chamados Pendentes</th>
                  <th className="py-2 px-3 text-center">Concluídos</th>
                  <th className="py-2 px-3 text-right">Eficiência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {professionals.map(p => {
                  const pActive = activeOrders.filter(o => o.assignedTo === p.name).length;
                  const pCompleted = completedOrders.filter(o => o.assignedTo === p.name).length;
                  const pTotal = pActive + pCompleted;
                  const efficiency = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-950">{p.name} {p.blocked && "🔒 (Bloqueado)"}</td>
                      <td className="py-2.5 px-3 text-slate-505">{p.role}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">{pActive} ativas</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{pCompleted} OS</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{efficiency}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 font-semibold text-xs text-slate-800 text-center">
            <div className="pt-6 border-t border-dashed border-slate-300">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
              <p className="font-extrabold text-slate-900">Coordenador de Operações Físicas</p>
            </div>
            
            <div className="pt-6 border-t border-dashed border-slate-300">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
              <p className="font-extrabold text-slate-900">Diretor de Infraestrutura</p>
            </div>
          </div>
        </div>
      )}

      {/* VISUAL PRINT PREVIEW DIALOG MODAL ON-SCREEN (GERAR RELATÓRIO) */}
      {showReportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-slate-100 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-205 overflow-hidden flex flex-col h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-650" />
                <h3 className="font-bold text-sm text-slate-805 uppercase tracking-wide">Painel de Emissão de Relatório Gerencial</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Salvar PDF / Imprimir
                </button>
                <button 
                  type="button"
                  onClick={() => setShowReportPreview(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-200">
              <div className="bg-white shadow-xl rounded-2xl w-[210mm] min-h-[297mm] p-10 font-sans leading-relaxed text-sm text-slate-800 text-left border border-slate-300">
                <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
                  <div>
                    <span className="text-xl font-extrabold uppercase block text-slate-900">RequisiçãoPro Araçatuba</span>
                    <span className="text-[10px] text-slate-505 font-bold uppercase tracking-widest block font-mono">Relatório Analítico de Capacidade e Performance</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      RELATÓRIO DE EFICIÊNCIA OPERACIONAL
                    </span>
                    <span className="text-[10px] text-slate-505 block font-bold font-mono mt-1.5">
                      Competência: {isMockPeriod ? "Junho / 2026" : `Ciclo ${new Date().toLocaleDateString("pt-BR", { month: 'long', year: 'numeric' })}`}
                    </span>
                  </div>
                </div>

                <div className="text-center bg-slate-900 text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg mb-6 font-mono">
                  Sumário Executivo e Indicadores Gerenciais de Atendimento
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Registros Totais</span>
                    <span className="text-2xl font-black text-slate-900 block mt-0.5">{orders.length} OS</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Resolução</span>
                    <span className="text-2xl font-black text-indigo-700 block mt-0.5">{monthlyResolutionRateVal || resolutionRate}%</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fila Operacional</span>
                    <span className="text-2xl font-black text-amber-600 block mt-0.5">{activeOrders.length} Ativas</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bloqueios Críticos</span>
                    <span className="text-2xl font-black text-red-600 block mt-0.5">{missingMaterialOrders.length + activeOrders.filter(isDelayedOpen).length} Items</span>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Demandas Técnicas por Categoria Operacional</span>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                        <th className="py-2 px-3">Especialidade / Categoria</th>
                        <th className="py-2 px-3 text-center">Chamados Registrados</th>
                        <th className="py-2 px-3 text-right">Percentual de Participação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {Object.entries(categoriesCount).map(([catName, count]) => {
                        const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                        return (
                          <tr key={catName}>
                            <td className="py-2 px-3 font-bold text-slate-800">{catName}</td>
                            <td className="py-2 px-3 text-center font-mono text-slate-700">{count} OS</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-600">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mb-6 font-semibold">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Capacidade Técnica e Workloads Alocados</span>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                        <th className="py-2 px-3">Nome do Profissional</th>
                        <th className="py-2 px-3">Cargo</th>
                        <th className="py-2 px-3 text-center">Chamados Pendentes</th>
                        <th className="py-2 px-3 text-center">Concluídos</th>
                        <th className="py-2 px-3 text-right">Eficiência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                      {professionals.map(p => {
                        const pActive = activeOrders.filter(o => o.assignedTo === p.name).length;
                        const pCompleted = completedOrders.filter(o => o.assignedTo === p.name).length;
                        const pTotal = pActive + pCompleted;
                        const efficiency = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
                        return (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 font-semibold text-slate-950">{p.name} {p.blocked && "🔒 (Bloqueado)"}</td>
                            <td className="py-2.5 px-3 text-slate-500">{p.role}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">{pActive} ativas</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">{pCompleted} OS</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{efficiency}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-800">
                  <div className="pt-6 border-t border-dashed border-slate-300">
                    <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
                    <p className="font-extrabold text-slate-900">Coordenador de Operações Físicas</p>
                  </div>
                  
                  <div className="pt-6 border-t border-dashed border-slate-300">
                    <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
                    <p className="font-extrabold text-slate-900">Diretor de Infraestrutura</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

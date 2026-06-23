import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ServiceOrder, Client, CurrentUser, Professional, SystemLog } from "../types";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert,
  TrendingUp, X, Search, MapPin, User, Activity, Wrench, FileText, ChevronDown, ChevronUp, Printer, Download, Database, Server, Shield, Check, Calendar
} from "lucide-react";

interface DashboardProps {
  orders: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  currentUser?: CurrentUser | null;
  logs?: SystemLog[];
  onNavigate: (tab: "dashboard" | "clients" | "orders" | "scheduler" | "professionals" | "assistant" | "reports") => void;
  onSelectOrder: (order: ServiceOrder) => void;
  onApproveClient?: (clientId: string, type: "gestor" | "requisitante") => void;
  onRejectClient?: (clientId: string) => void;
  onResetPassword?: (id: string, type: "client" | "professional") => void;
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

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    {/* Metrics Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[1, 2, 3].map(n => (
        <div key={n} className="bg-slate-900 border border-slate-950/10 rounded-2xl p-5 h-40 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-3 bg-slate-800 rounded w-24" />
            <div className="h-6 bg-slate-700/60 rounded w-48" />
            <div className="h-3 bg-slate-800/40 rounded w-40" />
          </div>
          <div className="h-4 bg-slate-800 rounded w-full" />
        </div>
      ))}
    </div>

    {/* Schedule & Recent Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="h-4 bg-slate-205 rounded w-48" />
        <div className="bg-white rounded-2xl border border-slate-100 p-6 h-64 space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="space-y-2">
                <div className="h-4 bg-slate-100 rounded w-32" />
                <div className="h-3 bg-slate-100 rounded w-20" />
              </div>
              <div className="h-6 bg-slate-100 rounded-full w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-4 bg-slate-205 rounded w-32" />
        <div className="bg-white rounded-2xl border border-slate-100 p-6 h-64 space-y-4">
          <div className="h-36 bg-slate-100 rounded-xl" />
          <div className="h-3 bg-slate-100/80 rounded w-full" />
        </div>
      </div>
    </div>
  </div>
);

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

export default function Dashboard({ 
  orders, 
  clients, 
  professionals,
  currentUser, 
  onNavigate, 
  onSelectOrder,
  onApproveClient,
  onRejectClient,
  onResetPassword,
  logs = []
}: DashboardProps) {
  
  // States for metric detail drill-downs (Upgrade requested by manager)
  const [metricModal, setMetricModal] = useState<{
    title: string;
    description: string;
    ordersList: ServiceOrder[];
  } | null>(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [showReportPreview, setShowReportPreview] = useState(false);

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
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  
  // Track dismissed material shortages low-priority toasts/notifications
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

  const isGestorLike = currentUser && (currentUser.userType === "gestor" || currentUser.userType === "admin" || currentUser.userType === "gestor_servicos");
  const isAdminLike = currentUser && (currentUser.userType === "gestor" || currentUser.userType === "admin");

  const getClientAddress = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.address : "Endereço não cadastrado";
  };

  // Counts
  const totalClients = clients.length;
  
  const activeOrders = orders.filter(o => o.status !== "concluido" && o.status !== "cancelado");
  const completedOrders = orders.filter(o => o.status === "concluido");
  const missingMaterialOrders = orders.filter(o => o.hasMissingMaterial);
  const materialAlertNotifications = missingMaterialOrders.filter(o => !dismissedNotificationIds.includes(o.id));
  const pendingTriagem = orders.filter(o => o.status === "aberto" && !o.assignedTo);
  
  const totalOrders = orders.length;
  const resolutionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0;
  
  // Pipeline Status counts
  const countPending = orders.filter(o => o.status === "aberto").length;
  const countRunning = orders.filter(o => o.status === "em_progresso").length;
  const countWaiting = orders.filter(o => o.status === "aguardando").length;
  const countDone = orders.filter(o => o.status === "concluido").length;

  // Today's Date representation matching the mock environment: June 15, 2026
  const todayStr = "2026-06-15";
  const todaySchedule = orders.filter(os => os.startDate === todayStr || os.endDate === todayStr);

  const getClientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name : "Desconhecido";
  };

  // Group requests count by category
  const categoriesCount = orders.reduce((acc, order) => {
    acc[order.category] = (acc[order.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pendingClients = clients.filter(c => c.status === "pendente_autorizacao");
  const blockedClients = clients.filter(c => c.blocked);
  const blockedProfessionals = (professionals || []).filter(p => p.blocked);
  const totalBlocked = blockedClients.length + blockedProfessionals.length;

  // Gestor Key Metrics requested calculations
  const totalActiveRequestsVal = orders.filter(o => o.status !== "concluido" && o.status !== "cancelado").length;
  
  const activeProsInFieldVal = professionals ? professionals.filter(p => 
    orders.some(o => o.assignedTo === p.name && o.status !== "concluido" && o.status !== "cancelado")
  ).length : 0;

  const now = new Date();
  const isMockPeriod = orders.some(o => o.createdAt && o.createdAt.includes("2026-06"));
  const referenceYear = isMockPeriod ? 2026 : now.getFullYear();
  const referenceMonth = isMockPeriod ? 5 : now.getMonth(); // 5 = June 2026

  const currentMonthOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d.getFullYear() === referenceYear && d.getMonth() === referenceMonth;
  });

  const completedCurrentMonthOrders = currentMonthOrders.filter(o => o.status === "concluido");
  const monthlyResolutionRateVal = currentMonthOrders.length > 0
    ? Math.round((completedCurrentMonthOrders.length / currentMonthOrders.length) * 100)
    : 0;

  // -------------------------------------------------------------------------
  // Activity Heatmap Calculations
  // -------------------------------------------------------------------------
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
    // Category filter
    if (heatmapCategoryFilter !== "all" && o.category !== heatmapCategoryFilter) return false;
    // Status filter
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
    const dayIndex = oDate.getDay(); // 0-6
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
        <DashboardSkeleton />
      ) : (
        <>
          {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-3xl border border-slate-950/10 shadow-xl p-6 sm:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="z-10 space-y-2">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700/50 px-3 py-1 rounded-full w-max text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sistema Operacional de Chamados</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Painel de Triagem & Serviços</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">Controle de requisições de serviço de forma ágil, responsiva e integrada, sem movimentação financeira.</p>
        </div>

        <button
          onClick={() => onNavigate("assistant")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-lg shadow-emerald-900/40 border border-emerald-500/30 hover:shadow-emerald-900/50 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 self-stretch md:self-auto"
        >
          <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
          IA Diagnósticos de Defeitos
        </button>

        {/* Backdrop SVG rings for premium visual */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-teal-500/10 to-transparent rounded-full pointer-events-none transform translate-x-20 -translate-y-20" />
      </div>

      {/* SECTION: PERSONALIZED ROLE-BASED DASHBOARD CORNER */}
      {currentUser && (
        <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-6 space-y-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                <User className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900 text-sm tracking-wide uppercase">
                  Workspace Personalizado
                </h2>
                <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>Olá, <strong className="text-indigo-600 font-extrabold">{currentUser.name}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Suas ferramentas e indicadores como</span>
                  <span className="text-slate-700 font-extrabold bg-slate-200/50 border border-slate-300/40 px-2.5 py-0.5 rounded-md text-[10px] uppercase font-mono tracking-wide">
                    {currentUser.userType === "profissional"
                      ? "🔧 Técnico de Campo"
                      : currentUser.userType === "gestor" || currentUser.userType === "admin" || currentUser.userType === "gestor_servicos"
                      ? "🛡️ Gestor Autorizador"
                      : "👤 Requisitante / Cliente"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick status/date pill */}
            <div className="text-right text-[10px] font-extrabold text-slate-500 font-mono self-start sm:self-auto bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
              Sincronizado • Araçatuba, {new Date().toLocaleDateString("pt-BR")}
            </div>
          </div>

          {/* Cards Based on Roles */}
          {currentUser.userType === "profissional" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Left Column: My Current Tasks (📋 Meus Atendimentos) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide flex items-center gap-2">
                    <ClipboardList className="w-4.5 h-4.5 text-indigo-500" />
                    Meus Chamados Ativos ({activeOrders.filter(o => o.assignedTo === currentUser.name).length})
                  </h3>
                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-50/70 border border-indigo-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Fila de Campo
                  </span>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {orders.filter(o => o.assignedTo === currentUser.name && o.status !== "concluido" && o.status !== "cancelado").length > 0 ? (
                    orders.filter(o => o.assignedTo === currentUser.name && o.status !== "concluido" && o.status !== "cancelado").map(os => (
                      <div
                        key={os.id}
                        className="p-3.5 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/50 rounded-xl hover:border-indigo-200 duration-150 transition-all flex items-center justify-between gap-4 text-xs font-medium"
                      >
                        <div className="space-y-1 min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[9px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded">
                              #{os.id}
                            </span>
                            <span className="bg-slate-205 bg-slate-200/60 text-slate-700 text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono">
                              {os.category}
                            </span>
                            {getPriorityBadge(os.priority)}
                            {os.hasMissingMaterial && (
                              <span className="bg-amber-100 text-amber-850 text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-amber-200/50 animate-pulse">
                                Falta Peças
                              </span>
                            )}
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-xs truncate">
                            {os.title}
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            Requisitante: <strong className="text-slate-600 font-bold">{getClientName(os.clientId)}</strong>
                          </p>
                        </div>

                        <button
                          onClick={() => onSelectOrder(os)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] uppercase tracking-wider p-2 px-3.5 rounded-xl cursor-pointer shadow-md shadow-indigo-650/10 active:translate-y-[1px] transition-all"
                        >
                          Interagir
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 animate-bounce" />
                      <p className="font-bold text-xs text-slate-700">Tudo em dia! 🎉</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Você não possui nenhuma Ordem de Serviço pendente de atendimento hoje.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Workload performance metrics */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide text-left">
                    Sua Performance de Atendimento
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Alocados</span>
                      <span className="text-xl font-bold font-mono text-slate-800">
                        {orders.filter(o => o.assignedTo === currentUser.name).length} OS
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Resolvidos</span>
                      <span className="text-xl font-bold font-mono text-emerald-600">
                        {orders.filter(o => o.assignedTo === currentUser.name && o.status === "concluido").length} OS
                      </span>
                    </div>
                  </div>

                  {/* Progress Indicator Bar */}
                  <div className="space-y-1.5 pt-1 text-left">
                    {(() => {
                      const totalAlloc = orders.filter(o => o.assignedTo === currentUser.name).length;
                      const doneAlloc = orders.filter(o => o.assignedTo === currentUser.name && o.status === "concluido").length;
                      const rate = totalAlloc > 0 ? Math.round((doneAlloc / totalAlloc) * 100) : 0;
                      return (
                        <>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-semibold">Eficiência de Resolução</span>
                            <span className="font-bold text-indigo-600">{rate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                    <p className="text-[10px] text-slate-400 leading-normal font-medium">
                      Suas estatísticas são protegidas por privacidade e atualizadas automaticamente por triagem técnica.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate("scheduler")}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-4 h-4 text-indigo-500" />
                    Acessar Minha Agenda de Visitas
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MANAGER ROLE: SYSTEM HEALTH & AUDIT SUMMARY */}
          {(currentUser.userType === "gestor" || currentUser.userType === "admin" || currentUser.userType === "gestor_servicos") && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Left Column: Diagnostics checks */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-indigo-650" />
                    Saúde & Conformidade do Sistema (Realtime Agent)
                  </h3>
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Sistemas Monitorados
                  </span>
                </div>

                {/* Grid list of server resources */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Database */}
                  <div className="p-3.5 bg-slate-50 border border-slate-205 border-slate-200/60 rounded-xl space-y-2 text-xs text-left">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-650">
                        <Database className="w-4.5 h-4.5" />
                      </div>
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[8px] uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Online
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Banco de Dados</h4>
                      <p className="text-[9.5px] leading-relaxed text-slate-450 text-slate-500 mt-1">
                        Drizzle ORM + PostgreSQL persistent layers ativos. Latência: 3ms.
                      </p>
                    </div>
                  </div>

                  {/* Notification Gateway */}
                  <div className="p-3.5 bg-slate-50 border border-slate-205 border-slate-200/60 rounded-xl space-y-2 text-xs text-left">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                        <Server className="w-4.5 h-4.5" />
                      </div>
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[8px] uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        TLS Conectado
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Gateway SMTP</h4>
                      <p className="text-[9.5px] leading-relaxed text-slate-455 text-slate-500 mt-1">
                        Servidor de e-mails blindado na porta 587. Autenticação pronta.
                      </p>
                    </div>
                  </div>

                  {/* Security Shield */}
                  <div className="p-3.5 bg-slate-50 border border-slate-205 border-slate-200/60 rounded-xl space-y-2 text-xs text-left">
                    <div className="flex justify-between items-center">
                      <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                        <Shield className="w-4.5 h-4.5" />
                      </div>
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[8px] uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        Ativado
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Filtro LGPD & Cripto</h4>
                      <p className="text-[9.5px] leading-relaxed text-slate-455 text-slate-500 mt-1">
                        Ocultação automática de senhas e CPFs. Rastreável por log hash.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Security Audits & Action Items */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-4 text-xs font-semibold text-left">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide">
                    Sumário de Eventos de Auditoria
                  </h3>

                  <div className="space-y-3 pt-1 text-slate-700">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-medium font-normal">Acessos bloqueados e restritos:</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        totalBlocked > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                      }`}>
                        {totalBlocked} Bloqueios LGPD
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-medium font-normal">Contatos Clientes Autorizados:</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded font-mono text-[11px]">
                        {clients.filter(c => c.status === "ativo").length} Ativos
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium font-normal">Registro Geral de Logs:</span>
                      <span className="text-indigo-650 font-bold bg-indigo-50 px-2 py-0.5 rounded font-mono text-[11px]">
                        {logs.length} Trilhas gravadas
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal font-medium">
                    Todas as interações nesta central operacional geram um log assinado em conformidade de segurança e controle interno.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate("reports")}
                    className="w-full bg-slate-900 hover:bg-slate-800 p-3 rounded-xl text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:translate-y-[1px]"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
                    Abrir Painel de Auditoria Geral
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REQUISITANTE ROLE: SOLICITATIONS WATCHER */}
          {currentUser.userType === "requisitante" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Left Column: My Current Service Requests */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide flex items-center gap-2">
                    <Briefcase className="w-4.5 h-4.5 text-slate-650" />
                    Minhas Solicitações de Serviço Ativas ({orders.filter(o => o.clientId === currentUser.id && o.status !== "concluido" && o.status !== "cancelado").length})
                  </h3>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-205 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Suas Demandas
                  </span>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {orders.filter(o => o.clientId === currentUser.id && o.status !== "concluido" && o.status !== "cancelado").length > 0 ? (
                    orders.filter(o => o.clientId === currentUser.id && o.status !== "concluido" && o.status !== "cancelado").map(os => (
                      <div
                        key={os.id}
                        className="p-3.5 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/55 rounded-xl hover:border-indigo-150 duration-150 transition-all flex items-center justify-between gap-4 text-xs font-semibold font-medium"
                      >
                        <div className="space-y-1 min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                              #{os.id}
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono">
                              {os.category}
                            </span>
                            {getPriorityBadge(os.priority)}
                            <span className={`text-[8.5px] font-bold uppercase px-1.5 rounded ${
                              os.status === "em_progresso" ? "bg-blue-50 text-blue-700" :
                              os.status === "aguardando" ? "bg-amber-50 text-amber-700 border border-amber-100 animate-pulse" : "bg-slate-100 text-slate-650"
                            }`}>
                              {os.status === "em_progresso" ? "Em Execução" : os.status === "aguardando" ? "Pendente Material" : "Aberto"}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-xs truncate">
                            {os.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-normal">
                            Técnico Escalado: <strong className="text-slate-600 font-bold">{os.assignedTo || "Triagem Pendente"}</strong>
                          </p>
                        </div>

                        <button
                          onClick={() => onSelectOrder(os)}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider p-2 px-3 rounded-xl cursor-pointer shadow-sm active:translate-y-[1px] transition-all"
                        >
                          Acompanhar
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 animate-none">
                      <CheckCircle className="w-8 h-8 text-indigo-500 mx-auto mb-1.5" />
                      <p className="font-bold text-xs text-slate-700">Abra o seu Primeiro Chamado!</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Registre um problema de TI, Limpeza ou Manutenções Físicas diretamente pelo botão de criação de OS.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Requester instructions & Fast request shortcut */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-4 text-left">
                  <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wide">
                    Visão Geral de Chamados
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                      <span className="text-[9px] text-slate-450 font-bold uppercase block">Minhas OS Ativas</span>
                      <span className="text-xl font-bold font-mono text-slate-800">
                        {orders.filter(o => o.clientId === currentUser.id && o.status !== "concluido" && o.status !== "cancelado").length} OS
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                      <span className="text-[9px] text-slate-450 font-bold uppercase block">Já Resolvidas</span>
                      <span className="text-xl font-bold font-mono text-emerald-600">
                        {orders.filter(o => o.clientId === currentUser.id && o.status === "concluido").length} OS
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs font-semibold space-y-1">
                    <span className="text-[9.5px] text-indigo-700 uppercase tracking-wider font-extrabold block">💡 Dica de Suporte: Diagnósticos de Defeito</span>
                    <p className="text-[10.5px] text-slate-600 leading-relaxed font-medium">
                      O assistente de Inteligência Artificial está integrado ao portal para orientações imediatas e validação técnica de reparos antes da alocação de equipes.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate("orders")}
                    className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-650/10 active:translate-y-[1px]"
                  >
                    <ClipboardList className="w-4 h-4 text-indigo-200" />
                    Abrir Nova Ordem de Serviço
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Registrations Notifications for Gestor */}
      {isAdminLike && pendingClients.length > 0 && (
        <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden animate-fade-in mb-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/25 text-amber-400 flex items-center justify-center animate-pulse">
              <AlertCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                Novos Cadastros Pendentes de Autorização
                <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {pendingClients.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Novos usuários se auto-cadastraram no portal de acesso e aguardam classificação de permissões.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingClients.map(c => (
              <div key={c.id} className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between gap-3 relative text-left">
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
                </div>

                <div className="border-t border-slate-900 pt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block mr-auto">Autorizar como:</span>
                  
                  <button
                    onClick={() => onApproveClient?.(c.id, "requisitante")}
                    className="p-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/35 border border-emerald-500/20 active:translate-y-[1px]"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-200" />
                    Requisitante
                  </button>

                  <button
                    onClick={() => onApproveClient?.(c.id, "gestor")}
                    className="p-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-950/35 border border-indigo-500/20 active:translate-y-[1px]"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                    Gestor
                  </button>

                  <button
                    onClick={() => onRejectClient?.(c.id)}
                    className="p-2 px-2.5 bg-slate-800 hover:bg-rose-950/40 text-rose-400 font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all border border-slate-700/30 cursor-pointer active:translate-y-[1px]"
                    title="Recusar Cadastro"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Accounts Security Alerts for Gestor */}
      {isAdminLike && totalBlocked > 0 && (
        <div className="bg-rose-50/70 border border-red-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-605 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-red-900 text-sm uppercase tracking-wider flex items-center gap-2">
                Contas Bloqueadas por Segurança (Tentativas Esgotadas)
                <span className="bg-red-605 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {totalBlocked}
                </span>
              </h3>
              <p className="text-[11px] text-slate-600 font-medium leading-normal">As credenciais abaixo foram bloqueadas após 3 tentativas consecutivas de senha incorreta (Respeito à LGPD / Segurança). Ao restaurar, o usuário receberá uma senha padrão <strong className="text-red-700">123456</strong> por WhatsApp e E-mail, que deverá ser alterada no próximo login.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blockedClients.map(c => (
              <div key={c.id} className="bg-white border border-red-100 p-4 rounded-2xl flex flex-col justify-between gap-3 relative text-left shadow-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-slate-800 block">{c.name}</span>
                    <span className="text-[8px] font-mono font-bold uppercase tracking-wider bg-red-50 border border-red-105 text-red-600 px-2 py-0.5 rounded-md">
                      Requisitante
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 pt-1.5">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">CPF:</span>
                      <span className="font-mono text-slate-700">{c.document}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Telefone:</span>
                      <span className="font-mono text-slate-700">{c.phone || "Não informado"}</span>
                    </div>
                    {c.email && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">E-mail:</span>
                        <span className="text-slate-700 font-mono text-[9.5px] truncate block">{c.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-end">
                  <button
                    onClick={() => onResetPassword?.(c.id, "client")}
                    className="p-2 px-3.5 bg-red-650 hover:bg-red-700 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-red-950/20 active:translate-y-[1px]"
                  >
                    <Unlock className="w-3.5 h-3.5 text-red-200" />
                    Resetar Senha (123456)
                  </button>
                </div>
              </div>
            ))}

            {blockedProfessionals.map(p => (
              <div key={p.id} className="bg-white border border-red-100 p-4 rounded-2xl flex flex-col justify-between gap-3 relative text-left shadow-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-slate-800 block">{p.name}</span>
                    <span className="text-[8px] font-mono font-bold uppercase tracking-wider bg-red-50 border border-red-105 text-red-600 px-2 py-0.5 rounded-md">
                      Técnico de Campo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 pt-1.5">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">CPF:</span>
                      <span className="font-mono text-slate-700">{p.document || "Não cadastrado"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Cargo:</span>
                      <span className="font-mono text-amber-600 font-bold">{p.role}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Especialidades:</span>
                      <span className="text-slate-700 line-clamp-1">{p.specialty}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-end">
                  <button
                    onClick={() => onResetPassword?.(p.id, "professional")}
                    className="p-2 px-3.5 bg-red-650 hover:bg-red-700 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-red-950/20 active:translate-y-[1px]"
                  >
                    <Unlock className="w-3.5 h-3.5 text-red-200" />
                    Resetar Senha (123456)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestor Premium Metrics Cards */}
      {isGestorLike && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-550 rounded-full" />
              <h2 className="font-extrabold text-slate-800 text-sm tracking-widest uppercase">Métricas Decisoras de Gestão (Tempo Real)</h2>
            </div>
            
            <button
              onClick={() => setShowReportPreview(true)}
              className="bg-slate-900 hover:bg-slate-800 p-2.5 px-4 rounded-xl text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-slate-900/10 active:translate-y-[1px]"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              Relatório de Capacidade Mensal
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Active Requests Card */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              onClick={() => setMetricModal({
                title: "Total de Requisições Ativas",
                description: "Ordens de serviço de triagem, em atendimento ou na fila operacional de campo.",
                ordersList: orders.filter(o => o.status !== "concluido" && o.status !== "cancelado")
              })}
              className="bg-slate-900 border border-slate-950/10 rounded-2xl p-5 shadow-lg relative overflow-hidden text-white group hover:border-indigo-400/60 hover:bg-slate-850 transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total de Requisições Ativas</span>
                  <span className="text-3xl font-extrabold text-white block mt-1">{totalActiveRequestsVal} Atendimentos</span>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed pt-1">
                    Ordens de serviço triadas, em atendimento ou na fila operacional de campo.
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl text-indigo-400 shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Instâncias no banco: <strong className="text-white font-mono">{orders.length}</strong></span>
                <span className="text-indigo-400 font-extrabold uppercase tracking-wide bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">Triado e Ativo</span>
              </div>
            </motion.div>

            {/* Technicians Allocated in the Field Card */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              onClick={() => setTechModal(true)}
              className="bg-slate-900 border border-slate-950/10 rounded-2xl p-5 shadow-lg relative overflow-hidden text-white group hover:border-emerald-400/60 hover:bg-slate-850 transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Técnicos Alocados em Campo</span>
                  <span className="text-3xl font-extrabold text-emerald-400 block mt-1">{activeProsInFieldVal} de {professionals.length}</span>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed pt-1">
                    Equipe técnica com ordens designadas atualmente ativas.
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl text-emerald-400 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Parques técnicos ativos: <strong className="text-white font-mono">{professionals.length}</strong></span>
                <span className="text-emerald-400 font-extrabold uppercase tracking-wide bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/10">Produtividade</span>
              </div>
            </motion.div>

            {/* Monthly Resolution Rate Card */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              onClick={() => setMetricModal({
                title: "Atendimentos Concluídos neste Ciclo",
                description: `Lista de ordens de serviço geradas e concluídas que compõem a taxa de resolução deste ciclo mensal (${isMockPeriod ? "Junho/2026" : "Atuais"}).`,
                ordersList: completedCurrentMonthOrders
              })}
              className="bg-slate-900 border border-slate-950/10 rounded-2xl p-5 shadow-lg relative overflow-hidden text-white group hover:border-purple-400/60 hover:bg-slate-850 transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Taxa de Resolução Mensal</span>
                  <span className="text-3xl font-extrabold text-indigo-300 block mt-1">{monthlyResolutionRateVal}%</span>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed pt-1">
                    Proporção de encerramento de ordens de serviço geradas neste ciclo ({isMockPeriod ? "Junho/26" : "Atuais"}).
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl text-indigo-300 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Criados no mês: <strong className="text-white font-mono">{currentMonthOrders.length} OS</strong></span>
                <span className="text-indigo-300 font-extrabold uppercase tracking-wide bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">Eficiência</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* KPI metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {/* Metric 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          onClick={() => setMetricModal({
            title: "Chamados Ativos",
            description: "Lista de todos os atendimentos operacionais atualmente ativos (não concluídos e não cancelados).",
            ordersList: activeOrders
          })}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Chamados Ativos</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{activeOrders.length} Requisições</span>
            <span className="text-[10px] text-slate-500 font-medium block">Em andamento na oficina</span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <ClipboardList className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          onClick={() => setMetricModal({
            title: "Chamados Aguardando Triagem",
            description: "Chamados que estão abertos no sistema, mas ainda não possuem nenhum responsável técnico escalado.",
            ordersList: pendingTriagem
          })}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Aguardando Triagem</span>
            <span className="text-3xl font-extrabold text-amber-600 block">{pendingTriagem.length} Sem Técnico</span>
            <span className="text-[10px] text-slate-500 font-medium block">Novos chamados pendentes</span>
          </div>
          <div className="p-3 bg-amber-55/50 rounded-xl text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          onClick={() => setMetricModal({
            title: "Atendimentos Parados por Falta de Material",
            description: "Lista de ordens de serviço pausadas aguardando a aquisição de materiais físicos pelo requisitante.",
            ordersList: missingMaterialOrders
          })}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-red-400 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Atrasos / Falta de Material</span>
            <span className="text-3xl font-extrabold text-red-600 block">{missingMaterialOrders.length} Aguardando</span>
            <span className="text-[10px] text-slate-500 font-medium block">Pendente de compra pelo requisitante</span>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-650">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          onClick={() => onNavigate("clients")}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-slate-400 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Requisitantes Atendidos</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{totalClients} Requisitantes</span>
            <span className="text-[10px] text-slate-500 font-medium block">Fidedignidade com o requisitante</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Metric 5 */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
          onClick={() => setMetricModal({
            title: "Histórico de Atendimentos Concluídos",
            description: "Todas as ordens de serviço que foram concluídas com sucesso pelas equipes técnicas.",
            ordersList: completedOrders
          })}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Taxa de Resolução</span>
            <span className="text-3xl font-extrabold text-emerald-600 block">{resolutionRate}%</span>
            <span className="text-[10px] text-slate-500 font-medium block">{completedOrders.length} de {totalOrders} concluídos</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Pipeline Status Flow Visualization */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">Esteira Operacional / Pipeline de Serviços</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Aberto */}
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

          {/* Em Execução */}
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

          {/* Aguardando Peças */}
          <div 
            onClick={() => setMetricModal({
              title: "Ordens de Serviço: Aguardando Material",
              description: "Pendências de fornecimento físico ou compra de materiais complementares que impossibilitam o fechamento.",
              ordersList: orders.filter(o => o.status === "aguardando")
            })}
            className="p-4 bg-amber-55/50 hover:bg-amber-100/55 hover:border-amber-200 rounded-xl border border-amber-100 flex items-center justify-between cursor-pointer transition-all"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Falta Material / Paradas</span>
              <p className="text-xl font-extrabold text-amber-700 mt-1">{countWaiting}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>

          {/* Concluído */}
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
        <div id="activity-heatmap" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 animate-fade-in animate-none">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                  Mapa de Calor de Atividades (Weekly Heatmap)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-normal max-w-2xl">
                Frequência de abertura de chamados técnicos por dia da semana e período. Ajuda gestores no planejamento e na otimização de escalas de técnicos em campo.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Category Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Setor / Setores</span>
                <select
                  value={heatmapCategoryFilter}
                  onChange={(e) => {
                    setHeatmapCategoryFilter(e.target.value);
                    setSelectedHeatCell(null); // Reset detail display in filter change
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                >
                  <option value="all">📁 Todos os Setores</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>🔧 {cat}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Fase Operacional</span>
                <select
                  value={heatmapStatusFilter}
                  onChange={(e) => {
                    setHeatmapStatusFilter(e.target.value);
                    setSelectedHeatCell(null); // Reset detail display in filter change
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                >
                  <option value="all">📊 Todos os Status</option>
                  <option value="active">⏳ Abertos / Em Execução</option>
                  <option value="concluido">✅ Apenas Concluídos</option>
                </select>
              </div>

              {/* Reset button if filter is active */}
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
            {/* Left Box: Graphic Grid */}
            <div className="xl:col-span-8 space-y-4">
              {/* Heatmap header timeline blocks */}
              <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                <div className="text-left font-sans pl-1 flex items-center">Dia da Semana</div>
                {TIME_PERIODS.map(period => (
                  <div key={period.id} className="bg-slate-50 border border-slate-100 py-1.5 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-slate-700">{period.rangeName}</span>
                    <span className="text-[8px] text-slate-400 font-normal">{period.hours}</span>
                  </div>
                ))}
              </div>

              {/* Grid Rows */}
              <div className="space-y-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  return (
                    <div key={day.id} className="grid grid-cols-5 gap-1.5 items-center">
                      {/* Row Title */}
                      <div className="bg-slate-50/70 border border-slate-200/40 py-2.5 pl-3 rounded-lg text-xs font-black text-slate-800 text-left truncate flex items-center justify-between">
                        <span>{day.name}</span>
                        {/* Day count mini-badge */}
                        <span className="bg-slate-200/50 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded mr-2 text-slate-550">
                          {TIME_PERIODS.reduce((acc, p) => acc + (heatmapMatrix[`${day.id}-${p.id}`] || []).length, 0)}
                        </span>
                      </div>

                      {/* Cell blocks for the day */}
                      {TIME_PERIODS.map((period) => {
                        const cellOrders = heatmapMatrix[`${day.id}-${period.id}`] || [];
                        const count = cellOrders.length;
                        const isSelected = selectedHeatCell?.dayId === day.id && selectedHeatCell?.periodId === period.id;

                        // Density Tailwind color classes
                        let bgDensityClr = "bg-slate-50 border-slate-200/40 text-slate-400";
                        let hoverDensityClr = "hover:bg-slate-100/70 hover:border-slate-300";
                        if (count > 0 && count <= 1) {
                          bgDensityClr = "bg-indigo-50/50 border-indigo-100 text-indigo-700";
                          hoverDensityClr = "hover:bg-indigo-100 border-indigo-200";
                        } else if (count > 1 && count <= 3) {
                          bgDensityClr = "bg-indigo-100/60 border-indigo-150 text-indigo-800 font-extrabold";
                          hoverDensityClr = "hover:bg-indigo-200/80 hover:border-indigo-250";
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
                            <div className="flex justify-between items-center text-[7.5px] uppercase font-bold tracking-wider pt-1.5 opacity-80">
                              <span>Chamados</span>
                              {count > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Color guide legend */}
              <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2 pl-1 font-mono">
                <span>INTENSIDADE:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-slate-50 border border-slate-200/80 rounded-md" />
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

            {/* Right Box: Action Recommendation & Interactive Drill Down List */}
            <div className="xl:col-span-4 bg-slate-50 rounded-2xl border border-slate-200/60 p-4 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Planejamento de Equipes
              </h4>

              {/* Smart feedback recommendations */}
              {peakCell ? (
                <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1.5 text-xs">
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">💡 Otimização de Escalas</span>
                  <p className="text-[11px] font-medium text-slate-700 leading-relaxed font-sans">
                    Identificamos um pico histórico às <strong className="text-indigo-850 font-extrabold">{peakCell.dayName}s</strong> no período da <strong className="text-indigo-850 font-extrabold">{peakCell.periodLabel}</strong> com <strong className="text-indigo-650 font-extrabold">{peakCell.count} chamados</strong> abertos.
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    Recomendamos direcionar mais técnicos de campo ou priorizar triagens de suporte automatizadas por IA nas primeiras horas deste ciclo!
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-white border border-slate-205 border-slate-200/60 rounded-xl text-xs text-slate-450 text-center">
                  Sem ordens registradas no momento com os filtros selecionados.
                </div>
              )}

              {/* Selected Cell details & drill down list */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest font-mono">
                    {selectedHeatCell ? "Detalhes da Célula" : "Selecione uma célula"}
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
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                        <span className="text-slate-700">{day?.name}</span>
                        <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono text-[10px] px-2 py-0.5 rounded-md">
                          {period?.rangeName} ({cellOrdersList.length})
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {cellOrdersList.length > 0 ? (
                          cellOrdersList.map(os => (
                            <div
                              key={os.id}
                              onClick={() => onSelectOrder(os)}
                              className="p-2.5 bg-white border border-slate-200/70 hover:border-indigo-400 rounded-xl duration-120 transition hover:shadow-2xs cursor-pointer text-[11px] text-left"
                            >
                              <div className="flex justify-between items-center gap-1.5 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[9px] font-extrabold text-indigo-500 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded">
                                    #{os.id}
                                  </span>
                                  {getPriorityBadge(os.priority)}
                                </div>
                                <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  os.status === "concluido" ? "bg-emerald-50 text-emerald-750" :
                                  os.status === "em_progresso" ? "bg-blue-50 text-blue-755" : "bg-slate-100 text-slate-650"
                                }`}>
                                  {os.status === "concluido" ? "Resolvido" : os.status === "em_progresso" ? "Executando" : "Aberto"}
                                </span>
                              </div>
                              <h5 className="font-extrabold text-slate-800 line-clamp-1">{os.title}</h5>
                              <p className="text-[9.5px] text-slate-500 truncate mt-0.5">Técnico: {os.assignedTo || "Triação Pendente"}</p>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl text-[10.5px]">
                            Nenhum chamado no momento para este período da semana.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-[10.5px] bg-white p-4">
                    Selecione um bloco colorido no gráfico da semana ao lado para planejar a escala ideal e analisar a lista de requisições enviadas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Schedule vs Recent Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Scheduled Today Column */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-slate-500" />
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Atendimentos Hoje</h3>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">15 de Junho</span>
            </div>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {todaySchedule.length > 0 ? (
                todaySchedule.map(os => {
                  const delayed = isDelayedOpen(os);
                  return (
                    <div key={os.id} className={`p-3.5 rounded-xl border duration-150 text-xs transition-all ${
                      delayed 
                        ? "bg-red-50/60 border-red-200/50 hover:border-red-300" 
                        : "bg-slate-50 border-slate-200/40 hover:border-slate-200"
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-mono font-bold text-slate-400">{os.id}</span>
                        <div className="flex items-center gap-1.5">
                          {getPriorityBadge(os.priority)}
                          {delayed && (
                            <span className="bg-red-100 text-red-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse" title="Sem atualização há mais de 5 dias úteis!">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Atrasado
                            </span>
                          )}
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            os.status === "concluido" ? "bg-green-100 text-green-800" :
                            os.status === "em_progresso" ? "bg-blue-100 text-blue-800" : 
                            os.status === "aguardando" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {os.status === "concluido" ? "Concluído" :
                             os.status === "em_progresso" ? "Em Execução" : 
                             os.status === "aguardando" ? "Falta de Material" : "Aberto"}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{os.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Requisitante: {getClientName(os.clientId)}</p>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                  <CheckCircle className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
                  <p className="font-semibold text-xs text-slate-500">Sem visitas para hoje!</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Sua agenda está livre para focar em reparos internos.</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate("scheduler")}
            className="mt-6 w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 animate-fade-in"
          >
            Acessar Calendário Completo
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent Service Orders Column */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Últimas Requisições de Serviço</h3>
            
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
                  <th className="px-4 py-3">Chamado do Tomador / Requisitante</th>
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
                            <span className="flex items-center gap-1 bg-red-105 bg-red-100 text-red-700 text-[8.5px] px-1.5 py-0.5 rounded border border-red-200/50 animate-pulse font-black" title="Chamado sem atualização há mais de 5 dias úteis!">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Atrasado
                            </span>
                          )}
                          <span className="font-bold text-slate-800 truncate" title={os.title}>{os.title}</span>
                          {(os.unreadByClient || os.unreadByProfessional) && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" title="Novas mensagens responsivas aguardando ação" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal truncate flex items-center flex-wrap gap-2 mt-1">
                          <span>{getClientName(os.clientId)}</span>
                          <span className="text-slate-300">•</span>
                          {getPriorityBadge(os.priority)}
                          {os.unreadByClient && (
                            <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">Nova Resposta</span>
                          )}
                          {os.unreadByProfessional && (
                            <span className="text-[8px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">Aguardando Técnico</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            os.status === "concluido" ? "bg-green-100 text-green-800" :
                            os.status === "em_progresso" ? "bg-blue-100 text-blue-800" :
                            os.status === "aguardando" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {os.status === "concluido" ? "Concluído" :
                             os.status === "em_progresso" ? "Em Execução" :
                             os.status === "aguardando" ? "Falta de Material" : "Aberto"}
                          </span>
                          {delayed && (
                            <span className="text-[8px] font-black text-red-700 bg-red-50 border border-red-100 px-1 rounded uppercase tracking-wider flex items-center gap-0.5 animate-pulse" title="Mais de 5 dias úteis sem atualização">
                              <AlertCircle className="w-2.5 h-2.5 text-red-600 shrink-0" />
                              &gt; 5d úteis
                            </span>
                          )}
                        </div>
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
                        title="Ver Atendimento"
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

      </div>

      {/* Recent Activity Widget (Recent System Logs) */}
      {isGestorLike && (
        <div id="recent-system-activity-widget" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
              <h3 className="font-extrabold text-slate-800 text-xs lg:text-sm uppercase tracking-wider">Atividade Recente do Sistema</h3>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Expand / Collapse Control Option */}
              <button
                id="toggle-activity-collapse-btn"
                onClick={() => setIsActivityCollapsed(!isActivityCollapsed)}
                className="text-xs font-bold text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-100 px-3 py-1.5 rounded-lg shadow-2xs bg-white hover:bg-indigo-50/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title={isActivityCollapsed ? "Expandir atividades" : "Recolher atividades"}
              >
                {isActivityCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4 text-indigo-600 animate-bounce" />
                    <span>Expandir Painel</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                    <span>Recolher Painel</span>
                  </>
                )}
              </button>

              <button
                id="navigate-to-full-audit-btn"
                onClick={() => onNavigate("reports")}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg shadow-sm bg-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ver Auditoria Completa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isActivityCollapsed && (
            <div className="divide-y divide-slate-100 transition-all duration-300">
              {logs.slice(0, 5).map((log) => {
                // Determine layout indicators based on log category
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
                    {/* Visual icon container */}
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
          )}
        </div>
      )}

      {/* Drill-down modal for Service Orders Metrics */}
      {metricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col text-slate-800"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-500/5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
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

            {/* Search filter inside modal */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por descrição, requisitante ou responsável..."
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-slate-50/50"
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

            {/* Content list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3.5 max-h-[60vh]">
              {(() => {
                const searchLow = metricSearch.toLowerCase().trim();
                const filtered = metricModal.ordersList.filter(o => {
                  if (!searchLow) return true;
                  const clientName = getClientName(o.clientId).toLowerCase();
                  const title = o.title.toLowerCase();
                  const desc = o.description.toLowerCase();
                  const assigned = o.assignedTo.toLowerCase();
                  const ostId = o.id.toLowerCase();
                  return title.includes(searchLow) || desc.includes(searchLow) || clientName.includes(searchLow) || assigned.includes(searchLow) || ostId.includes(searchLow);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                      <Clock className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                      <p className="font-semibold text-xs text-slate-500">Nenhum atendimento correspondente encontrado</p>
                      {metricSearch && <p className="text-[10px] text-slate-400 mt-0.5">Tente reescrever a busca por termo simplificado.</p>}
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
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
                      <tbody className="divide-y divide-slate-100 divide-y divide-slate-100 font-semibold">
                        {filtered.map(os => {
                          const delayed = isDelayedOpen(os);
                          return (
                            <tr key={os.id} className={`hover:bg-slate-50/50 transition-colors ${delayed ? "bg-red-50/15" : ""}`}>
                              <td className="px-4 py-3 font-mono text-slate-400 font-bold">{os.id}</td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5 max-w-[250px]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-slate-800 line-clamp-1">{os.title}</span>
                                    {delayed && (
                                      <span className="bg-red-105 bg-red-100 text-red-700 text-[8.5px] font-black px-1.5 py-0.5 rounded border border-red-200/50 animate-pulse">Atrasado</span>
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
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full font-sans uppercase">
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
                              <td className="px-4 py-3 text-center font-bold">
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

            {/* Footer summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500 flex justify-between">
              <span>Total listados: {metricModal.ordersList.length} OS</span>
              <span className="text-indigo-650">Upgrade de Visão Gerencial</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Drill-down modal for Technicians allocated in the Field */}
      {techModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col text-slate-800"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-500/5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Painel de Técnicos em Campo & Designações
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verifique a ocupação, escala de trabalho e locais exatos de designação de cada profissional no mapa ou em campo em Araçatuba.
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

            {/* Search filter inside modal */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar técnico por nome, cargo ou especialidade..."
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-slate-50/50"
                />
              </div>
              {techSearch && (
                <button 
                  onClick={() => setTechSearch("")}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Content list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 max-h-[60vh] bg-slate-50/30">
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
                      <p className="font-semibold text-xs text-slate-500">Nenhum profissional técnico correspondente encontrado</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredTechs.map(p => {
                      // Get active orders assigned to this professional:
                      const techActiveOrders = orders.filter(
                        o => o.assignedTo === p.name && o.status !== "concluido" && o.status !== "cancelado"
                      );
                      const isFieldActive = techActiveOrders.length > 0;

                      return (
                        <div key={p.id} className="bg-white border border-slate-25/60 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all text-left">
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
                                <p className="text-[10px] text-slate-500 font-medium">
                                  {p.role} • <span className="text-slate-400 font-semibold">{p.specialty}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isFieldActive ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  Em Campo ({techActiveOrders.length} {techActiveOrders.length === 1 ? "Atendimento" : "Atendimentos"})
                                </span>
                              ) : (
                                <span className="bg-slate-105 text-slate-500 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1 border border-slate-200/40">
                                  Disponível / Fila
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Active assignments listing */}
                          <div className="pt-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                              Designado em Araçatuba / Ordens Ativas:
                            </span>

                            {isFieldActive ? (
                              <div className="space-y-2.5">
                                {techActiveOrders.map(os => (
                                  <div key={os.id} className="bg-slate-50/80 border border-slate-105 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9.5px] font-mono bg-slate-200 text-slate-700 px-1.5 font-bold rounded">
                                          {os.id}
                                        </span>
                                        <span className="font-extrabold text-slate-800">{os.title}</span>
                                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                          os.status === "em_progresso" ? "bg-blue-105 text-blue-700 font-black" : "bg-amber-105 text-amber-700 font-black"
                                        }`}>
                                          {os.status === "em_progresso" ? "Em Execução" : "Material Pendente"}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-0.5 text-[10.5px] text-slate-500 font-medium">
                                        <span>
                                          <strong className="text-slate-600 font-bold uppercase text-[9px] tracking-wide mr-1 select-none">Requisitante:</strong> {getClientName(os.clientId)}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-650">
                                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                          <strong className="text-slate-600 font-bold uppercase text-[9px] tracking-wide mr-1 select-none">Local Designado:</strong> {os.location || getClientAddress(os.clientId)}
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => {
                                        setTechModal(false);
                                        setTechSearch("");
                                        onSelectOrder(os);
                                      }}
                                      className="p-1 px-2.5 bg-slate-150 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/50 rounded-lg text-slate-600 transition-colors font-bold text-[10.5px]"
                                    >
                                      Interagir com OS
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10.5px] italic text-slate-400 py-1 bg-slate-55/35 rounded-xl px-3 border border-dashed border-slate-200/55">
                                Técnico sem ordens designadas no momento. Disponível para escalonamento de novos chamados.
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

            {/* Footer summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500 flex justify-between">
              <span>Profissionais listados: {professionals?.length || 0}</span>
              <span className="text-emerald-650">Upgrade de Visão Gerencial</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating System Low-Priority Toasts (Material Shortage Alerts) */}
      {isGestorLike && materialAlertNotifications.length > 0 && (
        <div id="material-shortage-low-priority-toast-container" className="fixed bottom-5 right-5 z-50 flex flex-col gap-3.5 max-w-sm w-full font-sans select-none pointer-events-none">
          {materialAlertNotifications.map((os) => (
            <motion.div
              key={os.id}
              initial={{ opacity: 0, x: 50, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              className="bg-white border-l-4 border-l-amber-500 border border-slate-150 rounded-2xl p-4 shadow-xl pointer-events-auto relative overflow-hidden backdrop-blur-md"
            >
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-650 shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-amber-600 uppercase">Falta de Material</span>
                    <button
                      onClick={() => setDismissedNotificationIds(prev => [...prev, os.id])}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-105 cursor-pointer"
                      title="Dispensar Notificação"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <span className="font-extrabold text-slate-800 text-[11px] block truncate">
                    Chamado #{os.id} - {os.title}
                  </span>
                  
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-200 pl-1.5 py-0.5 my-1 bg-slate-50 rounded-r-lg">
                    "{os.missingMaterialDescription || "Material não especificado"}"
                  </p>

                  <div className="flex items-center gap-1.5 pt-1.5">
                    <button
                      onClick={() => onSelectOrder(os)}
                      className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg transition-all cursor-pointer shadow-xs uppercase tracking-wide text-center"
                    >
                      Ação Rápida
                    </button>
                    <button
                      onClick={() => setDismissedNotificationIds(prev => [...prev, os.id])}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-150 border border-slate-200 text-slate-600 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer uppercase tracking-wide text-center"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* SECTOR: HIDDEN PRINT PREVIEW FOR MONTHLY REPORT */}
      {showReportPreview && (
        <div id="print-section" className="hidden print:block bg-white p-12 text-black font-sans leading-relaxed text-[10.5pt] w-full">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
            <div>
              <span className="text-xl font-extrabold uppercase tracking-tight block text-slate-900">RequisiçãoPro Araçatuba</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block font-mono">Relatório Analítico de Capacidade e Performance</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-350">
                RELATÓRIO DE EFICIÊNCIA OPERACIONAL
              </span>
              <span className="text-[9px] text-slate-500 block font-bold font-mono mt-1.5">
                Competência: {isMockPeriod ? "Junho / 2026" : `Ciclo ${new Date().toLocaleDateString("pt-BR", { month: 'long', year: 'numeric' })}`}
              </span>
              <span className="text-[8px] text-slate-400 block font-mono">
                Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")} por {currentUser?.name || "Administrador Geral"}
              </span>
            </div>
          </div>

          <div className="text-center print-accent-bg text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg mb-6">
            Sumário Executivo e Indicadores Gerenciais de Atendimento
          </div>

          {/* KPI Columns Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Registros Totais</span>
              <span className="text-xl font-extrabold text-slate-900 block mt-0.5">{orders.length} OS</span>
              <span className="text-[8px] text-slate-500 font-medium font-mono mt-1 block">Volume acumulado</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Resolução</span>
              <span className="text-xl font-extrabold text-indigo-700 block mt-0.5">{monthlyResolutionRateVal || resolutionRate}%</span>
              <span className="text-[8px] text-slate-500 font-medium font-mono mt-1 block">{currentMonthOrders.length > 0 ? completedCurrentMonthOrders.length : completedOrders.length} concluídas</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Fila Operacional</span>
              <span className="text-xl font-extrabold text-amber-655 text-amber-650 block mt-0.5">{activeOrders.length} Ativas</span>
              <span className="text-[8px] text-slate-500 font-medium font-mono mt-1 block">{pendingTriagem.length} sem triagem</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Bloqueios Críticos</span>
              <span className="text-xl font-extrabold text-red-650 text-red-600 block mt-0.5">{missingMaterialOrders.length + activeOrders.filter(isDelayedOpen).length} Items</span>
              <span className="text-[8px] text-slate-500 font-medium font-mono mt-1 block">Atrás / Falta material</span>
            </div>
          </div>

          {/* Category Workloads */}
          <div className="mb-6 print-break-avoid">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Demandas Técnicas por Categoria Operacional</span>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase bg-slate-50/50">
                  <th className="py-2 px-3">Especialidade / Categoria</th>
                  <th className="py-2 px-3 text-center">Chamados Registrados</th>
                  <th className="py-2 px-3 text-right">Percentual de Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {Object.entries(categoriesCount).map(([catName, count]) => {
                  const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                  return (
                    <tr key={catName} className="hover:bg-slate-50/40">
                      <td className="py-2 px-3 font-bold text-slate-800">{catName}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700">{count} OS</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-600">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Professionals list */}
          <div className="mb-6 print-break-avoid animate-none">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Capacidade Técnica e Workloads Alocados</span>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase bg-slate-50">
                  <th className="py-2 px-3">Nome do Profissional</th>
                  <th className="py-2 px-3">Cargo</th>
                  <th className="py-2 px-3 text-center">Chamados Pendentes</th>
                  <th className="py-2 px-3 text-center">Concluídos</th>
                  <th className="py-2 px-3 text-right">Eficiência Operacional</th>
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

          {/* Attention and Warnings */}
          {activeOrders.filter(isDelayedOpen).length > 0 && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50/40 mb-6 print-break-avoid">
              <span className="text-[9px] font-bold text-red-650 text-red-600 uppercase tracking-wider block border-b border-red-200/60 pb-1 mb-2">🚨 Alerta Crítico: Chamados Parados / Sem interação há {">"} 5 dias úteis</span>
              <div className="space-y-1.5 text-xs text-slate-800">
                {activeOrders.filter(isDelayedOpen).map(os => (
                  <p key={os.id} className="font-medium">
                    • <strong>OS #{os.id} [{os.category}]</strong> - "{os.title}" atribuída para <strong className="text-slate-900">{os.assignedTo || "Pendente"}</strong> sem atualização recente.
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Signature margins & confirmation */}
          <div className="mt-12 grid grid-cols-2 gap-8 print-break-avoid animate-none">
            <div className="text-center pt-6 border-t border-dashed border-slate-300 font-semibold text-xs text-slate-800">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
              <p className="font-extrabold text-slate-900">Coordenador de Operações Físicas</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Selo Autorizador / Visto</p>
            </div>
            
            <div className="text-center pt-6 border-t border-dashed border-slate-300 font-semibold text-xs text-slate-800">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
              <p className="font-extrabold text-slate-900">Diretor de Infraestrutura</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Homologação da Central Araçatuba</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTOR: VISUAL PRINT PREVIEW DIALOG MODAL ON-SCREEN (GERAR RELATÓRIO) */}
      {showReportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-slate-100 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-650" />
                <h3 className="font-bold text-sm text-slate-805 uppercase tracking-wide">Painel de Emissão de Relatório Mensal</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Abrir Diálogo de Impressão (Salvar PDF)
                </button>
                <button 
                  type="button"
                  onClick={() => setShowReportPreview(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-205 hover:bg-slate-100 text-slate-500 hover:text-slate-705 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Fechar visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Area simulating A4 preview page */}
            <div className="p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-250">
              <div className="bg-white shadow-xl rounded-2xl w-[210mm] min-h-[297mm] p-10 font-sans leading-relaxed text-sm text-slate-800 text-left border border-slate-350">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
                  <div>
                    <span className="text-xl font-extrabold uppercase block text-slate-900">RequisiçãoPro Araçatuba</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block font-mono">Relatório Analítico de Capacidade e Performance</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      RELATÓRIO DE EFICIÊNCIA OPERACIONAL
                    </span>
                    <span className="text-[10px] text-slate-500 block font-bold font-mono mt-1.5">
                      Competência: {isMockPeriod ? "Junho / 2026" : `Ciclo ${new Date().toLocaleDateString("pt-BR", { month: 'long', year: 'numeric' })}`}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")} por {currentUser?.name || "Administrador Geral"}
                    </span>
                  </div>
                </div>

                <div className="text-center bg-slate-900 text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg mb-6">
                  Sumário Executivo e Indicadores Gerenciais de Atendimento
                </div>

                {/* KPI Columns Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Registros Totais</span>
                    <span className="text-2xl font-black text-slate-900 block mt-0.5">{orders.length} OS</span>
                    <span className="text-[9px] text-slate-500 font-medium font-mono mt-1 block">Volume acumulado</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Resolução</span>
                    <span className="text-2xl font-black text-indigo-700 block mt-0.5">{monthlyResolutionRateVal || resolutionRate}%</span>
                    <span className="text-[9px] text-slate-500 font-medium font-mono mt-1 block">{currentMonthOrders.length > 0 ? completedCurrentMonthOrders.length : completedOrders.length} concluídas</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fila Operacional</span>
                    <span className="text-2xl font-black text-amber-600 block mt-0.5">{activeOrders.length} Ativas</span>
                    <span className="text-[9px] text-slate-500 font-medium font-mono mt-1 block">{pendingTriagem.length} sem triagem</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bloqueios Críticos</span>
                    <span className="text-2xl font-black text-red-600 block mt-0.5">{missingMaterialOrders.length + activeOrders.filter(isDelayedOpen).length} Items</span>
                    <span className="text-[9px] text-slate-500 font-medium font-mono mt-1 block">Atrás / Falta material</span>
                  </div>
                </div>

                {/* Category Workloads */}
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Demandas Técnicas por Categoria Operacional</span>
                  <table className="w-full text-left border-collapse animate-none">
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

                {/* Professionals list */}
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-1 mb-2">Capacidade Técnica e Workloads Alocados</span>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                        <th className="py-2 px-3">Nome do Profissional</th>
                        <th className="py-2 px-3">Cargo</th>
                        <th className="py-2 px-3 text-center">Chamados Ativos</th>
                        <th className="py-2 px-3 text-center">Concluídos</th>
                        <th className="py-2 px-3 text-right font-bold text-slate-500">Eficiência Operacional</th>
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
                            <td className="py-2.5 px-3 font-semibold text-slate-950">{p.name} {p.blocked && "🔒"}</td>
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

                {/* Attention and Warnings */}
                {activeOrders.filter(isDelayedOpen).length > 0 && (
                  <div className="border border-red-200 rounded-xl p-4 bg-red-50/40 mb-6">
                    <span className="text-[10px] font-bold text-red-650 text-red-650 uppercase tracking-wider block border-b border-red-200/60 pb-1 mb-2">🚨 Alertas Operacionais: Chamados Pendentes sem ação há {">"} 5 dias úteis</span>
                    <div className="space-y-1.5 text-xs text-red-800">
                      {activeOrders.filter(isDelayedOpen).map(os => (
                        <p key={os.id}>
                          • <strong>OS #{os.id} [{os.category}]</strong> - "{os.title}" alocada para <strong className="text-slate-850">{os.assignedTo || "Pendente"}</strong> requer verificação operacional.
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                <div className="mt-12 grid grid-cols-2 gap-8">
                  <div className="text-center pt-6 border-t border-dashed border-slate-350 font-semibold text-xs text-slate-650">
                    <div className="inline-block w-48 mb-1 leading-none border-b border-slate-300">_________________________________</div>
                    <p className="font-extrabold text-slate-800">Coordenador de Operações Físicas</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Selo Autorizador / Visto</p>
                  </div>
                  
                  <div className="text-center pt-6 border-t border-dashed border-slate-350 font-semibold text-xs text-slate-650">
                    <div className="inline-block w-48 mb-1 leading-none border-b border-slate-300">_________________________________</div>
                    <p className="font-extrabold text-slate-800">Diretor de Infraestrutura</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Homologação da Central Araçatuba</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
    )}
    </div>
  );
}

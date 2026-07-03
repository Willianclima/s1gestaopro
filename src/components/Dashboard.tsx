import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useToast } from "./ToastContext";
import { ServiceOrder, Client, CurrentUser, Professional, SystemLog, Almoxarifado } from "../types";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert,
  TrendingUp, X, Search, MapPin, User, Activity, Wrench, FileText, ChevronDown, ChevronUp, Printer, Download, Database, Server, Shield, Check, Calendar, Bell, BellOff
} from "lucide-react";

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
  const { success: toastSuccess, info: toastInfo, system: toastSystem } = useToast();
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [cacheValue, setCacheValue] = useState<any>(null);
  const [cacheKey, setCacheKey] = useState<string>("");

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

  // Today's Date representation matching the mock environment: June 15, 2026
  const todayStr = "2026-06-15";
  const todaySchedule = orders.filter(os => os.startDate === todayStr || os.endDate === todayStr);

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
                <span>Painel Operacional Simplificado</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Painel de Triagem & Atividades</h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Resumo operacional em tempo real e visualização consolidada dos atendimentos agendados para hoje.
              </p>
            </div>

            <div className="z-10 flex items-center gap-2">
              <button
                onClick={() => onNavigate("assistant")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-lg shadow-emerald-900/40 border border-emerald-500/30 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                IA Diagnósticos
              </button>
            </div>

            {/* Backdrop visual gradient effect */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-teal-500/10 to-transparent rounded-full pointer-events-none transform translate-x-20 -translate-y-20" />
          </div>

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
                  return (
                    <div 
                      key={os.id} 
                      className={`p-4 rounded-2xl border duration-150 text-xs transition-all flex flex-col justify-between h-44 cursor-pointer hover:shadow-xs ${
                        delayed 
                          ? "bg-red-50/40 border-red-200/50 hover:border-red-300" 
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

          {/* DIAGNOSTIC AND TRACE PANEL */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-950/20 shadow-xl overflow-hidden text-left transition-all">
            <button
              onClick={() => setDiagnosticOpen(!diagnosticOpen)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                    Painel de Diagnóstico & Rastreamento de Notificações
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verifique em tempo real o status de sincronização, caches de leitura e dispare testes.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${diagnosticOpen ? "bg-emerald-500/25 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>
                  {diagnosticOpen ? "Ativo / Aberto" : "Clique para Expandir"}
                </span>
                {diagnosticOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {diagnosticOpen && (
              <div className="p-6 border-t border-slate-800 space-y-6 bg-slate-950/45 text-xs text-slate-300">
                {/* 3-Column Diagnostic Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Dados da Sessão Atual</span>
                    <p className="text-white font-extrabold">Nome: {currentUser?.name || "Sem usuário"}</p>
                    <p>Tipo: <span className="font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-[10.5px] font-semibold">{currentUser?.userType || "Sem tipo"}</span></p>
                    <p>ID do Perfil: <span className="font-mono text-slate-400">{currentUser?.id || "N/A"}</span></p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Estado de Ordens</span>
                    <p className="text-white font-extrabold">Visíveis neste Painel: {orders?.length || 0}</p>
                    <p>Total do Sistema (Raw): {rawOrders?.length || 0}</p>
                    <p className="text-slate-400 text-[10.5px]">
                      {orders?.length !== rawOrders?.length 
                        ? "⚠️ Isolamento de Perfil Ativo (Filtragem de Visibilidade LGPD)" 
                        : "✓ Visibilidade Plena (Perfil Administrativo/Gestor)"}
                    </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Cache do Motor</span>
                    <p className="text-white font-mono break-all text-[11px] font-bold font-semibold">Chave: {cacheKey || "N/A"}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (cacheKey) {
                            localStorage.removeItem(cacheKey);
                            loadCaches();
                            toastSuccess("Cache de notificações limpo! Próxima atualização disparará novos alertas.", "Sucesso");
                          }
                        }}
                        className="p-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-[10.5px] uppercase"
                        disabled={!cacheKey}
                      >
                        Limpar Cache
                      </button>
                      <button
                        onClick={loadCaches}
                        className="p-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors cursor-pointer text-[10.5px] uppercase"
                      >
                        Recarregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tracking Log JSON Visualizer */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Histórico de Itens / Status já Notificados (Visto)</span>
                    <span className="text-[10px] text-slate-500 font-mono">localStorage JSON</span>
                  </div>
                  <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[10.5px] text-emerald-400 overflow-x-auto max-h-36">
                    {cacheValue ? JSON.stringify(cacheValue, null, 2) : "Nenhum cache registrado ou cache vazio. (Nenhum alerta enviado ainda)"}
                  </pre>
                </div>

                {/* Direct Manual Actions & Simulators */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Simuladores Rápidos</span>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => {
                        toastSystem("Mensagem de teste do sistema de notificação via toastContext.", "Teste Sistema (Toast)");
                        console.log("[DiagnosticPanel] Dispatched manual System Toast Notification.");
                      }}
                      className="p-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer text-[11px] uppercase tracking-wider"
                    >
                      Disparar Toast de Teste
                    </button>
                    
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined" && "Notification" in window) {
                          if (Notification.permission === "granted") {
                            new Notification("Notificação de Teste do Navegador", {
                              body: "Isso confirma que notificações nativas funcionam!",
                              icon: "/favicon.ico"
                            });
                          } else if (Notification.permission !== "denied") {
                            Notification.requestPermission().then(permission => {
                              if (permission === "granted") {
                                new Notification("Notificação de Teste do Navegador", {
                                  body: "Isso confirma que notificações nativas funcionam!",
                                  icon: "/favicon.ico"
                                });
                              }
                            });
                          } else {
                            toastInfo("Permissão de notificação nativa negada no navegador. Habilite na barra de endereço.", "Permissão Negada");
                          }
                        } else {
                          toastInfo("Seu navegador não suporta notificações nativas de desktop.", "Não Suportado");
                        }
                      }}
                      className="p-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer text-[11px] uppercase tracking-wider"
                    >
                      Solicitar e Testar Notificação Nativa
                    </button>

                    <button
                      onClick={() => {
                        console.log("[DiagnosticPanel] Printing state diagnostics to console...");
                        console.log("Current Logged In User:", currentUser);
                        console.log("Filtered Orders (ordersProp):", orders);
                        console.log("Global Orders (rawOrdersProp):", rawOrders);
                        console.log("Professionals List:", professionals);
                        console.log("Clients List:", clients);
                        toastSuccess("Todos os estados do sistema foram impressos no console do DevTools!", "Diagnóstico do Console");
                      }}
                      className="p-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all cursor-pointer text-[11px] uppercase tracking-wider"
                    >
                      Imprimir Diagnóstico no Console
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-1">
                    Nota: O motor real de segundo plano (Background Notification Engine) avalia automaticamente novas OS a cada mutação de dados e mudança de login. Use as ferramentas de simulação acima para auditar a fidedignidade do canal de entrega de áudio-toast e notificações nativas.
                  </p>
                </div>
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

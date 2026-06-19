import React, { useState } from "react";
import { motion } from "motion/react";
import { ServiceOrder, Client, CurrentUser, Professional, SystemLog } from "../types";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert,
  TrendingUp, X, Search, MapPin, User, Activity, Wrench, FileText, ChevronDown, ChevronUp
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

  const [techModal, setTechModal] = useState(false);
  const [techSearch, setTechSearch] = useState("");
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  
  // Track dismissed material shortages low-priority toasts/notifications
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

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

  return (
    <div className="space-y-8">
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

      {/* Pending Registrations Notifications for Gestor */}
      {currentUser?.userType === "gestor" && pendingClients.length > 0 && (
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
      {currentUser?.userType === "gestor" && totalBlocked > 0 && (
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
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">CPF/CNPJ:</span>
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
      {currentUser?.userType === "gestor" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            <h2 className="font-extrabold text-slate-800 text-sm tracking-widest uppercase">Métricas Decisoras de Gestão (Tempo Real)</h2>
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
                        <span className="text-[10px] text-slate-500 font-normal truncate block mt-0.5">
                          {getClientName(os.clientId)}
                          {os.unreadByClient && (
                            <span className="ml-2 text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 rounded">Nova Resposta</span>
                          )}
                          {os.unreadByProfessional && (
                            <span className="ml-2 text-[8px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1 rounded">Aguardando Técnico</span>
                          )}
                        </span>
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
      {currentUser?.userType === "gestor" && (
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
                                  <span className="text-[10px] text-slate-500 font-normal block">{getClientName(os.clientId)}</span>
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
      {currentUser?.userType === "gestor" && materialAlertNotifications.length > 0 && (
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

    </div>
  );
}

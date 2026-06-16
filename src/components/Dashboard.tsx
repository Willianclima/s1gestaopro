import React from "react";
import { ServiceOrder, Client, CurrentUser, Professional } from "../types";
import { 
  Briefcase, Users, Clock, AlertTriangle, CheckCircle, ArrowRight, ClipboardList, PenTool, ExternalLink, Sparkles, Tag, ShieldCheck, AlertCircle, UserCheck, UserX, Unlock, ShieldAlert
} from "lucide-react";

interface DashboardProps {
  orders: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  currentUser?: CurrentUser | null;
  onNavigate: (tab: "dashboard" | "clients" | "orders" | "scheduler" | "professionals" | "assistant" | "reports") => void;
  onSelectOrder: (order: ServiceOrder) => void;
  onApproveClient?: (clientId: string, type: "gestor" | "requisitante") => void;
  onRejectClient?: (clientId: string) => void;
  onResetPassword?: (id: string, type: "client" | "professional") => void;
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
  onResetPassword
}: DashboardProps) {
  
  // Counts
  const totalClients = clients.length;
  
  const activeOrders = orders.filter(o => o.status !== "concluido" && o.status !== "cancelado");
  const completedOrders = orders.filter(o => o.status === "concluido");
  const missingMaterialOrders = orders.filter(o => o.hasMissingMaterial);
  const pendingTriagem = orders.filter(o => o.status === "aberto" && !o.assignedTo);
  
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

      {/* KPI metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Chamados Ativos</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{activeOrders.length} Requisições</span>
            <span className="text-[10px] text-slate-500 font-medium block">Em andamento na oficina</span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Aguardando Triagem</span>
            <span className="text-3xl font-extrabold text-amber-600 block">{pendingTriagem.length} Sem Técnico</span>
            <span className="text-[10px] text-slate-500 font-medium block">Novos chamados pendentes</span>
          </div>
          <div className="p-3 bg-amber-55/50 rounded-xl text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Atrasos / Falta de Material</span>
            <span className="text-3xl font-extrabold text-red-600 block">{missingMaterialOrders.length} Aguardando</span>
            <span className="text-[10px] text-slate-500 font-medium block">Pendente de compra pelo requisitante</span>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-650">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Requisitantes Atendidos</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{totalClients} Requisitantes</span>
            <span className="text-[10px] text-slate-500 font-medium block">Fidedignidade com o requisitante</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Pipeline Status Flow Visualization */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">Esteira Operacional / Pipeline de Serviços</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Aberto */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendente / Aberto</span>
              <p className="text-xl font-extrabold text-slate-700 mt-1">{countPending}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          </div>

          {/* Em Execução */}
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Em Execução</span>
              <p className="text-xl font-extrabold text-blue-700 mt-1">{countRunning}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>

          {/* Aguardando Peças */}
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Falta Material / Paradas</span>
              <p className="text-xl font-extrabold text-amber-700 mt-1">{countWaiting}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>

          {/* Concluído */}
          <div className="p-4 bg-green-50/50 rounded-xl border border-green-100 flex items-center justify-between">
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
                todaySchedule.map(os => (
                  <div key={os.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/40 hover:border-slate-200 duration-150 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400">{os.id}</span>
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

                    <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{os.title}</h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Requisitante: {getClientName(os.clientId)}</p>
                  </div>
                ))
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
                {orders.slice(0, 5).map(os => (
                  <tr key={os.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 font-bold">{os.id}</td>
                    <td className="px-4 py-3 pb-2.5 max-w-[200px]">
                      <div className="flex items-center gap-2">
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
                        title="Ver Atendimento"
                      >
                        Interagir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

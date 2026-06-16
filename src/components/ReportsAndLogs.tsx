import React, { useState } from "react";
import { ServiceOrder, Client, Professional, SystemLog } from "../types";
import { 
  BarChart3, FileText, Search, Clock, CheckCircle2, AlertTriangle, 
  X, HelpCircle, Users, Activity, SlidersHorizontal, Wrench, RefreshCw, Trash2
} from "lucide-react";

interface ReportsAndLogsProps {
  orders: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  logs: SystemLog[];
  onClearLogs: () => void;
}

export default function ReportsAndLogs({ 
  orders, clients, professionals, logs, onClearLogs 
}: ReportsAndLogsProps) {
  const [activeTab, setActiveTab] = useState<"charts" | "audit">("charts");
  const [logsSearch, setLogsSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Calculations for executive reports
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === "concluido").length;
  const openOrders = orders.filter(o => o.status === "aberto").length;
  const progressOrders = orders.filter(o => o.status === "em_progresso").length;
  const materialOrders = orders.filter(o => o.status === "aguardando" || o.hasMissingMaterial).length;
  const cancelledOrders = orders.filter(o => o.status === "cancelado").length;

  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const materialShortageRate = totalOrders > 0 ? Math.round((materialOrders / totalOrders) * 100) : 0;

  // Group by Category
  const categoriesMap: { [key: string]: number } = {};
  orders.forEach(o => {
    categoriesMap[o.category] = (categoriesMap[o.category] || 0) + 1;
  });

  const categoryStats = Object.keys(categoriesMap).map(catName => ({
    name: catName,
    count: categoriesMap[catName],
    percentage: totalOrders > 0 ? Math.round((categoriesMap[catName] / totalOrders) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // Productivity of Professionals
  const professionalProductivity = professionals.map(prof => {
    const assigned = orders.filter(o => o.assignedTo === prof.name);
    const active = assigned.filter(o => o.status === "em_progresso" || o.status === "aguardando").length;
    const completed = assigned.filter(o => o.status === "concluido").length;
    const items = assigned.length;

    return {
      name: prof.name,
      specialty: prof.specialty,
      active,
      completed,
      total: items
    };
  }).sort((a, b) => b.completed - a.completed);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(logsSearch.toLowerCase()) || 
                          log.details.toLowerCase().includes(logsSearch.toLowerCase());
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Relatórios Gerenciais & Logs</h1>
          <p className="text-sm text-slate-500 font-medium">Visualize métricas estratégicas, produtividade da equipe e o histórico completo de auditoria do sistema.</p>
        </div>

        {/* Sub Navigation tabs */}
        <div className="flex bg-slate-150 bg-slate-200/60 p-1 rounded-xl w-max">
          <button
            onClick={() => setActiveTab("charts")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "charts"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Relatórios Executivos
          </button>
          
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "audit"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            Logs e Auditoria
          </button>
        </div>
      </div>

      {activeTab === "charts" ? (
        <div className="space-y-6">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cumpatibilidade Operacional</span>
              <span className="text-3xl font-extrabold text-slate-850 block">{completionRate}%</span>
              <div className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 w-max px-2 py-0.5 rounded-lg">
                📋 {completedOrders} de {totalOrders} Concluídos
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-slate-100 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Aguardando Material</span>
              <span className="text-3xl font-extrabold text-slate-850 block">{materialShortageRate}%</span>
              <div className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 w-max px-2 py-0.5 rounded-lg">
                ⚠️ {materialOrders} chamados travados
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Média de Requisitantes</span>
              <span className="text-3xl font-extrabold text-slate-850 block">{clients.length} Ativos</span>
              <div className="text-xs text-indigo-600 font-bold mt-1 bg-indigo-50 w-max px-2 py-0.5 rounded-lg">
                👥 Integridade no GS
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-indigo-50 rounded-xl">
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Em Atendimento</span>
              <span className="text-3xl font-extrabold text-slate-850 block">{progressOrders} Técnicos</span>
              <div className="text-xs text-slate-600 font-bold mt-1 bg-slate-100 w-max px-2 py-0.5 rounded-lg">
                ⚡ Execução ativa em campo
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-slate-100 rounded-xl">
                <Clock className="w-5 h-5 text-slate-650" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Breakdown Bar chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6 lg:col-span-1">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Status de Chamados</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Distribuição do estado técnico atual das requisições</p>
              </div>

              <div className="space-y-4">
                {/* Aberto */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-bold">
                    <span>Em Triagem (Aberto)</span>
                    <span>{openOrders} ({totalOrders > 0 ? Math.round((openOrders / totalOrders) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${totalOrders > 0 ? (openOrders / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Em progresso */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-bold">
                    <span>Em Execução Técnica</span>
                    <span>{progressOrders} ({totalOrders > 0 ? Math.round((progressOrders / totalOrders) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${totalOrders > 0 ? (progressOrders / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Aguardando material */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-bold">
                    <span>Aguardando Material pelo Requisitante</span>
                    <span>{materialOrders} ({totalOrders > 0 ? Math.round((materialOrders / totalOrders) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: `${totalOrders > 0 ? (materialOrders / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Concluido */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-bold">
                    <span>Finalizados e Aprovados</span>
                    <span>{completedOrders} ({totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Cancelado */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-bold">
                    <span>Cancelados / Inviáveis</span>
                    <span>{cancelledOrders} ({totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-red-400 h-full rounded-full" style={{ width: `${totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Category statistics visual bar fills */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5 lg:col-span-2">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Demandas por Categoria Técnica</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Quais áreas registram maiores volumes de requisição</p>
              </div>

              {categoryStats.length > 0 ? (
                <div className="space-y-4">
                  {categoryStats.map((stat, i) => (
                    <div key={i} className="flex items-center gap-4 text-xs font-semibold">
                      <span className="w-24 text-slate-700 truncate" title={stat.name}>{stat.name}</span>
                      
                      <div className="flex-1 bg-slate-100 h-4 rounded-lg overflow-hidden relative">
                        <div 
                          className="bg-indigo-650 bg-indigo-505 bg-indigo-600/85 h-full rounded-lg" 
                          style={{ width: `${stat.percentage}%` }}
                        />
                        <span className="absolute inset-y-0 right-3 text-[9px] font-extrabold text-slate-600 flex items-center">
                          {stat.count} {stat.count === 1 ? 'demandado' : 'demandados'}
                        </span>
                      </div>

                      <span className="w-12 text-right text-slate-500">{stat.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-350 mb-1" />
                  Nenhuma categoria registrada com ordens de serviço.
                </div>
              )}
            </div>
          </div>

          {/* Productivity Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Produtividade de Campo Técnica</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Indicadores do técnico em relação a trabalhos efetuados e andamento atual</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-55 bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4">Técnico Executor</th>
                    <th className="px-6 py-4">Especialidade Core</th>
                    <th className="px-6 py-4 text-center">Chamados Designados</th>
                    <th className="px-6 py-4 text-center">Em Atendimento Direto</th>
                    <th className="px-6 py-4 text-center">Trabalhos Concluídos</th>
                    <th className="px-6 py-4 text-center">Rank de Eficiência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {professionalProductivity.map((p, i) => {
                    const completedRate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-600 font-black">
                            {p.name.charAt(0)}
                          </div>
                          {p.name}
                        </td>
                        <td className="px-6 py-4 text-slate-500">{p.specialty}</td>
                        <td className="px-6 py-4 text-center font-mono text-slate-900">{p.total}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 bg-amber-50 rounded text-amber-700 font-bold text-[10px]">
                            {p.active} ativos
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 bg-emerald-55 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px]">
                            {p.completed} finalizados
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${completedRate}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold">{completedRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {professionalProductivity.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 font-semibold text-xs">
                        Nenhum técnico alocado na equipe de campo no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* AUDIT LOGGER VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
          {/* Filtering Ribbon */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700"
                  placeholder="Pesquisar logs por termo..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                />
              </div>

              {/* Reset to show all */}
              {(logsSearch || categoryFilter !== "all") && (
                <button
                  onClick={() => {
                    setLogsSearch("");
                    setCategoryFilter("all");
                  }}
                  className="p-2 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                  title="Limpar filtros"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Log Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors ${
                  categoryFilter === "all" 
                    ? "bg-slate-900 border border-slate-900 text-white" 
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-55 hover:bg-slate-50"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setCategoryFilter("requisicao")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 ${
                  categoryFilter === "requisicao" 
                    ? "bg-slate-900 border border-slate-900 text-white" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Requisições
              </button>
              <button
                onClick={() => setCategoryFilter("requisitante")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 ${
                  categoryFilter === "requisitante" 
                    ? "bg-slate-900 border border-slate-900 text-white" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Requisitantes
              </button>
              <button
                onClick={() => setCategoryFilter("tecnico")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 ${
                  categoryFilter === "tecnico" 
                    ? "bg-slate-900 border border-slate-900 text-white" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                Equipe
              </button>

              <button
                onClick={() => {
                  if (confirm("Confirmar a limpeza permanente de todos os logs de auditoria do sistema?")) {
                    onClearLogs();
                  }
                }}
                className="ml-auto px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Logs
              </button>
            </div>
          </div>

          {/* Logs List Pane */}
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                // Determine layout indicators based on log category
                let badgeClr = "bg-slate-100 text-slate-600";
                let iconEl = <SlidersHorizontal className="w-4 h-4 text-slate-500" />;
                
                if (log.category === "requisicao") {
                  badgeClr = "bg-indigo-55 bg-indigo-50 text-indigo-700 border border-indigo-100";
                  iconEl = <FileText className="w-4 h-4 text-indigo-600" />;
                } else if (log.category === "requisitante") {
                  badgeClr = "bg-blue-55 bg-blue-50 text-blue-750 text-blue-700 border border-blue-105";
                  iconEl = <Users className="w-4 h-4 text-blue-600" />;
                } else if (log.category === "tecnico") {
                  badgeClr = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                  iconEl = <Wrench className="w-4 h-4 text-emerald-600" />;
                }

                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors flex gap-4 items-start text-xs font-medium">
                    {/* Visual icon container */}
                    <div className="p-2 border border-slate-100 rounded-xl bg-white shrink-0 shadow-xs">
                      {iconEl}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-850 text-sm">{log.action}</span>
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

              {filteredLogs.length === 0 && (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Activity className="w-12 h-12 text-slate-205 text-slate-300 mb-2 animate-pulse" />
                  <p className="font-bold text-slate-500 text-sm">Nenhum registro de log localizado.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Insira novas requisições, altere status de serviços ou mude filtros para gerar logs na trilha de auditoria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

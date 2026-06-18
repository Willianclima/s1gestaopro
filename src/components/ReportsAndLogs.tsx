import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { ServiceOrder, Client, Professional, SystemLog } from "../types";
import { 
  BarChart3, FileText, Search, Clock, CheckCircle2, AlertTriangle, 
  X, HelpCircle, Users, Activity, SlidersHorizontal, Wrench, RefreshCw, Trash2,
  Download
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header & Brand Styling (using our custom steel blue theme #2d749a)
    const primaryColor = [45, 116, 154]; // #2d749a
    const darkGray = [51, 65, 85]; // slate-700
    const lightGray = [241, 245, 249]; // slate-100
    
    // Page Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Relatorio de Gestao e Auditoria", 14, 22);
    
    // Meta Info
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 29);
    doc.text(`Filtro Ativo: Categoria (${categoryFilter === "all" ? "Todas" : categoryFilter}) / Termo ("${logsSearch || "Nenhum"}")`, 14, 34);
    
    // Horizontal separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);
    
    // SECTION 1: RESUMO OPERACIONAL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("1. Resumo Operacional de Chamados", 14, 47);
    
    // Grid of cards (KPI metrics)
    const kpiMetrics = [
      { label: "Total Recibos", value: totalOrders.toString() },
      { label: "Concluidos", value: completedOrders.toString() },
      { label: "Abertos/Triagem", value: openOrders.toString() },
      { label: "Taxa Conclusao", value: `${completionRate}%` },
    ];
    
    kpiMetrics.forEach((kpi, idx) => {
      const x = 14 + idx * 46;
      const y = 53;
      const w = 42;
      const h = 20;
      
      // Draw background box
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(x, y, w, h, 2, 2, "F");
      
      // Draw labels
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 3, y + 6);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(kpi.value, x + 3, y + 15);
    });
    
    // More metrics details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(`* Chamados em Andamento: ${progressOrders}`, 14, 82);
    doc.text(`* Aguardando Material (Falta): ${materialOrders} (${materialShortageRate}% do total)`, 14, 88);
    doc.text(`* Chamados Cancelados: ${cancelledOrders}`, 14, 94);
    
    // SECTION 2: PRODUTIVIDADE DOS PROFISSIONAIS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("2. Produtividade por Profissional", 14, 108);
    
    // Table Headers
    const professionalsHeaderY = 114;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(14, professionalsHeaderY, 182, 7, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Nome do Tecnico", 16, professionalsHeaderY + 5);
    doc.text("Especialidade", 70, professionalsHeaderY + 5);
    doc.text("Em Progresso", 124, professionalsHeaderY + 5);
    doc.text("Concluidos", 152, professionalsHeaderY + 5);
    doc.text("Total Geral", 178, professionalsHeaderY + 5);
    
    let yOffset = professionalsHeaderY + 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    
    professionalProductivity.forEach((prof, idx) => {
      // Alternate background for table rows
      if (idx % 2 === 1) {
        doc.setFillColor(250, 251, 252);
        doc.rect(14, yOffset, 182, 6.5, "F");
      }
      
      doc.text(prof.name, 16, yOffset + 4.5);
      doc.text(prof.specialty, 70, yOffset + 4.5);
      doc.text(prof.active.toString(), 124, yOffset + 4.5);
      doc.text(prof.completed.toString(), 152, yOffset + 4.5);
      doc.text(prof.total.toString(), 178, yOffset + 4.5);
      
      // Bottom border line for row
      doc.setDrawColor(241, 245, 249);
      doc.line(14, yOffset + 6.5, 196, yOffset + 6.5);
      yOffset += 6.5;
    });
    
    // SECTION 3: HISTORICO DOS LOGS DE AUDITORIA
    yOffset += 11;
    if (yOffset > 185) {
      doc.addPage();
      yOffset = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("3. Historico de Auditoria do Sistema (Logs)", 14, yOffset);
    yOffset += 6;
    
    // Logs Tables Headers
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(14, yOffset, 182, 7, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Data/Hora", 16, yOffset + 5);
    doc.text("Categoria", 55, yOffset + 5);
    doc.text("Acao", 85, yOffset + 5);
    doc.text("Detalhes", 125, yOffset + 5);
    
    yOffset += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    
    const maxLogsToPrint = filteredLogs.slice(0, 100); // safety cap to prevent giant rendering
    
    maxLogsToPrint.forEach((log, idx) => {
      if (yOffset > 275) {
        doc.addPage();
        yOffset = 20;
        
        // Redraw table headers on new page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(14, yOffset, 182, 7, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text("Data/Hora", 16, yOffset + 5);
        doc.text("Categoria", 55, yOffset + 5);
        doc.text("Acao", 85, yOffset + 5);
        doc.text("Detalhes", 125, yOffset + 5);
        
        yOffset += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      }
      
      if (idx % 2 === 1) {
        doc.setFillColor(250, 251, 252);
        doc.rect(14, yOffset, 182, 6, "F");
      }
      
      // Format timestamp elegantly
      const logTimeFormatted = new Date(log.timestamp).toLocaleString("pt-BR");
      
      doc.text(logTimeFormatted, 16, yOffset + 4);
      doc.text((log.category || "").toUpperCase(), 55, yOffset + 4);
      doc.text((log.action || "").substring(0, 21), 85, yOffset + 4);
      
      const truncatedDetail = (log.details || "").length > 48 ? (log.details || "").substring(0, 46) + "..." : (log.details || "");
      doc.text(truncatedDetail, 125, yOffset + 4);
      
      doc.setDrawColor(241, 245, 249);
      doc.line(14, yOffset + 6, 196, yOffset + 6);
      yOffset += 6;
    });
    
    // Save PDF file
    const formattedDate = new Date().toISOString().split("T")[0];
    doc.save(`Relatorio_Gestao_Auditoria_${formattedDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Relatórios Gerenciais & Logs</h1>
          <p className="text-sm text-slate-500 font-medium">Visualize métricas estratégicas, produtividade da equipe e o histórico completo de auditoria do sistema.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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

          {/* Export PDF Button */}
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-indigo-605 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all active:translate-y-[1px]"
            title="Exportar todos os relatórios operacionais & logs de auditoria em PDF"
          >
            <Download className="w-4 h-4" />
            PDF Relatório
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
          <div className="p-5 border-b border-slate-100 bg-slate-50/55 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Text Search Term field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-semibold text-slate-700"
                  placeholder="Filtrar por termo (ex: Criado, Status, Suporte)..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                />
              </div>

              {/* Category Search Selector */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-48 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-bold text-slate-700 cursor-pointer appearance-none pr-8"
                >
                  <option value="all">Todas as Categorias</option>
                  <option value="requisicao">📋 Chamados e Requisições</option>
                  <option value="requisitante">👥 Requisitantes</option>
                  <option value="tecnico">🔧 Técnicos & Equipe</option>
                  <option value="sistema">⚙️ Eventos de Sistema</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <SlidersHorizontal className="w-3 h-3" />
                </div>
              </div>

              {/* Reset to show all filters */}
              {(logsSearch || categoryFilter !== "all") && (
                <button
                  onClick={() => {
                    setLogsSearch("");
                    setCategoryFilter("all");
                  }}
                  className="p-2.5 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
                  title="Limpar todos os filtros de busca"
                >
                  <X className="w-4 h-4 mr-1 sm:mr-0 inline" />
                  <span className="sm:hidden text-xs font-bold">Limpar Filtros</span>
                </button>
              )}
            </div>

            {/* Log Category Quick Buttons for desktop view */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 flex-wrap sm:flex-nowrap">
              <span className="hidden xl:inline text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">Atalhos:</span>
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors cursor-pointer ${
                  categoryFilter === "all" 
                    ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs" 
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setCategoryFilter("requisicao")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 cursor-pointer ${
                  categoryFilter === "requisicao" 
                    ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                Requisições
              </button>
              <button
                onClick={() => setCategoryFilter("requisitante")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 cursor-pointer ${
                  categoryFilter === "requisitante" 
                    ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                Requisitantes
              </button>
              <button
                onClick={() => setCategoryFilter("tecnico")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 cursor-pointer ${
                  categoryFilter === "tecnico" 
                    ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                Equipe
              </button>
              <button
                onClick={() => setCategoryFilter("sistema")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transition-colors flex items-center gap-1 cursor-pointer ${
                  categoryFilter === "sistema" 
                    ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs" 
                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                Sistema
              </button>

              <button
                onClick={() => {
                  if (confirm("Confirmar a limpeza permanente de todos os logs de auditoria do sistema?")) {
                    onClearLogs();
                  }
                }}
                className="ml-auto sm:ml-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
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

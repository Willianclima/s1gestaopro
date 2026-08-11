import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { ServiceOrder, Client, Professional, SystemLog, LoginAttempt } from "../types";
import { 
  BarChart3, FileText, Search, Clock, CheckCircle2, AlertTriangle, 
  X, HelpCircle, Users, Activity, SlidersHorizontal, Wrench, RefreshCw, Trash2,
  Download, Lock, ShieldCheck, ShieldAlert, List, LayoutGrid, Sparkles
} from "lucide-react";
import AiLogAnalysisModal from "./AiLogAnalysisModal";

interface ReportsAndLogsProps {
  orders: ServiceOrder[];
  clients: Client[];
  professionals: Professional[];
  logs: SystemLog[];
  onClearLogs: () => void;
  loginAttempts: LoginAttempt[];
  onClearLoginAttempts: () => void;
}

export default function ReportsAndLogs({ 
  orders, clients, professionals, logs, onClearLogs, loginAttempts = [], onClearLoginAttempts
}: ReportsAndLogsProps) {
  const [activeTab, setActiveTab] = useState<"charts" | "audit" | "access">("charts");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [logPeriodFilter, setLogPeriodFilter] = useState<string>("all");
  const [logUserFilter, setLogUserFilter] = useState<string>("all");
  const [accessSearch, setAccessSearch] = useState("");
  const [accessStatusFilter, setAccessStatusFilter] = useState<string>("all");

  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reports_view_mode");
      if (saved === "cards" || saved === "list") return saved;
    }
    return "list";
  });

  const handleSetViewMode = (mode: "cards" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("reports_view_mode", mode);
    }
  };

  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedAccessIds, setSelectedAccessIds] = useState<string[]>([]);

  const handleToggleSelectLog = (id: string) => {
    setSelectedLogIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAllLogs = () => {
    if (selectedLogIds.length === filteredLogs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(filteredLogs.map(l => l.id));
    }
  };

  const handleToggleSelectAccess = (id: string) => {
    setSelectedAccessIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAllAccess = () => {
    if (selectedAccessIds.length === filteredAccessAttempts.length) {
      setSelectedAccessIds([]);
    } else {
      setSelectedAccessIds(filteredAccessAttempts.map(a => a.id));
    }
  };

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

    // Filter by timestamp range
    let matchesPeriod = true;
    if (logPeriodFilter !== "all" && log.timestamp) {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - logDate.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      if (logPeriodFilter === "today") {
        matchesPeriod = diffMs <= oneDayMs;
      } else if (logPeriodFilter === "week") {
        matchesPeriod = diffMs <= 7 * oneDayMs;
      } else if (logPeriodFilter === "month") {
        matchesPeriod = diffMs <= 30 * oneDayMs;
      }
    }

    // Filter by user responsible (contains name in action/details text)
    let matchesUser = true;
    if (logUserFilter !== "all") {
      const uName = logUserFilter.toLowerCase();
      matchesUser = log.action.toLowerCase().includes(uName) || 
                    log.details.toLowerCase().includes(uName);
    }

    return matchesSearch && matchesCategory && matchesPeriod && matchesUser;
  });

  // Filter access attempts
  const filteredAccessAttempts = (loginAttempts || []).filter(attempt => {
    const term = accessSearch.toLowerCase();
    const matchesSearch = 
      attempt.username.toLowerCase().includes(term) ||
      attempt.userId.toLowerCase().includes(term) ||
      attempt.details.toLowerCase().includes(term) ||
      attempt.userType.toLowerCase().includes(term);
    const matchesStatus = 
      accessStatusFilter === "all" || attempt.status === accessStatusFilter;
    return matchesSearch && matchesStatus;
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

  const exportCompletedOrdersToCSV = () => {
    const completed = orders.filter(o => o.status === "concluido");
    if (completed.length === 0) {
      alert("Nenhuma ordem de serviço concluída disponível para exportação em CSV.");
      return;
    }

    const headers = [
      "ID da OS",
      "Nome do Requisitante",
      "Título da Demanda",
      "Categoria Técnica",
      "Técnico Executor",
      "Data de Início",
      "Data de Conclusão",
      "Localização / Endereço",
      "Resumo Técnica / Notas",
      "Criado Em"
    ];

    const rows = completed.map(o => {
      const clientName = clients.find(c => c.id === o.clientId)?.name || "Não Identificado";
      return [
        `#${o.id}`,
        clientName,
        o.title,
        o.category,
        o.assignedTo || "Técnico Não Alocado",
        o.startDate ? new Date(o.startDate).toLocaleDateString("pt-BR") : "---",
        o.endDate ? new Date(o.endDate).toLocaleDateString("pt-BR") : "---",
        o.location || "Araçatuba/SP",
        o.notes || "Nenhum fechamento registrado",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "---"
      ];
    });

    const csvRows = [headers, ...rows];
    const csvContent = "\uFEFF" + csvRows.map(r => r.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `OS_Concluidas_Aracatuba_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllOrdersToCSV = () => {
    if (orders.length === 0) {
      alert("Nenhuma ordem de serviço disponível para exportação em CSV.");
      return;
    }

    const headers = [
      "ID da OS",
      "Nome do Requisitante",
      "Título da Demanda",
      "Categoria Técnica",
      "Status",
      "Técnico Executor",
      "Data de Início",
      "Data de Conclusão",
      "Localização / Endereço",
      "Resumo Técnico / Notas",
      "Criado Em"
    ];

    const rows = orders.map(o => {
      const clientName = clients.find(c => c.id === o.clientId)?.name || "Não Identificado";
      
      let statusLabel: string = o.status;
      if (o.status === "aberto") statusLabel = "Aberto";
      else if (o.status === "em_progresso") statusLabel = "Em Execução";
      else if (o.status === "aguardando") statusLabel = "Aguardando Material";
      else if (o.status === "concluido") statusLabel = "Concluído";
      else if (o.status === "cancelado") statusLabel = "Cancelado";

      return [
        `#${o.id}`,
        clientName,
        o.title,
        o.category,
        statusLabel,
        o.assignedTo || "Sem Técnico",
        o.startDate ? new Date(o.startDate).toLocaleDateString("pt-BR") : "---",
        o.endDate ? new Date(o.endDate).toLocaleDateString("pt-BR") : "---",
        o.location || "Araçatuba/SP",
        o.notes || "Sem fechamento registrado",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "---"
      ];
    });

    const csvRows = [headers, ...rows];
    const csvContent = "\uFEFF" + csvRows.map(r => r.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `OS_Todas_Contratadas_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCompletedOrdersToPDF = () => {
    const completed = orders.filter(o => o.status === "concluido");
    if (completed.length === 0) {
      alert("Nenhuma ordem de serviço concluída disponível para exportação em PDF.");
      return;
    }

    const doc = new jsPDF();
    
    // Header & Design Theme (Indigo & Slate)
    const primaryColor = [79, 70, 229]; // Indigo-600
    const darkGray = [30, 41, 59]; // slate-800
    const lightGray = [248, 250, 252]; // slate-50
    
    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Araçatuba Serviços de Manutenção - OS Concluídas", 14, 22);
    
    // Meta information
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Relatório de Encerramento Operacional - Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 29);
    doc.text(`Total de Chamados Triados e Finalizados: ${completed.length}`, 14, 34);
    
    // horizontal rule
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);
    
    // Table Header Header Line
    let yOffset = 46;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(14, yOffset, 182, 7, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Código/OS", 16, yOffset + 5);
    doc.text("Requisitante", 34, yOffset + 5);
    doc.text("Título do Serviço", 74, yOffset + 5);
    doc.text("Categoria", 126, yOffset + 5);
    doc.text("Técnico Executor", 154, yOffset + 5);
    doc.text("Concluído", 182, yOffset + 5);
    
    yOffset += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    
    completed.forEach((o, idx) => {
      if (yOffset > 270) {
        doc.addPage();
        yOffset = 20;
        
        // Redraw Header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(14, yOffset, 182, 7, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text("Código/OS", 16, yOffset + 5);
        doc.text("Requisitante", 34, yOffset + 5);
        doc.text("Título do Serviço", 74, yOffset + 5);
        doc.text("Categoria", 126, yOffset + 5);
        doc.text("Técnico Executor", 154, yOffset + 5);
        doc.text("Concluído", 182, yOffset + 5);
        
        yOffset += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      }
      
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yOffset, 182, 6, "F");
      }
      
      const clientName = clients.find(c => c.id === o.clientId)?.name || "Não Identificado";
      const formattedEndDate = o.endDate ? new Date(o.endDate).toLocaleDateString("pt-BR") : "---";
      
      doc.text(`#${o.id}`, 16, yOffset + 4);
      doc.text(clientName.substring(0, 20), 34, yOffset + 4);
      doc.text(o.title.substring(0, 24), 74, yOffset + 4);
      doc.text(o.category, 126, yOffset + 4);
      doc.text((o.assignedTo || "Não Alocado").substring(0, 14), 154, yOffset + 4);
      doc.text(formattedEndDate, 182, yOffset + 4);
      
      doc.setDrawColor(241, 245, 249);
      doc.line(14, yOffset + 6, 196, yOffset + 6);
      yOffset += 6;
    });
    
    // Save PDF file
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`OS_Concluidas_Aracatuba_${dateStr}.pdf`);
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

            <button
              onClick={() => setActiveTab("access")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "access"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Lock className="w-4 h-4" />
              Auditoria de Acesso
            </button>
          </div>

          {/* Seletor de Modo de Exibição (Lista / Cards) para os Logs/Auditoria */}
          {(activeTab === "audit" || activeTab === "access") && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider py-2 px-3.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-indigo-500/50"
                title="Analisar anomalias e padrões atípicos com a IA Gemini"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">Análise com IA</span>
              </button>

              <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "list"
                      ? "bg-slate-900 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Visão em Lista"
                >
                  <List className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSetViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-slate-900 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Visão em Cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Export PDF Button */}
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all active:translate-y-[1px]"
            title="Exportar todos os relatórios operacionais & logs de auditoria em PDF"
          >
            <Download className="w-4 h-4" />
            PDF Relatório
          </button>

          {/* Export CSV Button */}
          <button
            onClick={exportAllOrdersToCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all active:translate-y-[1px]"
            title="Exportar todas as Ordens de Serviço em formato CSV (Excel)"
          >
            <FileText className="w-4 h-4" />
            CSV Geral
          </button>
        </div>
      </div>

      {activeTab === "charts" && (
        <div className="space-y-6">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cumpatibilidade Operacional</span>
              <span className="text-3xl font-extrabold text-slate-85block">{completionRate}%</span>
              <div className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 w-max px-2 py-0.5 rounded-lg">
                📋 {completedOrders} de {totalOrders} Concluídos
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-slate-100 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Aguardando Material</span>
              <span className="text-3xl font-extrabold text-slate-85block">{materialShortageRate}%</span>
              <div className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 w-max px-2 py-0.5 rounded-lg">
                ⚠️ {materialOrders} chamados travados
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Média de Requisitantes</span>
              <span className="text-3xl font-extrabold text-slate-85block">{clients.length} Ativos</span>
              <div className="text-xs text-indigo-600 font-bold mt-1 bg-indigo-50 w-max px-2 py-0.5 rounded-lg">
                👥 Integridade no GS
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-indigo-50 rounded-xl">
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Em Atendimento</span>
              <span className="text-3xl font-extrabold text-slate-85block">{progressOrders} Técnicos</span>
              <div className="text-xs text-slate-600 font-bold mt-1 bg-slate-100 w-max px-2 py-0.5 rounded-lg">
                ⚡ Execução ativa em campo
              </div>
              <div className="absolute top-4 right-4 p-2.5 bg-slate-100 rounded-xl">
                <Clock className="w-5 h-5 text-slate-655" />
              </div>
            </div>
          </div>

          {/* Export & Extraction Panel for Completed OS */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-slate-800 p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <span className="text-[11px] bg-indigo-500/25 border border-indigo-400/35 text-indigo-300 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block">
                Controle de Dados e Exportação
              </span>
              <h3 className="font-extrabold text-white text-lg tracking-tight">Central de Extração e Exportação (.CSV / .PDF)</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Extraia relatórios completos das Ordens de Serviço contratadas ou finalizadas do sistema em formato CSV (otimizado para Microsoft Excel) ou em PDF estruturado.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={exportAllOrdersToCSV}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-y-[1px]"
                title="Consolida absolutamente todas as ordens de serviço em formato .CSV para Excel"
              >
                <FileText className="w-4 h-4 text-white" />
                Exportar CSV Geral
              </button>

              <button
                onClick={exportCompletedOrdersToCSV}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/25 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-y-[1px]"
                title="Consolida todas as ordens concluídas em formato .CSV delimitado por ponto e vírgula"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                Exportar CSV Concluídos
              </button>
              
              <button
                onClick={exportCompletedOrdersToPDF}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-y-[1px]"
                title="Gera um relatório formatado em PDF apenas com as Ordens de Serviço dadas como concluídas"
              >
                <Download className="w-4 h-4 text-white" />
                Exportar PDF (Concluídos)
              </button>
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
      )}

      {activeTab === "audit" && (
        /* AUDIT LOGGER VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
          {/* Filtering Ribbon */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/55 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Text Search Term field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-semibold text-slate-700"
                  placeholder="Filtrar por ação ou conteúdo nos logs de auditoria..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                />
              </div>

              {/* Reset to show all filters */}
              {(logsSearch || categoryFilter !== "all" || logPeriodFilter !== "all" || logUserFilter !== "all") && (
                <button
                  onClick={() => {
                    setLogsSearch("");
                    setCategoryFilter("all");
                    setLogPeriodFilter("all");
                    setLogUserFilter("all");
                  }}
                  className="px-3.5 py-2.5 border border-slate-250 bg-white hover:bg-slate-55 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold shrink-0 shadow-xs"
                  title="Reseta absolutamente todos os filtros da auditoria"
                >
                  <X className="w-4 h-4" />
                  <span>Limpar Todos os Filtros</span>
                </button>
              )}
            </div>

            {/* Additional Advanced Audit Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Category Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Filtrar por Categoria</label>
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-bold text-slate-700 cursor-pointer appearance-none pr-8"
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
              </div>

              {/* Time Period Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Período de Tempo</label>
                <div className="relative">
                  <select
                    value={logPeriodFilter}
                    onChange={(e) => setLogPeriodFilter(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-bold text-slate-700 cursor-pointer appearance-none pr-8"
                  >
                    <option value="all">Qualquer Período</option>
                    <option value="today">📅 Últimas 24 Horas</option>
                    <option value="week">📅 Última Semana</option>
                    <option value="month">📅 Último Mês</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                    <Clock className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* User Responsible Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Usuário Responsável</label>
                <div className="relative">
                  <select
                    value={logUserFilter}
                    onChange={(e) => setLogUserFilter(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-bold text-slate-700 cursor-pointer appearance-none pr-8"
                  >
                    <option value="all">Qualquer Usuário</option>
                    <option value="Willian C. Lima">Willian C. Lima (Gestor/Admin)</option>
                    <option value="Gestor">Gestores Associados</option>
                    {professionals && professionals.length > 0 && (
                      <optgroup label="Técnicos & Equipe">
                        {professionals.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {clients && clients.length > 0 && (
                      <optgroup label="Clientes & Requisitantes">
                        {clients.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                    <Users className="w-3 h-3" />
                  </div>
                </div>
              </div>
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
            {/* Batch Selection Ribbon for Audit Logs */}
            {filteredLogs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 hover:text-slate-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={filteredLogs.length > 0 && selectedLogIds.length === filteredLogs.length}
                      onChange={handleSelectAllLogs}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Selecionar Todos ({filteredLogs.length})</span>
                  </label>

                  {selectedLogIds.length > 0 && (
                    <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-lg border border-indigo-100 text-xs">
                      {selectedLogIds.length} selecionado(s)
                    </span>
                  )}
                </div>

                {selectedLogIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLogIds([])}
                      className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logs List / Cards Pane */}
          <div className="flex-1 overflow-y-auto max-h-[500px] p-4">
            {viewMode === "list" ? (
              <div className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  let badgeClr = "bg-slate-100 text-slate-600";
                  let iconEl = <SlidersHorizontal className="w-4 h-4 text-slate-500" />;
                  
                  if (log.category === "requisicao") {
                    badgeClr = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                    iconEl = <FileText className="w-4 h-4 text-indigo-600" />;
                  } else if (log.category === "requisitante") {
                    badgeClr = "bg-blue-50 text-blue-700 border border-blue-105";
                    iconEl = <Users className="w-4 h-4 text-blue-600" />;
                  } else if (log.category === "tecnico") {
                    badgeClr = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                    iconEl = <Wrench className="w-4 h-4 text-emerald-600" />;
                  }

                  const isSelected = selectedLogIds.includes(log.id);

                  return (
                    <div key={log.id} className={`p-3.5 hover:bg-slate-50/50 transition-colors flex gap-3 items-start text-xs font-medium rounded-xl ${isSelected ? "bg-indigo-50/40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectLog(log.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mt-2"
                      />

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
                    <Activity className="w-12 h-12 text-slate-300 mb-2 animate-pulse" />
                    <p className="font-bold text-slate-500 text-sm">Nenhum registro de log localizado.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Insira novas requisições, altere status de serviços ou mude filtros para gerar logs na trilha de auditoria.</p>
                  </div>
                )}
              </div>
            ) : (
              /* CARDS MODE FOR AUDIT LOGS */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLogs.map((log) => {
                  let badgeClr = "bg-slate-100 text-slate-600";
                  let iconEl = <SlidersHorizontal className="w-4 h-4 text-slate-500" />;
                  
                  if (log.category === "requisicao") {
                    badgeClr = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                    iconEl = <FileText className="w-4 h-4 text-indigo-600" />;
                  } else if (log.category === "requisitante") {
                    badgeClr = "bg-blue-50 text-blue-700 border border-blue-105";
                    iconEl = <Users className="w-4 h-4 text-blue-600" />;
                  } else if (log.category === "tecnico") {
                    badgeClr = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                    iconEl = <Wrench className="w-4 h-4 text-emerald-600" />;
                  }

                  const isSelected = selectedLogIds.includes(log.id);

                  return (
                    <div
                      key={log.id}
                      className={`p-4 bg-white border ${
                        isSelected ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md" : "border-slate-150 shadow-xs"
                      } rounded-2xl flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div className="p-1.5 border border-slate-100 rounded-lg bg-slate-50">
                              {iconEl}
                            </div>
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${badgeClr}`}>
                              {log.category}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono font-bold">
                            {new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-slate-800 text-xs leading-snug">{log.action}</h4>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed line-clamp-3">{log.details}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono font-semibold">
                        {new Date(log.timestamp).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <div className="col-span-full p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <Activity className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
                    <p className="font-bold text-slate-500 text-xs">Nenhum registro de log encontrado.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "access" && (
        /* ACCESS AUDIT LAYER VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
          {/* Filtering Ribbon */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/55 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-semibold text-slate-700"
                  placeholder="Buscar por CPF, ID ou detalhe de logon..."
                  value={accessSearch}
                  onChange={(e) => setAccessSearch(e.target.value)}
                />
              </div>

              {/* Status Selector */}
              <div className="relative">
                <select
                  value={accessStatusFilter}
                  onChange={(e) => setAccessStatusFilter(e.target.value)}
                  className="w-full sm:w-48 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-white transition-all font-bold text-slate-700 cursor-pointer appearance-none pr-8"
                >
                  <option value="all">Todos os Status</option>
                  <option value="success">✅ Apenas Sucessos</option>
                  <option value="failed">❌ Apenas Falhas</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <SlidersHorizontal className="w-3 h-3" />
                </div>
              </div>

              {/* Reset shortcut */}
              {(accessSearch || accessStatusFilter !== "all") && (
                <button
                  onClick={() => {
                    setAccessSearch("");
                    setAccessStatusFilter("all");
                  }}
                  className="p-2.5 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
                  title="Limpar filtros"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Clear access logs button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (confirm("Confirmar a limpeza permanente de todo o histórico de tentativas de autenticação? Esta operação é irreversível.")) {
                    onClearLoginAttempts();
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Auditoria
              </button>
            </div>
          </div>

          {/* Batch Selection Ribbon for Access Logs */}
          {filteredAccessAttempts.length > 0 && (
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 hover:text-slate-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={filteredAccessAttempts.length > 0 && selectedAccessIds.length === filteredAccessAttempts.length}
                    onChange={handleSelectAllAccess}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Selecionar Todos ({filteredAccessAttempts.length})</span>
                </label>

                {selectedAccessIds.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-lg border border-indigo-100 text-xs">
                    {selectedAccessIds.length} selecionado(s)
                  </span>
                )}
              </div>

              {selectedAccessIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAccessIds([])}
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Desmarcar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Access Logs List Segment */}
          <div className="flex-1 p-4 overflow-x-auto">
            {viewMode === "list" ? (
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-150 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider font-sans">
                    <th className="px-4 py-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredAccessAttempts.length > 0 && selectedAccessIds.length === filteredAccessAttempts.length}
                        onChange={handleSelectAllAccess}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Carimbo de Data/Hora</th>
                    <th className="px-6 py-3.5">Chave Informada (Doc)</th>
                    <th className="px-6 py-3.5">ID Resolvido</th>
                    <th className="px-6 py-3.5">Perfil</th>
                    <th className="px-6 py-3.5">Descrição do Evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
                  {filteredAccessAttempts.map((attempt) => {
                    let profileBadgeColor = "bg-slate-100 text-slate-600";
                    let profileLabel = attempt.userType;

                    if (attempt.userType === "gestor") {
                      profileBadgeColor = "bg-indigo-50 border border-indigo-100 text-indigo-700";
                      profileLabel = "Gestor / Diretor";
                    } else if (attempt.userType === "requisitante") {
                      profileBadgeColor = "bg-blue-50 border border-blue-105 text-blue-700";
                      profileLabel = "Requisitante";
                    } else if (attempt.userType === "profissional") {
                      profileBadgeColor = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                      profileLabel = "Técnico de Campo";
                    } else {
                      profileBadgeColor = "bg-slate-100 text-slate-500 border border-slate-200";
                      profileLabel = "Desconhecido";
                    }

                    const isSelected = selectedAccessIds.includes(attempt.id);

                    return (
                      <tr 
                        key={attempt.id} 
                        className={`hover:bg-slate-50/45 transition-colors ${isSelected ? "bg-indigo-50/40" : ""} ${
                          attempt.status === "failed" ? "hover:bg-red-50/15" : "hover:bg-emerald-50/10"
                        }`}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectAccess(attempt.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attempt.status === "success" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Sucesso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-100 text-red-700 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              Bloqueado / Falha
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-500">
                          {new Date(attempt.timestamp).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-slate-700">
                          {attempt.username || "Não preenchido"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                          {attempt.userId === "desconhecido" ? (
                            <span className="text-slate-400 font-sans font-medium">Não Identificado</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px]">
                              {attempt.userId}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-lg ${profileBadgeColor}`}>
                            {profileLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 leading-relaxed font-semibold text-slate-600 whitespace-nowrap sm:whitespace-normal">
                          {attempt.details}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAccessAttempts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <div className="flex flex-col items-center justify-center">
                          <Lock className="w-12 h-12 text-slate-300 mb-2 animate-pulse" />
                          <p className="font-bold text-slate-500 text-sm">Nenhuma tentativa de logon localizada.</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-sm">Tente reajustar seus termos de filtragem ou de status de auditoria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* CARDS MODE FOR ACCESS LOGS */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAccessAttempts.map((attempt) => {
                  let profileBadgeColor = "bg-slate-100 text-slate-600";
                  let profileLabel = attempt.userType;

                  if (attempt.userType === "gestor") {
                    profileBadgeColor = "bg-indigo-50 border border-indigo-100 text-indigo-700";
                    profileLabel = "Gestor / Diretor";
                  } else if (attempt.userType === "requisitante") {
                    profileBadgeColor = "bg-blue-50 border border-blue-105 text-blue-700";
                    profileLabel = "Requisitante";
                  } else if (attempt.userType === "profissional") {
                    profileBadgeColor = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                    profileLabel = "Técnico de Campo";
                  } else {
                    profileBadgeColor = "bg-slate-100 text-slate-500 border border-slate-200";
                    profileLabel = "Desconhecido";
                  }

                  const isSelected = selectedAccessIds.includes(attempt.id);

                  return (
                    <div
                      key={attempt.id}
                      className={`p-4 bg-white border ${
                        isSelected ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md" : "border-slate-150 shadow-xs"
                      } rounded-2xl flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectAccess(attempt.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            {attempt.status === "success" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-md font-bold text-[9px] uppercase tracking-wider">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                Sucesso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 rounded-md font-bold text-[9px] uppercase tracking-wider">
                                <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                                Falha
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${profileBadgeColor}`}>
                            {profileLabel}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-extrabold text-slate-800">{attempt.username || "Chave não preenchida"}</p>
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{attempt.details}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono font-semibold">
                        <span>{attempt.userId !== "desconhecido" ? `ID: ${attempt.userId}` : "Não Identificado"}</span>
                        <span>{new Date(attempt.timestamp).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  );
                })}

                {filteredAccessAttempts.length === 0 && (
                  <div className="col-span-full p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <Lock className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
                    <p className="font-bold text-slate-500 text-xs">Nenhuma tentativa de acesso encontrada.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Análise e Auditoria do SystemLog via IA */}
      <AiLogAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        logs={logs}
        loginAttempts={loginAttempts}
        initialScope={activeTab === "access" ? "access" : "all"}
      />
    </div>
  );
}

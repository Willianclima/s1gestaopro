import React, { useState } from "react";
import { AccessProfile, PermissionRoutine } from "../types";
import { 
  ShieldCheck, Check, Plus, Trash2, RotateCcw, Save, Sparkles, 
  LayoutDashboard, FileText, BarChart3, Calendar, Users, Building2, 
  Bot, AlertTriangle, Layers, ChevronRight, Lock, CheckSquare, Square,
  LayoutGrid, List, Search, ToggleLeft, ToggleRight, X, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "./ToastContext";

// Definicao de todas as rotinas de Gestao de Servicos disponiveis no sistema
export const SYSTEM_PERMISSIONS_ROUTINES: PermissionRoutine[] = [
  // Categoria: Painel & Gestao Visual
  {
    key: "view_dashboard",
    label: "Painel Dashboard Principal",
    description: "Acesso à página inicial de visão geral operacional dos serviços.",
    category: "dashboard"
  },
  {
    key: "view_operational_summary",
    label: "Resumo Operacional de Serviços",
    description: "Visualizar contadores e cartões de resumo de OS em andamento, concluídas e pendentes.",
    category: "dashboard"
  },
  {
    key: "view_heat_map",
    label: "Mapa de Calor de Atendimentos",
    description: "Visualizar mapa de geolocalização de ocorrências e distribuição geográfica dos serviços.",
    category: "dashboard"
  },
  {
    key: "view_system_health",
    label: "Saúde e Conformidade do Sistema",
    description: "Acompanhar métricas de SLA, estabilidade operacional e status de conformidade.",
    category: "dashboard"
  },

  // Categoria: Requisicao & Ordens de Servico
  {
    key: "create_requisition",
    label: "Criar Nova Requisição de Serviço",
    description: "Abrir novos chamados e solicitações de atendimento com validação de CEP e endereço.",
    category: "orders"
  },
  {
    key: "view_own_requisitions",
    label: "Ver Minhas Requisições Solicitadas",
    description: "Acompanhar o histórico e status das solicitações criadas pelo próprio perfil.",
    category: "orders"
  },
  {
    key: "view_all_orders",
    label: "Ver Todas as Ordens de Serviço (OS)",
    description: "Acesso à lista global de todas as ordens de serviço do órgão/unidade.",
    category: "orders"
  },
  {
    key: "edit_order",
    label: "Editar OS & Atribuir Técnicos",
    description: "Atribuir equipes técnicas, alterar detalhes do serviço e anexar evidências.",
    category: "orders"
  },
  {
    key: "change_order_status",
    label: "Alterar Status Operacional de OS",
    description: "Avançar status da OS (Em Análise -> Atribuído -> Em Atendimento -> Concluído).",
    category: "orders"
  },
  {
    key: "cancel_order",
    label: "Cancelar / Rejeitar Requisições",
    description: "Permissão para cancelar chamados ou rejeitar solicitações com justificativa.",
    category: "orders"
  },

  // Categoria: Metricas & B.I.
  {
    key: "view_bi_metrics",
    label: "Painel de Métricas B.I.",
    description: "Acesso aos gráficos analíticos de desempenho, tempo médio de atendimento e categorias.",
    category: "bi"
  },
  {
    key: "export_reports",
    label: "Exportar Relatórios (PDF / Excel)",
    description: "Download de relatórios gerenciais e sínteses para órgãos de controle.",
    category: "bi"
  },

  // Categoria: Agendamento & Calendario
  {
    key: "view_scheduler",
    label: "Visualizar Agenda de Atendimentos",
    description: "Acesso ao calendário de visitas e cronograma de equipes de campo.",
    category: "scheduler"
  },
  {
    key: "manage_scheduler",
    label: "Agendar e Remanejar Visitas Técnicas",
    description: "Reordenar horários na agenda e remanejar equipes de atendimento.",
    category: "scheduler"
  },

  // Categoria: Profissionais e Equipes
  {
    key: "view_professionals",
    label: "Visualizar Quadro de Técnicos e Equipes",
    description: "Ver lista de profissionais de campo, especialidades e disponibilidade.",
    category: "professionals"
  },
  {
    key: "manage_professionals",
    label: "Cadastrar e Editar Profissionais Técnicos",
    description: "Adicionar novos técnicos, definir turnos e vincular especialidades de serviço.",
    category: "professionals"
  },

  // Categoria: Administracao & Clientes
  {
    key: "view_clients",
    label: "Visualizar Cadastro de Requisitantes e Clientes",
    description: "Acesso à lista de solicitantes e unidades cadastradas no sistema.",
    category: "clients"
  },
  {
    key: "manage_client_approvals",
    label: "Aprovar Cadastros e Modalidades de Acesso",
    description: "Autorizar novos usuários e definir prazos de degustação (15 dias) vs acesso completo.",
    category: "clients"
  },
  {
    key: "manage_access_profiles",
    label: "Gerenciar Matriz de Permissões de Perfis",
    description: "Configurar e alterar rotinas permitidas para cada perfil de acesso do sistema.",
    category: "system"
  },

  // Categoria: Assistente I.A. & Sistema
  {
    key: "use_ai_assistant",
    label: "Utilizar Assistente I.A. de Triagem",
    description: "Consultar a Inteligência Artificial para análise automática de prioridades e diagnósticos.",
    category: "system"
  },
  {
    key: "view_system_logs",
    label: "Visualizar Logs de Auditoria do Sistema",
    description: "Acesso aos registros de ações, aprovações e auditoria de movimentações.",
    category: "system"
  }
];

export const DEFAULT_ACCESS_PROFILES: AccessProfile[] = [
  {
    id: "requisitante",
    name: "Requisitante de Serviços",
    description: "Perfil voltado a usuários que abrem chamados, acompanham suas solicitações e consultam métricas básicas de conformidade.",
    color: "emerald",
    isSystemDefault: true,
    permissions: {
      view_dashboard: true,
      view_operational_summary: true,
      view_heat_map: true,
      view_system_health: true,
      create_requisition: true,
      view_own_requisitions: true,
      view_all_orders: false,
      edit_order: false,
      change_order_status: false,
      cancel_order: true,
      view_bi_metrics: false,
      export_reports: false,
      view_scheduler: false,
      manage_scheduler: false,
      view_professionals: false,
      manage_professionals: false,
      view_clients: false,
      manage_client_approvals: false,
      manage_access_profiles: false,
      use_ai_assistant: true,
      view_system_logs: false
    }
  },
  {
    id: "gestor_servicos",
    name: "Gestor de Serviços & Operações",
    description: "Responsável pelo gerenciamento de ordens de serviço, triagem, despacho de equipes técnicas e agendamento.",
    color: "blue",
    isSystemDefault: true,
    permissions: {
      view_dashboard: true,
      view_operational_summary: true,
      view_heat_map: true,
      view_system_health: true,
      create_requisition: true,
      view_own_requisitions: true,
      view_all_orders: true,
      edit_order: true,
      change_order_status: true,
      cancel_order: true,
      view_bi_metrics: true,
      export_reports: true,
      view_scheduler: true,
      manage_scheduler: true,
      view_professionals: true,
      manage_professionals: true,
      view_clients: true,
      manage_client_approvals: false,
      manage_access_profiles: false,
      use_ai_assistant: true,
      view_system_logs: true
    }
  },
  {
    id: "gestor",
    name: "Gestor Geral / Diretor",
    description: "Visão estratégica completa de todos os módulos de serviços, métricas B.I., aprovações de contas e exportação de relatórios.",
    color: "amber",
    isSystemDefault: true,
    permissions: {
      view_dashboard: true,
      view_operational_summary: true,
      view_heat_map: true,
      view_system_health: true,
      create_requisition: true,
      view_own_requisitions: true,
      view_all_orders: true,
      edit_order: true,
      change_order_status: true,
      cancel_order: true,
      view_bi_metrics: true,
      export_reports: true,
      view_scheduler: true,
      manage_scheduler: true,
      view_professionals: true,
      manage_professionals: true,
      view_clients: true,
      manage_client_approvals: true,
      manage_access_profiles: true,
      use_ai_assistant: true,
      view_system_logs: true
    }
  },
  {
    id: "admin",
    name: "Administrador do Sistema",
    description: "Acesso irrestrito a todas as configurações, matrizes de acesso, logs de auditoria e parametrizações da plataforma.",
    color: "purple",
    isSystemDefault: true,
    permissions: {
      view_dashboard: true,
      view_operational_summary: true,
      view_heat_map: true,
      view_system_health: true,
      create_requisition: true,
      view_own_requisitions: true,
      view_all_orders: true,
      edit_order: true,
      change_order_status: true,
      cancel_order: true,
      view_bi_metrics: true,
      export_reports: true,
      view_scheduler: true,
      manage_scheduler: true,
      view_professionals: true,
      manage_professionals: true,
      view_clients: true,
      manage_client_approvals: true,
      manage_access_profiles: true,
      use_ai_assistant: true,
      view_system_logs: true
    }
  }
];

interface RolePermissionsManagerProps {
  profiles: AccessProfile[];
  onSaveProfiles: (updatedProfiles: AccessProfile[]) => void;
  onResetToDefaults?: () => void;
}

export default function RolePermissionsManager({
  profiles = DEFAULT_ACCESS_PROFILES,
  onSaveProfiles,
  onResetToDefaults
}: RolePermissionsManagerProps) {
  const { success: toastSuccess, info: toastInfo } = useToast();
  const [activeProfiles, setActiveProfiles] = useState<AccessProfile[]>(
    profiles.length > 0 ? profiles : DEFAULT_ACCESS_PROFILES
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles[0]?.id || "requisitante"
  );
  const [isCreatingProfile, setIsCreatingProfile] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>("");
  const [newProfileDesc, setNewProfileDesc] = useState<string>("");

  // Preferencia visual do administrador: 'list' (padrão) ou 'cards'
  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    return (localStorage.getItem("permissions_view_mode") as "cards" | "list") || "list";
  });

  // Filtro de busca para rotinas
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleSetViewMode = (mode: "cards" | "list") => {
    setViewMode(mode);
    localStorage.setItem("permissions_view_mode", mode);
  };

  const currentProfile = activeProfiles.find((p) => p.id === selectedProfileId) || activeProfiles[0];

  const categories = [
    { id: "dashboard", label: "Painel & Visão Geral", icon: LayoutDashboard },
    { id: "orders", label: "Requisições & Ordens de Serviço", icon: FileText },
    { id: "bi", label: "Métricas B.I. & Relatórios", icon: BarChart3 },
    { id: "scheduler", label: "Agendamento & Calendário", icon: Calendar },
    { id: "professionals", label: "Equipes Técnicas & Profissionais", icon: Users },
    { id: "clients", label: "Aprovação de Usuários & Clientes", icon: Building2 },
    { id: "system", label: "Segurança & Inteligência I.A.", icon: ShieldCheck },
  ];

  const handleTogglePermission = (routineKey: string) => {
    if (!currentProfile) return;

    const currentVal = !!currentProfile.permissions[routineKey];
    const updatedPermissions = {
      ...currentProfile.permissions,
      [routineKey]: !currentVal
    };

    const updatedProfiles = activeProfiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          permissions: updatedPermissions
        };
      }
      return p;
    });

    setActiveProfiles(updatedProfiles);
    onSaveProfiles(updatedProfiles);
    toastSuccess(
      `Permissão "${routineKey}" ${!currentVal ? "HABILITADA" : "DESABILITADA"} para o perfil "${currentProfile.name}". Todos os usuários vinculados foram atualizados.`,
      "Matriz de Permissões Atualizada"
    );
  };

  const handleToggleCategory = (categoryId: string, enableAll: boolean) => {
    if (!currentProfile) return;

    const categoryRoutines = SYSTEM_PERMISSIONS_ROUTINES.filter((r) => r.category === categoryId);
    const newPermissions = { ...currentProfile.permissions };

    categoryRoutines.forEach((r) => {
      newPermissions[r.key] = enableAll;
    });

    const updatedProfiles = activeProfiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          permissions: newPermissions
        };
      }
      return p;
    });

    setActiveProfiles(updatedProfiles);
    onSaveProfiles(updatedProfiles);
    toastSuccess(
      `Todas as rotinas do grupo foram ${enableAll ? "HABILITADAS" : "DESABILITADAS"} para "${currentProfile.name}".`,
      "Acesso Atualizado em Lote"
    );
  };

  const handleCreateNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    const newId = `perfil_${Date.now()}`;
    const newProfile: AccessProfile = {
      id: newId,
      name: newProfileName.trim(),
      description: newProfileDesc.trim() || "Perfil customizado de gestão de serviços.",
      color: "indigo",
      isSystemDefault: false,
      permissions: {
        view_dashboard: true,
        view_operational_summary: true,
        create_requisition: true,
        view_own_requisitions: true,
        view_all_orders: false,
        edit_order: false,
        change_order_status: false,
        cancel_order: false,
        view_bi_metrics: false,
        export_reports: false,
        view_scheduler: false,
        manage_scheduler: false,
        view_professionals: false,
        manage_professionals: false,
        view_clients: false,
        manage_client_approvals: false,
        manage_access_profiles: false,
        use_ai_assistant: true,
        view_system_logs: false
      }
    };

    const updated = [...activeProfiles, newProfile];
    setActiveProfiles(updated);
    onSaveProfiles(updated);
    setSelectedProfileId(newId);
    setIsCreatingProfile(false);
    setNewProfileName("");
    setNewProfileDesc("");
    toastSuccess(`Novo perfil "${newProfile.name}" criado com sucesso!`, "Perfil Adicionado");
  };

  const handleDeleteProfile = (profileId: string) => {
    const profToDelete = activeProfiles.find((p) => p.id === profileId);
    if (!profToDelete) return;

    if (profToDelete.isSystemDefault) {
      alert("Os perfis nativos do sistema (Requisitante, Gestor de Serviços, Gestor e Admin) não podem ser removidos, apenas alterados.");
      return;
    }

    if (confirm(`Tem certeza que deseja excluir o perfil "${profToDelete.name}"?`)) {
      const updated = activeProfiles.filter((p) => p.id !== profileId);
      setActiveProfiles(updated);
      onSaveProfiles(updated);
      setSelectedProfileId(updated[0]?.id || "requisitante");
      toastInfo(`Perfil "${profToDelete.name}" removido do cadastro.`, "Perfil Excluído");
    }
  };

  // Filtragem de rotinas
  const filteredRoutines = SYSTEM_PERMISSIONS_ROUTINES.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.label.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term) ||
      r.key.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-8 space-y-6 sm:space-y-8 text-slate-100 shadow-2xl">
      {/* Header com Seletor de Estilo Visual */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                ADMINISTRAÇÃO DO SISTEMA
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Gestão Dinâmica de Permissões
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Matriz de Perfis e Permissões de Acesso
            </h2>
          </div>
        </div>

        {/* Controles do Administrador: Estilo de Exibição & Criar Perfil */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Switcher de Formato: Lista (Padrão) vs Grade (Cards) */}
          <div className="bg-slate-950 p-1.5 rounded-2xl border border-amber-500/40 flex items-center gap-1.5 shadow-lg">
            <span className="text-[10px] font-black uppercase text-slate-400 pl-2 pr-1 hidden md:inline">
              Visualização:
            </span>
            <button
              type="button"
              onClick={() => handleSetViewMode("list")}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
              title="Modo de Visualização em Lista Compacta"
            >
              <List className="w-4 h-4" />
              <span>Lista (Padrão)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode("cards")}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
              title="Modo de Visualização em Grade / Cards"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grade (Cards)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingProfile(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3 px-4 sm:px-5 rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Perfil</span>
          </button>
        </div>
      </div>

      {/* Profile Selector Section (Cards vs List Mode) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
          <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            Selecione o Perfil para Editar:
          </label>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Modo Atual:</span>
            <span className="text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
              {viewMode === "cards" ? "Grade de Cards" : "Lista Compacta"}
            </span>
          </div>
        </div>

        {/* MODO CARDS */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeProfiles.map((p) => {
              const isSelected = p.id === selectedProfileId;
              const totalActive = Object.values(p.permissions).filter(Boolean).length;
              const totalRoutines = SYSTEM_PERMISSIONS_ROUTINES.length;
              const pct = Math.round((totalActive / totalRoutines) * 100);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative space-y-3 text-left ${
                    isSelected
                      ? "bg-slate-800 border-amber-500 ring-2 ring-amber-500/30 shadow-lg"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-extrabold text-sm ${isSelected ? "text-amber-400" : "text-white"}`}>
                      {p.name}
                    </h3>
                    {p.isSystemDefault ? (
                      <span className="text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                        Nativo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(p.id);
                        }}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded transition-all shrink-0"
                        title="Excluir Perfil Customizado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                    {p.description}
                  </p>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500 uppercase font-bold">Rotinas Liberadas:</span>
                      <span className="font-extrabold text-amber-400">
                        {totalActive} / {totalRoutines} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MODO LISTA COMPACTA PARA PERFIS */
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
            {activeProfiles.map((p) => {
              const isSelected = p.id === selectedProfileId;
              const totalActive = Object.values(p.permissions).filter(Boolean).length;
              const totalRoutines = SYSTEM_PERMISSIONS_ROUTINES.length;
              const pct = Math.round((totalActive / totalRoutines) * 100);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`p-3.5 sm:p-4 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left ${
                    isSelected
                      ? "bg-amber-950/20 border-l-4 border-l-amber-500 text-white"
                      : "hover:bg-slate-900/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-amber-400 bg-amber-400" : "border-slate-600"
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-extrabold text-sm ${isSelected ? "text-amber-400" : "text-white"}`}>
                          {p.name}
                        </span>
                        {p.isSystemDefault ? (
                          <span className="text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                            Nativo
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
                            Customizado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-xl mt-0.5">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="bg-amber-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-400 min-w-[50px] text-right">
                        {totalActive}/{totalRoutines}
                      </span>
                    </div>

                    {!p.isSystemDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(p.id);
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg transition-all"
                        title="Excluir Perfil Customizado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Routine Checkboxes Categories Matrix */}
      {currentProfile && (
        <div className="space-y-6 bg-slate-950/80 p-4 sm:p-6 rounded-3xl border border-slate-800">
          {/* Active Profile Banner & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Configuração do Perfil Selecionado
              </span>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                <Layers className="w-5 h-5 text-amber-400" />
                {currentProfile.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {currentProfile.description}
              </p>
            </div>

            {/* Field de Busca de Permissões */}
            <div className="w-full md:w-72 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filtrar rotinas / permissões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-medium bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Grouped Categories List */}
          <div className="space-y-6">
            {categories.map((cat) => {
              const CategoryIcon = cat.icon;
              const catRoutines = filteredRoutines.filter((r) => r.category === cat.id);
              if (catRoutines.length === 0) return null;

              const activeInCat = catRoutines.filter((r) => !!currentProfile.permissions[r.key]).length;

              return (
                <div key={cat.id} className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          {cat.label}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({activeInCat} de {catRoutines.length} ativas)
                        </span>
                      </div>
                    </div>

                    {/* Bulk Actions for Category */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id, true)}
                        className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Marcar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id, false)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  {/* CARDS MODE VS LIST MODE PARA AS ROTINAS */}
                  {viewMode === "cards" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {catRoutines.map((routine) => {
                        const isChecked = !!currentProfile.permissions[routine.key];

                        return (
                          <div
                            key={routine.key}
                            onClick={() => handleTogglePermission(routine.key)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                              isChecked
                                ? "bg-amber-950/20 border-amber-500/50 hover:border-amber-500 text-slate-100"
                                : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-400"
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-amber-400" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-600" />
                              )}
                            </div>

                            <div className="space-y-0.5 text-left min-w-0">
                              <span className={`text-xs font-bold block ${isChecked ? "text-amber-200" : "text-slate-300"}`}>
                                {routine.label}
                              </span>
                              <p className="text-[11px] text-slate-400 leading-snug">
                                {routine.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* MODO LISTA SIMPLIFICADA PARA AS ROTINAS */
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl divide-y divide-slate-800/60 overflow-hidden">
                      {catRoutines.map((routine) => {
                        const isChecked = !!currentProfile.permissions[routine.key];

                        return (
                          <div
                            key={routine.key}
                            onClick={() => handleTogglePermission(routine.key)}
                            className={`p-3 sm:p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                              isChecked
                                ? "bg-amber-950/10 text-slate-100 hover:bg-amber-950/20"
                                : "hover:bg-slate-900/60 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="shrink-0 cursor-pointer">
                                {isChecked ? (
                                  <ToggleRight className="w-6 h-6 text-amber-400" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-slate-600" />
                                )}
                              </div>

                              <div className="min-w-0 text-left">
                                <span className={`text-xs font-bold block ${isChecked ? "text-amber-200" : "text-slate-300"}`}>
                                  {routine.label}
                                </span>
                                <p className="text-[11px] text-slate-400 truncate max-w-xl">
                                  {routine.description}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isChecked ? (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                                  Liberado
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-500 border border-slate-700 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg">
                                  Bloqueado
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Criar Perfil Customizado */}
      <AnimatePresence>
        {isCreatingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 text-slate-100 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  Cadastrar Novo Perfil de Acesso
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Nome do Perfil
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supervisor de Obras / Fiscal de Contrato"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Descrição da Função / Atribuição
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Descreva as responsabilidades operacionais deste perfil..."
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProfile(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase py-2.5 px-4 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase py-2.5 px-5 rounded-xl cursor-pointer shadow-md"
                  >
                    Salvar e Configurar Permissões
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

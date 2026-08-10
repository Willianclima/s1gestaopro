import React, { useState } from "react";
import { AccessProfile, PermissionRoutine, CurrentUser } from "../types";
import { 
  ShieldCheck, Check, Plus, Trash2, RotateCcw, Save, Sparkles, 
  LayoutDashboard, FileText, BarChart3, Calendar, Users, Building2, 
  Bot, AlertTriangle, Layers, ChevronRight, Lock, CheckSquare, Square,
  LayoutGrid, List, Search, ToggleLeft, ToggleRight, X, SlidersHorizontal, Copy,
  Download, FileJson, FileSpreadsheet, Upload, ArrowUpDown
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
  currentUser?: CurrentUser | null;
}

export default function RolePermissionsManager({
  profiles = DEFAULT_ACCESS_PROFILES,
  onSaveProfiles,
  onResetToDefaults,
  currentUser
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

  // Re-sync with localStorage if changed elsewhere
  React.useEffect(() => {
    const savedMode = (localStorage.getItem("permissions_view_mode") as "cards" | "list") || "list";
    if (savedMode !== viewMode) {
      setViewMode(savedMode);
    }
  }, []);

  // Filtro de busca para perfis e rotinas
  const [profileSearchTerm, setProfileSearchTerm] = useState<string>("");
  const [profileSortBy, setProfileSortBy] = useState<"name-asc" | "name-desc" | "date-desc" | "date-asc">("name-asc");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Seleção múltipla para ações em lote (batch selection)
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);

  const handleToggleBatchSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBatch = () => {
    if (batchSelectedIds.length === filteredProfiles.length && filteredProfiles.length > 0) {
      setBatchSelectedIds([]);
    } else {
      setBatchSelectedIds(filteredProfiles.map((p) => p.id));
    }
  };

  const handleBatchDelete = () => {
    const selectedProfiles = activeProfiles.filter((p) => batchSelectedIds.includes(p.id));
    const customProfiles = selectedProfiles.filter((p) => !p.isSystemDefault);

    if (customProfiles.length === 0) {
      alert("Nenhum perfil customizado selecionado. Os perfis nativos do sistema não podem ser excluídos.");
      return;
    }

    const hasNative = selectedProfiles.some((p) => p.isSystemDefault);
    const nativeMsg = hasNative
      ? " (Observação: Perfis nativos selecionados não serão removidos)."
      : "";

    if (
      confirm(
        `Tem certeza que deseja excluir os ${customProfiles.length} perfil(is) customizado(s) selecionado(s)?${nativeMsg}`
      )
    ) {
      const customIdsToDelete = customProfiles.map((p) => p.id);
      const updated = activeProfiles.filter((p) => !customIdsToDelete.includes(p.id));
      setActiveProfiles(updated);
      onSaveProfiles(updated);
      setBatchSelectedIds([]);
      setSelectedProfileId(updated[0]?.id || "requisitante");
      toastInfo(`${customProfiles.length} perfil(is) excluído(s) em lote.`, "Exclusão em Lote");
    }
  };

  const handleBatchEnableAllPermissions = () => {
    if (batchSelectedIds.length === 0) return;
    const updatedProfiles = activeProfiles.map((p) => {
      if (batchSelectedIds.includes(p.id)) {
        const allTruePerms = { ...p.permissions };
        SYSTEM_PERMISSIONS_ROUTINES.forEach((r) => {
          allTruePerms[r.key] = true;
        });
        return { ...p, permissions: allTruePerms };
      }
      return p;
    });

    setActiveProfiles(updatedProfiles);
    onSaveProfiles(updatedProfiles);
    toastSuccess(
      `Todas as rotinas foram HABILITADAS em lote para ${batchSelectedIds.length} perfil(is).`,
      "Alteração em Lote"
    );
  };

  const handleBatchDisableAllPermissions = () => {
    if (batchSelectedIds.length === 0) return;
    const updatedProfiles = activeProfiles.map((p) => {
      if (batchSelectedIds.includes(p.id)) {
        const allFalsePerms = { ...p.permissions };
        SYSTEM_PERMISSIONS_ROUTINES.forEach((r) => {
          allFalsePerms[r.key] = false;
        });
        return { ...p, permissions: allFalsePerms };
      }
      return p;
    });

    setActiveProfiles(updatedProfiles);
    onSaveProfiles(updatedProfiles);
    toastSuccess(
      `Todas as rotinas foram DESABILITADAS em lote para ${batchSelectedIds.length} perfil(is).`,
      "Alteração em Lote"
    );
  };

  const handleBatchDuplicate = () => {
    if (batchSelectedIds.length === 0) return;
    const selectedProfiles = activeProfiles.filter((p) => batchSelectedIds.includes(p.id));
    const newProfiles: AccessProfile[] = selectedProfiles.map((source, index) => ({
      id: `perfil_copy_${Date.now()}_${index}`,
      name: `${source.name} (Cópia)`,
      description: `Perfil duplicado em lote a partir de "${source.name}".`,
      color: "indigo",
      isSystemDefault: false,
      permissions: { ...source.permissions },
      createdAt: new Date().toISOString()
    }));

    const updated = [...activeProfiles, ...newProfiles];
    setActiveProfiles(updated);
    onSaveProfiles(updated);
    toastSuccess(
      `${newProfiles.length} perfil(is) duplicado(s) em lote com sucesso!`,
      "Duplicação em Lote"
    );
  };

  const handleExportBatchJSON = () => {
    if (batchSelectedIds.length === 0) return;
    const selectedProfiles = activeProfiles.filter((p) => batchSelectedIds.includes(p.id));
    const dataStr = JSON.stringify(selectedProfiles, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `perfis_acesso_export_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess(
      `${selectedProfiles.length} perfil(is) exportado(s) em JSON.`,
      "Exportação Concluída"
    );
  };

  const handleExportBatchCSV = () => {
    if (batchSelectedIds.length === 0) return;
    const selectedProfiles = activeProfiles.filter((p) => batchSelectedIds.includes(p.id));

    const routineKeys = SYSTEM_PERMISSIONS_ROUTINES.map((r) => r.key);
    const routineLabels = SYSTEM_PERMISSIONS_ROUTINES.map((r) => `"${r.label.replace(/"/g, '""')}"`);

    const headers = [
      "ID",
      "Nome",
      "Descrição",
      "Tipo",
      ...routineLabels
    ].join(",");

    const rows = selectedProfiles.map((p) => {
      const id = `"${p.id.replace(/"/g, '""')}"`;
      const name = `"${p.name.replace(/"/g, '""')}"`;
      const desc = `"${p.description.replace(/"/g, '""')}"`;
      const type = p.isSystemDefault ? '"Nativo"' : '"Customizado"';
      const perms = routineKeys.map((key) => (p.permissions[key] ? '"SIM"' : '"NÃO"'));

      return [id, name, desc, type, ...perms].join(",");
    });

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `perfis_acesso_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess(
      `${selectedProfiles.length} perfil(is) exportado(s) em CSV.`,
      "Exportação Concluída"
    );
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedData = JSON.parse(content);

        if (!Array.isArray(importedData)) {
          alert("O arquivo JSON deve conter uma lista de perfis de acesso.");
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;
        const currentProfilesMap = new Map<string, AccessProfile>(activeProfiles.map((p) => [p.id, p]));

        importedData.forEach((imp: any) => {
          if (imp && imp.name && imp.permissions) {
            const profileId = imp.id || `perfil_imported_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const isNative = Boolean(imp.isSystemDefault);
            const newProfile: AccessProfile = {
              id: profileId,
              name: imp.name,
              description: imp.description || "Perfil importado via JSON.",
              color: imp.color || "indigo",
              isSystemDefault: isNative,
              permissions: { ...imp.permissions },
              createdAt: imp.createdAt || new Date().toISOString()
            };

            if (currentProfilesMap.has(profileId)) {
              currentProfilesMap.set(profileId, newProfile);
              updatedCount++;
            } else {
              currentProfilesMap.set(profileId, newProfile);
              addedCount++;
            }
          }
        });

        const mergedList = Array.from(currentProfilesMap.values());
        setActiveProfiles(mergedList);
        onSaveProfiles(mergedList);
        toastSuccess(
          `Importação concluída: ${addedCount} perfil(is) novo(s) e ${updatedCount} atualizado(s).`,
          "Importação de Perfis"
        );
      } catch (err) {
        alert("Erro ao ler o arquivo JSON. Certifique-se de que é um JSON de perfis válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
      },
      createdAt: new Date().toISOString()
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

  const handleDuplicateProfile = (sourceProfile: AccessProfile) => {
    const newId = `perfil_copy_${Date.now()}`;
    const newName = `${sourceProfile.name} (Cópia)`;
    const newProfile: AccessProfile = {
      id: newId,
      name: newName,
      description: `Perfil duplicado a partir do template "${sourceProfile.name}".`,
      color: "indigo",
      isSystemDefault: false,
      permissions: { ...sourceProfile.permissions },
      createdAt: new Date().toISOString()
    };

    const updated = [...activeProfiles, newProfile];
    setActiveProfiles(updated);
    onSaveProfiles(updated);
    setSelectedProfileId(newId);
    toastSuccess(
      `Novo perfil "${newName}" criado com base em "${sourceProfile.name}". Permissões clonadas com sucesso!`,
      "Perfil Duplicado / Template"
    );
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

  // Filtragem e Ordenação de perfis por nome ou data de criação
  const filteredProfiles = React.useMemo(() => {
    const list = activeProfiles.filter((p) => {
      if (!profileSearchTerm.trim()) return true;
      const term = profileSearchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
    });

    const getProfileTimestamp = (p: AccessProfile) => {
      if (p.createdAt) {
        const time = new Date(p.createdAt).getTime();
        if (!isNaN(time)) return time;
      }
      const match = p.id.match(/\d{10,13}/);
      if (match) {
        return parseInt(match[0], 10);
      }
      const originalIdx = activeProfiles.findIndex((item) => item.id === p.id);
      return 1000000000000 + (originalIdx >= 0 ? originalIdx : 0);
    };

    return [...list].sort((a, b) => {
      if (profileSortBy === "name-asc") {
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      }
      if (profileSortBy === "name-desc") {
        return b.name.localeCompare(a.name, "pt-BR", { sensitivity: "base" });
      }
      if (profileSortBy === "date-desc") {
        return getProfileTimestamp(b) - getProfileTimestamp(a);
      }
      if (profileSortBy === "date-asc") {
        return getProfileTimestamp(a) - getProfileTimestamp(b);
      }
      return 0;
    });
  }, [activeProfiles, profileSearchTerm, profileSortBy]);

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
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Header com Ações Globais */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Perfis e Permissões de Acesso
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Gerenciamento de funções, níveis de acesso, herança de privilégios e rotinas operacionais do sistema.
          </p>
        </div>

        {/* Controles do Administrador: Criar Perfil & Importar */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentUser?.userType === "admin" && (
            <label className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2 shrink-0">
              <Upload className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Importar JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => setIsCreatingProfile(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Novo Perfil</span>
          </button>
        </div>
      </div>

      {/* Container da Lista de Perfis */}
      <div className="space-y-3">
        {/* Barra de Busca, Ordenação e Modo de Visualização */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Campo de Busca de Perfis por Nome ou Descrição */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white dark:bg-slate-900 transition-all font-medium text-slate-700 dark:text-slate-200 shadow-xs"
            placeholder="Buscar perfis por nome ou descrição..."
            value={profileSearchTerm}
            onChange={(e) => setProfileSearchTerm(e.target.value)}
          />
          {profileSearchTerm && (
            <button
              type="button"
              onClick={() => setProfileSearchTerm("")}
              className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Seletor de Ordenação */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shrink-0">
          <ArrowUpDown className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="hidden sm:inline font-bold text-xs text-slate-500 dark:text-slate-400">Ordem:</span>
          <select
            value={profileSortBy}
            onChange={(e) => setProfileSortBy(e.target.value as any)}
            className="bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
          >
            <option value="name-asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Nome (A - Z)</option>
            <option value="name-desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Nome (Z - A)</option>
            <option value="date-desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Data de Criação (Mais recentes)</option>
            <option value="date-asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Data de Criação (Mais antigos)</option>
          </select>
        </div>

        {/* Seletor de Modo: Lista | Grade */}
        <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={() => handleSetViewMode("list")}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              viewMode === "list"
                ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Visualização em Lista"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode("cards")}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              viewMode === "cards"
                ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Visualização em Grade"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Ações em Lote */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllBatch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
            >
              {batchSelectedIds.length === filteredProfiles.length && filteredProfiles.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {batchSelectedIds.length === filteredProfiles.length && filteredProfiles.length > 0
                  ? "Deselecionar Todos"
                  : `Selecionar Todos (${filteredProfiles.length})`}
              </span>
            </button>

            {batchSelectedIds.length > 0 && (
              <span className="font-extrabold text-amber-800 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl text-xs">
                {batchSelectedIds.length} selecionado(s)
              </span>
            )}
          </div>

          {batchSelectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBatchEnableAllPermissions}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shadow-xs"
                title="Liberar todas as rotinas para os perfis selecionados"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Liberar Permissões</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDisableAllPermissions}
                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5 text-[11px]"
                title="Bloquear todas as rotinas para os perfis selecionados"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Bloquear Permissões</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDuplicate}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shadow-xs"
                title="Duplicar perfis selecionados"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicar ({batchSelectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={handleExportBatchJSON}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shadow-xs"
                title="Exportar perfis selecionados em arquivo JSON"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>

              <button
                type="button"
                onClick={handleExportBatchCSV}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shadow-xs"
                title="Exportar perfis selecionados em planilha CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shadow-xs"
                title="Excluir perfis customizados selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              <button
                type="button"
                onClick={() => setBatchSelectedIds([])}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
                title="Limpar Seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* MODO CARDS VS LISTA COM ANIMAÇÃO FADE-IN */}
        <AnimatePresence mode="wait">
          {viewMode === "cards" ? (
            <motion.div
              key="profile-cards-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 text-xs">
                  Nenhum perfil encontrado com "{profileSearchTerm}".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {filteredProfiles.map((p, index) => {
                    const isSelected = p.id === selectedProfileId;
                    const isBatchSelected = batchSelectedIds.includes(p.id);
                    const totalActive = Object.values(p.permissions).filter(Boolean).length;
                    const totalRoutines = SYSTEM_PERMISSIONS_ROUTINES.length;
                    const pct = Math.round((totalActive / totalRoutines) * 100);

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25), ease: "easeOut" }}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-amber-500/10 cursor-pointer relative space-y-3 text-left transform ${
                          isBatchSelected
                            ? "bg-amber-500/10 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/50 shadow-xs"
                            : isSelected
                            ? "bg-amber-50/90 dark:bg-slate-800 border-amber-500 ring-2 ring-amber-500/30 shadow-xs"
                            : "bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-950"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleBatchSelect(p.id, e)}
                              className={`p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                                isBatchSelected
                                  ? "bg-amber-500 text-slate-950 border-amber-600 shadow-2xs"
                                  : "bg-white dark:bg-slate-900/80 text-slate-400 hover:text-slate-700 dark:hover:text-white border-slate-200 dark:border-slate-700"
                              }`}
                              title={isBatchSelected ? "Deselecionar perfil" : "Selecionar para ação em lote"}
                            >
                              {isBatchSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <h3 className={`font-extrabold text-sm truncate ${isSelected ? "text-amber-800 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                              {p.name}
                            </h3>
                          </div>

                          {p.isSystemDefault ? (
                            <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                              Nativo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProfile(p.id);
                              }}
                              className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-all shrink-0"
                              title="Excluir Perfil Customizado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                          {p.description}
                        </p>

                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-500 dark:text-slate-500 uppercase font-bold">Rotinas Liberadas:</span>
                            <span className="font-extrabold text-amber-600 dark:text-amber-400">
                              {totalActive} / {totalRoutines} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                            <div 
                              className="bg-amber-500 dark:bg-amber-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateProfile(p);
                            }}
                            className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Usar este perfil como template para um novo"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicar</span>
                          </button>

                          {!p.isSystemDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProfile(p.id);
                              }}
                              className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-all shrink-0"
                              title="Excluir Perfil Customizado"
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            /* MODO LISTA COMPACTA PARA PERFIS */
            <motion.div
              key="profile-list-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 text-xs">
                  Nenhum perfil encontrado com "{profileSearchTerm}".
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800/80">
                  {filteredProfiles.map((p, index) => {
                    const isSelected = p.id === selectedProfileId;
                    const isBatchSelected = batchSelectedIds.includes(p.id);
                    const totalActive = Object.values(p.permissions).filter(Boolean).length;
                    const totalRoutines = SYSTEM_PERMISSIONS_ROUTINES.length;
                    const pct = Math.round((totalActive / totalRoutines) * 100);

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2), ease: "easeOut" }}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`p-3.5 sm:p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left transform ${
                          isBatchSelected
                            ? "bg-amber-500/15 dark:bg-amber-950/30 border-l-4 border-l-amber-500 text-slate-900 dark:text-white font-medium"
                            : isSelected
                            ? "bg-amber-50/80 dark:bg-amber-950/20 border-l-4 border-l-amber-500 text-slate-900 dark:text-white font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBatchSelect(p.id, e)}
                            className={`p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                              isBatchSelected
                                ? "bg-amber-500 text-slate-950 border-amber-600 shadow-2xs"
                                : "bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-white border-slate-200 dark:border-slate-700"
                            }`}
                            title={isBatchSelected ? "Deselecionar perfil" : "Selecionar para ação em lote"}
                          >
                            {isBatchSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          </button>

                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? "border-amber-500 bg-amber-500 dark:border-amber-400 dark:bg-amber-400" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-white dark:bg-slate-950 rounded-full" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-extrabold text-sm ${isSelected ? "text-amber-800 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                                {p.name}
                              </span>
                              {p.isSystemDefault ? (
                                <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                                  Nativo
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded">
                                  Customizado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xl mt-0.5">
                              {p.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 dark:bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                              <div 
                                className="bg-amber-500 dark:bg-amber-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 min-w-[50px] text-right">
                              {totalActive}/{totalRoutines}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateProfile(p);
                            }}
                            className="px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Usar este perfil como template para um novo"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Duplicar</span>
                          </button>

                          {!p.isSystemDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProfile(p.id);
                              }}
                              className="p-1.5 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-all"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Routine Checkboxes Categories Matrix */}
      {currentProfile && (
        <div className="space-y-6 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Active Profile Banner & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                Configuração do Perfil Selecionado
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <Layers className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                {currentProfile.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {currentProfile.description}
              </p>
            </div>

            {/* Field de Busca de Permissões */}
            <div className="w-full md:w-72 relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filtrar rotinas / permissões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white"
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
                <div key={cat.id} className="border-b border-slate-200 dark:border-slate-800/80 pb-6 space-y-4 last:border-b-0 last:pb-0">
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {cat.label}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          ({activeInCat} de {catRoutines.length} ativas)
                        </span>
                      </div>
                    </div>

                    {/* Bulk Actions for Category */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id, true)}
                        className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:text-slate-900 dark:hover:text-white bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Marcar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id, false)}
                        className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  {/* CARDS MODE VS LIST MODE PARA AS ROTINAS COM ANIMAÇÃO FADE-IN */}
                  <AnimatePresence mode="wait">
                    {viewMode === "cards" ? (
                      <motion.div
                        key={`routines-cards-${cat.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-2.5"
                      >
                        {catRoutines.map((routine) => {
                          const isChecked = !!currentProfile.permissions[routine.key];

                          return (
                            <div
                              key={routine.key}
                              onClick={() => handleTogglePermission(routine.key)}
                              className={`p-3 rounded-xl border transition-all duration-200 hover:scale-[1.015] hover:shadow-md cursor-pointer flex items-start gap-3 select-none transform ${
                                isChecked
                                  ? "bg-amber-500/10 dark:bg-amber-950/20 border-amber-400/80 dark:border-amber-500/50 hover:border-amber-500 text-slate-900 dark:text-slate-100"
                                  : "bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50/50"
                              }`}
                            >
                              <div className="mt-0.5 shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                )}
                              </div>

                              <div className="space-y-0.5 text-left min-w-0">
                                <span className={`text-xs font-bold block ${isChecked ? "text-amber-900 dark:text-amber-200" : "text-slate-800 dark:text-slate-300"}`}>
                                  {routine.label}
                                </span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {routine.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : (
                      /* MODO LISTA SIMPLIFICADA PARA AS ROTINAS */
                      <motion.div
                        key={`routines-list-${cat.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden"
                      >
                        {catRoutines.map((routine) => {
                          const isChecked = !!currentProfile.permissions[routine.key];

                          return (
                            <div
                              key={routine.key}
                              onClick={() => handleTogglePermission(routine.key)}
                              className={`p-3 sm:p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                                isChecked
                                  ? "bg-amber-500/10 dark:bg-amber-950/10 text-slate-900 dark:text-slate-100 hover:bg-amber-500/15 dark:hover:bg-amber-950/20"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="shrink-0 cursor-pointer">
                                  {isChecked ? (
                                    <ToggleRight className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                                  ) : (
                                    <ToggleLeft className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                                  )}
                                </div>

                                <div className="min-w-0 text-left">
                                  <span className={`text-xs font-bold block ${isChecked ? "text-amber-900 dark:text-amber-200" : "text-slate-800 dark:text-slate-300"}`}>
                                    {routine.label}
                                  </span>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xl">
                                    {routine.description}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isChecked ? (
                                  <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                                    Liberado
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg">
                                    Bloqueado
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Criar Perfil Customizado */}
      <AnimatePresence>
        {isCreatingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 text-slate-900 dark:text-slate-100 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  Cadastrar Novo Perfil de Acesso
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Perfil
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supervisor de Obras / Fiscal de Contrato"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Descrição da Função / Atribuição
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Descreva as responsabilidades operacionais deste perfil..."
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProfile(false)}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase py-2.5 px-4 rounded-xl cursor-pointer"
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
